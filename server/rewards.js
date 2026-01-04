// Reward Distribution System
// Tracks player scores and distributes rewards hourly
// Integrates with pump.fun for creator fee tracking

class RewardManager {
  constructor(config = {}) {
    // Configuration
    this.config = {
      tokenMint: config.tokenMint || null,           // $TRUMPWORM token mint address
      creatorWallet: config.creatorWallet || null,   // Dev wallet receiving creator fees
      adminSecret: config.adminSecret || process.env.ADMIN_SECRET || 'change-me-in-production',
      ...config
    };

    // In-memory storage (use Redis/DB in production)
    this.pendingRewards = new Map();   // wallet -> pending amount (in tokens)
    this.claimedRewards = new Map();   // wallet -> claimed amount (in tokens)
    this.hourlySnapshots = [];         // Historical distribution snapshots
    this.lastDistribution = Date.now();
    this.distributionInterval = 60 * 60 * 1000; // 1 hour

    // Reward pool (in tokens)
    this.rewardPool = 0;
    this.totalDistributed = 0;         // Lifetime distributed
    this.totalAddedToPool = 0;         // Lifetime added to pool

    // Creator fee tracking (from pump.fun)
    this.creatorFees = {
      totalTracked: 0,                 // Total fees tracked from pump.fun
      lastFetchTime: null,
      transactions: []                 // Recent fee transactions
    };

    // Reward distribution percentages for top 10
    this.rewardPercentages = [
      0.30,  // 1st place: 30%
      0.20,  // 2nd place: 20%
      0.15,  // 3rd place: 15%
      0.10,  // 4th place: 10%
      0.08,  // 5th place: 8%
      0.06,  // 6th place: 6%
      0.04,  // 7th place: 4%
      0.03,  // 8th place: 3%
      0.02,  // 9th place: 2%
      0.02   // 10th place: 2%
    ];

    // Start periodic fee tracking if token mint is configured
    if (this.config.tokenMint) {
      this.startFeeTracking();
    }
  }

  // ============ ADMIN FUNCTIONS ============

  // Validate admin secret
  validateAdmin(secret) {
    // If no admin secret configured, block all admin access
    if (!this.config.adminSecret) {
      return false;
    }
    return secret === this.config.adminSecret;
  }

  // Admin: Add tokens to reward pool manually
  addToPool(amount, adminSecret = null, source = 'manual') {
    // If adminSecret provided, validate it
    if (adminSecret !== null && !this.validateAdmin(adminSecret)) {
      return { success: false, error: 'Invalid admin secret' };
    }

    this.rewardPool += amount;
    this.totalAddedToPool += amount;

    const transaction = {
      type: 'pool_add',
      amount,
      source,
      timestamp: Date.now(),
      newPoolTotal: this.rewardPool
    };
    this.creatorFees.transactions.push(transaction);

    // Keep only last 100 transactions
    if (this.creatorFees.transactions.length > 100) {
      this.creatorFees.transactions.shift();
    }

    console.log(`[REWARDS] Added ${amount} to pool (source: ${source}). Total: ${this.rewardPool}`);
    return { success: true, amount, newTotal: this.rewardPool };
  }

  // Admin: Set reward percentages
  setRewardPercentages(percentages, adminSecret) {
    if (!this.validateAdmin(adminSecret)) {
      return { success: false, error: 'Invalid admin secret' };
    }

    if (!Array.isArray(percentages) || percentages.length !== 10) {
      return { success: false, error: 'Must provide exactly 10 percentages' };
    }

    const sum = percentages.reduce((a, b) => a + b, 0);
    if (sum > 1.0) {
      return { success: false, error: 'Percentages cannot exceed 100%' };
    }

    this.rewardPercentages = percentages;
    return { success: true, percentages: this.rewardPercentages };
  }

  // Admin: Force distribution (for testing or manual triggers)
  forceDistribution(leaderboard, adminSecret) {
    if (!this.validateAdmin(adminSecret)) {
      return { success: false, error: 'Invalid admin secret' };
    }
    return this.distributeRewards(leaderboard);
  }

  // ============ PUMP.FUN API INTEGRATION ============

  // Start periodic fee tracking from pump.fun
  startFeeTracking() {
    // Fetch every 5 minutes
    setInterval(() => this.fetchCreatorFees(), 5 * 60 * 1000);
    // Initial fetch
    this.fetchCreatorFees();
  }

  // Fetch creator fees from pump.fun API
  async fetchCreatorFees() {
    if (!this.config.tokenMint) {
      console.log('[REWARDS] No token mint configured, skipping fee fetch');
      return;
    }

    try {
      // pump.fun API endpoint for token trades
      // Note: This is a placeholder - pump.fun's actual API may differ
      const response = await fetch(
        `https://frontend-api.pump.fun/coins/${this.config.tokenMint}`,
        {
          headers: { 'Accept': 'application/json' },
          timeout: 10000
        }
      );

      if (!response.ok) {
        throw new Error(`pump.fun API error: ${response.status}`);
      }

      const data = await response.json();

      // Track the token data
      this.creatorFees.lastFetchTime = Date.now();
      this.creatorFees.tokenData = {
        name: data.name,
        symbol: data.symbol,
        marketCap: data.usd_market_cap,
        virtualSolReserves: data.virtual_sol_reserves,
        virtualTokenReserves: data.virtual_token_reserves,
        bondingCurveComplete: data.complete
      };

      console.log(`[REWARDS] Token data fetched: ${data.symbol} - MC: $${data.usd_market_cap?.toFixed(2)}`);

    } catch (error) {
      console.error('[REWARDS] Failed to fetch creator fees:', error.message);
    }
  }

  // Manually record a creator fee transaction (called when fee received)
  recordCreatorFee(amount, txSignature) {
    this.creatorFees.totalTracked += amount;
    this.creatorFees.transactions.push({
      type: 'creator_fee',
      amount,
      txSignature,
      timestamp: Date.now()
    });

    // Optionally auto-add to pool (configurable)
    if (this.config.autoAddFeesToPool) {
      this.addToPool(amount, null, 'creator_fee');
    }

    return { success: true, totalTracked: this.creatorFees.totalTracked };
  }

  // ============ REWARD DISTRIBUTION ============

  // Take snapshot of leaderboard and distribute rewards
  distributeRewards(leaderboard) {
    if (this.rewardPool <= 0 || leaderboard.length === 0) {
      console.log('[REWARDS] No rewards to distribute');
      return null;
    }

    const snapshot = {
      timestamp: Date.now(),
      pool: this.rewardPool,
      distributions: [],
      playersWithoutWallets: 0
    };

    // Calculate rewards for top 10
    const top10 = leaderboard.slice(0, 10);
    let distributed = 0;

    top10.forEach((player, index) => {
      if (!player.wallet) {
        snapshot.playersWithoutWallets++;
        return; // Skip players without wallets
      }

      const percentage = this.rewardPercentages[index] || 0;
      const reward = Math.floor(this.rewardPool * percentage);

      if (reward > 0) {
        // Add to pending rewards
        const current = this.pendingRewards.get(player.wallet) || 0;
        this.pendingRewards.set(player.wallet, current + reward);
        distributed += reward;

        snapshot.distributions.push({
          rank: index + 1,
          wallet: player.wallet,
          walletTruncated: player.wallet.slice(0, 4) + '...' + player.wallet.slice(-4),
          username: player.username,
          score: player.score,
          mass: player.mass,
          kills: player.kills,
          percentage: (percentage * 100).toFixed(1) + '%',
          reward
        });
      }
    });

    // Update totals
    this.rewardPool -= distributed;
    this.totalDistributed += distributed;
    this.lastDistribution = Date.now();
    this.hourlySnapshots.push(snapshot);

    // Keep only last 24 snapshots
    if (this.hourlySnapshots.length > 24) {
      this.hourlySnapshots.shift();
    }

    console.log(`[REWARDS] Distributed ${distributed} tokens to ${snapshot.distributions.length} players`);
    return snapshot;
  }

  // Get pending rewards for a wallet
  getPendingRewards(wallet) {
    return this.pendingRewards.get(wallet) || 0;
  }

  // Get claimed rewards for a wallet
  getClaimedRewards(wallet) {
    return this.claimedRewards.get(wallet) || 0;
  }

  // Claim rewards (marks as claimed, actual transfer happens on-chain)
  claimRewards(wallet) {
    const pending = this.pendingRewards.get(wallet) || 0;
    if (pending <= 0) {
      return { success: false, amount: 0, error: 'No pending rewards' };
    }

    // Move from pending to claimed
    const claimed = this.claimedRewards.get(wallet) || 0;
    this.claimedRewards.set(wallet, claimed + pending);
    this.pendingRewards.set(wallet, 0);

    return {
      success: true,
      amount: pending,
      totalClaimed: claimed + pending
    };
  }

  // Get time until next distribution
  getTimeUntilNextDistribution() {
    const elapsed = Date.now() - this.lastDistribution;
    const remaining = Math.max(0, this.distributionInterval - elapsed);
    return remaining;
  }

  // Get comprehensive reward stats
  getStats() {
    return {
      pool: this.rewardPool,
      totalDistributed: this.totalDistributed,
      totalAddedToPool: this.totalAddedToPool,
      lastDistribution: this.lastDistribution,
      nextDistribution: this.lastDistribution + this.distributionInterval,
      timeUntilNext: Math.max(0, (this.lastDistribution + this.distributionInterval) - Date.now()),
      totalPending: Array.from(this.pendingRewards.values()).reduce((a, b) => a + b, 0),
      totalClaimed: Array.from(this.claimedRewards.values()).reduce((a, b) => a + b, 0),
      pendingWallets: this.pendingRewards.size,
      recentSnapshots: this.hourlySnapshots.slice(-5),
      rewardPercentages: this.rewardPercentages.map((p, i) => ({
        rank: i + 1,
        percentage: (p * 100).toFixed(1) + '%'
      })),
      creatorFees: {
        totalTracked: this.creatorFees.totalTracked,
        lastFetchTime: this.creatorFees.lastFetchTime,
        tokenData: this.creatorFees.tokenData || null,
        recentTransactions: this.creatorFees.transactions.slice(-10)
      }
    };
  }

  // Get detailed stats for admin
  getAdminStats(adminSecret) {
    if (!this.validateAdmin(adminSecret)) {
      return { success: false, error: 'Invalid admin secret' };
    }

    return {
      ...this.getStats(),
      config: {
        tokenMint: this.config.tokenMint,
        creatorWallet: this.config.creatorWallet,
        autoAddFeesToPool: this.config.autoAddFeesToPool
      },
      allPendingRewards: Array.from(this.pendingRewards.entries()).map(([wallet, amount]) => ({
        wallet,
        walletTruncated: wallet.slice(0, 4) + '...' + wallet.slice(-4),
        amount
      })),
      allClaimedRewards: Array.from(this.claimedRewards.entries()).map(([wallet, amount]) => ({
        wallet,
        walletTruncated: wallet.slice(0, 4) + '...' + wallet.slice(-4),
        amount
      })),
      allTransactions: this.creatorFees.transactions
    };
  }

  // Configure the reward manager
  configure(config, adminSecret) {
    if (!this.validateAdmin(adminSecret)) {
      return { success: false, error: 'Invalid admin secret' };
    }

    if (config.tokenMint) this.config.tokenMint = config.tokenMint;
    if (config.creatorWallet) this.config.creatorWallet = config.creatorWallet;
    if (typeof config.autoAddFeesToPool === 'boolean') {
      this.config.autoAddFeesToPool = config.autoAddFeesToPool;
    }

    return { success: true, config: this.config };
  }
}

module.exports = RewardManager;
