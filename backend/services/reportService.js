import pool from "../config/db.js";
import { askClaude } from "./claudeService.js";

const validateReportDate = (reportDate) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error("Report date must be in YYYY-MM-DD format");
  }

  const parsedDate = new Date(`${reportDate}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== reportDate
  ) {
    throw new Error("Invalid report date");
  }
};

export const collectDailyReportData = async (reportDate) => {
  validateReportDate(reportDate);

  // 1. Task statistics
  const taskResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE created_at::date = $1::date
       )::int AS tasks_total,

       COUNT(*) FILTER (
         WHERE created_at::date = $1::date
         AND status = 'assigned'
       )::int AS tasks_assigned,

       COUNT(*) FILTER (
         WHERE created_at::date = $1::date
         AND status = 'completed'
       )::int AS tasks_completed,

       COUNT(*) FILTER (
         WHERE created_at::date = $1::date
         AND status = 'pending_verification'
       )::int AS tasks_pending_verification,

       COUNT(*) FILTER (
         WHERE created_at::date = $1::date
         AND status = 'approved'
       )::int AS tasks_approved,

       COUNT(*) FILTER (
         WHERE due_at::date <= $1::date
         AND status NOT IN ('approved', 'closed')
         AND due_at IS NOT NULL
       )::int AS tasks_overdue

     FROM tasks
     WHERE created_at::date <= $1::date`,
    [reportDate]
  );

  // 2. Attendance statistics
  const attendanceResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE status = 'present'
       )::int AS attendance_present,

       COUNT(*) FILTER (
         WHERE status = 'absent'
       )::int AS attendance_absent,

       COUNT(*) FILTER (
         WHERE status = 'late'
       )::int AS attendance_late

     FROM attendance
     WHERE attendance_date = $1::date`,
    [reportDate]
  );

  // 3. Booking statistics
  const bookingResult = await pool.query(
    `SELECT
       COUNT(*)::int AS bookings_total,

       COUNT(*) FILTER (
         WHERE status = 'pending'
       )::int AS bookings_pending,

       COUNT(*) FILTER (
         WHERE status = 'approved'
       )::int AS bookings_approved,

       COUNT(*) FILTER (
         WHERE status = 'rejected'
       )::int AS bookings_rejected

     FROM bookings
     WHERE start_at::date = $1::date`,
    [reportDate]
  );

  return {
    report_date: reportDate,
    ...taskResult.rows[0],
    ...attendanceResult.rows[0],
    ...bookingResult.rows[0]
  };
};

export const saveDailyReport = async (reportData) => {
  const {
    report_date,
    tasks_total,
    tasks_assigned,
    tasks_completed,
    tasks_pending_verification,
    tasks_approved,
    tasks_overdue,
    attendance_present,
    attendance_absent,
    attendance_late,
    bookings_total,
    bookings_pending,
    bookings_approved,
    bookings_rejected
  } = reportData;

  const result = await pool.query(
    `INSERT INTO daily_reports (
       report_date,
       tasks_total,
       tasks_assigned,
       tasks_completed,
       tasks_pending_verification,
       tasks_approved,
       tasks_overdue,
       attendance_present,
       attendance_absent,
       attendance_late,
       bookings_total,
       bookings_pending,
       bookings_approved,
       bookings_rejected,
       ai_summary,
       generated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13, $14,
       NULL, CURRENT_TIMESTAMP
     )
     ON CONFLICT (report_date)
     DO UPDATE SET
       tasks_total = EXCLUDED.tasks_total,
       tasks_assigned = EXCLUDED.tasks_assigned,
       tasks_completed = EXCLUDED.tasks_completed,
       tasks_pending_verification =
         EXCLUDED.tasks_pending_verification,
       tasks_approved = EXCLUDED.tasks_approved,
       tasks_overdue = EXCLUDED.tasks_overdue,
       attendance_present = EXCLUDED.attendance_present,
       attendance_absent = EXCLUDED.attendance_absent,
       attendance_late = EXCLUDED.attendance_late,
       bookings_total = EXCLUDED.bookings_total,
       bookings_pending = EXCLUDED.bookings_pending,
       bookings_approved = EXCLUDED.bookings_approved,
       bookings_rejected = EXCLUDED.bookings_rejected,
       ai_summary = NULL,
       generated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      report_date,
      tasks_total,
      tasks_assigned,
      tasks_completed,
      tasks_pending_verification,
      tasks_approved,
      tasks_overdue,
      attendance_present,
      attendance_absent,
      attendance_late,
      bookings_total,
      bookings_pending,
      bookings_approved,
      bookings_rejected
    ]
  );

  return result.rows[0];
};

export const generateReportAISummary = async (reportDate) => {
  validateReportDate(reportDate);

  const reportResult = await pool.query(
    `SELECT *
     FROM daily_reports
     WHERE report_date = $1::date`,
    [reportDate]
  );

  if (reportResult.rows.length === 0) {
    const error = new Error("Daily report not found. Generate the report first.");
    error.statusCode = 404;
    throw error;
  }

  const report = reportResult.rows[0];

  const prompt = `
Prepare a clear daily operational report for a temple management system.

Use only the supplied database statistics.
Do not invent events, reasons, names, or explanations.
Mention important operational figures, pending work, overdue tasks,
attendance, and booking status.
Give practical recommendations based on the figures.
If a statistic is zero, report that accurately.

Use headings and concise bullet points.
`;

  const context = JSON.stringify(report);

  // Claude is the only AI provider for this project.
  const summary = await askClaude(prompt, context);

  const updateResult = await pool.query(
    `UPDATE daily_reports
     SET ai_summary = $1
     WHERE report_date = $2::date
     RETURNING *`,
    [summary, reportDate]
  );

  return updateResult.rows[0];
};

export const generateDailyReport = async (reportDate) => {
  const reportData = await collectDailyReportData(reportDate);
  const savedReport = await saveDailyReport(reportData);

  // Keep the numerical report even when the teammate has not
  // configured the Claude credentials yet.
  if (
    !process.env.ANTHROPIC_API_KEY ||
    !process.env.CLAUDE_MODEL
  ) {
    return {
      report: savedReport,
      summaryStatus: "pending",
      message: "Report statistics saved. Claude credentials are not configured yet."
    };
  }

  const reportWithSummary = await generateReportAISummary(reportDate);

  return {
    report: reportWithSummary,
    summaryStatus: "generated",
    message: "Daily report and Claude AI summary generated successfully."
  };
};