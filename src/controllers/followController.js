import Follow from "../models/Follow.js";
import User from "../models/User.js";
import { mongoose } from "mongoose";

//follow a user
export const followUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userIdToFollow } = req.body;
    //validate input
    if (!userIdToFollow) {
      return res
        .status(400)
        .json({ message: "User ID to follow is required." });
    }
    const followerId = req.userId;
    if (followerId === userIdToFollow) {
      return res.status(400).json({ message: "You cannot follow yourself." });
    }
    const newFollow = new Follow({
      follower: followerId,
      following: userIdToFollow,
    });

    session.startTransaction();

    await newFollow.save();

    //update follower and following counts
    await Promise.all([
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(userIdToFollow, { $inc: { followerCount: 1 } }),
    ]);

    await session.commitTransaction();
    await session.endSession();

    return res.status(201).json({ message: "Successfully followed the user." });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "You are already following this user." });
    }
    res.status(500).json({ message: "Internal server error." });
  }
};

//unfollow a user
export const unfollowUser = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userIdToUnfollow } = req.body;
    if (!userIdToUnfollow) {
      return res
        .status(400)
        .json({ message: "User ID to unfollow is required." });
    }
    const followerId = req.userId;

    session.startTransaction();

    const deletedFollow = await Follow.findOneAndDelete({
      follower: followerId,
      following: userIdToUnfollow,
    });
    if (!deletedFollow) {
      await session.abortTransaction();
      await session.endSession();

      return res
        .status(404)
        .json({ message: "You are not following this user." });
    }

    //update follower and following counts
    await Promise.all([
      User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } }),
      User.findByIdAndUpdate(userIdToUnfollow, { $inc: { followerCount: -1 } }),
    ]);

    await session.commitTransaction();
    await session.endSession();

    return res
      .status(200)
      .json({ message: "Successfully unfollowed the user." });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    res.status(500).json({ message: "Internal server error." });
    console.log(error);
  }
};

//get followers of a user
export const getFollowers = async (req, res) => {
  try {
    const profileUserId = req.params.userId;
    const userId = req.userId;

    // Check privacy settings
    const profileUser = await User.findById(profileUserId);
    if (profileUserId !== userId && !profileUser.privacy.showFollowers) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view followers." });
    }
    const followers = await Follow.find({ following: profileUserId }).populate(
      "follower",
      "fullName avatar"
    );
    res.status(200).json(followers);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
    console.log(error);
  }
};

//get following of a user
export const getFollowing = async (req, res) => {
  try {
    const profileUserId = req.params.userId;
    const userId = req.userId;

    // Check privacy settings
    const profileUser = await User.findById(profileUserId);
    if (profileUserId !== userId && !profileUser.privacy.showFollowing) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view following." });
    }
    const following = await Follow.find({ follower: profileUserId }).populate(
      "following",
      "fullName avatar"
    );
    res.status(200).json(following);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
    console.log(error);
  }
};
