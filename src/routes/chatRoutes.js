const express = require('express');
const router = express.Router();
const chatController = require('@controllers/chatController');

// Get all conversations for a user
router.get('/conversations/:userId', chatController.getConversations);

// Get messages between two users
router.get('/messages/:userId/:otherUserId', chatController.getMessages);

// Mark messages as read
router.post('/messages/mark-read', chatController.markMessagesAsRead);

// Get unread message count
router.get('/unread-count/:userId', chatController.getUnreadCount);

module.exports = router;
