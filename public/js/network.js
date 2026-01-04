// Network Manager - Socket.IO Client
class NetworkManager {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.connected = false;
    this.onStateUpdate = null;
    this.onLeaderboardUpdate = null;
    this.onJoined = null;
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
        if (this.onJoined) {
          this.onJoined(data);
        }
      });
    });
  }

  join(username, wallet) {
    if (this.socket && this.connected) {
      this.socket.emit('join', { username, wallet });
    }
  }

  sendInput(mouseX, mouseY) {
    if (this.socket && this.connected) {
      this.socket.emit('input', { mouseX, mouseY });
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
