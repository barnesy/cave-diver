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
    this.masterFilter = null;
    this.masterGain = null;
    this._lastFilterHz = 18000;
    this._ambienceTimer = 4.0;
    this._lastSplashAt = 0;
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
    if (!this.ctx || this.ctx.state !== 'running') return;
    const mf = this._ensureMasterFilter();
    if (!mf) return;
    // Surface air = crisp 18kHz; shallow submerged = 4.2kHz; deep/narcotic = warm muffled 1.15kHz
    let targetHz = 18000;
    if (depthM > 0.65) {
      const depthFrac = Math.min(1, (depthM - 0.65) / 140);
      const narcFrac = Math.min(1, Math.max(0, narcosisLevel || 0));
      targetHz = Math.max(1050, 4400 - depthFrac * 2400 - narcFrac * 950);
    }
    if (Math.abs(targetHz - this._lastFilterHz) < 15 && targetHz !== 18000) return;
    this._lastFilterHz = targetHz;
    try {
      mf.frequency.setTargetAtTime(targetHz, this.ctx.currentTime, 0.16);
    } catch {}
  }

  resetEnvironmentFilter() {
    this._lastFilterHz = -1;
    this.setEnvironmentFilter(0, 0);
  }

  _ensureMasterFilter() {
    if (!this.ctx) return null;
    if (!this.masterGain) {
      const mg = this.ctx.createGain();
      mg.gain.value = this.muted ? 0.0001 : 1.0;
      mg.connect(this.ctx.destination);
      this.masterGain = mg;
    }
    if (!this.masterFilter) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 18000;
      filt.Q.value = 0.65;
      filt.connect(this.masterGain);
      this.masterFilter = filt;
    }
    return this.masterFilter;
  }

  vibrate(pattern) {
    if (this.muted || !this.hapticsEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {}
  }

  unlock({ autoStartRadio = true } = {}) {
    if (this.muted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    this._ensureMasterFilter();
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
    if (autoStartRadio && this.ctx && this.radio.trackIndex > 0 && !this.radio._timer) {
      this.radio.start();
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.radio.syncMuted(this.muted);
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0.0001 : 1.0, this.ctx.currentTime, 0.03);
      } catch {}
    }
  }

  cycleRadioTrack() {
    if (this.muted) this.setMuted(false);
    this.unlock({ autoStartRadio: false });
    const nextTrack = this.radio.cycleTrack();
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().then(() => {
        if (this.radio.trackIndex > 0 && !this.radio._timer) this.radio.start();
      }).catch(() => {});
    }
    return nextTrack;
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
    gain.connect(this.masterFilter || this.ctx.destination);
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };
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
    const dur = Math.max(0.45, Math.min(1.45, (ev?.durationSec ?? 0.95) * 0.96));
    const depthM = ev?.depthM ?? 10;
    const now = performance.now();
    if (now - this.lastInhaleAt < Math.max(260, dur * 580)) return;
    this.lastInhaleAt = now;

    const noise = this._getNoiseBuffer();
    if (!noise) return;
    const t = this.ctx.currentTime;
    const dest = this.masterFilter || this.ctx.destination;

    // Warm, meditative two-layer regulator inhale:
    // Layer 1: Soft low-passed chamber resonance (warm lung/mouthpiece body, no harsh 2kHz sibilance)
    // Layer 2: Feather-soft velvet airflow whisper that only brightens slightly under real panic
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const depthMuffle = Math.max(0.72, 1 - Math.min(120, depthM) / 380);
    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    const bodyPeakHz = (560 + intensity * 140 + panic * 150) * depthMuffle;
    bodyFilter.frequency.setValueAtTime(Math.max(220, bodyPeakHz * 0.64), t);
    bodyFilter.frequency.exponentialRampToValueAtTime(Math.max(260, bodyPeakHz), t + dur * 0.42);
    bodyFilter.frequency.exponentialRampToValueAtTime(Math.max(200, bodyPeakHz * 0.56), t + dur);
    bodyFilter.Q.value = 0.85;

    const bodyGain = this.ctx.createGain();
    const peak = Math.min(0.044, 0.017 + intensity * 0.014 + panic * 0.01);
    const riseEnd = t + Math.max(0.14, dur * 0.32);
    const holdEnd = t + dur * 0.62;
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(peak, riseEnd);
    bodyGain.gain.linearRampToValueAtTime(peak * 0.88, holdEnd);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // Layer 2: Wide, gentle airflow texture well below piercing frequencies
    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    const airFreq = (820 + intensity * 190 + panic * 260) * depthMuffle;
    airFilter.frequency.setValueAtTime(airFreq * 0.9, t);
    airFilter.frequency.exponentialRampToValueAtTime(airFreq * 1.06, t + dur * 0.42);
    airFilter.frequency.exponentialRampToValueAtTime(airFreq * 0.84, t + dur);
    airFilter.Q.value = 0.9 + panic * 0.35;

    const airGain = this.ctx.createGain();
    const airPeak = peak * (0.28 + panic * 0.22);
    airGain.gain.setValueAtTime(0.0001, t);
    airGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, airPeak), riseEnd);
    airGain.gain.linearRampToValueAtTime(Math.max(0.0002, airPeak * 0.82), holdEnd);
    airGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(dest);

    src.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(dest);

    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { bodyFilter.disconnect(); } catch {}
      try { bodyGain.disconnect(); } catch {}
      try { airFilter.disconnect(); } catch {}
      try { airGain.disconnect(); } catch {}
    };
    src.start(t, Math.random() * 0.6);
    src.stop(t + dur + 0.05);
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

    // LFO creates distinct underwater bubble-pocket cadence (enveloped cleanly to prevent onset/tail clicks)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    const lfoRate = 12.5 + intensity * 5.5 + panic * 6.0;
    lfo.frequency.setValueAtTime(lfoRate * 1.15, t);
    lfo.frequency.linearRampToValueAtTime(lfoRate * 0.72, t + dur);

    const lfoGain = this.ctx.createGain();
    const peak = Math.min(0.088, 0.036 + intensity * 0.026 + panic * 0.02);
    const attackEnd = t + Math.min(0.09, dur * 0.14);
    lfoGain.gain.setValueAtTime(0.0001, t);
    lfoGain.gain.exponentialRampToValueAtTime(peak * 0.34, attackEnd);
    lfoGain.gain.linearRampToValueAtTime(peak * 0.28, t + dur * 0.55);
    lfoGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, t);
    envGain.gain.exponentialRampToValueAtTime(peak, attackEnd);
    envGain.gain.linearRampToValueAtTime(peak * 0.86, t + dur * 0.55);
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
    envGain.connect(this.masterFilter || this.ctx.destination);

    src.connect(fizzFilter);
    fizzFilter.connect(fizzGain);
    fizzGain.connect(this.masterFilter || this.ctx.destination);

    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { lfo.disconnect(); } catch {}
      try { lfoGain.disconnect(); } catch {}
      try { envGain.disconnect(); } catch {}
      try { fizzFilter.disconnect(); } catch {}
      try { fizzGain.disconnect(); } catch {}
    };

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
      g.connect(this.masterFilter || this.ctx.destination);
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

  /**
   * Deep resonant metallic ship-hull groan caused by ocean currents flexing sunken steel.
   */
  playHullGroan(depthRatio = 0.5) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const dur = 1.9 + Math.random() * 1.1;
    const baseFreq = 46 + (1 - Math.min(1, Math.max(0, depthRatio))) * 22 + Math.random() * 10;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, t + dur);
    osc2.frequency.setValueAtTime(baseFreq * 1.51, t);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.19, t + dur);

    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(165, t);
    filt.frequency.exponentialRampToValueAtTime(92, t + dur);
    filt.Q.value = 4.2;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(g);
    g.connect(this.masterFilter || this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  /**
   * Rhythmic brass ratchet tick while cranking a rusted watertight bulkhead hatch wheel.
   */
  playHatchCrank(progress = 0.5) {
    this.unlock();
    const pitch = 210 + progress * 160;
    this.playTone(pitch, 0.055, 'sawtooth', 0.05, 0);
    this.playTone(pitch * 1.48, 0.04, 'triangle', 0.04, 0.03);
    this.vibrate(14);
  }

  /**
   * Heavy iron bulkhead door unsealing + pressurized trapped bubble burst.
   */
  playHatchOpen() {
    this.unlock();
    this.playTone(112, 0.28, 'sawtooth', 0.08, 0);
    this.playTone(74, 0.38, 'triangle', 0.09, 0.06);
    this.playTone(440, 0.16, 'sine', 0.06, 0.18);
    this.playTone(587.3, 0.24, 'sine', 0.065, 0.26);
    const noise = this._getNoiseBuffer();
    if (noise && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(520, t);
      filt.frequency.exponentialRampToValueAtTime(190, t + 0.42);
      filt.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.075, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.masterFilter || this.ctx.destination);
      src.start(t);
      src.stop(t + 0.45);
    }
    this.vibrate([26, 20, 35]);
  }

  /**
   * Crisp titanium shears snip when cutting free from a trawler net or cable snag.
   */
  playLineCut() {
    this.unlock();
    this.playTone(1480, 0.045, 'sawtooth', 0.07, 0);
    this.playTone(2150, 0.06, 'triangle', 0.065, 0.025);
    this.playTone(620, 0.11, 'sine', 0.055, 0.06);
    this.vibrate([18, 15, 22]);
  }

  /**
   * Stainless bolt-snap clack when clipping onto or unclipping from the open-water shot line.
   */
  playClipLine(clipped = true) {
    this.unlock();
    if (clipped) {
      this.playTone(860, 0.045, 'triangle', 0.065, 0);
      this.playTone(1240, 0.065, 'sine', 0.06, 0.035);
    } else {
      this.playTone(1040, 0.045, 'triangle', 0.055, 0);
      this.playTone(720, 0.06, 'sine', 0.05, 0.03);
    }
    this.vibrate(16);
  }

  /**
   * Water-entry plunge splash (descending) or surface-break wash (emerging).
   */
  playSplash(submerging = true) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this._lastSplashAt < 900) return;
    this._lastSplashAt = now;

    const noise = this._getNoiseBuffer();
    if (!noise) return;
    const t = this.ctx.currentTime;
    const dur = submerging ? 0.58 : 0.42;

    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(submerging ? 1450 : 620, t);
    filt.frequency.exponentialRampToValueAtTime(submerging ? 260 : 1280, t + dur);
    filt.Q.value = 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(submerging ? 0.085 : 0.055, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain || this.ctx.destination);
    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { filt.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
    };
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.04);

    if (submerging) {
      this.playTone(145, 0.24, 'sine', 0.045, 0.02);
      this.vibrate(18);
    }
  }

  /**
   * Subtle procedural biome-specific underwater acoustics while submerged:
   * - Caves: resonant karst cavern water-drip echoes & deep aquifer hush
   * - Shipwrecks: deep oceanic swell sub-thrum
   * - Geothermal / Glacial Iceland: mineral vent crackle or crystalline ice-creak chime
   */
  stepAmbience(dt, level, depthM = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running' || !level || depthM < 2.2) return;
    this._ambienceTimer -= dt;
    if (this._ambienceTimer > 0) return;

    const style = level.theme?.surfaceStyle || '';
    const isGlacier = style === 'kverkfjoll-glacier' || style === 'aurora-basalt';
    const hasVents = Array.isArray(level.geothermalVents) && level.geothermalVents.length > 0;

    if (level.isWreck) {
      // Gentle low ocean swell sub-thrum
      this._ambienceTimer = 6.5 + Math.random() * 6.0;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const f = 44 + Math.random() * 14;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.82, t + 2.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      osc.connect(g);
      g.connect(this.masterFilter || this.ctx.destination);
      osc.onended = () => {
        try { osc.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
      };
      osc.start(t);
      osc.stop(t + 2.25);
    } else if (isGlacier && Math.random() < 0.55) {
      // Crystalline subglacial ice groan & harmonic shimmer
      this._ambienceTimer = 5.5 + Math.random() * 5.5;
      const f = 540 + Math.random() * 420;
      this.playTone(f, 0.55, 'sine', 0.018, 0);
      this.playTone(f * 1.498, 0.72, 'triangle', 0.012, 0.08);
    } else if (hasVents && Math.random() < 0.55) {
      // Delicate hydrothermal mineral hiss burst
      this._ambienceTimer = 4.2 + Math.random() * 4.0;
      const noise = this._getNoiseBuffer();
      if (noise) {
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = noise;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 640 + Math.random() * 380;
        filt.Q.value = 3.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.018, t + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
        src.connect(filt);
        filt.connect(g);
        g.connect(this.masterFilter || this.ctx.destination);
        src.onended = () => {
          try { src.disconnect(); } catch {}
          try { filt.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
        };
        src.start(t, Math.random() * 0.5);
        src.stop(t + 1.3);
      }
    } else {
      // Resonant karst cave water-drip echo (two soft descending droplets)
      this._ambienceTimer = 5.2 + Math.random() * 6.5;
      const base = 680 + Math.random() * 480;
      this.playTone(base, 0.14, 'sine', 0.016, 0);
      this.playTone(base * 1.18, 0.18, 'sine', 0.01, 0.14);
    }
  }

  /**
   * Hydrophone Cave Sonar ping + soft delayed cavern echo.
   */
  playSonarPing() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone(1480, 0.24, 'sine', 0.068, 0);
    this.playTone(1468, 0.34, 'sine', 0.026, 0.26);
    this.playTone(1455, 0.38, 'sine', 0.012, 0.56);
    this.vibrate?.(18);
  }

  /**
   * Subtle electric DPV underwater scooter propeller thrumming pulse.
   */
  playDpvHum(intensity = 0.7) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const baseHz = 96 + Math.min(1, Math.max(0, intensity)) * 42;
    osc.frequency.setValueAtTime(baseHz, t);
    osc.frequency.exponentialRampToValueAtTime(baseHz * 1.08, t + 0.14);
    osc.frequency.exponentialRampToValueAtTime(baseHz * 0.96, t + 0.26);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.024, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(g);
    g.connect(this.masterFilter || this.ctx.destination);
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
    };
    osc.start(t);
    osc.stop(t + 0.28);
  }

  /**
   * Whisper-quiet CCR Rebreather O2 solenoid micro-tick (replaces loud open-circuit exhaust bubbles).
   */
  playCcrSolenoid() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone(920, 0.035, 'sine', 0.018, 0);
    this.playTone(1340, 0.025, 'triangle', 0.012, 0.03);
  }

  /**
   * Underwater twin-strobe camera mechanical shutter click + optional subject/discovery chime.
   */
  playCameraShutter(captured = false, isNew = false) {
    this.unlock();
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    // Crisp dual-blade shutter snap
    this.playTone(2100, 0.022, 'square', 0.045, 0);
    this.playTone(980, 0.03, 'triangle', 0.055, 0.024);
    if (captured) {
      if (isNew) {
        // Bright 3-note Field Guide discovery fanfare
        this.playTone(784, 0.09, 'sine', 0.055, 0.07);
        this.playTone(1046.5, 0.1, 'sine', 0.06, 0.14);
        this.playTone(1318.5, 0.16, 'triangle', 0.065, 0.22);
      } else {
        this.playTone(880, 0.075, 'sine', 0.042, 0.07);
        this.playTone(1174.6, 0.11, 'sine', 0.045, 0.13);
      }
    }
    this.vibrate?.(captured ? 22 : 12);
  }

  /**
   * Atmospheric chime for dynamic encounters: deep pelagic whale-like swell or crisp Survey Beacon salvage ping.
   */
  playEncounterChime(kind = 'beacon') {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    if (kind === 'beacon') {
      this.playTone(1180, 0.09, 'sine', 0.055, 0);
      this.playTone(1568, 0.14, 'triangle', 0.06, 0.085);
      this.vibrate?.(24);
      return;
    }
    if (kind === 'buddy-ping') {
      this.playTone(784, 0.11, 'sine', 0.048, 0);
      this.playTone(1174.6, 0.15, 'sine', 0.052, 0.11);
      this.vibrate?.(16);
      return;
    }
    // Deep majestic sub-harmonic ocean glide swell (Whale Shark / Manta Ray / Bioluminescent Swarm)
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f0 = kind === 'biolum-swarm' ? 390 : 122;
    const f1 = kind === 'biolum-swarm' ? 520 : 88;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 1.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.042, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(g);
    g.connect(this.masterFilter || this.ctx.destination);
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
    };
    osc.start(t);
    osc.stop(t + 1.24);
  }
}
