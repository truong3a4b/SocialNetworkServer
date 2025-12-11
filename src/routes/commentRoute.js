import express from "express";
import {
  getCommentsByPost,
  getRepliesByComment,
  editComment,
  createComment,
  deleteComment,
} from "../controllers/commentController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, createComment);
router.get("/post/:postId", verifyToken, getCommentsByPost);
router.get("/replies/:commentId", verifyToken, getRepliesByComment);
router.put("/:commentId", verifyToken, editComment);
router.delete("/:commentId", verifyToken, deleteComment);

export default router;
