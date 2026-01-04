# MADURO.GG - Solana Memecoin Game

## Project Overview

**MADURO.GG** is an Agar.io-style browser multiplayer game where players control cells that consume each other to grow larger. The twist: **you always see yourself as Trump, while all other players appear as Maduro** from your perspective (and vice versa for them). This creates a theatrical "us vs them" dynamic perfect for memecoin virality.

### Core Concept
- **Game**: Multiplayer cell eating game (Agar.io mechanics)
- **Token**: $MADURO launched on pump.fun
- **Domain**: maduro.gg
- **Rewards**: Creator fees (0.3%) distributed to top players hourly via on-chain escrow
- **Viral Hook**: Trump vs Maduro imagery - everyone is the hero of their own story

---

## Current Deployment Status

### Live URLs
- **Production:** https://maduro.gg
- **Railway Direct:** https://madurogg-production.up.railway.app

### GitHub
- **Repo:** https://github.com/RealityResearch/madurogg
- **Branch:** main

### What's Working
- Custom domain (maduro.gg) via Cloudflare → Railway
- Pump.fun API integration for live creator fee tracking
- Landing page with Trump/Maduro imagery + live pump stats
- Multiplayer gameplay (eat, split, eject)
- Battle royale mode with 10-min rounds
- Leaderboard with room-based scoring
- Mobile controls (joystick + buttons)

### Next Steps
1. Deploy Anchor escrow contract to mainnet
2. Launch token on pump.fun
3. Update config with real token address

---

## Launch Checklist

When you launch the real $MADURO token on pump.fun, update these:

### 1. Railway Environment Variables
Go to Railway → Service → Variables → Update:

```env
TOKEN_MINT=<new-pump-fun-token-address>
CREATOR_WALLET=<your-creator-wallet>
ADMIN_SECRET=<strong-secret-for-admin-api>
```

### 2. Admin API (Live Config Update)
Update config without redeploying:

```bash
curl -X POST https://maduro.gg/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{
    "adminSecret": "<your-admin-secret>",
    "config": {
      "tokenMint": "<new-token-address>",
      "creatorWallet": "<your-wallet>",
      "pumpUrl": "https://pump.fun/coin/<new-token-address>",
      "twitter": "https://twitter.com/madurogg",
      "telegram": "https://t.me/madurogg"
    }
  }'
```

### 3. Hardcoded Links to Update
Search and replace the test token address in:
- `public/index.html` - pump.fun link in hero
- `public/how.html` - pump.fun link in Links section

Or just use the admin API above and they'll auto-update via `/api/config`.

### 4. After Launch Verify
- [ ] `/api/pump` returns real token stats
- [ ] `/api/token` returns real price data
- [ ] Landing page shows live fees
- [ ] Leaderboard shows pump stats
- [ ] How It Works page shows correct token address

### 5. Optional: Redeploy
If you updated Railway env vars, redeploy to pick them up:
```bash
git commit --allow-empty -m "trigger redeploy" && git push
```

---

## Smart Contract (Anchor)

### Purpose
Trustless escrow for reward distribution. Players don't have to trust that rewards will be sent manually - the contract handles it transparently on-chain.

### Contract Location
`contracts/programs/trumpworm/src/lib.rs`

### Program ID (Devnet)
`Hqp3bwuxLTJGjsacPzo7Q2bpW9snYyDzxQXq1gY1e9EK`

### Key Functions
- `initialize` - Create game treasury PDA
- `register_player` - On-chain player registration
- `update_stats` - Server updates player scores
- `distribute_rewards` - Send tokens to top 10 wallets
- `withdraw` - Admin withdrawal from treasury

### How It Works
1. Treasury PDA holds prize pool tokens (not personal wallet)
2. Server calls `distribute_rewards` hourly with top 10 addresses
3. Contract transfers tokens directly to winners
4. All distributions visible on Solscan

---

## Current Token Configuration

**Test Token (replace after real launch):**
- Contract: `CmgJ1PobhUqB7MEa8qDkiG2TUpMTskWj8d9JeZWSpump`
- Creator: `APiYhkSwfR3nEZWSixtHmMbdL1JxK3R6APHSysemNf7y`
- Supply: 1,000,000,000 (1 billion - pump.fun standard)

**pump.fun Fee Structure:**
- Bonding Curve: 0.3% creator fee on all trades
- Post-graduation: Varies by market cap (see pump.fun docs)

---

## Pump.fun API Integration

Uses pump.fun's native API for creator fee tracking. Located in `server/pump.js`.

**Base URL:** `https://swap-api.pump.fun`

**Endpoints Used:**
```
GET /v1/creators/{creator}/fees?interval=30m&limit=336
GET /v1/creators/{creator}/fees/total
GET /v1/coins/{mint}
```

**Our Endpoint:** `GET /api/pump`

**Response includes:**
- `balanceSOL` - Total creator fees earned
- `fees24hSOL` - Fees in last 24 hours
- `trades24h` - Trade count in last 24 hours
- `holders` - Number of token holders
- `solPriceUSD` - Current SOL price (via Jupiter/CoinGecko)
- `sparklineSOL` - Time series for charts

---

## Moralis API Integration (Backup)

Uses Moralis Solana API for token price data as backup.

**Endpoint:** `GET /api/token`

**Docs:** https://docs.moralis.com/web3-data-api/solana/reference/get-sol-token-price

---

## Game Mechanics (Official Agar.io Rules Implemented)

### Mass System
- **Score = Peak Mass** achieved during life
- **Food pellets**: +1 mass each
- **Eating players**: Gain 100% of their mass
- **Max mass**: 22,500
- **Mass decay**: Larger cells lose mass faster (proportional)

### Eating Rules
- Must be **25% larger (1.25x mass)** to consume another player
- Smaller cell must be mostly inside larger cell

### Controls

**Desktop:**
- WASD / Arrow Keys: Move
- Spacebar: Split
- E: Eject mass

**Mobile:**
- Virtual joystick (left side of screen)
- SPLIT button
- EJECT button

### Split Mechanics
- Requires **35+ mass** to split
- Maximum **16 cells** per player
- Merge delay scales with mass

### Eject Mechanics
- Requires **32+ mass** to eject
- Costs **16 mass**, ejected pellet is **14 mass** (87.5% efficiency)
- Use to feed viruses or bait enemies

### Virus System
- Green spikey circles scattered on map
- Mass **<130**: Can hide inside (no effect)
- Mass **>150**: Explode into pieces when touching
- Feed virus **7 times** with ejected mass to spawn new virus

---

## Reward Distribution

### How It Works
1. **Connect wallet** to be eligible for rewards
2. Play and climb the leaderboard
3. Every hour, top 10 players receive share of reward pool
4. Rewards come from creator fees on $MADURO trades

### Distribution Percentages
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

**Note:** No wallet connected = playing for fun only, no rewards.

---

## Technical Architecture

**Stack:**
```
Backend: Node.js + Express + Socket.IO
Frontend: HTML5 Canvas + Vanilla JS
Wallet: Phantom integration
Hosting: Vercel/Railway
```

**Server:** 60 tick rate, authoritative (all logic server-side)

---

## Admin API

**Environment Variables:**
```
ADMIN_SECRET=your-secret-key
TOKEN_MINT=pump-fun-token-address
CREATOR_WALLET=your-wallet-address
```

**Endpoints:**
- `POST /api/admin/pool/add` - Add to reward pool
- `GET /api/admin/stats` - Detailed stats
- `POST /api/admin/distribute` - Force distribution
- `POST /api/admin/configure` - Update config

---

## File Structure

```
/
├── claude.md               # This file
├── package.json
├── server/
│   ├── index.js           # Express + Socket.IO
│   ├── game.js            # Game state + collisions
│   ├── player.js          # Player class + mechanics
│   └── rewards.js         # Reward distribution
├── public/
│   ├── index.html         # Landing page
│   ├── game.html          # Game page
│   ├── css/
│   │   ├── style.css      # Landing styles
│   │   └── game.css       # Game HUD styles
│   └── js/
│       ├── game.js        # Client game loop
│       ├── render.js      # Canvas rendering
│       ├── input.js       # Controls
│       ├── network.js     # Socket.IO client
│       ├── wallet.js      # Phantom integration
│       └── landing.js     # Landing page logic
```

---

## Development Notes

1. **Server-side authoritative** - Prevents cheating
2. **60 tick rate** - Smooth gameplay
3. **Trump/Maduro swap** - Client-side only based on player ID
4. **Wallet required for rewards** - Otherwise just playing for fun
5. **Test with provided token** - Replace contract after real launch
