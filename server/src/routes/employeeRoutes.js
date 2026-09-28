import express from "express";

import {
  createEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  bulkUpdateEmployees,
  previewEmployeeImport,
  commitEmployeeImport,
  getEmployeeJobHistory,
  getMyProfile,
  updateMyProfile
} from "../controllers/employeesController.js";

import {
  getEmployeeLifecycle,
  performLifecycleAction
} from "../controllers/employeeLifecycleController.js";

import {
  protect,
  requirePermission
} from "../middleware/authMiddleware.js";

import {
  PERMISSIONS
} from "../constants/permissions.js";

const router =
  express.Router();

router.get(
  "/me",
  protect,
  getMyProfile
);

router.put(
  "/me",
  protect,
  updateMyProfile
);

/*
|--------------------------------------------------------------------------
| Bulk
|--------------------------------------------------------------------------
*/

router.post(
  "/bulk-update",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  bulkUpdateEmployees
);

/*
|--------------------------------------------------------------------------
| Excel Import
|--------------------------------------------------------------------------
*/

router.post(
  "/import/preview",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  previewEmployeeImport
);

router.post(
  "/import/commit",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  commitEmployeeImport
);

/*
|--------------------------------------------------------------------------
| Employee List
|--------------------------------------------------------------------------
*/

router.get(
  "/",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.LEAVE_TEAM,
    PERMISSIONS.ATTENDANCE_VIEW
  ),

  getEmployees
);

router.post(
  "/",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  createEmployee
);

/*
|--------------------------------------------------------------------------
| Lifecycle
|--------------------------------------------------------------------------
|
| Keep these before /:id.
|
*/

router.get(
  "/:id/lifecycle",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  getEmployeeLifecycle
);

router.post(
  "/:id/lifecycle/actions",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  performLifecycleAction
);

/*
|--------------------------------------------------------------------------
| Job History
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/history",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  getEmployeeJobHistory
);

/*
|--------------------------------------------------------------------------
| Individual Employee
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  getEmployee
);

router.put(
  "/:id",

  protect,

  requirePermission(
    PERMISSIONS.EMPLOYEES_MANAGE
  ),

  updateEmployee
);

export default router;