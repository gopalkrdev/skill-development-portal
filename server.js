require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123!";

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "portal.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  branch TEXT DEFAULT '',
  semester TEXT DEFAULT '1',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline TEXT,
  points INTEGER DEFAULT 10,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  text_answer TEXT DEFAULT '',
  file_name TEXT,
  file_path TEXT,
  link_url TEXT DEFAULT '',
  status TEXT DEFAULT 'submitted',
  score INTEGER,
  feedback TEXT DEFAULT '',
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, student_id),
  FOREIGN KEY(challenge_id) REFERENCES challenges(id),
  FOREIGN KEY(student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function seed() {
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();

const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

if (!admin) {
  db.prepare(
    "INSERT INTO users (name,email,password_hash,role,branch,semester) VALUES (?,?,?,?,?,?)"
  ).run(
    "Portal Admin",
    ADMIN_EMAIL,
    adminHash,
    "admin",
    "CSE",
    "1"
  );
} else {
  db.prepare(
    "UPDATE users SET email=?, password_hash=?, role='admin' WHERE id=?"
  ).run(
    ADMIN_EMAIL,
    adminHash,
    admin.id
  );
}

  const count = db.prepare("SELECT COUNT(*) AS c FROM challenges").get().c;
  if (!count) {
    const insert = db.prepare("INSERT INTO challenges (title,category,description,deadline,points) VALUES (?,?,?,?,?)");
    insert.run("60-Second Self Introduction", "Communication",
      "Record a 60–90 second introduction. Include your name, why you chose BTech, one technical skill you want to learn, your first-year goal, and one thing you want to improve.",
      "", 10);
    insert.run("Basic Logic Challenge", "Coding",
      "Solve 5 beginner problems: largest of 3 numbers, even/odd, print 1–100, sum of digits, and reverse a number. Submit your code or explanation.",
      "", 10);
    insert.run("3-Slide AI Presentation", "Presentation",
      "Create a 3-slide presentation on: AI in Student Life — Helpful or Harmful? Explain the topic in up to 3 minutes.",
      "", 10);
    insert.run("Campus Problem Solver", "Problem Solving",
      "Identify one real college-student problem and propose a technology-based solution. Submit the problem, solution, and basic working.",
      "", 10);
    insert.run("GitHub Starter", "Technical",
      "Create a GitHub profile and your first repository. Add a README describing one learning goal.",
      "", 10);
  }

  const ann = db.prepare("SELECT COUNT(*) AS c FROM announcements").get().c;
  if (!ann) {
    db.prepare("INSERT INTO announcements (title,body) VALUES (?,?)")
      .run("Welcome Juniors 🚀", "This portal is for practical skill development. Learn → Practice → Submit → Get Feedback → Improve.");
  }
}
seed();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const allowed = new Set([
  "video/mp4", "video/webm", "video/quicktime",
  "application/pdf", "text/plain",
  "application/zip", "application/x-zip-compressed",
  "image/png", "image/jpeg", "image/webp"
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, allowed.has(file.mimetype))
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin" && req.user.role !== "senior") {
    return res.status(403).json({ error: "Senior/admin access required" });
  }
  next();
}

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, branch, semester } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare("INSERT INTO users (name,email,password_hash,role,branch,semester) VALUES (?,?,?,?,?,?)")
      .run(name.trim(), email.trim().toLowerCase(), hash, "student", branch || "", semester || "1");
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch {
    res.status(409).json({ error: "Email already registered" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, branch: user.branch, semester: user.semester } });
});

app.get("/api/me", auth, (req, res) => {
  const u = db.prepare("SELECT id,name,email,role,branch,semester,created_at FROM users WHERE id=?").get(req.user.id);
  res.json(u);
});

app.get("/api/challenges", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS submitted,
      s.status AS submission_status, s.score
    FROM challenges c
    LEFT JOIN submissions s ON s.challenge_id=c.id AND s.student_id=?
    ORDER BY c.id DESC
  `).all(req.user.id);
  res.json(rows);
});

app.get("/api/challenges/:id", auth, (req, res) => {
  const c = db.prepare("SELECT * FROM challenges WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "Challenge not found" });
  res.json(c);
});

app.post("/api/submissions", auth, upload.single("file"), (req, res) => {
  const { challenge_id, text_answer, link_url } = req.body;
  const c = db.prepare("SELECT id FROM challenges WHERE id=?").get(challenge_id);
  if (!c) return res.status(404).json({ error: "Challenge not found" });

  const existing = db.prepare("SELECT id FROM submissions WHERE challenge_id=? AND student_id=?")
    .get(challenge_id, req.user.id);
  if (existing) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(409).json({ error: "You already submitted this challenge" });
  }

  const fileName = req.file ? req.file.originalname : null;
  const filePath = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const result = db.prepare(`
    INSERT INTO submissions
    (challenge_id,student_id,text_answer,file_name,file_path,link_url)
    VALUES (?,?,?,?,?,?)
  `).run(challenge_id, req.user.id, text_answer || "", fileName, filePath, link_url || "");

  res.json({ ok: true, id: result.lastInsertRowid });
});

app.get("/api/my-submissions", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, c.title, c.category, c.points
    FROM submissions s JOIN challenges c ON c.id=s.challenge_id
    WHERE s.student_id=? ORDER BY s.submitted_at DESC
  `).all(req.user.id);
  res.json(rows);
});

app.get("/api/announcements", auth, (_, res) => {
  res.json(db.prepare("SELECT * FROM announcements ORDER BY id DESC").all());
});

app.get("/api/resources", auth, (_, res) => {
  res.json(db.prepare("SELECT * FROM resources ORDER BY id DESC").all());
});

app.get("/api/admin/stats", auth, adminOnly, (_, res) => {
  const students = db.prepare("SELECT COUNT(*) c FROM users WHERE role='student'").get().c;
  const submissions = db.prepare("SELECT COUNT(*) c FROM submissions").get().c;
  const reviewed = db.prepare("SELECT COUNT(*) c FROM submissions WHERE status='reviewed'").get().c;
  const challenges = db.prepare("SELECT COUNT(*) c FROM challenges").get().c;
  res.json({ students, submissions, reviewed, challenges });
});

app.get("/api/admin/submissions", auth, adminOnly, (_, res) => {
  const rows = db.prepare(`
    SELECT s.*, c.title, c.category, c.points,
           u.name AS student_name, u.email AS student_email,
           u.branch, u.semester
    FROM submissions s
    JOIN challenges c ON c.id=s.challenge_id
    JOIN users u ON u.id=s.student_id
    ORDER BY s.submitted_at DESC
  `).all();
  res.json(rows);
});

app.post("/api/admin/submissions/:id/review", auth, adminOnly, (req, res) => {
  const { score, feedback } = req.body;
  const row = db.prepare("SELECT * FROM submissions WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Submission not found" });

  db.prepare("UPDATE submissions SET score=?, feedback=?, status='reviewed' WHERE id=?")
    .run(Math.max(0, Number(score) || 0), feedback || "", req.params.id);
  res.json({ ok: true });
});

app.post("/api/admin/challenges", auth, adminOnly, (req, res) => {
  const { title, category, description, deadline, points } = req.body;
  if (!title || !category || !description) return res.status(400).json({ error: "Title, category and description required" });
  const r = db.prepare("INSERT INTO challenges (title,category,description,deadline,points) VALUES (?,?,?,?,?)")
    .run(title, category, description, deadline || "", Number(points) || 10);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.post("/api/admin/announcements", auth, adminOnly, (req, res) => {
  const { title, body } = req.body;
  const r = db.prepare("INSERT INTO announcements (title,body) VALUES (?,?)").run(title, body);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.post("/api/admin/resources", auth, adminOnly, (req, res) => {
  const { title, url, category } = req.body;
  const r = db.prepare("INSERT INTO resources (title,url,category) VALUES (?,?,?)").run(title, url, category || "General");
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.get("/api/admin/students", auth, adminOnly, (_, res) => {
  res.json(db.prepare(`
    SELECT u.id,u.name,u.email,u.branch,u.semester,u.created_at,
           COUNT(s.id) AS submissions,
           COALESCE(SUM(CASE WHEN s.status='reviewed' THEN 1 ELSE 0 END),0) AS reviewed
    FROM users u LEFT JOIN submissions s ON s.student_id=u.id
    WHERE u.role='student'
    GROUP BY u.id ORDER BY u.name
  `).all());
});

app.get("/health", (_, res) => res.json({ ok: true, service: "skill-development-portal" }));

app.get("/api/submissions/:id/file", auth, (req, res) => {
  const s = db.prepare("SELECT * FROM submissions WHERE id=?").get(req.params.id);
  if (!s || !s.file_path) return res.status(404).send("File not found");
  if (req.user.role !== "admin" && req.user.role !== "senior" && s.student_id !== req.user.id) {
    return res.status(403).send("Forbidden");
  }
  const file = path.join(DATA_DIR, s.file_path.replace(/^\/uploads\//, "uploads/"));
  if (!fs.existsSync(file)) return res.status(404).send("File missing");
  res.sendFile(file);
});

app.get("/api/admin/download/:id", auth, adminOnly, (req, res) => {
  const s = db.prepare("SELECT file_path,file_name FROM submissions WHERE id=?").get(req.params.id);
  if (!s || !s.file_path) return res.status(404).send("File not found");
  const file = path.join(DATA_DIR, s.file_path.replace(/^\/uploads\//, "uploads/"));
  if (!fs.existsSync(file)) return res.status(404).send("File missing");
  res.download(file, s.file_name || "submission");
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Skill Development Portal running at http://localhost:${PORT}`);
});