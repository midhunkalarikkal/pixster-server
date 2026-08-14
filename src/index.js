import cors from 'cors';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { connectDB } from './lib/db.js';

import authRouter from './routes/auth.route.js';
import messageRouter from './routes/message.route.js';
import connectionRouter from './routes/connection.route.js';
import userRouter from './routes/user.router.js';
import postRouter from './routes/post.router.js';
import storyRouter from './routes/story.route.js';
import { app, server } from './lib/socket.js';

import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

app.use(express.json({
    limit: '50mb'
  }));
app.use(cookieParser());
app.use(cors({
    origin : "http://localhost:5173",
    credentials : true
}));


app.use("/api/auth", authRouter);
app.use("/api/messages", messageRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/story",storyRouter);

if(process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("*", (req,res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist" , "index.html"))
    })
}

server.listen(PORT,() => {
    console.log(`Server is running on post ${PORT}`);
    connectDB();
})