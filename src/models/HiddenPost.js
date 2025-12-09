import mongoose from "mongoose";

const HiddenPostSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

const HiddenPost = mongoose.model("HiddenPost", HiddenPostSchema);

HiddenPostSchema.index({ user: 1 });

export default HiddenPost;
