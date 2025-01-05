const { Server } = require('socket.io');

module.exports = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    path: '/socket.io',
    transports: ['websocket'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  res.socket.server.io = io;

  io.on('connection', socket => {
    console.log('Client connected');

    socket.on('drawLine', data => {
      console.log('Line drawn:', data);
      socket.broadcast.emit('drawLine', data);
    });

    socket.on('finish', () => {
      socket.broadcast.emit('finish');
    });

    socket.on('reset', () => {
      socket.broadcast.emit('reset');
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  console.log('Socket is initialized');
  res.end();
}; 