// Simple in-memory limiter for login and registration: stops password guessing and sign-up spam.
// Fine for a single server; swap for a shared store if we ever run several.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

export const authRateLimit = (req, res, next) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const key = `${req.ip}|${email}`;
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now - entry.start > WINDOW_MS) {
        attempts.set(key, { start: now, count: 1 });
    } else {
        entry.count += 1;

        if (entry.count > MAX_ATTEMPTS) {
            const retryAfter = Math.ceil((entry.start + WINDOW_MS - now) / 1000);
            res.set("Retry-After", String(retryAfter));

            return res.status(429).json({
                success: false,
                message: "Too many login attempts. Please wait a few minutes and try again."
            });
        }
    }

    // Successful logins clear the counter.
    res.on("finish", () => {
        if (res.statusCode === 200) attempts.delete(key);
    });

    next();
};

// Drop expired entries so the map can't grow forever.
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
        if (now - entry.start > WINDOW_MS) attempts.delete(key);
    }
}, WINDOW_MS).unref();
