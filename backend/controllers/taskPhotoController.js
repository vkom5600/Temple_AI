import pool from "../config/db.js";
import { logAudit } from "../services/auditService.js";
import { canWorkOn, findTask } from "../services/taskService.js";

// Photos on tasks. Whoever can work on a task (its people, and the committee) can
// add and see its photos. Up to 4 per task, 1 MB each (the phone shrinks them first).

const MAX_PHOTOS = 4;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const loadTask = async (req, res) => {
    const task = await findTask(Number(req.params.id));
    if (!task) { fail(res, 404, "Task not found"); return null; }
    if (!canWorkOn(task, req.user)) { fail(res, 403, "This task isn't yours"); return null; }
    return task;
};

// POST /api/tasks/:id/photos   body: the image itself (Content-Type image/jpeg)
export const addPhoto = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;
    const mime = req.headers["content-type"];
    if (!TYPES.includes(mime) || !Buffer.isBuffer(req.body) || !req.body.length) return fail(res, 400, "Send a JPEG, PNG or WebP photo");
    const count = (await pool.query("SELECT COUNT(*)::int AS n FROM task_photos WHERE task_id = $1", [task.id])).rows[0].n;
    if (count >= MAX_PHOTOS) return fail(res, 400, `Up to ${MAX_PHOTOS} photos per task`);
    const row = await pool.query("INSERT INTO task_photos (task_id, uploaded_by, mime, data) VALUES ($1, $2, $3, $4) RETURNING id, created_at", [task.id, req.user.id, mime, req.body]);
    await logAudit({ actorId: req.user.id, action: "task.photo_added", entityType: "task", entityId: task.id, details: { bytes: req.body.length } });
    res.status(201).json({ success: true, photo: { id: row.rows[0].id, created_at: row.rows[0].created_at }, message: "Photo added" });
};

// GET /api/tasks/:id/photos   the list (no image data)
export const listPhotos = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;
    const rows = await pool.query(
        `SELECT p.id, p.created_at, u.full_name AS uploaded_by_name FROM task_photos p LEFT JOIN users u ON u.id = p.uploaded_by
         WHERE p.task_id = $1 ORDER BY p.created_at`, [task.id]);
    res.json({ success: true, photos: rows.rows });
};

// GET /api/tasks/:id/photos/:photoId   the image
export const getPhoto = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;
    const row = (await pool.query("SELECT mime, data FROM task_photos WHERE id = $1 AND task_id = $2", [Number(req.params.photoId), task.id])).rows[0];
    if (!row) return fail(res, 404, "Photo not found");
    res.set({ "Content-Type": row.mime, "Cache-Control": "private, max-age=86400" }).send(row.data);
};

// DELETE /api/tasks/:id/photos/:photoId   the person who added it, or the committee
export const deletePhoto = async (req, res) => {
    const task = await loadTask(req, res);
    if (!task) return;
    const r = await pool.query(
        `DELETE FROM task_photos WHERE id = $1 AND task_id = $2 AND (uploaded_by = $3 OR $4) RETURNING id`,
        [Number(req.params.photoId), task.id, req.user.id, ["chairman", "committee"].includes(req.user.role)]);
    if (!r.rowCount) return fail(res, 404, "Photo not found");
    res.json({ success: true, message: "Photo removed" });
};
