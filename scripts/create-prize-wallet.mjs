#!/usr/bin/env node
/**
 * Generate a new prize wallet keypair for MADURO.GG
 *
 * Usage:
 *   node scripts/create-prize-wallet.mjs
 *
 * This creates a new Solana keypair and saves it to prize-wallet.json
 * Fund this wallet with SOL to be distributed as prizes.
 */

import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const OUTPUT_PATH = process.argv[2] || './prize-wallet.json';

// Check if file already exists
if (fs.existsSync(OUTPUT_PATH)) {
  console.error(`\x1b[31mError: ${OUTPUT_PATH} already exists!\x1b[0m`);
  console.error('Delete it first if you want to generate a new wallet.');
  console.error('\x1b[33mWARNING: Deleting will lose access to any funds in that wallet!\x1b[0m');
  process.exit(1);
}

// Generate new keypair
const keypair = Keypair.generate();

// Save to file
const secretKeyArray = Array.from(keypair.secretKey);
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(secretKeyArray));

console.log('\x1b[32m=== Prize Wallet Created ===\x1b[0m\n');
console.log(`Public Key: \x1b[36m${keypair.publicKey.toString()}\x1b[0m`);
console.log(`Keypair saved to: ${path.resolve(OUTPUT_PATH)}`);
console.log('\n\x1b[33mIMPORTANT:\x1b[0m');
console.log('1. Fund this wallet with SOL for prize distribution');
console.log('2. Keep prize-wallet.json secure and NEVER commit to git');
console.log('3. Back up the keypair file in a safe location');
console.log('\nTo check balance:');
console.log(`  solana balance ${keypair.publicKey.toString()}`);
console.log('\nTo fund on devnet:');
console.log(`  solana airdrop 2 ${keypair.publicKey.toString()} --url devnet`);
