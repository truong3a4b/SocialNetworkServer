import mongoose from "mongoose";

const pendingUser = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    otp: {
      type: String,
      required: true,
    },
    expiredAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

pendingUser.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PendingUser", pendingUser);
