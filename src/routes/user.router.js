import multer from 'multer';
import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { changeAccountType, fetchFollowersAccounts, fetchFollowingAccounts, fetchIncomingRequestedAccounts, fetchMediaGrid, fetchMyThreads, fetchNotifications, fetchRequestedAccounts, fetchSearchedUserProfile, fetchSuggestions, fetchUserPosts, fetchUserSavedPosts, homeScrollerData, searchUsers, updateAbout } from '../controllers/user.controller.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.get('/getHomseSrollerData', protectRoute, homeScrollerData)
router.get('/searchUsers', protectRoute, searchUsers);
router.get('/fetchSearchedUserProfile/:userId', protectRoute, fetchSearchedUserProfile);
router.get('/fetchRequestedProfiles', protectRoute, fetchRequestedAccounts);
router.get('/fetchIncomingRequestedProfiles', protectRoute, fetchIncomingRequestedAccounts);
router.get('/fetchFollowingProfiles/:userId', protectRoute, fetchFollowingAccounts);
router.get('/fetchFollowersProfiles/:userId', protectRoute, fetchFollowersAccounts);
router.get('/fetchNotifications', protectRoute, fetchNotifications);
router.get('/getSuggestions', protectRoute, fetchSuggestions);
router.get('/getUserPosts/:userId', protectRoute, fetchUserPosts);
router.get('/getUserSavedPosts', protectRoute, fetchUserSavedPosts);
router.get('/getMediaGrid', protectRoute, fetchMediaGrid);
router.get('/getUserThreads/:userId', protectRoute, fetchMyThreads);
router.put('/updateAbout', protectRoute, updateAbout);
router.put('/changeAccountType', protectRoute, changeAccountType);

export default router;