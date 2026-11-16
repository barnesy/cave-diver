/**
 * Procedural Web Audio synthesizer for dive computer alarms, regulator gas switch,
 * checkpoint chimes, and subtle underwater bubble feedback.
 */

export class DiveAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastAlarmAt = 0;
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  playTone(freq, duration, type = 'sine', gainVal = 0.08, delay = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainVal, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playGasSwitch() {
    this.unlock();
    this.playTone(620, 0.07, 'triangle', 0.08, 0);
    this.playTone(880, 0.09, 'sine', 0.07, 0.06);
  }

  playCheckpoint() {
    this.unlock();
    this.playTone(523.25, 0.14, 'sine', 0.09, 0);
    this.playTone(659.25, 0.16, 'sine', 0.09, 0.09);
    this.playTone(783.99, 0.22, 'sine', 0.09, 0.18);
  }

  playCollect() {
    this.unlock();
    this.playTone(783.99, 0.11, 'triangle', 0.09, 0);
    this.playTone(1046.5, 0.14, 'sine', 0.09, 0.06);
    this.playTone(1318.5, 0.2, 'sine', 0.075, 0.12);
  }

  playVictoryFanfare() {
    this.unlock();
    this.playTone(523.25, 0.16, 'triangle', 0.09, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.09, 0.11);
    this.playTone(783.99, 0.18, 'sine', 0.095, 0.22);
    this.playTone(1046.5, 0.28, 'sine', 0.1, 0.34);
    this.playTone(1318.5, 0.42, 'triangle', 0.08, 0.46);
  }

  playImpact() {
    this.unlock();
    this.playTone(95, 0.18, 'triangle', 0.12, 0);
    this.playTone(62, 0.22, 'sine', 0.1, 0.04);
  }

  playAlarm(level) {
    const now = performance.now();
    const interval = level === 'critical' ? 850 : 2200;
    if (now - this.lastAlarmAt < interval) return;
    this.lastAlarmAt = now;

    if (level === 'critical') {
      this.playTone(1760, 0.11, 'square', 0.06, 0);
      this.playTone(1320, 0.11, 'square', 0.06, 0.14);
      this.playTone(1760, 0.11, 'square', 0.06, 0.28);
    } else {
      this.playTone(1180, 0.1, 'triangle', 0.05, 0);
    }
  }
}
