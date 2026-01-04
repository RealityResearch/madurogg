const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Game = require('./game');
const RewardManager = require('./rewards');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Game and reward instances
const game = new Game();
const rewards = new RewardManager();

// Simulate adding to reward pool (in production, this comes from on-chain creator fees)
rewards.addToPool(1000000); // Initial pool for testing

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

// ============ API ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: game.players.size });
});

// Get reward stats
app.get('/api/rewards/stats', (req, res) => {
  res.json(rewards.getStats());
});

// Get rewards for a wallet
app.get('/api/rewards/:wallet', (req, res) => {
  const { wallet } = req.params;
  res.json({
    pending: rewards.getPendingRewards(wallet),
    claimed: rewards.getClaimedRewards(wallet),
    nextDistribution: rewards.getTimeUntilNextDistribution()
  });
});

// Register player (simplified - full version uses on-chain)
app.post('/api/register', (req, res) => {
  const { wallet, username, signature, timestamp } = req.body;

  // Verify signature age (must be within 5 minutes)
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Signature expired' });
  }

  // In production, verify signature cryptographically
  // For MVP, we just accept the registration
  console.log(`Player registered: ${username} (${wallet})`);

  res.json({
    success: true,
    wallet,
    username,
    message: 'Registration successful'
  });
});

// Claim rewards
app.post('/api/claim', (req, res) => {
  const { wallet, signature, timestamp } = req.body;

  // Verify signature age
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Signature expired' });
  }

  const result = rewards.claimRewards(wallet);

  if (!result.success) {
    return res.status(400).json(result);
  }

  // In production, trigger on-chain transfer here
  console.log(`Claimed ${result.amount} tokens for ${wallet}`);

  res.json(result);
});

// Get leaderboard (public API)
app.get('/api/leaderboard', (req, res) => {
  res.json(game.getLeaderboard());
});

// ============ REWARD DISTRIBUTION ============

// Hourly reward distribution
setInterval(() => {
  const leaderboard = game.getLeaderboard();
  const snapshot = rewards.distributeRewards(leaderboard);

  if (snapshot) {
    // Broadcast distribution event to all players
    io.emit('rewardDistribution', snapshot);
    console.log('Hourly rewards distributed:', snapshot.distributions.length, 'players');
  }
}, 60 * 60 * 1000); // Every hour

// ============ START SERVER ============

server.listen(PORT, '0.0.0.0', () => {
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
