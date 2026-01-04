const Game = require('./game');

/**
 * MADURO.GG Single Arena System
 *
 * - One arena, max 30 players
 * - Queue system for waiting players
 * - Spectator mode for eliminated/waiting players
 * - 10 minute rounds
 * - Top 3 get prizes (must hold $MADURO)
 */

const ARENA_CONFIG = {
  MAX_PLAYERS: 30,                    // Max active players in arena
  ROUND_DURATION: 10 * 60 * 1000,     // 10 minutes
  COUNTDOWN_DURATION: 30 * 1000,      // 30 seconds before round starts
  INTERMISSION: 30 * 1000,            // 30 seconds between rounds
  MIN_PLAYERS_TO_START: 1,            // Minimum to start a round (1 for solo testing)
  QUEUE_PRIORITY_HOLDER_BONUS: 100,   // Token holders get queue priority
};

class Arena {
  constructor(io, rewardManager) {
    this.io = io;
    this.rewardManager = rewardManager;
    this.game = new Game();

    // Active players in the arena
    this.players = new Map(); // socketId -> { socket, wallet, username, joinedAt }

    // Queue for waiting players
    this.queue = new Map(); // socketId -> { socket, wallet, username, queuedAt, priority }

    // Spectators (watching but not playing)
    this.spectators = new Map(); // socketId -> { socket, wallet, username }

    // Round state
    this.state = 'waiting'; // waiting, countdown, playing, ended
    this.roundStartTime = null;
    this.roundEndTime = null;
    this.countdownStartTime = null;
    this.roundNumber = 0;

    // Stats
    this.totalRounds = 0;
    this.eliminatedThisRound = []; // Track eliminations for spectator conversion
  }

  // ============ PUBLIC GETTERS ============

  getInfo() {
    return {
      players: this.players.size,
      maxPlayers: ARENA_CONFIG.MAX_PLAYERS,
      queue: this.queue.size,
      spectators: this.spectators.size,
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber,
      canJoin: this.canJoinArena(),
      canQueue: this.canQueue(),
    };
  }

  getTimeRemaining() {
    if (this.state === 'countdown' && this.countdownStartTime) {
      const elapsed = Date.now() - this.countdownStartTime;
      return Math.max(0, ARENA_CONFIG.COUNTDOWN_DURATION - elapsed);
    }
    if (this.state === 'playing' && this.roundEndTime) {
      return Math.max(0, this.roundEndTime - Date.now());
    }
    if (this.state === 'ended') {
      return ARENA_CONFIG.INTERMISSION;
    }
    return 0;
  }

  canJoinArena() {
    // Can only join arena during waiting or countdown
    if (this.state === 'playing' || this.state === 'ended') return false;
    return this.players.size < ARENA_CONFIG.MAX_PLAYERS;
  }

  canQueue() {
    // Can always queue if arena is full or round in progress
    return true;
  }

  // ============ PLAYER MANAGEMENT ============

  /**
   * Player attempts to join the game
   * Returns: { success, mode: 'arena'|'queue'|'spectator', ... }
   */
  joinGame(socket, username, wallet) {
    const socketId = socket.id;

    // Already in arena?
    if (this.players.has(socketId)) {
      return { success: false, error: 'Already in arena' };
    }

    // Already in queue?
    if (this.queue.has(socketId)) {
      return { success: false, error: 'Already in queue' };
    }

    // Already spectating?
    if (this.spectators.has(socketId)) {
      return { success: false, error: 'Already spectating' };
    }

    // Try to join arena directly
    if (this.canJoinArena()) {
      return this.addToArena(socket, username, wallet);
    }

    // Arena full or round in progress - add to queue
    return this.addToQueue(socket, username, wallet);
  }

  addToArena(socket, username, wallet) {
    const socketId = socket.id;

    this.players.set(socketId, {
      socket,
      username,
      wallet,
      joinedAt: Date.now()
    });

    const player = this.game.addPlayer(socketId, username, wallet);
    socket.join('arena');

    // Check if we should start countdown
    if (this.state === 'waiting' && this.players.size >= ARENA_CONFIG.MIN_PLAYERS_TO_START) {
      this.startCountdown();
    }

    this.broadcastArenaUpdate();

    return {
      success: true,
      mode: 'arena',
      player,
      worldSize: this.game.worldSize,
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber,
      config: ARENA_CONFIG
    };
  }

  addToQueue(socket, username, wallet) {
    const socketId = socket.id;

    // Calculate priority (token holders could get bonus - future feature)
    const priority = Date.now(); // Lower = joined earlier = higher priority

    this.queue.set(socketId, {
      socket,
      username,
      wallet,
      queuedAt: Date.now(),
      priority
    });

    socket.join('queue');

    // Send queue position
    const position = this.getQueuePosition(socketId);

    this.broadcastQueueUpdate();

    return {
      success: true,
      mode: 'queue',
      position,
      queueSize: this.queue.size,
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber,
      config: ARENA_CONFIG
    };
  }

  addToSpectators(socket, username, wallet) {
    const socketId = socket.id;

    this.spectators.set(socketId, {
      socket,
      username,
      wallet
    });

    socket.join('spectators');

    return {
      success: true,
      mode: 'spectator',
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber
    };
  }

  getQueuePosition(socketId) {
    const sorted = Array.from(this.queue.entries())
      .sort((a, b) => a[1].priority - b[1].priority);

    const index = sorted.findIndex(([id]) => id === socketId);
    return index + 1;
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

      // If round is playing, they're eliminated
      if (this.state === 'playing') {
        this.eliminatedThisRound.push({
          username: playerData.username,
          wallet: playerData.wallet,
          reason: 'disconnect'
        });
      }

      this.broadcastArenaUpdate();
      this.checkRoundEnd();
      return;
    }

    // Remove from queue
    if (this.queue.has(socketId)) {
      const queueData = this.queue.get(socketId);
      queueData.socket.leave('queue');
      this.queue.delete(socketId);
      this.broadcastQueueUpdate();
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

  // ============ ROUND MANAGEMENT ============

  startCountdown() {
    this.state = 'countdown';
    this.countdownStartTime = Date.now();
    this.roundNumber++;

    console.log(`[Arena] Countdown started for round ${this.roundNumber}`);

    this.broadcast('roundCountdown', {
      duration: ARENA_CONFIG.COUNTDOWN_DURATION,
      roundNumber: this.roundNumber,
      players: this.players.size
    });

    setTimeout(() => {
      if (this.state === 'countdown') {
        this.startRound();
      }
    }, ARENA_CONFIG.COUNTDOWN_DURATION);
  }

  startRound() {
    this.state = 'playing';
    this.roundStartTime = Date.now();
    this.roundEndTime = Date.now() + ARENA_CONFIG.ROUND_DURATION;
    this.eliminatedThisRound = [];

    // Reset all players
    for (const [socketId] of this.players) {
      const player = this.game.players.get(socketId);
      if (player) {
        player.respawn(this.game.worldSize);
        player.kills = 0;
        player.peakMass = player.getMass();
      }
    }

    console.log(`[Arena] Round ${this.roundNumber} started with ${this.players.size} players`);

    this.broadcast('roundStart', {
      duration: ARENA_CONFIG.ROUND_DURATION,
      roundNumber: this.roundNumber,
      players: this.players.size
    });

    // End round after duration
    setTimeout(() => {
      if (this.state === 'playing') {
        this.endRound();
      }
    }, ARENA_CONFIG.ROUND_DURATION);
  }

  checkRoundEnd() {
    if (this.state !== 'playing') return;

    // Count alive players
    let alivePlayers = [];
    for (const [socketId, playerData] of this.players) {
      const player = this.game.players.get(socketId);
      if (player && player.cells.length > 0) {
        alivePlayers.push({
          socketId,
          username: playerData.username,
          wallet: playerData.wallet,
          mass: player.getMass(),
          score: player.getScore()
        });
      }
    }

    // End round if only 1 player left
    if (alivePlayers.length <= 1 && this.players.size > 1) {
      this.endRound();
    }
  }

  endRound() {
    this.state = 'ended';
    this.totalRounds++;

    // Get final standings
    const standings = this.getLeaderboard();

    console.log(`[Arena] Round ${this.roundNumber} ended`);
    console.log(`[Arena] Top 3:`, standings.slice(0, 3).map(p => `${p.username}: ${p.score}`));

    // Broadcast round end with top 3
    this.broadcast('roundEnd', {
      roundNumber: this.roundNumber,
      standings: standings.slice(0, 10),
      winners: standings.slice(0, 3).map(p => ({
        rank: standings.indexOf(p) + 1,
        username: p.username,
        wallet: p.wallet ? p.wallet.slice(0, 4) + '...' + p.wallet.slice(-4) : null,
        score: p.score
      })),
      nextRoundIn: ARENA_CONFIG.INTERMISSION
    });

    // Move all players to spectators, process queue
    setTimeout(() => {
      this.processIntermission();
    }, ARENA_CONFIG.INTERMISSION);
  }

  processIntermission() {
    // Send "Play Again?" prompt to all current players
    for (const [socketId, playerData] of this.players) {
      playerData.socket.emit('roundEndPrompt', {
        message: 'Round Over!',
        options: ['PLAY AGAIN', 'EXIT'],
        timeout: ARENA_CONFIG.INTERMISSION - 5000 // 5 sec before intermission ends
      });
    }

    // After a short delay, process everyone
    setTimeout(() => {
      this.cyclePlayersAndQueue();
    }, ARENA_CONFIG.INTERMISSION - 5000);
  }

  cyclePlayersAndQueue() {
    // Move all current players to queue (back of line) unless they chose EXIT
    const playersToRequeue = [];
    for (const [socketId, playerData] of this.players) {
      playerData.socket.leave('arena');
      // They get added to back of queue automatically
      playersToRequeue.push({
        socket: playerData.socket,
        username: playerData.username,
        wallet: playerData.wallet
      });
    }
    this.players.clear();

    // Clear game state
    this.game = new Game();

    // Process waiting queue first - they get priority
    const sortedQueue = Array.from(this.queue.entries())
      .sort((a, b) => a[1].priority - b[1].priority);

    for (const [socketId, queueData] of sortedQueue) {
      if (this.players.size >= ARENA_CONFIG.MAX_PLAYERS) break;

      this.queue.delete(socketId);
      queueData.socket.leave('queue');

      // Add to arena
      this.players.set(socketId, {
        socket: queueData.socket,
        username: queueData.username,
        wallet: queueData.wallet,
        joinedAt: Date.now()
      });

      this.game.addPlayer(socketId, queueData.username, queueData.wallet);
      queueData.socket.join('arena');

      queueData.socket.emit('promoted', {
        mode: 'arena',
        message: 'You have been promoted to the arena!'
      });
    }

    // Add previous players to queue (back of line)
    for (const playerData of playersToRequeue) {
      if (!this.players.has(playerData.socket.id)) {
        // Not already in arena, add to queue
        this.addToQueue(playerData.socket, playerData.username, playerData.wallet);
        playerData.socket.emit('requeued', {
          message: 'You have been added to the queue for the next round'
        });
      }
    }

    // Move spectators who haven't requeued to just watching
    // (They stay as spectators until they click "Play Again")

    // Check if we can start next round
    if (this.players.size >= ARENA_CONFIG.MIN_PLAYERS_TO_START) {
      this.startCountdown();
    } else {
      this.state = 'waiting';
      this.broadcast('waitingForPlayers', {
        current: this.players.size,
        required: ARENA_CONFIG.MIN_PLAYERS_TO_START
      });
    }

    this.broadcastArenaUpdate();
    this.broadcastQueueUpdate();
  }

  // ============ GAME ACTIONS ============

  handleInput(socketId, input) {
    // Allow movement in all states except 'ended'
    if (this.state !== 'ended' && this.players.has(socketId)) {
      this.game.handleInput(socketId, input);
    }
  }

  splitPlayer(socketId) {
    if (this.state !== 'ended' && this.players.has(socketId)) {
      this.game.splitPlayer(socketId);
    }
  }

  ejectMass(socketId) {
    if (this.state !== 'ended' && this.players.has(socketId)) {
      this.game.ejectMass(socketId);
    }
  }

  // ============ GAME LOOP ============

  update() {
    if (this.state === 'playing') {
      this.game.update();

      // Process kills - convert dead players to spectators
      const killEvents = this.game.getKillEvents();
      for (const kill of killEvents) {
        this.broadcast('kill', kill);
        console.log(`[Arena] ${kill.killer} ate ${kill.victim}!`);

        // Move eliminated player to spectators
        const victimData = this.players.get(kill.victimId);
        if (victimData) {
          this.eliminatedThisRound.push({
            username: victimData.username,
            wallet: victimData.wallet,
            killedBy: kill.killer
          });

          // Convert to spectator
          victimData.socket.leave('arena');
          this.players.delete(kill.victimId);
          this.addToSpectators(victimData.socket, victimData.username, victimData.wallet);

          victimData.socket.emit('eliminated', {
            killedBy: kill.killer,
            message: 'You have been eliminated! Now spectating.'
          });
        }

        this.checkRoundEnd();
      }
    }
  }

  getState() {
    return {
      ...this.game.getState(),
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber,
      playersCount: this.players.size,
      queueCount: this.queue.size,
      spectatorsCount: this.spectators.size
    };
  }

  getLeaderboard() {
    return this.game.getLeaderboard();
  }

  // ============ BROADCASTING ============

  broadcast(event, data) {
    // Send to arena, queue, and spectators
    this.io.to('arena').emit(event, data);
    this.io.to('queue').emit(event, data);
    this.io.to('spectators').emit(event, data);
  }

  broadcastArenaUpdate() {
    this.broadcast('arenaUpdate', {
      players: this.players.size,
      maxPlayers: ARENA_CONFIG.MAX_PLAYERS,
      state: this.state,
      timeRemaining: this.getTimeRemaining()
    });
  }

  broadcastQueueUpdate() {
    // Send individual queue positions
    const sorted = Array.from(this.queue.entries())
      .sort((a, b) => a[1].priority - b[1].priority);

    sorted.forEach(([socketId, data], index) => {
      data.socket.emit('queuePosition', {
        position: index + 1,
        total: this.queue.size,
        estimatedWait: this.getEstimatedWait(index + 1)
      });
    });

    this.broadcast('queueUpdate', {
      queueSize: this.queue.size
    });
  }

  getEstimatedWait(position) {
    // Estimate based on round duration and position
    const spotsPerRound = ARENA_CONFIG.MAX_PLAYERS;
    const roundsToWait = Math.ceil(position / spotsPerRound);
    return roundsToWait * (ARENA_CONFIG.ROUND_DURATION + ARENA_CONFIG.INTERMISSION);
  }

  // ============ RE-QUEUE ============

  /**
   * Spectator requests to re-queue for next round
   */
  requeueFromSpectator(socketId) {
    const spectatorData = this.spectators.get(socketId);
    if (!spectatorData) {
      return { success: false, error: 'Not a spectator' };
    }

    // Remove from spectators
    spectatorData.socket.leave('spectators');
    this.spectators.delete(socketId);

    // Add to queue
    return this.addToQueue(spectatorData.socket, spectatorData.username, spectatorData.wallet);
  }
}

// Export config for client
Arena.CONFIG = ARENA_CONFIG;

module.exports = Arena;
