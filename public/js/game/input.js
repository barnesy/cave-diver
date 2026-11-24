/**
 * Unified mobile touch joystick + desktop keyboard controller.
 */

export class InputController {
  constructor({
    stickBaseEl,
    stickKnobEl,
    torchStickBaseEl = null,
    torchStickKnobEl = null,
    onGasSelect,
    onRecommendedGasSwitch,
    onTorchToggle,
    onReelToggle,
    onReelRewind,
    onWreckAction,
    onSonarPing,
    onDpvToggle,
    onMinimapToggle,
    onCameraSnap,
    onBuddyPing,
    onStageDrop,
    onLiftBagToggle,
    onDropLineCookie,
    onDeploySmb,
    onComputerToggle,
    onSurveySlateToggle,
    onSignalWheelToggle,
    onPhotoModeToggle,
    onPauseToggle,
    onSpearPressStart,
    onSpearRelease,
  }) {
    this.keys = new Set();
    this.stickVec = { x: 0, y: 0 };
    this.activePointerId = null;
    this.stickCenter = { x: 0, y: 0 };
    this.maxRadius = 40;

    this.torchVec = { x: 0, y: 0, active: false };
    this.torchPointerId = null;
    this.torchCenter = { x: 0, y: 0 };
    this.torchMaxRadius = 36;
    this._gpTorchVec = { x: 0, y: 0, active: false };

    this.stickBaseEl = stickBaseEl;
    this.stickKnobEl = stickKnobEl;
    this.stickRingEl = stickBaseEl?.querySelector?.('.touch-ring') || null;
    this.torchStickBaseEl = torchStickBaseEl;
    this.torchStickKnobEl = torchStickKnobEl;
    this.torchStickRingEl = torchStickBaseEl?.querySelector?.('.touch-ring') || null;
    this._stickAnchorShift = { x: 0, y: 0 };
    this._torchAnchorShift = { x: 0, y: 0 };
    this.onGasSelect = onGasSelect;
    this.onRecommendedGasSwitch = onRecommendedGasSwitch;
    this.onTorchToggle = onTorchToggle;
    this.onReelToggle = onReelToggle;
    this.onReelRewind = onReelRewind;
    this.onWreckAction = onWreckAction;
    this.onSonarPing = onSonarPing;
    this.onDpvToggle = onDpvToggle;
    this.onMinimapToggle = onMinimapToggle;
    this.onCameraSnap = onCameraSnap;
    this.onBuddyPing = onBuddyPing;
    this.onStageDrop = onStageDrop;
    this.onLiftBagToggle = onLiftBagToggle;
    this.onDropLineCookie = onDropLineCookie;
    this.onDeploySmb = onDeploySmb;
    this.onComputerToggle = onComputerToggle;
    this.onSurveySlateToggle = onSurveySlateToggle;
    this.onSignalWheelToggle = onSignalWheelToggle;
    this.onPhotoModeToggle = onPhotoModeToggle;
    this.onPauseToggle = onPauseToggle;
    this.onSpearPressStart = onSpearPressStart;
    this.onSpearRelease = onSpearRelease;
    this._prevGpButtons = [];
    this._gpRewindHeld = false;
    this._touchRewindHeld = false;

    this._bindKeyboard();
    this._bindTouchStick();
    this._bindTorchStick();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !e.target?.closest?.('[hidden]')) return;
      const code = e.code;
      this.keys.add(code);
      if (code === 'Digit1' && !e.repeat) this.onGasSelect?.('EAN32');
      if (code === 'Digit2' && !e.repeat) this.onGasSelect?.('TMX1455');
      if (code === 'Digit3' && !e.repeat) this.onGasSelect?.('O2');
      if ((code === 'Space' || code === 'Tab') && !e.repeat) {
        if (this.onRecommendedGasSwitch?.()) e.preventDefault();
      }
      if (code === 'KeyL' && !e.repeat) this.onTorchToggle?.();
      if (code === 'KeyG' && !e.repeat) this.onReelToggle?.();
      if (code === 'KeyR' && !e.repeat) this.onReelRewind?.();
      if (code === 'KeyE' && !e.repeat) {
        if (this.onWreckAction?.()) e.preventDefault();
      }
      if (code === 'KeyF' && !e.repeat) {
        if (this.onSpearPressStart?.()) e.preventDefault();
        else if (this.onWreckAction?.()) e.preventDefault();
      }
      if (code === 'KeyQ' && !e.repeat) {
        if (this.onSonarPing?.()) e.preventDefault();
      }
      if (code === 'KeyV' && !e.repeat) {
        if (this.onDpvToggle?.()) e.preventDefault();
      }
      if (code === 'KeyM' && !e.repeat) {
        if (this.onMinimapToggle?.()) e.preventDefault();
      }
      if (code === 'KeyC' && !e.repeat) {
        if (this.onCameraSnap?.()) e.preventDefault();
      }
      if (code === 'KeyB' && !e.repeat) {
        if (this.onBuddyPing?.()) e.preventDefault();
      }
      if (code === 'KeyT' && !e.repeat) {
        if (this.onStageDrop?.()) e.preventDefault();
      }
      if (code === 'KeyY' && !e.repeat) {
        if (this.onLiftBagToggle?.()) e.preventDefault();
      }
      if (code === 'KeyK' && !e.repeat) {
        if (this.onDropLineCookie?.()) e.preventDefault();
      }
      if (code === 'KeyU' && !e.repeat) {
        if (this.onDeploySmb?.()) e.preventDefault();
      }
      if (code === 'KeyX' && !e.repeat) {
        if (this.onComputerToggle?.()) e.preventDefault();
      }
      if (code === 'KeyN' && !e.repeat) {
        if (this.onSurveySlateToggle?.()) e.preventDefault();
      }
      if (code === 'KeyH' && !e.repeat) {
        if (this.onSignalWheelToggle?.()) e.preventDefault();
      }
      if (code === 'KeyO' && !e.repeat) {
        if (this.onPhotoModeToggle?.()) e.preventDefault();
      }
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        if (this.onPauseToggle?.()) e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyF') this.onSpearRelease?.();
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.resetStick();
      this.resetTorchStick();
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
      const kx = Math.cos(angle) * clamped + this._stickAnchorShift.x;
      const ky = Math.sin(angle) * clamped + this._stickAnchorShift.y;

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
      try { this.stickBaseEl.setPointerCapture(e.pointerId); } catch {}
      const rect = this.stickBaseEl.getBoundingClientRect();
      // Clamp maxRadius cleanly inside ring so the knob never overflows neighboring HUD cards
      this.maxRadius = Math.max(22, rect.width * 0.34);
      // Dynamic floating anchor: softly glide the stick ring toward the landing thumb (v151)
      const boxCx = rect.left + rect.width / 2;
      const boxCy = rect.top + rect.height / 2;
      const offX = e.clientX - boxCx;
      const offY = e.clientY - boxCy;
      const offD = Math.hypot(offX, offY);
      const maxShift = this.maxRadius * 0.45;
      const shiftRatio = offD > maxShift && offD > 0 ? maxShift / offD : 1;
      const sx = offX * shiftRatio;
      const sy = offY * shiftRatio;
      this._stickAnchorShift = { x: sx, y: sy };
      this.stickCenter = {
        x: boxCx + sx,
        y: boxCy + sy,
      };
      if (this.stickRingEl) {
        this.stickRingEl.style.transform = `translate(${sx}px, ${sy}px)`;
      }
      this.stickBaseEl.classList.add('active');
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
    this.stickBaseEl.addEventListener('lostpointercapture', release);
  }

  resetStick() {
    this.activePointerId = null;
    this.stickVec.x = 0;
    this.stickVec.y = 0;
    this._stickAnchorShift = { x: 0, y: 0 };
    if (this.stickKnobEl) {
      this.stickKnobEl.style.transform = 'translate(0px, 0px)';
    }
    if (this.stickRingEl) {
      this.stickRingEl.style.transform = 'translate(0px, 0px)';
    }
    this.stickBaseEl?.classList?.remove('active');
  }

  _bindTorchStick() {
    if (!this.torchStickBaseEl || !this.torchStickKnobEl) return;

    const DEADZONE = 0.14;
    const updateTorch = (clientX, clientY) => {
      const dx = clientX - this.torchCenter.x;
      const dy = clientY - this.torchCenter.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.torchMaxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * clamped + this._torchAnchorShift.x;
      const ky = Math.sin(angle) * clamped + this._torchAnchorShift.y;

      this.torchStickKnobEl.style.transform = `translate(${kx}px, ${ky}px)`;
      const rawNorm = this.torchMaxRadius > 0 ? clamped / this.torchMaxRadius : 0;
      const torchDeadzone = Math.max(DEADZONE, 0.2);
      if (rawNorm <= torchDeadzone) {
        this.torchVec.x = 0;
        this.torchVec.y = 0;
        this.torchVec.active = false;
        this.torchStickBaseEl.classList.remove('aiming');
        return;
      }
      const nextX = Math.cos(angle);
      const nextY = Math.sin(angle);
      if (this.torchVec.active) {
        // Dampen micro-jitter while dragging thumb across the torch stick
        const bx = this.torchVec.x * 0.52 + nextX * 0.48;
        const by = this.torchVec.y * 0.52 + nextY * 0.48;
        const bm = Math.hypot(bx, by) || 1;
        this.torchVec.x = bx / bm;
        this.torchVec.y = by / bm;
      } else {
        this.torchVec.x = nextX;
        this.torchVec.y = nextY;
      }
      this.torchVec.active = true;
      this.torchStickBaseEl.classList.add('aiming');
    };

    this.torchStickBaseEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.torchPointerId !== null) return;
      this.torchPointerId = e.pointerId;
      try { this.torchStickBaseEl.setPointerCapture(e.pointerId); } catch {}
      const rect = this.torchStickBaseEl.getBoundingClientRect();
      this.torchMaxRadius = Math.max(20, rect.width * 0.34);
      const boxCx = rect.left + rect.width / 2;
      const boxCy = rect.top + rect.height / 2;
      const offX = e.clientX - boxCx;
      const offY = e.clientY - boxCy;
      const offD = Math.hypot(offX, offY);
      const maxShift = this.torchMaxRadius * 0.36;
      const shiftRatio = offD > maxShift && offD > 0 ? maxShift / offD : 1;
      const sx = offX * shiftRatio;
      const sy = offY * shiftRatio;
      this._torchAnchorShift = { x: sx, y: sy };
      this.torchCenter = {
        x: boxCx + sx,
        y: boxCy + sy,
      };
      if (this.torchStickRingEl) {
        this.torchStickRingEl.style.transform = `translate(${sx}px, ${sy}px)`;
      }
      updateTorch(e.clientX, e.clientY);
    });

    this.torchStickBaseEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.torchPointerId) return;
      e.preventDefault();
      updateTorch(e.clientX, e.clientY);
    });

    const release = (e) => {
      if (e.pointerId !== this.torchPointerId) return;
      this.resetTorchStick();
    };

    this.torchStickBaseEl.addEventListener('pointerup', release);
    this.torchStickBaseEl.addEventListener('pointercancel', release);
    this.torchStickBaseEl.addEventListener('lostpointercapture', release);
  }

  resetTorchStick() {
    this.torchPointerId = null;
    this.torchVec.x = 0;
    this.torchVec.y = 0;
    this.torchVec.active = false;
    this._torchAnchorShift = { x: 0, y: 0 };
    if (this.torchStickKnobEl) {
      this.torchStickKnobEl.style.transform = 'translate(0px, 0px)';
    }
    if (this.torchStickRingEl) {
      this.torchStickRingEl.style.transform = 'translate(0px, 0px)';
    }
    this.torchStickBaseEl?.classList.remove('aiming');
  }

  getTorchAim() {
    if (this.torchVec.active) {
      return {
        active: true,
        x: this.torchVec.x,
        y: this.torchVec.y,
        angle: Math.atan2(this.torchVec.y, this.torchVec.x),
      };
    }
    if (this._gpTorchVec.active) {
      return {
        active: true,
        x: this._gpTorchVec.x,
        y: this._gpTorchVec.y,
        angle: Math.atan2(this._gpTorchVec.y, this._gpTorchVec.x),
      };
    }
    return { active: false, x: 0, y: 0, angle: null };
  }

  setTouchRewindHeld(held) {
    this._touchRewindHeld = Boolean(held);
  }

  resetAll() {
    this.keys.clear();
    this._touchRewindHeld = false;
    this._gpRewindHeld = false;
    this.resetStick();
    this.resetTorchStick();
  }

  isRewindHeld() {
    return this.keys.has('KeyR') || this._gpRewindHeld || this._touchRewindHeld;
  }

  _pollGamepad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      this._gpRewindHeld = false;
      return { x: 0, y: 0 };
    }
    let pads;
    try {
      pads = navigator.getGamepads();
    } catch {
      return { x: 0, y: 0 };
    }
    let gp = null;
    if (pads) {
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          gp = pads[i];
          break;
        }
      }
    }
    if (!gp) {
      this._gpRewindHeld = false;
      this._gpTorchVec.active = false;
      this._prevGpButtons.length = 0;
      return { x: 0, y: 0 };
    }

    const pressed = (idx) => Boolean(gp.buttons?.[idx]?.pressed);
    const justPressed = (idx) => pressed(idx) && !this._prevGpButtons[idx];

    // Standard Gamepad mapping (Xbox / PS / Backbone / Steam Deck)
    if (justPressed(0)) {
      // A / Cross: contextual Wreck Action if available, else Recommended Gas Switch
      if (!this.onWreckAction?.()) this.onRecommendedGasSwitch?.();
    }
    if (justPressed(1)) this.onReelToggle?.(); // B / Circle
    if (justPressed(2)) this.onRecommendedGasSwitch?.(); // X / Square
    if (justPressed(3)) this.onTorchToggle?.(); // Y / Triangle
    if (justPressed(5)) this.onWreckAction?.(); // RB / R1
    if (justPressed(7)) this.onDpvToggle?.(); // RT / R2 -> DPV Scooter Toggle
    if (justPressed(8) || justPressed(11)) this.onSonarPing?.(); // Select/View or R3 -> Sonar Ping
    if (justPressed(10)) this.onMinimapToggle?.(); // L3 -> Toggle Sonar Minimap
    if (justPressed(9)) this.onPauseToggle?.(); // Start / Options
    if (justPressed(4)) this.onReelRewind?.(); // LB / L1
    this._gpRewindHeld = pressed(4);

    // Save button states for edge detection
    const bLen = gp.buttons?.length || 0;
    for (let i = 0; i < bLen; i++) {
      this._prevGpButtons[i] = Boolean(gp.buttons[i]?.pressed);
    }

    // Left stick + D-pad swimming with 0.14 deadzone & LT slow frog-kick precision
    let gx = gp.axes?.[0] || 0;
    let gy = gp.axes?.[1] || 0;
    const rawMag = Math.hypot(gx, gy);
    if (rawMag <= 0.14) {
      gx = 0;
      gy = 0;
    } else {
      const scaled = Math.pow(Math.min(1, (rawMag - 0.14) / 0.86), 1.35);
      gx = (gx / rawMag) * scaled;
      gy = (gy / rawMag) * scaled;
    }
    if (pressed(12)) gy -= 1; // D-pad Up
    if (pressed(13)) gy += 1; // D-pad Down
    if (pressed(14)) gx -= 1; // D-pad Left
    if (pressed(15)) gx += 1; // D-pad Right

    const ltVal = gp.buttons?.[6]?.value ?? (pressed(6) ? 1 : 0);
    const precision = ltVal > 0.35 ? 0.45 : 1.0;

    // Right stick (axes 2, 3) temporarily overrides flashlight aim direction
    const rx = gp.axes?.[2] || 0;
    const ry = gp.axes?.[3] || 0;
    const rMag = Math.hypot(rx, ry);
    if (rMag > 0.22) {
      this._gpTorchVec.x = rx / rMag;
      this._gpTorchVec.y = ry / rMag;
      this._gpTorchVec.active = true;
    } else {
      this._gpTorchVec.active = false;
    }

    return { x: gx * precision, y: gy * precision };
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

    const gpVec = this._pollGamepad();
    x += gpVec.x;
    y += gpVec.y;

    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }

    return { x, y };
  }
}
