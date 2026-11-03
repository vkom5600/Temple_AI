
import pool from "../config/db.js";

// Create a notification for one user
export const createNotification = async ({
  userId,
  title,
  message
}) => {
  if (!userId || !title || !message) {
    throw new Error(
      "User ID, notification title and message are required"
    );
  }

  const result = await pool.query(
    `INSERT INTO notifications
      (user_id, title, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, title, message]
  );

  return result.rows[0];
};

// Notify all active users belonging to specified roles
export const notifyUsersByRoles = async ({
  roles,
  title,
  message
}) => {
  if (!Array.isArray(roles) || roles.length === 0) {
    return [];
  }

  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, message)
     SELECT id, $2, $3
     FROM users
     WHERE role = ANY($1::varchar[])
       AND is_active = TRUE
     RETURNING *`,
    [roles, title, message]
  );

  return result.rows;
};

// Safely send notifications without failing the main operation
export const sendNotificationSafely = async (notificationData) => {
  try {
    return await createNotification(notificationData);
  } catch (error) {
    console.error("Notification creation failed:", error.message);
    return null;
  }
};

// Safely notify users by role
export const notifyRolesSafely = async (notificationData) => {
  try {
    return await notifyUsersByRoles(notificationData);
  } catch (error) {
    console.error("Role notification failed:", error.message);
    return [];
  }
};
