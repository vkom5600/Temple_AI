import express from "express";
import { answer, ask, list, mine, seen } from "../controllers/questionController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";
import { requireAccess } from "../middleware/access.js";

// M6 Ask a question
const router = express.Router();
router.use(authenticateToken);
router.post("/", authorizeRoles("staff", "volunteer"), ask);
router.get("/mine", mine);
router.patch("/:id/seen", seen);
router.get("/", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "view"), list);
router.post("/:id/answer", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "manage"), answer);
export default router;
