import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { startOverdueReminderJob } from "./jobs/overdueReminderJob.js";
import reportRoutes from "./routes/reportRoutes.js";
import { startDailyReportJob } from "./jobs/dailyReportJob.js";
import calendarRoutes from "./routes/calendarRoutes.js";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
// Authentication APIs
app.use("/api/auth", authRoutes);

// User management APIs
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/calendar", calendarRoutes);

// Welcome API
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Temple AI Management Backend is running!"
    });
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT NOW() AS current_time"
        );

        res.status(200).json({
            success: true,
            message: "PostgreSQL connected successfully",
            databaseTime: result.rows[0].current_time
        });

    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  startDailyReportJob();
});