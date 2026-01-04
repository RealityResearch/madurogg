# MADURO.GG - Solana Memecoin Game

## Project Overview

**MADURO.GG** is an Agar.io-style browser multiplayer game where players control cells that consume each other to grow larger. The twist: **you always see yourself as Trump, while all other players appear as Maduro** from your perspective (and vice versa for them). This creates a theatrical "us vs them" dynamic perfect for memecoin virality.

### Core Concept
- **Game**: Multiplayer cell eating game (Agar.io mechanics)
- **Token**: $MADURO launched on pump.fun
- **Domain**: maduro.gg
- **Rewards**: SOL distributed to top players every 10 minutes
- **Viral Hook**: Trump vs Maduro imagery - everyone is the hero of their own story

---

## Current System Architecture

### Game Mode: Continuous Play
- **No rounds** - Game runs continuously, players drop in/out
- **50 player cap** - Player 51+ spectates until spot opens
- **10-minute reward snapshots** - Top players get SOL, game continues
- **Anti-snowball mechanics** - Aggressive mass decay for large cells, bounty for killing top players

### Wallet Architecture
| Wallet | Purpose | Location | Security |
|--------|---------|----------|----------|
| **Dev Wallet** | Receives pump.fun creator fees | Your Phantom | You control |
| **Prize Wallet** | Holds SOL for auto-distribution | Keypair in Railway | Hot wallet (limited funds) |

### Reward Flow
```
pump.fun trades → 0.3% fee → Your Phantom (dev wallet)
                                    ↓
                        You manually transfer 2-3 SOL
                                    ↓
                            Prize Wallet (Railway)
                                    ↓
                    Server auto-distributes every 10 min
                                    ↓
                          Winners receive SOL
```

---

## Deployment Status

### Live URLs
- **Production:** https://maduro.gg
- **Railway Direct:** https://madurogg-production.up.railway.app
- **GitHub:** https://github.com/RealityResearch/madurogg

### Railway Environment Variables (Current)
| Variable | Value | Description |
|----------|-------|-------------|
| `ADMIN_SECRET` | (configured) | Admin API authentication |
| `TOKEN_MINT` | Test token | Update after launch |
| `CREATOR_WALLET` | Test wallet | Update after launch |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Switch to mainnet after launch |
| `PRIZE_WALLET_SECRET` | (configured) | Base64 encoded keypair |

### Prize Wallet (Devnet)
- **Address:** `5DdQNLXojiSZvhViT4zzJyX5KgDeMp6SZWsSPsSkYc6Z`
- **Balance:** 2 SOL (devnet)
- **Network:** Devnet (switch to mainnet after launch)

---

## 🚀 POST-LAUNCH CHECKLIST

### Phase 1: Launch Token on Pump.fun
1. [ ] Go to pump.fun and create $MADURO token
2. [ ] Note down:
   - **Token Mint Address:** `___________________________`
   - **Your Creator Wallet:** `___________________________`
3. [ ] Buy some tokens yourself to seed liquidity

### Phase 2: Update Railway Environment Variables
Go to Railway → Service → Variables → Update:

```env
TOKEN_MINT=<your-new-token-mint-address>
CREATOR_WALLET=<your-phantom-wallet-address>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Phase 3: Create Mainnet Prize Wallet
```bash
# On your local machine
npm run wallet:create
# This creates prize-wallet.json

# Note the public key printed (this is your prize wallet address)
# PRIZE_WALLET_ADDRESS: ___________________________
```

### Phase 4: Generate and Set Prize Wallet Secret
```bash
# Generate base64 encoded secret
cat prize-wallet.json | base64

# Copy the output and add to Railway:
# PRIZE_WALLET_SECRET=<paste-base64-here>
```

### Phase 5: Fund Prize Wallet
```bash
# From your Phantom, send 2-3 SOL to the prize wallet address
# Or use Solana CLI:
solana transfer <PRIZE_WALLET_ADDRESS> 2 --url mainnet-beta
```

### Phase 6: Verify Deployment
After Railway redeploys, check logs for:
```
[Solana] Connected to mainnet
[Solana] Loaded prize wallet from PRIZE_WALLET_SECRET env var
[Solana] Prize wallet: <your-prize-wallet-address>
[Solana] Balance: 2.0000 SOL
[Arena] Solana distributor ready for real SOL rewards
```

### Phase 7: Test Distribution
```bash
# Force a distribution to verify it works
curl -X POST https://maduro.gg/api/admin/distribute \
  -H "Content-Type: application/json" \
  -d '{"adminSecret": "<your-admin-secret>"}'
```

### Phase 8: Verify Frontend
- [ ] https://maduro.gg shows correct token
- [ ] Pump.fun link goes to your token
- [ ] `/api/pump` returns real token stats
- [ ] Game shows "Next Reward" timer

---

## Ongoing Operations

### Refilling Prize Wallet
When prize wallet runs low:
1. Check balance: `solana balance <PRIZE_WALLET_ADDRESS> --url mainnet-beta`
2. From Phantom, send 2-3 SOL to prize wallet
3. Server will auto-distribute from refilled balance

### Monitoring
- **Check status:** `curl https://maduro.gg/api/arena`
- **Check Solana status:** `curl https://maduro.gg/api/admin/stats?adminSecret=<secret>`
- **Force distribution:** `curl -X POST https://maduro.gg/api/admin/distribute -H "Content-Type: application/json" -d '{"adminSecret": "<secret>"}'`

### If Something Goes Wrong
1. **Prize wallet empty:** Just refill from Phantom
2. **Distribution failing:** Check Railway logs for Solana errors
3. **Server down:** Railway auto-restarts, check deployment status

---

## Reward Distribution Details

### Hybrid Tier System
| Players Online | Winners | Distribution |
|----------------|---------|--------------|
| 2-10 | Top 3 | 50% / 30% / 20% |
| 11-25 | Top 5 | 35% / 25% / 18% / 12% / 10% |
| 26-50 | Top 10 | 25% / 18% / 14% / 10% / 8% / 7% / 6% / 5% / 4% / 3% |

### Eligibility Requirements
- Must have wallet connected
- Must hold 1000+ $MADURO tokens (configurable via `MIN_TOKEN_HOLDING`)

### Distribution Settings
| Setting | Default | Env Var |
|---------|---------|---------|
| Max prize per round | 0.1 SOL | `MAX_PRIZE_PER_ROUND` |
| Min token holding | 1000 | `MIN_TOKEN_HOLDING` |
| Distribution interval | 10 minutes | (hardcoded in arena.js) |

---

## Anti-Snowball Mechanics

### Aggressive Mass Decay
| Mass Range | Decay Rate |
|------------|------------|
| 0-499 | 1x (normal) |
| 500-999 | 2x |
| 1000-1999 | 3x |
| 2000+ | 4x |

### Bounty System
| Kill Target | Mass Bonus |
|-------------|------------|
| #1 Player | +50% of their mass |
| #2 Player | +30% of their mass |
| #3 Player | +20% of their mass |

---

## File Structure

```
/
├── CLAUDE.md               # This file
├── package.json
├── prize-wallet.json       # Prize wallet keypair (DO NOT COMMIT)
├── server/
│   ├── index.js           # Express + Socket.IO + API routes
│   ├── arena.js           # Continuous game mode + rewards
│   ├── game.js            # Game state + collisions + bounty
│   ├── player.js          # Player class + mass decay
│   ├── solana.js          # SOL distribution module
│   ├── rewards.js         # Reward tracking
│   └── pump.js            # Pump.fun API integration
├── public/
│   ├── index.html         # Landing page
│   ├── game.html          # Game page
│   ├── css/
│   │   ├── style.css      # Landing styles
│   │   └── game.css       # Game HUD + overlays
│   └── js/
│       ├── game.js        # Client game + UI
│       ├── render.js      # Canvas rendering
│       ├── input.js       # Controls + ESC menu
│       ├── network.js     # Socket.IO client
│       ├── wallet.js      # Phantom integration
│       └── landing.js     # Landing page logic
├── scripts/
│   ├── create-prize-wallet.mjs  # Generate new keypair
│   └── prize-distribution.mjs   # Manual distribution script
└── contracts/
    └── programs/trumpworm/      # Anchor contract (for future token distribution)
```

---

## Admin API Reference

### Force Distribution
```bash
curl -X POST https://maduro.gg/api/admin/distribute \
  -H "Content-Type: application/json" \
  -d '{"adminSecret": "<secret>"}'
```

### Get Stats
```bash
curl "https://maduro.gg/api/admin/stats?adminSecret=<secret>"
```

### Update Config
```bash
curl -X POST https://maduro.gg/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{
    "adminSecret": "<secret>",
    "config": {
      "tokenMint": "<address>",
      "creatorWallet": "<address>",
      "pumpUrl": "https://pump.fun/coin/<address>"
    }
  }'
```

---

## Quick Reference

### Your Credentials (fill in after launch)
```
ADMIN_SECRET: TDAXzQLLmFBK087OmJzPuFttjmIW87L6
TOKEN_MINT: ___________________________
CREATOR_WALLET: ___________________________
PRIZE_WALLET: 5DdQNLXojiSZvhViT4zzJyX5KgDeMp6SZWsSPsSkYc6Z
```

### Important URLs
- **Game:** https://maduro.gg
- **Pump.fun:** https://pump.fun/coin/<TOKEN_MINT>
- **Railway:** https://railway.app (check logs)
- **Prize Wallet on Solscan:** https://solscan.io/account/<PRIZE_WALLET>

---

## Development Notes

1. **Continuous mode** - No rounds, game always running
2. **Server-side authoritative** - Prevents cheating
3. **60 tick rate** - Smooth gameplay
4. **Hot wallet risk** - Only keep 2-3 SOL in prize wallet at a time
5. **Token requirement** - Winners must hold $MADURO to receive SOL
