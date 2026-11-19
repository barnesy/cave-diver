/**
 * Unified mobile touch joystick + desktop keyboard controller.
 */

export class InputController {
  constructor({
    stickBaseEl,
    stickKnobEl,
    onGasSelect,
    onRecommendedGasSwitch,
    onTorchToggle,
    onReelToggle,
    onReelRewind,
    onWreckAction,
    onPauseToggle,
  }) {
    this.keys = new Set();
    this.stickVec = { x: 0, y: 0 };
    this.activePointerId = null;
    this.stickCenter = { x: 0, y: 0 };
    this.maxRadius = 40;

    this.stickBaseEl = stickBaseEl;
    this.stickKnobEl = stickKnobEl;
    this.onGasSelect = onGasSelect;
    this.onRecommendedGasSwitch = onRecommendedGasSwitch;
    this.onTorchToggle = onTorchToggle;
    this.onReelToggle = onReelToggle;
    this.onReelRewind = onReelRewind;
    this.onWreckAction = onWreckAction;
    this.onPauseToggle = onPauseToggle;

    this._bindKeyboard();
    this._bindTouchStick();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const code = e.code;
      this.keys.add(code);
      if (code === 'Digit1') this.onGasSelect?.('EAN32');
      if (code === 'Digit2') this.onGasSelect?.('TMX1455');
      if (code === 'Digit3') this.onGasSelect?.('O2');
      if (code === 'Space' || code === 'Tab') {
        if (this.onRecommendedGasSwitch?.()) e.preventDefault();
      }
      if (code === 'KeyL') this.onTorchToggle?.();
      if (code === 'KeyG') this.onReelToggle?.();
      if (code === 'KeyR' && !e.repeat) this.onReelRewind?.();
      if ((code === 'KeyE' || code === 'KeyF') && !e.repeat) {
        if (this.onWreckAction?.()) e.preventDefault();
      }
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        if (this.onPauseToggle?.()) e.preventDefault();
      }
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

    const DEADZONE = 0.09;
    const updateStick = (clientX, clientY) => {
      const dx = clientX - this.stickCenter.x;
      const dy = clientY - this.stickCenter.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.maxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * clamped;
      const ky = Math.sin(angle) * clamped;

      this.stickKnobEl.style.transform = `translate(${kx}px, ${ky}px)`;
      const rawNorm = this.maxRadius > 0 ? clamped / this.maxRadius : 0;
      if (rawNorm <= DEADZONE) {
        this.stickVec.x = 0;
        this.stickVec.y = 0;
        return;
      }
      const norm = (rawNorm - DEADZONE) / (1 - DEADZONE);
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
      // Clamp maxRadius cleanly inside ring so the knob never overflows neighboring HUD cards
      this.maxRadius = Math.max(22, rect.width * 0.34);
      // Softly recenter origin toward touch point (capped within 35% of radius) to prevent wall-jolt on landing
      const boxCx = rect.left + rect.width / 2;
      const boxCy = rect.top + rect.height / 2;
      const offX = e.clientX - boxCx;
      const offY = e.clientY - boxCy;
      const offD = Math.hypot(offX, offY);
      const maxShift = this.maxRadius * 0.45;
      const shiftRatio = offD > maxShift && offD > 0 ? maxShift / offD : 1;
      this.stickCenter = {
        x: boxCx + offX * shiftRatio,
        y: boxCy + offY * shiftRatio,
      };
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

  isRewindHeld() {
    return this.keys.has('KeyR');
  }

  getThrust() {
    let x = this.stickVec.x;
    let y = this.stickVec.y;

    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      // Hold Shift on desktop for precision slow frog-kick (0.45x thrust) through squeezes & ascents
      const precision = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 0.45 : 1.0;
      x += kx * precision;
      y += ky * precision;
    }

    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }

    return { x, y };
  }
}
