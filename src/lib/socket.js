import http from "http";
import express from "express";
import { redis } from "./redis.js";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export async function getReceiverSocketId(userId) {
  // return userSocketMap[userId];
  return await redis.get(`socket:${userId}`);
}

async function getOnlineUsers() {
  const keys = await redis.keys("socket:*");
  const onlineUsers = [];

  for(const key of keys) {
    const userId = key.split(":")[1];
    onlineUsers.push(userId);
  }

  return onlineUsers;
}

// const userSocketMap = {};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    // userSocketMap[userId] = socket.id;
    redis.set(`socket:${userId}`,socket.id);
  }

  // io.emit("getOnlineUsers", Object.keys(userSocketMap));
  io.emit("getOnlineUsers", getOnlineUsers());

  socket.on("typing", async ({ fromUserId, toUserId }) => {
    // const toSocketId = userSocketMap[toUserId];
    const toSocketId = await redis.get(`socket:${toUserId}`);
    if (toSocketId) {
      io.to(toSocketId).emit("typing", { fromUserId, toUserId });
    }
  });

  socket.on("stopTyping", async ({ fromUserId, toUserId }) => {
    // const toSocketId = userSocketMap[toUserId];
    const toSocketId = await redis.get(`socket:${toUserId}`);
    if (toSocketId) {
      io.to(toSocketId).emit("stopTyping", { fromUserId, toUserId });
    }
  });

  socket.on("disconnect", async () => {
    // delete userSocketMap[userId];
    await redis.del(`socket:${userId}`);
    // io.emit("getOnlineUsers", Object.keys(userSocketMap));
    io.emit("getOnlineUsers", await getOnlineUsers());
  });
});

export { io, app, server };
