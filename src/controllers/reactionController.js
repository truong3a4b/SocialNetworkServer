import Reaction from "../models/Reaction.js";
import Post from "../models/Post.js";

// Create a new reaction
export const createReaction = async (req, res) => {
  try {
    const { postId, type } = req.body;
    const userId = req.userId;

    // Check if the reaction already exists
    let reaction = await Reaction.findOne({ post: postId, user: userId });
    if (reaction) {
      // Update existing reaction
      reaction.type = type;
    } else {
      // Create new reaction
      reaction = new Reaction({ post: postId, user: userId, type });
      // Increment reaction count in Post model
      await Post.findByIdAndUpdate(postId, {
        $inc: { [`reactionCounts.${type}`]: 1 },
      });
    }
    await reaction.save();

    res.status(200).json({ message: "Reaction saved successfully", reaction });
  } catch (error) {
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
    const { postId } = req.params;
    const reactions = await Reaction.find({ post: postId }).populate(
      "user",
      "fullName avatar"
    );
    res.status(200).json({ reactions });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Delete a reaction
export const deleteReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const reaction = await Reaction.findOneAndDelete({
      post: postId,
      user: userId,
    });
    if (reaction) {
      // Decrement reaction count in Post model
      await Post.findByIdAndUpdate(postId, {
        $inc: { [`reactionCounts.${reaction.type}`]: -1 },
      });
    }
    res.status(200).json({ message: "Reaction deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
