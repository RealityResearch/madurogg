const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Game instance
const game = new Game();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Get player count
  socket.on('getPlayerCount', () => {
    socket.emit('playerCount', game.players.size);
  });

  // Player joins with username and wallet
  socket.on('join', (data) => {
    const player = game.addPlayer(socket.id, data.username, data.wallet);
    socket.emit('joined', {
      id: socket.id,
      player,
      worldSize: game.worldSize
    });
    console.log(`${data.username} joined the game`);
  });

  // Player input
  socket.on('input', (data) => {
    game.handleInput(socket.id, data);
  });

  // Player split
  socket.on('split', () => {
    game.splitPlayer(socket.id);
  });

  // Player eject mass
  socket.on('eject', () => {
    game.ejectMass(socket.id);
  });

  // Disconnect
  socket.on('disconnect', () => {
    game.removePlayer(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Game loop - 60 ticks per second
const TICK_RATE = 1000 / 60;
setInterval(() => {
  game.update();

  // Broadcast game state to all players
  const state = game.getState();
  io.emit('state', state);
}, TICK_RATE);

// Leaderboard broadcast - every second
setInterval(() => {
  const leaderboard = game.getLeaderboard();
  io.emit('leaderboard', leaderboard);
}, 1000);

server.listen(PORT, () => {
  console.log(`
  ████████╗██████╗ ██╗   ██╗███╗   ███╗██████╗ ██╗    ██╗ ██████╗ ██████╗ ███╗   ███╗
  ╚══██╔══╝██╔══██╗██║   ██║████╗ ████║██╔══██╗██║    ██║██╔═══██╗██╔══██╗████╗ ████║
     ██║   ██████╔╝██║   ██║██╔████╔██║██████╔╝██║ █╗ ██║██║   ██║██████╔╝██╔████╔██║
     ██║   ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝ ██║███╗██║██║   ██║██╔══██╗██║╚██╔╝██║
     ██║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║     ╚███╔███╔╝╚██████╔╝██║  ██║██║ ╚═╝ ██║
     ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝      ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝

  Server running on http://localhost:${PORT}
  `);
});
