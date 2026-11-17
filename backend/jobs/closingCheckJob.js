import cron from "node-cron";
import { runClosingCheck } from "../services/attendanceService.js";
import { TIMEZONE } from "../services/taskService.js";

// Every 5 minutes: once the chairman's closing time has passed, check (once a day)
// that everyone has left and someone confirmed lamps, gas and doors.
const run = async () => {
    try {
        const result = await runClosingCheck();
        if (result && !result.ok && !result.skipped) console.log("Closing check: chairman alerted", result);
    } catch (error) {
        console.error("Closing check job failed:", error.message);
    }
};

export const startClosingCheckJob = () => {
    cron.schedule("*/5 * * * *", run, { timezone: TIMEZONE });
};
