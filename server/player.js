// Official Agar.io Constants
const CONSTANTS = {
  START_MASS: 10,           // Starting mass
  MIN_MASS: 10,             // Minimum mass
  MAX_MASS: 22500,          // Maximum mass cap
  MIN_SPLIT_MASS: 35,       // Minimum mass to split (needs 2 cells of 17.5)
  MIN_EJECT_MASS: 32,       // Minimum mass to eject
  EJECT_MASS_LOSS: 16,      // Mass lost when ejecting
  EJECT_MASS_GAIN: 14,      // Mass of ejected pellet (90% efficiency)
  MAX_CELLS: 16,            // Maximum cells per player
  EAT_RATIO: 1.25,          // Must be 25% larger to eat
  MERGE_TIME: 30,           // Seconds before cells can merge (scales with mass)
  BASE_SPEED: 2.2,          // Base movement speed
  SPEED_FACTOR: 0.004,      // Speed reduction per mass unit
  MIN_SPEED: 0.5,           // Minimum movement speed
  // Decay: ~0.002% per second, scaled by size
  DECAY_RATE: 0.00002       // Mass decay rate per tick
};

class Player {
  constructor(id, username, wallet, worldSize) {
    this.id = id;
    this.username = username || 'Anonymous';
    this.wallet = wallet || null;
    this.cells = [];
    this.dirX = 0;
    this.dirY = 0;
    this.kills = 0;
    this.color = this.getRandomColor();

    // Stats tracking
    this.totalMassEaten = 0;    // Total mass consumed this life
    this.foodEaten = 0;          // Food pellets eaten
    this.playersEaten = 0;       // Player cells eaten
    this.peakMass = 0;           // Highest mass achieved this life

    // Trail positions for visual effect
    this.trail = [];
    this.maxTrailLength = 10;

    // Spawn initial cell
    this.spawn(worldSize);
  }

  spawn(worldSize) {
    const startMass = CONSTANTS.START_MASS;
    this.cells.push({
      x: Math.random() * (worldSize - 200) + 100,
      y: Math.random() * (worldSize - 200) + 100,
      mass: startMass,
      size: this.massToSize(startMass),
      velocityX: 0,
      velocityY: 0
    });
    this.peakMass = startMass;
  }

  respawn(worldSize) {
    this.cells = [];
    this.trail = [];
    this.totalMassEaten = 0;
    this.foodEaten = 0;
    this.playersEaten = 0;
    this.peakMass = 0;
    this.spawn(worldSize);
  }

  // Convert mass to visual size (radius)
  massToSize(mass) {
    return Math.sqrt(mass * 100);
  }

  // Convert size to mass
  sizeToMass(size) {
    return (size * size) / 100;
  }

  getRandomColor() {
    const colors = [
      '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
      '#9B59B6', '#1ABC9C', '#E91E63', '#00BCD4'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Direction-based input (-1 to 1)
  setDirection(dirX, dirY) {
    this.dirX = Math.max(-1, Math.min(1, dirX || 0));
    this.dirY = Math.max(-1, Math.min(1, dirY || 0));
  }

  update(worldSize) {
    for (const cell of this.cells) {
      // Speed decreases with mass (bigger = slower)
      // Formula: baseSpeed - (mass * factor), min speed cap
      const speed = Math.max(
        CONSTANTS.MIN_SPEED,
        CONSTANTS.BASE_SPEED - cell.mass * CONSTANTS.SPEED_FACTOR
      );

      // Apply direction as velocity
      const targetVelX = this.dirX * speed;
      const targetVelY = this.dirY * speed;

      // Smooth acceleration
      cell.velocityX += (targetVelX - cell.velocityX) * 0.15;
      cell.velocityY += (targetVelY - cell.velocityY) * 0.15;

      // Apply velocity
      cell.x += cell.velocityX;
      cell.y += cell.velocityY;

      // Keep in bounds (solid wall, no bounce)
      if (cell.x < cell.size) {
        cell.x = cell.size;
        cell.velocityX = 0;
      }
      if (cell.x > worldSize - cell.size) {
        cell.x = worldSize - cell.size;
        cell.velocityX = 0;
      }
      if (cell.y < cell.size) {
        cell.y = cell.size;
        cell.velocityY = 0;
      }
      if (cell.y > worldSize - cell.size) {
        cell.y = worldSize - cell.size;
        cell.velocityY = 0;
      }

      // Mass decay: larger cells lose mass faster
      // Only decay above minimum mass, rate scales with mass
      if (cell.mass > CONSTANTS.MIN_MASS) {
        const decay = cell.mass * CONSTANTS.DECAY_RATE;
        cell.mass = Math.max(CONSTANTS.MIN_MASS, cell.mass - decay);
        cell.size = this.massToSize(cell.mass);
      }

      // Cap at max mass
      if (cell.mass > CONSTANTS.MAX_MASS) {
        cell.mass = CONSTANTS.MAX_MASS;
        cell.size = this.massToSize(CONSTANTS.MAX_MASS);
      }
    }

    // Update peak mass tracking
    const totalMass = this.getTotalMass();
    if (totalMass > this.peakMass) {
      this.peakMass = totalMass;
    }

    // Update trail
    if (this.cells.length > 0) {
      const mainCell = this.cells[0];
      this.trail.unshift({ x: mainCell.x, y: mainCell.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.pop();
      }
    }

    // Merge cells if they've been split for a while
    this.mergeCells();
  }

  // Get total mass of all cells
  getTotalMass() {
    return this.cells.reduce((sum, cell) => sum + cell.mass, 0);
  }

  split() {
    if (this.cells.length >= CONSTANTS.MAX_CELLS) return;

    const newCells = [];
    for (const cell of this.cells) {
      // Must have at least MIN_SPLIT_MASS to split (results in two cells of half mass)
      if (cell.mass >= CONSTANTS.MIN_SPLIT_MASS && this.cells.length + newCells.length < CONSTANTS.MAX_CELLS) {
        // Split mass in half
        const newMass = cell.mass / 2;
        cell.mass = newMass;
        cell.size = this.massToSize(newMass);

        // Split in movement direction, or random if stationary
        let splitDirX = this.dirX;
        let splitDirY = this.dirY;
        if (Math.abs(splitDirX) < 0.1 && Math.abs(splitDirY) < 0.1) {
          const angle = Math.random() * Math.PI * 2;
          splitDirX = Math.cos(angle);
          splitDirY = Math.sin(angle);
        }
        const len = Math.hypot(splitDirX, splitDirY) || 1;

        const newSize = this.massToSize(newMass);
        // Split cells launch forward with burst speed
        const launchSpeed = Math.min(20, 10 + newMass * 0.05);

        newCells.push({
          x: cell.x + (splitDirX / len) * newSize * 2,
          y: cell.y + (splitDirY / len) * newSize * 2,
          mass: newMass,
          size: newSize,
          velocityX: (splitDirX / len) * launchSpeed,
          velocityY: (splitDirY / len) * launchSpeed,
          splitTime: Date.now()
        });
      }
    }

    this.cells.push(...newCells);
  }

  mergeCells() {
    const now = Date.now();

    for (let i = 0; i < this.cells.length; i++) {
      for (let j = i + 1; j < this.cells.length; j++) {
        const c1 = this.cells[i];
        const c2 = this.cells[j];

        // Merge delay scales with mass (larger cells take longer to merge)
        // Base: 30 seconds, +1 second per 100 mass
        const mergeDelay = (CONSTANTS.MERGE_TIME + (c1.mass + c2.mass) / 200) * 1000;

        // Check if enough time has passed since split
        if (c1.splitTime && now - c1.splitTime < mergeDelay) continue;
        if (c2.splitTime && now - c2.splitTime < mergeDelay) continue;

        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        const minDist = c1.size + c2.size;

        if (dist < minDist * 0.5) {
          // Merge cells - combine mass
          c1.mass = c1.mass + c2.mass;
          c1.size = this.massToSize(c1.mass);
          c1.x = (c1.x + c2.x) / 2;
          c1.y = (c1.y + c2.y) / 2;
          delete c1.splitTime;
          this.cells.splice(j, 1);
          j--;
        }
      }
    }
  }

  ejectMass() {
    const cell = this.cells[0];
    // Must have at least MIN_EJECT_MASS (32) to eject
    if (!cell || cell.mass < CONSTANTS.MIN_EJECT_MASS) return null;

    // Lose 16 mass, but ejected pellet is only 14 (90% efficiency)
    cell.mass -= CONSTANTS.EJECT_MASS_LOSS;
    cell.size = this.massToSize(cell.mass);

    // Eject in movement direction
    let ejectDirX = this.dirX;
    let ejectDirY = this.dirY;
    if (Math.abs(ejectDirX) < 0.1 && Math.abs(ejectDirY) < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      ejectDirX = Math.cos(angle);
      ejectDirY = Math.sin(angle);
    }
    const len = Math.hypot(ejectDirX, ejectDirY) || 1;

    const ejectedSize = this.massToSize(CONSTANTS.EJECT_MASS_GAIN);
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: cell.x + (ejectDirX / len) * (cell.size + ejectedSize),
      y: cell.y + (ejectDirY / len) * (cell.size + ejectedSize),
      mass: CONSTANTS.EJECT_MASS_GAIN,
      size: ejectedSize,
      color: this.color,
      velocityX: (ejectDirX / len) * 25,
      velocityY: (ejectDirY / len) * 25,
      isEjected: true
    };
  }

  // Add mass to player (from eating food or other players)
  addMass(amount, isFood = false) {
    if (this.cells.length === 0) return;

    // Track stats
    this.totalMassEaten += amount;
    if (isFood) {
      this.foodEaten++;
    } else {
      this.playersEaten++;
    }

    // Add mass to smallest cell (balances growth)
    const smallest = this.cells.reduce((min, cell) =>
      cell.mass < min.mass ? cell : min
    );
    smallest.mass = Math.min(CONSTANTS.MAX_MASS, smallest.mass + amount);
    smallest.size = this.massToSize(smallest.mass);
  }

  // Score is the peak mass achieved this life
  getScore() {
    return Math.floor(this.peakMass);
  }

  // Get current total mass
  getMass() {
    return Math.floor(this.getTotalMass());
  }

  getCenter() {
    if (this.cells.length === 0) return { x: 0, y: 0 };
    const x = this.cells.reduce((sum, c) => sum + c.x, 0) / this.cells.length;
    const y = this.cells.reduce((sum, c) => sum + c.y, 0) / this.cells.length;
    return { x, y };
  }

  getPublicData() {
    return {
      id: this.id,
      username: this.username,
      wallet: this.wallet,
      cells: this.cells.map(c => ({
        x: c.x,
        y: c.y,
        size: c.size,
        mass: c.mass
      })),
      trail: this.trail,
      color: this.color,
      score: this.getScore(),      // Peak mass (leaderboard score)
      mass: this.getMass(),         // Current total mass
      kills: this.kills,
      stats: {
        totalMassEaten: this.totalMassEaten,
        foodEaten: this.foodEaten,
        playersEaten: this.playersEaten
      }
    };
  }
}

// Export constants for use in game.js
Player.CONSTANTS = CONSTANTS;
module.exports = Player;
