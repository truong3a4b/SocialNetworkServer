import User from "../models/User.js";
import Session from "../models/Session.js";
import bcrypt from "bcryptjs";
import BrevoProvider from "../config/brevo.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { generateAccessToken, generateRefreshToken } from "../lib/utils.js";
import crypto from "crypto";
import dotenv from "dotenv";
import PendingUser from "../models/PendingUser.js";

dotenv.config();

//Sign up
export const signUp = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: ERROR_CODES.BAD_REQUEST,
        message: "Email and password are required",
      });
    }
    const existingUser = await User.findOne({ email });
    // Check if email already exists
    if (existingUser) {
      return res.status(400).json({
        error: ERROR_CODES.USER_ALREADY_EXISTS,
        message: "Email has been registered",
      });
    }

    //check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
        message: "Invalid email format",
      });
    }
    //check password length
    if (password.length < 6) {
      return res.status(400).json({
        error: ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
        message: "Password must be at least 6 characters",
      });
    }
    //trim email
    const trimmedEmail = email.trim();
    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Generate a 5-digit OTP valid for 5 minutes
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    // Check if email is already in pending users
    const newUser = await PendingUser.findOne({ email });
    if (newUser) {
      newUser.password = hashedPassword;
      newUser.otp = otp;
      newUser.expiredAt = expiredAt;
      await newUser.save();
    } else {
      const newUser = new PendingUser({
        email: trimmedEmail,
        password: hashedPassword,
        otp,
        expiredAt,
      });

      await newUser.save();
    }

    // Send OTP via email
    const to = newUser.email;
    const html = `
      <h3>Your OTP Code</h3>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;
    await BrevoProvider.sendEmail(to, "Verify your email", html);

    res.status(201).json({
      message: "User registered successfully. Please verify your account",
      user: {
        id: newUser._id,
        email: newUser.email,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//Verify email
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        error: ERROR_CODES.FIELD_MISSING,
        message: "Email and OTP are required",
      });
    }

    const trimmedEmail = email.trim();
    const user = await PendingUser.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(404).json({
        error: ERROR_CODES.USER_NOT_FOUND,
        message: "User not found",
      });
    }

    if (user.expiredAt <= new Date()) {
      await PendingUser.findByIdAndDelete(user._id);
      return res.status(400).json({
        error: ERROR_CODES.OTP_EXPIRED,
        message: "OTP has expired. Please request a new one",
      });
    }

    if (user.otp !== String(otp).trim()) {
      return res.status(400).json({
        error: ERROR_CODES.INVALID_OTP,
        message: "Invalid OTP",
      });
    }

    const newUser = new User({
      email: user.email,
      password: user.password,
      isVerified: true,
    });

    await newUser.save();
    await PendingUser.findByIdAndDelete(user._id);

    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//Resend OTP
export const sendOtpVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: ERROR_CODES.FIELD_MISSING,
        message: "Email is required",
      });
    }
    const user = await PendingUser.findOne({ email: email.trim() });
    if (!user) {
      return res.status(400).json({
        error: ERROR_CODES.USER_NOT_FOUND,
        message: "Email not found",
      });
    }

    // Generate a 5-digit OTP valid for 5 minutes
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.expiredAt = expiredAt;
    await user.save();

    // Send OTP via email
    const to = user.email;
    const html = `
      <h3>Your OTP Code</h3>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;
    await BrevoProvider.sendEmail(to, "Verify your email", html);
    res.status(200).json({ message: "OTP resent successfully" });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: ERROR_CODES.FIELD_MISSING,
        message: "Email and password are required",
      });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        error: ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
        message: "Invalid email or password",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        error: ERROR_CODES.INVALID_EMAIL_OR_PASSWORD,
        message: "Invalid email or password",
      });
    }
    if (!user.isVerified) {
      return res.status(400).json({
        error: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: "Please verify your email first",
      });
    }
    //create access token and refresh token
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    //save refresh token to db
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const time = process.env.REFRESH_TOKEN_TTL || "7d";
    await Session.create({
      userId: user._id,
      refreshToken: hashedRefreshToken,
      expiresAt: new Date(Date.now() + parseInt(time) * 24 * 60 * 60 * 1000),
    });
    //gui token ve client
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: parseInt(time) * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        profileCompleted: user.profileCompleted,
      },
      accessToken,
    });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//Logout
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: "No refresh token provided",
      });
    }
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    await Session.findOneAndDelete({ refreshToken: hashedRefreshToken });
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
    console.error(err);
  }
};

//Refresh token
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: "No refresh token provided",
      });
    }
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const session = await Session.findOne({ refreshToken: hashedRefreshToken });
    if (!session) {
      return res.status(401).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: "Invalid refresh token",
      });
    }
    const userId = session.userId;
    const newAccessToken = generateAccessToken(userId);
    res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const profileUserId = req.params.id;
    const user = await User.findById(profileUserId).select(
      "-password -otp -otpExpires -__v"
    );

    if (!user) {
      return res.status(404).json({
        error: ERROR_CODES.USER_NOT_FOUND,
        message: "User not found",
      });
    }

    // Handle privacy settings
    if (userId.toString() !== profileUserId.toString()) {
      if (!user.privacy.showEmail) user.email = undefined;
      if (!user.privacy.showPhone) user.numberPhone = undefined;
      if (!user.privacy.showBirthday) user.birthday = undefined;
      if (!user.privacy.showBio) user.bio = undefined;
      if (!user.privacy.showGenre) user.genre = undefined;
    }
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { fullName, numberPhone, bio, sex, birthday, privacy } = req.body;
    const user = await User.findById(userId).select(
      "-password -otp -otpExpires -__v"
    );
    if (!user) {
      return res.status(404).json({
        error: ERROR_CODES.USER_NOT_FOUND,
        message: "User not found",
      });
    }
    //check fullname not empty
    if (fullName !== undefined) {
      if (fullName.trim() === "") {
        return res.status(400).json({
          error: ERROR_CODES.FIELD_MISSING,
          message: "Full name cannot be empty",
        });
      }
      user.fullName = fullName.trim();
    }
    if (numberPhone !== undefined) user.numberPhone = numberPhone.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (sex !== undefined) user.sex = sex;
    if (birthday !== undefined) user.birthday = birthday;
    if (privacy !== undefined) user.privacy = privacy;

    const avatar = req.files?.avatar ? req.files.avatar[0].path : null;
    if (avatar) {
      user.avatar = avatar;
    }
    user.profileCompleted = true;
    await user.save();
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

//search users
export const searchUsers = async (req, res) => {
  try {
    const { key, page = 1, limit = 10 } = req.query;
    if (!key || key.trim() === "") {
      return res.status(400).json({
        error: ERROR_CODES.FIELD_MISSING,
        message: "Search query is required",
      });
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const regex = new RegExp(key.trim(), "i");

    const total = await User.countDocuments({ fullName: regex });
    const users = await User.find({ fullName: regex })
      .select("_id fullName avatar")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.status(200).json({ total, page: pageNum, limit: limitNum, users });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};
