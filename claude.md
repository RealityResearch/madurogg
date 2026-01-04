# MADURO.GG - Solana Memecoin Game

## Project Overview

**MADURO.GG** is an Agar.io-style browser multiplayer game where players control cells that consume each other to grow larger. The twist: **you always see yourself as Trump, while all other players appear as Maduro** from your perspective (and vice versa for them). This creates a theatrical "us vs them" dynamic perfect for memecoin virality.

### Core Concept
- **Game**: Multiplayer cell eating game (Agar.io mechanics)
- **Token**: $MADURO launched on pump.fun
- **Domain**: maduro.gg
- **Rewards**: Creator fees (0.3%) distributed to top players hourly
- **Viral Hook**: Trump vs Maduro imagery - everyone is the hero of their own story

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

## Moralis API Integration

Uses Moralis Solana API for real-time token price data.

**API Key:** Configured in `MORALIS_CONFIG` in `server/index.js`

**Endpoint Used:**
```
GET https://solana-gateway.moralis.io/token/mainnet/{tokenAddress}/price
Headers: X-API-Key: {apiKey}
```

**Response includes:**
- `usdPrice` - Token price in USD
- `nativePrice` - Token price in SOL
- `exchangeName` - DEX where price was fetched (Raydium, Pump.fun, etc.)

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
