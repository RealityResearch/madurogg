// Main Game Client - Arena System
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.minimapCanvas = document.getElementById('minimap');
    this.renderer = new Renderer(this.canvas);
    this.state = null;
    this.prevState = null;
    this.selfId = null;
    this.worldSize = 3000;
    this.playerData = null;
    this.leaderboard = [];

    // Player mode
    this.mode = null; // 'arena', 'queue', 'spectator'
    this.isPlaying = false;
    this.queuePosition = 0;

    // Arena state
    this.arenaInfo = {
      players: 0,
      maxPlayers: 30,
      queue: 0,
      spectators: 0,
      state: 'waiting'
    };

    // Battle Royale state
    this.roundState = 'waiting';
    this.roundNumber = 0;
    this.roundTimeRemaining = 0;
    this.roundConfig = null;

    // Interpolation
    this.lastUpdateTime = 0;

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

    // Create arena info display
    this.createArenaInfoDisplay();
    this.createKillFeed();
    this.createPlayAgainModal();
    this.createQueueOverlay();
    this.createSpectatorOverlay();

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

  createArenaInfoDisplay() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'arena-info';
    infoDiv.innerHTML = `
      <div class="arena-stat">
        <span class="label">PLAYERS</span>
        <span id="arena-players">0/30</span>
      </div>
      <div class="arena-stat">
        <span class="label">QUEUE</span>
        <span id="arena-queue">0</span>
      </div>
      <div class="arena-stat">
        <span class="label">WATCHING</span>
        <span id="arena-spectators">0</span>
      </div>
      <div class="arena-stat timer">
        <span id="arena-timer">--:--</span>
      </div>
    `;
    document.getElementById('hud').appendChild(infoDiv);
  }

  createKillFeed() {
    const killFeedDiv = document.createElement('div');
    killFeedDiv.id = 'kill-feed';
    killFeedDiv.className = 'kill-feed';
    document.getElementById('hud').appendChild(killFeedDiv);
    this.killFeedElement = killFeedDiv;
  }

  createPlayAgainModal() {
    const modal = document.createElement('div');
    modal.id = 'play-again-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>ROUND OVER!</h2>
        <p id="round-result"></p>
        <div class="modal-buttons">
          <button id="btn-play-again" class="btn-primary">PLAY AGAIN</button>
          <button id="btn-exit" class="btn-secondary">EXIT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.hidePlayAgainModal();
      window.networkManager.requeue();
    });

    document.getElementById('btn-exit').addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  createQueueOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'queue-overlay';
    overlay.className = 'status-overlay hidden';
    overlay.innerHTML = `
      <div class="overlay-content">
        <h2>IN QUEUE</h2>
        <p>Position: <span id="queue-position">-</span></p>
        <p class="subtitle">Watch the action while you wait!</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  createSpectatorOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'spectator-overlay';
    overlay.className = 'status-overlay hidden';
    overlay.innerHTML = `
      <div class="overlay-content">
        <h2>SPECTATING</h2>
        <p id="spectator-message">Watching the battle...</p>
        <button id="btn-requeue" class="btn-primary">JOIN QUEUE</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-requeue').addEventListener('click', () => {
      window.networkManager.requeue();
    });
  }

  showPlayAgainModal(result) {
    document.getElementById('round-result').textContent = result;
    document.getElementById('play-again-modal').classList.remove('hidden');
  }

  hidePlayAgainModal() {
    document.getElementById('play-again-modal').classList.add('hidden');
  }

  updateArenaInfo(data) {
    if (data.players !== undefined) {
      document.getElementById('arena-players').textContent =
        `${data.players}/${data.maxPlayers || 30}`;
    }
    if (data.queue !== undefined || data.queueSize !== undefined) {
      document.getElementById('arena-queue').textContent =
        data.queue || data.queueSize || 0;
    }
    if (data.spectators !== undefined || data.spectatorsCount !== undefined) {
      document.getElementById('arena-spectators').textContent =
        data.spectators || data.spectatorsCount || 0;
    }
    if (data.state) {
      this.arenaInfo.state = data.state;
    }
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

      // Arena callbacks
      window.networkManager.onArenaUpdate = (data) => this.updateArenaInfo(data);
      window.networkManager.onQueuePosition = (data) => this.onQueuePosition(data);
      window.networkManager.onPromoted = (data) => this.onPromoted(data);
      window.networkManager.onEliminated = (data) => this.onEliminated(data);
      window.networkManager.onRoundEndPrompt = (data) => this.onRoundEndPrompt(data);
      window.networkManager.onRequeued = (data) => this.onRequeued(data);

      // Join the game
      window.networkManager.join(this.playerData.username, this.playerData.wallet);

      // Display wallet info
      if (this.playerData.wallet) {
        const truncated = this.playerData.wallet.slice(0, 4) + '...' + this.playerData.wallet.slice(-4);
        this.walletDisplay.textContent = '👻 ' + truncated;
      } else {
        this.walletDisplay.textContent = 'Not connected';
      }

      // Start game loop
      this.lastFrameTime = performance.now();
      this.gameLoop();

      // Start input sending (30fps for network)
      this.startInputLoop();

      // Start timer update
      this.startTimerLoop();

    } catch (error) {
      console.error('Failed to initialize game:', error);
      alert('Failed to connect to server. Please refresh the page.');
    }
  }

  onJoined(data) {
    console.log('Joined game:', data);
    this.selfId = data.id;
    this.mode = data.mode;
    this.worldSize = data.worldSize || 4000;
    this.renderer.worldSize = this.worldSize;
    this.roundConfig = data.config;
    this.roundState = data.state || 'waiting';
    this.roundNumber = data.roundNumber || 0;
    this.roundTimeRemaining = data.timeRemaining || 0;

    // Hide loading screen
    this.loadingScreen.classList.add('hidden');

    // Show appropriate overlay based on mode
    if (data.mode === 'arena') {
      this.isPlaying = true;
      this.mode = 'arena';
      document.getElementById('queue-overlay').classList.add('hidden');
      document.getElementById('spectator-overlay').classList.add('hidden');
      console.log('Mode set to arena, isPlaying:', this.isPlaying);
    } else if (data.mode === 'queue') {
      this.isPlaying = false;
      this.queuePosition = data.position;
      document.getElementById('queue-position').textContent = data.position;
      document.getElementById('queue-overlay').classList.remove('hidden');
      document.getElementById('spectator-overlay').classList.add('hidden');
    } else if (data.mode === 'spectator') {
      this.isPlaying = false;
      document.getElementById('queue-overlay').classList.add('hidden');
      document.getElementById('spectator-overlay').classList.remove('hidden');
    }
  }

  onQueuePosition(data) {
    this.queuePosition = data.position;
    document.getElementById('queue-position').textContent =
      `${data.position} of ${data.total}`;
  }

  onPromoted(data) {
    console.log('Promoted to arena!', data);
    this.mode = 'arena';
    this.isPlaying = true;
    document.getElementById('queue-overlay').classList.add('hidden');
    document.getElementById('spectator-overlay').classList.add('hidden');
    this.showAnnouncement(data.message || 'You are now playing!', 'start');
  }

  onEliminated(data) {
    console.log('Eliminated:', data);
    this.mode = 'spectator';
    this.isPlaying = false;
    document.getElementById('spectator-message').textContent =
      data.killedBy ? `Eaten by ${data.killedBy}` : 'You were eliminated';
    document.getElementById('spectator-overlay').classList.remove('hidden');
  }

  onRoundEndPrompt(data) {
    console.log('Round end prompt:', data);
    this.showPlayAgainModal(data.message || 'Round Over!');
  }

  onRequeued(data) {
    console.log('Requeued:', data);
    this.mode = 'queue';
    this.isPlaying = false;
    document.getElementById('spectator-overlay').classList.add('hidden');
    document.getElementById('play-again-modal').classList.add('hidden');
    document.getElementById('queue-overlay').classList.remove('hidden');

    if (data.position) {
      document.getElementById('queue-position').textContent = data.position;
    }
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
    this.hidePlayAgainModal();
    this.showAnnouncement(`ROUND ${data.roundNumber} - FIGHT!`, 'start');
  }

  onRoundEnd(data) {
    console.log('Round ended:', data);
    this.roundState = 'ended';

    // Show top 3 winners
    if (data.winners && data.winners.length > 0) {
      const winnerText = data.winners.map(w =>
        `#${w.rank} ${w.username}`
      ).join(' | ');
      this.showAnnouncement(`Winners: ${winnerText}`, 'end');
    } else {
      this.showAnnouncement('Round ended', 'end');
    }
  }

  onWaitingForPlayers(data) {
    console.log('Waiting for players:', data);
    this.roundState = 'waiting';
    this.showAnnouncement(`Waiting for players... (${data.current}/${data.required})`, 'waiting');
  }

  showAnnouncement(text, type) {
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

    if (type === 'winner') {
      ann.style.color = '#FFD700';
    } else if (type === 'start') {
      ann.style.color = '#ff4444';
    } else {
      ann.style.color = 'white';
    }

    setTimeout(() => {
      ann.style.opacity = '0';
    }, 3000);
  }

  startTimerLoop() {
    setInterval(() => {
      if (this.state && this.state.timeRemaining !== undefined) {
        this.roundTimeRemaining = this.state.timeRemaining;
      }

      const minutes = Math.floor(this.roundTimeRemaining / 60000);
      const seconds = Math.floor((this.roundTimeRemaining % 60000) / 1000);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      const timerEl = document.getElementById('arena-timer');

      if (this.roundState === 'playing') {
        timerEl.textContent = timeStr;
        timerEl.style.color = this.roundTimeRemaining < 60000 ? '#ff4444' : '#00ff00';
      } else if (this.roundState === 'countdown') {
        timerEl.textContent = `${seconds}s`;
        timerEl.style.color = '#ffcc00';
      } else {
        timerEl.textContent = 'WAITING';
        timerEl.style.color = '#888';
      }

      // Also update arena info from state
      if (this.state) {
        this.updateArenaInfo({
          players: this.state.playersCount,
          queue: this.state.queueCount,
          spectators: this.state.spectatorsCount
        });
      }
    }, 100);
  }

  onStateUpdate(state) {
    this.prevState = this.state;
    this.state = state;
    this.lastUpdateTime = performance.now();

    // Find self player (only if we're in arena mode)
    const self = this.mode === 'arena' ? state.players.find(p => p.id === this.selfId) : null;

    if (self && self.cells && self.cells.length > 0) {
      // Update camera to follow player
      const centerX = self.cells.reduce((sum, c) => sum + c.x, 0) / self.cells.length;
      const centerY = self.cells.reduce((sum, c) => sum + c.y, 0) / self.cells.length;
      const totalSize = self.cells.reduce((sum, c) => sum + c.size, 0);

      this.renderer.updateCamera(centerX, centerY, totalSize);

      // Update score display
      const currentMass = self.mass || Math.floor(self.cells.reduce((sum, c) => sum + (c.mass || c.size * c.size / 100), 0));
      const peakMass = self.score || currentMass;

      if (peakMass > currentMass) {
        this.scoreDisplay.innerHTML = `${currentMass.toLocaleString()} <span style="opacity:0.6">(Peak: ${peakMass.toLocaleString()})</span>`;
      } else {
        this.scoreDisplay.textContent = currentMass.toLocaleString();
      }
    } else if (this.mode === 'spectator' || this.mode === 'queue') {
      // Spectator/queue camera - follow the action (first player or center)
      if (state.players && state.players.length > 0) {
        const leader = state.players[0];
        if (leader && leader.cells && leader.cells.length > 0) {
          const centerX = leader.cells.reduce((sum, c) => sum + c.x, 0) / leader.cells.length;
          const centerY = leader.cells.reduce((sum, c) => sum + c.y, 0) / leader.cells.length;
          this.renderer.updateCamera(centerX, centerY, 100);
        }
      }
      this.scoreDisplay.textContent = 'SPECTATING';
    }
  }

  onKill(data) {
    this.addKillFeedItem(data.killer, data.victim);

    if (data.x && data.y) {
      this.spawnParticles(data.x, data.y, data.color || '#ff6b6b', 20);
    }

    if (data.killerId === this.selfId) {
      window.inputManager.triggerScreenShake();
    }
  }

  addKillFeedItem(killer, victim) {
    const item = { killer, victim, timestamp: Date.now() };
    this.killFeed.unshift(item);

    if (this.killFeed.length > this.maxKillFeedItems) {
      this.killFeed.pop();
    }

    this.updateKillFeedUI();

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
        x, y,
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

      // Highlight top 3 (prize winners)
      if (index < 3) {
        li.classList.add('winner');
        if (index === 0) li.classList.add('first');
        if (index === 1) li.classList.add('second');
        if (index === 2) li.classList.add('third');
      }

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

      if (player.kills > 0) {
        const kills = document.createElement('span');
        kills.className = 'kills';
        kills.textContent = `🔥${player.kills}`;
        kills.style.marginLeft = '5px';
        kills.style.fontSize = '0.8em';
        kills.style.opacity = '0.8';
        li.appendChild(kills);
      }

      this.leaderboardList.appendChild(li);
    });
  }

  startInputLoop() {
    setInterval(() => {
      // Send input if we're in arena mode and playing
      if (!this.isPlaying) return;

      const dir = window.inputManager.getDirection();
      window.networkManager.sendInput(dir.x, dir.y);
    }, 33);
  }

  gameLoop(currentTime) {
    const dt = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    this.updateParticles(dt);
    this.renderer.render(this.state, this.selfId, this.minimapCanvas, this.particles);

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
