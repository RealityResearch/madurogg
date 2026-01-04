// Landing Page
document.addEventListener('DOMContentLoaded', () => {
  const connectWalletBtn = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');
  const playBtn = document.getElementById('play-btn');
  const usernameInput = document.getElementById('username');
  const playerCount = document.getElementById('player-count');
  const totalFeesEl = document.getElementById('total-fees');
  const fees24hEl = document.getElementById('fees-24h');
  const trades24hEl = document.getElementById('trades-24h');
  const holdersEl = document.getElementById('holders');
  const solPriceEl = document.getElementById('sol-price');
  const caAddress = document.getElementById('ca-address');
  const caCopy = document.getElementById('ca-copy');

  // Copy CA to clipboard
  function copyCA() {
    const ca = caAddress.textContent;
    navigator.clipboard.writeText(ca).then(() => {
      caCopy.textContent = '✓';
      setTimeout(() => { caCopy.textContent = '📋'; }, 1500);
    });
  }
  if (caAddress) caAddress.addEventListener('click', copyCA);
  if (caCopy) caCopy.addEventListener('click', copyCA);

  // Socket connection
  const socket = io();

  socket.on('connect', () => {
    fetchPumpStats();
  });

  socket.on('playerCount', (count) => {
    playerCount.textContent = count;
  });

  setInterval(() => socket.emit('getPlayerCount'), 5000);

  // Fetch pump.fun stats
  async function fetchPumpStats() {
    try {
      const res = await fetch('/api/pump');
      const data = await res.json();

      if (data.error) {
        console.error('Pump API error:', data.error);
        return;
      }

      // Total fees
      if (data.balanceSOL !== undefined) {
        totalFeesEl.textContent = formatSOL(data.balanceSOL) + ' SOL';
        if (data.balanceUSD) {
          totalFeesEl.title = '$' + formatNum(data.balanceUSD);
        }
      }

      // 24h fees
      if (data.fees24hSOL !== undefined) {
        fees24hEl.textContent = formatSOL(data.fees24hSOL) + ' SOL';
        if (data.fees24hUSD) {
          fees24hEl.title = '$' + formatNum(data.fees24hUSD);
        }
      }

      // 24h trades
      if (data.trades24h !== undefined) {
        trades24hEl.textContent = formatNum(data.trades24h);
      }

      // Holders
      if (data.holders !== undefined) {
        holdersEl.textContent = formatNum(data.holders);
      }

      // SOL price
      if (data.solPriceUSD !== undefined) {
        solPriceEl.textContent = '$' + data.solPriceUSD.toFixed(2);
      }

    } catch (e) {
      console.error('Failed to fetch pump stats:', e);
    }
  }

  function formatSOL(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(4);
  }

  // Load site config for footer links
  async function loadSiteConfig() {
    try {
      const config = await fetch('/api/config').then(r => r.json());

      // Update footer links
      const twitterLink = document.getElementById('footer-twitter');
      const telegramLink = document.getElementById('footer-telegram');

      if (config.twitter) {
        twitterLink.href = config.twitter;
      }
      if (config.telegram) {
        telegramLink.href = config.telegram;
      }

      // Update pump.fun link if token mint changed
      const pumpLink = document.querySelector('a[href*="pump.fun"]');
      if (pumpLink && config.pumpUrl) {
        pumpLink.href = config.pumpUrl;
      }

      // Update token link on the page
      const tokenLink = document.querySelector('.token-link');
      if (tokenLink && config.pumpUrl) {
        tokenLink.href = config.pumpUrl;
      }

    } catch (e) {
      console.error('Failed to load site config');
    }
  }

  loadSiteConfig();

  function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  // Refresh pump stats every 30 seconds
  setInterval(fetchPumpStats, 30000);

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
