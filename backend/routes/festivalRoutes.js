import express from "express";
import { create, home, list, remove, snooze, update } from "../controllers/festivalController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

// H2 festival days. Everyone can see them; the committee keeps the list.
const router = express.Router();
router.use(authenticateToken);
router.get("/", list);
router.get("/home", authorizeRoles(...ADMIN_ROLES), home);
router.post("/", authorizeRoles(...ADMIN_ROLES), create);
router.put("/:id", authorizeRoles(...ADMIN_ROLES), update);
router.delete("/:id", authorizeRoles(...ADMIN_ROLES), remove);
router.post("/:id/snooze", authorizeRoles(...ADMIN_ROLES), snooze);
export default router;
