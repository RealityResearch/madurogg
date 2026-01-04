// Landing Page
document.addEventListener('DOMContentLoaded', () => {
  const connectWalletBtn = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');
  const playBtn = document.getElementById('play-btn');
  const usernameInput = document.getElementById('username');
  const playerCount = document.getElementById('player-count');
  const marketCapEl = document.getElementById('market-cap');
  const rewardPoolEl = document.getElementById('reward-pool');
  const nextDistEl = document.getElementById('next-dist');

  // Socket connection
  const socket = io();

  socket.on('connect', () => {
    fetchTokenData();
  });

  socket.on('playerCount', (count) => {
    playerCount.textContent = count;
  });

  setInterval(() => socket.emit('getPlayerCount'), 5000);

  // Fetch token/reward data
  async function fetchTokenData() {
    try {
      const res = await fetch('/api/token');
      const data = await res.json();

      if (data.marketCap && data.marketCap > 0) {
        marketCapEl.textContent = '$' + formatNum(data.marketCap);
      } else if (data.marketCapSol && data.marketCapSol > 0) {
        marketCapEl.textContent = formatNum(data.marketCapSol) + ' SOL';
      }

      if (data.rewardPool && data.rewardPool > 0) {
        rewardPoolEl.textContent = formatNum(data.rewardPool) + ' tokens';
      }

    } catch (e) {
      console.error('Failed to fetch token data');
    }
  }

  function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  // Countdown timer (time until next hour)
  setInterval(() => {
    const now = new Date();
    const mins = 59 - now.getMinutes();
    const secs = 59 - now.getSeconds();
    nextDistEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);

  setInterval(fetchTokenData, 30000);

  // Wallet
  connectWalletBtn.addEventListener('click', async () => {
    try {
      if (window.walletManager?.isConnected) {
        window.walletManager.disconnect();
        connectWalletBtn.querySelector('.btn-text').textContent = 'Connect Wallet';
        connectWalletBtn.classList.remove('connected');
        walletStatus.textContent = '';
        walletStatus.classList.remove('connected');
      } else {
        connectWalletBtn.querySelector('.btn-text').textContent = 'Connecting...';
        const address = await window.walletManager.connect();
        const short = address.slice(0, 4) + '...' + address.slice(-4);
        connectWalletBtn.querySelector('.btn-text').textContent = short;
        connectWalletBtn.classList.add('connected');
        walletStatus.textContent = 'Eligible for rewards';
        walletStatus.classList.add('connected');
      }
    } catch (err) {
      connectWalletBtn.querySelector('.btn-text').textContent = 'Connect Wallet';
      walletStatus.textContent = err.message || 'Failed to connect';
      walletStatus.classList.remove('connected');
    }
  });

  // Play
  playBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim() || 'ANON';
    const wallet = window.walletManager?.publicKey || null;

    sessionStorage.setItem('playerData', JSON.stringify({
      username: username.toUpperCase(),
      wallet
    }));

    window.location.href = '/game.html';
  });

  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') playBtn.click();
  });

  socket.emit('getPlayerCount');
});
