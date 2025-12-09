import e from "express";
import mongoose from "mongoose";

const ReactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "love", "haha", "wow", "sad", "angry"],
      required: true,
    },
  },
  { timestamps: true }
);

ReactionSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.model("Reaction", ReactionSchema);
