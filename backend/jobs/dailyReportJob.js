import cron from "node-cron";
import pool from "../config/db.js";

import {
  generateDailyReport
} from "../services/reportService.js";

export const runDailyReportJob = async () => {
  try {
    // Generate yesterday's report after the previous day has ended.
    const dateResult = await pool.query(
      `SELECT TO_CHAR(
         CURRENT_DATE - INTERVAL '1 day',
         'YYYY-MM-DD'
       ) AS report_date`
    );

    const reportDate = dateResult.rows[0].report_date;

    console.log(
      `Starting daily report generation for ${reportDate}`
    );

    const result = await generateDailyReport(reportDate);

    console.log("Daily report job completed.");
    console.log("Report date:", reportDate);
    console.log("Claude summary status:", result.summaryStatus);

    return result;
  } catch (error) {
    console.error("Daily report job failed:", error);
    throw error;
  }
};

export const startDailyReportJob = () => {
  cron.schedule(
    "5 0 * * *",
    async () => {
      try {
        await runDailyReportJob();
      } catch (error) {
        console.error("Scheduled daily report error:", error);
      }
    },
    {
      timezone: "Asia/Kolkata"
    }
  );

  console.log(
    "Daily report scheduler started. It runs every day at 12:05 AM IST."
  );
};