const Game = require('./game');

/**
 * MADURO.GG Continuous Arena System
 *
 * - Continuous gameplay (no round resets)
 * - 50 player cap with clear "lobby full" messaging
 * - Spectator overflow for player 51+
 * - 10-minute reward snapshots
 * - Hybrid reward tiers based on player count
 * - Bounty system for killing top players
 */

const ARENA_CONFIG = {
  MAX_PLAYERS: 50,                    // Max active players in arena
  REWARD_INTERVAL: 10 * 60 * 1000,    // 10 minutes between reward snapshots
  MIN_PLAYERS_FOR_REWARDS: 2,         // Minimum players to distribute rewards
  SPAWN_PROTECTION: 3000,             // 3 seconds of spawn protection
};

// Hybrid reward tiers based on player count
const REWARD_TIERS = {
  // Players -> { winners, percentages }
  small: {     // 2-10 players
    maxPlayers: 10,
    winners: 3,
    percentages: [50, 30, 20] // Top 3
  },
  medium: {    // 11-25 players
    maxPlayers: 25,
    winners: 5,
    percentages: [35, 25, 18, 12, 10] // Top 5
  },
  large: {     // 26-50 players
    maxPlayers: 50,
    winners: 10,
    percentages: [25, 18, 14, 10, 8, 7, 6, 5, 4, 3] // Top 10
  }
};

class Arena {
  constructor(io, rewardManager) {
    this.io = io;
    this.rewardManager = rewardManager;
    this.game = new Game();

    // Active players in the arena
    this.players = new Map(); // socketId -> { socket, wallet, username, joinedAt, spawnTime }

    // Spectators (watching but not playing)
    this.spectators = new Map(); // socketId -> { socket, wallet, username, watchingId }

    // Game state - always 'playing' in continuous mode
    this.state = 'playing';

    // Reward tracking
    this.lastRewardTime = Date.now();
    this.nextRewardTime = Date.now() + ARENA_CONFIG.REWARD_INTERVAL;
    this.totalRewardsDistributed = 0;

    // Stats
    this.totalKills = 0;
    this.peakPlayers = 0;

    // Start reward timer
    this.startRewardTimer();
  }

  // ============ PUBLIC GETTERS ============

  getInfo() {
    return {
      players: this.players.size,
      maxPlayers: ARENA_CONFIG.MAX_PLAYERS,
      spectators: this.spectators.size,
      state: this.state,
      timeUntilReward: this.getTimeUntilReward(),
      canJoin: this.canJoinArena(),
      isFull: this.players.size >= ARENA_CONFIG.MAX_PLAYERS
    };
  }

  getTimeUntilReward() {
    return Math.max(0, this.nextRewardTime - Date.now());
  }

  canJoinArena() {
    return this.players.size < ARENA_CONFIG.MAX_PLAYERS;
  }

  // ============ REWARD SYSTEM ============

  startRewardTimer() {
    setInterval(() => {
      this.distributeRewards();
    }, ARENA_CONFIG.REWARD_INTERVAL);
  }

  getRewardTier() {
    const playerCount = this.players.size;
    if (playerCount <= REWARD_TIERS.small.maxPlayers) {
      return REWARD_TIERS.small;
    } else if (playerCount <= REWARD_TIERS.medium.maxPlayers) {
      return REWARD_TIERS.medium;
    } else {
      return REWARD_TIERS.large;
    }
  }

  distributeRewards() {
    if (this.players.size < ARENA_CONFIG.MIN_PLAYERS_FOR_REWARDS) {
      console.log('[Arena] Not enough players for rewards');
      this.broadcast('rewardSnapshot', {
        success: false,
        message: 'Not enough players for rewards',
        nextRewardIn: ARENA_CONFIG.REWARD_INTERVAL
      });
      this.nextRewardTime = Date.now() + ARENA_CONFIG.REWARD_INTERVAL;
      return;
    }

    const tier = this.getRewardTier();
    const leaderboard = this.getLeaderboard();
    const winners = leaderboard.slice(0, tier.winners);

    console.log(`[Arena] Distributing rewards to top ${tier.winners} players`);
    console.log(`[Arena] Winners:`, winners.map((w, i) => `#${i + 1} ${w.username}: ${w.score}`).join(', '));

    // Prepare winner data for broadcast
    const winnersData = winners.map((winner, index) => ({
      rank: index + 1,
      username: winner.username,
      wallet: winner.wallet ? winner.wallet.slice(0, 4) + '...' + winner.wallet.slice(-4) : null,
      score: winner.score,
      percentage: tier.percentages[index]
    }));

    // Broadcast reward snapshot
    this.broadcast('rewardSnapshot', {
      success: true,
      winners: winnersData,
      playerCount: this.players.size,
      tier: tier.winners,
      nextRewardIn: ARENA_CONFIG.REWARD_INTERVAL
    });

    // TODO: Actual SOL distribution via smart contract
    // For now, just log it
    this.totalRewardsDistributed++;
    this.lastRewardTime = Date.now();
    this.nextRewardTime = Date.now() + ARENA_CONFIG.REWARD_INTERVAL;
  }

  // ============ PLAYER MANAGEMENT ============

  /**
   * Player attempts to join the game
   * Returns: { success, mode: 'arena'|'spectator', ... }
   */
  joinGame(socket, username, wallet) {
    const socketId = socket.id;

    // Already in arena?
    if (this.players.has(socketId)) {
      return { success: false, error: 'Already in arena' };
    }

    // Already spectating?
    if (this.spectators.has(socketId)) {
      return { success: false, error: 'Already spectating' };
    }

    // Try to join arena directly
    if (this.canJoinArena()) {
      return this.addToArena(socket, username, wallet);
    }

    // Arena full - add as spectator with clear message
    return this.addAsSpectatorFull(socket, username, wallet);
  }

  addToArena(socket, username, wallet) {
    const socketId = socket.id;
    const now = Date.now();

    this.players.set(socketId, {
      socket,
      username,
      wallet,
      joinedAt: now,
      spawnTime: now // For spawn protection
    });

    const player = this.game.addPlayer(socketId, username, wallet);
    socket.join('arena');

    // Track peak players
    if (this.players.size > this.peakPlayers) {
      this.peakPlayers = this.players.size;
    }

    this.broadcastArenaUpdate();

    return {
      success: true,
      mode: 'arena',
      player,
      worldSize: this.game.worldSize,
      state: this.state,
      timeUntilReward: this.getTimeUntilReward(),
      config: ARENA_CONFIG
    };
  }

  addAsSpectatorFull(socket, username, wallet) {
    const socketId = socket.id;

    // Find the top player to spectate
    const leaderboard = this.getLeaderboard();
    const topPlayer = leaderboard.length > 0 ? leaderboard[0] : null;

    this.spectators.set(socketId, {
      socket,
      username,
      wallet,
      watchingId: topPlayer ? topPlayer.id : null,
      reason: 'lobby_full'
    });

    socket.join('spectators');

    return {
      success: true,
      mode: 'spectator',
      reason: 'lobby_full',
      message: `Lobby is full (${ARENA_CONFIG.MAX_PLAYERS}/${ARENA_CONFIG.MAX_PLAYERS}). Spectating top player.`,
      watching: topPlayer ? topPlayer.username : null,
      watchingId: topPlayer ? topPlayer.id : null,
      state: this.state,
      timeUntilReward: this.getTimeUntilReward(),
      config: ARENA_CONFIG
    };
  }

  addToSpectators(socket, username, wallet, watchingId = null, reason = 'eliminated') {
    const socketId = socket.id;

    this.spectators.set(socketId, {
      socket,
      username,
      wallet,
      watchingId,
      reason
    });

    socket.join('spectators');

    return {
      success: true,
      mode: 'spectator',
      reason,
      watchingId,
      state: this.state,
      timeUntilReward: this.getTimeUntilReward()
    };
  }

  /**
   * Player disconnects
   */
  removePlayer(socketId) {
    // Remove from arena
    if (this.players.has(socketId)) {
      const playerData = this.players.get(socketId);
      playerData.socket.leave('arena');
      this.players.delete(socketId);
      this.game.removePlayer(socketId);

      // Promote a spectator if any are waiting due to lobby full
      this.promoteWaitingSpectator();

      this.broadcastArenaUpdate();
      return;
    }

    // Remove from spectators
    if (this.spectators.has(socketId)) {
      const spectatorData = this.spectators.get(socketId);
      spectatorData.socket.leave('spectators');
      this.spectators.delete(socketId);
      return;
    }
  }

  /**
   * Promote a spectator who was waiting because lobby was full
   */
  promoteWaitingSpectator() {
    if (this.players.size >= ARENA_CONFIG.MAX_PLAYERS) return;

    // Find first spectator waiting due to lobby full
    for (const [socketId, data] of this.spectators) {
      if (data.reason === 'lobby_full') {
        // Remove from spectators
        data.socket.leave('spectators');
        this.spectators.delete(socketId);

        // Add to arena
        const result = this.addToArena(data.socket, data.username, data.wallet);

        data.socket.emit('promoted', {
          mode: 'arena',
          message: 'A spot opened up! You are now playing!'
        });

        console.log(`[Arena] Promoted ${data.username} from spectator to arena`);
        return;
      }
    }
  }

  // ============ GAME ACTIONS ============

  handleInput(socketId, input) {
    if (this.players.has(socketId)) {
      this.game.handleInput(socketId, input);
    }
  }

  splitPlayer(socketId) {
    if (this.players.has(socketId)) {
      this.game.splitPlayer(socketId);
    }
  }

  ejectMass(socketId) {
    if (this.players.has(socketId)) {
      this.game.ejectMass(socketId);
    }
  }

  // ============ GAME LOOP ============

  update() {
    this.game.update();

    // Process kills - handle death with spectate options
    const killEvents = this.game.getKillEvents();
    for (const kill of killEvents) {
      this.broadcast('kill', kill);
      console.log(`[Arena] ${kill.killer} ate ${kill.victim} (+${kill.bountyBonus || 0} bounty)`);

      // Move eliminated player to spectators with killer info
      const victimData = this.players.get(kill.victimId);
      if (victimData) {
        const victimPlayer = this.game.players.get(kill.victimId);
        const finalScore = victimPlayer ? victimPlayer.getScore() : 0;
        const finalKills = victimPlayer ? victimPlayer.kills : 0;

        // Convert to spectator
        victimData.socket.leave('arena');
        this.players.delete(kill.victimId);

        this.addToSpectators(
          victimData.socket,
          victimData.username,
          victimData.wallet,
          kill.killerId, // Watch the killer by default
          'eliminated'
        );

        // Send detailed elimination info with options
        victimData.socket.emit('eliminated', {
          killedBy: kill.killer,
          killerId: kill.killerId,
          finalScore,
          finalKills,
          message: `Eaten by ${kill.killer}`,
          options: ['spectate_killer', 'play_again', 'exit'],
          lobbyFull: this.players.size >= ARENA_CONFIG.MAX_PLAYERS
        });

        this.totalKills++;
      }

      // Promote waiting spectators if there's room
      this.promoteWaitingSpectator();
    }
  }

  getState() {
    return {
      ...this.game.getState(),
      state: this.state,
      timeUntilReward: this.getTimeUntilReward(),
      playersCount: this.players.size,
      maxPlayers: ARENA_CONFIG.MAX_PLAYERS,
      spectatorsCount: this.spectators.size
    };
  }

  getLeaderboard() {
    return this.game.getLeaderboard();
  }

  // ============ SPECTATOR ACTIONS ============

  /**
   * Spectator requests to play again
   */
  playAgain(socketId) {
    const spectatorData = this.spectators.get(socketId);
    if (!spectatorData) {
      return { success: false, error: 'Not a spectator' };
    }

    // Remove from spectators
    spectatorData.socket.leave('spectators');
    this.spectators.delete(socketId);

    // Try to join arena
    if (this.canJoinArena()) {
      return this.addToArena(spectatorData.socket, spectatorData.username, spectatorData.wallet);
    }

    // Arena full - back to spectator with lobby full message
    return this.addAsSpectatorFull(spectatorData.socket, spectatorData.username, spectatorData.wallet);
  }

  /**
   * Spectator changes who they're watching
   */
  spectatePlayer(socketId, targetId) {
    const spectatorData = this.spectators.get(socketId);
    if (!spectatorData) return { success: false };

    spectatorData.watchingId = targetId;
    return { success: true, watchingId: targetId };
  }

  // ============ BROADCASTING ============

  broadcast(event, data) {
    // Send to arena and spectators
    this.io.to('arena').emit(event, data);
    this.io.to('spectators').emit(event, data);
  }

  broadcastArenaUpdate() {
    this.broadcast('arenaUpdate', {
      players: this.players.size,
      maxPlayers: ARENA_CONFIG.MAX_PLAYERS,
      spectators: this.spectators.size,
      state: this.state,
      timeUntilReward: this.getTimeUntilReward()
    });
  }
}

// Export config for client
Arena.CONFIG = ARENA_CONFIG;
Arena.REWARD_TIERS = REWARD_TIERS;

module.exports = Arena;
