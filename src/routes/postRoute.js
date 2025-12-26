import express from "express";
import {
  getPosts,
  getProfilePosts,
  getPost,
  getCloudinarySignature,
  createPost,
  editPost,
  deletePost,
  sharePost,
} from "../controllers/postController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(verifyToken);

router.get("/feed", getPosts);
router.get("/profile/:id", getProfilePosts);
router.get("/:id", getPost);
router.get("/upload/signature", getCloudinarySignature);
router.post("/", createPost);
router.put("/:id", editPost);
router.delete("/:id", deletePost);
router.post("/share/:id", sharePost);

export default router;
