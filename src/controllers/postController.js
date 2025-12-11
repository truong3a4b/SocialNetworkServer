import { mongoose } from "mongoose";
import Post from "../models/Post.js";
import Follow from "../models/Follow.js";
import HiddenPost from "../models/HiddenPost.js";
import cloudinary from "../config/cloudinary.js";
import Comment from "../models/Comment.js";
import Reaction from "../models/Reaction.js";

//get feed posts
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

    const pipeline = [];

    //fetch posts
    pipeline.push(
      ...[
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
            let: {
              postId: "$_id",
              userId: new mongoose.Types.ObjectId(userId),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$targetId", "$$postId"] },
                      { $eq: ["$user", "$$userId"] },
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

        //if shared post, lookup original post details
        {
          $lookup: {
            from: "posts",
            localField: "sharedPost",
            foreignField: "_id",
            as: "sharedPost",
            pipeline: [
              {
                $lookup: {
                  from: "users",
                  localField: "author",
                  foreignField: "_id",
                  as: "author",
                  pipeline: [{ $project: { fullName: 1, avatar: 1 } }],
                },
              },
              {
                $unwind: { path: "$author", preserveNullAndEmptyArrays: true },
              },
              {
                $project: {
                  content: 1,
                  images: 1,
                  videos: 1,
                  author: 1,
                  createdAt: 1,
                  privacy: 1,
                },
              },
            ],
          },
        },
        { $unwind: { path: "$sharedPost", preserveNullAndEmptyArrays: true } },
        //calculate score for sorting
        {
          $addFields: {
            engagementScore: {
              $divide: [
                {
                  $add: [
                    { $multiply: ["$totalReactions", 1] },
                    { $multiply: ["$commentCount", 3] },
                    { $multiply: ["$shareCount", 5] },
                  ],
                },
                {
                  $pow: [
                    {
                      $add: [
                        2,
                        {
                          $divide: [
                            { $subtract: [new Date(), "$createdAt"] },
                            1000 * 60 * 60,
                          ],
                        },
                      ],
                    },
                    1.5,
                  ],
                },
              ],
            },
          },
        },

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
                      $gte: ["$engagementScore", 100],
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
            as: "author",
            pipeline: [{ $project: { fullName: 1, avatar: 1 } }],
          },
        },
        { $unwind: "$author" },

        //delete unnecessary fields
        {
          $project: {
            score: 0,
            engagementScore: 0,
          },
        },
      ]
    );

    const posts = await Post.aggregate(pipeline);
    res.status(200).json({ posts });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in getPost:", error);
  }
};

//get profile posts
export const getProfilePosts = async (req, res) => {
  try {
    const userId = req.userId;
    const profileId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const hiddenPosts = await HiddenPost.find({ user: userId })
      .select("post")
      .lean();
    const hiddenPostIds = hiddenPosts.map((hp) => hp.post);

    //fetch posts
    const posts = await Post.aggregate([
      {
        $match: {
          author: new mongoose.Types.ObjectId(profileId),
          _id: { $nin: hiddenPostIds },
        },
      },

      //lookup reactions
      {
        $lookup: {
          from: "reactions",
          let: {
            postId: "$_id",
            userId: new mongoose.Types.ObjectId(userId),
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$targetId", "$$postId"] },
                    { $eq: ["$user", "$$userId"] },
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
      //lookup author details
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
          pipeline: [{ $project: { fullName: 1, avatar: 1 } }],
        },
      },
      { $unwind: "$author" },
      //if shared post, lookup original post details
      {
        $lookup: {
          from: "posts",
          localField: "sharedPost",
          foreignField: "_id",
          as: "sharedPost",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author",
                pipeline: [{ $project: { fullName: 1, avatar: 1 } }],
              },
            },
            {
              $unwind: { path: "$author", preserveNullAndEmptyArrays: true },
            },
            {
              $project: {
                content: 1,
                images: 1,
                videos: 1,
                author: 1,
                createdAt: 1,
                privacy: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: "$sharedPost", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },

      { $skip: skip },
      { $limit: limit },
      //delete unnecessary fields
    ]);
    res.status(200).json({ posts });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in getProfilePosts:", error);
  }
};

//get post
export const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId).populate(
      "author",
      "fullName avatar"
    );
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json({ post });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in getPost:", error);
  }
};

//get signature for cloudinary upload
export const getCloudinarySignature = (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    const paramToSign = {
      timestamp: timestamp,
      folder: "social_media_app",
      resource_type: "auto",
    };
    const signature = cloudinary.utils.api_sign_request(
      paramToSign,
      process.env.CLOUDINARY_API_SECRET
    );
    res.status(200).json({
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudinaryName: process.env.CLOUDINARY_CLOUD_NAME,
      folder: "social_media_app",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in getCloudinarySignature:", error);
  }
};

//create post
export const createPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { content, privacy, images, videos } = req.body;
    if (!Array.isArray(images) || !Array.isArray(videos)) {
      return res
        .status(400)
        .json({ message: "Images and videos must be arrays" });
    }

    const newPost = new Post({
      author: userId,
      content,
      privacy,
      images,
      videos,
    });

    await newPost.save();
    res.status(201).json({ post: newPost });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in createPost:", error);
  }
};

//edit post
export const editPost = async (req, res) => {
  try {
    const userId = req.userId;
    const postId = req.params.id;
    const { content, privacy, images, videos } = req.body;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    post.content = content;
    post.privacy = privacy;
    post.images = images;
    post.videos = videos;
    await post.save();
    res.status(200).json({ post });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in editPost:", error);
  }
};

//delete post
export const deletePost = async (req, res) => {
  try {
    const userId = req.userId;
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    //delete associated comments and reactions
    await Comment.deleteMany({ post: postId });
    await Reaction.deleteMany({ targetId: postId, targetType: "Post" });

    await Post.findByIdAndDelete(postId);
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in deletePost:", error);
  }
};

//share post
export const sharePost = async (req, res) => {
  try {
    const userId = req.userId;
    const postId = req.params.id;
    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return res.status(404).json({ message: "Original post not found" });
    }

    //user cannot share their own post
    if (originalPost.author.toString() === userId) {
      return res
        .status(400)
        .json({ message: "You cannot share your own post" });
    }

    const sharedPost = new Post({
      author: userId,
      type: "shared",
      privacy: originalPost.privacy,
      sharedPost: originalPost._id,
    });
    await sharedPost.save();
    //increment share count of original post
    originalPost.shareCount += 1;
    await originalPost.save();
    res.status(201).json({ post: sharedPost });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error("Error in sharePost:", error);
  }
};
