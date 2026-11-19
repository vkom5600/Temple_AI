import { findDailyReport, generateDailyReport, templeDate, writerLabel } from "../services/reportService.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/reports/daily/:date   the stored nightly report (404 if none yet)
export const getDaily = async (req, res) => {
    const { date } = req.params;
    if (!DATE.test(date)) return res.status(400).json({ success: false, message: "Date must be YYYY-MM-DD" });
    const report = await findDailyReport(date);
    if (!report) return res.status(404).json({ success: false, message: "No nightly report for that day yet" });
    res.json({ success: true, report: { ...report, written_by_label: writerLabel(report) } });
};

// POST /api/reports/daily/:date   write (or rewrite) the report now, for a day that has ended
export const makeDaily = async (req, res) => {
    const { date } = req.params;
    if (!DATE.test(date)) return res.status(400).json({ success: false, message: "Date must be YYYY-MM-DD" });
    if (date >= templeDate()) return res.status(400).json({ success: false, message: "Reports are written once the day has ended" });
    const report = await generateDailyReport(date);
    res.json({ success: true, report: { ...report, written_by_label: writerLabel(report) }, message: "Report written" });
};
