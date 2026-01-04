// Input Handler - Keyboard (Desktop) + Virtual Joystick (Mobile)
class InputManager {
  constructor() {
    // Direction vector (-1 to 1)
    this.dirX = 0;
    this.dirY = 0;

    // Keyboard state
    this.keys = {};

    // Mobile joystick state
    this.joystick = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      element: null,
      knob: null
    };

    // Device detection
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Boost state
    this.boosting = false;
    this.boostCooldown = false;
  }

  init(canvas) {
    this.canvas = canvas;

    if (this.isMobile) {
      this.initMobileControls();
    } else {
      this.initDesktopControls();
    }
  }

  initDesktopControls() {
    // Hide mobile controls
    const mobileControls = document.querySelector('.mobile-controls');
    if (mobileControls) mobileControls.style.display = 'none';

    // Hide cursor during gameplay
    document.body.style.cursor = 'none';

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (this.keys[e.code]) return; // Prevent repeat
      this.keys[e.code] = true;

      // Space = split
      if (e.code === 'Space') {
        e.preventDefault();
        if (window.networkManager) {
          window.networkManager.split();
          this.triggerScreenShake();
        }
      }

      // E = eject mass
      if (e.code === 'KeyE') {
        if (window.networkManager) {
          window.networkManager.eject();
        }
      }

      // Shift = boost
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.startBoost();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.stopBoost();
      }
    });
  }

  initMobileControls() {
    // Create joystick zone
    this.createJoystick();

    // Setup mobile buttons
    const splitBtn = document.getElementById('split-btn');
    const ejectBtn = document.getElementById('eject-btn');
    const boostBtn = document.getElementById('boost-btn');

    if (splitBtn) {
      splitBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.networkManager) {
          window.networkManager.split();
          this.triggerScreenShake();
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

    if (boostBtn) {
      boostBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.startBoost();
      });
      boostBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.stopBoost();
      });
    }
  }

  createJoystick() {
    // Create joystick container
    const joystickZone = document.createElement('div');
    joystickZone.id = 'joystick-zone';
    joystickZone.innerHTML = `
      <div class="joystick-base">
        <div class="joystick-knob"></div>
      </div>
    `;
    document.body.appendChild(joystickZone);

    this.joystick.element = joystickZone.querySelector('.joystick-base');
    this.joystick.knob = joystickZone.querySelector('.joystick-knob');

    // Touch events for joystick
    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.joystick.active = true;
      this.joystick.startX = touch.clientX;
      this.joystick.startY = touch.clientY;

      // Position joystick at touch point
      this.joystick.element.style.left = touch.clientX + 'px';
      this.joystick.element.style.top = touch.clientY + 'px';
      this.joystick.element.classList.add('active');
    });

    document.addEventListener('touchmove', (e) => {
      if (!this.joystick.active) return;

      const touch = e.touches[0];
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;

      // Calculate direction
      let dx = this.joystick.currentX - this.joystick.startX;
      let dy = this.joystick.currentY - this.joystick.startY;

      // Limit to max radius
      const maxRadius = 50;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      // Update knob position
      this.joystick.knob.style.transform = `translate(${dx}px, ${dy}px)`;

      // Normalize to -1 to 1
      this.dirX = dx / maxRadius;
      this.dirY = dy / maxRadius;
    });

    document.addEventListener('touchend', (e) => {
      if (!this.joystick.active) return;

      // Check if all touches are ended
      if (e.touches.length === 0) {
        this.joystick.active = false;
        this.joystick.element.classList.remove('active');
        this.joystick.knob.style.transform = 'translate(0, 0)';
        this.dirX = 0;
        this.dirY = 0;
      }
    });
  }

  // Get current direction based on WASD/Arrow keys (desktop) or joystick (mobile)
  getDirection() {
    if (this.isMobile) {
      return { x: this.dirX, y: this.dirY, boost: this.boosting };
    }

    // Desktop: WASD / Arrow keys for movement
    let x = 0;
    let y = 0;

    // WASD + Arrow keys
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }

    return { x, y, boost: this.boosting };
  }

  startBoost() {
    if (this.boostCooldown) return;
    this.boosting = true;

    // Visual feedback
    document.body.classList.add('boosting');
  }

  stopBoost() {
    this.boosting = false;
    document.body.classList.remove('boosting');
  }

  triggerScreenShake() {
    const canvas = this.canvas;
    canvas.classList.add('shake');
    setTimeout(() => canvas.classList.remove('shake'), 200);
  }

  isKeyDown(code) {
    return this.keys[code] === true;
  }
}

// Global input instance
window.inputManager = new InputManager();
