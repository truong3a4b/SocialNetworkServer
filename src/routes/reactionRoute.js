import express from "express";
import {
  getReactionsByPost,
  createReaction,
  deleteReaction,
} from "../controllers/reactionController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/:postId", verifyToken, getReactionsByPost);
router.post("/", verifyToken, createReaction);
router.delete("/:postId", verifyToken, deleteReaction);

export default router;
