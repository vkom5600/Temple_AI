import { google } from "googleapis";

const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
} = process.env;

if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI
) {
    throw new Error("Google Calendar environment variables are missing");
}

export const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

export const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client
});

export const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events"
];