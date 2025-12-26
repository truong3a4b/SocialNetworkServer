import { mongoose } from "mongoose";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";

// Create a new comment
export const createComment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { postId, content, parentComment } = req.body;
    if (!postId || !content) {
      return res
        .status(400)
        .json({ message: "postId and content are required" });
    }
    session.startTransaction();
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(404).json({ message: "Parent comment not found" });
      } else if (parent.post.toString() !== postId) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          message: "Parent comment does not belong to the specified post",
        });
      } else {
        parent.replyCount += 1;
        await parent.save();
      }
    }

    const newComment = new Comment({
      post: postId,
      content,
      user: req.userId,
      parentComment,
    });

    await newComment.save();
    await newComment.populate("user", "fullName avatar");
    //increment comment count in Post model
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    await session.commitTransaction();
    await session.endSession();
    res.status(201).json({ ...newComment, isOwner: true, userReaction: null });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    await session.endSession();
    res.status(500).json({ message: "Internal Server Error", error });
    console.error("Error creating comment:", error);
  }
};

// Get comments for a post
export const getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const comments = await Comment.aggregate([
      {
        $match: {
          post: new mongoose.Types.ObjectId(postId),
          parentComment: null,
        },
      },
      //mark owner comments
      {
        $addFields: {
          isOwner: {
            $cond: [
              { $eq: ["$user", new mongoose.Types.ObjectId(userId)] },
              true,
              false,
            ],
          },
        },
      },
      //sort
      { $sort: { isOwner: -1, totalReactions: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      //lookup user details
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
          pipeline: [
            {
              $project: { fullName: 1, avatar: 1 },
            },
          ],
        },
      },
      { $unwind: "$user" },
      //is reacted by current user
      {
        $lookup: {
          from: "reactions",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$targetId", "$$commentId"] },
                    { $eq: ["$user", new mongoose.Types.ObjectId(userId)] },
                    { $eq: ["$targetType", "Comment"] },
                  ],
                },
              },
            },
          ],
          as: "userReaction",
        },
      },
      {
        $addFields: {
          userReaction: {
            $cond: [
              { $gt: [{ $size: "$userReaction" }, 0] },
              { $arrayElemAt: ["$userReaction.type", 0] },
              null,
            ],
          },
        },
      },
    ]);

    res.status(200).json({ comments });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
    console.error("Error fetching comments:", error);
  }
};

//get reply comments
export const getRepliesByComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const comment = await Comment.aggregate([
      { $match: { parentComment: new mongoose.Types.ObjectId(commentId) } },
      //user details
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
          pipeline: [
            {
              $project: { fullName: 1, avatar: 1 },
            },
          ],
        },
      },
      { $unwind: "$user" },
      //mark owner comments
      {
        $addFields: {
          isOwner: {
            $cond: [
              { $eq: ["$user", new mongoose.Types.ObjectId(userId)] },
              true,
              false,
            ],
          },
        },
      },
      //is reacted by current user
      {
        $lookup: {
          from: "reactions",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$targetId", "$$commentId"] },
                    { $eq: ["$user", new mongoose.Types.ObjectId(userId)] },
                    { $eq: ["$targetType", "Comment"] },
                  ],
                },
              },
            },
          ],
          as: "userReaction",
        },
      },
      {
        $addFields: {
          userReaction: {
            $cond: [
              { $gt: [{ $size: "$userReaction" }, 0] },
              { $arrayElemAt: ["$userReaction.type", 0] },
              null,
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);
    res.status(200).json(comment);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
    console.error("Error fetching reply comments:", error);
  }
};

//delete a comment
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;
    const comment = await Comment.findOneAndUpdate(
      { _id: commentId, user: userId, isDeleted: false },
      { isDeleted: true, content: "This comment has been deleted" },
      { new: true }
    );
    if (comment) {
      res.status(200).json({ message: "Comment deleted successfully" });
    } else {
      res.status(404).json({ message: "Comment not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
    console.error("Error deleting comment:", error);
  }
};

// Edit a comment
export const editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    const updatedComment = await Comment.findOneAndUpdate(
      { _id: commentId, user: userId, isDeleted: false },
      { content },
      { new: true }
    );
    if (updatedComment) {
      res.status(200).json(updatedComment);
    } else {
      res.status(404).json({ message: "Comment not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
    console.error("Error editing comment:", error);
  }
};
