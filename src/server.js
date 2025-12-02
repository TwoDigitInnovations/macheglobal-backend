require('dotenv').config();

require('module-alias/register');
const http = require('http');
const socketIO = require('socket.io');
const app = require('./app');
const setupChatSocket = require('./socket/chatSocket');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Setup chat socket handlers
setupChatSocket(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`💬 Socket.IO chat server ready`);
});
