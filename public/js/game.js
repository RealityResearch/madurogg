// Main Game Client
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.minimapCanvas = document.getElementById('minimap');
    this.renderer = new Renderer(this.canvas);
    this.state = null;
    this.selfId = null;
    this.worldSize = 3000;
    this.playerData = null;
    this.leaderboard = [];
    this.isPlaying = false;

    // UI elements
    this.loadingScreen = document.getElementById('loading-screen');
    this.deathScreen = document.getElementById('death-screen');
    this.scoreDisplay = document.getElementById('score');
    this.leaderboardList = document.getElementById('leaderboard-list');
    this.walletDisplay = document.getElementById('wallet-display');
    this.rewardCountdown = document.getElementById('reward-countdown');

    // Get player data from session
    const data = sessionStorage.getItem('playerData');
    if (data) {
      this.playerData = JSON.parse(data);
    } else {
      this.playerData = { username: 'Anonymous', wallet: null };
    }

    // Initialize
    this.init();
  }

  async init() {
    try {
      // Initialize input
      window.inputManager.init(this.canvas);

      // Connect to server
      await window.networkManager.connect();

      // Set up callbacks
      window.networkManager.onStateUpdate = (state) => this.onStateUpdate(state);
      window.networkManager.onLeaderboardUpdate = (lb) => this.onLeaderboardUpdate(lb);
      window.networkManager.onJoined = (data) => this.onJoined(data);

      // Join the game
      window.networkManager.join(this.playerData.username, this.playerData.wallet);

      // Display wallet info
      if (this.playerData.wallet) {
        const truncated = this.playerData.wallet.slice(0, 4) + '...' + this.playerData.wallet.slice(-4);
        this.walletDisplay.textContent = '👻 ' + truncated;
      } else {
        this.walletDisplay.textContent = 'Not connected';
      }

      // Start reward countdown
      this.startRewardCountdown();

      // Start game loop
      this.gameLoop();

      // Start input sending
      this.startInputLoop();

    } catch (error) {
      console.error('Failed to initialize game:', error);
      alert('Failed to connect to server. Please refresh the page.');
    }
  }

  onJoined(data) {
    console.log('Joined game:', data);
    this.selfId = data.id;
    this.worldSize = data.worldSize;
    this.renderer.worldSize = this.worldSize;
    this.isPlaying = true;

    // Hide loading screen
    this.loadingScreen.classList.add('hidden');
  }

  onStateUpdate(state) {
    this.state = state;

    // Find self player
    const self = state.players.find(p => p.id === this.selfId);

    if (self && self.cells.length > 0) {
      // Update camera to follow player
      const centerX = self.cells.reduce((sum, c) => sum + c.x, 0) / self.cells.length;
      const centerY = self.cells.reduce((sum, c) => sum + c.y, 0) / self.cells.length;
      const totalSize = self.cells.reduce((sum, c) => sum + c.size, 0);

      this.renderer.updateCamera(centerX, centerY, totalSize);

      // Update score display
      this.scoreDisplay.textContent = self.score.toLocaleString();

      // Hide death screen if showing
      if (!this.deathScreen.classList.contains('hidden')) {
        this.deathScreen.classList.add('hidden');
      }
    }
  }

  onLeaderboardUpdate(leaderboard) {
    this.leaderboard = leaderboard;
    this.updateLeaderboardUI();
  }

  updateLeaderboardUI() {
    this.leaderboardList.innerHTML = '';

    this.leaderboard.forEach((player, index) => {
      const li = document.createElement('li');
      li.className = player.id === this.selfId ? 'self' : '';

      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = `${index + 1}.`;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = player.username;

      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = player.score.toLocaleString();

      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(score);
      this.leaderboardList.appendChild(li);
    });
  }

  startInputLoop() {
    setInterval(() => {
      if (!this.isPlaying) return;

      // Get world position of mouse
      const worldPos = window.inputManager.getWorldPosition(
        this.renderer.cameraX,
        this.renderer.cameraY,
        this.renderer.zoom
      );

      // Send input to server
      window.networkManager.sendInput(worldPos.x, worldPos.y);
    }, 50); // 20 times per second
  }

  startRewardCountdown() {
    const updateCountdown = () => {
      const now = new Date();
      const minutes = 59 - now.getMinutes();
      const seconds = 59 - now.getSeconds();
      this.rewardCountdown.textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  gameLoop() {
    // Render
    this.renderer.render(this.state, this.selfId, this.minimapCanvas);

    // Continue loop
    requestAnimationFrame(() => this.gameLoop());
  }
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
