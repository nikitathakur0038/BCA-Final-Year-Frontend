// Vercel Serverless Function — Full Backend for Online Examination System
// This file handles ALL /api/* routes when deployed on Vercel

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'bca_final_year_secret_key_123';

// ─── Database Setup ────────────────────────────────────────────────────────────
// On Vercel, /tmp is the only writable directory
const DB_PATH = '/tmp/exam_system.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            phone TEXT,
            role TEXT DEFAULT 'student',
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            subject_id INTEGER NOT NULL,
            duration_minutes INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            marks_per_question REAL NOT NULL DEFAULT 1.0,
            negative_marks REAL NOT NULL DEFAULT 0.0,
            passing_percentage REAL NOT NULL DEFAULT 40.0,
            attempt_limit INTEGER DEFAULT 1,
            is_published INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            marks REAL DEFAULT 1.0,
            difficulty TEXT DEFAULT 'Medium',
            explanation TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS exam_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            question_order INTEGER,
            FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            UNIQUE(exam_id, question_id)
        );
        CREATE TABLE IF NOT EXISTS exam_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            started_at TEXT DEFAULT (datetime('now')),
            submitted_at TEXT NULL,
            score REAL DEFAULT 0.0,
            correct_answers INTEGER DEFAULT 0,
            wrong_answers INTEGER DEFAULT 0,
            unanswered INTEGER DEFAULT 0,
            percentage REAL DEFAULT 0.0,
            accuracy REAL DEFAULT 0.0,
            status TEXT DEFAULT 'in_progress',
            FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS student_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            selected_answer TEXT NULL,
            is_correct INTEGER DEFAULT 0,
            marks_obtained REAL DEFAULT 0.0,
            answered_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            UNIQUE(attempt_id, question_id)
        );
        CREATE TABLE IF NOT EXISTS exam_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            assigned_by INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(exam_id, student_id)
        );
    `);
}

function seedData() {
    const adminExists = db.prepare("SELECT id FROM users WHERE email = 'admin@example.com'").get();
    if (!adminExists) {
        db.prepare('INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)')
            .run('System Administrator', 'admin@example.com', '$2b$10$ws.Q6yB3zMRL/mvtld0s1OY6808GQZhm1JGBoMML2JamRYlTuVQxK', 'admin', 'active');
    }
    const teacherExists = db.prepare("SELECT id FROM users WHERE email = 'teacher@example.com'").get();
    if (!teacherExists) {
        db.prepare('INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)')
            .run('Test Teacher', 'teacher@example.com', '$2b$10$L2YglU58RXtQXtjJwkjgRuIAyZqRVDh2yeRm5rcV.eryQRL8EnGmi', 'teacher', 'active');
    }
    const subjects = [
        ['Java Programming','Core Java Programming concepts.'],
        ['Database Management Systems','RDBMS, SQL, Normalization.'],
        ['Computer Networks','OSI Model, TCP/IP, Routing.'],
        ['Data Structures','Arrays, Linked Lists, Trees.'],
        ['Operating Systems','Processes, Threads, Memory.'],
        ['Python Programming','Python basics and modules.'],
    ];
    const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (name, description) VALUES (?, ?)');
    for (const [name, desc] of subjects) insertSubject.run(name, desc);

    const javaSubject = db.prepare("SELECT id FROM subjects WHERE name = 'Java Programming'").get();
    if (!javaSubject) return;
    const javaId = javaSubject.id;
    const examExists = db.prepare("SELECT id FROM exams WHERE title = 'Core Java Basics'").get();
    let examId;
    if (!examExists) {
        const res = db.prepare(`INSERT INTO exams (title,description,subject_id,duration_minutes,total_questions,marks_per_question,negative_marks,passing_percentage,is_published,created_by) VALUES ('Core Java Basics','A basic test on Core Java concepts.',?,30,5,2.0,0.5,40.0,1,1)`).run(javaId);
        examId = res.lastInsertRowid;
    } else { examId = examExists.id; }

    const javaQuestions = [
        ['Which keyword is used to inherit a class in Java?','implements','extends','inherit','overrides','B',2.0,'Easy','The extends keyword is used.'],
        ['What is the size of int in Java?','2 bytes','4 bytes','8 bytes','Depends','B',2.0,'Easy','In Java, int is always 4 bytes.'],
        ['Which is not a Java feature?','Dynamic','Architecture Neutral','Use of pointers','Object-oriented','C',2.0,'Medium','Java does not support explicit pointers.'],
        ['Default value of a local variable?','null','0','Depends on type','No default value','D',2.0,'Medium','Local variables have no default values.'],
        ['Exception thrown on divide by zero?','NullPointerException','ArithmeticException','NumberFormatException','ArrayIndexOutOfBoundsException','B',2.0,'Easy','ArithmeticException is thrown.'],
    ];
    const insertQ = db.prepare('INSERT OR IGNORE INTO questions (subject_id,question_text,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,explanation) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const insertEQ = db.prepare('INSERT OR IGNORE INTO exam_questions (exam_id,question_id,question_order) VALUES (?,?,?)');
    let order = 1;
    for (const q of javaQuestions) {
        const r = insertQ.run(javaId, ...q);
        const qId = r.lastInsertRowid || db.prepare('SELECT id FROM questions WHERE question_text = ?').get(q[0])?.id;
        if (qId) insertEQ.run(examId, qId, order++);
    }
}

initSchema();
seedData();

// ─── Express App ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        'http://localhost:8081', 'http://localhost:8080', 'http://127.0.0.1:8081',
        'https://frontend-one-brown-14.vercel.app',
        /https:\/\/.*\.vercel\.app$/
    ],
    credentials: true
}));

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function protect(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Not authorized, no token' });
    try {
        req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        next();
    } catch { res.status(401).json({ message: 'Not authorized, token failed' }); }
}
function adminOnly(req, res, next) {
    if (req.user?.role === 'admin') return next();
    res.status(403).json({ message: 'Not authorized as admin' });
}
function adminOrTeacher(req, res, next) {
    if (req.user?.role === 'admin' || req.user?.role === 'teacher') return next();
    res.status(403).json({ message: 'Not authorized' });
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        if (user.status !== 'active') return res.status(403).json({ message: 'Account is inactive' });
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role, token });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, student_id, email, phone, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password required' });
        const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (exists) return res.status(400).json({ message: 'Email already registered' });
        const hash = await bcrypt.hash(password, 10);
        const result = db.prepare('INSERT INTO users (name, student_id, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)').run(name, student_id || null, email, phone || null, hash, 'student');
        const token = jwt.sign({ id: result.lastInsertRowid, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ id: result.lastInsertRowid, name, email, role: 'student', token });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────
app.get('/api/subjects', protect, (req, res) => {
    res.json(db.prepare('SELECT * FROM subjects ORDER BY name').all());
});
app.post('/api/subjects', protect, adminOnly, (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    try {
        const r = db.prepare('INSERT INTO subjects (name, description) VALUES (?, ?)').run(name, description || null);
        res.status(201).json({ id: r.lastInsertRowid, name });
    } catch (e) { res.status(400).json({ message: 'Subject name already exists' }); }
});
app.put('/api/subjects/:id', protect, adminOnly, (req, res) => {
    const { name, description } = req.body;
    db.prepare('UPDATE subjects SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
    res.json({ message: 'Subject updated' });
});
app.delete('/api/subjects/:id', protect, adminOnly, (req, res) => {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Subject deleted' });
});

// ─── EXAMS ────────────────────────────────────────────────────────────────────
app.get('/api/exams', protect, (req, res) => {
    let rows;
    if (req.user.role === 'student') {
        rows = db.prepare(`SELECT e.*, s.name as subject_name FROM exams e JOIN subjects s ON e.subject_id = s.id JOIN exam_assignments ea ON e.id = ea.exam_id WHERE e.is_published = 1 AND ea.student_id = ? ORDER BY e.created_at DESC`).all(req.user.id);
    } else {
        rows = db.prepare(`SELECT e.*, s.name as subject_name FROM exams e JOIN subjects s ON e.subject_id = s.id ORDER BY e.created_at DESC`).all();
    }
    res.json(rows);
});
app.get('/api/exams/:id', protect, (req, res) => {
    const exam = db.prepare('SELECT e.*, s.name as subject_name FROM exams e JOIN subjects s ON e.subject_id = s.id WHERE e.id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (req.user.role === 'student' && !exam.is_published) return res.status(403).json({ message: 'Exam not available' });
    res.json(exam);
});
app.post('/api/exams', protect, adminOrTeacher, (req, res) => {
    const { title, description, subject_id, duration_minutes, total_questions, marks_per_question, negative_marks, passing_percentage, attempt_limit } = req.body;
    if (!title || !subject_id) return res.status(400).json({ message: 'Title and subject required' });
    const r = db.prepare('INSERT INTO exams (title,description,subject_id,duration_minutes,total_questions,marks_per_question,negative_marks,passing_percentage,attempt_limit,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(title, description, subject_id, duration_minutes, total_questions, marks_per_question || 1, negative_marks || 0, passing_percentage || 40, attempt_limit || 1, req.user.id);
    res.status(201).json({ id: r.lastInsertRowid, title });
});
app.put('/api/exams/:id', protect, adminOrTeacher, (req, res) => {
    const { title, description, subject_id, duration_minutes, total_questions, marks_per_question, negative_marks, passing_percentage, attempt_limit } = req.body;
    db.prepare('UPDATE exams SET title=?,description=?,subject_id=?,duration_minutes=?,total_questions=?,marks_per_question=?,negative_marks=?,passing_percentage=?,attempt_limit=? WHERE id=?').run(title, description, subject_id, duration_minutes, total_questions, marks_per_question, negative_marks, passing_percentage, attempt_limit, req.params.id);
    res.json({ message: 'Exam updated' });
});
app.delete('/api/exams/:id', protect, adminOrTeacher, (req, res) => {
    db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
    res.json({ message: 'Exam removed' });
});
app.patch('/api/exams/:id/publish', protect, adminOrTeacher, (req, res) => {
    const exam = db.prepare('SELECT is_published FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const newStatus = exam.is_published ? 0 : 1;
    db.prepare('UPDATE exams SET is_published = ? WHERE id = ?').run(newStatus, req.params.id);
    res.json({ message: `Exam ${newStatus ? 'published' : 'unpublished'}` });
});
app.post('/api/exams/:id/assign', protect, adminOrTeacher, (req, res) => {
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids)) return res.status(400).json({ message: 'student_ids must be an array' });
    const insert = db.prepare('INSERT OR IGNORE INTO exam_assignments (exam_id, student_id, assigned_by) VALUES (?, ?, ?)');
    for (const sid of student_ids) insert.run(req.params.id, sid, req.user.id);
    res.json({ message: 'Exam assigned successfully' });
});

// ─── QUESTIONS ────────────────────────────────────────────────────────────────
app.get('/api/questions', protect, adminOrTeacher, (req, res) => {
    const { subject_id } = req.query;
    let rows;
    if (subject_id) rows = db.prepare('SELECT * FROM questions WHERE subject_id = ? ORDER BY created_at DESC').all(subject_id);
    else rows = db.prepare('SELECT * FROM questions ORDER BY created_at DESC').all();
    res.json(rows);
});
app.get('/api/questions/exam/:examId', protect, (req, res) => {
    const rows = db.prepare('SELECT q.* FROM questions q JOIN exam_questions eq ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.question_order').all(req.params.examId);
    // Strip correct_answer for students
    if (req.user.role === 'student') {
        res.json(rows.map(({ correct_answer, explanation, ...q }) => q));
    } else {
        res.json(rows);
    }
});
app.post('/api/questions', protect, adminOrTeacher, (req, res) => {
    const { subject_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, explanation } = req.body;
    const r = db.prepare('INSERT INTO questions (subject_id,question_text,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,explanation) VALUES (?,?,?,?,?,?,?,?,?,?)').run(subject_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks || 1, difficulty || 'Medium', explanation || null);
    res.status(201).json({ id: r.lastInsertRowid });
});
app.put('/api/questions/:id', protect, adminOrTeacher, (req, res) => {
    const { subject_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, explanation } = req.body;
    db.prepare('UPDATE questions SET subject_id=?,question_text=?,option_a=?,option_b=?,option_c=?,option_d=?,correct_answer=?,marks=?,difficulty=?,explanation=? WHERE id=?').run(subject_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, explanation, req.params.id);
    res.json({ message: 'Question updated' });
});
app.delete('/api/questions/:id', protect, adminOrTeacher, (req, res) => {
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ message: 'Question deleted' });
});
app.post('/api/questions/assign-to-exam', protect, adminOrTeacher, (req, res) => {
    const { exam_id, question_ids } = req.body;
    const insert = db.prepare('INSERT OR IGNORE INTO exam_questions (exam_id, question_id, question_order) VALUES (?, ?, ?)');
    question_ids.forEach((qid, i) => insert.run(exam_id, qid, i + 1));
    res.json({ message: 'Questions assigned' });
});

// ─── ATTEMPTS ─────────────────────────────────────────────────────────────────
app.post('/api/attempts/start', protect, (req, res) => {
    const { exam_id } = req.body;
    const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND is_published = 1').get(exam_id);
    if (!exam) return res.status(404).json({ message: 'Exam not found or not published' });
    const existing = db.prepare("SELECT id FROM exam_attempts WHERE exam_id = ? AND student_id = ? AND status = 'in_progress'").get(exam_id, req.user.id);
    if (existing) return res.json({ attempt_id: existing.id, exam });
    const r = db.prepare('INSERT INTO exam_attempts (exam_id, student_id) VALUES (?, ?)').run(exam_id, req.user.id);
    res.json({ attempt_id: r.lastInsertRowid, exam });
});
app.get('/api/attempts/:id', protect, (req, res) => {
    const attempt = db.prepare('SELECT ea.*, e.title, e.duration_minutes, e.marks_per_question, e.negative_marks, e.passing_percentage FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id WHERE ea.id = ?').get(req.params.id);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    res.json(attempt);
});
app.post('/api/attempts/:id/answer', protect, (req, res) => {
    const { question_id, selected_answer } = req.body;
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id);
    if (!attempt || attempt.status !== 'in_progress') return res.status(400).json({ message: 'Invalid attempt' });
    db.prepare('INSERT OR REPLACE INTO student_answers (attempt_id, question_id, selected_answer) VALUES (?, ?, ?)').run(req.params.id, question_id, selected_answer);
    res.json({ message: 'Answer saved' });
});
app.post('/api/attempts/:id/submit', protect, async (req, res) => {
    try {
        const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND student_id = ?').get(req.params.id, req.user.id);
        if (!attempt || attempt.status !== 'in_progress') return res.status(400).json({ message: 'Invalid attempt' });
        const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
        const questions = db.prepare('SELECT q.id, q.correct_answer, q.marks FROM questions q JOIN exam_questions eq ON q.id = eq.question_id WHERE eq.exam_id = ?').all(attempt.exam_id);
        const answers = db.prepare('SELECT * FROM student_answers WHERE attempt_id = ?').all(req.params.id);
        const answerMap = {};
        for (const a of answers) answerMap[a.question_id] = a.selected_answer;
        let score = 0, correct = 0, wrong = 0, unanswered = 0;
        for (const q of questions) {
            const selected = answerMap[q.id];
            if (!selected) { unanswered++; continue; }
            if (selected === q.correct_answer) { score += q.marks || exam.marks_per_question; correct++; }
            else { score -= exam.negative_marks || 0; wrong++; }
        }
        score = Math.max(0, score);
        const maxScore = questions.length * (exam.marks_per_question || 1);
        const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
        const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0;
        // Update student_answers with correctness
        for (const q of questions) {
            const selected = answerMap[q.id];
            if (selected) {
                const isCorrect = selected === q.correct_answer ? 1 : 0;
                const marks = isCorrect ? (q.marks || exam.marks_per_question) : -(exam.negative_marks || 0);
                db.prepare('UPDATE student_answers SET is_correct=?, marks_obtained=? WHERE attempt_id=? AND question_id=?').run(isCorrect, marks, req.params.id, q.id);
            }
        }
        db.prepare("UPDATE exam_attempts SET status='completed', submitted_at=datetime('now'), score=?, correct_answers=?, wrong_answers=?, unanswered=?, percentage=?, accuracy=? WHERE id=?").run(score, correct, wrong, unanswered, percentage.toFixed(2), accuracy.toFixed(2), req.params.id);
        res.json({ score, correct, wrong, unanswered, percentage: percentage.toFixed(2), accuracy: accuracy.toFixed(2), passed: percentage >= exam.passing_percentage });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});
app.get('/api/attempts/:id/result', protect, (req, res) => {
    const attempt = db.prepare('SELECT ea.*, e.title, e.passing_percentage FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id WHERE ea.id = ?').get(req.params.id);
    if (!attempt) return res.status(404).json({ message: 'Result not found' });
    const answers = db.prepare('SELECT sa.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation FROM student_answers sa JOIN questions q ON sa.question_id = q.id WHERE sa.attempt_id = ?').all(req.params.id);
    res.json({ attempt, answers });
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
app.get('/api/analytics/student', protect, (req, res) => {
    const sid = req.user.id;
    const history = db.prepare("SELECT ea.*, e.title as exam_title, e.passing_percentage, s.name as subject_name FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id JOIN subjects s ON e.subject_id = s.id WHERE ea.student_id = ? AND ea.status = 'completed' ORDER BY ea.submitted_at DESC").all(sid);
    const total = history.length;
    let avgPerc = 0, bestPerc = 0, totalCorrect = 0, totalWrong = 0, totalUnanswered = 0;
    if (total > 0) {
        avgPerc = history.reduce((s, h) => s + parseFloat(h.percentage), 0) / total;
        bestPerc = Math.max(...history.map(h => parseFloat(h.percentage)));
        totalCorrect = history.reduce((s, h) => s + (h.correct_answers || 0), 0);
        totalWrong = history.reduce((s, h) => s + (h.wrong_answers || 0), 0);
        totalUnanswered = history.reduce((s, h) => s + (h.unanswered || 0), 0);
    }
    const avgAccuracy = (totalCorrect + totalWrong) > 0 ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;
    res.json({ totalAttempts: total, avgPercentage: avgPerc, bestPercentage: bestPerc, avgAccuracy, totalCorrect, totalWrong, totalUnanswered, recentAttempts: history.slice(0, 5) });
});
app.get('/api/analytics/admin', protect, adminOrTeacher, (req, res) => {
    const results = db.prepare("SELECT ea.*, u.name as student_name, u.email, e.title as exam_title, e.passing_percentage FROM exam_attempts ea JOIN users u ON ea.student_id = u.id JOIN exams e ON ea.exam_id = e.id WHERE ea.status = 'completed' ORDER BY ea.submitted_at DESC").all();
    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get().c;
    const totalExams = db.prepare('SELECT COUNT(*) as c FROM exams').get().c;
    const passed = results.filter(r => parseFloat(r.percentage) >= parseFloat(r.passing_percentage)).length;
    res.json({ summary: { totalStudents, totalExams, totalAttempts: results.length, passRate: results.length > 0 ? ((passed / results.length) * 100).toFixed(2) : 0 }, results });
});

// ─── USERS ────────────────────────────────────────────────────────────────────
app.get('/api/users', protect, adminOrTeacher, (req, res) => {
    const { role } = req.query;
    let rows;
    if (role) rows = db.prepare("SELECT id, student_id, name, email, phone, role, status, created_at FROM users WHERE role = ?").all(role);
    else rows = db.prepare('SELECT id, student_id, name, email, phone, role, status, created_at FROM users').all();
    res.json(rows);
});
app.put('/api/users/:id', protect, adminOnly, (req, res) => {
    const { name, email } = req.body;
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.params.id);
    res.json({ message: 'User updated' });
});
app.delete('/api/users/:id', protect, adminOnly, (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted' });
});

// Health check
app.get('/api', (req, res) => res.json({ message: 'Online Examination System API is running' }));

module.exports = app;
