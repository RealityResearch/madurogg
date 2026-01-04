// Landing Page Logic
document.addEventListener('DOMContentLoaded', () => {
  const connectWalletBtn = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');
  const playBtn = document.getElementById('play-btn');
  const usernameInput = document.getElementById('username');
  const playerCount = document.getElementById('player-count');

  // Connect to server for player count
  const socket = io();

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('playerCount', (count) => {
    playerCount.textContent = count;
  });

  // Request player count periodically
  setInterval(() => {
    socket.emit('getPlayerCount');
  }, 5000);

  // Wallet connection
  connectWalletBtn.addEventListener('click', async () => {
    try {
      if (window.walletManager.isConnected) {
        // Disconnect
        window.walletManager.disconnect();
        connectWalletBtn.innerHTML = '<span class="wallet-icon">👻</span> Connect Phantom Wallet';
        connectWalletBtn.classList.remove('connected');
        walletStatus.textContent = '';
        walletStatus.classList.remove('connected');
      } else {
        // Connect
        connectWalletBtn.innerHTML = '<span class="wallet-icon">⏳</span> Connecting...';
        const address = await window.walletManager.connect();
        connectWalletBtn.innerHTML = '<span class="wallet-icon">✅</span> ' + window.walletManager.getTruncatedAddress();
        connectWalletBtn.classList.add('connected');
        walletStatus.textContent = 'Wallet connected! You\'re eligible for rewards.';
        walletStatus.classList.add('connected');
      }
    } catch (error) {
      console.error('Wallet error:', error);
      connectWalletBtn.innerHTML = '<span class="wallet-icon">👻</span> Connect Phantom Wallet';
      walletStatus.textContent = error.message || 'Failed to connect wallet';
      walletStatus.classList.remove('connected');
    }
  });

  // Play button
  playBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim() || 'Anonymous';
    const wallet = window.walletManager.publicKey || null;

    // Store player data in sessionStorage
    sessionStorage.setItem('playerData', JSON.stringify({
      username,
      wallet
    }));

    // Navigate to game
    window.location.href = '/game.html';
  });

  // Enter key to play
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      playBtn.click();
    }
  });

  // Animate player count
  let targetCount = 0;
  let currentCount = 0;

  function animateCount() {
    if (currentCount < targetCount) {
      currentCount++;
      playerCount.textContent = currentCount;
    }
    requestAnimationFrame(animateCount);
  }

  // Simulate some players for demo
  setTimeout(() => {
    targetCount = Math.floor(Math.random() * 50) + 10;
    animateCount();
  }, 1000);
});
