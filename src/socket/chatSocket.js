const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const setupChatSocket = (io) => {
  const userSockets = new Map(); // userId socketId mapping
  const userLastSeen = new Map(); // userId lastSeen timestamp
  const userRooms = new Map(); // userId  Set of roomIds
  const socketToUser = new Map(); // socketId userId mapping (for disconnect)

  io.on('connection', (socket) => {
    console.log('✅ [SOCKET] New connection established. Socket ID:', socket.id);
    console.log('📊 [SOCKET] Total active connections:', io.engine.clientsCount);

   
    socket.on('joinRoom', async ({ userId, sellerId, productId }) => {
      try {
        console.log('📨 [JOIN] User joining room:', {
          userId,
          sellerId,
          productId,
          socketId: socket.id
        });
        
        if (userId === sellerId || userId.toString() === sellerId.toString()) {
          console.log('⚠️ [JOIN] User trying to chat with themselves, ignoring');
          return;
        }
        socketToUser.set(socket.id, userId);
        userSockets.set(userId, socket.id);
      
        if (!userRooms.has(userId)) {
          userRooms.set(userId, new Set());
        }
        
     
        const roomId = [userId, sellerId].sort().join('_');
        socket.join(roomId);
        userRooms.get(userId).add(roomId);
        console.log('✅ [JOIN] User joined room:', roomId);

    
        io.to(roomId).emit('userStatus', {
          userId: userId,
          isOnline: true,
          lastSeen: new Date()
        });

     
        const otherUserId = sellerId;
        const isOtherUserOnline = userSockets.has(otherUserId);
        const otherUserLastSeen = userLastSeen.get(otherUserId) || new Date();
        
        socket.emit('userStatus', {
          userId: otherUserId,
          isOnline: isOtherUserOnline,
          lastSeen: otherUserLastSeen
        });

      
        // Build query for messages
        // If productId is provided, show:
        // 1. Messages for that specific product
        // 2. Messages without any productId (general chat)
        const messageQuery = {
          $or: [
            { senderId: userId, receiverId: sellerId },
            { senderId: sellerId, receiverId: userId }
          ]
        };
        
        // Don't filter by productId - show all messages between these users
        // This way, when user sends inquiry, they can see previous conversation
        
        const messages = await Message.find(messageQuery)
          .sort({ timestamp: -1 }) // Sort descending (latest first)
          .limit(200) // Increased limit for more history
          .then(msgs => msgs.reverse()); // Reverse to get chronological order

        console.log('📥 [JOIN] Sending previous messages:', messages.length, 'messages (all products)');
        socket.emit('previousMessages', messages);

      
        await Message.updateMany(
          { senderId: sellerId, receiverId: userId, isRead: false },
          { isRead: true }
        );

        const conversation = await Conversation.findOne({
          participants: { $all: [userId, sellerId] }
        });
        
        if (conversation) {
          conversation.unreadCount.set(userId, 0);
          await conversation.save();
        }

      } catch (error) {
        console.error('❌ Error joining room:', error);
      }
    });

   
    socket.on('sendMessage', async (messageData) => {
      try {
        const { 
          senderId, 
          receiverId, 
          message, 
          productId, 
          productImage,
          productName,
          productPrice,
          timestamp 
        } = messageData;
        
        console.log('📤 [MESSAGE] Received message to send:', {
          from: senderId,
          to: receiverId,
          text: message.substring(0, 50),
          productId,
          productImage,
          productName,
          productPrice,
          socketId: socket.id
        });

        // Save message to database
        const newMessage = new Message({
          senderId,
          receiverId,
          message,
          productId,
          productImage,
          productName,
          productPrice,
          timestamp: timestamp || new Date(),
          isRead: false
        });

        await newMessage.save();
        console.log('💾 [MESSAGE] Message saved to database. ID:', newMessage._id);

        
        const roomId = [senderId, receiverId].sort().join('_');
        console.log('📨 [MESSAGE] Broadcasting to room:', roomId);
      
        let conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId] }
        });

        if (conversation) {
          // Update existing conversation
          conversation.lastMessage = message;
          conversation.lastMessageTime = new Date();
          conversation.lastMessageSender = senderId;
          
          // Increment unread count for receiver
          const currentUnreadCount = conversation.unreadCount.get(receiverId) || 0;
          conversation.unreadCount.set(receiverId, currentUnreadCount + 1);
          
          await conversation.save();
        } else {
        
          const unreadCountMap = new Map();
          unreadCountMap.set(receiverId, 1); 
          
          conversation = new Conversation({
            participants: [senderId, receiverId],
            productId: productId || null,
            lastMessage: message,
            lastMessageTime: new Date(),
            lastMessageSender: senderId,
            unreadCount: unreadCountMap
          });
          await conversation.save();
        }

       
        io.to(roomId).emit('newMessage', newMessage);
        console.log('✅ [MESSAGE] Message broadcasted to room:', roomId);

    
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          console.log('🔔 [MESSAGE] Sending notification to receiver:', receiverId);
          io.to(receiverSocketId).emit('newMessageNotification', {
            senderId,
            message,
            productId
          });
        } else {
          console.log('⚠️ [MESSAGE] Receiver not online:', receiverId);
        }

        // Send OneSignal push notification to receiver
        try {
          const User = require('../models/User');
          const { sendChatNotification } = require('../services/oneSignalService');
          
          const sender = await User.findById(senderId);
          const senderName = sender?.name || 'Someone';
          
          await sendChatNotification(receiverId, senderName, message);
          console.log('✅ [PUSH] OneSignal notification sent to receiver:', receiverId);
        } catch (pushError) {
          console.error('❌ [PUSH] Error sending OneSignal notification:', pushError);
        }

      } catch (error) {
        console.error('❌ [MESSAGE] Error sending message:', error);
        console.error('❌ [MESSAGE] Error stack:', error.stack);
      }
    });

  
    socket.on('typing', ({ userId, receiverId }) => {
      const roomId = [userId, receiverId].sort().join('_');
      socket.to(roomId).emit('typing', { userId });
    });

    socket.on('stopTyping', ({ userId, receiverId }) => {
      const roomId = [userId, receiverId].sort().join('_');
      socket.to(roomId).emit('stopTyping', { userId });
    });

    // Handle messages read event
    socket.on('messagesRead', async ({ userId, otherUserId, productId }) => {
      try {
        console.log('✅ [READ] Messages marked as read:', { userId, otherUserId, productId });
        
        // Update conversation unread count
        const conversation = await Conversation.findOne({
          participants: { $all: [userId, otherUserId] }
        });
        
        if (conversation) {
          conversation.unreadCount.set(userId, 0);
          await conversation.save();
          
          // Emit badge update to the user who read the messages
          const userSocketId = userSockets.get(userId);
          if (userSocketId) {
            io.to(userSocketId).emit('badgeUpdate', {
              userId: userId,
              unreadCount: 0
            });
          }
        }
      } catch (error) {
        console.error('❌ [READ] Error handling messages read:', error);
      }
    });

  
    socket.on('disconnect', () => {
      console.log('🔌 [SOCKET] Client disconnected. Socket ID:', socket.id);
    
      const userId = socketToUser.get(socket.id);
      
      if (userId) {
        const disconnectTime = new Date();
        
       
        userSockets.delete(userId);
        socketToUser.delete(socket.id);
        userLastSeen.set(userId, disconnectTime);
        
        console.log(`❌ [DISCONNECT] User ${userId} disconnected at ${disconnectTime}`);
        
        
        const rooms = userRooms.get(userId);
        if (rooms && rooms.size > 0) {
      
          rooms.forEach(roomId => {
            io.to(roomId).emit('userStatus', {
              userId: userId,
              isOnline: false,
              lastSeen: disconnectTime
            });
          });
          
         
          userRooms.delete(userId);
        }
      }
    });
  });
};

module.exports = setupChatSocket;
