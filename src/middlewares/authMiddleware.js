import jwt from "jsonwebtoken";
import { ERROR_CODES } from "../lib/errorCodes.js";
import User from "../models/User.js";

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: "Unauthorized",
      });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          error: ERROR_CODES.UNAUTHORIZED,
          message: "Invalid token",
        });
      }
      req.userId = decoded.id;
      next();
    });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};

export const verifyAdmin = (req, res, next) => {
  try {
    const userId = req.userId;
    User.findById(userId).then((user) => {
      if (!user || user.role !== "Admin") {
        return res.status(403).json({
          error: ERROR_CODES.FORBIDDEN,
          message: "Forbidden: Admins only",
        });
      } else {
        next();
      }
    });
  } catch (err) {
    res.status(500).json({
      error: ERROR_CODES.SERVER_ERROR,
      message: "Internal server error",
    });
    console.error(err);
  }
};
