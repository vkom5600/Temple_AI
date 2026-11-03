import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { oauth2Client, calendar, GOOGLE_SCOPES } from "../config/googleCalendar.js";

const TOKEN_PATH = path.resolve(
    process.cwd(),
    process.env.GOOGLE_TOKEN_PATH || "./private/google-calendar-token.json"
);

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

const STATE_SECRET = process.env.GOOGLE_OAUTH_STATE_SECRET;

if (!STATE_SECRET) {
    throw new Error("GOOGLE_OAUTH_STATE_SECRET is missing");
}

// OAuth state is signed and expires after 10 minutes.
export function createOAuthState() {
    const payload = {
        nonce: crypto.randomBytes(24).toString("hex"),
        expiresAt: Date.now() + 10 * 60 * 1000
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const signature = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(encoded)
        .digest("hex");

    return `${encoded}.${signature}`;
}

export function verifyOAuthState(state) {
    if (typeof state !== "string") return false;

    const [encoded, receivedSignature] = state.split(".");

    if (!encoded || !receivedSignature) return false;

    const expectedSignature = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(encoded)
        .digest();

    let received;

    try {
        received = Buffer.from(receivedSignature, "hex");
    } catch {
        return false;
    }

    if (
        received.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(expectedSignature, received)
    ) {
        return false;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(encoded, "base64url").toString()
        );

        return (
            typeof payload.nonce === "string" &&
            payload.expiresAt > Date.now()
        );
    } catch {
        return false;
    }
}

async function saveTokens(tokens) {
    await fs.mkdir(path.dirname(TOKEN_PATH), {
        recursive: true,
        mode: 0o700
    });

    await fs.writeFile(
        TOKEN_PATH,
        JSON.stringify(tokens, null, 2),
        { mode: 0o600 }
    );

    await fs.chmod(TOKEN_PATH, 0o600);
}

async function readTokens() {
    try {
        const data = await fs.readFile(TOKEN_PATH, "utf8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

export async function saveGoogleTokens(tokens) {
    const existing = await readTokens();

    // Google may not return a refresh token on subsequent consent flows.
    const mergedTokens = {
        ...existing,
        ...tokens,
        refresh_token: tokens.refresh_token || existing?.refresh_token
    };

    if (!mergedTokens.refresh_token) {
        throw new Error(
            "Google did not return a refresh token. Reauthorize with consent."
        );
    }

    await saveTokens(mergedTokens);
    oauth2Client.setCredentials(mergedTokens);

    return true;
}

export async function getAuthorizedCalendarClient() {
    const tokens = await readTokens();

    if (!tokens?.refresh_token) {
        throw new Error("Google Calendar is not connected. Authorize first.");
    }

    oauth2Client.setCredentials(tokens);

    return calendar;
}

// Persist refreshed tokens when Google rotates them.
oauth2Client.on("tokens", async (tokens) => {
    try {
        const existing = await readTokens();

        await saveTokens({
            ...existing,
            ...tokens,
            refresh_token: tokens.refresh_token || existing?.refresh_token
        });
    } catch (error) {
        console.error("Unable to save refreshed Google tokens:", error.message);
    }
});

export async function listCalendarEvents({
    timeMin,
    timeMax,
    maxResults = 50
} = {}) {
    const client = await getAuthorizedCalendarClient();

    const response = await client.events.list({
        calendarId: CALENDAR_ID,
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        maxResults: Math.min(Number(maxResults) || 50, 250),
        singleEvents: true,
        orderBy: "startTime"
    });

    return response.data.items || [];
}

export async function createCalendarEvent(eventData) {
    const client = await getAuthorizedCalendarClient();

    const response = await client.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: eventData
    });

    return response.data;
}

export async function updateCalendarEvent(eventId, eventData) {
    const client = await getAuthorizedCalendarClient();

    const response = await client.events.patch({
        calendarId: CALENDAR_ID,
        eventId,
        requestBody: eventData
    });

    return response.data;
}

export async function deleteCalendarEvent(eventId) {
    const client = await getAuthorizedCalendarClient();

    await client.events.delete({
        calendarId: CALENDAR_ID,
        eventId
    });

    return true;
}

export async function getCalendarEvent(eventId) {
    const client = await getAuthorizedCalendarClient();

    const response = await client.events.get({
        calendarId: CALENDAR_ID,
        eventId
    });

    return response.data;
}