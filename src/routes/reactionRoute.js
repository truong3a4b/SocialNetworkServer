import express from "express";
import {
  getReactionsByPost,
  createReaction,
  deleteReaction,
} from "../controllers/reactionController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/post/:targetId", verifyToken, getReactionsByPost);
router.post("/", verifyToken, createReaction);
router.delete("/:targetId", verifyToken, deleteReaction);

export default router;
