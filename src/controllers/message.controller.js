import { Upload } from "@aws-sdk/lib-storage";
import Message from "../models/message.model.js";
import Connection from "../models/connection.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { generateSignedUrl, s3Client } from "../utils/aws.config.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const users = await Connection.aggregate([
      {
        $match: {
          status: "accepted",
          $or: [{ fromUserId: currentUserId }, { toUserId: currentUserId }],
        },
      },
      {
        $project: {
          otherUserId: {
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
          _id: "$otherUserId",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $unwind: "$userData",
      },
      {
        $project: {
          _id: "$userData._id",
          fullName: "$userData.fullName",
          userName: "$userData.userName",
          profilePic: "$userData.profilePic",
          __v: "$userData.__v",
        },
      },
    ]);

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

    return res.status(200).json({ users: updatedUsers });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const currentUserId = req.user._id;

    let messages = await Message.find({
      $or: [
        { senderId: currentUserId, recieverId: userToChatId },
        { senderId: userToChatId, recieverId: currentUserId },
      ],
    }).lean();

    if (messages.length > 0) {
      messages = await Promise.all(
        messages.map(async (message) => {
          if (!message.image) return message;

          const signedUrl = await generateSignedUrl(message.image);

          return {
            ...message,
            image: signedUrl,
          };
        })
      );
    }

    return res.status(200).json(messages);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const file = req.file;

    const { id: recieverId } = req.params;
    const currentUserId = req.user._id;

    let imageUrl;
    if (file) {
      const key = generateS3Key({
        folder: "pixsterUsersMessageImages",
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
      imageUrl = s3UploadResponse.Location;
    }

    const newMessage = new Message({
      senderId: currentUserId,
      recieverId,
      text,
      image: imageUrl,
    });
    await newMessage.save();

    if (newMessage.image) {
      newMessage.image = await generateSignedUrl(newMessage.image);
    }

    const receiverSocketId = getReceiverSocketId(recieverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    return res.status(201).json(newMessage);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};
