import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
const router = express.Router();
router.get("/", protect, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDashboard);
export default router;
