const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Product = require('../models/product');


const getConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await Conversation.find({
      participants: userId
    })
      .sort({ lastMessageTime: -1 })
      .populate('participants', 'name image')
      .populate('productId', 'name');

    // Get product details for each conversation
    const formattedConversations = await Promise.all(conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find(
        (p) => p._id.toString() !== userId
      );

      let productImage = null;
      let productPrice = null;
      
      // If conversation has a productId, get the latest message with product details
      if (conv.productId) {
        const latestMessageWithProduct = await Message.findOne({
          $or: [
            { senderId: userId, receiverId: otherParticipant._id },
            { senderId: otherParticipant._id, receiverId: userId }
          ],
          productId: conv.productId._id,
          $or: [
            { productImage: { $exists: true, $ne: null } },
            { productPrice: { $exists: true, $ne: null } }
          ]
        }).sort({ timestamp: -1 });

        if (latestMessageWithProduct) {
          productImage = latestMessageWithProduct.productImage;
          productPrice = latestMessageWithProduct.productPrice;
        }
      }

      return {
        conversationId: conv._id,
        
        sellerId: otherParticipant._id,
        sellerName: otherParticipant.name,
        sellerImage: otherParticipant.image,
        customerId: otherParticipant._id, // Same as sellerId, just different name
        customerName: otherParticipant.name,
        customerImage: otherParticipant.image,
        productId: conv.productId?._id,
        productName: conv.productId?.name,
        productImage: productImage,
        productPrice: productPrice,
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount?.get(userId) || 0
      };
    }));

    res.json({
      status: true,
      data: formattedConversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      status: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
};


const getMessages = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    const { productId } = req.query;

    const query = {
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    };

    if (productId) {
      query.productId = productId;
    }

    const messages = await Message.find(query).sort({ timestamp: 1 }).limit(100);


    await Message.updateMany(
      { senderId: otherUserId, receiverId: userId, isRead: false },
      { isRead: true }
    );

    res.json({
      status: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      status: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};


const markMessagesAsRead = async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;

    await Message.updateMany(
      { senderId: otherUserId, receiverId: userId, isRead: false },
      { isRead: true }
    );

    res.json({
      status: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      status: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
};


const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false
    });

    res.json({
      status: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      status: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  markMessagesAsRead,
  getUnreadCount
};
