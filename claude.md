# TRUMPWORM.IO - Solana Memecoin Game

## Project Overview

**TRUMPWORM** is an Agar.io-style browser multiplayer game where players control worm characters that consume each other to grow larger. The unique twist: **you always see yourself as Trump, while all other players appear as Maduro** from your perspective (and vice versa for them). This creates a theatrical "us vs them" dynamic that's perfect for memecoin virality.

### Core Concept
- **Game**: Multiplayer worm/cell eating game (Agar.io mechanics)
- **Token**: $TRUMPWORM launched on pump.fun
- **Rewards**: Creator fees distributed to top players automatically
- **Viral Hook**: Trump vs Maduro imagery creates instant engagement

---

## Product Requirements Document (PRD)

### 1. Game Mechanics (Based on Agar.io Research)

**Core Gameplay:**
- Players control a circular "worm head" that moves toward cursor position
- Eating food pellets and smaller players increases your mass/size
- Larger players move slower but can consume smaller players
- Players can split (Space) to chase/escape, eject mass (W) to feed allies or bait

**Controls:**
- Mouse movement: Guide worm direction
- Spacebar: Split into two smaller worms (offensive/defensive)
- W key: Eject mass

**Visual Perspective:**
- YOUR view: You are Trump head, everyone else is Maduro head
- THEIR view: They are Trump head, you are Maduro head
- Creates "everyone is the hero of their own story" dynamic

**Game Modes (MVP = FFA only):**
- FFA (Free-For-All): Classic every-player-for-themselves

### 2. Technical Architecture

**Stack:**
```
Backend:
- Node.js + Express (web server)
- Socket.IO (real-time WebSocket communication)
- Authoritative game server (all logic server-side)

Frontend:
- HTML5 Canvas (game rendering)
- Vanilla JavaScript (game client)
- Phantom Wallet integration (Solana connection)

Hosting:
- Vercel/Railway for backend
- Static files served via Express
```

**Game Loop (Server-Side Authoritative):**
```javascript
// Server runs at 60 ticks/second
// 1. Receive player inputs
// 2. Update game state (positions, collisions, scores)
// 3. Broadcast state to all clients
// 4. Clients render received state
```

**Client-Server Communication:**
```
Client -> Server: { input: { mouseX, mouseY, split, eject } }
Server -> Client: { players: [...], food: [...], leaderboard: [...] }
```

### 3. Solana Integration

**Wallet Connection:**
- Phantom wallet detection via `window.phantom.solana`
- Connect button in game lobby
- Display connected wallet address (truncated)

**Token Contract (pump.fun launch):**
- Token: $TRUMPWORM
- Supply: Standard pump.fun tokenomics (800M to bonding curve)
- Creator rewards: 0.05% of all trade fees to creator wallet

**Player Rewards Distribution:**
- Top 10 players on leaderboard at end of each hour
- Creator rewards accumulated and distributed proportionally
- Smart contract handles automatic distribution

### 4. Game Flow

```
1. LANDING PAGE
   - Connect Phantom wallet
   - Enter username
   - See live player count
   - "PLAY NOW" button

2. GAME LOBBY
   - Waiting for connection
   - Shows wallet address
   - Leaderboard preview

3. GAMEPLAY
   - Canvas renders game
   - Trump (you) vs Maduro (them)
   - HUD: Score, minimap, leaderboard
   - Death = respawn with minimum size

4. LEADERBOARD
   - Real-time top 10
   - Shows wallet addresses
   - "Hourly rewards" countdown
```

### 5. File Structure

```
/
├── claude.md                 # This file
├── package.json
├── server/
│   ├── index.js             # Express + Socket.IO setup
│   ├── game.js              # Game state management
│   ├── player.js            # Player class
│   ├── food.js              # Food pellet class
│   └── physics.js           # Collision detection
├── public/
│   ├── index.html           # Landing page
│   ├── game.html            # Game page
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js          # Entry point
│   │   ├── game.js          # Client game loop
│   │   ├── render.js        # Canvas rendering
│   │   ├── input.js         # Mouse/keyboard handlers
│   │   ├── network.js       # Socket.IO client
│   │   └── wallet.js        # Phantom integration
│   └── assets/
│       ├── trump.png        # Player (self) sprite
│       ├── maduro.png       # Other players sprite
│       └── food.png         # Food pellet sprites
└── README.md
```

---

## Marketing Strategy

### pump.fun Launch Plan

**Pre-Launch (1-2 days before):**
1. Create Twitter/X account @TrumpWormGame
2. Tease game screenshots with Trump vs Maduro imagery
3. "Something BIG is coming" cryptic posts
4. Build Discord community

**Launch Day:**
1. Deploy token on pump.fun
2. Game website goes live simultaneously
3. Website URL is pump.fun bio link
4. First players get bonus tokens

**Post-Launch:**
1. Hourly rewards distributions create ongoing engagement
2. Leaderboard screenshots shared by players
3. Viral clips of gameplay

### Twitter/X Content Schedule

**Week 1 (Launch Week):**

| Day | Tweet 1 (Morning) | Tweet 2 (Afternoon) | Tweet 3 (Evening) |
|-----|-------------------|---------------------|-------------------|
| Day 1 | "Trump vs Maduro. But make it a game. $TRUMPWORM is LIVE 🐛🇺🇸" + gameplay video | "First hour of rewards distributed! Top players earned X SOL" | Leaderboard screenshot + "Who's eating who?" |
| Day 2 | Player testimonial/clip retweet | "POV: You're Trump eating Maduros. They think they're Trump eating you. 🤯" | Stats: "X players, X SOL distributed" |
| Day 3 | Meme format with Trump/Maduro | Tutorial clip: "How to DOMINATE $TRUMPWORM" | Community highlight |
| Day 4 | "Maduro doesn't know he's Maduro 💀" | Partnership/influencer mention | Rewards distribution announcement |
| Day 5 | Gameplay improvement announcement | User-generated content retweet | Weekend challenge announcement |
| Day 6 | Challenge results | Behind-the-scenes dev update | Teaser for new feature |
| Day 7 | Weekly stats recap | Best clips compilation | Week 2 preview |

**Recurring Content Types:**
1. **Gameplay clips** - 15-30 second viral moments
2. **Leaderboard updates** - Hourly/daily top players
3. **Reward distributions** - Transparency posts showing SOL sent
4. **Memes** - Trump/Maduro political meme formats adapted
5. **Community highlights** - Retweet best player content
6. **Dev updates** - New features, improvements

**Hashtags:**
- #TRUMPWORM
- #SolanaMeme
- #PumpFun
- #CryptoGaming
- #PlayToEarn

---

## Development Phases

### Phase 1: MVP (Current Focus)
- [x] Project setup
- [ ] Basic game server (movement, eating, respawn)
- [ ] Client rendering (Canvas)
- [ ] Trump/Maduro sprites
- [ ] Wallet connection
- [ ] Basic leaderboard

### Phase 2: Polish
- [ ] Sound effects
- [ ] Particle effects on eat
- [ ] Smooth interpolation
- [ ] Mobile touch controls
- [ ] Better death/respawn animation

### Phase 3: Tokenomics Integration
- [ ] Automated reward distribution
- [ ] On-chain leaderboard snapshots
- [ ] Token gating (hold X tokens for skins)

### Phase 4: Growth
- [ ] Teams mode
- [ ] Custom skins (NFT integration)
- [ ] Tournament system
- [ ] Referral rewards

---

## Key Research Sources

**Agar.io Mechanics:**
- [Wikipedia - Agar.io](https://en.wikipedia.org/wiki/Agar.io)
- [GitHub - Agar.io Clone](https://github.com/Kuzma02/agar.io-with-bots)

**Multiplayer Architecture:**
- [Victor Zhou - Build an .io Game](https://victorzhou.com/blog/build-an-io-game-part-2/)
- [Sean Goedecke - Socket.io Game](https://www.seangoedecke.com/socket-io-game/)
- [ModernWeb - Node.js Multiplayer](https://modernweb.com/building-multiplayer-games-node-js-socket-io/)

**pump.fun:**
- [Netcoins - pump.fun Guide](https://www.netcoins.com/blog/pump-fun-the-memecoin-launchpad-revolutionizing-solana)
- [OKX - What is pump.fun](https://www.okx.com/en-us/learn/what-is-pumpfun-complete-guide-to-the-viral-memecoin-launchpad-on-solana)

**Solana Wallet:**
- [Phantom Docs](https://docs.phantom.com/solana/integrating-phantom)
- [Figment - Pay-to-Play Gaming](https://learn.figment.io/tutorials/pay-to-play-gaming-on-solana)

---

## Notes for Claude

When working on this project:
1. **Server-side authoritative** - All game logic runs on server to prevent cheating
2. **60 tick rate** - Server updates at 60Hz for smooth gameplay
3. **Client prediction** - Client can predict movement for smooth feel, server corrects
4. **Sprite swap** - The Trump/Maduro swap is purely client-side based on player ID
5. **Keep it simple** - MVP first, polish later
