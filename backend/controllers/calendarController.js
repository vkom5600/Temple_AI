import { oauth2Client, GOOGLE_SCOPES } from "../config/googleCalendar.js";

import {
    createOAuthState,
    verifyOAuthState,
    saveGoogleTokens,
    listCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent
} from "../services/googleCalendarService.js";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Start Google OAuth authorization
export const connectGoogleCalendar = async (req, res) => {
    try {
        const state = createOAuthState();

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: GOOGLE_SCOPES,
            include_granted_scopes: true,
            state
        });

        return res.status(200).json({
            success: true,
            message: "Open this URL to connect Google Calendar",
            authorizationUrl: authUrl
        });
    } catch (error) {
        console.error("Google authorization error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to start Google authorization"
        });
    }
};

// Google redirects here after authorization
export const googleOAuthCallback = async (req, res) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.status(400).send(
                "Google Calendar authorization was denied."
            );
        }

        if (!code || !verifyOAuthState(state)) {
            return res.status(400).send(
                "Invalid or expired OAuth state."
            );
        }

        const { tokens } = await oauth2Client.getToken(code);

        await saveGoogleTokens(tokens);

        return res.redirect(
            `${FRONTEND_URL}/calendar?googleCalendar=connected`
        );
    } catch (error) {
        console.error("Google OAuth callback error:", error);

        return res.status(500).send(
            "Google Calendar connection failed."
        );
    }
};

// Check Google Calendar connection
export const getCalendarConnectionStatus = async (req, res) => {
    try {
        const { getAuthorizedCalendarClient } =
            await import("../services/googleCalendarService.js");

        await getAuthorizedCalendarClient();

        return res.status(200).json({
            success: true,
            connected: true,
            calendarId: CALENDAR_ID
        });
    } catch (error) {
        return res.status(200).json({
            success: true,
            connected: false,
            message: error.message
        });
    }
};

// Retrieve calendar events
export const getEvents = async (req, res) => {
    try {
        const events = await listCalendarEvents({
            timeMin: req.query.timeMin,
            timeMax: req.query.timeMax,
            maxResults: req.query.maxResults
        });

        return res.status(200).json({
            success: true,
            count: events.length,
            events
        });
    } catch (error) {
        console.error("Get calendar events error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create calendar event
export const createEvent = async (req, res) => {
    try {
        const {
            summary,
            description,
            location,
            start,
            end
        } = req.body;

        if (!summary || !start || !end) {
            return res.status(400).json({
                success: false,
                message: "Summary, start and end are required"
            });
        }

        const event = await createCalendarEvent({
            summary,
            description,
            location,
            start,
            end
        });

        return res.status(201).json({
            success: true,
            message: "Calendar event created successfully",
            event
        });
    } catch (error) {
        console.error("Create calendar event error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create calendar event",
            error: error.message
        });
    }
};

// Update calendar event
export const updateEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "Event ID is required"
            });
        }

        const {
            summary,
            description,
            location,
            start,
            end
        } = req.body;

        const event = await updateCalendarEvent(eventId, {
            ...(summary !== undefined && { summary }),
            ...(description !== undefined && { description }),
            ...(location !== undefined && { location }),
            ...(start !== undefined && { start }),
            ...(end !== undefined && { end })
        });

        return res.status(200).json({
            success: true,
            message: "Calendar event updated successfully",
            event
        });
    } catch (error) {
        console.error("Update calendar event error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update calendar event",
            error: error.message
        });
    }
};

// Delete calendar event
export const deleteEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        await deleteCalendarEvent(eventId);

        return res.status(200).json({
            success: true,
            message: "Calendar event deleted successfully"
        });
    } catch (error) {
        console.error("Delete calendar event error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete calendar event",
            error: error.message
        });
    }
};