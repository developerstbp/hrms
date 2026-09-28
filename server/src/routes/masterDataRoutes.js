import express from "express";
import { createMasterData, getMasterData, updateMasterData } from "../controllers/masterDataController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = express.Router();
router.get("/", protect, requirePermission(PERMISSIONS.DEPARTMENTS_VIEW, PERMISSIONS.DEPARTMENTS_MANAGE, PERMISSIONS.EMPLOYEES_MANAGE), getMasterData);
router.post("/", protect, requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE), createMasterData);
router.put("/:id", protect, requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE), updateMasterData);
export default router;
