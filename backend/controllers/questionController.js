import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { notify } from "../services/notificationService.js";

// M6 Ask a question (staff phone) and the committee's answer (Action Center).

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const SELECT = `SELECT q.id, q.question, q.answer, q.created_at, q.answered_at, q.seen_at, q.task_id,
                       t.title AS task_title, a.full_name AS asked_by_name, a.id AS asked_by,
                       sp.designation AS asked_by_designation, a.role AS asked_by_role, r.full_name AS answered_by_name
                FROM questions q
                JOIN users a ON a.id = q.asked_by
                LEFT JOIN staff_profiles sp ON sp.user_id = a.id
                LEFT JOIN users r ON r.id = q.answered_by
                LEFT JOIN tasks t ON t.id = q.task_id`;
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// POST /api/questions  { question, task_id? }   staff and volunteers
export const ask = async (req, res) => {
    const question = text(req.body?.question, 1000);
    if (question.length < 3) return fail(res, 400, "Type your question");
    const taskId = Number(req.body?.task_id) || null;
    const row = await pool.query("INSERT INTO questions (asked_by, question, task_id) VALUES ($1, $2, $3) RETURNING id", [req.user.id, question, taskId]);
    await logAudit({ actorId: req.user.id, action: "question.asked", entityType: "question", entityId: row.rows[0].id, details: { question } });
    notify({ roles: ["chairman", "committee"], title: `Question from ${req.user.full_name.split(" ")[0]}`, message: question.slice(0, 200), type: "question" });
    res.status(201).json({ success: true, message: "Sent. You'll get the answer here and as a notification." });
};

// GET /api/questions/mine   the asker's recent questions and answers
export const mine = async (req, res) => {
    const rows = await pool.query(`${SELECT} WHERE q.asked_by = $1 AND q.created_at > NOW() - interval '14 days' ORDER BY q.created_at DESC LIMIT 10`, [req.user.id]);
    res.json({ success: true, questions: rows.rows });
};

// PATCH /api/questions/:id/seen   the asker has read the answer
export const seen = async (req, res) => {
    await pool.query("UPDATE questions SET seen_at = NOW() WHERE id = $1 AND asked_by = $2 AND answered_at IS NOT NULL", [Number(req.params.id), req.user.id]);
    res.json({ success: true });
};

// GET /api/questions?status=open|answered   chairman and committee
export const list = async (req, res) => {
    const answered = req.query.status === "answered";
    const rows = await pool.query(
        `${SELECT} WHERE ${answered ? "q.answered_at IS NOT NULL AND q.answered_at > NOW() - interval '2 days'" : "q.answered_at IS NULL"} ORDER BY q.created_at ${answered ? "DESC" : "ASC"} LIMIT 50`);
    res.json({ success: true, questions: rows.rows });
};

// POST /api/questions/:id/answer  { answer }   chairman and committee
export const answer = async (req, res) => {
    const id = Number(req.params.id);
    const reply = text(req.body?.answer, 1000);
    if (reply.length < 1) return fail(res, 400, "Type an answer");
    const q = await pool.query(
        "UPDATE questions SET answer = $1, answered_by = $2, answered_at = NOW(), seen_at = NULL WHERE id = $3 RETURNING asked_by, question", [reply, req.user.id, id]);
    if (!q.rowCount) return fail(res, 404, "Question not found");
    await logAudit({ actorId: req.user.id, action: "question.answered", entityType: "question", entityId: id, details: { answer: reply } });
    notify({ userId: q.rows[0].asked_by, title: `${req.user.full_name.split(" ")[0]} answered your question`, message: reply.slice(0, 200), type: "question" });
    res.json({ success: true, message: "Answer sent" });
};
