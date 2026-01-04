// Network Manager - Socket.IO Client
class NetworkManager {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.roomId = null;
    this.connected = false;
    this.onStateUpdate = null;
    this.onLeaderboardUpdate = null;
    this.onJoined = null;
    this.onKill = null;
    this.onRoundCountdown = null;
    this.onRoundStart = null;
    this.onRoundEnd = null;
    this.onWaitingForPlayers = null;
    this.onRoomList = null;
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
        this.roomId = data.roomId;
        this.roomConfig = data.config;
        if (this.onJoined) {
          this.onJoined(data);
        }
      });

      // Kill events
      this.socket.on('kill', (data) => {
        if (this.onKill) {
          this.onKill(data);
        }
      });

      // Room list
      this.socket.on('roomList', (data) => {
        if (this.onRoomList) {
          this.onRoomList(data);
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
    });
  }

  join(username, wallet, roomId = null) {
    if (this.socket && this.connected) {
      this.socket.emit('join', { username, wallet, roomId });
    }
  }

  getRooms() {
    if (this.socket && this.connected) {
      this.socket.emit('getRooms');
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

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Global network instance
window.networkManager = new NetworkManager();
