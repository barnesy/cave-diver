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
    this.lastInhaleAt = 0;
    this.lastExhaleAt = 0;
    this.lastHeartAt = 0;
    this._noiseBuffer = null;
    this.hapticsEnabled = true;
    this.radio = new AquaticRadio(() => this.ctx, { isMutedFn: () => this.muted });
  }

  _getNoiseBuffer() {
    if (!this.ctx) return null;
    if (this._noiseBuffer) return this._noiseBuffer;
    const len = Math.floor(this.ctx.sampleRate * 1.85);
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

  playRegulatorInhale(ev = {}) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const intensity = typeof ev === 'number' ? Math.max(0.3, Math.min(1.4, ev)) : (ev.intensity ?? 0.5);
    const panic = typeof ev === 'object' && ev ? (ev.panic ?? 0) : 0;
    const dur = Math.max(0.32, Math.min(1.35, (ev?.durationSec ?? 0.85) * 0.92));
    const depthM = ev?.depthM ?? 10;
    const now = performance.now();
    if (now - this.lastInhaleAt < Math.max(240, dur * 600)) return;
    this.lastInhaleAt = now;

    const noise = this._getNoiseBuffer();
    if (!noise) return;
    const t = this.ctx.currentTime;

    // Crisp demand-valve diaphragm hiss (higher & sharper during rapid panicked gasps)
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const depthMuffle = Math.max(0.72, 1 - Math.min(120, depthM) / 380);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = (1480 + intensity * 460 + panic * 420) * depthMuffle;
    filter.frequency.setValueAtTime(baseFreq * 0.88, t);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 1.12, t + dur * 0.35);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, t + dur);
    filter.Q.value = 2.4 + panic * 0.8;

    const gain = this.ctx.createGain();
    const peak = Math.min(0.052, 0.016 + intensity * 0.018 + panic * 0.014);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.11, dur * 0.22));
    gain.gain.setValueAtTime(peak * 0.92, t + dur * 0.72);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t, Math.random() * 0.6);
    src.stop(t + dur + 0.04);
  }

  playRegulatorExhale(ev = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const isObj = typeof ev === 'object' && ev !== null;
    const intensity = isObj ? (ev.intensity ?? 0.5) : Math.max(0.35, Math.min(1.4, 0.4 + ev * 0.7));
    const panic = isObj ? (ev.panic ?? 0) : 0;
    const depthM = isObj ? (ev.depthM ?? 15) : 15;
    const dur = Math.max(0.45, Math.min(1.8, (isObj && ev.durationSec ? ev.durationSec : 0.95) * 0.95));
    const now = performance.now();
    if (now - this.lastExhaleAt < Math.max(280, dur * 550)) return;
    this.lastExhaleAt = now;

    const noise = this._getNoiseBuffer();
    if (!noise) return;
    const t = this.ctx.currentTime;
    const depthMuffle = Math.max(0.68, 1 - Math.min(150, depthM) / 420);

    // Layer 1: Low-mid pressurized bubble exhaust rumble with organic LFO burble modulation
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const centerFreq = (300 + intensity * 140 + panic * 110) * depthMuffle;
    filter.frequency.setValueAtTime(centerFreq * 1.15, t);
    filter.frequency.exponentialRampToValueAtTime(centerFreq * 0.62, t + dur);
    filter.Q.value = 1.6;

    // LFO creates distinct underwater bubble-pocket cadence (faster & rougher under panic)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    const lfoRate = 12.5 + intensity * 5.5 + panic * 6.0;
    lfo.frequency.setValueAtTime(lfoRate * 1.15, t);
    lfo.frequency.linearRampToValueAtTime(lfoRate * 0.72, t + dur);

    const lfoGain = this.ctx.createGain();
    const peak = Math.min(0.088, 0.036 + intensity * 0.026 + panic * 0.02);
    lfoGain.gain.setValueAtTime(peak * 0.34, t);

    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, t);
    envGain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.09, dur * 0.14));
    envGain.gain.setValueAtTime(peak * 0.86, t + dur * 0.55);
    envGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // Layer 2: Higher effervescent bubble-pop fizz band
    const fizzFilter = this.ctx.createBiquadFilter();
    fizzFilter.type = 'bandpass';
    fizzFilter.frequency.setValueAtTime((780 + panic * 320) * depthMuffle, t);
    fizzFilter.frequency.exponentialRampToValueAtTime((520 + panic * 160) * depthMuffle, t + dur);
    fizzFilter.Q.value = 3.2;

    const fizzGain = this.ctx.createGain();
    const fizzPeak = peak * (0.34 + panic * 0.22);
    fizzGain.gain.setValueAtTime(0.0001, t);
    fizzGain.gain.exponentialRampToValueAtTime(fizzPeak, t + Math.min(0.12, dur * 0.2));
    fizzGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(envGain);
    lfo.connect(lfoGain);
    lfoGain.connect(envGain.gain);
    envGain.connect(this.ctx.destination);

    src.connect(fizzFilter);
    fizzFilter.connect(fizzGain);
    fizzGain.connect(this.ctx.destination);

    src.start(t, Math.random() * 0.8);
    lfo.start(t);
    src.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
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
