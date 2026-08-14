import mongoose from "mongoose";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Saved from "../models/saved.model.js";
import { Upload } from "@aws-sdk/lib-storage";
import Comment from "../models/comment.model.js";
import PostLike from "../models/postLike.model.js";
import { generateS3Key } from "../utils/helper.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import CommentLike from "../models/commentLike.model.js";
import Notification from "../models/notification.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { generateSignedUrl, s3Client } from "../utils/aws.config.js";

import dotenv from "dotenv";
dotenv.config();

export const uploadPost = async (req, res) => {
  try {
    const currentUserId = req.user?._id;

    const { caption, type } = req.body;
    const file = req.file;

    if (!currentUserId) {
      return res.status(400).json({ message: "User not found." });
    }

    if (!caption) {
      return res.status(400).json({ message: "Caption not found." });
    }

    if (caption.length < 1 || caption.length > 500) {
      return res.status(400).json({ message: "Pos captionlength error." });
    }

    if (type === "Post") {
      if (!file) {
        return res.status(400).json({ message: "Image not found." });
      }

      const key = generateS3Key({
        folder: "pixsterUsersPostsImages",
        userId: currentUserId,
        originalname: file.originalname,
      });

      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const upload = new Upload({
        client: s3Client,
        params: params,
      });

      const s3UploadResponse = await upload.done();

      const newPost = new Post({
        userId: currentUserId,
        media: s3UploadResponse.Location,
        content: caption,
        type: type,
      });

      await newPost.save();
    } else {
      const newPost = new Post({
        userId: currentUserId,
        content: caption,
        type: type,
      });

      await newPost.save();
    }
    await User.findByIdAndUpdate(currentUserId, { $inc: { postsCount: 1 } });

    return res
      .status(201)
      .json({ success: true, message: "Post uploaded successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const deletePost = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { postId } = req.params;

    if (!currentUserId || !postId) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    if (post.media) {
      const oldKey = post.media.split("/").slice(3).join("/");
      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: oldKey,
      };
      try {
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      } catch (error) {
        throw new Error("post image deleting error.");
      }
    }

    await Post.findByIdAndDelete(postId);

    await Comment.deleteMany({ postId });

    await User.findByIdAndUpdate(
      currentUserId,
      { $inc: { postsCount: -1 } },
      { new: true }
    );

    return res
      .status(200)
      .json({ message: `${post.type} deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const updatePost = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { postId } = req.params;

    const { caption } = req.body;
    const file = req.file;

    if (!currentUserId) {
      return res.status(400).json({ message: "User not found." });
    }

    const post = await Post.findById(postId, {
      updatedAt: 0,
      likes: 0,
      commentsCount: 0,
    });
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    if (file) {
      if (post.media) {
        const oldKey = post.media.split("/").slice(3).join("/");
        const deleteParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: oldKey,
        };
        try {
          await s3Client.send(new DeleteObjectCommand(deleteParams));
        } catch (error) {
          throw new Error("post image deleting error.");
        }
      }

      const key = generateS3Key({
        folder: "pixsterUsersStoryImages",
        userId: currentUserId,
        originalname: file.originalname,
      });

      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const upload = new Upload({
        client: s3Client,
        params: params,
      });

      const s3UploadResponse = await upload.done();
      post.media = s3UploadResponse.Location;
    }

    if (caption) {
      post.content = caption;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: `${post.type} updated successfully.`,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const likeOrDislikePost = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { postId } = req.params;

    if (!currentUserId || !postId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({ message: "No user found" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "No post found" });
    }

    if (String(post?.userId) === String(currentUserId)) {
      return res.status(403).json({ message: "You cannot like your own post" });
    }

    const existLike = await PostLike.findOne({
      userId: currentUserId,
      postId: postId,
    });

    let newNotification;

    if (existLike) {
      await PostLike.findByIdAndDelete(existLike._id);

      const updatedPost = await Post.findByIdAndUpdate(postId, {
        $inc: { likes: -1 },
      });

      if (updatedPost.likes < 0) {
        updatedPost.likes = 0;
        await updatedPost.save();
      }

      return res.status(200).json({
        message: "You have disliked a post",
        liked: false,
        disliked: true,
      });
    } else {
      const newLike = new PostLike({
        userId: currentUserId,
        postId: postId,
      });

      await newLike.save();

      await Post.findByIdAndUpdate(postId, { $inc: { likes: 1 } });

      newNotification = new Notification({
        message: "Liked your post",
        toUserId: post.userId,
        fromUserId: currentUserId,
        notificationType: "postLiked",
      });
      await newNotification.save();

      await newNotification.populate({
        path: "fromUserId",
        select: "userName fullName profilePic",
      });

      if (newNotification.fromUserId.profilePic) {
        newNotification.fromUserId.profilePic = await generateSignedUrl(
          newNotification.fromUserId.profilePic
        );
      }

      const postLikeSocketData = {
        notification: newNotification,
      };

      const receiverSocketId = getReceiverSocketId(post.userId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("postLikeSocket", postLikeSocketData);
      }

      return res.status(200).json({
        message: "You have liked a post",
        liked: true,
        disliked: false,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const savePost = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { postId } = req.params;

    if (!currentUserId || !postId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({ message: "No user found" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "No post found" });
    }

    const existing = await Saved.findOne({ postId: postId });
    if (existing) {
      await Saved.findByIdAndDelete(existing._id);

      return res.status(200).json({
        message: "Post removed from your saved list.",
        saved: false,
        removed: true,
      });
    } else {
      const newSaved = new Saved({
        userId: currentUserId,
        postId: postId,
      });

      await newSaved.save();

      return res
        .status(200)
        .json({ message: "Post saved.", saved: true, removed: false });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const addComment = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { comment, postId, parentCommentId } = req.body;

    if (!currentUserId || !comment) {
      return res.status(404).json({ message: "Invalid request." });
    }

    if (comment.length < 0 || comment.length > 200) {
      return res.status(400).json({ message: "Invalid comment." });
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found, please login again" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "No post found" });
    }

    let newComment;
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      newComment = new Comment({
        postId,
        userId: currentUserId,
        content: comment,
        isRootComment: false,
        parentCommentId,
      });
      await newComment.save();
    } else {
      newComment = new Comment({
        postId,
        userId: currentUserId,
        content: comment,
        isRootComment: true,
      });
      await newComment.save();
    }

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    const newNotification = new Notification({
      message: `commented on your post.`,
      toUserId: post.userId,
      fromUserId: currentUserId,
      notificationType: "postCommented",
    });
    await newNotification.save();

    await newNotification.populate({
      path: "fromUserId",
      select: "userName fullName profilePic",
    });

    await newComment.populate({
      path: "userId",
      select: "userName profilePic",
    });

    newComment = {
      ...newComment.toObject(),
      user: newComment.userId,
    };
    delete newComment.userId;

    if (newComment?.user?.profilePic) {
      newComment.user.profilePic = await generateSignedUrl(
        newComment?.user?.profilePic
      );
    }

    if (newNotification.fromUserId.profilePic) {
      newNotification.fromUserId.profilePic = await generateSignedUrl(
        newNotification.fromUserId.profilePic
      );
    }

    if (parentCommentId) {
      if (parentCommentId.toString() !== currentUserId.toString()) {
        const notificationToParentCommenter = new Notification({
          message: "Replied to your comment",
          toUserId: parentCommentId,
          fromUserId: currentUserId,
          notificationType: "postCommented",
        });

        const savedNotificationForParentCommenter =
          await notificationToParentCommenter.save();
        await savedNotificationForParentCommenter.populate({
          path: "fromUserId",
          select: "userName, profilePic",
        });

        const socketData = {
          notification: savedNotificationForParentCommenter,
        };

        const receiverSocketId = getReceiverSocketId(parentCommentId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("commentedOnPost", socketData);
        }
      }
    }

    const socketData = {
      notification: newNotification,
    };

    const receiverSocketId = getReceiverSocketId(post.userId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("commentedOnPost", socketData);
    }

    return res.status(200).json({
      message: "Comment added successfully.",
      comment: newComment,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getComments = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { postId } = req.params;

    if (!postId) {
      return res.status(404).json({ message: "Invalid request" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "No post found" });
    }

    let aggregatedComments = await Comment.aggregate([
      {
        $match: {
          postId: new mongoose.Types.ObjectId(postId),
          isRootComment: true,
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "parentCommentId",
          as: "replies",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $lookup: {
          from: "users",
          let: { replyUserIds: "$replies.userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$replyUserIds"],
                },
              },
            },
            {
              $project: {
                _id: 1,
                userName: 1,
                profilePic: 1,
              },
            },
          ],
          as: "repliesUserDetails",
        },
      },
      {
        $addFields: {
          replies: {
            $map: {
              input: "$replies",
              as: "reply",
              in: {
                _id: "$$reply._id",
                content: "$$reply.content",
                likes: "$$reply.likes",
                isRootComment: "$$reply.isRootComment",
                parentCommentId: "$$reply.parentCommentId",
                createdAt: "$$reply.createdAt",
                updatedAt: "$$reply.updatedAt",
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$repliesUserDetails",
                        as: "u",
                        cond: { $eq: ["$$u._id", "$$reply.userId"] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          content: 1,
          likes: 1,
          isRootComment: 1,
          parentCommentId: 1,
          createdAt: 1,
          updatedAt: 1,
          replies: 1,
          user: {
            _id: "$user._id",
            userName: "$user.userName",
            profilePic: "$user.profilePic",
          },
        },
      },
    ]);

    const likedComments = await CommentLike.find({
      userId: currentUserId,
    }).select("commentId");
    const likedCommentsIdsSet = new Set(
      likedComments.map((like) => like.commentId.toString())
    );

    aggregatedComments = await Promise.all(
      aggregatedComments.map(async (comment) => {
        comment.commentLikedByAuthUser = likedCommentsIdsSet.has(
          comment._id.toString()
        );

        comment.replies = comment.replies.map((reply) => ({
          ...reply,
          commentLikedByAuthUser: likedCommentsIdsSet.has(reply._id.toString()),
        }));
        return comment;
      })
    );

    if (aggregatedComments.length > 0) {
      aggregatedComments = await Promise.all(
        aggregatedComments.map(async (comment) => {
          if (comment?.user?.profilePic) {
            comment.user.profilePic = await generateSignedUrl(
              comment?.user?.profilePic
            );
          }

          if (comment?.replies?.length > 0) {
            comment.replies = await Promise.all(
              comment?.replies.map(async (reply) => {
                if (reply?.user?.profilePic) {
                  reply.user.profilePic = await generateSignedUrl(
                    reply?.user?.profilePic
                  );
                }
                return reply;
              })
            );
          }
          return comment;
        })
      );
    }

    return res.status(200).json({ aggregatedComments });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { postId, commentId } = req.params;

    if (!currentUserId || !commentId) {
      return res.status(404).json({ message: "Invalid request" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (currentUserId.toString() !== comment.userId.toString()) {
      return res.status(400).json({ message: "You cant delete this comment" });
    }

    await Comment.findByIdAndDelete(commentId);

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });

    return res
      .status(200)
      .json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const likeOrDislikeComment = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { commentId } = req.params;

    if (!currentUserId || !commentId) {
      return res.statusa(404).json({ message: "Invalid request" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const existingLike = await CommentLike.findOne({
      commentId: comment._id,
      userId: currentUserId,
    });

    if (existingLike) {
      await CommentLike.findByIdAndDelete(existingLike._id);

      await Comment.findByIdAndUpdate(comment._id, { $inc: { likes: -1 } });
    } else {
      const newCommentLike = await CommentLike({
        commentId,
        userId: currentUserId,
      });

      await newCommentLike.save();

      await Comment.findByIdAndUpdate(comment._id, { $inc: { likes: 1 } });

      const newNotification = new Notification({
        message: "liked your comment",
        toUserId: comment.userId,
        fromUserId: currentUserId,
        notificationType: "commentLiked",
      });

      await newNotification.save();

      await newNotification.populate({
        path: "fromUserId",
        select: "userName profilePic",
      });

      if (currentUserId.toString() !== comment.userId.toString()) {
        const socketData = {
          notification: newNotification,
        };

        const receiverSocketId = getReceiverSocketId(comment.userId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("commentLiked", socketData);
        }
      }
    }

    return res.status(200).json({
      success: true,
      liked: !existingLike,
      disliked: !!existingLike,
      isRootComment: comment.isRootComment,
      parentCommentId: comment.parentCommentId,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};
