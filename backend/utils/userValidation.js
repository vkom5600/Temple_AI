// Shared by registration (authController) and people management (userController).

// The chairman account is created by the seed/setup script, never through the API.
export const ASSIGNABLE_ROLES = ["committee", "staff", "volunteer"];
export const DESIGNATIONS = [
    "priest", "cook", "cleaner", "caretaker", "security", "maintenance"
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

export const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Validates a person's details. Password is required when requirePassword is set,
// otherwise optional (blank = keep the current one). Returns { error } or { data }.
export const validateUserBody = (body = {}, { requirePassword }) => {
    const data = {
        full_name: clean(body.full_name),
        email: clean(body.email)?.toLowerCase() ?? null,
        role: body.role,
        phone: clean(body.phone),
        designation: clean(body.designation),
        emergency_contact: clean(body.emergency_contact),
        joining_date: clean(body.joining_date),
        password: typeof body.password === "string" && body.password !== ""
            ? body.password
            : null
    };

    if (!data.full_name || data.full_name.length > 100) {
        return { error: "Name is required (up to 100 characters)" };
    }
    if (!data.email || !EMAIL_PATTERN.test(data.email) || data.email.length > 150) {
        return { error: "A valid email is required" };
    }
    if (!ASSIGNABLE_ROLES.includes(data.role)) {
        return { error: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` };
    }
    if (data.role === "staff" && !DESIGNATIONS.includes(data.designation)) {
        return { error: `Staff need a job role: ${DESIGNATIONS.join(", ")}` };
    }
    if (data.role !== "staff") {
        data.designation = null;
    }
    if (data.phone && !/^[+\d][\d\s()-]{5,19}$/.test(data.phone)) {
        return { error: "Phone number doesn't look right" };
    }
    if (data.joining_date && Number.isNaN(Date.parse(data.joining_date))) {
        return { error: "Joining date must be a date (YYYY-MM-DD)" };
    }
    if (requirePassword && !data.password) {
        return { error: "A password is required" };
    }
    if (data.password && (data.password.length < 8 || data.password.length > 72)) {
        return { error: "Password must be 8 to 72 characters" };
    }

    return { data };
};
