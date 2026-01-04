const Player = require('./player');

class Game {
  constructor() {
    this.worldSize = 3000;
    this.players = new Map();
    this.food = [];
    this.maxFood = 500;
    this.foodSize = 10;

    // Initialize food
    this.spawnInitialFood();
  }

  spawnInitialFood() {
    for (let i = 0; i < this.maxFood; i++) {
      this.spawnFood();
    }
  }

  spawnFood() {
    if (this.food.length >= this.maxFood) return;

    this.food.push({
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * this.worldSize,
      y: Math.random() * this.worldSize,
      size: this.foodSize,
      color: this.getRandomColor()
    });
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

  handleInput(id, input) {
    const player = this.players.get(id);
    if (player) {
      player.setTarget(input.mouseX, input.mouseY);
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
    // Update all players
    for (const player of this.players.values()) {
      player.update(this.worldSize);
    }

    // Check food collisions
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
        for (let i = this.food.length - 1; i >= 0; i--) {
          const food = this.food[i];
          const dist = Math.hypot(cell.x - food.x, cell.y - food.y);

          if (dist < cell.size) {
            // Eat food
            player.addMass(food.size * 0.5);
            this.food.splice(i, 1);
          }
        }
      }
    }
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

            // Can eat if significantly larger (25% bigger)
            if (cell1.size > cell2.size * 1.25 && dist < cell1.size - cell2.size * 0.4) {
              // Eat the smaller cell
              p1.addMass(cell2.size * 0.8);
              p2.cells.splice(k, 1);
              p1.kills++;

              // Respawn if no cells left
              if (p2.cells.length === 0) {
                p2.respawn(this.worldSize);
              }
            }
          }
        }
      }
    }
  }

  getState() {
    const players = [];
    for (const player of this.players.values()) {
      players.push(player.getPublicData());
    }

    return {
      players,
      food: this.food
    };
  }

  getLeaderboard() {
    const sorted = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        username: p.username,
        wallet: p.wallet,
        score: p.getScore(),
        kills: p.kills
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return sorted;
  }
}

module.exports = Game;
