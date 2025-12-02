const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const setupChatSocket = (io) => {
  const userSockets = new Map(); // userId socketId mapping
  const userLastSeen = new Map(); // userId lastSeen timestamp
  const userRooms = new Map(); // userId  Set of roomIds
  const socketToUser = new Map(); // socketId userId mapping (for disconnect)

  io.on('connection', (socket) => {
   

   
    socket.on('joinRoom', async ({ userId, sellerId, productId }) => {
      try {
        
        if (userId === sellerId || userId.toString() === sellerId.toString()) {
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

      
        const messages = await Message.find({
          $or: [
            { senderId: userId, receiverId: sellerId },
            { senderId: sellerId, receiverId: userId }
          ],
          ...(productId && { productId })
        })
        .sort({ timestamp: 1 })
        .limit(50);

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
        const { senderId, receiverId, message, productId, timestamp } = messageData;

        // Save message to database
        const newMessage = new Message({
          senderId,
          receiverId,
          message,
          productId,
          timestamp: timestamp || new Date(),
          isRead: false
        });

        await newMessage.save();

        
        const roomId = [senderId, receiverId].sort().join('_');
      
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

    
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('newMessageNotification', {
            senderId,
            message,
            productId
          });
        }

      } catch (error) {
        console.error('❌ Error sending message:', error);
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

  
    socket.on('disconnect', () => {
    
      const userId = socketToUser.get(socket.id);
      
      if (userId) {
        const disconnectTime = new Date();
        
       
        userSockets.delete(userId);
        socketToUser.delete(socket.id);
        userLastSeen.set(userId, disconnectTime);
        
        console.log(`❌ User ${userId} disconnected`);
        
        
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
