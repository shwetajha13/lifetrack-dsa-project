
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "lifetrack.db"));

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        wellness_interest TEXT DEFAULT '',
        preferred_activity TEXT DEFAULT '',
        daily_goal INTEGER DEFAULT 3,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        duration INTEGER NOT NULL,
        description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        activity_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'completed')),
        completed_at TEXT,
        UNIQUE (user_id, activity_id, activity_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_progress_user_date
    ON progress(user_id, activity_date);
    CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    is_read INTEGER NOT NULL DEFAULT 0
        CHECK (is_read IN (0, 1)),
    is_dismissed INTEGER NOT NULL DEFAULT 0
        CHECK (is_dismissed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read, created_at);
`);

// Safely upgrade existing databases without deleting saved records.
function ensureColumn(tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some(column => column.name === columnName);

    if (!exists) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        console.log(`Database upgrade: added ${tableName}.${columnName}`);
    }
}

ensureColumn("profiles", "wellness_interest", "TEXT DEFAULT ''");
ensureColumn("profiles", "preferred_activity", "TEXT DEFAULT ''");
ensureColumn("profiles", "daily_goal", "INTEGER DEFAULT 3");

// Ensure every existing user has a profile.
db.prepare(`
    INSERT OR IGNORE INTO profiles (user_id)
    SELECT id FROM users
`).run();

const activities = [
    ["Morning meditation", "Mindfulness", 10,
        "Relax your mind with a few quiet minutes of breathing."],
    ["Take a short walk", "Fitness", 15,
        "Get moving with a refreshing walk."],
    ["Drink some water", "Healthy habits", 2,
        "Take a moment to hydrate."],
    ["Read a few pages", "Learning", 15,
        "Learn something new or enjoy a good book."],
    ["Gentle stretching", "Fitness", 5,
        "Release tension with comfortable stretches."],
    ["Write in a journal", "Mindfulness", 10,
        "Reflect on your day and record your thoughts."]
];

const insertActivity = db.prepare(`
    INSERT OR IGNORE INTO activities
    (name, category, duration, description)
    VALUES (?, ?, ?, ?)
`);

const seedActivities = db.transaction(() => {
    for (const [name, category, duration, description] of activities) {
        insertActivity.run(name, category, duration, description);
    }
});

seedActivities();

console.log("LifeTrack database is ready!");

module.exports = db;
