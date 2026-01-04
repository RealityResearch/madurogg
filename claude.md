# MADURO.GG - Solana Memecoin Game

## Project Overview

**MADURO.GG** is an Agar.io-style browser multiplayer game where players control cells that consume each other to grow larger. The twist: **you always see yourself as Trump, while all other players appear as Maduro** from your perspective (and vice versa for them).

### Core Features
- **Continuous Play**: No rounds, game runs 24/7
- **50 Player Arena**: Battle royale style, spectate if full
- **10-Minute SOL Rewards**: Top players get SOL every 10 minutes
- **Transparency Dashboard**: All distributions verifiable on Solscan
- **Anti-Snowball**: Aggressive mass decay, bounty for killing leaders

---

## 🚀 MAINNET LAUNCH CHECKLIST

### Pre-Launch Status
- [x] Game server running on Railway
- [x] Devnet SOL distribution tested and working
- [x] Transparency dashboard live at /stats.html
- [x] Toast notifications for distributions
- [x] Distribution history with Solscan TX links
- [ ] **Mainnet deployment (below)**

---

### Step 1: Create Token on Pump.fun
1. Go to https://pump.fun and create $MADURO token
2. Record these values:
   ```
   TOKEN_MINT: ___________________________
   YOUR_PHANTOM_WALLET: ___________________________
   ```
3. Buy some tokens to seed liquidity

---

### Step 2: Create Mainnet Prize Wallet
```bash
# Delete old devnet wallet (IMPORTANT!)
rm prize-wallet.json

# Create fresh mainnet wallet
npm run wallet:create

# Note the PUBLIC KEY printed - this is your mainnet prize wallet
# MAINNET_PRIZE_WALLET: ___________________________
```

---

### Step 3: Update Railway Environment Variables

Go to **Railway → madurogg → Variables** and update:

| Variable | Value |
|----------|-------|
| `TOKEN_MINT` | Your pump.fun token mint address |
| `CREATOR_WALLET` | Your Phantom wallet address |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` |
| `PRIZE_WALLET_SECRET` | (generate below) |

Generate the prize wallet secret:
```bash
cat prize-wallet.json | base64
# Paste this entire output as PRIZE_WALLET_SECRET
```

---

### Step 4: Fund Prize Wallet
From your Phantom, send **2-3 SOL** to the new mainnet prize wallet address.

```bash
# Or via CLI:
solana transfer <MAINNET_PRIZE_WALLET> 2 --url mainnet-beta
```

---

### Step 5: Deploy & Verify

After Railway redeploys, check the logs for:
```
[Solana] Connected to mainnet-beta
[Solana] Prize wallet: <your-mainnet-prize-wallet>
[Solana] Balance: 2.0000 SOL
[Arena] Solana distributor ready for real SOL rewards
```

Verify APIs:
```bash
# Check network is mainnet
curl -s https://maduro.gg/api/transparency | jq '.network'
# Should return: "mainnet-beta"

# Check prize wallet
curl -s https://maduro.gg/api/transparency | jq '.prizeWallet'
# Should return your mainnet prize wallet
```

---

### Step 6: Test Distribution (Optional)
```bash
curl -X POST https://maduro.gg/api/admin/distribute \
  -H "Content-Type: application/json" \
  -d '{"adminSecret": "TDAXzQLLmFBK087OmJzPuFttjmIW87L6"}'
```

---

### Step 7: Final Verification
- [ ] https://maduro.gg loads correctly
- [ ] /stats.html shows mainnet prize wallet
- [ ] Network badge shows "mainnet-beta" (green)
- [ ] Connect Phantom (mainnet) and join game
- [ ] Timer counts down to next distribution
- [ ] After distribution, check Solscan for TX

---

## Live URLs

| URL | Description |
|-----|-------------|
| https://maduro.gg | Main game |
| https://maduro.gg/stats.html | Transparency Dashboard |
| https://maduro.gg/how.html | How It Works |
| https://maduro.gg/api/transparency | Public stats API |
| https://maduro.gg/api/arena | Arena status |
| https://maduro.gg/api/leaderboard | Current leaderboard |
| https://maduro.gg/api/distributions | Distribution history |

---

## Admin Commands

### Force Distribution
```bash
curl -X POST https://maduro.gg/api/admin/distribute \
  -H "Content-Type: application/json" \
  -d '{"adminSecret": "TDAXzQLLmFBK087OmJzPuFttjmIW87L6"}'
```

### Check Stats
```bash
curl "https://maduro.gg/api/admin/stats?adminSecret=TDAXzQLLmFBK087OmJzPuFttjmIW87L6"
```

### Update Site Config
```bash
curl -X POST https://maduro.gg/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{
    "adminSecret": "TDAXzQLLmFBK087OmJzPuFttjmIW87L6",
    "config": {
      "tokenMint": "<TOKEN_MINT>",
      "creatorWallet": "<YOUR_WALLET>",
      "pumpUrl": "https://pump.fun/coin/<TOKEN_MINT>"
    }
  }'
```

---

## Ongoing Operations

### Refilling Prize Wallet
When balance runs low:
1. Check: `curl -s https://maduro.gg/api/transparency | jq '.stats'`
2. Send 2-3 SOL from Phantom to prize wallet
3. Server auto-distributes from new balance

### Monitoring
- **Transparency Dashboard**: https://maduro.gg/stats.html
- **Railway Logs**: Check for distribution errors
- **Solscan**: Verify TX history on prize wallet

### If Something Breaks
| Issue | Solution |
|-------|----------|
| Prize wallet empty | Send more SOL from Phantom |
| Distribution failing | Check Railway logs for Solana errors |
| Server down | Railway auto-restarts; check deploy status |
| Wrong network | Verify SOLANA_RPC_URL in Railway |

---

## Reward Distribution

### Tier System
| Players | Winners | Distribution |
|---------|---------|--------------|
| 2-10 | Top 3 | 50% / 30% / 20% |
| 11-25 | Top 5 | 35% / 25% / 18% / 12% / 10% |
| 26-50 | Top 10 | 25% / 18% / 14% / 10% / 8% / 7% / 6% / 5% / 4% / 3% |

### Settings
| Setting | Default | Env Var |
|---------|---------|---------|
| Max prize/round | 0.1 SOL | `MAX_PRIZE_PER_ROUND` |
| Min token holding | 1000 | `MIN_TOKEN_HOLDING` |
| Min players | 2 | `MIN_PLAYERS_FOR_REWARDS` |
| Interval | 10 min | Hardcoded |

### Eligibility
- Wallet must be connected
- Must hold 1000+ $MADURO tokens (when TOKEN_MINT is set)
- If TOKEN_MINT is empty, everyone with wallet is eligible (test mode)

---

## File Structure

```
/
├── CLAUDE.md                    # This file
├── package.json
├── prize-wallet.json            # Keypair (DO NOT COMMIT)
├── server/
│   ├── index.js                 # Express + Socket.IO + APIs
│   ├── arena.js                 # Continuous mode + rewards
│   ├── game.js                  # Game state + collisions
│   ├── player.js                # Player class + decay
│   ├── solana.js                # SOL distribution
│   ├── rewards.js               # Reward tracking
│   └── pump.js                  # Pump.fun API
├── public/
│   ├── index.html               # Landing page
│   ├── game.html                # Game page
│   ├── stats.html               # Transparency Dashboard
│   ├── how.html                 # How It Works
│   ├── css/
│   │   ├── style.css            # Landing styles
│   │   └── game.css             # Game HUD + toast + distributions
│   └── js/
│       ├── game.js              # Client game + distribution UI
│       ├── render.js            # Canvas rendering
│       ├── input.js             # Controls
│       ├── network.js           # Socket.IO client
│       ├── wallet.js            # Phantom integration
│       └── landing.js           # Landing page
└── scripts/
    ├── create-prize-wallet.mjs  # Generate keypair
    └── prize-distribution.mjs   # Manual distribution
```

---

## Quick Reference

### Credentials
```
ADMIN_SECRET: TDAXzQLLmFBK087OmJzPuFttjmIW87L6
```

### After Launch - Fill In:
```
TOKEN_MINT: ___________________________
CREATOR_WALLET: ___________________________
PRIZE_WALLET (mainnet): ___________________________
```

### Key URLs
- **Game**: https://maduro.gg
- **Transparency**: https://maduro.gg/stats.html
- **GitHub**: https://github.com/RealityResearch/madurogg
- **Railway**: https://railway.app

---

## Technical Notes

1. **Distribution Method**: Direct SOL transfer via SystemProgram (not Anchor contract)
2. **Server Authoritative**: All game logic server-side to prevent cheating
3. **60 Hz Tick Rate**: Smooth gameplay with interpolation
4. **Hot Wallet Risk**: Only keep 2-3 SOL in prize wallet at a time
5. **Network Detection**: Client auto-detects devnet/mainnet from /api/transparency
