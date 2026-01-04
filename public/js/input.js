// Input Handler
class InputManager {
  constructor() {
    this.mouseX = 0;
    this.mouseY = 0;
    this.screenMouseX = 0;
    this.screenMouseY = 0;
    this.keys = {};
  }

  init(canvas) {
    this.canvas = canvas;

    // Mouse move
    document.addEventListener('mousemove', (e) => {
      this.screenMouseX = e.clientX;
      this.screenMouseY = e.clientY;
    });

    // Touch support for mobile
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.screenMouseX = e.touches[0].clientX;
        this.screenMouseY = e.touches[0].clientY;
      }
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Space = split
      if (e.code === 'Space') {
        e.preventDefault();
        if (window.networkManager) {
          window.networkManager.split();
        }
      }

      // W = eject mass
      if (e.code === 'KeyW') {
        if (window.networkManager) {
          window.networkManager.eject();
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Touch split (double tap)
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
      // Ignore if tapping on buttons
      if (e.target.classList.contains('mobile-btn')) return;

      const now = Date.now();
      if (now - lastTap < 300) {
        if (window.networkManager) {
          window.networkManager.split();
        }
      }
      lastTap = now;
    });

    // Mobile button handlers
    const splitBtn = document.getElementById('split-btn');
    const ejectBtn = document.getElementById('eject-btn');

    if (splitBtn) {
      splitBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.networkManager) {
          window.networkManager.split();
        }
      });
    }

    if (ejectBtn) {
      ejectBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.networkManager) {
          window.networkManager.eject();
        }
      });
    }
  }

  // Convert screen coordinates to world coordinates
  getWorldPosition(cameraX, cameraY, zoom) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Calculate world position based on camera and zoom
    this.mouseX = cameraX + (this.screenMouseX - centerX) / zoom;
    this.mouseY = cameraY + (this.screenMouseY - centerY) / zoom;

    return { x: this.mouseX, y: this.mouseY };
  }

  isKeyDown(code) {
    return this.keys[code] === true;
  }
}

// Global input instance
window.inputManager = new InputManager();
