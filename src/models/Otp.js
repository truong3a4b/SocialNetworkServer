import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["VERIFY_ACCOUNT", "RESET_PASSWORD"],
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

otpSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);
