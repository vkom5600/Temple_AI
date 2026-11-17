import pool from "../config/db.js";

// Send an in-app notification. Pick recipients with any mix of:
//   userId / userIds   specific people
//   roles              e.g. ["chairman", "committee"]
//   designations       e.g. ["cleaner"]  (staff job, from staff_profiles)
//   excludeUserId      leave one person out (e.g. whoever caused the event)
// Only active, approved users receive it, and nobody gets the same one twice.
//   await notify({ roles: ["chairman"], title: "...", message: "...", type: "attendance" });
// Never throws: returns the notifications created ([] on failure).
export const notify = async ({
  userId,
  userIds = [],
  roles = [],
  designations = [],
  excludeUserId = null,
  title,
  message = null,
  type = "general"
}, db = pool) => {
  const ids = [...userIds, ...(userId ? [userId] : [])].map(Number);

  if (!title || (!ids.length && !roles.length && !designations.length)) {
    console.error("notify() needs a title and at least one recipient");
    return [];
  }

  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, notification_type)
       SELECT DISTINCT u.id, $4, $5, $6
       FROM users u
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE u.is_active AND u.approval_status = 'approved'
         AND (u.id = ANY($1::int[])
              OR u.role = ANY($2::varchar[])
              OR sp.designation = ANY($3::varchar[]))
         AND u.id IS DISTINCT FROM $7
       RETURNING *`,
      [ids, roles, designations, title, message, type, excludeUserId]
    );

    return result.rows;
  } catch (error) {
    console.error(`Notification failed (${title}):`, error.message);
    return [];
  }
};

// ---- Older names used by the task and booking controllers ----

export const sendNotificationSafely = async ({ userId, title, message, type }) =>
  (await notify({ userId, title, message, type }))[0] ?? null;

export const notifyRolesSafely = ({ roles, title, message, type }) =>
  notify({ roles, title, message, type });

export const createNotification = sendNotificationSafely;
export const notifyUsersByRoles = notifyRolesSafely;
