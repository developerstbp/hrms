import express from "express";

import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  getLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
  cancelLeaveRequest,
  getMyLeaveBalances,
  getEmployeeLeaveBalances,
} from "../controllers/leaveController.js";

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
| Leave Policies
|--------------------------------------------------------------------------
*/

router.get(
  "/types",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_SELF,
    PERMISSIONS.LEAVE_TEAM,
    PERMISSIONS.LEAVE_POLICIES
  ),
  getLeaveTypes
);

router.post(
  "/types",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_POLICIES
  ),
  createLeaveType
);

router.put(
  "/types/:id",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_POLICIES
  ),
  updateLeaveType
);

/*
|--------------------------------------------------------------------------
| My Leave Balance
|--------------------------------------------------------------------------
*/

router.get(
  "/balances/me",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_SELF
  ),
  getMyLeaveBalances
);

router.get(
  "/balances/:employeeId",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_APPROVE
  ),
  getEmployeeLeaveBalances
);

/*
|--------------------------------------------------------------------------
| Leave Requests
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_SELF,
    PERMISSIONS.LEAVE_TEAM,
    PERMISSIONS.LEAVE_APPROVE
  ),
  getLeaveRequests
);

router.post(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_SELF,
    PERMISSIONS.LEAVE_TEAM
  ),
  createLeaveRequest
);

/*
|--------------------------------------------------------------------------
| Review
|--------------------------------------------------------------------------
*/

router.put(
  "/:id/review",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_APPROVE
  ),
  reviewLeaveRequest
);

/*
|--------------------------------------------------------------------------
| Cancel
|--------------------------------------------------------------------------
*/

router.put(
  "/:id/cancel",
  protect,
  requirePermission(
    PERMISSIONS.LEAVE_SELF,
    PERMISSIONS.LEAVE_TEAM
  ),
  cancelLeaveRequest
);

export default router;