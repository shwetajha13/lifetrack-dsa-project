
const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "lifetrack-demo-secret-change-before-deployment",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// REGISTER
app.post("/api/register", (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long."
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const createUser = db.transaction(() => {
      const result = db
        .prepare(
          "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
        )
        .run(cleanName, cleanEmail, passwordHash);

      db.prepare("INSERT INTO profiles (user_id) VALUES (?)").run(
        result.lastInsertRowid
      );
    });

    createUser();

    return res.status(201).json({
      message: "Account created successfully!"
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "Could not create your account. Please try again."
    });
  }
});

// LOGIN
app.post("/api/login", (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Please enter your email and password."
      });
    }

    const user = db
      .prepare(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?"
      )
      .get(email.trim().toLowerCase());

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({
        message: "Incorrect email or password."
      });
    }

    req.session.userId = user.id;

    return res.json({
      message: "Login successful!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again."
    });
  }
});

// TODAY'S ACTIVITIES
app.get("/api/activities", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const activities = db.prepare(`
      SELECT
        a.id,
        a.name,
        a.category,
        a.duration,
        a.description,
        CASE
          WHEN p.status = 'completed' THEN 1
          ELSE 0
        END AS completed
      FROM activities AS a
      LEFT JOIN progress AS p
        ON p.activity_id = a.id
        AND p.user_id = ?
        AND p.activity_date = date('now', 'localtime')
      ORDER BY a.id
    `).all(req.session.userId);

    return res.json({ activities });
  } catch (error) {
    console.error("Activities error:", error);
    return res.status(500).json({
      message: "Could not load activities. Please try again."
    });
  }
});

// SAVE OR UPDATE TODAY'S PROGRESS
app.post("/api/progress", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const { activityId, completed } = req.body || {};

    if (
      !Number.isInteger(activityId) ||
      typeof completed !== "boolean"
    ) {
      return res.status(400).json({
        message: "Invalid activity data."
      });
    }

    const activity = db
      .prepare("SELECT id FROM activities WHERE id = ?")
      .get(activityId);

    if (!activity) {
      return res.status(404).json({
        message: "Activity not found."
      });
    }

    db.prepare(`
      INSERT INTO progress
        (user_id, activity_id, activity_date, status, completed_at)
      VALUES (?, ?, date('now', 'localtime'), ?, ?)
      ON CONFLICT(user_id, activity_id, activity_date)
      DO UPDATE SET
        status = excluded.status,
        completed_at = excluded.completed_at
    `).run(
      req.session.userId,
      activityId,
      completed ? "completed" : "pending",
      completed ? new Date().toISOString() : null
    );

    return res.json({
      message: "Progress saved successfully."
    });
  } catch (error) {
    console.error("Progress save error:", error);
    return res.status(500).json({
      message: "Could not save progress. Please try again."
    });
  }
});

// ACTIVITY HISTORY
app.get("/api/history", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const history = db.prepare(`
      SELECT
        p.activity_date AS date,
        a.id AS activityId,
        a.name AS activityName,
        a.category,
        a.duration,
        p.status,
        p.completed_at AS completedAt
      FROM progress AS p
      INNER JOIN activities AS a
        ON a.id = p.activity_id
      WHERE p.user_id = ?
      ORDER BY p.activity_date DESC, a.name ASC
    `).all(req.session.userId);

    return res.json({ history });
  } catch (error) {
    console.error("History error:", error);
    return res.status(500).json({
      message: "Could not load activity history. Please try again."
    });
  }
});

// GET SAVED PROFILE AND DAILY GOAL
app.get("/api/profile", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const profile = db.prepare(`
      SELECT
        u.name,
        u.email,
        p.wellness_interest,
        p.preferred_activity,
        p.daily_goal
      FROM users AS u
      LEFT JOIN profiles AS p ON p.user_id = u.id
      WHERE u.id = ?
    `).get(req.session.userId);

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found."
      });
    }

    return res.json({
      profile: {
        ...profile,
        daily_goal: profile.daily_goal ?? 3
      }
    });
  } catch (error) {
    console.error("Profile load error:", error);
    return res.status(500).json({
      message: "Could not load your profile."
    });
  }
});

// UPDATE SAVED PROFILE AND DAILY GOAL
app.put("/api/profile", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const {
      daily_goal,
      wellness_interest,
      preferred_activity
    } = req.body || {};

    if (
      !Number.isInteger(daily_goal) ||
      daily_goal < 1 ||
      daily_goal > 6
    ) {
      return res.status(400).json({
        message: "Daily goal must be a whole number from 1 to 6."
      });
    }

    if (
      typeof wellness_interest !== "string" ||
      typeof preferred_activity !== "string" ||
      wellness_interest.length > 80 ||
      preferred_activity.length > 80
    ) {
      return res.status(400).json({
        message: "Please provide valid wellness preferences."
      });
    }

    const updateProfile = db.prepare(`
      UPDATE profiles
      SET daily_goal = ?,
          wellness_interest = ?,
          preferred_activity = ?
      WHERE user_id = ?
    `);

    const result = updateProfile.run(
      daily_goal,
      wellness_interest.trim(),
      preferred_activity.trim(),
      req.session.userId
    );

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Profile not found."
      });
    }

    return res.json({
      message: "Profile updated successfully!",
      daily_goal,
      wellness_interest: wellness_interest.trim(),
      preferred_activity: preferred_activity.trim()
    });
   } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({
      message: "Could not update your profile."
    });
  }
});
    
app.get("/api/recommendations", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const userId = req.session.userId;

    const profile = db.prepare(`
      SELECT wellness_interest, preferred_activity
      FROM profiles
      WHERE user_id = ?
    `).get(userId);

    const activities = db.prepare(`
      SELECT
        a.id,
        a.name,
        a.category,
        a.duration,
        a.description,
        CASE
          WHEN p.status = 'completed' THEN 1
          ELSE 0
        END AS completed
      FROM activities AS a
      LEFT JOIN progress AS p
        ON p.activity_id = a.id
        AND p.user_id = ?
        AND p.activity_date = date('now', 'localtime')
      ORDER BY a.id
    `).all(userId);

    const interest = (
      profile?.wellness_interest || ""
    ).trim().toLowerCase();

    const preferred = (
      profile?.preferred_activity || ""
    ).trim().toLowerCase();

    const recommendations = activities
      .filter(activity => !activity.completed)
      .map(activity => {
        let score = 0;
        let reason = "A good activity to try today.";

        if (
          interest &&
          activity.category.toLowerCase().includes(interest)
        ) {
          score += 3;
          reason = "Matches your wellness interest.";
        }

        if (
          preferred &&
          (
            activity.name.toLowerCase().includes(preferred) ||
            activity.category.toLowerCase().includes(preferred)
          )
        ) {
          score += 5;
          reason = "Matches your preferred activity.";
        }

        if (activity.duration <= 5) {
          score += 1;
        }

        return {
          ...activity,
          score,
          reason
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return res.json({ recommendations });
  } catch (error) {
    console.error("Recommendations error:", error);
    return res.status(500).json({
      message: "Could not load recommendations."
    });
  }
});


// CURRENT USER
app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const user = db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({
        message: "User not found. Please log in again."
      });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Current-user error:", error);
    return res.status(500).json({
      message: "Could not load your account. Please try again."
    });
  }
});

/* ==============================
   LIFETRACK NOTIFICATION APIs
================================ */

// GET notifications for the logged-in user
app.get("/api/notifications", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const userId = req.session.userId;

    const notifications = db.prepare(`
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = ? AND is_dismissed = 0
      ORDER BY created_at DESC, id DESC
      LIMIT 50
    `).all(userId);

    const unreadCount = notifications.filter(
      notification => notification.is_read === 0
    ).length;

    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications load error:", error);
    return res.status(500).json({
      message: "Could not load notifications."
    });
  }
});

// MARK A NOTIFICATION AS READ
app.patch("/api/notifications/:id/read", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        message: "Invalid notification ID."
      });
    }

    const result = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ? AND is_dismissed = 0
    `).run(id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Notification not found."
      });
    }

    return res.json({
      message: "Notification marked as read."
    });
  } catch (error) {
    console.error("Notification read error:", error);
    return res.status(500).json({
      message: "Could not update notification."
    });
  }
});

// DISMISS A NOTIFICATION
app.patch("/api/notifications/:id/dismiss", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        message: "Invalid notification ID."
      });
    }

    const result = db.prepare(`
      UPDATE notifications
      SET is_dismissed = 1
      WHERE id = ? AND user_id = ? AND is_dismissed = 0
    `).run(id, req.session.userId);

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Notification not found."
      });
    }

    return res.json({
      message: "Notification dismissed."
    });
  } catch (error) {
    console.error("Notification dismiss error:", error);
    return res.status(500).json({
      message: "Could not dismiss notification."
    });
  }
});


// LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        message: "Could not log out. Please try again."
      });
    }

    res.clearCookie("connect.sid");

    return res.json({
      message: "Logged out successfully!"
    });
  });
});

app.listen(PORT, () => {
  console.log(`LifeTrack server running at http://localhost:${PORT}`);
});
