// Renderer - Canvas drawing
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldSize = 3000;

    // Camera
    this.cameraX = 0;
    this.cameraY = 0;
    this.zoom = 1;
    this.targetZoom = 1;

    // Assets
    this.trumpImage = new Image();
    this.maduroImage = new Image();
    this.assetsLoaded = false;

    // Load assets
    this.loadAssets();

    // Resize handler
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Grid pattern
    this.gridSize = 50;
  }

  loadAssets() {
    let loaded = 0;
    const total = 2;

    const onLoad = () => {
      loaded++;
      if (loaded >= total) {
        this.assetsLoaded = true;
        console.log('Assets loaded');
      }
    };

    // Load Trump image (player self)
    this.trumpImage.onload = onLoad;
    this.trumpImage.onerror = () => {
      console.log('Trump image failed to load');
      onLoad();
    };
    this.trumpImage.src = '/assets/trump.webp';

    // Load Maduro image (other players)
    this.maduroImage.onload = onLoad;
    this.maduroImage.onerror = () => {
      console.log('Maduro image failed to load');
      onLoad();
    };
    this.maduroImage.src = '/assets/maduro.jpeg';
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Smooth camera follow
  updateCamera(targetX, targetY, playerSize) {
    // Zoom based on player size
    this.targetZoom = Math.max(0.3, Math.min(1, 100 / playerSize));
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    // Smooth camera movement
    this.cameraX += (targetX - this.cameraX) * 0.1;
    this.cameraY += (targetY - this.cameraY) * 0.1;
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(x, y) {
    const screenX = (x - this.cameraX) * this.zoom + this.canvas.width / 2;
    const screenY = (y - this.cameraY) * this.zoom + this.canvas.height / 2;
    return { x: screenX, y: screenY };
  }

  // Clear and prepare canvas
  clear() {
    // Dark background matching landing page (#0a0a0a)
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Draw grid
  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;

    const gridSize = this.gridSize * this.zoom;
    const offsetX = (-this.cameraX * this.zoom + this.canvas.width / 2) % gridSize;
    const offsetY = (-this.cameraY * this.zoom + this.canvas.height / 2) % gridSize;

    // Vertical lines
    for (let x = offsetX; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  // Draw world border
  drawBorder() {
    const topLeft = this.worldToScreen(0, 0);
    const bottomRight = this.worldToScreen(this.worldSize, this.worldSize);

    this.ctx.strokeStyle = '#ff6b6b';
    this.ctx.lineWidth = 5 * this.zoom;
    this.ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      (bottomRight.x - topLeft.x),
      (bottomRight.y - topLeft.y)
    );
  }

  // Draw food pellets
  drawFood(food) {
    for (const f of food) {
      const pos = this.worldToScreen(f.x, f.y);
      const size = Math.max(3, f.size * this.zoom);

      // Skip if off screen
      if (pos.x < -size || pos.x > this.canvas.width + size ||
          pos.y < -size || pos.y > this.canvas.height + size) {
        continue;
      }

      // Ejected mass is larger and has velocity glow
      if (f.isEjected) {
        // Glow for ejected mass
        this.ctx.shadowColor = f.color;
        this.ctx.shadowBlur = 8;
      }

      // Core
      this.ctx.fillStyle = f.color;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowBlur = 0;
    }
  }

  // Draw viruses (green spikey circles)
  drawViruses(viruses) {
    if (!viruses) return;

    for (const v of viruses) {
      const pos = this.worldToScreen(v.x, v.y);
      const size = v.size * this.zoom;

      // Skip if off screen
      if (pos.x < -size * 2 || pos.x > this.canvas.width + size * 2 ||
          pos.y < -size * 2 || pos.y > this.canvas.height + size * 2) {
        continue;
      }

      // Draw spiky virus
      this.ctx.save();

      // Glow effect
      this.ctx.shadowColor = '#33ff33';
      this.ctx.shadowBlur = 15;

      // Draw spikey circle
      const spikes = 11;
      const outerRadius = size;
      const innerRadius = size * 0.7;

      this.ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = pos.x + Math.cos(angle) * radius;
        const y = pos.y + Math.sin(angle) * radius;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.closePath();

      // Fill with gradient
      const gradient = this.ctx.createRadialGradient(
        pos.x, pos.y, 0,
        pos.x, pos.y, size
      );
      gradient.addColorStop(0, 'rgba(100, 255, 100, 0.9)');
      gradient.addColorStop(0.7, 'rgba(50, 200, 50, 0.8)');
      gradient.addColorStop(1, 'rgba(30, 150, 30, 0.7)');

      this.ctx.fillStyle = gradient;
      this.ctx.fill();

      // Border
      this.ctx.strokeStyle = '#33aa33';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  // Draw a player cell with character image
  drawPlayerCell(cell, color, isSelf, username) {
    const pos = this.worldToScreen(cell.x, cell.y);
    const size = cell.size * this.zoom;

    // Skip if off screen
    if (pos.x < -size * 2 || pos.x > this.canvas.width + size * 2 ||
        pos.y < -size * 2 || pos.y > this.canvas.height + size * 2) {
      return;
    }

    // Glow effect - matching theme colors
    this.ctx.shadowColor = isSelf ? '#00ff88' : '#ff6b35';
    this.ctx.shadowBlur = 20;

    // Draw circle background
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();

    // Draw character image
    const img = isSelf ? this.trumpImage : this.maduroImage;
    if (img.complete && img.naturalWidth > 0) {
      // Clip to circle
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, size * 0.85, 0, Math.PI * 2);
      this.ctx.clip();

      // Draw image
      this.ctx.drawImage(
        img,
        pos.x - size * 0.85,
        pos.y - size * 0.85,
        size * 1.7,
        size * 1.7
      );
      this.ctx.restore();
    } else {
      // Fallback: draw emoji
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `${size}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(isSelf ? '🇺🇸' : '🇻🇪', pos.x, pos.y);
    }

    // Draw border ring - matching theme colors
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    this.ctx.strokeStyle = isSelf ? '#00ff88' : '#ff6b35';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    this.ctx.shadowBlur = 0;

    // Draw username below cell (mass/score already shown in HUD)
    if (size > 20) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `bold ${Math.max(12, size * 0.3)}px 'Inter', sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Text shadow
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(username, pos.x, pos.y + size + 15);
      this.ctx.shadowBlur = 0;
    }
  }

  // Draw player trail
  drawTrail(trail, color, isSelf) {
    if (!trail || trail.length < 2) return;

    this.ctx.beginPath();
    const startPos = this.worldToScreen(trail[0].x, trail[0].y);
    this.ctx.moveTo(startPos.x, startPos.y);

    for (let i = 1; i < trail.length; i++) {
      const pos = this.worldToScreen(trail[i].x, trail[i].y);
      this.ctx.lineTo(pos.x, pos.y);
    }

    // Gradient trail - matching theme colors
    const alpha = isSelf ? 0.4 : 0.2;
    this.ctx.strokeStyle = isSelf ? `rgba(0, 255, 136, ${alpha})` : `rgba(255, 107, 53, ${alpha})`;
    this.ctx.lineWidth = 8 * this.zoom;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
  }

  // Draw all players
  drawPlayers(players, selfId) {
    // Sort by size (smaller on top)
    const sorted = [...players].sort((a, b) => {
      const sizeA = a.cells.reduce((sum, c) => sum + c.size, 0);
      const sizeB = b.cells.reduce((sum, c) => sum + c.size, 0);
      return sizeB - sizeA;
    });

    // Draw trails first (behind players)
    for (const player of sorted) {
      const isSelf = player.id === selfId;
      if (player.trail) {
        this.drawTrail(player.trail, player.color, isSelf);
      }
    }

    // Draw players
    for (const player of sorted) {
      const isSelf = player.id === selfId;

      for (const cell of player.cells) {
        this.drawPlayerCell(cell, player.color, isSelf, player.username);
      }
    }
  }

  // Draw particles
  drawParticles(particles) {
    for (const p of particles) {
      const pos = this.worldToScreen(p.x, p.y);
      const size = p.size * this.zoom * p.life;

      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  // Draw minimap
  drawMinimap(players, selfId, minimapCanvas, viruses) {
    const ctx = minimapCanvas.getContext('2d');
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const scale = w / this.worldSize;

    // Background - matching theme
    ctx.fillStyle = 'rgba(10, 10, 10, 0.9)';
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    // Draw viruses on minimap
    if (viruses) {
      for (const v of viruses) {
        const x = v.x * scale;
        const y = v.y * scale;
        const size = Math.max(2, v.size * scale * 0.3);

        ctx.fillStyle = '#33ff33';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw players
    for (const player of players) {
      const isSelf = player.id === selfId;

      for (const cell of player.cells) {
        const x = cell.x * scale;
        const y = cell.y * scale;
        const size = Math.max(2, cell.size * scale * 0.5);

        ctx.fillStyle = isSelf ? '#00ff88' : '#ff6b35';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw camera view rectangle
    const viewX = (this.cameraX - this.canvas.width / 2 / this.zoom) * scale;
    const viewY = (this.cameraY - this.canvas.height / 2 / this.zoom) * scale;
    const viewW = (this.canvas.width / this.zoom) * scale;
    const viewH = (this.canvas.height / this.zoom) * scale;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(viewX, viewY, viewW, viewH);
  }

  // Main render function
  render(state, selfId, minimapCanvas, particles) {
    this.clear();
    this.drawGrid();
    this.drawBorder();

    if (state) {
      this.drawFood(state.food);
      this.drawViruses(state.viruses);  // Draw viruses before players
      this.drawPlayers(state.players, selfId);

      // Draw particles on top
      if (particles && particles.length > 0) {
        this.drawParticles(particles);
      }

      if (minimapCanvas) {
        this.drawMinimap(state.players, selfId, minimapCanvas, state.viruses);
      }
    }
  }
}

// Global renderer instance (created in game.js)
window.Renderer = Renderer;
