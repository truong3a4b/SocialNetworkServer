import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import {
  signUp,
  verifyOtp,
  login,
  logout,
  resendOtp,
  refreshToken,
  getUserProfile,
  updateUserProfile,
  searchUsers,
} from "../controllers/userController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.post("/signup", signUp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/logout", verifyToken, logout);
router.post("/resend-otp", resendOtp);
router.post("/refresh-token", refreshToken);
router.get("/profile/:id", verifyToken, getUserProfile);
router.put(
  "/profile",
  verifyToken,
  upload.fields([{ name: "avatar", maxCount: 1 }]),
  updateUserProfile
);
router.get("/search", verifyToken, searchUsers);

export default router;
