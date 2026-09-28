import express from "express";

import {
  getAttendance,
  getToday,
  checkIn,
  checkOut,
  markAttendance,
  previewAttendanceImport,
  importAttendance,
  getImportBatches,
  processAttendance,
  getExceptions,
  resolveException,
} from "../controllers/attendanceController.js";

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
| Employee Self Attendance
|--------------------------------------------------------------------------
*/

router.get(
  "/today",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_SELF
  ),
  getToday
);

router.post(
  "/check-in",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_SELF
  ),
  checkIn
);

router.post(
  "/check-out",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_SELF
  ),
  checkOut
);

/*
|--------------------------------------------------------------------------
| Exceptions
|--------------------------------------------------------------------------
*/

router.get(
  "/exceptions",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  getExceptions
);

router.put(
  "/exceptions/:id/resolve",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  resolveException
);

/*
|--------------------------------------------------------------------------
| Excel Import
|--------------------------------------------------------------------------
*/

router.get(
  "/imports",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  getImportBatches
);

router.post(
  "/import/preview",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  previewAttendanceImport
);

router.post(
  "/import",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  importAttendance
);

/*
|--------------------------------------------------------------------------
| Process Attendance
|--------------------------------------------------------------------------
*/

router.post(
  "/process",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  processAttendance
);

/*
|--------------------------------------------------------------------------
| Final Attendance Records
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_SELF,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  getAttendance
);

/*
|--------------------------------------------------------------------------
| Manual Correction
|--------------------------------------------------------------------------
*/

router.post(
  "/manual",
  protect,
  requirePermission(
    PERMISSIONS.ATTENDANCE_MANAGE
  ),
  markAttendance
);

export default router;