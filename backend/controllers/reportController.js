import {
  generateDailyReport,
  generateReportAISummary
} from "../services/reportService.js";

import pool from "../config/db.js";

const isValidDate = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
};

// POST /api/reports/generate
export const generateReport = async (req, res) => {
  try {
    const reportDate =
  req.body.reportDate ||
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata"
  }).format(new Date());

    if (!isValidDate(reportDate)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid reportDate in YYYY-MM-DD format."
      });
    }

    const result = await generateDailyReport(reportDate);

    return res.status(200).json({
      success: true,
      message: result.message,
      summaryStatus: result.summaryStatus,
      report: result.report
    });
  } catch (error) {
    console.error("Generate report error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to generate daily report."
    });
  }
};

// GET /api/reports
export const getDailyReports = async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const result = await pool.query(
      `SELECT *
       FROM daily_reports
       ORDER BY report_date DESC
       LIMIT $1`,
      [limit]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      reports: result.rows
    });
  } catch (error) {
    console.error("Get reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve daily reports."
    });
  }
};

// GET /api/reports/:date
export const getDailyReportByDate = async (req, res) => {
  try {
    const { date } = req.params;

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format."
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM daily_reports
       WHERE report_date = $1::date`,
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Daily report not found."
      });
    }

    return res.status(200).json({
      success: true,
      report: result.rows[0]
    });
  } catch (error) {
    console.error("Get report by date error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the daily report."
    });
  }
};

// POST /api/reports/:date/ai-summary
export const generateAISummary = async (req, res) => {
  try {
    const { date } = req.params;

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format."
      });
    }

    const report = await generateReportAISummary(date);

    return res.status(200).json({
      success: true,
      message: "Claude AI summary generated successfully.",
      report
    });
  } catch (error) {
    console.error("Generate AI summary error:", error);

    return res.status(error.statusCode || 503).json({
      success: false,
      message: error.message || "Unable to generate Claude AI summary."
    });
  }
};