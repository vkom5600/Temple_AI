
import dotenv from "dotenv";
dotenv.config();

import pool from "../config/db.js";
import {
  runOverdueReminderJob
} from "../jobs/overdueReminderJob.js";

try {
  const result = await runOverdueReminderJob();

  console.log("Manual overdue reminder test:");
  console.log(result);

} catch (error) {
  console.error("Test failed:", error);

} finally {
  await pool.end();
}
