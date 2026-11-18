import express from "express";

import {
  createResource,
  createRule,
  getResources,
  getRules,
  updateResource,
  updateRule
} from "../controllers/resourceController.js";

import {
  authenticateToken,
  authorizeRoles,
  ADMIN_ROLES
} from "../middleware/authMiddleware.js";

// Halls and rooms (/api/resources) and the Temple Rules (/api/rules).
export const resourceRouter = express.Router();
resourceRouter.use(authenticateToken);
resourceRouter.get("/", getResources);
resourceRouter.post("/", authorizeRoles("chairman"), createResource);
resourceRouter.put("/:id", authorizeRoles("chairman"), updateResource);

export const ruleRouter = express.Router();
ruleRouter.use(authenticateToken);
ruleRouter.get("/", getRules);
ruleRouter.post("/", authorizeRoles(...ADMIN_ROLES), createRule);
ruleRouter.put("/:id", authorizeRoles(...ADMIN_ROLES), updateRule);
