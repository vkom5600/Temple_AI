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
