const Game = require('./game');

// Battle Royale Room Configuration
const ROOM_CONFIG = {
  MAX_PLAYERS: 30,           // Max players per room
  ROUND_DURATION: 10 * 60 * 1000,  // 10 minutes in ms
  JOIN_LOCK_TIME: 5 * 60 * 1000,   // Lock joins after 5 minutes into round
  MIN_PLAYERS_TO_START: 2,   // Minimum players to start countdown
  COUNTDOWN_DURATION: 30 * 1000,   // 30 second countdown before round starts
  INTERMISSION: 15 * 1000,   // 15 seconds between rounds
};

class Room {
  constructor(id, io, rewardManager) {
    this.id = id;
    this.io = io;
    this.rewardManager = rewardManager;
    this.game = new Game();
    this.players = new Map(); // socketId -> { socket, wallet, username }

    // Round state
    this.state = 'waiting'; // waiting, countdown, playing, ended
    this.roundStartTime = null;
    this.roundEndTime = null;
    this.countdownStartTime = null;
    this.winner = null;
    this.prizePool = 0;

    // Stats
    this.roundNumber = 0;
    this.totalRounds = 0;
  }

  // Get room info for lobby
  getInfo() {
    return {
      id: this.id,
      players: this.players.size,
      maxPlayers: ROOM_CONFIG.MAX_PLAYERS,
      state: this.state,
      locked: this.isLocked(),
      timeRemaining: this.getTimeRemaining(),
      prizePool: this.prizePool,
      roundNumber: this.roundNumber
    };
  }

  getTimeRemaining() {
    if (this.state === 'countdown' && this.countdownStartTime) {
      const elapsed = Date.now() - this.countdownStartTime;
      return Math.max(0, ROOM_CONFIG.COUNTDOWN_DURATION - elapsed);
    }
    if (this.state === 'playing' && this.roundEndTime) {
      return Math.max(0, this.roundEndTime - Date.now());
    }
    return 0;
  }

  isFull() {
    return this.players.size >= ROOM_CONFIG.MAX_PLAYERS;
  }

  isLocked() {
    // Lock joins after 5 minutes into the round
    if (this.state === 'playing' && this.roundStartTime) {
      const elapsed = Date.now() - this.roundStartTime;
      return elapsed >= ROOM_CONFIG.JOIN_LOCK_TIME;
    }
    return false;
  }

  canJoin() {
    // Can join if not full, not locked, and either waiting, countdown, or early in round
    if (this.isFull()) return false;
    if (this.state === 'ended') return false;
    if (this.isLocked()) return false;
    return true;
  }

  // Add player to room
  addPlayer(socket, username, wallet) {
    if (!this.canJoin()) {
      return { success: false, error: 'Room not accepting players' };
    }

    this.players.set(socket.id, { socket, username, wallet });
    const player = this.game.addPlayer(socket.id, username, wallet);

    // Join socket.io room
    socket.join(this.id);

    // Check if we should start countdown
    if (this.state === 'waiting' && this.players.size >= ROOM_CONFIG.MIN_PLAYERS_TO_START) {
      this.startCountdown();
    }

    return {
      success: true,
      player,
      roomId: this.id,
      worldSize: this.game.worldSize,
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber
    };
  }

  // Remove player from room
  removePlayer(socketId) {
    const playerData = this.players.get(socketId);
    if (playerData) {
      playerData.socket.leave(this.id);
      this.players.delete(socketId);
      this.game.removePlayer(socketId);

      // Check for winner if playing
      if (this.state === 'playing') {
        this.checkForWinner();
      }

      // Reset if no players
      if (this.players.size === 0) {
        this.reset();
      }
    }
  }

  startCountdown() {
    this.state = 'countdown';
    this.countdownStartTime = Date.now();
    this.roundNumber++;

    console.log(`[Room ${this.id}] Countdown started for round ${this.roundNumber}`);

    // Broadcast countdown start
    this.broadcast('roundCountdown', {
      duration: ROOM_CONFIG.COUNTDOWN_DURATION,
      roundNumber: this.roundNumber
    });

    // Start round after countdown
    setTimeout(() => {
      if (this.state === 'countdown') {
        this.startRound();
      }
    }, ROOM_CONFIG.COUNTDOWN_DURATION);
  }

  startRound() {
    this.state = 'playing';
    this.roundStartTime = Date.now();
    this.roundEndTime = Date.now() + ROOM_CONFIG.ROUND_DURATION;
    this.winner = null;

    // Reset all players to fresh state
    for (const [socketId, playerData] of this.players) {
      const player = this.game.players.get(socketId);
      if (player) {
        player.respawn(this.game.worldSize);
        player.kills = 0;
        player.peakMass = player.getMass();
      }
    }

    console.log(`[Room ${this.id}] Round ${this.roundNumber} started with ${this.players.size} players`);

    // Broadcast round start
    this.broadcast('roundStart', {
      duration: ROOM_CONFIG.ROUND_DURATION,
      roundNumber: this.roundNumber,
      players: this.players.size
    });

    // End round after duration
    setTimeout(() => {
      if (this.state === 'playing') {
        this.endRound();
      }
    }, ROOM_CONFIG.ROUND_DURATION);
  }

  checkForWinner() {
    // Count alive players (those with cells)
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

    // If only one player left, they win
    if (alivePlayers.length === 1 && this.state === 'playing') {
      this.winner = alivePlayers[0];
      this.endRound();
    }
  }

  endRound() {
    this.state = 'ended';

    // Determine winner if not already set (highest score)
    if (!this.winner) {
      let highestScore = 0;
      for (const [socketId, playerData] of this.players) {
        const player = this.game.players.get(socketId);
        if (player) {
          const score = player.getScore();
          if (score > highestScore) {
            highestScore = score;
            this.winner = {
              socketId,
              username: playerData.username,
              wallet: playerData.wallet,
              mass: player.getMass(),
              score
            };
          }
        }
      }
    }

    console.log(`[Room ${this.id}] Round ${this.roundNumber} ended. Winner: ${this.winner?.username || 'None'}`);

    // Distribute prize to winner
    let prizeAwarded = 0;
    if (this.winner && this.winner.wallet && this.prizePool > 0) {
      prizeAwarded = this.prizePool;
      // TODO: Call smart contract to distribute
      console.log(`[Room ${this.id}] Awarding ${prizeAwarded} tokens to ${this.winner.wallet}`);
      this.prizePool = 0;
    }

    // Broadcast round end
    this.broadcast('roundEnd', {
      roundNumber: this.roundNumber,
      winner: this.winner ? {
        username: this.winner.username,
        wallet: this.winner.wallet ?
          this.winner.wallet.slice(0, 4) + '...' + this.winner.wallet.slice(-4) : null,
        score: this.winner.score
      } : null,
      prizeAwarded,
      nextRoundIn: ROOM_CONFIG.INTERMISSION
    });

    this.totalRounds++;

    // Start next round after intermission
    setTimeout(() => {
      if (this.players.size >= ROOM_CONFIG.MIN_PLAYERS_TO_START) {
        this.startCountdown();
      } else {
        this.state = 'waiting';
        this.broadcast('waitingForPlayers', {
          current: this.players.size,
          required: ROOM_CONFIG.MIN_PLAYERS_TO_START
        });
      }
    }, ROOM_CONFIG.INTERMISSION);
  }

  reset() {
    this.state = 'waiting';
    this.roundStartTime = null;
    this.roundEndTime = null;
    this.countdownStartTime = null;
    this.winner = null;
    this.game = new Game();
  }

  // Game update tick
  update() {
    if (this.state === 'playing') {
      this.game.update();

      // Check for winner after kills
      const killEvents = this.game.getKillEvents();
      for (const kill of killEvents) {
        this.broadcast('kill', kill);
        console.log(`[Room ${this.id}] ${kill.killer} ate ${kill.victim}!`);

        // Check if victim was last player
        this.checkForWinner();
      }
    }
  }

  // Get game state for clients
  getState() {
    return {
      ...this.game.getState(),
      roomId: this.id,
      state: this.state,
      timeRemaining: this.getTimeRemaining(),
      roundNumber: this.roundNumber,
      prizePool: this.prizePool
    };
  }

  getLeaderboard() {
    return this.game.getLeaderboard();
  }

  // Broadcast to all players in room
  broadcast(event, data) {
    this.io.to(this.id).emit(event, data);
  }

  // Handle player input
  handleInput(socketId, input) {
    if (this.state === 'playing') {
      this.game.handleInput(socketId, input);
    }
  }

  splitPlayer(socketId) {
    if (this.state === 'playing') {
      this.game.splitPlayer(socketId);
    }
  }

  ejectMass(socketId) {
    if (this.state === 'playing') {
      this.game.ejectMass(socketId);
    }
  }
}

class RoomManager {
  constructor(io, rewardManager) {
    this.io = io;
    this.rewardManager = rewardManager;
    this.rooms = new Map();
    this.playerRooms = new Map(); // socketId -> roomId
    this.roomCounter = 0;

    // Create initial room
    this.createRoom();

    // Start game loop
    this.startGameLoop();
  }

  createRoom() {
    const roomId = `room-${++this.roomCounter}`;
    const room = new Room(roomId, this.io, this.rewardManager);
    this.rooms.set(roomId, room);
    console.log(`[RoomManager] Created ${roomId}`);
    return room;
  }

  // Find best room for player to join
  findAvailableRoom() {
    // First, try to find a room that's waiting or in countdown with space
    for (const room of this.rooms.values()) {
      if (room.canJoin()) {
        return room;
      }
    }

    // No available room, create new one
    return this.createRoom();
  }

  // Join player to a room
  joinRoom(socket, username, wallet, preferredRoomId = null) {
    let room;

    if (preferredRoomId && this.rooms.has(preferredRoomId)) {
      room = this.rooms.get(preferredRoomId);
      if (!room.canJoin()) {
        room = this.findAvailableRoom();
      }
    } else {
      room = this.findAvailableRoom();
    }

    const result = room.addPlayer(socket, username, wallet);

    if (result.success) {
      this.playerRooms.set(socket.id, room.id);
    }

    return result;
  }

  // Leave room
  leaveRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.removePlayer(socketId);

        // Clean up empty rooms (keep at least one)
        if (room.players.size === 0 && this.rooms.size > 1) {
          this.rooms.delete(roomId);
          console.log(`[RoomManager] Removed empty ${roomId}`);
        }
      }
      this.playerRooms.delete(socketId);
    }
  }

  // Get room for player
  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  // Get all room info for lobby
  getRoomList() {
    return Array.from(this.rooms.values()).map(room => room.getInfo());
  }

  // Handle input for player
  handleInput(socketId, input) {
    const room = this.getPlayerRoom(socketId);
    if (room) {
      room.handleInput(socketId, input);
    }
  }

  splitPlayer(socketId) {
    const room = this.getPlayerRoom(socketId);
    if (room) {
      room.splitPlayer(socketId);
    }
  }

  ejectMass(socketId) {
    const room = this.getPlayerRoom(socketId);
    if (room) {
      room.ejectMass(socketId);
    }
  }

  // Game loop - update all rooms
  startGameLoop() {
    const TICK_RATE = 1000 / 60;

    setInterval(() => {
      for (const room of this.rooms.values()) {
        room.update();

        // Broadcast state to room
        const state = room.getState();
        room.broadcast('state', state);
      }
    }, TICK_RATE);

    // Leaderboard broadcast every second
    setInterval(() => {
      for (const room of this.rooms.values()) {
        const leaderboard = room.getLeaderboard();
        room.broadcast('leaderboard', leaderboard);
      }
    }, 1000);
  }
}

// Export config for client
RoomManager.CONFIG = ROOM_CONFIG;

module.exports = { Room, RoomManager };
