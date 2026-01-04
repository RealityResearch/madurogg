#!/usr/bin/env node
/**
 * MADURO.GG Prize Distribution Script
 *
 * Distributes SOL rewards to game winners who hold $MADURO tokens.
 *
 * Flow:
 * 1. Check prize pool balance (funded explicitly)
 * 2. Fetch leaderboard from game server
 * 3. Check each winner's $MADURO token balance
 * 4. Distribute SOL to eligible winners (must hold tokens)
 *
 * Usage:
 *   node scripts/prize-distribution.mjs fund 0.5      # Add 0.5 SOL to prize pool
 *   node scripts/prize-distribution.mjs balance       # Check prize pool balance
 *   node scripts/prize-distribution.mjs distribute    # Distribute prizes
 *   node scripts/prize-distribution.mjs --dry-run    # Test without sending
 *   node scripts/prize-distribution.mjs --daemon     # Run continuously
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

// ============ CONFIGURATION ============

const CONFIG = {
  // Network
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',

  // Token mint address (UPDATE AFTER PUMP.FUN LAUNCH)
  tokenMint: process.env.TOKEN_MINT || 'CmgJ1PobhUqB7MEa8qDkiG2TUpMTskWj8d9JeZWSpump',

  // Prize wallet keypair path (holds prize SOL)
  prizeWalletPath: process.env.PRIZE_WALLET_PATH || './prize-wallet.json',

  // Prize pool state file (tracks how much is allocated for prizes)
  prizePoolStatePath: process.env.PRIZE_POOL_STATE || './prize-pool-state.json',

  // Game server API
  gameServerUrl: process.env.GAME_SERVER_URL || 'https://maduro.gg',

  // Distribution settings
  maxPrizeFixed: parseFloat(process.env.MAX_PRIZE_FIXED || '0.2'), // Max fixed amount per round
  maxPrizePercent: parseFloat(process.env.MAX_PRIZE_PERCENT || '0.25'), // Max 25% of pool per round
  minTokenHolding: parseFloat(process.env.MIN_TOKEN_HOLDING || '1000'), // Must hold 1000+ tokens
  reserveForFees: parseFloat(process.env.RESERVE_FOR_FEES || '0.01'), // Keep for tx fees

  // Reward percentages for TOP 3 only
  rewardPercentages: [
    0.50,  // 1st place: 50%
    0.30,  // 2nd place: 30%
    0.20,  // 3rd place: 20%
  ],

  // Daemon mode settings
  distributionInterval: parseInt(process.env.DISTRIBUTION_INTERVAL || '3600000'), // 1 hour
};

// ============ PRIZE POOL STATE ============

function loadPrizePoolState() {
  try {
    if (fs.existsSync(CONFIG.prizePoolStatePath)) {
      return JSON.parse(fs.readFileSync(CONFIG.prizePoolStatePath, 'utf8'));
    }
  } catch (e) {
    log('WARN', `Failed to load prize pool state: ${e.message}`);
  }
  return {
    availableSOL: 0,
    totalFunded: 0,
    totalDistributed: 0,
    distributions: [],
    lastUpdated: null
  };
}

function savePrizePoolState(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.prizePoolStatePath, JSON.stringify(state, null, 2));
}

// ============ HELPERS ============

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = {
    'INFO': '\x1b[36m[INFO]\x1b[0m',
    'SUCCESS': '\x1b[32m[SUCCESS]\x1b[0m',
    'WARN': '\x1b[33m[WARN]\x1b[0m',
    'ERROR': '\x1b[31m[ERROR]\x1b[0m',
  }[level] || '[LOG]';

  console.log(`${timestamp} ${prefix} ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

function loadKeypair(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Keypair file not found: ${resolved}`);
  }
  const secretKey = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ============ CORE FUNCTIONS ============

/**
 * Get token balance for a wallet
 */
async function getTokenBalance(connection, walletAddress, tokenMint) {
  try {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(tokenMint);

    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);

    // Assuming 6 decimals (pump.fun standard)
    return Number(account.amount) / 1e6;
  } catch (error) {
    if (error.name === 'TokenAccountNotFoundError') {
      return 0;
    }
    log('WARN', `Failed to get token balance for ${walletAddress}: ${error.message}`);
    return 0;
  }
}

/**
 * Fetch leaderboard from game server
 */
async function fetchLeaderboard() {
  try {
    const response = await fetchWithTimeout(`${CONFIG.gameServerUrl}/api/leaderboard`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    let allPlayers = [];

    if (Array.isArray(data)) {
      allPlayers = data;
    } else if (typeof data === 'object') {
      for (const roomId in data) {
        if (Array.isArray(data[roomId])) {
          allPlayers = allPlayers.concat(data[roomId]);
        }
      }
    }

    allPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
    return allPlayers.slice(0, 3); // Top 3 only

  } catch (error) {
    log('ERROR', `Failed to fetch leaderboard: ${error.message}`);
    return [];
  }
}

/**
 * Filter winners who hold enough $MADURO tokens
 */
async function filterEligibleWinners(connection, leaderboard) {
  const eligible = [];

  for (const player of leaderboard) {
    if (!player.wallet) {
      log('WARN', `Player ${player.username} has no wallet connected`);
      continue;
    }

    const tokenBalance = await getTokenBalance(
      connection,
      player.wallet,
      CONFIG.tokenMint
    );

    if (tokenBalance >= CONFIG.minTokenHolding) {
      eligible.push({
        ...player,
        tokenBalance
      });
      log('INFO', `${player.username} eligible: ${tokenBalance.toLocaleString()} $MADURO`);
    } else {
      log('WARN', `${player.username} ineligible: ${tokenBalance.toLocaleString()} $MADURO (need ${CONFIG.minTokenHolding})`);
    }
  }

  return eligible;
}

/**
 * Calculate prize amounts for each winner
 */
function calculatePrizes(eligibleWinners, totalPrizePool) {
  const prizes = [];
  let usedPercentages = CONFIG.rewardPercentages.slice(0, eligibleWinners.length);
  const totalPercent = usedPercentages.reduce((a, b) => a + b, 0);

  for (let i = 0; i < eligibleWinners.length; i++) {
    const winner = eligibleWinners[i];
    const percentage = usedPercentages[i];
    const amount = totalPrizePool * (percentage / totalPercent);

    prizes.push({
      rank: i + 1,
      wallet: winner.wallet,
      username: winner.username,
      score: winner.score,
      tokenBalance: winner.tokenBalance,
      percentage: (percentage / totalPercent * 100).toFixed(1),
      amountSOL: amount,
      amountLamports: Math.floor(amount * LAMPORTS_PER_SOL)
    });
  }

  return prizes;
}

/**
 * Execute SOL transfers to winners
 */
async function distributeSOL(connection, prizeWallet, prizes, dryRun = false) {
  const results = [];

  for (const prize of prizes) {
    if (prize.amountLamports < 1000) {
      log('WARN', `Skipping dust amount for ${prize.username}: ${prize.amountSOL} SOL`);
      continue;
    }

    try {
      if (dryRun) {
        log('INFO', `[DRY RUN] Would send ${prize.amountSOL.toFixed(6)} SOL to ${prize.username} (${prize.wallet})`);
        results.push({ ...prize, status: 'dry-run', signature: null });
        continue;
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: prizeWallet.publicKey,
          toPubkey: new PublicKey(prize.wallet),
          lamports: prize.amountLamports
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [prizeWallet],
        { commitment: 'confirmed' }
      );

      log('SUCCESS', `Sent ${prize.amountSOL.toFixed(6)} SOL to ${prize.username}`, { signature });
      results.push({ ...prize, status: 'success', signature });

    } catch (error) {
      log('ERROR', `Failed to send to ${prize.username}: ${error.message}`);
      results.push({ ...prize, status: 'error', error: error.message });
    }
  }

  return results;
}

// ============ COMMANDS ============

/**
 * Fund the prize pool
 */
async function fundPrizePool(amountSOL) {
  if (isNaN(amountSOL) || amountSOL <= 0) {
    log('ERROR', 'Invalid amount. Usage: fund <amount_in_SOL>');
    return;
  }

  const connection = new Connection(CONFIG.rpcUrl, 'confirmed');
  const prizeWallet = loadKeypair(CONFIG.prizeWalletPath);

  // Check wallet has enough balance
  const balance = await connection.getBalance(prizeWallet.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;

  const state = loadPrizePoolState();
  const totalNeeded = state.availableSOL + amountSOL + CONFIG.reserveForFees;

  if (balanceSOL < totalNeeded) {
    log('ERROR', `Insufficient balance. Wallet has ${balanceSOL.toFixed(4)} SOL, need ${totalNeeded.toFixed(4)} SOL`);
    log('INFO', `Prize wallet address: ${prizeWallet.publicKey.toString()}`);
    log('INFO', `Send more SOL to the prize wallet first.`);
    return;
  }

  // Add to prize pool
  state.availableSOL += amountSOL;
  state.totalFunded += amountSOL;
  savePrizePoolState(state);

  log('SUCCESS', `Added ${amountSOL} SOL to prize pool`);
  log('INFO', `Available for distribution: ${state.availableSOL.toFixed(4)} SOL`);
  log('INFO', `Total funded all-time: ${state.totalFunded.toFixed(4)} SOL`);
}

/**
 * Check prize pool balance
 */
async function checkBalance() {
  const connection = new Connection(CONFIG.rpcUrl, 'confirmed');

  let prizeWallet;
  try {
    prizeWallet = loadKeypair(CONFIG.prizeWalletPath);
  } catch (e) {
    log('ERROR', `Prize wallet not found. Run: npm run wallet:create`);
    return;
  }

  const balance = await connection.getBalance(prizeWallet.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;

  const state = loadPrizePoolState();

  const percentBased = state.availableSOL * CONFIG.maxPrizePercent;
  const nextPrize = Math.min(CONFIG.maxPrizeFixed, percentBased);

  console.log('\n=== Prize Pool Status ===\n');
  console.log(`Prize Wallet: ${prizeWallet.publicKey.toString()}`);
  console.log(`Wallet Balance: ${balanceSOL.toFixed(4)} SOL`);
  console.log(`\nPrize Pool:`);
  console.log(`  Available: \x1b[32m${state.availableSOL.toFixed(4)} SOL\x1b[0m`);
  console.log(`\nNext Distribution:`);
  console.log(`  25% of pool: ${percentBased.toFixed(4)} SOL`);
  console.log(`  Fixed max: ${CONFIG.maxPrizeFixed} SOL`);
  console.log(`  → Prize: \x1b[33m${nextPrize.toFixed(4)} SOL\x1b[0m (lower of the two)`);
  console.log(`  → Top 3 split: 50% / 30% / 20%`);
  console.log(`\nHistory:`);
  console.log(`  Total funded: ${state.totalFunded.toFixed(4)} SOL`);
  console.log(`  Total distributed: ${state.totalDistributed.toFixed(4)} SOL`);
  console.log(`  Distributions: ${state.distributions.length}`);
  console.log(`\nRecent distributions:`);

  if (state.distributions.length > 0) {
    const recent = state.distributions.slice(-3);
    for (const d of recent) {
      console.log(`  - ${d.timestamp}: ${d.amountSOL.toFixed(4)} SOL to ${d.winners} winners`);
    }
  }
  console.log('');
}

/**
 * Main distribution function
 */
async function runDistribution(dryRun = false) {
  log('INFO', '=== Starting Prize Distribution ===');
  log('INFO', `Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const state = loadPrizePoolState();

  // Calculate prize: min(fixed amount, 25% of pool)
  const percentBased = state.availableSOL * CONFIG.maxPrizePercent;
  const prizePool = Math.min(CONFIG.maxPrizeFixed, percentBased);

  // Need at least 0.01 SOL to distribute
  if (prizePool < 0.01) {
    log('WARN', `Prize too small: ${prizePool.toFixed(4)} SOL`);
    log('INFO', `Pool has ${state.availableSOL.toFixed(4)} SOL (25% = ${percentBased.toFixed(4)}, max fixed = ${CONFIG.maxPrizeFixed})`);
    log('INFO', `Fund the pool with: npm run prizes fund <amount>`);
    return { success: false, error: 'Prize pool insufficient' };
  }

  log('INFO', `Pool balance: ${state.availableSOL.toFixed(4)} SOL`);
  log('INFO', `25% of pool: ${percentBased.toFixed(4)} SOL`);
  log('INFO', `Fixed max: ${CONFIG.maxPrizeFixed} SOL`);
  log('INFO', `Prize this round: ${prizePool.toFixed(4)} SOL (lower of the two)`);
  log('INFO', `Prize pool: ${prizePool.toFixed(4)} SOL`);
  log('INFO', `Token mint: ${CONFIG.tokenMint}`);
  log('INFO', `Min token holding: ${CONFIG.minTokenHolding}`);

  // Connect to Solana
  const connection = new Connection(CONFIG.rpcUrl, 'confirmed');
  log('INFO', `Connected to ${CONFIG.rpcUrl}`);

  // Load prize wallet
  let prizeWallet;
  try {
    prizeWallet = loadKeypair(CONFIG.prizeWalletPath);
    log('INFO', `Prize wallet: ${prizeWallet.publicKey.toString()}`);
  } catch (error) {
    log('ERROR', `Failed to load prize wallet: ${error.message}`);
    return { success: false, error: 'Failed to load prize wallet' };
  }

  // Verify wallet has enough balance
  const balance = await connection.getBalance(prizeWallet.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;

  if (balanceSOL < prizePool + CONFIG.reserveForFees) {
    log('ERROR', `Wallet balance (${balanceSOL.toFixed(4)} SOL) less than prize pool (${prizePool.toFixed(4)} SOL)`);
    return { success: false, error: 'Insufficient wallet balance' };
  }

  // Fetch leaderboard
  const leaderboard = await fetchLeaderboard();
  log('INFO', `Leaderboard: ${leaderboard.length} players`);

  if (leaderboard.length === 0) {
    log('WARN', 'No players on leaderboard. Skipping.');
    return { success: false, error: 'No players' };
  }

  // Filter eligible winners
  const eligible = await filterEligibleWinners(connection, leaderboard);
  log('INFO', `Eligible winners: ${eligible.length}`);

  if (eligible.length === 0) {
    log('WARN', 'No eligible winners (none hold enough tokens). Skipping.');
    return { success: false, error: 'No eligible winners' };
  }

  // Calculate prizes
  const prizes = calculatePrizes(eligible, prizePool);

  log('INFO', 'Prize breakdown:');
  for (const p of prizes) {
    log('INFO', `  #${p.rank} ${p.username}: ${p.amountSOL.toFixed(6)} SOL (${p.percentage}%)`);
  }

  // Execute distribution
  const results = await distributeSOL(connection, prizeWallet, prizes, dryRun);

  const successful = results.filter(r => r.status === 'success').length;
  const totalDistributed = results
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + r.amountSOL, 0);

  // Update state (only if not dry run)
  if (!dryRun && successful > 0) {
    state.availableSOL -= totalDistributed;
    state.totalDistributed += totalDistributed;
    state.distributions.push({
      timestamp: new Date().toISOString(),
      amountSOL: totalDistributed,
      winners: successful,
      results: results.map(r => ({
        rank: r.rank,
        wallet: r.wallet,
        username: r.username,
        amountSOL: r.amountSOL,
        status: r.status,
        signature: r.signature
      }))
    });

    // Keep last 100 distributions
    if (state.distributions.length > 100) {
      state.distributions = state.distributions.slice(-100);
    }

    savePrizePoolState(state);
  }

  log('SUCCESS', `Distribution complete: ${successful}/${prizes.length} winners, ${totalDistributed.toFixed(6)} SOL`);
  log('INFO', `Remaining in pool: ${(state.availableSOL - (dryRun ? 0 : totalDistributed)).toFixed(4)} SOL`);

  return {
    success: true,
    prizePool,
    winners: prizes.length,
    distributed: totalDistributed,
    results
  };
}

/**
 * Daemon mode
 */
async function runDaemon() {
  log('INFO', `Starting daemon mode (interval: ${CONFIG.distributionInterval / 1000}s)`);

  const runOnce = async () => {
    log('INFO', '--- Scheduled distribution check ---');
    const state = loadPrizePoolState();
    const potentialPrize = Math.min(CONFIG.maxPrizeFixed, state.availableSOL * CONFIG.maxPrizePercent);
    if (potentialPrize >= 0.01) {
      await runDistribution(false);
    } else {
      log('INFO', `Prize pool: ${state.availableSOL.toFixed(4)} SOL (prize would be ${potentialPrize.toFixed(4)} SOL). Waiting for funding.`);
    }
  };

  // Run immediately
  await runOnce();

  // Then run on interval
  setInterval(runOnce, CONFIG.distributionInterval);
}

// ============ CLI ============

const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h' || !command) {
  console.log(`
MADURO.GG Prize Distribution Script

Usage:
  node scripts/prize-distribution.mjs <command> [options]

Commands:
  fund <amount>     Add SOL to the prize pool (e.g., fund 0.5)
  balance           Check prize pool status
  distribute        Run distribution (only if pool is funded)
  --dry-run         Test distribution without sending
  --daemon          Run continuously, distribute when funded

Examples:
  npm run prizes fund 0.5     # Add 0.5 SOL to prize pool
  npm run prizes balance      # Check current prize pool
  npm run prizes -- --dry-run # Test distribution
  npm run prizes distribute   # Actually distribute
  npm run prizes:daemon       # Run hourly (distributes when funded)

Environment Variables:
  SOLANA_RPC_URL         RPC endpoint (default: mainnet)
  TOKEN_MINT             $MADURO token mint address
  PRIZE_WALLET_PATH      Path to prize wallet keypair
  MIN_TOKEN_HOLDING      Min $MADURO to be eligible (default: 1000)
`);
  process.exit(0);
}

// Route commands
if (command === 'fund') {
  const amount = parseFloat(args[1]);
  fundPrizePool(amount).catch(err => {
    log('ERROR', err.message);
    process.exit(1);
  });
} else if (command === 'balance' || command === 'status') {
  checkBalance().catch(err => {
    log('ERROR', err.message);
    process.exit(1);
  });
} else if (command === 'distribute') {
  runDistribution(false).then(result => {
    if (!result.success) process.exit(1);
  }).catch(err => {
    log('ERROR', err.message);
    process.exit(1);
  });
} else if (command === '--dry-run') {
  runDistribution(true).then(result => {
    if (!result.success) process.exit(1);
  }).catch(err => {
    log('ERROR', err.message);
    process.exit(1);
  });
} else if (command === '--daemon') {
  runDaemon().catch(err => {
    log('ERROR', `Daemon crashed: ${err.message}`);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run with --help for usage');
  process.exit(1);
}
