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
- **Solscan (Devnet):** https://solscan.io/account/DLLQxjjnjiyRQHFt7Q63G7TLvVu9WAf4aCyd2q1qPAbF?cluster=devnet

### GitHub
- **Repo:** https://github.com/RealityResearch/madurogg
- **Branch:** main

### Smart Contract
- **Program ID:** `DLLQxjjnjiyRQHFt7Q63G7TLvVu9WAf4aCyd2q1qPAbF`
- **Status:** Deployed to Devnet, all 9 tests passing
- **Upgrade Authority:** `CZnN9UTJGN4g6GjnQD3RG7cE3hNdMQidXMbE8ZzJs9pm`

### Infrastructure
- **Hosting:** Railway (port 8080)
- **DNS:** Cloudflare (CNAME flattening)
- **Domain Registrar:** GoDaddy → Cloudflare NS
- **Railway CNAME:** 5c6b7hf6.up.railway.app

### Environment Variables (Railway)
- `TOKEN_MINT` - Pump.fun token address
- `CREATOR_WALLET` - Creator wallet for fee tracking
- `ADMIN_SECRET` - Secret for admin API endpoints (configured)

### What's Working
- [x] maduro.gg live with SSL
- [x] Railway deployment with WebSocket support
- [x] Pump.fun API integration for live creator fee tracking
- [x] Landing page with pump stats (fees, trades, holders)
- [x] Leaderboard page with pump stats
- [x] Multiplayer gameplay (eat, split, eject)
- [x] Battle royale mode with 10-min rounds
- [x] Mobile controls (joystick + buttons)
- [x] Admin API with secret authentication
- [x] Anchor contract deployed to devnet
- [x] All 9 contract tests passing (initialize, deposit, distribute, withdraw, transfer authority)

### Remaining TODOs
- [ ] Launch real $MADURO token on pump.fun
- [ ] Initialize prize pool on devnet with test token
- [ ] Test full reward distribution flow on devnet
- [ ] Deploy contract to mainnet
- [ ] Initialize mainnet prize pool
- [ ] Update Railway env vars with real token
- [ ] Verify pump stats show real token data

---

## Anchor Contract (Deployed to Devnet)

### Contract Location
`contracts/programs/trumpworm/src/lib.rs`

### Program ID
`DLLQxjjnjiyRQHFt7Q63G7TLvVu9WAf4aCyd2q1qPAbF` (same for devnet & mainnet)

### Test Results (All Passing)
| Test | Status |
|------|--------|
| Initialize prize pool | ✅ |
| Deposit tokens | ✅ |
| Reject zero deposit | ✅ |
| Distribute rewards to players | ✅ |
| Reject unauthorized distribution | ✅ |
| Reject >10 recipients | ✅ |
| Withdraw (authority only) | ✅ |
| Reject unauthorized withdraw | ✅ |
| Transfer authority | ✅ |

### Key Functions
- `initialize` - Create prize pool PDA and treasury
- `deposit` - Anyone can deposit tokens to prize pool
- `distribute_rewards` - Authority distributes to top 10 wallets
- `withdraw` - Emergency withdrawal (authority only)
- `transfer_authority` - Transfer admin rights

### Run Tests Locally
```bash
cd contracts
anchor test  # Uses local validator
```

### Deploy to Mainnet
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet
```

### Mainnet Deployment Checklist
- [x] All devnet tests pass
- [x] Contract deployed to devnet
- [ ] Initialize prize pool with real token
- [ ] Test deposit/distribute on devnet
- [ ] Deploy to mainnet
- [ ] Initialize mainnet prize pool

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

## Smart Contract Flow

### How Rewards Work
1. **Treasury PDA** holds prize pool tokens (not personal wallet)
2. **Deposit**: Anyone can deposit tokens (from creator fees)
3. **Server** calls `distribute_rewards` with top 10 wallet addresses
4. **Contract** transfers tokens directly to winners
5. **All distributions** visible on Solscan

### PDAs (Program Derived Addresses)
```
prize_pool = [b"prize_pool", token_mint]
treasury   = [b"treasury", token_mint]
```

### Security
- Only authority can distribute/withdraw
- Max 10 recipients per distribution
- Zero amount deposits rejected
- Authority transfer supported

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
