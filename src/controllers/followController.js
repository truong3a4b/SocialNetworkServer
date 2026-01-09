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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check privacy settings
    const profileUser = await User.findById(profileUserId);
    if (!profileUser) {
      return res.status(404).json({ message: "User not found." });
    }
    if (
      profileUserId.toString() !== userId.toString() &&
      !profileUser.privacy.showFollowers
    ) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view followers." });
    }
    const total = await Follow.countDocuments({ following: profileUserId });

    const followers = await Follow.find({ following: profileUserId })
      .populate("follower", "fullName avatar")
      .skip(skip)
      .limit(limit)
      .lean();

    const followerIds = followers
      .map((follow) => follow.follower?._id?.toString())
      .filter(Boolean);

    let followedSet = new Set();
    if (followerIds.length) {
      const followedRecords = await Follow.find({
        follower: userId,
        following: { $in: followerIds },
      })
        .select("following")
        .lean();
      followedSet = new Set(
        followedRecords.map((record) => record.following.toString())
      );
    }

    const followersWithFlag = followers.map((follow) => ({
      ...follow,
      follower: follow.follower
        ? {
            ...follow.follower,
            isFollowed: followedSet.has(follow.follower?._id?.toString()),
          }
        : follow.follower,
    }));

    res.status(200).json({
      total,
      page,
      limit,
      followers: followersWithFlag,
    });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check privacy settings
    const profileUser = await User.findById(profileUserId);
    if (!profileUser) {
      return res.status(404).json({ message: "User not found." });
    }
    if (
      profileUserId.toString() !== userId.toString() &&
      !profileUser.privacy.showFollowing
    ) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view following." });
    }
    const total = await Follow.countDocuments({ follower: profileUserId });

    const following = await Follow.find({ follower: profileUserId })
      .populate("following", "fullName avatar")
      .skip(skip)
      .limit(limit)
      .lean();

    const followingIds = following
      .map((follow) => follow.following?._id?.toString())
      .filter(Boolean);

    let followedSet = new Set();
    if (followingIds.length) {
      const followedRecords = await Follow.find({
        follower: userId,
        following: { $in: followingIds },
      })
        .select("following")
        .lean();
      followedSet = new Set(
        followedRecords.map((record) => record.following.toString())
      );
    }

    const followingWithFlag = following.map((follow) => ({
      ...follow,
      following: follow.following
        ? {
            ...follow.following,
            isFollowed: followedSet.has(follow.following?._id?.toString()),
          }
        : follow.following,
    }));

    res.status(200).json({
      total,
      page,
      limit,
      following: followingWithFlag,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
    console.log(error);
  }
};

//get follow suggestions for current user
export const getFollowSuggestions = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;

    const followedRecords = await Follow.find({ follower: userId })
      .select("following")
      .lean();

    const excludedIds = followedRecords
      .map((record) => record.following?.toString())
      .filter(Boolean);
    excludedIds.push(userId.toString());

    const suggestions = await User.find({ _id: { $nin: excludedIds } })
      .sort({ followerCount: -1 })
      .limit(limit)
      .select("fullName avatar followerCount")
      .lean();

    const suggestionsWithFlag = suggestions.map((user) => ({
      ...user,
      isFollowed: false,
    }));

    res.status(200).json({ suggestions: suggestionsWithFlag, limit });
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
    console.log(error);
  }
};
