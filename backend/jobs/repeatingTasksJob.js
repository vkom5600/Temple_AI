import cron from "node-cron";
import { generateRepeatingTasks, TIMEZONE } from "../services/taskService.js";

// Creates today's copy of daily/weekly tasks. Runs at start-up, then every
// 15 minutes (so a server that was off overnight catches up quickly).
const run = async () => {
    try {
        const created = await generateRepeatingTasks();
        if (created) console.log(`Repeating tasks: created ${created} new copies`);
    } catch (error) {
        console.error("Repeating tasks job failed:", error.message);
    }
};

export const startRepeatingTasksJob = () => {
    run();
    cron.schedule("*/15 * * * *", run, { timezone: TIMEZONE });
};
