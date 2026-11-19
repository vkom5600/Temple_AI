import "./config/env.js";
import express from "express";
import cors from "cors";
import pool from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// Phase 1: foundation
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

// Later phases: the code exists (draft) but its tables arrive with that
// phase's migration. Uncomment each block when the phase is built.
// Phase 2: tasks + issues, attendance
import taskRoutes from "./routes/taskRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import { startRepeatingTasksJob } from "./jobs/repeatingTasksJob.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import { startClosingCheckJob } from "./jobs/closingCheckJob.js";
// Phase 3
import bookingRoutes from "./routes/bookingRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import askRoutes from "./routes/askRoutes.js";
import { resourceRouter, ruleRouter } from "./routes/resourceRoutes.js";
// import calendarRoutes from "./routes/calendarRoutes.js";
// import aiRoutes from "./routes/aiRoutes.js";
// Phase 4
import auditRoutes from "./routes/auditRoutes.js";
// import reportRoutes from "./routes/reportRoutes.js";
// import { startDailyReportJob } from "./jobs/dailyReportJob.js";
// import { startOverdueReminderJob } from "./jobs/overdueReminderJob.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);

app.use("/api/tasks", taskRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/resources", resourceRouter);
app.use("/api/rules", ruleRouter);
app.use("/api/plans", planRoutes);
app.use("/api/ai", askRoutes);
// app.use("/api/calendar", calendarRoutes);
// app.use("/api/ai", aiRoutes);
app.use("/api/audit-logs", auditRoutes);
// app.use("/api/reports", reportRoutes);

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS database_time");

        res.json({
            success: true,
            message: "API and database are running",
            databaseTime: result.rows[0].database_time
        });
    } catch (error) {
        console.error("Database health check failed:", error.message);

        res.status(503).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

app.use("/api", notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
    console.log(`Temple AI API running on http://localhost:${PORT}`);

    startRepeatingTasksJob();
    startClosingCheckJob();

    // Phase 4
    // startDailyReportJob();
    // startOverdueReminderJob();
});
