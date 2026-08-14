import mongoose from "mongoose";

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ["requested", "accepted", "rejected", "cancelled", "unfollowed", "followed", "removed"],
        message: "{VALUES} is incorrect status type.",
      },
    },
  },
  { timestamps: true }
);

connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

const Connection = mongoose.model(
  "Connection",
  connectionRequestSchema
);
export default Connection;
