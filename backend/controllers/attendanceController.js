
import pool from "../config/db.js";

// Staff or volunteer checks in
export const checkIn = async (req, res) => {
  try {
    const { notes, status } = req.body;

    // The user can choose present or late.
    // The system does not assume a late-arrival time.
    const attendanceStatus = status || "present";

    if (!["present", "late"].includes(attendanceStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be present or late"
      });
    }

    const result = await pool.query(
      `INSERT INTO attendance
       (user_id, check_in, status, marked_by, notes)
       VALUES ($1, NOW(), $2, $1, $3)
       ON CONFLICT (user_id, attendance_date) DO NOTHING
       RETURNING *`,
      [req.user.id, attendanceStatus, notes || null]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Attendance has already been marked for today"
      });
    }

    res.status(201).json({
      success: true,
      message: "Check-in recorded successfully",
      attendance: result.rows[0]
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to record check-in"
    });
  }
};

// Staff or volunteer checks out
export const checkOut = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE attendance
       SET check_out = NOW()
       WHERE user_id = $1
         AND attendance_date = CURRENT_DATE
         AND check_in IS NOT NULL
         AND check_out IS NULL
       RETURNING *`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No active check-in found for today"
      });
    }

    res.json({
      success: true,
      message: "Check-out recorded successfully",
      attendance: result.rows[0]
    });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to record check-out"
    });
  }
};

// View attendance records
export const getAttendance = async (req, res) => {
  try {
    const { date, user_id } = req.query;

    let query = `
      SELECT a.*, u.full_name, u.email, u.role
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;

    const values = [];

    // Staff and volunteers can view only their own records
    if (["staff", "volunteer"].includes(req.user.role)) {
      values.push(req.user.id);
      query += ` AND a.user_id = $${values.length}`;
    } else if (user_id) {
      values.push(user_id);
      query += ` AND a.user_id = $${values.length}`;
    }

    if (date) {
      values.push(date);
      query += ` AND a.attendance_date = $${values.length}`;
    }

    query += " ORDER BY a.attendance_date DESC, u.full_name ASC";

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rowCount,
      attendance: result.rows
    });
  } catch (error) {
    console.error("Get attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve attendance"
    });
  }
};

// Chairman or Committee can mark a staff member absent
export const markAbsent = async (req, res) => {
  try {
    const { user_id, attendance_date, notes } = req.body;

    if (!user_id || !attendance_date) {
      return res.status(400).json({
        success: false,
        message: "User ID and attendance date are required"
      });
    }

    const user = await pool.query(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      [user_id]
    );

    if (
      user.rowCount === 0 ||
      !user.rows[0].is_active ||
      !["staff", "volunteer"].includes(user.rows[0].role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff or volunteer account"
      });
    }

    const result = await pool.query(
      `INSERT INTO attendance
       (user_id, attendance_date, status, marked_by, notes)
       VALUES ($1, $2, 'absent', $3, $4)
       ON CONFLICT (user_id, attendance_date) DO NOTHING
       RETURNING *`,
      [user_id, attendance_date, req.user.id, notes || null]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Attendance already exists for this user and date"
      });
    }

    res.status(201).json({
      success: true,
      message: "Absence recorded successfully",
      attendance: result.rows[0]
    });
  } catch (error) {
    console.error("Mark absent error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to mark absence"
    });
  }
};
