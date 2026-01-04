// Main Game Client
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.minimapCanvas = document.getElementById('minimap');
    this.renderer = new Renderer(this.canvas);
    this.state = null;
    this.prevState = null;
    this.selfId = null;
    this.roomId = null;
    this.worldSize = 3000;
    this.playerData = null;
    this.leaderboard = [];
    this.isPlaying = false;

    // Battle Royale state
    this.roundState = 'waiting'; // waiting, countdown, playing, ended
    this.roundNumber = 0;
    this.roundTimeRemaining = 0;
    this.roundConfig = null;

    // Interpolation
    this.lastUpdateTime = 0;
    this.interpolationFactor = 0;

    // Kill feed
    this.killFeed = [];
    this.maxKillFeedItems = 5;

    // Particles
    this.particles = [];

    // UI elements
    this.loadingScreen = document.getElementById('loading-screen');
    this.deathScreen = document.getElementById('death-screen');
    this.scoreDisplay = document.getElementById('score');
    this.leaderboardList = document.getElementById('leaderboard-list');
    this.walletDisplay = document.getElementById('wallet-display');
    this.rewardCountdown = document.getElementById('reward-countdown');

    // Create kill feed container
    this.createKillFeed();

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

  createKillFeed() {
    const killFeedDiv = document.createElement('div');
    killFeedDiv.id = 'kill-feed';
    killFeedDiv.className = 'kill-feed';
    document.getElementById('hud').appendChild(killFeedDiv);
    this.killFeedElement = killFeedDiv;
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
      window.networkManager.onKill = (data) => this.onKill(data);

      // Battle Royale callbacks
      window.networkManager.onRoundCountdown = (data) => this.onRoundCountdown(data);
      window.networkManager.onRoundStart = (data) => this.onRoundStart(data);
      window.networkManager.onRoundEnd = (data) => this.onRoundEnd(data);
      window.networkManager.onWaitingForPlayers = (data) => this.onWaitingForPlayers(data);

      // Join the game
      window.networkManager.join(this.playerData.username, this.playerData.wallet);

      // Display wallet info
      if (this.playerData.wallet) {
        const truncated = this.playerData.wallet.slice(0, 4) + '...' + this.playerData.wallet.slice(-4);
        this.walletDisplay.textContent = '👻 ' + truncated;
      } else {
        this.walletDisplay.textContent = 'Not connected';
      }

      // Round timer is started in onJoined

      // Start game loop
      this.lastFrameTime = performance.now();
      this.gameLoop();

      // Start input sending (30fps for network)
      this.startInputLoop();

    } catch (error) {
      console.error('Failed to initialize game:', error);
      alert('Failed to connect to server. Please refresh the page.');
    }
  }

  onJoined(data) {
    console.log('Joined game:', data);
    this.selfId = data.id;
    this.roomId = data.roomId;
    this.worldSize = data.worldSize;
    this.renderer.worldSize = this.worldSize;
    this.roundConfig = data.config;
    this.roundState = data.state;
    this.roundNumber = data.roundNumber;
    this.roundTimeRemaining = data.timeRemaining;
    this.isPlaying = true;

    // Hide loading screen
    this.loadingScreen.classList.add('hidden');

    // Update round timer display
    this.updateRoundTimer();
  }

  onRoundCountdown(data) {
    console.log('Round countdown:', data);
    this.roundState = 'countdown';
    this.roundNumber = data.roundNumber;
    this.roundTimeRemaining = data.duration;
    this.showAnnouncement(`Round ${data.roundNumber} starting...`, 'countdown');
  }

  onRoundStart(data) {
    console.log('Round started:', data);
    this.roundState = 'playing';
    this.roundNumber = data.roundNumber;
    this.roundTimeRemaining = data.duration;
    this.showAnnouncement(`ROUND ${data.roundNumber} - FIGHT!`, 'start');
  }

  onRoundEnd(data) {
    console.log('Round ended:', data);
    this.roundState = 'ended';

    if (data.winner) {
      const isMe = data.winner.wallet && this.playerData.wallet &&
        data.winner.wallet.includes(this.playerData.wallet.slice(-4));
      if (isMe) {
        this.showAnnouncement(`🏆 YOU WON! +${data.prizeAwarded} tokens`, 'winner');
      } else {
        this.showAnnouncement(`${data.winner.username} wins!`, 'end');
      }
    } else {
      this.showAnnouncement('Round ended - No winner', 'end');
    }

    // Show next round countdown
    setTimeout(() => {
      this.showAnnouncement(`Next round in ${Math.ceil(data.nextRoundIn / 1000)}s...`, 'waiting');
    }, 3000);
  }

  onWaitingForPlayers(data) {
    console.log('Waiting for players:', data);
    this.roundState = 'waiting';
    this.showAnnouncement(`Waiting for players... (${data.current}/${data.required})`, 'waiting');
  }

  showAnnouncement(text, type) {
    // Create or get announcement element
    let ann = document.getElementById('round-announcement');
    if (!ann) {
      ann = document.createElement('div');
      ann.id = 'round-announcement';
      ann.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        font-weight: bold;
        color: white;
        text-shadow: 0 0 20px rgba(0,0,0,0.8);
        z-index: 1000;
        pointer-events: none;
        transition: opacity 0.5s;
      `;
      document.body.appendChild(ann);
    }

    ann.textContent = text;
    ann.style.opacity = '1';

    // Color based on type
    if (type === 'winner') {
      ann.style.color = '#FFD700';
    } else if (type === 'start') {
      ann.style.color = '#ff4444';
    } else {
      ann.style.color = 'white';
    }

    // Fade out after 3 seconds
    setTimeout(() => {
      ann.style.opacity = '0';
    }, 3000);
  }

  updateRoundTimer() {
    // Update every second
    setInterval(() => {
      if (this.state && this.state.timeRemaining !== undefined) {
        this.roundTimeRemaining = this.state.timeRemaining;
      }

      const minutes = Math.floor(this.roundTimeRemaining / 60000);
      const seconds = Math.floor((this.roundTimeRemaining % 60000) / 1000);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      // Update the countdown display
      if (this.roundState === 'playing') {
        this.rewardCountdown.textContent = timeStr;
        this.rewardCountdown.style.color = this.roundTimeRemaining < 60000 ? '#ff4444' : 'white';
      } else if (this.roundState === 'countdown') {
        this.rewardCountdown.textContent = `Starting: ${seconds}s`;
        this.rewardCountdown.style.color = '#ffcc00';
      } else {
        this.rewardCountdown.textContent = 'Waiting...';
        this.rewardCountdown.style.color = '#888';
      }
    }, 100);
  }

  onStateUpdate(state) {
    this.prevState = this.state;
    this.state = state;
    this.lastUpdateTime = performance.now();

    // Find self player
    const self = state.players.find(p => p.id === this.selfId);

    if (self && self.cells.length > 0) {
      // Update camera to follow player
      const centerX = self.cells.reduce((sum, c) => sum + c.x, 0) / self.cells.length;
      const centerY = self.cells.reduce((sum, c) => sum + c.y, 0) / self.cells.length;
      const totalSize = self.cells.reduce((sum, c) => sum + c.size, 0);

      this.renderer.updateCamera(centerX, centerY, totalSize);

      // Update score display (show current mass, with peak in parentheses if different)
      const currentMass = self.mass || Math.floor(self.cells.reduce((sum, c) => sum + (c.mass || c.size * c.size / 100), 0));
      const peakMass = self.score || currentMass;

      if (peakMass > currentMass) {
        this.scoreDisplay.innerHTML = `${currentMass.toLocaleString()} <span style="opacity:0.6">(Peak: ${peakMass.toLocaleString()})</span>`;
      } else {
        this.scoreDisplay.textContent = currentMass.toLocaleString();
      }

      // Hide death screen if showing
      if (!this.deathScreen.classList.contains('hidden')) {
        this.deathScreen.classList.add('hidden');
      }
    }
  }

  onKill(data) {
    // Add to kill feed
    this.addKillFeedItem(data.killer, data.victim);

    // Spawn particles at kill location
    if (data.x && data.y) {
      this.spawnParticles(data.x, data.y, data.color || '#ff6b6b', 20);
    }

    // Screen shake if we got the kill
    if (data.killerId === this.selfId) {
      window.inputManager.triggerScreenShake();
    }
  }

  addKillFeedItem(killer, victim) {
    const item = {
      killer,
      victim,
      timestamp: Date.now()
    };
    this.killFeed.unshift(item);

    // Keep only recent items
    if (this.killFeed.length > this.maxKillFeedItems) {
      this.killFeed.pop();
    }

    this.updateKillFeedUI();

    // Auto-remove after 5 seconds
    setTimeout(() => {
      const idx = this.killFeed.indexOf(item);
      if (idx > -1) {
        this.killFeed.splice(idx, 1);
        this.updateKillFeedUI();
      }
    }, 5000);
  }

  updateKillFeedUI() {
    this.killFeedElement.innerHTML = this.killFeed.map(item => `
      <div class="kill-feed-item">
        <span class="killer">${item.killer}</span>
        <span class="ate">ate</span>
        <span class="victim">${item.victim}</span>
      </div>
    `).join('');
  }

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color,
        life: 1,
        decay: 0.02 + Math.random() * 0.02
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
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
      // Show score (peak mass) - mass is what determines rank
      score.textContent = player.score.toLocaleString();

      // Add kills if available
      if (player.kills > 0) {
        const kills = document.createElement('span');
        kills.className = 'kills';
        kills.textContent = `🔥${player.kills}`;
        kills.style.marginLeft = '5px';
        kills.style.fontSize = '0.8em';
        kills.style.opacity = '0.8';
        li.appendChild(rank);
        li.appendChild(name);
        li.appendChild(score);
        li.appendChild(kills);
      } else {
        li.appendChild(rank);
        li.appendChild(name);
        li.appendChild(score);
      }

      this.leaderboardList.appendChild(li);
    });
  }

  startInputLoop() {
    setInterval(() => {
      if (!this.isPlaying) return;

      // Get direction from input manager
      const dir = window.inputManager.getDirection();

      // Send input to server
      window.networkManager.sendInput(dir.x, dir.y, dir.boost);
    }, 33); // ~30fps for network
  }


  gameLoop(currentTime) {
    const dt = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // Update particles
    this.updateParticles(dt);

    // Render with interpolation
    this.renderer.render(this.state, this.selfId, this.minimapCanvas, this.particles);

    // Continue loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
