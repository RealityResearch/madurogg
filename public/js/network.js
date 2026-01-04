// Network Manager - Socket.IO Client for Arena System
class NetworkManager {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.connected = false;
    this.mode = null; // 'arena', 'queue', 'spectator'

    // Callbacks
    this.onStateUpdate = null;
    this.onLeaderboardUpdate = null;
    this.onJoined = null;
    this.onKill = null;
    this.onRoundCountdown = null;
    this.onRoundStart = null;
    this.onRoundEnd = null;
    this.onWaitingForPlayers = null;

    // Arena-specific callbacks
    this.onArenaUpdate = null;
    this.onQueuePosition = null;
    this.onPromoted = null;
    this.onEliminated = null;
    this.onRoundEndPrompt = null;
    this.onRequeued = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io();

      this.socket.on('connect', () => {
        console.log('Connected to game server');
        this.connected = true;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.connected = false;
      });

      // Game state updates
      this.socket.on('state', (state) => {
        if (this.onStateUpdate) {
          this.onStateUpdate(state);
        }
      });

      // Leaderboard updates
      this.socket.on('leaderboard', (leaderboard) => {
        if (this.onLeaderboardUpdate) {
          this.onLeaderboardUpdate(leaderboard);
        }
      });

      // Joined confirmation
      this.socket.on('joined', (data) => {
        this.playerId = data.id;
        this.mode = data.mode;
        this.arenaConfig = data.config;
        if (this.onJoined) {
          this.onJoined(data);
        }
      });

      // Join error
      this.socket.on('joinError', (data) => {
        console.error('Join error:', data.error);
        alert('Failed to join: ' + data.error);
      });

      // Kill events
      this.socket.on('kill', (data) => {
        if (this.onKill) {
          this.onKill(data);
        }
      });

      // Battle Royale events
      this.socket.on('roundCountdown', (data) => {
        if (this.onRoundCountdown) {
          this.onRoundCountdown(data);
        }
      });

      this.socket.on('roundStart', (data) => {
        if (this.onRoundStart) {
          this.onRoundStart(data);
        }
      });

      this.socket.on('roundEnd', (data) => {
        if (this.onRoundEnd) {
          this.onRoundEnd(data);
        }
      });

      this.socket.on('waitingForPlayers', (data) => {
        if (this.onWaitingForPlayers) {
          this.onWaitingForPlayers(data);
        }
      });

      // Arena-specific events
      this.socket.on('arenaUpdate', (data) => {
        if (this.onArenaUpdate) {
          this.onArenaUpdate(data);
        }
      });

      this.socket.on('queuePosition', (data) => {
        if (this.onQueuePosition) {
          this.onQueuePosition(data);
        }
      });

      this.socket.on('promoted', (data) => {
        this.mode = 'arena';
        if (this.onPromoted) {
          this.onPromoted(data);
        }
      });

      this.socket.on('eliminated', (data) => {
        this.mode = 'spectator';
        if (this.onEliminated) {
          this.onEliminated(data);
        }
      });

      this.socket.on('roundEndPrompt', (data) => {
        if (this.onRoundEndPrompt) {
          this.onRoundEndPrompt(data);
        }
      });

      this.socket.on('requeued', (data) => {
        this.mode = 'queue';
        if (this.onRequeued) {
          this.onRequeued(data);
        }
      });

      this.socket.on('queueUpdate', (data) => {
        // Broadcast queue size change
        if (this.onArenaUpdate) {
          this.onArenaUpdate(data);
        }
      });
    });
  }

  join(username, wallet) {
    if (this.socket && this.connected) {
      this.socket.emit('join', { username, wallet });
    }
  }

  getArenaInfo() {
    if (this.socket && this.connected) {
      this.socket.emit('getArenaInfo');
    }
  }

  // Direction-based input (-1 to 1 for x and y)
  sendInput(dirX, dirY) {
    if (this.socket && this.connected) {
      this.socket.emit('input', { dirX, dirY });
    }
  }

  split() {
    if (this.socket && this.connected) {
      this.socket.emit('split');
    }
  }

  eject() {
    if (this.socket && this.connected) {
      this.socket.emit('eject');
    }
  }

  // Request to re-queue from spectator mode
  requeue() {
    if (this.socket && this.connected) {
      this.socket.emit('requeue');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Global network instance
window.networkManager = new NetworkManager();
