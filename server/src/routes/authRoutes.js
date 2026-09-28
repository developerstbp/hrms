import express from "express";
import { registerCompany, loginUser, getMe, changePassword } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();
router.post("/register-company", registerCompany);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);
export default router;
