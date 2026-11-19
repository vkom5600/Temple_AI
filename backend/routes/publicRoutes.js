import express from "express";
import { check, create, options } from "../controllers/publicBookingController.js";

// W1: public, no sign-in. Requests are limited per visitor so the form can't be flooded.
const router = express.Router();

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;
const seen = new Map();
const limit = (req, res, next) => {
    const now = Date.now();
    const entry = seen.get(req.ip);
    if (!entry || now - entry.start > WINDOW_MS) seen.set(req.ip, { start: now, count: 1 });
    else if (++entry.count > MAX_REQUESTS) return res.status(429).json({ success: false, message: "Too many requests from here. Please try again later or call the temple office." });
    next();
};

router.get("/booking-options", options);
router.post("/check", check);
router.post("/bookings", limit, create);
export default router;
