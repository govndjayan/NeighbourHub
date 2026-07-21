const socketIO = require('socket.io');

const initSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a private room
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
    });

    // NOTE: message delivery is handled by the REST controller
    // (chatController.sendMessage -> req.io.to(roomId).emit('receive_message')),
    // which is the single source of truth. We intentionally do NOT rebroadcast
    // here — doing so delivered every message to the receiver twice.
    // Kept as a no-op for backward compatibility with older app builds that
    // still emit 'send_message'.
    socket.on('send_message', () => {});

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(data.roomId).emit('user_typing', data);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSocket; 
