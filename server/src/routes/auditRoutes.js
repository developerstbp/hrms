import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
const router = express.Router();
router.get("/", protect, requirePermission(PERMISSIONS.AUDIT_VIEW), getAuditLogs);
export default router;
