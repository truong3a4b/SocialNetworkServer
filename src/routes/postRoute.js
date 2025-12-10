import express from "express";
import {
  getPosts,
  getPost,
  getCloudinarySignature,
  createPost,
  editPost,
  deletePost,
  sharePost,
} from "../controllers/postController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getPosts);
router.get("/:id", verifyToken, getPost);
router.get("/signature", verifyToken, getCloudinarySignature);
router.post("/", verifyToken, createPost);
router.put("/:id", verifyToken, editPost);
router.delete("/:id", verifyToken, deletePost);
router.post("/share/:id", verifyToken, sharePost);

export default router;
