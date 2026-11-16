import express from "express";

import { listSettings, updateSetting } from "../controllers/settingsController.js";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken, authorizeRoles("chairman"));

router.get("/", listSettings);
router.put("/:key", updateSetting);

export default router;
