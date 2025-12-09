import mongoose from "mongoose";

const FollowSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure a user cannot follow the same user more than once
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

const Follow = mongoose.model("Follow", FollowSchema);

export default Follow;
