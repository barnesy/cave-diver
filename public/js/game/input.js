/**
 * Unified mobile touch joystick + desktop keyboard controller.
 */

export class InputController {
  constructor({ stickBaseEl, stickKnobEl, onGasSelect, onTorchToggle, onReelToggle, onReelRewind }) {
    this.keys = new Set();
    this.stickVec = { x: 0, y: 0 };
    this.activePointerId = null;
    this.stickCenter = { x: 0, y: 0 };
    this.maxRadius = 42;

    this.stickBaseEl = stickBaseEl;
    this.stickKnobEl = stickKnobEl;
    this.onGasSelect = onGasSelect;
    this.onTorchToggle = onTorchToggle;
    this.onReelToggle = onReelToggle;
    this.onReelRewind = onReelRewind;

    this._bindKeyboard();
    this._bindTouchStick();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);
      if (code === 'Digit1') this.onGasSelect?.('EAN32');
      if (code === 'Digit2') this.onGasSelect?.('TMX1455');
      if (code === 'Digit3') this.onGasSelect?.('O2');
      if (code === 'KeyL') this.onTorchToggle?.();
      if (code === 'KeyG') this.onReelToggle?.();
      if (code === 'KeyR') this.onReelRewind?.();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.resetStick();
    });
  }

  _bindTouchStick() {
    if (!this.stickBaseEl || !this.stickKnobEl) return;

    const updateStick = (clientX, clientY) => {
      const dx = clientX - this.stickCenter.x;
      const dy = clientY - this.stickCenter.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.maxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * clamped;
      const ky = Math.sin(angle) * clamped;

      this.stickKnobEl.style.transform = `translate(${kx}px, ${ky}px)`;
      const norm = clamped / this.maxRadius;
      // Precision curve gives fine slow-swim control near center while keeping full cruise at rim
      const curved = Math.pow(norm, 1.45);
      this.stickVec.x = Math.cos(angle) * curved;
      this.stickVec.y = Math.sin(angle) * curved;
    };

    this.stickBaseEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.stickBaseEl.setPointerCapture(e.pointerId);
      const rect = this.stickBaseEl.getBoundingClientRect();
      this.stickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      this.maxRadius = Math.max(34, rect.width * 0.36);
      updateStick(e.clientX, e.clientY);
    });

    this.stickBaseEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      updateStick(e.clientX, e.clientY);
    });

    const release = (e) => {
      if (e.pointerId !== this.activePointerId) return;
      this.resetStick();
    };

    this.stickBaseEl.addEventListener('pointerup', release);
    this.stickBaseEl.addEventListener('pointercancel', release);
  }

  resetStick() {
    this.activePointerId = null;
    this.stickVec.x = 0;
    this.stickVec.y = 0;
    if (this.stickKnobEl) {
      this.stickKnobEl.style.transform = 'translate(0px, 0px)';
    }
  }

  getThrust() {
    let x = this.stickVec.x;
    let y = this.stickVec.y;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;

    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }

    return { x, y };
  }
}
