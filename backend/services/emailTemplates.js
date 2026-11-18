// Wording for every email the system sends. Plain text, short, polite.
// Each returns { subject, text } for sendEmail().

const APP = "Temple AI";
const appUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";

const ROLE_WORDS = {
  committee: "a committee member",
  staff: "staff",
  volunteer: "a volunteer"
};

const when = (date = new Date()) =>
  date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });

export const registrationReceived = (user) => ({
  subject: `${APP}: we have your registration`,
  text:
    `Namaste ${user.full_name},\n\n` +
    `Thank you for registering to join as ${ROLE_WORDS[user.role]}.\n` +
    `The chairman will review your details. We'll email you once it's decided.\n\n` +
    `${APP}`
});

export const newRegistrationAlert = (user) => ({
  subject: `${APP}: new registration from ${user.full_name}`,
  text:
    `${user.full_name} (${user.email}) has registered to join as ${ROLE_WORDS[user.role]}` +
    `${user.designation ? ` (${user.designation})` : ""}.\n\n` +
    `Review it on the People page: ${appUrl()}/admin/people\n\n` +
    `${APP}`
});

export const registrationApproved = (user) => ({
  subject: `${APP}: your registration is approved`,
  text:
    `Namaste ${user.full_name},\n\n` +
    `Your registration has been approved. You can now sign in:\n${appUrl()}/login\n\n` +
    `${APP}`
});

export const registrationRejected = (user, reason) => ({
  subject: `${APP}: your registration`,
  text:
    `Namaste ${user.full_name},\n\n` +
    `Sorry, your registration was not approved.\nReason: ${reason}\n\n` +
    `If you think this is a mistake, please speak to the temple office.\n\n` +
    `${APP}`
});

export const loginNotice = (user) => ({
  subject: `${APP}: new sign-in to your account`,
  text:
    `Namaste ${user.full_name},\n\n` +
    `Your account was signed in on ${when()}.\n` +
    `If this wasn't you, please tell the chairman straight away.\n\n` +
    `${APP}`
});

export const loginAlertToChairman = (user) => ({
  subject: `${APP}: ${user.full_name} signed in`,
  text:
    `${user.full_name} (${user.role}) signed in on ${when()}.\n\n` +
    `You can turn these emails off in Settings: ${appUrl()}/admin/settings\n\n` +
    `${APP}`
});

export const taskReminder = (task, sender) => ({
  subject: `${APP}: reminder – ${task.title}`,
  text:
    `Namaste,\n\n` +
    `A gentle reminder from ${sender.full_name}: "${task.title}"` +
    `${task.area ? ` (${task.area})` : ""}${task.due_at ? ` was due ${when(new Date(task.due_at))}` : " is still waiting"}.\n` +
    `Please complete it today, or tell us in the app if something is stopping you:\n${appUrl()}\n\n` +
    `${APP}`
});

export const closingSkipped = (user, missing) => ({
  subject: `${APP}: closing checks skipped`,
  text:
    `${user.full_name} was the last person to leave (${when()}) but did not confirm:\n` +
    missing.map((m) => `  - ${m}`).join("\n") +
    `\n\nPlease make sure the temple is safe.\n\n${APP}`
});

export const closingAlert = (problems, closingTime) => ({
  subject: `${APP}: closing check at ${closingTime}`,
  text:
    `Evening check (${when()}):\n\n` +
    problems.map((p) => `  - ${p}`).join("\n") +
    `\n\nSee Who's On: ${appUrl()}/admin/attendance\n\n${APP}`
});

// ---------- Phase 3: bookings ----------

const slot = (b) => `${b.resource_name}, ${when(new Date(b.starts_at))} – ${new Date(b.ends_at).toLocaleTimeString("en-GB", { timeStyle: "short", timeZone: "Europe/London" })}`;

export const bookingRequested = (b) => ({
  subject: `${APP}: booking request – ${b.title}`,
  text:
    `${b.requested_by_name ?? "Someone"} has asked to book ${slot(b)} for "${b.title}"` +
    `${b.guests ? ` (${b.guests} guests)` : ""}.\n\n` +
    `Review it in the Action Center: ${appUrl()}/admin/action-center\n\n` +
    `${APP}`
});

export const bookingApproved = (b) => ({
  subject: `${APP}: your booking is confirmed – ${b.title}`,
  text:
    `Namaste,\n\nYour booking "${b.title}" is confirmed: ${slot(b)}.\n` +
    `Please follow the Temple Rules you agreed to. Thank you.\n\n${APP}`
});

export const bookingDeclined = (b, reason) => ({
  subject: `${APP}: your booking request – ${b.title}`,
  text:
    `Namaste,\n\nSorry, your request "${b.title}" (${slot(b)}) was not approved.\n` +
    `Reason: ${reason}\n\nPlease speak to the temple office if you have questions.\n\n${APP}`
});
