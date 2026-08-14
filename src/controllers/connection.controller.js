import User from "../models/user.model.js";
import Connection from "../models/connection.model.js";
import Notification from "../models/notification.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { generateSignedUrl } from "../utils/aws.config.js";

export const requestConnection = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;
    const { status } = req.query;

    if (!fromUserId || !toUserId || !status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    let userData = await User.findById(fromUserId, { _id: 1, userName: 1, fullName: 1, profilePic: 1 });
    if(!userData) {
      return res.status(400).json({ message: "User not found." });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const allowedStatus = "requested";
    if (allowedStatus !== status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    let toUserData = await User.findById(toUserId, { password: 0, email: 0, createdAt: 0, updatedAt: 0 });
    if (!toUserData) {
      return res.status(400).json({ message: "User not found." });
    }

    let connectionData = await Connection.findOne({ fromUserId, toUserId }, { status: 1 });

    let newNotification;

    if(!toUserData.public) {      
      if (connectionData) {
        if (connectionData.status === status) {
          return res
          .status(400)
          .json({ message: `Connection already ${status}.` });
        } else if (
        connectionData.status === "cancelled" ||
        connectionData.status === "rejected" ||
        connectionData.status === "unfollowed"
      ) {
        connectionData.status = status;
        connectionData = await connectionData.save();
        
        newNotification = new Notification({
          message: "Wants to follow you.",
          toUserId: toUserId,
          fromUserId: fromUserId,
          notificationType: "followRequest",
        });

        newNotification = await newNotification.save();
      }
    } else {
      connectionData = new Connection({
        fromUserId,
        toUserId,
        status,
      });
      connectionData = await connectionData.save();

      const notification = new Notification({
        message: "Wants to follow you.",
        toUserId: toUserId,
        fromUserId: fromUserId,
        notificationType: "followRequest",
      });
      
      newNotification = await notification.save();
    }
  } else {
    if (!connectionData) {
      connectionData = new Connection({
        fromUserId,
        toUserId,
        status: "followed",
      });
    } else {
      connectionData.status = "followed";
    }
    connectionData = await connectionData.save();
    
    newNotification = new Notification({
      message: "started following you.",
      toUserId: toUserId,
      fromUserId: fromUserId,
      notificationType: "followed",
    });

    newNotification = await newNotification.save();

    toUserData = await User.findByIdAndUpdate(
      toUserId,
      { $inc: { followersCount: 1 } },
      {
        new: true,
        projection: { password: 0, email: 0, createdAt: 0, updatedAt: 0 },
      }
    );

    userData = await User.findByIdAndUpdate(
      fromUserId,
      { $inc: { followingsCount: 1 } },
      {
        new: true,
        projection: { password: 0, email: 0, createdAt: 0, updatedAt: 0 },
      }
    );
  }
  
    const revConnectionData = await Connection.findOne(
      { fromUserId: toUserId, toUserId: fromUserId },
      { _id: 0, status: 1 }
    );

    await newNotification.populate({
      path: "fromUserId",
      select: "userName fullName profilePic",
    });

    if(newNotification?.fromUserId?.profilePic) {
      newNotification.fromUserId.profilePic = await generateSignedUrl(newNotification.fromUserId.profilePic);
    }

    if(userData.profilePic) {
      userData.profilePic = await generateSignedUrl(userData.profilePic);
    }

    if(toUserData.profilePic) {
      toUserData.profilePic = await generateSignedUrl(toUserData.profilePic);
    }

    const socketData = {
      notification: newNotification,
      userData,
      revConnectionData : connectionData,
      isFollowedPublicAccount : toUserData.public,
    };
      
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("followRequest", socketData);
    }

    return res.status(200).json({
      message: toUserData.public 
                ? `You are now following ${toUserData.fullName}.` 
                : `Follow request sent to ${toUserData.fullName}.`,
      userData: toUserData,
      connectionData,
      revConnectionData,
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const acceptConnection = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;
    const { status } = req.query;

    if (!fromUserId || !toUserId || !status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const allowedStatus = "accepted";
    if (allowedStatus !== status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const existingToUser = await User.findById(toUserId);
    if (!existingToUser) {
      return res.status(400).json({ message: "User not found." });
    }

    let revConnectionData = await Connection.findOne({
      fromUserId: toUserId,
      toUserId: fromUserId,
    },{status: 1});

    if (revConnectionData && revConnectionData.status === "accepted") {
      return res.status(400).json({ message: "Connection already exist." });
    }

    revConnectionData.status = status;
    revConnectionData = await revConnectionData.save();

    const newNotification = new Notification({
      message: "accepted your request",
      toUserId: toUserId,
      fromUserId: fromUserId,
      notificationType: "requestAccept",
    });
    await newNotification.save();
    await newNotification.populate({
      path : "fromUserId",
      select : "userName fullName profilePic"
    })

    await User.findByIdAndUpdate( fromUserId, { $inc: { followersCount: 1 } }, { new: true } );

    const userData = await User.findByIdAndUpdate( toUserId, { $inc: { followingsCount: 1 } }, { new: true } ).select(" -password -createdAt -email -updatedAt");
    if(userData.profilePic) {
      userData.profilePic = await generateSignedUrl(userData.profilePic);
    }

    const connectionData = await Connection.findOne(
      { fromUserId, toUserId },
      { _id: 0, status: 1 }
    );
    
    const socketData = {
      fromUserId,
      connectionData: revConnectionData,
      revConnectionData: connectionData,
    }

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("requestAccepted", socketData);
    }

    return res.status(200).json({
      message: `You have accepted ${userData.fullName}'s follow request`,
      userData,
      connectionData,
      revConnectionData,
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const rejectConnection = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;
    const { status } = req.query;

    if (!fromUserId || !toUserId || !status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const allowedStatus = "rejected";
    if (allowedStatus !== status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const toUserData = await User.findById(toUserId).select("-password -createdAt -email -updatedAt");
    if (!toUserData) {
      return res.status(400).json({ message: "User not found." });
    }

    if(toUserData.profilePic) {
      toUserData.profilePic = await generateSignedUrl(toUserData.profilePic);
    }

    let revConnectionData = await Connection.findOne({
      fromUserId: toUserId,
      toUserId: fromUserId,
    });

    if (revConnectionData.status === "rejected") {
      return res.status(400).json({ message: "Connection already rejected." });
    }

    revConnectionData.status = status;
    revConnectionData = await revConnectionData.save();

    const connectionData = await Connection.findOne(
      { fromUserId, toUserId },
      { status: 1 }
    );

    const socketData = {
      fromUserId,
      connectionData: revConnectionData,
      revConnectionData: connectionData,
    }

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("requestReject", socketData);
    }

    return res.status(200).json({
      message: `You have rejected ${toUserData.fullName}'s follow request`,
      userData: toUserData,
      connectionData,
      revConnectionData,
      userPosts : [],
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const cancelConnection = async (req, res) => {
  try {
    const fromUserId = req.user?.id;
    const { toUserId } = req.params;
    const { status } = req.query;
    const { fromSelfProfile } = req.body;

    if (!fromUserId || !toUserId || !status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const allowedStatus = "cancelled";
    if (allowedStatus !== status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const toUserData = await User.findById(toUserId, {password: 0, createdAt: 0, updatedAt: 0, email: 0})
    if (!toUserData) {
      return res.status(400).json({ message: "User not found." });
    }

    const userData = await User.findById(fromUserId,{password: 0, createdAt: 0, updatedAt: 0, email: 0})
    if(!userData) {
      return res.status(400).json({ message: "Please login again and try again." });
    }

    let connectionData = await Connection.findOne({
      fromUserId,
      toUserId,
    });

    if (connectionData.status === "cancelled") {
      return res.status(400).json({ message: "Connection already cancelled." });
    } else if (connectionData.status === "accepted") {
      return res
        .status(400)
        .json({
          message:
            "Your request has been accpted, you can unfollow from thier account.",
        });
    }

    connectionData.status = status;
    connectionData = await connectionData.save();

    const revConnectionData = await Connection.findOne(
      { fromUserId: toUserId, toUserId: fromUserId },
      { _id: 0, status: 1 }
    );

    const socketData = {
      fromUserId,
      revConnectionData : connectionData
    }

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("requestCancel", socketData);
    }

    if(fromSelfProfile) {
      if(userData.profilePic) {
        userData.profilePic = await generateSignedUrl(userData.profilePic);
      }
    } else { 
      if(toUserData.profilePic) {
        toUserData.profilePic = await generateSignedUrl(toUserData.profilePic);
      }
    }

    return res.status(200).json({
      message: `You have cancelled your follow request to ${toUserData.fullName}`,
      userData: fromSelfProfile === true ? userData : toUserData,
      connectionData,
      revConnectionData,
      requestToRemoveId: toUserData._id
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const unfollowConnection = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId } = req.params;
    const { status } = req.query;

    if (!fromUserId || !toUserId || !status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const allowedStatus = "unfollowed";
    if (allowedStatus !== status) {
      return res.status(400).json({ message: "Invalid request." });
    }

    const existingToUser = await User.findById(toUserId);
    if (!existingToUser) {
      return res.status(400).json({ message: "User not found." });
    }

    let connectionData = await Connection.findOne({
      fromUserId,
      toUserId,
    });


    if (connectionData.status === "unfollowed") {
      return res
        .status(400)
        .json({ message: "Connection already unfollowing." });
    }

    connectionData.status = status;
    connectionData = await connectionData.save();

    await User.findByIdAndUpdate( 
      { _id : fromUserId },
      [
        {
          $set : {
            followingsCount : {
              $cond : [
                { $gt : ["$followingsCount", 0 ] },
                { $subtract : [ "$followingsCount", 1 ] },
                "$followingsCount"
              ]
            }
          }
        }
      ]
      );

    const userData = await User.findByIdAndUpdate( 
      { _id : toUserId },
      [
        {
          $set : {
            followersCount : {
              $cond : [
                { $gt : [ "$followersCount", 0 ] },
                { $subtract : [ "$followersCount" , 1 ] },
                "$followersCount"
              ]
            }
          }
        }
      ],
      { new : true }
      ).select(" -password -createdAt -email -updatedAt");

    const revConnectionData = await Connection.findOne( { fromUserId: toUserId, toUserId: fromUserId }, { _id: 0, status: 1 } );

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("unfollowConnection");
    }

    return res
      .status(200)
      .json({
        message: `You have unfollowed ${userData.fullName}`,
        userData,
        connectionData,
        revConnectionData,
      });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};


export const removeConnection = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { fromUserId } = req.params;
    const { status } = req.query;

    const fromUser = await User.findById(fromUserId);
    if(!fromUser) {
      return res.status(404).json({ message : "No user found" });
    }

    const connection = await Connection.findOne({
      fromUserId : fromUserId,
      toUserId : currentUserId,
      status : { $in : [ "followed", "accepted" ] }
    });
    if(!connection) {
      return res.status(404).json({ message : "No connection found" });
    }

    if(connection.status === status) {
      return res.status(400).json({ message : "You have already removed this connection" });
    } else {
      connection.status = status;
      await connection.save();

      await User.findByIdAndUpdate( 
        { _id : fromUserId },
        [
          {
            $set : {
              followingsCount : {
                $cond : [
                  { $gt : ["$followingsCount", 0 ] },
                  { $subtract : [ "$followingsCount", 1 ] },
                  "$followingsCount"
                ]
              }
            }
          }
        ]
        );

      await User.findByIdAndUpdate(
        { _id : currentUserId },
        [
          {
            $set : {
              followersCount : {
                $cond : [
                  { $gt : [ "$followersCount", 0 ] },
                  { $subtract : [ "$followersCount" , 1 ] },
                  "$followersCount"
                ]
              }
            }
          }
        ],
      )
    }

    const socketData = {
      userId: currentUserId,
    }

    const receiverSocketId = getReceiverSocketId(fromUser._id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("removeConnection", socketData);
    }

    return res.status(200).json({
      message : `Removed ${fromUser.userName}`,
      userId : fromUser._id,
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
}