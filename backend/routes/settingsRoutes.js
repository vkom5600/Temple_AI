import express from "express";

import { getSignupWindowSettings, listSettings, updateSetting, updateSignupWindow } from "../controllers/settingsController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// P4 sign-up window: committee can see it; only the chairman changes it
router.get("/signup-window", authorizeRoles(...ADMIN_ROLES), getSignupWindowSettings);
router.put("/signup-window", authorizeRoles("chairman"), updateSignupWindow);

router.use(authorizeRoles("chairman"));
router.get("/", listSettings);
router.put("/:key", updateSetting);

export default router;
