// Reward Distribution System
// Tracks player scores and distributes rewards hourly

class RewardManager {
  constructor() {
    // In-memory storage (use Redis/DB in production)
    this.pendingRewards = new Map(); // wallet -> pending amount
    this.claimedRewards = new Map(); // wallet -> claimed amount
    this.hourlySnapshots = [];       // Historical snapshots
    this.lastDistribution = Date.now();
    this.distributionInterval = 60 * 60 * 1000; // 1 hour

    // Reward pool (in tokens, not SOL)
    this.rewardPool = 0;
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
  }

  // Add tokens to reward pool (from creator fees)
  addToPool(amount) {
    this.rewardPool += amount;
    console.log(`Added ${amount} to reward pool. Total: ${this.rewardPool}`);
  }

  // Take snapshot of leaderboard and distribute rewards
  distributeRewards(leaderboard) {
    if (this.rewardPool <= 0 || leaderboard.length === 0) {
      console.log('No rewards to distribute');
      return null;
    }

    const snapshot = {
      timestamp: Date.now(),
      pool: this.rewardPool,
      distributions: []
    };

    // Calculate rewards for top 10
    const top10 = leaderboard.slice(0, 10);
    let distributed = 0;

    top10.forEach((player, index) => {
      if (!player.wallet) return; // Skip players without wallets

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
          username: player.username,
          score: player.score,
          reward
        });
      }
    });

    // Update pool
    this.rewardPool -= distributed;
    this.lastDistribution = Date.now();
    this.hourlySnapshots.push(snapshot);

    // Keep only last 24 snapshots
    if (this.hourlySnapshots.length > 24) {
      this.hourlySnapshots.shift();
    }

    console.log(`Distributed ${distributed} tokens to ${snapshot.distributions.length} players`);
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

  // Get reward stats
  getStats() {
    return {
      pool: this.rewardPool,
      lastDistribution: this.lastDistribution,
      nextDistribution: this.lastDistribution + this.distributionInterval,
      totalPending: Array.from(this.pendingRewards.values()).reduce((a, b) => a + b, 0),
      totalClaimed: Array.from(this.claimedRewards.values()).reduce((a, b) => a + b, 0),
      recentSnapshots: this.hourlySnapshots.slice(-5)
    };
  }
}

module.exports = RewardManager;
