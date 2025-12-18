import e from "express";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "User" },
    email: { type: String, required: true, unique: true, trim: true },
    numberPhone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    avatar: {
      type: String,
      default:
        "https://res.cloudinary.com/dtcdt4dcw/image/upload/v1765218195/social_media_app/693703f96993d2e4b700c6ad_avatar.jpg",
    },
    bio: { type: String },
    sex: { type: String, enum: ["Male", "Female", "Other"] },
    birthday: { type: Date },
    profileCompleted: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["User", "Admin"], default: "User" },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showBirthday: { type: Boolean, default: true },
      showBio: { type: Boolean, default: true },
      showGenre: { type: Boolean, default: true },
      showFollowers: { type: Boolean, default: true },
      showFollowing: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

//index
userSchema.index({ fullName: "text" });

export default mongoose.model("User", userSchema);
