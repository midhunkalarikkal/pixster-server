import multer from 'multer';
import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { getMessages, getUsersForSidebar, sendMessage } from '../controllers/message.controller.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.get('/users', protectRoute, getUsersForSidebar);

router.get('/:id', protectRoute, getMessages);

router.post('/send/:id',upload.single("messageImage"), protectRoute, sendMessage);

export default router;