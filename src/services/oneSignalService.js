const axios = require('axios');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

const sendNotification = async (playerIds, title, message, data = {}) => {
  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: Array.isArray(playerIds) ? playerIds : [playerIds],
        headings: { en: title },
        contents: { en: message },
        data: data
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('OneSignal Error:', error.response?.data || error.message);
    throw error;
  }
};

const sendOrderNotification = async (userId, orderId, orderStatus) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user || !user.oneSignalPlayerId) {
      return null;
    }

    const messages = {
      pending: 'Your order has been placed successfully!',
      confirmed: 'Your order has been confirmed!',
      shipped: 'Your order has been shipped!',
      delivered: 'Your order has been delivered!',
      cancelled: 'Your order has been cancelled.'
    };

    return await sendNotification(
      user.oneSignalPlayerId,
      'Order Update',
      messages[orderStatus] || 'Your order status has been updated.',
      { type: 'order', orderId, status: orderStatus }
    );
  } catch (error) {
    console.error('Send order notification error:', error);
    return null;
  }
};

const sendChatNotification = async (receiverId, senderName, message) => {
  try {
    const User = require('../models/User');
    const receiver = await User.findById(receiverId);
    
    if (!receiver || !receiver.oneSignalPlayerId) {
      return null;
    }

    return await sendNotification(
      receiver.oneSignalPlayerId,
      `New message from ${senderName}`,
      message,
      { type: 'chat', senderId: receiverId }
    );
  } catch (error) {
    console.error('Send chat notification error:', error);
    return null;
  }
};

const sendSellerVerificationNotification = async (sellerId, isApproved) => {
  try {
    const User = require('../models/User');
    const seller = await User.findById(sellerId);
    
    if (!seller || !seller.oneSignalPlayerId) {
      return null;
    }

    const title = isApproved ? 'Store Approved!' : 'Store Rejected';
    const message = isApproved 
      ? 'Congratulations! Your store has been approved by admin.'
      : 'Sorry, your store application has been rejected. Please contact support.';

    return await sendNotification(
      seller.oneSignalPlayerId,
      title,
      message,
      { type: 'seller_verification', isApproved }
    );
  } catch (error) {
    console.error('Send seller verification notification error:', error);
    return null;
  }
};

module.exports = {
  sendNotification,
  sendOrderNotification,
  sendChatNotification,
  sendSellerVerificationNotification
};
