import express from "express";

import {
  getHolidays,
  getWorkCalendar,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getWorkCalendarPolicies,
  createWorkCalendarPolicy,
  deleteWorkCalendarPolicy,
} from "../controllers/holidayController.js";

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
| Monthly Work Calendar
|--------------------------------------------------------------------------
*/

router.get(
  "/calendar",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_VIEW,
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  getWorkCalendar
);

/*
|--------------------------------------------------------------------------
| Weekly Work Schedule / Policies
|--------------------------------------------------------------------------
*/

router.get(
  "/policies",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_VIEW,
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  getWorkCalendarPolicies
);

router.post(
  "/policies",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  createWorkCalendarPolicy
);

router.delete(
  "/policies/:id",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  deleteWorkCalendarPolicy
);

/*
|--------------------------------------------------------------------------
| Individual Calendar Dates
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_VIEW,
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  getHolidays
);

router.post(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  createHoliday
);

router.put(
  "/:id",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  updateHoliday
);

router.delete(
  "/:id",
  protect,
  requirePermission(
    PERMISSIONS.HOLIDAYS_MANAGE
  ),
  deleteHoliday
);

export default router;