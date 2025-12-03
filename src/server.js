require('dotenv').config();

require('module-alias/register');
const http = require('http');
const socketIO = require('socket.io');
const app = require('./app');
const setupChatSocket = require('./socket/chatSocket');

const PORT = process.env.PORT || 5000;


const server = http.createServer(app);


const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], 
  allowEIO3: true, 
  pingTimeout: 60000, 
  pingInterval: 25000, 
  upgradeTimeout: 30000, 
  maxHttpBufferSize: 1e6, 
  allowUpgrades: true,
  perMessageDeflate: false, 
  httpCompression: false
});


io.on('connection', (socket) => {
 
  
  socket.conn.on('upgrade', (transport) => {
    console.log('⬆️ [SERVER] Transport upgraded to:', transport.name);
  });
});


setupChatSocket(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`💬 Socket.IO chat server ready`);
});
