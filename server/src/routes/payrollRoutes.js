import express from "express";
import {
  getPayrollSettings, updatePayrollSettings, getSalaryProfiles, upsertSalaryProfile,
  getPayrollRuns, generatePayroll, getPayrollRun, adjustPayrollEntry,
  finalizePayroll, markPayrollPaid, getMyPayslips
} from "../controllers/payrollController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = express.Router();
router.get("/settings", protect, requirePermission(PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_MANAGE), getPayrollSettings);
router.put("/settings", protect, requirePermission(PERMISSIONS.PAYROLL_MANAGE), updatePayrollSettings);
router.get("/salary-profiles", protect, requirePermission(PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_MANAGE), getSalaryProfiles);
router.put("/salary-profiles/:employeeId", protect, requirePermission(PERMISSIONS.PAYROLL_MANAGE), upsertSalaryProfile);
router.get("/runs", protect, requirePermission(PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_MANAGE), getPayrollRuns);
router.post("/runs/generate", protect, requirePermission(PERMISSIONS.PAYROLL_MANAGE), generatePayroll);
router.get("/runs/:id", protect, requirePermission(PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_MANAGE), getPayrollRun);
router.put("/entries/:id/adjust", protect, requirePermission(PERMISSIONS.PAYROLL_MANAGE), adjustPayrollEntry);
router.put("/runs/:id/finalize", protect, requirePermission(PERMISSIONS.PAYROLL_MANAGE), finalizePayroll);
router.put("/runs/:id/paid", protect, requirePermission(PERMISSIONS.PAYROLL_MANAGE), markPayrollPaid);
router.get("/me/payslips", protect, requirePermission(PERMISSIONS.PAYROLL_SELF), getMyPayslips);
export default router;
