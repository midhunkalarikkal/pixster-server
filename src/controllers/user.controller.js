import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Saved from "../models/saved.model.js";
import Connection from "../models/connection.model.js";
import Notification from "../models/notification.model.js";
import { generateSignedUrl } from "../utils/aws.config.js";

import dotenv from "dotenv";
dotenv.config();

export const homeScrollerData = async (req, res) => {
  try {
    const currentUserId = req?.user?._id;
    if (!currentUserId) {
      return res
        .status(404)
        .json({ message: "Something went wrong, please login again" });
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Something went wring, please login again" });
    }

    const postData = await Connection.aggregate([
      {
        $match: {
          $and : [
            { fromUserId: user?._id },
            { 
              $or : [
                { status : "accepted" },
                { status : "followed" }
              ]
            }
          ] 
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "toUserId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          _id: "$userDetails._id",
          userName: "$userDetails.userName",
          profilePic: "$userDetails.profilePic",
        },
      },
      {
        $lookup: {
          from: "posts",
          localField: "_id",
          foreignField: "userId",
          as: "userPostDetails",
        },
      },
      {
        $unwind: "$userPostDetails",
      },
      {
        $lookup: {
          from: "postlikes",
          let: { postId: "$userPostDetails._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    { $eq: ["$userId", currentUserId] },
                  ],
                },
              },
            },
          ],
          as: "likedByCurrentUser",
        },
      },
      {
        $addFields: {
          "userPostDetails.likedByCurrentUser": {
            $gt: [{ $size: "$likedByCurrentUser" }, 0],
          },
        },
      },
      {
        $lookup: {
          from: "saveds",
          let: { postId: "$userPostDetails._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    { $eq: ["$userId", currentUserId] },
                  ],
                },
              },
            },
          ],
          as: "savedByCurrentUser",
        },
      },
      {
        $addFields: {
          "userPostDetails.savedByCurrentUser": {
            $gt: [{ $size: "$savedByCurrentUser" }, 0],
          },
        },
      },
      {
        $project: {
          likedByCurrentUser: 0,
          savedByCurrentUser: 0,
        },
      },
      {
        $sort: { "userPostDetails.createdAt": -1 },
      },
    ]);

    const updatedPostData = await Promise.all(
      postData.map(async (post) => {
        let signedProfilePic = post.profilePic;
        let signedMedia = post.userPostDetails?.media;

        if (post?.profilePic) {
          signedProfilePic = await generateSignedUrl(post.profilePic);
        }

        if (post?.userPostDetails?.media) {
          signedMedia = await generateSignedUrl(post.userPostDetails.media);
        }

        return {
          ...post,
          profilePic: signedProfilePic,
          userPostDetails: {
            ...post.userPostDetails,
            media: signedMedia,
          },
        };
      })
    );

    return res
      .status(200)
      .json({ message: "Home scroll data fetched.", posts: updatedPostData });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const query = searchQuery?.trim().toLowerCase();

    if (!query) {
      return res.status(400).json({ message: "Invalid or missing query." });
    }

    const users = await User.find(
      {
        $or: [
          { fullName: { $regex: query, $options: "i" } },
          { userName: { $regex: query, $options: "i" } },
        ],
      },
      { _id: 1, fullName: 1, userName: 1, profilePic: 1 }
    ).lean();

    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user.profilePic) return user;
        const signedUrl = await generateSignedUrl(user.profilePic);
        return {
          ...user,
          profilePic: signedUrl,
        };
      })
    );

    return res
      .status(200)
      .json({ message: "Users fetched successfully", users: updatedUsers });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchSearchedUserProfile = async (req, res) => {
  try {
    const currentUser = req.user?._id;
    const { userId } = req.params;

    const userData = await User.findById(userId).select(
      "_id fullName userName profilePic about postsCount followersCount followingsCount public"
    );

    if (!userData) {
      return res.status(404).json({ message: "User not found." });
    }

    const connectionData = await Connection.findOne(
      { fromUserId: currentUser, toUserId: userId },
      { _id: 0, status: 1 }
    );

    const revConnectionData = await Connection.findOne(
      { fromUserId: userId, toUserId: currentUser },
      { _id: 0, status: 1 }
    );

    if (userData.profilePic) {
      userData.profilePic = await generateSignedUrl(userData.profilePic);
    }

    return res.status(200).json({
      message: "User profile fetched successfully",
      userData,
      connectionData,
      revConnectionData,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(404).json({ message: "Invalid request" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let userPosts = await Post.find({ userId: userId, type: "Post" }).lean();
    if (userPosts.length > 0) {
      userPosts = await Promise.all(
        userPosts.map(async (post) => {
          const signedUrl = await generateSignedUrl(post.media);

          return {
            ...post,
            media: signedUrl,
          };
        })
      );
    }

    return res.status(200).json({ userPosts });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchUserSavedPosts = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    if (!currentUserId) {
      return res.status(404).json({ message: "No user found" });
    }

    let userSavedPosts = await Saved.find(
      { userId: currentUserId },
      { _id: 0, postId: 1 }
    )
      .populate({
        path: "postId",
        select: "media",
      })
      .lean();

    if (userSavedPosts.length > 0) {
      userSavedPosts = await Promise.all(
        userSavedPosts.map(async (post) => {
          const signedUrl = await generateSignedUrl(post?.postId?.media);
          return {
            ...post.postId,
            media: signedUrl,
          };
        })
      );
    }

    return res.status(200).json({ userSavedPosts });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchRequestedAccounts = async (req, res) => {
  try {
    const fromUserId = req.user?._id;
    if (!fromUserId) {
      return res.status(400).json({ message: "User not found." });
    }

    const requestedToUserIds = await Connection.find({
      fromUserId,
      status: "requested",
    }).distinct("toUserId");

    const users = await User.find(
      { _id: { $in: requestedToUserIds } },
      { _id: 1, userName: 1, fullName: 1, profilePic: 1 }
    );

    let updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user.profilePic) return user;

        const signedUrl = await generateSignedUrl(user.profilePic);

        return {
          ...user,
          profilePic: signedUrl,
        };
      })
    );

    return res
      .status(200)
      .json({ message: "Users fetched successfully", users: updatedUsers });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchIncomingRequestedAccounts = async (req, res) => {
  try {
    const fromUserId = req.user?._id;
    if (!fromUserId) {
      return res.status(400).json({ message: "User not found." });
    }

    const incomingRequestedToUserIds = await Connection.find({
      toUserId: fromUserId,
      status: "requested",
    }).distinct("fromUserId");

    const users = await User.find(
      { _id: { $in: incomingRequestedToUserIds } },
      { _id: 1, userName: 1, fullName: 1, profilePic: 1 }
    ).lean();

    let updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user.profilePic) return user;

        const signedUrl = await generateSignedUrl(user.profilePic);

        return {
          ...user,
          profilePic: signedUrl,
        };
      })
    );

    return res
      .status(200)
      .json({ message: "Users fetched successfully", users: updatedUsers });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchFollowingAccounts = async (req, res) => {
  try {
    const fromUserId = req.user?._id;
    const { userId } = req.params;

    if (!fromUserId) {
      return res.status(404).json({ message: "Please login and try again." });
    }

    if (!userId) {
      return res.status(404).json({ message: "User not found" });
    }

    const followingUsersIds = await Connection.find({
      fromUserId: userId,
      $or : [
        { status : "accepted" },
        { status : "followed" }
      ]
    }).distinct("toUserId");

    const users = await User.find(
      { _id: { $in: followingUsersIds } },
      { _id: 1, userName: 1, fullName: 1, profilePic: 1 }
    ).lean();

    let updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user.profilePic) return user;
        const signedUrl = await generateSignedUrl(user.profilePic);
        return {
          ...user,
          profilePic: signedUrl,
        };
      })
    );

    return res
      .status(200)
      .json({ message: "Users fetched successfully", users: updatedUsers });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchFollowersAccounts = async (req, res) => {
  try {
    const fromUserId = req.user?._id;
    const { userId } = req.params;

    if (!fromUserId) {
      return res.status(404).json({ message: "Please login and try again." });
    }

    if (!userId) {
      return res.status(404).json({ message: "User not found" });
    }

    const followersUsersIds = await Connection.find({
      toUserId: userId,
      $or : [
        { status : "accepted" },
        { status : "followed" }
      ]
    }).distinct("fromUserId");

    const users = await User.find(
      { _id: { $in: followersUsersIds } },
      { _id: 1, userName: 1, fullName: 1, profilePic: 1 }
    ).lean();

    let updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user.profilePic) return user;

        const signedUrl = await generateSignedUrl(user.profilePic);

        return {
          ...user,
          profilePic: signedUrl,
        };
      })
    );

    return res
      .status(200)
      .json({ message: "Users fetched successfully", users: updatedUsers });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchNotifications = async (req, res) => {
  try {
    const currentUser = req.user?._id;
    if (!currentUser) {
      return res.status(400).json({ message: "User not found." });
    }

    const notifications = await Notification.find(
      { toUserId: currentUser },
      { updatedAt: 0, __v: 0 }
    )
      .sort({ createdAt: -1 })
      .populate({
        path: "fromUserId",
        select: "userName fullName profilePic _id",
      })
      .lean();

    const updatedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        if (!notification?.fromUserId?.profilePic) return notification;

        const signedUrl = await generateSignedUrl(
          notification?.fromUserId?.profilePic
        );

        return {
          ...notification,
          fromUserId: {
            ...notification.fromUserId,
            profilePic: signedUrl,
          },
        };
      })
    );

    return res.status(200).json({
      message: "Users fetched successfully",
      notifications: updatedNotifications,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchSuggestions = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res.status(400).json({ message: "User not found." });
    }

    const suggestionUsersIds = await Connection.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [{ status: "accepted" }, { status: "requested" }, { status: "followed" } ],
            },
            {
              $or: [{ fromUserId: currentUserId }, { toUserId: currentUserId }],
            },
          ],
        },
      },
      {
        $project: {
          _id: 0,
          userId: {
            $cond: {
              if: { $eq: ["$fromUserId", currentUserId] },
              then: "$toUserId",
              else: "$fromUserId",
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          friendsIds: { $addToSet: "$userId" },
        },
      },
      {
        $lookup: {
          from: "connections",
          let: { friendsList: "$friendsIds" },
          pipeline: [
            {
              $match: {
                status: "accepted",
                $expr: {
                  $or: [
                    { $in: ["$fromUserId", "$$friendsList"] },
                    { $in: ["$toUserId", "$$friendsList"] },
                  ],
                },
              },
            },
            {
              $project: {
                userId: {
                  $cond: {
                    if: { $in: ["$fromUserId", "$$friendsList"] },
                    then: "$toUserId",
                    else: "$fromUserId",
                  },
                },
              },
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$userId", currentUserId] },
                    { $not: [{ $in: ["$userId", "$$friendsList"] }] },
                  ],
                },
              },
            },
          ],
          as: "suggestions",
        },
      },
      {
        $unwind: "$suggestions",
      },
      {
        $replaceRoot: {
          newRoot: "$suggestions",
        },
      },
      {
        $group: {
          _id: null,
          userIds: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          _id: 0,
          userIds: 1,
        },
      },
    ]);

    const suggestionUsersIdsArray = suggestionUsersIds[0]?.userIds || [];

    const users = await User.find(
      {
        _id: {
          $in: suggestionUsersIdsArray,
        },
      },
      { userName: 1, fullName: 1, profilePic: 1 }
    ).lean();

    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user?.profilePic) return user;

        const signedUrl = await generateSignedUrl(user?.profilePic);

        return {
          ...user,
          profilePic: signedUrl,
        };
      })
    );

    return res
      .status(200)
      .json({
        message: "Suggestions fetched successfully",
        suggestions: updatedUsers,
      });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const fetchMediaGrid = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res.status(404).json({ message: "Please login again" });
    }

    let mediaPosts = await Connection.aggregate([
      {
        $match: {
          $and : [
            { fromUserId: currentUserId },
            {
              $or : [
                { status: "accepted" },
                { status: "followed" }
              ]
            }
          ]
        },
      },
      {
        $lookup: {
          from: "posts",
          localField: "toUserId",
          foreignField: "userId",
          as: "posts",
        },
      },
      {
        $unwind: "$posts",
      },
      {
        $match : {
          "posts.type" : "Post"
        }
      },
      {
        $project: {
          _id: 0,
          postId: "$posts._id",
          media: "$posts.media",
        },
      },
    ]);

    if (mediaPosts.length > 0) {
      mediaPosts = await Promise.all(
        mediaPosts.map(async (post) => {
          const signedUrl = await generateSignedUrl(post.media);
          return {
            ...post,
            media: signedUrl,
          };
        })
      );
    }

    return res.status(200).json({ mediaPosts });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};


export const fetchMyThreads = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(404).json({ message: "Invalid request" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let userThreads = await Post.find({ userId: userId, type: "Thread" }).lean();
    
    return res.status(200).json({ userThreads });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const updateAbout = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { about } = req.body;

    if(!currentUserId || !about) {
      return res.status(404).json({ message : "Invalid request" });
    }

    if(about.length < 1 || about.length > 200) {
      return res.status(400).json({ message : "Invalid about" });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      currentUserId,
      { about },
      { new : true }
    );

    if(updatedUser) {
      return res.status(200).json({ success : true, message : "about updated", about : updatedUser.about });
    } else {
      return res.status(400).json({ message : "About updating error" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
}

export const changeAccountType = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    if(!currentUserId) {
      return res.status(404).json({ message : "Please login again" });
    }

    const user = await User.findById(currentUserId);
    if(!user) {
      return res.status(404).json({ message : "No user found" });
    }
    
    user.public = !user.public;
    user.accountTypeChangedOn = Date.now();
    const updatedUser = await user.save();

    const accountType = updatedUser.public ? "Public" : "Private";

    return res.status(200).json({
      success : true,
      message : `Your account type changed to ${accountType}`,
      type : updatedUser.public
    });

  }catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
}