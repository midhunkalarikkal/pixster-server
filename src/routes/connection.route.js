import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { acceptConnection, cancelConnection, rejectConnection, removeConnection, requestConnection, unfollowConnection } from '../controllers/connection.controller.js';

const router = express.Router();

router.post('/sendConnectionRequest/:toUserId', protectRoute, requestConnection);
router.post('/acceptConnectionRequest/:toUserId', protectRoute, acceptConnection);
router.post('/rejectConnectionRequest/:toUserId', protectRoute, rejectConnection);
router.post('/cancelConnectionRequest/:toUserId', protectRoute, cancelConnection);
router.post('/unFollowConnectionRequest/:toUserId', protectRoute, unfollowConnection);
router.post('/removeConnection/:fromUserId', protectRoute, removeConnection)

export default router;