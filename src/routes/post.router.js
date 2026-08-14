import multer from 'multer';
import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { addComment, deleteComment, deletePost, getComments, likeOrDislikeComment, likeOrDislikePost, savePost, updatePost, uploadPost } from '../controllers/post.controller.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.post('/uploadPost', protectRoute, upload.single('postImage'), uploadPost);
router.delete('/deletePost/:postId', protectRoute, deletePost);
router.post('/updatePost/:postId',protectRoute, upload.single('postImage'), updatePost);
router.put(`/likeOrDislikePost/:postId`, protectRoute, likeOrDislikePost);
router.post('/savePost/:postId',protectRoute, savePost);
router.post('/addComment', protectRoute, addComment);
router.get('/getComments/:postId',protectRoute, getComments);
router.delete('/deleteComment/:postId/:commentId', protectRoute, deleteComment);
router.put('/likeOrDislikeComment/:commentId', protectRoute, likeOrDislikeComment);

export default router;