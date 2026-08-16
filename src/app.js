import cors from 'cors';
import helmet from 'helmet';
import express from 'express';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth.route.js';
import userRouter from './routes/user.router.js';
import postRouter from './routes/post.router.js';
import storyRouter from './routes/story.route.js';
import messageRouter from './routes/message.route.js';
import connectionRouter from './routes/connection.route.js';

import { app } from './lib/socket.js';
import { errorHandler } from './middleware/error.middleware.js';

app.use(helmet());

app.use(
    express.json({
        limit: '5mb',
    }),
);

app.use(cookieParser());

app.use(
    cors({
        origin:
            process.env.NODE_ENV === 'development'
                ? process.env.CLIENT_URL_DEV
                : process.env.CLIENT_URL_PROD,
        credentials: true,
    }),
);

app.use('/api/auth', authRouter);
app.use('/api/messages', messageRouter);
app.use('/api/connection', connectionRouter);
app.use('/api/user', userRouter);
app.use('/api/post', postRouter);
app.use('/api/story', storyRouter);

app.use(errorHandler);

export default app;
