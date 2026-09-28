import express from "express";
import {
  getShifts, createShift, updateShift, getAssignments, getMyShift, assignShift,
  createShiftChangeRequest, getShiftChangeRequests, reviewShiftChangeRequest, cancelShiftChangeRequest
} from "../controllers/shiftController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = express.Router();
router.get("/", protect, requirePermission(PERMISSIONS.SHIFT_SELF, PERMISSIONS.SHIFT_TEAM, PERMISSIONS.SHIFT_MANAGE), getShifts);
router.post("/", protect, requirePermission(PERMISSIONS.SHIFT_MANAGE), createShift);
router.put("/:id", protect, requirePermission(PERMISSIONS.SHIFT_MANAGE), updateShift);
router.get("/assignments/list", protect, requirePermission(PERMISSIONS.SHIFT_SELF, PERMISSIONS.SHIFT_TEAM, PERMISSIONS.SHIFT_MANAGE), getAssignments);
router.get("/me/current", protect, requirePermission(PERMISSIONS.SHIFT_SELF), getMyShift);
router.post("/assignments", protect, requirePermission(PERMISSIONS.SHIFT_MANAGE), assignShift);
router.get("/requests/list", protect, requirePermission(PERMISSIONS.SHIFT_SELF, PERMISSIONS.SHIFT_TEAM, PERMISSIONS.SHIFT_MANAGE), getShiftChangeRequests);
router.post("/requests", protect, requirePermission(PERMISSIONS.SHIFT_SELF), createShiftChangeRequest);
router.put("/requests/:id/review", protect, requirePermission(PERMISSIONS.SHIFT_MANAGE), reviewShiftChangeRequest);
router.put("/requests/:id/cancel", protect, requirePermission(PERMISSIONS.SHIFT_SELF), cancelShiftChangeRequest);
export default router;
