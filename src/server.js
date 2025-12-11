import express from "express";
import cors from "cors";
import morgan from "morgan";
import userRoutes from "./routes/userRoute.js";
import followRoutes from "./routes/followRoute.js";
import postRoutes from "./routes/postRoute.js";
import reactionRoutes from "./routes/reactionRoute.js";
import commentRoutes from "./routes/commentRoute.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/reactions", reactionRoutes);
app.use("/api/comments", commentRoutes);

const PORT = process.env.PORT || 8080;

connectDB();

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}/api/`);
});
