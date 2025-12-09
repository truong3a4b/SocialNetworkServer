import { mongoose } from "mongoose";
import Post from "../models/Post.js";
import Follow from "../models/Follow.js";
import HiddenPost from "../models/HiddenPost.js";

//get posts
export const getPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    //get list of following ids and hidden post ids
    const [following, hiddenPosts] = await Promise.all([
      Follow.find({ follower: userId }).select("following").lean(),
      HiddenPost.find({ user: userId }).select("post").lean(),
    ]);

    const followingIds = following.map((f) => f.following);
    const hiddenPostIds = hiddenPosts.map((hp) => hp.post);

    //fetch posts
    const posts = await Post.aggregate([
      //exclude hidden posts
      {
        $match: {
          _id: { $nin: hiddenPostIds },
          $or: [
            { privacy: "public" },
            { author: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },

      //lookup reactions
      {
        $lookup: {
          from: "reactions",
          let: { postId: "$_id", userId: new mongoose.Types.ObjectId(userId) },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$post", "$$postId"] },
                    { $eq: ["$user", "$$userId"] },
                  ],
                },
              },
            },
          ],
          as: "userReactions",
        },
      },
      {
        $addFields: {
          isLiked: { $gt: [{ $size: "$userReactions" }, 0] },
        },
      },
      //calculate score for sorting
      {
        $addFields: {
          score: {
            $add: [
              {
                $cond: [{ $in: ["$author", followingIds] }, 4, 0],
              },
              {
                $cond: [
                  {
                    $gte: ["$reactionCounts.like", 100],
                  },
                  3,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $gte: [
                      "$createdAt",
                      new Date(Date.now() - 24 * 60 * 60 * 1000),
                    ],
                  },
                  2,
                  0,
                ],
              },
              { $floor: { $multiply: [{ $rand: {} }, 2] } }, //0 or 1
            ],
          },
        },
      },

      //sort by score
      { $sort: { score: -1, createdAt: -1 } },

      //pagination
      { $skip: skip },
      { $limit: limit },

      //lookup author details
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorDetails",
          pipeline: [{ $project: { fullName: 1, avatar: 1 } }],
        },
      },
      { $unwind: "$authorDetails" },

      //delete unnecessary fields
      {
        $project: {
          userReactions: 0,
          score: 0,
        },
      },
    ]);
    res.status(200).json({ posts });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in getPost:", error);
  }
};

//create post
export const createPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { content, privacy } = req.body;
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in createPost:", error);
  }
};
