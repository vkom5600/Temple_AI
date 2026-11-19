import cron from "node-cron";
import { notify } from "../services/notificationService.js";
import { getSetting } from "../services/settingsService.js";
import { TIMEZONE } from "../services/taskService.js";
import { generateDailyReport, templeDate } from "../services/reportService.js";

// 00:05 temple time: write yesterday's report and send it to the chairman (in-app).
export const runDailyReportJob = async () => {
    if (!(await getSetting("nightly_report", true))) return { skipped: "switched off" };
    const date = templeDate(-1);
    const report = await generateDailyReport(date);
    await notify({
        roles: ["chairman"],
        title: `Yesterday at the temple (${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })})`,
        message: report.summary,
        type: "report",
    });
    console.log(`Nightly report for ${date} written by ${report.written_by}.`);
    return report;
};

export const startDailyReportJob = () => {
    cron.schedule("5 0 * * *", () => runDailyReportJob().catch((error) => console.error("Nightly report job failed:", error.message)), { timezone: TIMEZONE });
};
