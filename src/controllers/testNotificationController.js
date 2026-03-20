const { sendNotification } = require('../services/oneSignalService');
const User = require('../models/User');

const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user || !user.oneSignalPlayerId) {
      return res.status(400).json({
        success: false,
        message: 'User not found or OneSignal Player ID not set',
        userId: userId,
        playerId: user?.oneSignalPlayerId || null
      });
    }

    const result = await sendNotification(
      user.oneSignalPlayerId,
      'Test Notification',
      'This is a test notification from MacheGlobal!',
      { type: 'test' }
    );

    return res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
      playerId: user.oneSignalPlayerId,
      result: result
    });
  } catch (error) {
    console.error('Test notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
};

module.exports = {
  sendTestNotification
};
