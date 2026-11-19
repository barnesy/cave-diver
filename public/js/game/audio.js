/**
 * Procedural Web Audio synthesizer for dive computer alarms, regulator gas switch,
 * checkpoint chimes, and subtle underwater bubble feedback.
 */

import { AquaticRadio } from './aquaticRadio.js';

export class DiveAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastAlarmAt = 0;
    this.lastExhaleAt = 0;
    this.lastHeartAt = 0;
    this._noiseBuffer = null;
    this.hapticsEnabled = true;
    this.radio = new AquaticRadio(() => this.ctx, { isMutedFn: () => this.muted });
  }

  _getNoiseBuffer() {
    if (!this.ctx) return null;
    if (this._noiseBuffer) return this._noiseBuffer;
    const len = Math.floor(this.ctx.sampleRate * 0.55);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.96 * b0 + white * 0.04;
      b1 = 0.82 * b1 + white * 0.18;
      data[i] = (b0 + b1) * 1.4;
    }
    this._noiseBuffer = buf;
    return buf;
  }

  setEnvironmentFilter(depthM = 0, narcosisLevel = 0) {
    this.radio.setDepthMuffle?.(depthM, narcosisLevel);
  }

  vibrate(pattern) {
    if (this.muted || !this.hapticsEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {}
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
    if (this.ctx && this.radio.trackIndex > 0 && !this.radio._timer) {
      this.radio.start();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.radio.syncMuted(muted);
  }

  cycleRadioTrack() {
    if (this.muted) this.setMuted(false);
    this.unlock();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (this.radio.trackIndex > 0) this.radio.start();
      }).catch(() => {});
    }
    return this.radio.cycleTrack();
  }

  setRadioTrackIndex(idx) {
    return this.radio.setTrackIndex(idx);
  }

  getRadioButtonLabel() {
    return this.radio.getButtonLabel();
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
    this.vibrate(18);
  }

  playReelClick() {
    this.unlock();
    this.playTone(1420, 0.035, 'square', 0.035, 0);
    this.vibrate(12);
  }

  playGasShare() {
    this.unlock();
    this.playTone(480, 0.11, 'sine', 0.07, 0);
    this.playTone(740, 0.14, 'triangle', 0.075, 0.08);
    this.vibrate([20, 25, 20]);
  }

  playRegulatorExhale(exertion = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this.lastExhaleAt < 950) return;
    this.lastExhaleAt = now;
    const noise = this._getNoiseBuffer();
    if (!noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const centerFreq = 380 + Math.min(240, exertion * 180);
    filter.frequency.setValueAtTime(centerFreq, t);
    filter.frequency.exponentialRampToValueAtTime(centerFreq * 0.62, t + 0.34);
    filter.Q.value = 1.8;
    const gain = this.ctx.createGain();
    const peak = 0.045 + Math.min(0.035, exertion * 0.03);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    src.stop(t + 0.42);
  }

  playHeartbeat(bpm = 135) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running' || bpm < 130) return;
    const now = performance.now();
    const minMs = Math.max(260, (60000 / bpm) * 0.85);
    if (now - this.lastHeartAt < minMs) return;
    this.lastHeartAt = now;
    const stress = Math.min(1, (bpm - 125) / 60);
    const vol = 0.035 + stress * 0.045;
    this.playTone(58, 0.09, 'sine', vol, 0);
    this.playTone(46, 0.11, 'sine', vol * 0.82, 0.12);
  }

  playSignal() {
    this.unlock();
    this.playTone(987.77, 0.08, 'sine', 0.075, 0);
    this.playTone(1318.5, 0.12, 'sine', 0.065, 0.08);
    this.vibrate(15);
  }

  playRecovery() {
    this.unlock();
    this.playTone(392.0, 0.18, 'triangle', 0.09, 0);
    this.playTone(523.25, 0.2, 'sine', 0.09, 0.12);
    this.playTone(783.99, 0.32, 'sine', 0.095, 0.24);
    this.vibrate([24, 30, 36]);
  }

  playFatality() {
    this.unlock();
    this.playTone(146.83, 0.42, 'triangle', 0.11, 0);
    this.playTone(98.0, 0.65, 'sine', 0.12, 0.24);
    this.playTone(440.0, 0.55, 'sine', 0.04, 0.55);
    this.vibrate([90, 60, 140]);
  }

  playCheckpoint() {
    this.unlock();
    this.playTone(523.25, 0.14, 'sine', 0.09, 0);
    this.playTone(659.25, 0.16, 'sine', 0.09, 0.09);
    this.playTone(783.99, 0.22, 'sine', 0.09, 0.18);
    this.vibrate([16, 20, 16]);
  }

  playCollect() {
    this.unlock();
    this.playTone(783.99, 0.11, 'triangle', 0.09, 0);
    this.playTone(1046.5, 0.14, 'sine', 0.09, 0.06);
    this.playTone(1318.5, 0.2, 'sine', 0.075, 0.12);
    this.vibrate(22);
  }

  playVictoryFanfare() {
    this.unlock();
    this.playTone(523.25, 0.16, 'triangle', 0.09, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.09, 0.11);
    this.playTone(783.99, 0.18, 'sine', 0.095, 0.22);
    this.playTone(1046.5, 0.28, 'sine', 0.1, 0.34);
    this.playTone(1318.5, 0.42, 'triangle', 0.08, 0.46);
    this.vibrate([25, 35, 25, 45]);
  }

  playImpact(impactSpeed = 1.8) {
    this.unlock();
    const intensity = Math.max(0.4, Math.min(1.5, impactSpeed / 2.2));
    this.playTone(88 + intensity * 18, 0.16, 'triangle', 0.09 * intensity, 0);
    this.playTone(56, 0.22, 'sine', 0.085 * intensity, 0.035);
    // Short filtered limestone scrape/crunch transient
    const noise = this._getNoiseBuffer();
    if (noise && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 320 + intensity * 260;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05 * intensity, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
      src.stop(t + 0.16);
    }
    this.vibrate(Math.round(24 + intensity * 18));
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
      this.vibrate([55, 40, 55]);
    } else {
      this.playTone(1180, 0.1, 'triangle', 0.05, 0);
      this.vibrate(25);
    }
  }
}
