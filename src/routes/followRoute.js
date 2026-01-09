import express from "express";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowSuggestions,
} from "../controllers/followController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/follow", verifyToken, followUser);
router.post("/unfollow", verifyToken, unfollowUser);
router.get("/followers/:userId", verifyToken, getFollowers);
router.get("/following/:userId", verifyToken, getFollowing);
router.get("/suggestions", verifyToken, getFollowSuggestions);

export default router;
