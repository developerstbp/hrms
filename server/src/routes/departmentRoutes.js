import express from "express";
import { createDepartment, getDepartments, updateDepartment } from "../controllers/departmentController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
const router = express.Router();
router.get("/", protect, requirePermission(PERMISSIONS.DEPARTMENTS_VIEW, PERMISSIONS.DEPARTMENTS_MANAGE), getDepartments);
router.post("/", protect, requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE), createDepartment);
router.put("/:id", protect, requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE), updateDepartment);
export default router;
