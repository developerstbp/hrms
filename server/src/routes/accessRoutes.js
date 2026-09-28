import express from "express";
import { getAccessUsers, updateUserAccess, resetUserPassword } from "../controllers/accessController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
const router = express.Router();
router.get("/", protect, adminOnly, getAccessUsers);
router.put("/:id", protect, adminOnly, updateUserAccess);
router.put("/:id/reset-password", protect, adminOnly, resetUserPassword);
export default router;
