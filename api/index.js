// Vercel Serverless Function — Pure JS Full Backend for Online Examination System
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'bca_final_year_secret_key_123';
const DB_PATH = '/tmp/exam_system_v2.json';

// ─── Pure JS Database Engine ──────────────────────────────────────────────────
let dbData = null;

function getDefaultData() {
    return {
        nextIds: { users: 3, subjects: 7, exams: 2, questions: 6, exam_questions: 6, exam_attempts: 1, student_answers: 1, exam_assignments: 1 },
        users: [
            { id: 1, student_id: null, name: 'System Administrator', email: 'admin@example.com', password_hash: '$2b$10$ws.Q6yB3zMRL/mvtld0s1OY6808GQZhm1JGBoMML2JamRYlTuVQxK', phone: null, role: 'admin', status: 'active', created_at: new Date().toISOString() },
            { id: 2, student_id: null, name: 'Test Teacher', email: 'teacher@example.com', password_hash: '$2b$10$L2YglU58RXtQXtjJwkjgRuIAyZqRVDh2yeRm5rcV.eryQRL8EnGmi', phone: null, role: 'teacher', status: 'active', created_at: new Date().toISOString() }
        ],
        subjects: [
            { id: 1, name: 'Java Programming', description: 'Core Java Programming concepts.', created_at: new Date().toISOString() },
            { id: 2, name: 'Database Management Systems', description: 'RDBMS, SQL, Normalization.', created_at: new Date().toISOString() },
            { id: 3, name: 'Computer Networks', description: 'OSI Model, TCP/IP, Routing.', created_at: new Date().toISOString() },
            { id: 4, name: 'Data Structures', description: 'Arrays, Linked Lists, Trees.', created_at: new Date().toISOString() },
            { id: 5, name: 'Operating Systems', description: 'Processes, Threads, Memory.', created_at: new Date().toISOString() },
            { id: 6, name: 'Python Programming', description: 'Python basics and modules.', created_at: new Date().toISOString() }
        ],
        exams: [
            { id: 1, title: 'Core Java Basics', description: 'A basic test on Core Java concepts.', subject_id: 1, duration_minutes: 30, total_questions: 5, marks_per_question: 2.0, negative_marks: 0.5, passing_percentage: 40.0, attempt_limit: 1, is_published: 1, created_by: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ],
        questions: [
            { id: 1, subject_id: 1, question_text: 'Which keyword is used to inherit a class in Java?', option_a: 'implements', option_b: 'extends', option_c: 'inherit', option_d: 'overrides', correct_answer: 'B', marks: 2.0, difficulty: 'Easy', explanation: 'The extends keyword is used.', created_at: new Date().toISOString() },
            { id: 2, subject_id: 1, question_text: 'What is the size of int in Java?', option_a: '2 bytes', option_b: '4 bytes', option_c: '8 bytes', option_d: 'Depends', correct_answer: 'B', marks: 2.0, difficulty: 'Easy', explanation: 'In Java, int is always 4 bytes.', created_at: new Date().toISOString() },
            { id: 3, subject_id: 1, question_text: 'Which is not a Java feature?', option_a: 'Dynamic', option_b: 'Architecture Neutral', option_c: 'Use of pointers', option_d: 'Object-oriented', correct_answer: 'C', marks: 2.0, difficulty: 'Medium', explanation: 'Java does not support explicit pointers.', created_at: new Date().toISOString() },
            { id: 4, subject_id: 1, question_text: 'Default value of a local variable?', option_a: 'null', option_b: '0', option_c: 'Depends on type', option_d: 'No default value', correct_answer: 'D', marks: 2.0, difficulty: 'Medium', explanation: 'Local variables have no default values.', created_at: new Date().toISOString() },
            { id: 5, subject_id: 1, question_text: 'Exception thrown on divide by zero?', option_a: 'NullPointerException', option_b: 'ArithmeticException', option_c: 'NumberFormatException', option_d: 'ArrayIndexOutOfBoundsException', correct_answer: 'B', marks: 2.0, difficulty: 'Easy', explanation: 'ArithmeticException is thrown.', created_at: new Date().toISOString() }
        ],
        exam_questions: [
            { id: 1, exam_id: 1, question_id: 1, question_order: 1 },
            { id: 2, exam_id: 1, question_id: 2, question_order: 2 },
            { id: 3, exam_id: 1, question_id: 3, question_order: 3 },
            { id: 4, exam_id: 1, question_id: 4, question_order: 4 },
            { id: 5, exam_id: 1, question_id: 5, question_order: 5 }
        ],
        exam_attempts: [],
        student_answers: [],
        exam_assignments: []
    };
}

function loadDB() {
    if (dbData) return dbData;
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            dbData = JSON.parse(raw);
            return dbData;
        }
    } catch (e) {
        console.error('Error reading DB file, re-initializing:', e);
    }
    dbData = getDefaultData();
    saveDB();
    return dbData;
}

function saveDB() {
    try {
        if (dbData) {
            fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('Error saving DB file:', e);
    }
}

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
        const db = loadDB();
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
        const db = loadDB();
        const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (exists) return res.status(400).json({ message: 'Email already registered' });
        const hash = await bcrypt.hash(password, 10);
        const newId = db.nextIds.users++;
        const newUser = { id: newId, student_id: student_id || null, name, email, phone: phone || null, password_hash: hash, role: 'student', status: 'active', created_at: new Date().toISOString() };
        db.users.push(newUser);
        saveDB();
        const token = jwt.sign({ id: newId, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ id: newId, name, email, role: 'student', token });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────
app.get('/api/subjects', protect, (req, res) => {
    const db = loadDB();
    const sorted = [...db.subjects].sort((a, b) => a.name.localeCompare(b.name));
    res.json(sorted);
});

app.post('/api/subjects', protect, adminOnly, (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const db = loadDB();
    if (db.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ message: 'Subject name already exists' });
    }
    const newId = db.nextIds.subjects++;
    db.subjects.push({ id: newId, name, description: description || null, created_at: new Date().toISOString() });
    saveDB();
    res.status(201).json({ id: newId, name });
});

app.put('/api/subjects/:id', protect, adminOnly, (req, res) => {
    const { name, description } = req.body;
    const db = loadDB();
    const sub = db.subjects.find(s => s.id === Number(req.params.id));
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    sub.name = name || sub.name;
    sub.description = description !== undefined ? description : sub.description;
    saveDB();
    res.json({ message: 'Subject updated' });
});

app.delete('/api/subjects/:id', protect, adminOnly, (req, res) => {
    const db = loadDB();
    const id = Number(req.params.id);
    db.subjects = db.subjects.filter(s => s.id !== id);
    saveDB();
    res.json({ message: 'Subject deleted' });
});

// ─── EXAMS ────────────────────────────────────────────────────────────────────
app.get('/api/exams', protect, (req, res) => {
    const db = loadDB();
    let result = db.exams.map(e => {
        const sub = db.subjects.find(s => s.id === e.subject_id);
        return { ...e, subject_name: sub ? sub.name : 'Unknown' };
    });
    if (req.user.role === 'student') {
        result = result.filter(e => e.is_published === 1 && db.exam_assignments.some(ea => ea.exam_id === e.id && ea.student_id === req.user.id));
    }
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(result);
});

app.get('/api/exams/:id', protect, (req, res) => {
    const db = loadDB();
    const exam = db.exams.find(e => e.id === Number(req.params.id));
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (req.user.role === 'student' && !exam.is_published) return res.status(403).json({ message: 'Exam not available' });
    const sub = db.subjects.find(s => s.id === exam.subject_id);
    res.json({ ...exam, subject_name: sub ? sub.name : 'Unknown' });
});

app.post('/api/exams', protect, adminOrTeacher, (req, res) => {
    const { title, description, subject_id, duration_minutes, total_questions, marks_per_question, negative_marks, passing_percentage, attempt_limit } = req.body;
    if (!title || !subject_id) return res.status(400).json({ message: 'Title and subject required' });
    const db = loadDB();
    const newId = db.nextIds.exams++;
    const newExam = {
        id: newId,
        title,
        description: description || null,
        subject_id: Number(subject_id),
        duration_minutes: Number(duration_minutes || 30),
        total_questions: Number(total_questions || 10),
        marks_per_question: Number(marks_per_question || 1.0),
        negative_marks: Number(negative_marks || 0.0),
        passing_percentage: Number(passing_percentage || 40.0),
        attempt_limit: Number(attempt_limit || 1),
        is_published: 0,
        created_by: req.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    db.exams.push(newExam);
    saveDB();
    res.status(201).json({ id: newId, title });
});

app.put('/api/exams/:id', protect, adminOrTeacher, (req, res) => {
    const { title, description, subject_id, duration_minutes, total_questions, marks_per_question, negative_marks, passing_percentage, attempt_limit } = req.body;
    const db = loadDB();
    const exam = db.exams.find(e => e.id === Number(req.params.id));
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    exam.title = title || exam.title;
    exam.description = description !== undefined ? description : exam.description;
    if (subject_id) exam.subject_id = Number(subject_id);
    if (duration_minutes) exam.duration_minutes = Number(duration_minutes);
    if (total_questions) exam.total_questions = Number(total_questions);
    if (marks_per_question !== undefined) exam.marks_per_question = Number(marks_per_question);
    if (negative_marks !== undefined) exam.negative_marks = Number(negative_marks);
    if (passing_percentage !== undefined) exam.passing_percentage = Number(passing_percentage);
    if (attempt_limit !== undefined) exam.attempt_limit = Number(attempt_limit);
    exam.updated_at = new Date().toISOString();
    saveDB();
    res.json({ message: 'Exam updated' });
});

app.delete('/api/exams/:id', protect, adminOrTeacher, (req, res) => {
    const db = loadDB();
    const id = Number(req.params.id);
    db.exams = db.exams.filter(e => e.id !== id);
    db.exam_questions = db.exam_questions.filter(eq => eq.exam_id !== id);
    db.exam_assignments = db.exam_assignments.filter(ea => ea.exam_id !== id);
    saveDB();
    res.json({ message: 'Exam removed' });
});

app.patch('/api/exams/:id/publish', protect, adminOrTeacher, (req, res) => {
    const db = loadDB();
    const exam = db.exams.find(e => e.id === Number(req.params.id));
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    exam.is_published = exam.is_published ? 0 : 1;
    saveDB();
    res.json({ message: `Exam ${exam.is_published ? 'published' : 'unpublished'}` });
});

app.post('/api/exams/:id/assign', protect, adminOrTeacher, (req, res) => {
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids)) return res.status(400).json({ message: 'student_ids must be an array' });
    const db = loadDB();
    const examId = Number(req.params.id);
    for (const sid of student_ids) {
        const studentId = Number(sid);
        if (!db.exam_assignments.some(ea => ea.exam_id === examId && ea.student_id === studentId)) {
            db.exam_assignments.push({ id: db.nextIds.exam_assignments++, exam_id: examId, student_id: studentId, assigned_by: req.user.id, created_at: new Date().toISOString() });
        }
    }
    saveDB();
    res.json({ message: 'Exam assigned successfully' });
});

// ─── QUESTIONS ────────────────────────────────────────────────────────────────
app.get('/api/questions', protect, adminOrTeacher, (req, res) => {
    const db = loadDB();
    const { subject_id } = req.query;
    let list = db.questions;
    if (subject_id) list = list.filter(q => q.subject_id === Number(subject_id));
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(list);
});

app.get('/api/questions/exam/:examId', protect, (req, res) => {
    const db = loadDB();
    const examId = Number(req.params.examId);
    const eqList = db.exam_questions.filter(eq => eq.exam_id === examId).sort((a, b) => a.question_order - b.question_order);
    const questions = eqList.map(eq => db.questions.find(q => q.id === eq.question_id)).filter(Boolean);
    if (req.user.role === 'student') {
        res.json(questions.map(({ correct_answer, explanation, ...q }) => q));
    } else {
        res.json(questions);
    }
});

app.post('/api/questions', protect, adminOrTeacher, (req, res) => {
    const { subject_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, explanation } = req.body;
    const db = loadDB();
    const newId = db.nextIds.questions++;
    db.questions.push({
        id: newId,
        subject_id: Number(subject_id),
        question_text, option_a, option_b, option_c, option_d, correct_answer,
        marks: Number(marks || 1.0),
        difficulty: difficulty || 'Medium',
        explanation: explanation || null,
        created_at: new Date().toISOString()
    });
    saveDB();
    res.status(201).json({ id: newId });
});

app.put('/api/questions/:id', protect, adminOrTeacher, (req, res) => {
    const { subject_id, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, difficulty, explanation } = req.body;
    const db = loadDB();
    const q = db.questions.find(item => item.id === Number(req.params.id));
    if (!q) return res.status(404).json({ message: 'Question not found' });
    if (subject_id) q.subject_id = Number(subject_id);
    if (question_text) q.question_text = question_text;
    if (option_a) q.option_a = option_a;
    if (option_b) q.option_b = option_b;
    if (option_c) q.option_c = option_c;
    if (option_d) q.option_d = option_d;
    if (correct_answer) q.correct_answer = correct_answer;
    if (marks !== undefined) q.marks = Number(marks);
    if (difficulty) q.difficulty = difficulty;
    if (explanation !== undefined) q.explanation = explanation;
    saveDB();
    res.json({ message: 'Question updated' });
});

app.delete('/api/questions/:id', protect, adminOrTeacher, (req, res) => {
    const db = loadDB();
    const id = Number(req.params.id);
    db.questions = db.questions.filter(q => q.id !== id);
    db.exam_questions = db.exam_questions.filter(eq => eq.question_id !== id);
    saveDB();
    res.json({ message: 'Question deleted' });
});

app.post('/api/questions/assign-to-exam', protect, adminOrTeacher, (req, res) => {
    const { exam_id, question_ids } = req.body;
    const db = loadDB();
    const examId = Number(exam_id);
    question_ids.forEach((qid, i) => {
        const questionId = Number(qid);
        const existing = db.exam_questions.find(eq => eq.exam_id === examId && eq.question_id === questionId);
        if (!existing) {
            db.exam_questions.push({ id: db.nextIds.exam_questions++, exam_id: examId, question_id: questionId, question_order: i + 1 });
        }
    });
    saveDB();
    res.json({ message: 'Questions assigned' });
});

// ─── ATTEMPTS ─────────────────────────────────────────────────────────────────
app.post('/api/attempts/start', protect, (req, res) => {
    const { exam_id } = req.body;
    const db = loadDB();
    const exam = db.exams.find(e => e.id === Number(exam_id) && e.is_published === 1);
    if (!exam) return res.status(404).json({ message: 'Exam not found or not published' });
    const existing = db.exam_attempts.find(ea => ea.exam_id === exam.id && ea.student_id === req.user.id && ea.status === 'in_progress');
    if (existing) return res.json({ attempt_id: existing.id, exam });
    const newId = db.nextIds.exam_attempts++;
    db.exam_attempts.push({
        id: newId,
        exam_id: exam.id,
        student_id: req.user.id,
        started_at: new Date().toISOString(),
        submitted_at: null,
        score: 0.0, correct_answers: 0, wrong_answers: 0, unanswered: 0, percentage: 0.0, accuracy: 0.0,
        status: 'in_progress'
    });
    saveDB();
    res.json({ attempt_id: newId, exam });
});

app.get('/api/attempts/:id', protect, (req, res) => {
    const db = loadDB();
    const attempt = db.exam_attempts.find(ea => ea.id === Number(req.params.id));
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    const exam = db.exams.find(e => e.id === attempt.exam_id);
    res.json({
        ...attempt,
        title: exam ? exam.title : 'Exam',
        duration_minutes: exam ? exam.duration_minutes : 30,
        marks_per_question: exam ? exam.marks_per_question : 1.0,
        negative_marks: exam ? exam.negative_marks : 0.0,
        passing_percentage: exam ? exam.passing_percentage : 40.0
    });
});

app.post('/api/attempts/:id/answer', protect, (req, res) => {
    const { question_id, selected_answer } = req.body;
    const db = loadDB();
    const attemptId = Number(req.params.id);
    const attempt = db.exam_attempts.find(ea => ea.id === attemptId && ea.student_id === req.user.id);
    if (!attempt || attempt.status !== 'in_progress') return res.status(400).json({ message: 'Invalid attempt' });
    const questionId = Number(question_id);
    const existing = db.student_answers.find(sa => sa.attempt_id === attemptId && sa.question_id === questionId);
    if (existing) {
        existing.selected_answer = selected_answer;
        existing.answered_at = new Date().toISOString();
    } else {
        db.student_answers.push({ id: db.nextIds.student_answers++, attempt_id: attemptId, question_id: questionId, selected_answer, is_correct: 0, marks_obtained: 0.0, answered_at: new Date().toISOString() });
    }
    saveDB();
    res.json({ message: 'Answer saved' });
});

app.post('/api/attempts/:id/submit', protect, async (req, res) => {
    try {
        const db = loadDB();
        const attemptId = Number(req.params.id);
        const attempt = db.exam_attempts.find(ea => ea.id === attemptId && ea.student_id === req.user.id);
        if (!attempt || attempt.status !== 'in_progress') return res.status(400).json({ message: 'Invalid attempt' });
        const exam = db.exams.find(e => e.id === attempt.exam_id);
        const eqList = db.exam_questions.filter(eq => eq.exam_id === attempt.exam_id);
        const questions = eqList.map(eq => db.questions.find(q => q.id === eq.question_id)).filter(Boolean);
        const answers = db.student_answers.filter(sa => sa.attempt_id === attemptId);
        const answerMap = {};
        for (const a of answers) answerMap[a.question_id] = a.selected_answer;

        let score = 0, correct = 0, wrong = 0, unanswered = 0;
        for (const q of questions) {
            const selected = answerMap[q.id];
            if (!selected) { unanswered++; continue; }
            if (selected === q.correct_answer) {
                score += q.marks || exam.marks_per_question;
                correct++;
            } else {
                score -= (exam.negative_marks || 0);
                wrong++;
            }
        }
        score = Math.max(0, score);
        const maxScore = questions.length * (exam.marks_per_question || 1);
        const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
        const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0;

        for (const q of questions) {
            const selected = answerMap[q.id];
            let sa = db.student_answers.find(a => a.attempt_id === attemptId && a.question_id === q.id);
            if (selected) {
                const isCorrect = selected === q.correct_answer ? 1 : 0;
                const marks = isCorrect ? (q.marks || exam.marks_per_question) : -(exam.negative_marks || 0);
                if (sa) {
                    sa.is_correct = isCorrect;
                    sa.marks_obtained = marks;
                } else {
                    db.student_answers.push({ id: db.nextIds.student_answers++, attempt_id: attemptId, question_id: q.id, selected_answer: selected, is_correct: isCorrect, marks_obtained: marks, answered_at: new Date().toISOString() });
                }
            }
        }

        attempt.status = 'completed';
        attempt.submitted_at = new Date().toISOString();
        attempt.score = score;
        attempt.correct_answers = correct;
        attempt.wrong_answers = wrong;
        attempt.unanswered = unanswered;
        attempt.percentage = parseFloat(percentage.toFixed(2));
        attempt.accuracy = parseFloat(accuracy.toFixed(2));
        saveDB();

        res.json({ score, correct, wrong, unanswered, percentage: percentage.toFixed(2), accuracy: accuracy.toFixed(2), passed: percentage >= exam.passing_percentage });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/attempts/:id/result', protect, (req, res) => {
    const db = loadDB();
    const attemptId = Number(req.params.id);
    const attempt = db.exam_attempts.find(ea => ea.id === attemptId);
    if (!attempt) return res.status(404).json({ message: 'Result not found' });
    const exam = db.exams.find(e => e.id === attempt.exam_id);
    const saList = db.student_answers.filter(sa => sa.attempt_id === attemptId);
    const answers = saList.map(sa => {
        const q = db.questions.find(item => item.id === sa.question_id) || {};
        return {
            ...sa,
            question_text: q.question_text,
            option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
            correct_answer: q.correct_answer,
            explanation: q.explanation
        };
    });
    res.json({
        attempt: { ...attempt, title: exam ? exam.title : 'Exam', passing_percentage: exam ? exam.passing_percentage : 40.0 },
        answers
    });
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
app.get('/api/analytics/student', protect, (req, res) => {
    const db = loadDB();
    const history = db.exam_attempts.filter(ea => ea.student_id === req.user.id && ea.status === 'completed').map(ea => {
        const exam = db.exams.find(e => e.id === ea.exam_id) || {};
        const sub = db.subjects.find(s => s.id === exam.subject_id) || {};
        return { ...ea, exam_title: exam.title || 'Exam', passing_percentage: exam.passing_percentage || 40.0, subject_name: sub.name || 'Subject' };
    }).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const total = history.length;
    let avgPerc = 0, bestPerc = 0, totalCorrect = 0, totalWrong = 0, totalUnanswered = 0;
    if (total > 0) {
        avgPerc = history.reduce((s, h) => s + parseFloat(h.percentage || 0), 0) / total;
        bestPerc = Math.max(...history.map(h => parseFloat(h.percentage || 0)));
        totalCorrect = history.reduce((s, h) => s + (h.correct_answers || 0), 0);
        totalWrong = history.reduce((s, h) => s + (h.wrong_answers || 0), 0);
        totalUnanswered = history.reduce((s, h) => s + (h.unanswered || 0), 0);
    }
    const avgAccuracy = (totalCorrect + totalWrong) > 0 ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;
    res.json({ totalAttempts: total, avgPercentage: avgPerc, bestPercentage: bestPerc, avgAccuracy, totalCorrect, totalWrong, totalUnanswered, recentAttempts: history.slice(0, 5) });
});

app.get('/api/analytics/admin', protect, adminOrTeacher, (req, res) => {
    const db = loadDB();
    const results = db.exam_attempts.filter(ea => ea.status === 'completed').map(ea => {
        const u = db.users.find(user => user.id === ea.student_id) || {};
        const exam = db.exams.find(e => e.id === ea.exam_id) || {};
        return { ...ea, student_name: u.name || 'Student', email: u.email || '', exam_title: exam.title || 'Exam', passing_percentage: exam.passing_percentage || 40.0 };
    }).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    const totalStudents = db.users.filter(u => u.role === 'student').length;
    const totalExams = db.exams.length;
    const passed = results.filter(r => parseFloat(r.percentage) >= parseFloat(r.passing_percentage)).length;
    res.json({
        summary: {
            totalStudents, totalExams, totalAttempts: results.length,
            passRate: results.length > 0 ? ((passed / results.length) * 100).toFixed(2) : 0
        },
        results
    });
});

// ─── USERS ────────────────────────────────────────────────────────────────────
app.get('/api/users', protect, adminOrTeacher, (req, res) => {
    const db = loadDB();
    const { role } = req.query;
    let rows = db.users.map(({ password_hash, ...u }) => u);
    if (role) rows = rows.filter(u => u.role === role);
    res.json(rows);
});

app.put('/api/users/:id', protect, adminOnly, (req, res) => {
    const { name, email } = req.body;
    const db = loadDB();
    const u = db.users.find(user => user.id === Number(req.params.id));
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (name) u.name = name;
    if (email) u.email = email;
    saveDB();
    res.json({ message: 'User updated' });
});

app.delete('/api/users/:id', protect, adminOnly, (req, res) => {
    const db = loadDB();
    const id = Number(req.params.id);
    db.users = db.users.filter(u => u.id !== id);
    saveDB();
    res.json({ message: 'User deleted' });
});

// Health check
app.get('/api', (req, res) => res.json({ message: 'Online Examination System API is running' }));

module.exports = app;
