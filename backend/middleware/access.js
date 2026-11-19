// Committee access per area (P2 design). The chairman can do everything; staff and
// volunteers are handled by the role checks on each route. For committee members:
//   tasks, calendar, people, rules: 'off' | 'view' | 'manage'
//   reports: 'off' | 'view'
//   broadcast, ai: true | false

export const AREAS = {
    tasks: ["off", "view", "manage"],
    calendar: ["off", "view", "manage"],
    people: ["off", "view", "manage"],
    rules: ["off", "view", "manage"],
    reports: ["off", "view"],
};
export const FLAGS = ["broadcast", "ai"];

// What committee members could do before per-area access existed.
export const DEFAULT_ACCESS = { tasks: "manage", calendar: "manage", people: "view", rules: "manage", reports: "view", broadcast: true, ai: true };
const FULL = { tasks: "manage", calendar: "manage", people: "manage", rules: "manage", reports: "view", broadcast: true, ai: true };

export const effectiveAccess = (user) => {
    if (!user) return null;
    if (user.role === "chairman") return FULL;
    if (user.role !== "committee") return null;
    const saved = user.access && typeof user.access === "object" ? user.access : {};
    const out = { ...DEFAULT_ACCESS };
    for (const [area, levels] of Object.entries(AREAS)) if (levels.includes(saved[area])) out[area] = saved[area];
    for (const flag of FLAGS) if (typeof saved[flag] === "boolean") out[flag] = saved[flag];
    return out;
};

// Check an incoming access object; returns { data } or { error }.
export const validateAccess = (body = {}) => {
    const data = {};
    for (const [area, levels] of Object.entries(AREAS)) {
        if (!levels.includes(body[area])) return { error: `${area} must be one of: ${levels.join(", ")}` };
        data[area] = body[area];
    }
    for (const flag of FLAGS) {
        if (typeof body[flag] !== "boolean") return { error: `${flag} must be on or off` };
        data[flag] = body[flag];
    }
    return { data };
};

const NAMES = { tasks: "Tasks", calendar: "Calendar and bookings", people: "People", rules: "Temple Rules", reports: "Reports" };

// router.post("/", requireAccess("tasks", "manage"), handler)
export const requireAccess = (area, level = "view") => (req, res, next) => {
    if (req.user?.role !== "committee") return next();
    const have = effectiveAccess(req.user)[area];
    const ok = level === "view" ? have !== "off" : have === "manage";
    if (ok) return next();
    res.status(403).json({
        success: false,
        message: have === "view" ? `You can view ${NAMES[area]} but not change it. Ask the chairman if you need to.` : `${NAMES[area]} is switched off for you. Ask the chairman if you need it.`
    });
};

// router.post("/broadcast", requireFlag("broadcast"), handler)
export const requireFlag = (flag) => (req, res, next) => {
    if (req.user?.role !== "committee" || effectiveAccess(req.user)[flag]) return next();
    res.status(403).json({ success: false, message: flag === "ai" ? "Ask AI and Plan with AI are switched off for you." : "Sending broadcasts is switched off for you." });
};
