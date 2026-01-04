const Player = require('./player');
const CONSTANTS = Player.CONSTANTS;

// Virus constants
const VIRUS = {
  MASS: 100,                    // Mass of a virus
  MIN_MASS_TO_EXPLODE: 150,     // Player must be this mass to get popped by virus
  MAX_MASS_TO_HIDE: 130,        // Player can hide inside if smaller than this
  FEEDS_TO_SPAWN: 7,            // Ejected mass needed to spawn new virus
  MAX_VIRUSES: 50,              // Maximum viruses in the world
  SPAWN_DISTANCE: 100           // Distance new virus launches when spawned
};

class Game {
  constructor() {
    this.worldSize = 4000;      // Larger world
    this.players = new Map();
    this.food = [];
    this.viruses = [];
    this.maxFood = 1000;        // More food pellets
    this.foodMass = 1;          // Each food pellet gives 1 mass (official)

    // Kill events queue (for broadcasting)
    this.killEvents = [];

    // Initialize food and viruses
    this.spawnInitialFood();
    this.spawnInitialViruses();
  }

  spawnInitialFood() {
    for (let i = 0; i < this.maxFood; i++) {
      this.spawnFood();
    }
  }

  spawnInitialViruses() {
    // Spawn initial viruses scattered across the map
    for (let i = 0; i < 20; i++) {
      this.spawnVirus(
        100 + Math.random() * (this.worldSize - 200),
        100 + Math.random() * (this.worldSize - 200)
      );
    }
  }

  spawnFood() {
    if (this.food.length >= this.maxFood) return;

    const mass = this.foodMass;
    this.food.push({
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * this.worldSize,
      y: Math.random() * this.worldSize,
      mass: mass,
      size: Math.sqrt(mass * 100) * 0.8,  // Visual size slightly smaller
      color: this.getRandomColor()
    });
  }

  spawnVirus(x, y) {
    if (this.viruses.length >= VIRUS.MAX_VIRUSES) return null;

    const virus = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      mass: VIRUS.MASS,
      size: Math.sqrt(VIRUS.MASS * 100),
      feedCount: 0  // Track ejected mass fed to this virus
    };
    this.viruses.push(virus);
    return virus;
  }

  getRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  addPlayer(id, username, wallet) {
    const player = new Player(id, username, wallet, this.worldSize);
    this.players.set(id, player);
    return player.getPublicData();
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  // Direction-based input
  handleInput(id, input) {
    const player = this.players.get(id);
    if (player) {
      player.setDirection(input.dirX, input.dirY);
    }
  }

  splitPlayer(id) {
    const player = this.players.get(id);
    if (player) {
      player.split();
    }
  }

  ejectMass(id) {
    const player = this.players.get(id);
    if (player) {
      const ejectedMass = player.ejectMass();
      if (ejectedMass) {
        this.food.push(ejectedMass);
      }
    }
  }

  update() {
    // Clear kill events from last tick
    this.killEvents = [];

    // Update all players
    for (const player of this.players.values()) {
      player.update(this.worldSize);
    }

    // Update ejected food velocity and check virus collisions
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      if (f.velocityX || f.velocityY) {
        f.x += f.velocityX;
        f.y += f.velocityY;
        f.velocityX *= 0.92;
        f.velocityY *= 0.92;

        // Check if ejected mass hits a virus
        if (f.isEjected && this.checkEjectedMassVirusCollision(f)) {
          this.food.splice(i, 1);
          continue;
        }

        // Stop if slow enough
        if (Math.abs(f.velocityX) < 0.1) f.velocityX = 0;
        if (Math.abs(f.velocityY) < 0.1) f.velocityY = 0;

        // Keep in bounds
        f.x = Math.max(f.size, Math.min(this.worldSize - f.size, f.x));
        f.y = Math.max(f.size, Math.min(this.worldSize - f.size, f.y));
      }
    }

    // Check food collisions (and virus collisions)
    this.checkFoodCollisions();

    // Check player collisions
    this.checkPlayerCollisions();

    // Respawn food
    while (this.food.length < this.maxFood) {
      this.spawnFood();
    }
  }

  checkFoodCollisions() {
    for (const player of this.players.values()) {
      for (const cell of player.cells) {
        // Check food pellets
        for (let i = this.food.length - 1; i >= 0; i--) {
          const food = this.food[i];
          const dist = Math.hypot(cell.x - food.x, cell.y - food.y);

          // Can eat if food is inside our cell radius
          if (dist < cell.size - food.size * 0.5) {
            // Eat food - gain its mass (1 per pellet)
            player.addMass(food.mass || 1, true);
            this.food.splice(i, 1);
          }
        }

        // Check virus collisions
        for (let i = this.viruses.length - 1; i >= 0; i--) {
          const virus = this.viruses[i];
          const dist = Math.hypot(cell.x - virus.x, cell.y - virus.y);

          // Small cells can hide inside viruses
          if (cell.mass <= VIRUS.MAX_MASS_TO_HIDE) {
            continue; // No interaction with virus
          }

          // Large cells explode when touching virus
          if (cell.mass >= VIRUS.MIN_MASS_TO_EXPLODE && dist < cell.size) {
            // Explode the cell into many pieces
            this.explodeCell(player, cell);
            // Remove the virus
            this.viruses.splice(i, 1);
            // Spawn a new virus elsewhere after a delay
            setTimeout(() => {
              this.spawnVirus(
                100 + Math.random() * (this.worldSize - 200),
                100 + Math.random() * (this.worldSize - 200)
              );
            }, 5000);
            break;
          }
        }
      }
    }
  }

  // Explode a cell into many smaller pieces (virus pop)
  explodeCell(player, cell) {
    const cellIndex = player.cells.indexOf(cell);
    if (cellIndex === -1) return;

    // Calculate how many pieces (up to MAX_CELLS total)
    const availableSlots = CONSTANTS.MAX_CELLS - player.cells.length + 1;
    const numPieces = Math.min(availableSlots, Math.floor(cell.mass / 20) + 1, 8);

    if (numPieces <= 1) return;

    // Remove original cell
    player.cells.splice(cellIndex, 1);

    // Distribute mass among pieces
    const massPerPiece = cell.mass / numPieces;

    for (let i = 0; i < numPieces; i++) {
      const angle = (Math.PI * 2 * i) / numPieces + Math.random() * 0.5;
      const speed = 8 + Math.random() * 4;

      player.cells.push({
        x: cell.x + Math.cos(angle) * 20,
        y: cell.y + Math.sin(angle) * 20,
        mass: massPerPiece,
        size: player.massToSize(massPerPiece),
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        splitTime: Date.now()
      });
    }
  }

  // Check if ejected mass hits a virus
  checkEjectedMassVirusCollision(ejectedFood) {
    for (const virus of this.viruses) {
      const dist = Math.hypot(ejectedFood.x - virus.x, ejectedFood.y - virus.y);
      if (dist < virus.size) {
        virus.feedCount++;

        // If fed enough times, spawn a new virus
        if (virus.feedCount >= VIRUS.FEEDS_TO_SPAWN) {
          virus.feedCount = 0;

          // Calculate launch direction (opposite of where food came from)
          const angle = Math.atan2(ejectedFood.y - virus.y, ejectedFood.x - virus.x);
          const newX = virus.x + Math.cos(angle) * VIRUS.SPAWN_DISTANCE;
          const newY = virus.y + Math.sin(angle) * VIRUS.SPAWN_DISTANCE;

          // Keep in bounds
          const clampedX = Math.max(50, Math.min(this.worldSize - 50, newX));
          const clampedY = Math.max(50, Math.min(this.worldSize - 50, newY));

          this.spawnVirus(clampedX, clampedY);
        }
        return true; // Food was consumed by virus
      }
    }
    return false;
  }

  checkPlayerCollisions() {
    const players = Array.from(this.players.values());

    for (let i = 0; i < players.length; i++) {
      for (let j = 0; j < players.length; j++) {
        if (i === j) continue;

        const p1 = players[i];
        const p2 = players[j];

        for (const cell1 of p1.cells) {
          for (let k = p2.cells.length - 1; k >= 0; k--) {
            const cell2 = p2.cells[k];
            const dist = Math.hypot(cell1.x - cell2.x, cell1.y - cell2.y);

            // OFFICIAL RULE: Must be 25% larger (1.25x mass) to eat
            // Also, the smaller cell must be mostly inside the larger one
            if (cell1.mass > cell2.mass * CONSTANTS.EAT_RATIO && dist < cell1.size - cell2.size * 0.4) {
              // Eat the smaller cell - gain ALL its mass
              p1.addMass(cell2.mass, false);

              // Track kill position for particles
              const killX = cell2.x;
              const killY = cell2.y;
              const killColor = p2.color;

              p2.cells.splice(k, 1);
              p1.kills++;

              // Respawn if no cells left (full kill)
              if (p2.cells.length === 0) {
                // Queue kill event for broadcasting
                this.killEvents.push({
                  killerId: p1.id,
                  victimId: p2.id,
                  killer: p1.username,
                  victim: p2.username,
                  x: killX,
                  y: killY,
                  color: killColor,
                  victimMass: cell2.mass
                });

                p2.respawn(this.worldSize);
              }
            }
          }
        }
      }
    }
  }

  // Get kill events and clear the queue
  getKillEvents() {
    const events = this.killEvents;
    this.killEvents = [];
    return events;
  }

  getState() {
    const players = [];
    for (const player of this.players.values()) {
      players.push(player.getPublicData());
    }

    return {
      players,
      food: this.food,
      viruses: this.viruses
    };
  }

  getLeaderboard() {
    const sorted = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        username: p.username,
        wallet: p.wallet,
        score: p.getScore(),     // Peak mass (leaderboard ranking)
        mass: p.getMass(),       // Current mass
        kills: p.kills,
        stats: {
          foodEaten: p.foodEaten,
          playersEaten: p.playersEaten
        }
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return sorted;
  }
}

// Export VIRUS constants for client
Game.VIRUS = VIRUS;

module.exports = Game;
