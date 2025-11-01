const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { 
  getUserNotifications, 
  markAsRead 
} = require('../controllers/notificationController');

// Get user notifications
router.get('/', authenticate, getUserNotifications);

// Mark notification as read
router.put('/:id/read', authenticate, markAsRead);

module.exports = router;
