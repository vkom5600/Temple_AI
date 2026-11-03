import express from "express";

import {
    connectGoogleCalendar,
    googleOAuthCallback,
    getCalendarConnectionStatus,
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent
} from "../controllers/calendarController.js";

const router = express.Router();

// OAuth callback is public because Google redirects the browser here.
// Its signed state is validated inside the controller.
router.get("/oauth2callback", googleOAuthCallback);

// Protect all other endpoints using your existing authentication
// middleware when registering this router in server.js.
router.get("/connect", connectGoogleCalendar);
router.get("/status", getCalendarConnectionStatus);

router.get("/events", getEvents);
router.post("/events", createEvent);
router.patch("/events/:eventId", updateEvent);
router.delete("/events/:eventId", deleteEvent);

export default router;