class Player {
  constructor(id, username, wallet, worldSize) {
    this.id = id;
    this.username = username || 'Anonymous';
    this.wallet = wallet || null;
    this.cells = [];
    this.targetX = 0;
    this.targetY = 0;
    this.kills = 0;
    this.color = this.getRandomColor();

    // Spawn initial cell
    this.spawn(worldSize);
  }

  spawn(worldSize) {
    const startSize = 30;
    this.cells.push({
      x: Math.random() * worldSize,
      y: Math.random() * worldSize,
      size: startSize,
      velocityX: 0,
      velocityY: 0
    });
  }

  respawn(worldSize) {
    this.cells = [];
    this.spawn(worldSize);
  }

  getRandomColor() {
    const colors = [
      '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
      '#9B59B6', '#1ABC9C', '#E91E63', '#00BCD4'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  update(worldSize) {
    for (const cell of this.cells) {
      // Calculate direction to target
      const dx = this.targetX - cell.x;
      const dy = this.targetY - cell.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 5) {
        // Speed decreases with size (bigger = slower)
        const baseSpeed = 8;
        const speed = Math.max(1, baseSpeed - cell.size * 0.05);

        // Normalize and apply speed
        cell.velocityX = (dx / dist) * speed;
        cell.velocityY = (dy / dist) * speed;
      } else {
        cell.velocityX *= 0.9;
        cell.velocityY *= 0.9;
      }

      // Apply velocity
      cell.x += cell.velocityX;
      cell.y += cell.velocityY;

      // Keep in bounds
      cell.x = Math.max(cell.size, Math.min(worldSize - cell.size, cell.x));
      cell.y = Math.max(cell.size, Math.min(worldSize - cell.size, cell.y));

      // Slow decay of mass over time
      if (cell.size > 30) {
        cell.size -= 0.01;
      }
    }

    // Merge cells if they've been split for a while
    this.mergeCells();
  }

  split() {
    if (this.cells.length >= 16) return; // Max 16 cells

    const newCells = [];
    for (const cell of this.cells) {
      if (cell.size >= 40 && this.cells.length + newCells.length < 16) {
        // Split this cell
        const newSize = cell.size / Math.sqrt(2);
        cell.size = newSize;

        // Calculate split direction
        const dx = this.targetX - cell.x;
        const dy = this.targetY - cell.y;
        const dist = Math.hypot(dx, dy) || 1;

        newCells.push({
          x: cell.x + (dx / dist) * newSize * 2,
          y: cell.y + (dy / dist) * newSize * 2,
          size: newSize,
          velocityX: (dx / dist) * 20,
          velocityY: (dy / dist) * 20,
          splitTime: Date.now()
        });
      }
    }

    this.cells.push(...newCells);
  }

  mergeCells() {
    const mergeDelay = 10000; // 10 seconds before cells can merge
    const now = Date.now();

    for (let i = 0; i < this.cells.length; i++) {
      for (let j = i + 1; j < this.cells.length; j++) {
        const c1 = this.cells[i];
        const c2 = this.cells[j];

        // Check if enough time has passed since split
        if (c1.splitTime && now - c1.splitTime < mergeDelay) continue;
        if (c2.splitTime && now - c2.splitTime < mergeDelay) continue;

        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        const minDist = c1.size + c2.size;

        if (dist < minDist * 0.5) {
          // Merge cells
          const totalMass = Math.PI * c1.size * c1.size + Math.PI * c2.size * c2.size;
          c1.size = Math.sqrt(totalMass / Math.PI);
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
    if (!cell || cell.size < 35) return null;

    cell.size -= 5;

    const dx = this.targetX - cell.x;
    const dy = this.targetY - cell.y;
    const dist = Math.hypot(dx, dy) || 1;

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: cell.x + (dx / dist) * cell.size,
      y: cell.y + (dy / dist) * cell.size,
      size: 15,
      color: this.color,
      velocityX: (dx / dist) * 25,
      velocityY: (dy / dist) * 25
    };
  }

  addMass(amount) {
    if (this.cells.length === 0) return;

    // Add mass to smallest cell
    const smallest = this.cells.reduce((min, cell) =>
      cell.size < min.size ? cell : min
    );
    smallest.size += amount * 0.1; // Mass to size conversion
  }

  getScore() {
    return Math.floor(this.cells.reduce((sum, cell) => sum + cell.size * cell.size, 0));
  }

  getPublicData() {
    return {
      id: this.id,
      username: this.username,
      wallet: this.wallet,
      cells: this.cells.map(c => ({
        x: c.x,
        y: c.y,
        size: c.size
      })),
      color: this.color,
      score: this.getScore()
    };
  }
}

module.exports = Player;
