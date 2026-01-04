/**
 * MADURO.GG Solana Integration
 *
 * Handles SOL prize distribution to game winners.
 * Uses native SOL transfers (not SPL tokens) for simplicity.
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

class SolanaDistributor {
  constructor(config = {}) {
    // Network config
    this.rpcUrl = config.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.network = this.rpcUrl.includes('devnet') ? 'devnet' :
                   this.rpcUrl.includes('mainnet') ? 'mainnet' : 'unknown';

    // Token config (for eligibility checking)
    this.tokenMint = config.tokenMint || process.env.TOKEN_MINT;
    this.minTokenHolding = config.minTokenHolding || parseFloat(process.env.MIN_TOKEN_HOLDING || '1000');

    // Prize wallet
    this.prizeWalletPath = config.prizeWalletPath || process.env.PRIZE_WALLET_PATH || './prize-wallet.json';
    this.prizeWallet = null;

    // Distribution settings
    this.maxPrizePerRound = parseFloat(process.env.MAX_PRIZE_PER_ROUND || '0.1'); // Max 0.1 SOL per round
    this.reserveForFees = 0.01; // Keep for tx fees

    // Connection
    this.connection = null;
    this.initialized = false;

    // Stats
    this.totalDistributed = 0;
    this.distributionCount = 0;
  }

  /**
   * Initialize the distributor
   */
  async initialize() {
    try {
      // Connect to Solana
      this.connection = new Connection(this.rpcUrl, 'confirmed');
      console.log(`[Solana] Connected to ${this.network} (${this.rpcUrl})`);

      // Load prize wallet
      await this.loadPrizeWallet();

      // Check balance
      const balance = await this.getWalletBalance();
      console.log(`[Solana] Prize wallet: ${this.prizeWallet.publicKey.toString()}`);
      console.log(`[Solana] Balance: ${balance.toFixed(4)} SOL`);

      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[Solana] Initialization failed: ${error.message}`);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Load prize wallet from env var (base64) or keypair file
   */
  async loadPrizeWallet() {
    // Option 1: Load from PRIZE_WALLET_SECRET env var (base64 encoded JSON array)
    if (process.env.PRIZE_WALLET_SECRET) {
      try {
        const decoded = Buffer.from(process.env.PRIZE_WALLET_SECRET, 'base64').toString('utf8');
        const secretKey = JSON.parse(decoded);
        this.prizeWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        console.log('[Solana] Loaded prize wallet from PRIZE_WALLET_SECRET env var');
        return;
      } catch (error) {
        throw new Error(`Failed to parse PRIZE_WALLET_SECRET: ${error.message}`);
      }
    }

    // Option 2: Load from keypair file
    const resolved = path.resolve(this.prizeWalletPath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`Prize wallet not found. Set PRIZE_WALLET_SECRET env var or run: npm run wallet:create`);
    }

    const secretKey = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    this.prizeWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log('[Solana] Loaded prize wallet from file');
  }

  /**
   * Get prize wallet SOL balance
   */
  async getWalletBalance() {
    if (!this.connection || !this.prizeWallet) return 0;

    try {
      const balance = await this.connection.getBalance(this.prizeWallet.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error(`[Solana] Failed to get balance: ${error.message}`);
      return 0;
    }
  }

  /**
   * Check if a wallet holds enough $MADURO tokens
   */
  async checkTokenBalance(walletAddress) {
    if (!this.tokenMint || !this.connection) return 0;

    try {
      const wallet = new PublicKey(walletAddress);
      const mint = new PublicKey(this.tokenMint);

      const ata = await getAssociatedTokenAddress(mint, wallet);
      const account = await getAccount(this.connection, ata);

      // Assuming 6 decimals (pump.fun standard)
      return Number(account.amount) / 1e6;
    } catch (error) {
      // Token account doesn't exist = 0 balance
      if (error.name === 'TokenAccountNotFoundError') {
        return 0;
      }
      console.warn(`[Solana] Token balance check failed for ${walletAddress}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Check if a winner is eligible (has wallet + holds tokens)
   */
  async isEligible(winner) {
    if (!winner.wallet) {
      console.log(`[Solana] ${winner.username} ineligible: no wallet connected`);
      return { eligible: false, reason: 'no_wallet', tokenBalance: 0 };
    }

    // Skip token check if no token mint configured (testing mode)
    if (!this.tokenMint) {
      console.log(`[Solana] ${winner.username} eligible (no token requirement in test mode)`);
      return { eligible: true, reason: 'test_mode', tokenBalance: 0 };
    }

    const tokenBalance = await this.checkTokenBalance(winner.wallet);

    if (tokenBalance >= this.minTokenHolding) {
      console.log(`[Solana] ${winner.username} eligible: ${tokenBalance.toLocaleString()} $MADURO`);
      return { eligible: true, reason: 'has_tokens', tokenBalance };
    } else {
      console.log(`[Solana] ${winner.username} ineligible: ${tokenBalance.toLocaleString()} $MADURO (need ${this.minTokenHolding})`);
      return { eligible: false, reason: 'insufficient_tokens', tokenBalance };
    }
  }

  /**
   * Distribute SOL rewards to winners
   *
   * @param {Array} winners - Array of { wallet, username, percentage }
   * @param {number} totalPrize - Total SOL to distribute (optional, uses maxPrizePerRound if not specified)
   * @returns {Object} Distribution result
   */
  async distribute(winners, totalPrize = null) {
    if (!this.initialized) {
      console.error('[Solana] Not initialized. Call initialize() first.');
      return { success: false, error: 'not_initialized', results: [] };
    }

    if (!winners || winners.length === 0) {
      console.log('[Solana] No winners to distribute to');
      return { success: false, error: 'no_winners', results: [] };
    }

    // Check wallet balance
    const balance = await this.getWalletBalance();
    const availableBalance = balance - this.reserveForFees;

    if (availableBalance <= 0) {
      console.error(`[Solana] Insufficient balance: ${balance.toFixed(4)} SOL (need ${this.reserveForFees} for fees)`);
      return { success: false, error: 'insufficient_balance', balance, results: [] };
    }

    // Calculate prize pool
    const prizePool = totalPrize
      ? Math.min(totalPrize, availableBalance, this.maxPrizePerRound)
      : Math.min(availableBalance, this.maxPrizePerRound);

    if (prizePool < 0.001) {
      console.log(`[Solana] Prize too small: ${prizePool.toFixed(6)} SOL`);
      return { success: false, error: 'prize_too_small', prizePool, results: [] };
    }

    console.log(`[Solana] Distributing ${prizePool.toFixed(4)} SOL to ${winners.length} winners`);

    // Filter eligible winners
    const eligibleWinners = [];
    for (const winner of winners) {
      const eligibility = await this.isEligible(winner);
      if (eligibility.eligible) {
        eligibleWinners.push({ ...winner, tokenBalance: eligibility.tokenBalance });
      }
    }

    if (eligibleWinners.length === 0) {
      console.log('[Solana] No eligible winners (no wallets or insufficient tokens)');
      return { success: false, error: 'no_eligible_winners', results: [] };
    }

    // Calculate individual prizes based on percentages
    const results = [];
    let totalSent = 0;

    // Normalize percentages for eligible winners only
    const totalPercentage = eligibleWinners.reduce((sum, w) => sum + (w.percentage || 0), 0);

    for (const winner of eligibleWinners) {
      const percentage = (winner.percentage || 0) / totalPercentage;
      const amountSOL = prizePool * percentage;
      const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      if (amountLamports < 1000) {
        console.log(`[Solana] Skipping dust amount for ${winner.username}: ${amountSOL.toFixed(6)} SOL`);
        results.push({
          username: winner.username,
          wallet: winner.wallet,
          amountSOL,
          status: 'skipped',
          reason: 'dust_amount'
        });
        continue;
      }

      try {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: this.prizeWallet.publicKey,
            toPubkey: new PublicKey(winner.wallet),
            lamports: amountLamports
          })
        );

        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.prizeWallet],
          { commitment: 'confirmed' }
        );

        console.log(`[Solana] Sent ${amountSOL.toFixed(6)} SOL to ${winner.username} (${signature})`);

        results.push({
          username: winner.username,
          wallet: winner.wallet,
          amountSOL,
          status: 'success',
          signature,
          explorerUrl: `https://solscan.io/tx/${signature}?cluster=${this.network}`
        });

        totalSent += amountSOL;

      } catch (error) {
        console.error(`[Solana] Failed to send to ${winner.username}: ${error.message}`);
        results.push({
          username: winner.username,
          wallet: winner.wallet,
          amountSOL,
          status: 'error',
          error: error.message
        });
      }
    }

    // Update stats
    this.totalDistributed += totalSent;
    this.distributionCount++;

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`[Solana] Distribution #${this.distributionCount} complete: ${successCount}/${eligibleWinners.length} winners, ${totalSent.toFixed(6)} SOL`);

    return {
      success: successCount > 0,
      prizePool,
      totalSent,
      eligibleCount: eligibleWinners.length,
      successCount,
      results,
      stats: {
        totalDistributed: this.totalDistributed,
        distributionCount: this.distributionCount
      }
    };
  }

  /**
   * Get distributor status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      network: this.network,
      prizeWallet: this.prizeWallet ? this.prizeWallet.publicKey.toString() : null,
      tokenMint: this.tokenMint,
      minTokenHolding: this.minTokenHolding,
      maxPrizePerRound: this.maxPrizePerRound,
      stats: {
        totalDistributed: this.totalDistributed,
        distributionCount: this.distributionCount
      }
    };
  }
}

module.exports = SolanaDistributor;
