import express from "express";
import { requireAccess, requireFlag } from "../middleware/access.js";

import { getSignupWindowSettings, listSettings, updateSetting, updateSignupWindow } from "../controllers/settingsController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// P4 sign-up window: committee can see it; only the chairman changes it
router.get("/signup-window", authorizeRoles(...ADMIN_ROLES), requireAccess("people", "view"), getSignupWindowSettings);
router.put("/signup-window", authorizeRoles(...ADMIN_ROLES), requireAccess("people", "manage"), updateSignupWindow);

router.use(authorizeRoles("chairman"));
router.get("/", listSettings);
router.put("/:key", updateSetting);

export default router;
