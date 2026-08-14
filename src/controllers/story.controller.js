import Story from "../models/story.model.js";
import { Upload } from "@aws-sdk/lib-storage";
import { generateS3Key } from "../utils/helper.js";
import Connection from "../models/connection.model.js";
import { generateSignedUrl, s3Client } from "../utils/aws.config.js";

import dotenv from "dotenv";
dotenv.config();

export const uploadStory = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const file = req.file;

    if (!currentUserId) {
      return res.status(400).json({ message: "User not found." });
    }

    if (!file) {
      return res.status(400).json({ message: "Image not found." });
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

    const newStory = new Story({
      userId: currentUserId,
      img: s3UploadResponse.Location,
    });

    const updatedStory = await newStory.save();

    updatedStory.img = await generateSignedUrl(updatedStory.img);

    return res.status(201).json({
      success: true,
      message: "Story uploaded successfully",
      story: updatedStory,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getStories = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    if (!currentUserId) {
      return res.status(404).json({ message: " Please login again." });
    }

    let myStory = await Story.findOne({ userId: currentUserId });

    let Stories = await Connection.aggregate([
      {
        $match: {
          $and: [{ status: "accepted" }, { fromUserId: currentUserId }],
        },
      },
      {
        $lookup: {
          from: "stories",
          localField: "toUserId",
          foreignField: "userId",
          as: "usersStories",
        },
      },
      {
        $unwind: "$usersStories",
      },
      {
        $project: {
          _id: 0,
          userId: "$usersStories.userId",
          img: "$usersStories.img",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "User",
        },
      },
      {
        $unwind: "$User",
      },
      {
        $project: {
          _id: 0,
          userId: 1,
          img: 1,
          userName: "$User.userName",
        },
      },
    ]);

    if (myStory) myStory.img = await generateSignedUrl(myStory.img);
    if (Stories.length > 0) {
      Stories = await Promise.all(
        Stories.map(async (story) => {
          const signedUrl = await generateSignedUrl(story.img);

          return {
            ...story,
            img: signedUrl,
          };
        })
      );
    }

    return res.status(200).json({ myStory, stories: Stories });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const deleteMyStory = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    if (!currentUserId) {
      return res.status(404).json({ message: "Invalid request" });
    }

    const deleteMyStory = await Story.findOneAndDelete({
      userId: currentUserId,
    });
    if (deleteMyStory) {
      return res.status(200).json({ success: true, message: "Storydeleted" });
    } else {
      return res.status(400).json({ message: "Story dletion failed" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};
