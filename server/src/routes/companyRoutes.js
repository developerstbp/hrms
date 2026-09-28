import express from "express";

import {
  getCompany,
  updateCompany,
  testCompanyEmail,
} from "../controllers/companyController.js";

import {
  protect,
  requirePermission,
} from "../middleware/authMiddleware.js";

import {
  PERMISSIONS,
} from "../constants/permissions.js";

const router =
  express.Router();

router.get(
  "/",
  protect,
  getCompany
);

router.put(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.COMPANY_SETTINGS
  ),
  updateCompany
);

router.post(
  "/email/test",
  protect,
  requirePermission(
    PERMISSIONS.COMPANY_SETTINGS
  ),
  testCompanyEmail
);

export default router;