
import express from "express";

import {
  chatWithAI,
  getDailySummary,
  getTaskRecommendations,
  createAIConversation,
  getAIConversations,
  getAIConversation,
  deleteAIConversation
} from "../controllers/aiController.js";

import {
  authenticateToken,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// AI conversation history
router.post("/conversations", createAIConversation);
router.get("/conversations", getAIConversations);
router.get("/conversations/:id", getAIConversation);
router.delete("/conversations/:id", deleteAIConversation);

// AI assistant
router.post("/chat", chatWithAI);

// Overall daily summary
router.get(
  "/daily-summary",
  authorizeRoles("chairman", "committee"),
  getDailySummary
);

// Overall task recommendations
router.get(
  "/task-recommendations",
  authorizeRoles("chairman", "committee"),
  getTaskRecommendations
);

export default router;
