import multer from 'multer';
import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { checkAuth, login, logout, removeProfile, resendOtp, resetPassword, signup, updateProfile, verifyOtp } from '../controllers/auth.controller.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.post('/signup', signup);

router.post('/verifyOtp', verifyOtp);

router.post('/resendOtp', resendOtp);

router.post('/resetPassword', resetPassword);

router.post('/login',login);

router.post('/logout', logout);

router.put('/update-profile', protectRoute, upload.single('profilePic'), updateProfile);

router.put('/remove-profile', protectRoute, removeProfile);

router.get('/check', protectRoute, checkAuth);

export default router;