# lifetrack-dsa-project
🌱 LifeTrack — Daily Wellness & Activity Tracker
LifeTrack is a web-based daily activity and wellness tracking application developed as a DSA Major Project. It helps users build healthy habits, set daily goals, track completed activities, and review their progress over time.
✨ Features
- User registration and login with hashed passwords and session-based authentication
- Personal dashboard for viewing daily activities and progress
- Activity tracking — mark activities as completed or pending
- Daily goals — personalize the number of activities to complete
- Activity history — review saved activity records by date
- Profile preferences — save wellness interests and preferred activities
- Activity recommendations — retrieve suggested activities
- Notifications — view account-related notifications
- Responsive web pages built using HTML, CSS, and JavaScript
🛠️ Tech Stack
Layer	Technology
Frontend	HTML, CSS, JavaScript
Backend	Node.js, Express.js
Database	SQLite (better-sqlite3)
Authentication	express-session, bcryptjs
Version control	Git and GitHub


📁 Project Structure
LifeTrack/
├── index.html          # Landing page
├── register.html       # Registration page
├── login.html          # Login page
├── dashboard.html      # User dashboard
├── activities.html     # Activity tracking
├── history.html        # Activity history
├── style.css           # Styling
├── script.js           # Frontend JavaScript
├── server.js           # Express server and API routes
├── database.js         # SQLite schema and initial activities
├── package.json        # Project dependencies
└── package-lock.json   # Dependency lockfile
🚀 Run Locally
Prerequisites
- Node.js and npm installed
- VS Code or another code editor
Installation
1. Clone the repository:
   git clone https://github.com/shwetajha13/lifetrack-dsa-project.git
2. Open the project folder:
   cd lifetrack-dsa-project
3. Install dependencies:
   npm install
   Windows PowerShell tip: If npm.ps1 is blocked by the execution policy, run npm.cmd install instead.
4. Start the backend:
   node server.js
5. Open your browser at http://localhost:3000.
The SQLite database is created automatically when the server starts, and the default activity list is initialized if needed.
Note: Run the commands from the directory that contains package.json and server.js. If npm reports ENOENT, check your current folder.

☁️ Deployment (Render)
LifeTrack requires a Node.js web service, not static-only hosting.
1. Upload the project files to a GitHub repository. Do not upload node_modules, .env, or databases containing user information.
2. In Render, select New → Web Service and connect the repository.
3. Choose the Node runtime and configure:
   - Build command: npm install
   - Start command: node server.js
4. Add a private environment variable named SESSION_SECRET with a strong random value.
5. Deploy and open the URL provided by Render.
Database limitation: The project currently stores SQLite data in lifetrack.db within the application folder. On hosting plans with an ephemeral filesystem, registered users and progress can be lost after restarts or redeployments. Configure persistent storage or migrate to a hosted database for reliable long-term use. A production deployment should also use a persistent session store and review cookie/security settings.
🧠 Data Structures and Algorithms Concepts
LifeTrack demonstrates practical data management concepts, including:
- Relational tables and indexed lookups for efficiently retrieving users and progress
- Filtering and ordering activity history and user-specific records
- Uniqueness constraints to prevent duplicate progress records for the same activity and date
- Insert/update operations to maintain daily completion status
- Conditional selection to identify completed and pending activities
These operations are implemented primarily through SQLite queries and JavaScript logic rather than as standalone textbook DSA implementations.
🔐 Security Notes
- Passwords are stored as hashes rather than plain text.
- User-specific API endpoints require an authenticated session.
- Never commit .env, private secrets, or real user database files.
- Use test accounts when demonstrating the application publicly.
🎯 Project Objective
To provide a simple, user-friendly platform that encourages consistency in daily wellness routines through activity tracking, personalized goals, and progress history.
👩‍💻 Project Information
Project: LifeTrack
Category: DSA Major Project
Developer: Shweta Jha
Built to make everyday progress easier to track.
