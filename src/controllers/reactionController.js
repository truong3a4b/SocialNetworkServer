import Reaction from "../models/Reaction.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import { mongoose } from "mongoose";

// Create a new reaction
export const createReaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { targetType, targetId, type } = req.body;
    const userId = req.userId;

    if (!targetType || !targetId || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    //find the target model
    if (targetType == "Post") {
      const post = await Post.findById(targetId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
    } else if (targetType == "Comment") {
      const comment = await Comment.findById(targetId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
    } else {
      return res.status(400).json({ message: "Invalid targetType" });
    }

    session.startTransaction();

    // Check if the reaction already exists
    let reaction = await Reaction.findOne({
      targetId,
      user: userId,
    });
    if (reaction) {
      if (reaction.type !== type) {
        // Update reaction counts in Post or Comment model
        if (targetType === "Post") {
          await Post.findByIdAndUpdate(targetId, {
            $inc: {
              [`reactionCounts.${reaction.type}`]: -1,
              [`reactionCounts.${type}`]: 1,
            },
          });
        } else if (targetType === "Comment") {
          await Comment.findByIdAndUpdate(targetId, {
            $inc: {
              [`reactionCounts.${reaction.type}`]: -1,
              [`reactionCounts.${type}`]: 1,
            },
          });
        }
      }
      // Update existing reaction
      reaction.type = type;
    } else {
      // Create new reaction
      reaction = new Reaction({ targetType, targetId, user: userId, type });
      // Increment reaction count in Post model
      if (targetType === "Post") {
        await Post.findByIdAndUpdate(targetId, {
          $inc: { [`reactionCounts.${type}`]: 1, totalReactions: 1 },
        });
      } else if (targetType === "Comment") {
        // Handle comment reaction count increment
        await Comment.findByIdAndUpdate(targetId, {
          $inc: { [`reactionCounts.${type}`]: 1, totalReactions: 1 },
        });
      }
    }
    await reaction.save();

    await session.commitTransaction();
    await session.endSession();

    res.status(200).json({ message: "Reaction saved successfully", reaction });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Invalid value for field", error: "ValidationError" });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get reactions for a post
export const getReactionsByPost = async (req, res) => {
  try {
    const { targetId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    const filter = { targetId };
    if (type) {
      filter.type = type;
    }
    const reactions = await Reaction.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("user", "fullName avatar");
    res.status(200).json({ reactions, page, limit });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Delete a reaction
export const deleteReaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { targetId } = req.params;
    const userId = req.userId;

    const reaction = await Reaction.findOneAndDelete({
      targetId,
      user: userId,
    });
    if (reaction) {
      if (reaction.targetType === "Post") {
        // Decrement reaction count in Post model
        await Post.findByIdAndUpdate(targetId, {
          $inc: { [`reactionCounts.${reaction.type}`]: -1, totalReactions: -1 },
        });
      } else if (reaction.targetType === "Comment") {
        // Handle comment reaction count decrement
        await Comment.findByIdAndUpdate(targetId, {
          $inc: { [`reactionCounts.${reaction.type}`]: -1, totalReactions: -1 },
        });
      }
      await session.commitTransaction();
      await session.endSession();
      res.status(200).json({ message: "Reaction deleted successfully" });
    } else {
      await session.abortTransaction();
      await session.endSession();
      res.status(404).json({ message: "Reaction not found" });
    }
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    res.status(500).json({ message: "Internal server error" });
    console.error(error);
  }
};
