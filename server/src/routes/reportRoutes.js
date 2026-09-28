import express from "express";

import {
  getHeadcountReport,
  getAttendanceReport,
  getLeaveReport,
  getMovementReport,
} from "../controllers/reportController.js";

import {
  protect,
  requirePermission,
} from "../middleware/authMiddleware.js";

import {
  PERMISSIONS,
} from "../constants/permissions.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Reports
|--------------------------------------------------------------------------
*/

router.get(
  "/headcount",
  protect,
  requirePermission(
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE
  ),
  getHeadcountReport
);

router.get(
  "/attendance",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  getAttendanceReport
);

router.get(
  "/leave",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_TEAM,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_POLICIES
  ),
  getLeaveReport
);

router.get(
  "/movements",
  protect,
  requirePermission(
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE
  ),
  getMovementReport
);

export default router;