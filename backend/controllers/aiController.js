
import pool from "../config/db.js";
import { askClaude } from "../services/claudeService.js";
import {
  createConversation,
  getOwnedConversation,
  saveMessage,
  getConversationHistory,
  getUserConversations,
  getConversationWithMessages,
  deleteConversation
} from "../services/conversationService.js";
// AI assistant

export const chatWithAI = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a question"
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Question must be under 2000 characters"
      });
    }

    const userId = req.user.id;
    const isManagement =
      ["chairman", "committee"].includes(req.user.role);

    let conversation;

    // Create a new conversation when no ID is supplied
    if (conversationId === undefined || conversationId === null) {
      conversation = await createConversation(
        userId,
        message.trim().slice(0, 60)
      );
    } else {
      const id = Number(conversationId);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversation ID"
        });
      }

      conversation = await getOwnedConversation(id, userId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found"
        });
      }
    }

    // Retrieve previous messages before saving the new question
    const history = await getConversationHistory(conversation.id);

    // Get operational information from the database
    let taskQuery = `
      SELECT title, priority, status, due_at
      FROM tasks
    `;

    let attendanceQuery = `
      SELECT attendance_date, status, check_in, check_out
      FROM attendance
    `;

    let bookingQuery = `
      SELECT booking_type, resource_name, event_title,
             start_at, end_at, status
      FROM bookings
    `;

    const taskValues = [];
    const attendanceValues = [];
    const bookingValues = [];

    // Staff and volunteers can access only their own records
    if (!isManagement) {
      taskValues.push(userId);
      taskQuery += " WHERE assigned_to = $1";

      attendanceValues.push(userId);
      attendanceQuery += " WHERE user_id = $1";

      bookingValues.push(userId);
      bookingQuery += " WHERE booked_by = $1";
    }

    taskQuery += " ORDER BY created_at DESC LIMIT 30";
    attendanceQuery += " ORDER BY attendance_date DESC LIMIT 15";
    bookingQuery += " ORDER BY start_at DESC LIMIT 15";

    const [tasks, attendance, bookings] = await Promise.all([
      pool.query(taskQuery, taskValues),
      pool.query(attendanceQuery, attendanceValues),
      pool.query(bookingQuery, bookingValues)
    ]);

    const context = JSON.stringify({
      userRole: req.user.role,
      tasks: tasks.rows,
      attendance: attendance.rows,
      bookings: bookings.rows
    });

    // Save the user's message
    await saveMessage(
      conversation.id,
      "user",
      message.trim()
    );

    // Ask Claude using previous conversation history
    const answer = await askClaude(
      message.trim(),
      context,
      history
    );

    // Save Claude's response
    await saveMessage(
      conversation.id,
      "assistant",
      answer
    );

    res.json({
      success: true,
      conversationId: conversation.id,
      answer
    });

  } catch (error) {
    console.error("AI assistant error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to get an AI response. Please try again."
    });
  }
};

// Create a new AI conversation
export const createAIConversation = async (req, res) => {
  try {
    const conversation = await createConversation(
      req.user.id,
      "New conversation"
    );

    res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      conversation
    });

  } catch (error) {
    console.error("Create conversation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create conversation"
    });
  }
};

// Get all conversations belonging to the logged-in user
export const getAIConversations = async (req, res) => {
  try {
    const conversations = await getUserConversations(req.user.id);

    res.json({
      success: true,
      count: conversations.length,
      conversations
    });

  } catch (error) {
    console.error("Get conversations error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve conversations"
    });
  }
};

// Get one conversation with its messages
export const getAIConversation = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    const conversation = await getConversationWithMessages(
      id,
      req.user.id
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    res.json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error("Get conversation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve conversation"
    });
  }
};

// Delete one conversation belonging to the logged-in user
export const deleteAIConversation = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    const deleted = await deleteConversation(id, req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    res.json({
      success: true,
      message: "Conversation deleted successfully"
    });

  } catch (error) {
    console.error("Delete conversation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete conversation"
    });
  }
};

// Daily operational summary
export const getDailySummary = async (req, res) => {
  try {
    if (!["chairman", "committee"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Chairman and Committee can view the overall daily summary"
      });
    }

    const [tasks, attendance, bookings] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM tasks
        WHERE created_at::date = CURRENT_DATE
        GROUP BY status
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM attendance
        WHERE attendance_date = CURRENT_DATE
        GROUP BY status
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM bookings
        WHERE start_at::date = CURRENT_DATE
        GROUP BY status
      `)
    ]);

    const context = JSON.stringify({
      date: new Date().toISOString(),
      tasks: tasks.rows,
      attendance: attendance.rows,
      bookings: bookings.rows
    });

    const answer = await askClaude(
  "Give me a temple operations overview summary",
  context
);

    res.json({
      success: true,
      summary: answer,
      data: {
        tasks: tasks.rows,
        attendance: attendance.rows,
        bookings: bookings.rows
      }
    });
  } catch (error) {
    console.error("Daily summary error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to generate daily summary"
    });
  }
};

// Pending and overdue task recommendations
export const getTaskRecommendations = async (req, res) => {
  try {
    if (!["chairman", "committee"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only Chairman and Committee can view overall task recommendations"
      });
    }

    const result = await pool.query(`
      SELECT t.id, t.title, t.description, t.priority,
             t.status, t.due_at,
             u.full_name AS assigned_staff
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.status NOT IN ('approved', 'closed')
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        t.due_at ASC NULLS LAST
      LIMIT 50
    `);

    const answer = await askClaude(
  "Recommend which tasks need attention and priority",
  { tasks: result.rows }
);

    res.json({
      success: true,
      recommendations: answer,
      pendingTaskCount: result.rowCount
    });
  } catch (error) {
    console.error("Task recommendation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to generate task recommendations"
    });
  }
};
