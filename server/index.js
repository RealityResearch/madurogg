const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Game = require('./game');
const Arena = require('./arena');
const RewardManager = require('./rewards');
const { PumpAPI } = require('./pump');

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

// Reward manager instance (created before RoomManager)
let rewards; // Will be initialized after TOKEN_CONFIG

// Token Configuration
const TOKEN_CONFIG = {
  mint: process.env.TOKEN_MINT || 'CmgJ1PobhUqB7MEa8qDkiG2TUpMTskWj8d9JeZWSpump',
  creator: process.env.CREATOR_WALLET || 'APiYhkSwfR3nEZWSixtHmMbdL1JxK3R6APHSysemNf7y',
  supply: 1_000_000_000, // 1 billion (pump.fun standard)
  creatorFeeRate: 0.003  // 0.3% on bonding curve
};

// Site-wide configuration (editable via admin panel)
const SITE_CONFIG = {
  tokenMint: TOKEN_CONFIG.mint,
  creatorWallet: TOKEN_CONFIG.creator,
  contractAddress: process.env.CONTRACT_ADDRESS || 'DLLQxjjnjiyRQHFt7Q63G7TLvVu9WAf4aCyd2q1qPAbF',
  vrfContract: process.env.VRF_CONTRACT || '',
  twitter: process.env.TWITTER_URL || '',
  telegram: process.env.TELEGRAM_URL || '',
  discord: process.env.DISCORD_URL || '',
  pumpUrl: process.env.PUMP_URL || `https://pump.fun/coin/${TOKEN_CONFIG.mint}`
};

// Moralis API for Solana token data
const MORALIS_CONFIG = {
  apiKey: process.env.MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ijk4Yjk2ZDU5LWI5NGEtNDU1Ni1iODZhLTU2N2U3MjI1OGJiNSIsIm9yZ0lkIjoiNDcxNzAwIiwidXNlcklkIjoiNDg1MjQwIiwidHlwZUlkIjoiNzQxNmFmMjctNGUwYi00MmUwLWE1ZDQtNmUyNzUzMWIxYWE3IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTg0MDY4OTYsImV4cCI6NDkxNDE2Njg5Nn0.2RlOOP4xlGCy0GwQkb7FJIVCP1fhxxFVKiLT4g18Jd4',
  baseUrl: 'https://solana-gateway.moralis.io'
};

// Pump.fun API for creator fee tracking
const pumpAPI = new PumpAPI({
  creator: TOKEN_CONFIG.creator,
  mint: TOKEN_CONFIG.mint,
  interval: process.env.PUMP_INTERVAL || '30m',
  limit: parseInt(process.env.PUMP_LIMIT || '336')
});

// Fetch token price from Moralis
async function getTokenPrice(tokenAddress) {
  try {
    const response = await fetch(
      `${MORALIS_CONFIG.baseUrl}/token/mainnet/${tokenAddress}/price`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_CONFIG.apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Moralis price fetch error:', error.message);
    return null;
  }
}

rewards = new RewardManager({
  tokenMint: TOKEN_CONFIG.mint,
  creatorWallet: TOKEN_CONFIG.creator,
  adminSecret: process.env.ADMIN_SECRET,
  autoAddFeesToPool: true,
  tokenSupply: TOKEN_CONFIG.supply,
  creatorFeeRate: TOKEN_CONFIG.creatorFeeRate
});

// Single arena (one game, queue system, spectators)
const arena = new Arena(io, rewards);

// Start arena game loop
const TICK_RATE = 1000 / 60;
setInterval(() => {
  arena.update();
  const state = arena.getState();
  io.to('arena').emit('state', state);
  io.to('spectators').emit('state', state); // Spectators see the game too
}, TICK_RATE);

// Leaderboard broadcast every second
setInterval(() => {
  const leaderboard = arena.getLeaderboard();
  arena.broadcast('leaderboard', leaderboard);
}, 1000);

if (!process.env.ADMIN_SECRET) {
  console.warn('\n⚠️  WARNING: ADMIN_SECRET not set! Admin endpoints will be disabled.');
  console.warn('   Set it with: ADMIN_SECRET=your-secret-here npm run dev\n');
}

console.log(`\n📊 Token: ${TOKEN_CONFIG.mint}`);
console.log(`👛 Creator: ${TOKEN_CONFIG.creator}\n`);

// Add initial test pool if configured
if (process.env.INITIAL_POOL) {
  rewards.addToPool(parseInt(process.env.INITIAL_POOL), null, 'initial');
} else {
  // Default test pool
  rewards.addToPool(1000000, null, 'test');
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Get arena info for lobby
  socket.on('getArenaInfo', () => {
    socket.emit('arenaInfo', arena.getInfo());
  });

  // Get player count
  socket.on('getPlayerCount', () => {
    const info = arena.getInfo();
    socket.emit('playerCount', info.players + info.queue + info.spectators);
  });

  // Player joins with username and wallet
  socket.on('join', (data) => {
    const result = arena.joinGame(socket, data.username, data.wallet);

    if (result.success) {
      socket.emit('joined', {
        id: socket.id,
        mode: result.mode, // 'arena', 'queue', or 'spectator'
        player: result.player,
        worldSize: result.worldSize,
        position: result.position, // queue position if queued
        state: result.state,
        timeRemaining: result.timeRemaining,
        roundNumber: result.roundNumber,
        config: Arena.CONFIG
      });
      console.log(`${data.username} joined as ${result.mode}`);
    } else {
      socket.emit('joinError', { error: result.error });
    }
  });

  // Player input
  socket.on('input', (data) => {
    arena.handleInput(socket.id, data);
  });

  // Player split
  socket.on('split', () => {
    arena.splitPlayer(socket.id);
  });

  // Player eject mass
  socket.on('eject', () => {
    arena.ejectMass(socket.id);
  });

  // Spectator requests to play again (replaces requeue for continuous mode)
  socket.on('requeue', () => {
    const result = arena.playAgain(socket.id);
    if (result.success) {
      if (result.mode === 'arena') {
        socket.emit('joined', {
          id: socket.id,
          mode: 'arena',
          player: result.player,
          worldSize: result.worldSize,
          state: result.state,
          timeUntilReward: result.timeUntilReward,
          config: Arena.CONFIG
        });
      } else {
        // Lobby full, back to spectator
        socket.emit('lobbyFull', {
          message: result.message,
          watching: result.watching,
          watchingId: result.watchingId
        });
      }
    } else {
      socket.emit('requeueError', { error: result.error });
    }
  });

  // Spectator changes who they're watching
  socket.on('spectatePlayer', (data) => {
    arena.spectatePlayer(socket.id, data.targetId);
  });

  // Disconnect
  socket.on('disconnect', () => {
    arena.removePlayer(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// ============ API ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
  const info = arena.getInfo();
  res.json({
    status: 'ok',
    players: info.players,
    queue: info.queue,
    spectators: info.spectators,
    state: info.state,
    roundNumber: info.roundNumber
  });
});

// Get token info (for frontend) - uses Moralis API
app.get('/api/token', async (req, res) => {
  try {
    // Fetch price from Moralis
    const priceData = await getTokenPrice(TOKEN_CONFIG.mint);
    const rewardStats = rewards.getStats();

    if (priceData) {
      const price = priceData.usdPrice || 0;
      const marketCap = price * TOKEN_CONFIG.supply;

      res.json({
        mint: TOKEN_CONFIG.mint,
        creator: TOKEN_CONFIG.creator,
        name: priceData.name || 'MADURO',
        symbol: priceData.symbol || 'MADURO',
        supply: TOKEN_CONFIG.supply,
        price: price,
        priceNative: priceData.nativePrice?.value || 0,
        marketCap: marketCap,
        exchange: priceData.exchangeName || 'unknown',
        // Reward stats
        rewardPool: rewardStats.pool,
        totalDistributed: rewardStats.totalDistributed,
        nextDistribution: rewardStats.timeUntilNext
      });
    } else {
      throw new Error('No price data');
    }
  } catch (error) {
    console.error('Token fetch error:', error.message);
    const rewardStats = rewards.getStats();
    res.json({
      mint: TOKEN_CONFIG.mint,
      creator: TOKEN_CONFIG.creator,
      name: 'MADURO',
      symbol: 'MADURO',
      supply: TOKEN_CONFIG.supply,
      marketCap: 0,
      error: 'Unable to fetch live data',
      rewardPool: rewardStats.pool,
      totalDistributed: rewardStats.totalDistributed,
      creatorFeesTracked: rewardStats.creatorFees?.totalTracked || 0,
      nextDistribution: rewardStats.timeUntilNext
    });
  }
});

// Get reward stats
app.get('/api/rewards/stats', (req, res) => {
  res.json(rewards.getStats());
});

// Get pump.fun fee stats (creator fees, 24h volume, holders)
app.get('/api/pump', async (req, res) => {
  try {
    const stats = await pumpAPI.getStats();

    if (stats.error) {
      return res.status(502).json({ error: stats.error });
    }

    // Add reward pool info
    const rewardStats = rewards.getStats();
    stats.rewardPool = rewardStats.pool;
    stats.totalDistributed = rewardStats.totalDistributed;

    res.json(stats);
  } catch (error) {
    console.error('[/api/pump] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
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

// Get leaderboard (public API) - returns arena leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json(arena.getLeaderboard());
});

// Get arena info
app.get('/api/arena', (req, res) => {
  res.json(arena.getInfo());
});

// Get distribution history (public API)
app.get('/api/distributions', (req, res) => {
  res.json(arena.getDistributionHistory());
});

// Get transparency stats (public - prize wallet, totals, etc.)
app.get('/api/transparency', async (req, res) => {
  const solanaStatus = arena.solanaDistributor.getStatus();
  const distributions = arena.getDistributionHistory();
  const balance = await arena.solanaDistributor.getWalletBalance();

  // Calculate total from distribution history
  const totalFromHistory = distributions.reduce((sum, d) => {
    return sum + (d.distribution?.totalSent || 0);
  }, 0);

  res.json({
    prizeWallet: solanaStatus.prizeWallet,
    network: solanaStatus.network,
    stats: {
      balance,
      totalDistributed: solanaStatus.stats.totalDistributed || totalFromHistory,
      distributionCount: solanaStatus.stats.distributionCount || distributions.length,
      maxPrizePerRound: solanaStatus.maxPrizePerRound
    },
    recentDistributions: distributions.slice(0, 10),
    lastUpdated: Date.now()
  });
});

// Get site configuration (public - for How It Works page, etc.)
app.get('/api/config', (req, res) => {
  res.json(SITE_CONFIG);
});

// ============ ADMIN ENDPOINTS ============

// Admin: Add to reward pool
app.post('/api/admin/pool/add', (req, res) => {
  const { amount, adminSecret } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const result = rewards.addToPool(amount, adminSecret, 'admin');
  if (!result.success) {
    return res.status(403).json(result);
  }

  res.json(result);
});

// Admin: Get detailed stats
app.get('/api/admin/stats', (req, res) => {
  const { adminSecret } = req.query;
  const result = rewards.getAdminStats(adminSecret);

  if (!result.success && result.error) {
    return res.status(403).json(result);
  }

  res.json(result);
});

// Admin: Force reward distribution
app.post('/api/admin/distribute', async (req, res) => {
  const { adminSecret } = req.body;

  if (!rewards.validateAdmin(adminSecret)) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }

  try {
    await arena.distributeRewards();
    res.json({
      success: true,
      message: 'Forced reward distribution',
      solanaStatus: arena.solanaDistributor.getStatus()
    });
  } catch (error) {
    res.json({
      success: false,
      message: `Distribution failed: ${error.message}`
    });
  }
});

// Admin: Configure reward manager
app.post('/api/admin/configure', (req, res) => {
  const { adminSecret, config } = req.body;
  const result = rewards.configure(config, adminSecret);

  if (!result.success) {
    return res.status(403).json(result);
  }

  res.json(result);
});

// Admin: Update site configuration
app.post('/api/admin/config', (req, res) => {
  const { adminSecret, config } = req.body;

  if (!rewards.validateAdmin(adminSecret)) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }

  // Update allowed fields
  if (config.tokenMint) SITE_CONFIG.tokenMint = config.tokenMint;
  if (config.creatorWallet) SITE_CONFIG.creatorWallet = config.creatorWallet;
  if (config.contractAddress) SITE_CONFIG.contractAddress = config.contractAddress;
  if (config.vrfContract !== undefined) SITE_CONFIG.vrfContract = config.vrfContract;
  if (config.twitter !== undefined) SITE_CONFIG.twitter = config.twitter;
  if (config.telegram !== undefined) SITE_CONFIG.telegram = config.telegram;
  if (config.discord !== undefined) SITE_CONFIG.discord = config.discord;
  if (config.pumpUrl !== undefined) SITE_CONFIG.pumpUrl = config.pumpUrl;

  console.log('[ADMIN] Site config updated:', SITE_CONFIG);
  res.json({ success: true, config: SITE_CONFIG });
});

// Admin: Set reward percentages
app.post('/api/admin/percentages', (req, res) => {
  const { adminSecret, percentages } = req.body;
  const result = rewards.setRewardPercentages(percentages, adminSecret);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// Admin: Record creator fee (webhook from on-chain monitor)
app.post('/api/admin/fee', (req, res) => {
  const { amount, txSignature, adminSecret } = req.body;

  if (!rewards.validateAdmin(adminSecret)) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }

  const result = rewards.recordCreatorFee(amount, txSignature);
  res.json(result);
});

// Webhook: Notify external services when round ends (for prize distribution)
// This is called internally by room.js when a round ends
app.post('/api/webhook/round-end', (req, res) => {
  const { adminSecret, roomId, roundNumber, winner, leaderboard } = req.body;

  if (!rewards.validateAdmin(adminSecret)) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }

  // Log round end for external prize distribution script
  console.log(`[WEBHOOK] Round ${roundNumber} ended in ${roomId}`);
  if (winner) {
    console.log(`[WEBHOOK] Winner: ${winner.username} (${winner.wallet || 'no wallet'})`);
  }

  // Emit event for any connected services
  io.emit('roundEnded', { roomId, roundNumber, winner, leaderboard });

  res.json({ success: true, message: 'Round end processed' });
});

// ============ REWARD DISTRIBUTION ============
// Battle Royale mode: Rewards are distributed per room when each round ends
// The Room class handles calling the smart contract for winner payouts

// ============ START SERVER ============

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ███╗   ███╗ █████╗ ██████╗ ██╗   ██╗██████╗  ██████╗    ██████╗  ██████╗
  ████╗ ████║██╔══██╗██╔══██╗██║   ██║██╔══██╗██╔═══██╗   ██╔════╝ ██╔════╝
  ██╔████╔██║███████║██║  ██║██║   ██║██████╔╝██║   ██║   ██║  ███╗██║  ███╗
  ██║╚██╔╝██║██╔══██║██║  ██║██║   ██║██╔══██╗██║   ██║   ██║   ██║██║   ██║
  ██║ ╚═╝ ██║██║  ██║██████╔╝╚██████╔╝██║  ██║╚██████╔╝██╗╚██████╔╝╚██████╔╝
  ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝ ╚═════╝  ╚═════╝

  Server running on http://localhost:${PORT}
  `);
});
