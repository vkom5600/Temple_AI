
import pool from "../config/db.js";

// Create a new conversation for the logged-in user
export const createConversation = async (userId, title) => {
  const result = await pool.query(
    `INSERT INTO ai_conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, title]
  );

  return result.rows[0];
};

// Check whether a conversation belongs to the logged-in user
export const getOwnedConversation = async (conversationId, userId) => {
  const result = await pool.query(
    `SELECT *
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );

  return result.rows[0] || null;
};

// Save a user or assistant message
export const saveMessage = async (
  conversationId,
  sender,
  message
) => {
  const result = await pool.query(
    `INSERT INTO ai_messages
       (conversation_id, sender, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [conversationId, sender, message]
  );

  return result.rows[0];
};

// Retrieve recent conversation history
export const getConversationHistory = async (conversationId) => {
  const result = await pool.query(
    `SELECT sender, message, created_at
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 20`,
    [conversationId]
  );

  // Claude expects messages in chronological order
  return result.rows.reverse();
};

// Retrieve all conversations belonging to a user
export const getUserConversations = async (userId) => {
  const result = await pool.query(
    `SELECT
       c.id,
       c.title,
       c.created_at,
       COUNT(m.id)::int AS message_count
     FROM ai_conversations c
     LEFT JOIN ai_messages m
       ON c.id = m.conversation_id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [userId]
  );

  return result.rows;
};

// Retrieve one conversation and its messages
export const getConversationWithMessages = async (
  conversationId,
  userId
) => {
  const conversation = await getOwnedConversation(
    conversationId,
    userId
  );

  if (!conversation) {
    return null;
  }

  const messages = await pool.query(
    `SELECT id, sender, message, created_at
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC, id ASC`,
    [conversationId]
  );

  return {
    ...conversation,
    messages: messages.rows
  };
};

// Delete a conversation owned by the logged-in user
export const deleteConversation = async (
  conversationId,
  userId
) => {
  const result = await pool.query(
    `DELETE FROM ai_conversations
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [conversationId, userId]
  );

  return result.rowCount > 0;
};
