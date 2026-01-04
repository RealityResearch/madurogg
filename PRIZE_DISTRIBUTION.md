# MADURO.GG Prize Distribution System

This document explains how the SOL prize distribution works for MADURO.GG.

---

## How It Works

```
┌──────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│   Pump.fun       │    │   Prize Wallet    │    │   Winners       │
│   Trading        │    │   (Holds SOL)     │    │   (Top Players) │
└────────┬─────────┘    └─────────┬─────────┘    └────────▲────────┘
         │                        │                       │
    0.3% creator fees             │                       │
         │                        │                       │
         ▼                        │                       │
┌──────────────────┐              │                       │
│   Dev Wallet     │──────────────┘                       │
│   (Receives SOL) │    1. Send SOL to prize wallet       │
└──────────────────┘              │                       │
                                  │                       │
                    ┌─────────────▼───────────┐           │
                    │  2. Fund prize pool     │           │
                    │  npm run prizes fund 0.5│           │
                    └─────────────┬───────────┘           │
                                  │                       │
                    ┌─────────────▼───────────┐           │
                    │  3. Distribute          │───────────┘
                    │  (only when funded)     │
                    └─────────────────────────┘
```

### Key Points

1. **Explicit funding** - YOU decide how much SOL to allocate as prizes
2. **Only distributes what you fund** - never touches unfunded SOL
3. **Must hold $MADURO to win** - creates buy pressure for the token
4. **Winners receive SOL** - more liquid and useful than tokens
5. **Daemon waits for funding** - won't distribute if pool is empty

---

## Quick Start

### 1. Create Prize Wallet

```bash
npm run wallet:create
```

This creates `prize-wallet.json` with a new Solana keypair.

**IMPORTANT:**
- Back up this file securely
- Never commit to git (already in .gitignore)
- This wallet holds the prize pool SOL

### 2. Send SOL to Prize Wallet

Get the prize wallet address from the creation output, then send SOL:

```bash
# Using Phantom/Solflare: Send to the prize wallet address
# Or using CLI:
solana transfer <PRIZE_WALLET_ADDRESS> 1
```

### 3. Fund the Prize Pool

This tells the script how much SOL to distribute:

```bash
npm run prizes fund 0.5    # Allocate 0.5 SOL for prizes
```

**This is the key step!** The script only distributes what you explicitly fund.

### 4. Check Status

```bash
npm run prizes balance
```

Shows:
- Wallet balance (total SOL in wallet)
- Prize pool (SOL allocated for distribution)
- Distribution history

### 5. Distribute Prizes

```bash
npm run prizes distribute   # Run once
# or
npm run prizes:daemon       # Run hourly (only distributes when funded)
```

---

## Reward Distribution Breakdown

| Rank | Share |
|------|-------|
| 1st  | 30%   |
| 2nd  | 20%   |
| 3rd  | 15%   |
| 4th  | 10%   |
| 5th  | 8%    |
| 6th  | 6%    |
| 7th  | 4%    |
| 8th  | 3%    |
| 9th  | 2%    |
| 10th | 2%    |

**Note:** If fewer than 10 players are eligible, percentages are normalized among eligible winners.

---

## Eligibility Rules

A player is eligible for rewards if:

1. **Wallet connected** - Must have Phantom wallet connected during gameplay
2. **On leaderboard** - Must be in top 10 by score
3. **Holds $MADURO** - Must have 1000+ tokens in their wallet

Players without wallets or without enough tokens are skipped. Their share goes to other eligible winners.

---

## Example Distribution

**Scenario:**
- Prize wallet: 2.0 SOL
- Reserve: 0.05 SOL
- Distribution %: 50%

**Calculation:**
```
Available: 2.0 - 0.05 = 1.95 SOL
Prize pool: 1.95 × 0.50 = 0.975 SOL
```

**If all 10 players eligible:**
| Rank | Player | $MADURO | SOL Prize |
|------|--------|---------|-----------|
| 1st  | Trump  | 50,000  | 0.2925    |
| 2nd  | Maduro | 25,000  | 0.1950    |
| 3rd  | Biden  | 10,000  | 0.1463    |
| ...  | ...    | ...     | ...       |

**If only 3 players eligible:**
Percentages renormalize: 30+20+15 = 65% total
- 1st gets 30/65 = 46.2% = 0.450 SOL
- 2nd gets 20/65 = 30.8% = 0.300 SOL
- 3rd gets 15/65 = 23.1% = 0.225 SOL

---

## Post-Launch Checklist

After launching $MADURO on pump.fun:

### 1. Get Token Mint Address
```
Go to pump.fun → Your token → Copy contract address
Example: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### 2. Update Environment
```bash
export TOKEN_MINT="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
```

### 3. Update Railway
```
Railway Dashboard → madurogg → Variables → Add:
TOKEN_MINT=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### 4. Create & Fund Prize Wallet
```bash
node scripts/create-prize-wallet.mjs
# Send initial SOL to the prize wallet address
```

### 5. Test on Devnet First
```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
solana airdrop 2 <PRIZE_WALLET_ADDRESS> --url devnet
node scripts/prize-distribution.mjs --dry-run
```

### 6. Start Production Daemon
```bash
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
pm2 start scripts/prize-distribution.mjs --name "maduro-prizes" -- --daemon
```

---

## Security Notes

1. **Prize wallet is separate from dev wallet** - limits exposure
2. **Only distributes configured %** - never empties wallet
3. **Reserve amount** - always keeps SOL for fees
4. **Token gating** - must hold $MADURO to win (anti-bot)
5. **No private keys on server** - distribution script runs separately

---

## Troubleshooting

### "Prize pool too small"
- Fund the prize wallet with more SOL
- Or lower `MIN_PRIZE_POOL`

### "No eligible winners"
- Check if players have wallets connected
- Check if players hold enough $MADURO tokens
- Verify `TOKEN_MINT` is correct

### "Failed to fetch leaderboard"
- Check game server is running
- Verify `GAME_SERVER_URL` is correct
- Check `/api/leaderboard` endpoint

### "Transaction failed"
- Check prize wallet has enough SOL for fees
- Increase `RESERVE_AMOUNT`
- Check RPC endpoint is responsive

---

## Monitoring

### Check Prize Wallet Balance
```bash
solana balance <PRIZE_WALLET_ADDRESS>
```

### Check Distribution Logs
```bash
pm2 logs maduro-prizes
```

### Check Game Leaderboard
```bash
curl https://maduro.gg/api/leaderboard | jq
```

---

## Architecture Decision: Why SOL Not Tokens?

1. **Simpler flow** - No need to swap SOL → tokens → distribute
2. **More useful** - Winners get liquid SOL immediately
3. **Gas efficiency** - Single transfer vs swap + transfer
4. **Token incentive** - Must HOLD $MADURO to earn = buy pressure

The Anchor contract (`contracts/programs/trumpworm`) is still available for token-based distribution if you prefer that approach later.
