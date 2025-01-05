const { Server } = require('socket.io');

module.exports = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    res.end();
    return;
  }

  const io = new Server(res.socket.server);
  res.socket.server.io = io;

  io.on('connection', socket => {
    console.log('Client connected');

    socket.on('drawLine', data => {
      socket.broadcast.emit('drawLine', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  console.log('Socket is initialized');
  res.end();
}; 