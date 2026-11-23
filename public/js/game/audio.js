/**
 * Procedural Web Audio synthesizer for dive computer alarms, regulator gas switch,
 * checkpoint chimes, and subtle underwater bubble feedback.
 */

import { AquaticRadio } from './aquaticRadio.js';

/**
 * Named mobile haptic feedback vibration patterns (ms) — v133.
 */
export const HAPTIC_PRESETS = Object.freeze({
  impact: [36, 20, 18],
  sonar: [18, 35, 12],
  alarm: [45, 50, 45],
  critical: [75, 40, 75, 40, 90],
  signal: [14, 24, 14],
  drill: [55, 35, 55],
  stage: [22],
  photo: [12],
  checkpoint: [16, 20, 24],
  test: [16, 40, 22],
  valve: [14, 24, 18, 28, 12],
  liftbag: [24, 30, 18],
  action: [15],
});

/**
 * Pure 2D-to-stereo spatial underwater audio calculator (v133).
 * Maps world-space source coordinates relative to the diver into stereo pan [-0.92..+0.92]
 * and smooth distance-attenuated gain [0..1].
 */
export function computeSpatialMix(listenerX, listenerY, sourceX, sourceY, { maxDistM = 36 } = {}) {
  const dx = (Number(sourceX) || 0) - (Number(listenerX) || 0);
  const dy = (Number(sourceY) || 0) - (Number(listenerY) || 0);
  const dist = Math.hypot(dx, dy);
  const maxD = Math.max(4, Number(maxDistM) || 36);
  if (dist >= maxD) {
    return { pan: Math.max(-0.92, Math.min(0.92, dx / 18)), gain: 0, distanceM: Math.round(dist * 10) / 10 };
  }
  const pan = Math.max(-0.92, Math.min(0.92, dx / 18));
  const rawAtten = 1 / (1 + Math.pow(dist / 12, 1.55));
  const edgeFade = dist > maxD * 0.78 ? Math.max(0, (maxD - dist) / (maxD * 0.22)) : 1;
  const gain = Math.max(0, Math.min(1, rawAtten * edgeFade));
  return {
    pan: Math.round(pan * 1000) / 1000,
    gain: Math.round(gain * 1000) / 1000,
    distanceM: Math.round(dist * 10) / 10,
  };
}

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
    this.sfxBus = null;
    this.ambienceBus = null;
    this.sfxVolume = 0.85;
    this.ambienceVolume = 0.80;
    this.spatialEnabled = true;
    this._lastFilterHz = 18000;
    this._ambienceTimer = 4.0;
    this._lastWhaleAt = 0;
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

  setEnvironmentFilter(depthM = 0, narcosisLevel = 0, clearanceM = 4.0) {
    this.radio.setDepthMuffle?.(depthM, narcosisLevel);
    if (!this.ctx || this.ctx.state !== 'running') return;
    const mf = this._ensureMasterFilter();
    if (!mf) return;
    // Surface air = crisp 18kHz; shallow submerged = 4.2kHz; deep/narcotic = warm muffled 1.15kHz
    // Acoustic space coloration (v155): tight cave squeezes (<1.8m) feel warmer/intimate; vast caverns (>6m) open slightly
    let targetHz = 18000;
    let targetQ = 0.65;
    if (depthM > 0.65) {
      const depthFrac = Math.min(1, (depthM - 0.65) / 140);
      const narcFrac = Math.min(1, Math.max(0, narcosisLevel || 0));
      const clr = Number.isFinite(clearanceM) ? clearanceM : 4.0;
      const spaceOffset = clr < 2.0 ? -(2.0 - clr) * 260 : Math.min(480, Math.max(0, clr - 4.0) * 85);
      targetHz = Math.max(920, 4400 - depthFrac * 2400 - narcFrac * 950 + spaceOffset);
      targetQ = clr < 1.8 ? 1.15 : clr > 6.5 ? 0.55 : 0.72;
    }
    if (Math.abs(targetHz - this._lastFilterHz) < 15 && targetHz !== 18000) return;
    this._lastFilterHz = targetHz;
    try {
      mf.frequency.setTargetAtTime(targetHz, this.ctx.currentTime, 0.16);
      mf.Q.setTargetAtTime(targetQ, this.ctx.currentTime, 0.22);
    } catch {}
  }

  /**
   * Subtle atmospheric two-note discovery harmonic when illuminating a submerged lore landmark (v155).
   */
  playStoryDiscovery() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone(523.25, 0.22, 'sine', 0.036, 0, { pan: -0.18, bus: 'ambience' });
    this.playTone(783.99, 0.34, 'triangle', 0.032, 0.11, { pan: 0.18, bus: 'ambience' });
    this.vibrate?.(12);
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
    if (!this.sfxBus) {
      const sb = this.ctx.createGain();
      sb.gain.value = Math.max(0.0001, this.sfxVolume);
      sb.connect(this.masterFilter);
      this.sfxBus = sb;
    }
    if (!this.ambienceBus) {
      const ab = this.ctx.createGain();
      ab.gain.value = Math.max(0.0001, this.ambienceVolume);
      ab.connect(this.masterFilter);
      this.ambienceBus = ab;
    }
    return this.masterFilter;
  }

  _getBusNode(bus = 'sfx') {
    this._ensureMasterFilter();
    if (bus === 'ambience' && this.ambienceBus) return this.ambienceBus;
    if (this.sfxBus) return this.sfxBus;
    return this.masterFilter || this.ctx?.destination || null;
  }

  _connectSpatial(node, { pan = 0, bus = 'sfx' } = {}) {
    const dest = this._getBusNode(bus);
    if (!dest) return null;
    const clampedPan = this.spatialEnabled ? Math.max(-0.95, Math.min(0.95, Number(pan) || 0)) : 0;
    if (Math.abs(clampedPan) > 0.02 && typeof this.ctx?.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(clampedPan, this.ctx.currentTime);
      node.connect(panner);
      panner.connect(dest);
      return panner;
    }
    node.connect(dest);
    return null;
  }

  getMixerSettings() {
    return {
      sfxVolume: Math.round(this.sfxVolume * 100) / 100,
      ambienceVolume: Math.round(this.ambienceVolume * 100) / 100,
      radioVolume: Math.round((this.radio?.volume ?? 0.65) * 100) / 100,
      spatialEnabled: Boolean(this.spatialEnabled),
      hapticsEnabled: Boolean(this.hapticsEnabled),
      muted: Boolean(this.muted),
    };
  }

  setMixerSettings(opts = {}) {
    if (opts.sfxVolume !== undefined && Number.isFinite(Number(opts.sfxVolume))) {
      this.sfxVolume = Math.max(0, Math.min(1, Number(opts.sfxVolume)));
      if (this.sfxBus && this.ctx) {
        try {
          this.sfxBus.gain.setTargetAtTime(Math.max(0.0001, this.sfxVolume), this.ctx.currentTime, 0.04);
        } catch {}
      }
    }
    if (opts.ambienceVolume !== undefined && Number.isFinite(Number(opts.ambienceVolume))) {
      this.ambienceVolume = Math.max(0, Math.min(1, Number(opts.ambienceVolume)));
      if (this.ambienceBus && this.ctx) {
        try {
          this.ambienceBus.gain.setTargetAtTime(Math.max(0.0001, this.ambienceVolume), this.ctx.currentTime, 0.04);
        } catch {}
      }
    }
    if (opts.radioVolume !== undefined && Number.isFinite(Number(opts.radioVolume))) {
      this.radio?.setVolume?.(Number(opts.radioVolume));
    }
    if (typeof opts.spatialEnabled === 'boolean') {
      this.spatialEnabled = opts.spatialEnabled;
    }
    if (typeof opts.hapticsEnabled === 'boolean') {
      this.hapticsEnabled = opts.hapticsEnabled;
    }
    return this.getMixerSettings();
  }

  triggerHaptic(presetName = 'signal') {
    const pat = HAPTIC_PRESETS[presetName] || HAPTIC_PRESETS.signal;
    this.vibrate(pat);
  }

  playSpatialTestSweep() {
    if (this.muted) this.setMuted(false);
    this.unlock({ autoStartRadio: false });
    this.playTone(980, 0.16, 'sine', 0.08, 0.0, { pan: -0.82, bus: 'sfx' });
    this.playTone(1240, 0.16, 'sine', 0.085, 0.17, { pan: 0.0, bus: 'sfx' });
    this.playTone(1520, 0.22, 'triangle', 0.08, 0.34, { pan: 0.82, bus: 'sfx' });
    this.triggerHaptic('test');
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
      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
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

  playTone(freq, duration, type = 'sine', gainVal = 0.08, delay = 0, { pan = 0, bus = 'sfx' } = {}) {
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
    const panner = this._connectSpatial(gain, { pan, bus });
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      try { panner?.disconnect(); } catch {}
    };
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playGasSwitch() {
    this.unlock();
    // Bolt-snap click + brief 2nd-stage regulator purge hiss + confirmation chirp (v151)
    this.playTone(940, 0.032, 'triangle', 0.052, 0);
    this.playTone(620, 0.07, 'triangle', 0.07, 0.025);
    this.playTone(880, 0.09, 'sine', 0.065, 0.085);
    const noise = this._getNoiseBuffer();
    if (!this.muted && noise && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime + 0.02;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(1650, t);
      filt.frequency.exponentialRampToValueAtTime(780, t + 0.14);
      filt.Q.value = 2.1;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      src.connect(filt);
      filt.connect(g);
      const panner = this._connectSpatial(g, { pan: 0, bus: 'sfx' });
      src.onended = () => {
        try { src.disconnect(); } catch {}
        try { filt.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
        try { panner?.disconnect(); } catch {}
      };
      src.start(t);
      src.stop(t + 0.17);
    }
    this.vibrate(18);
  }

  playReelClick() {
    this.unlock();
    // Machined Delrin finger-spool pawl tick + nylon body resonance (v151)
    this.playTone(1360, 0.024, 'triangle', 0.042, 0);
    this.playTone(640, 0.032, 'sine', 0.028, 0.012);
    this.vibrate(10);
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
    const dest = this._getBusNode('sfx');
    if (!dest) return;

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

    const dest = this._getBusNode('sfx');
    if (!dest) return;
    src.connect(filter);
    filter.connect(envGain);
    lfo.connect(lfoGain);
    lfoGain.connect(envGain.gain);
    envGain.connect(dest);

    src.connect(fizzFilter);
    fizzFilter.connect(fizzGain);
    fizzGain.connect(dest);

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

  playSignal(pan = 0) {
    this.unlock();
    this.playTone(987.77, 0.08, 'sine', 0.075, 0, { pan, bus: 'sfx' });
    this.playTone(1318.5, 0.12, 'sine', 0.065, 0.08, { pan, bus: 'sfx' });
    this.triggerHaptic('signal');
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
      const panner = this._connectSpatial(g, { pan: 0, bus: 'sfx' });
      src.onended = () => {
        try { src.disconnect(); } catch {}
        try { filt.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
        try { panner?.disconnect(); } catch {}
      };
      src.start(t);
      src.stop(t + 0.16);
    }
    this.triggerHaptic('impact');
  }

  /** Crisp tactile Wetnotes pencil/slate click foley (v171). */
  playUiClick() {
    this.unlock();
    this.playTone(980, 0.045, 'triangle', 0.045, 0);
    this.playTone(1460, 0.035, 'sine', 0.028, 0.02);
    this.triggerHaptic('action');
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
  playHullGroan(depthRatio = 0.5, pan = 0) {
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
    const panner = this._connectSpatial(g, { pan, bus: 'ambience' });
    osc1.onended = () => {
      try { osc1.disconnect(); } catch {}
      try { osc2.disconnect(); } catch {}
      try { filt.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      try { panner?.disconnect(); } catch {}
    };

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
   * Pressurized bulkhead copper bypass valve equalization: brass handwheel ratchets,
   * pressurized water/gas bleed hiss sweeping down as hull ΔP equalizes, and gauge settle chime (v151).
   */
  playValveEqualize() {
    this.unlock();
    // Brass handwheel 3-click turn
    this.playTone(760, 0.032, 'triangle', 0.055, 0);
    this.playTone(910, 0.032, 'triangle', 0.058, 0.065);
    this.playTone(1080, 0.036, 'triangle', 0.055, 0.13);
    // Bourdon needle settled at 0 ΔP confirmation chime
    this.playTone(587.3, 0.12, 'sine', 0.05, 0.44);
    this.playTone(880, 0.16, 'sine', 0.055, 0.52);
    const noise = this._getNoiseBuffer();
    if (!this.muted && noise && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime + 0.09;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(2400, t);
      filt.frequency.exponentialRampToValueAtTime(420, t + 0.48);
      filt.Q.value = 3.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      src.connect(filt);
      filt.connect(g);
      const panner = this._connectSpatial(g, { pan: 0, bus: 'sfx' });
      src.onended = () => {
        try { src.disconnect(); } catch {}
        try { filt.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
        try { panner?.disconnect(); } catch {}
      };
      src.start(t);
      src.stop(t + 0.52);
    }
    this.triggerHaptic('valve');
  }

  /**
   * Commercial lift-bag nylon inflation whump + LP gas fill rush, or dump-valve bubble burp (v151).
   */
  playLiftBag(inflated = true) {
    this.unlock();
    if (!this.muted && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime;
      if (inflated) {
        // Muffled nylon canopy fill "whump"
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(142, t + 0.04);
        osc.frequency.exponentialRampToValueAtTime(54, t + 0.28);
        g.gain.setValueAtTime(0.0001, t + 0.04);
        g.gain.linearRampToValueAtTime(0.11, t + 0.085);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.31);
        osc.connect(g);
        const p1 = this._connectSpatial(g, { pan: 0, bus: 'sfx' });
        osc.onended = () => {
          try { osc.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
          try { p1?.disconnect(); } catch {}
        };
        osc.start(t + 0.04);
        osc.stop(t + 0.33);

        // LP inflator gas rush into open-bottom skirt
        const noise = this._getNoiseBuffer();
        if (noise) {
          const src = this.ctx.createBufferSource();
          src.buffer = noise;
          const filt = this.ctx.createBiquadFilter();
          filt.type = 'bandpass';
          filt.frequency.setValueAtTime(1150, t);
          filt.frequency.exponentialRampToValueAtTime(340, t + 0.34);
          filt.Q.value = 1.9;
          const ng = this.ctx.createGain();
          ng.gain.setValueAtTime(0.0001, t);
          ng.gain.linearRampToValueAtTime(0.075, t + 0.04);
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
          src.connect(filt);
          filt.connect(ng);
          const p2 = this._connectSpatial(ng, { pan: 0, bus: 'sfx' });
          src.onended = () => {
            try { src.disconnect(); } catch {}
            try { filt.disconnect(); } catch {}
            try { ng.disconnect(); } catch {}
            try { p2?.disconnect(); } catch {}
          };
          src.start(t);
          src.stop(t + 0.38);
        }
        this.playTone(860, 0.045, 'triangle', 0.05, 0);
      } else {
        // Pull-cord dump valve pop + rising bubble-burp triplet
        this.playTone(320, 0.05, 'triangle', 0.06, 0);
        this.playTone(430, 0.065, 'sine', 0.055, 0.055);
        this.playTone(610, 0.075, 'sine', 0.05, 0.115);
        this.playTone(790, 0.085, 'sine', 0.04, 0.18);
      }
    }
    this.vibrate(inflated ? HAPTIC_PRESETS.liftbag : 14);
  }

  /**
   * Heavy iron bulkhead door unsealing: metallic hinge creak, deep hull-stop thud,
   * and pressurized trapped bubble burst (upgraded v151).
   */
  playHatchOpen() {
    this.unlock();
    this.playTone(112, 0.28, 'sawtooth', 0.075, 0);
    this.playTone(74, 0.38, 'triangle', 0.085, 0.06);
    this.playTone(440, 0.16, 'sine', 0.055, 0.24);
    this.playTone(587.3, 0.24, 'sine', 0.06, 0.32);
    if (!this.muted && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime;
      // Corroded iron hinge creak sweep
      const creak = this.ctx.createOscillator();
      const cFilt = this.ctx.createBiquadFilter();
      const cGain = this.ctx.createGain();
      creak.type = 'sawtooth';
      creak.frequency.setValueAtTime(192, t + 0.03);
      creak.frequency.exponentialRampToValueAtTime(116, t + 0.36);
      cFilt.type = 'lowpass';
      cFilt.frequency.value = 460;
      cGain.gain.setValueAtTime(0.0001, t + 0.03);
      cGain.gain.linearRampToValueAtTime(0.05, t + 0.12);
      cGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      creak.connect(cFilt);
      cFilt.connect(cGain);
      const cp = this._connectSpatial(cGain, { pan: 0, bus: 'sfx' });
      creak.onended = () => {
        try { creak.disconnect(); } catch {}
        try { cFilt.disconnect(); } catch {}
        try { cGain.disconnect(); } catch {}
        try { cp?.disconnect(); } catch {}
      };
      creak.start(t + 0.03);
      creak.stop(t + 0.4);

      // Deep underwater steel door-stop thud
      const thud = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(68, t + 0.22);
      thud.frequency.exponentialRampToValueAtTime(34, t + 0.48);
      tGain.gain.setValueAtTime(0.0001, t + 0.22);
      tGain.gain.linearRampToValueAtTime(0.11, t + 0.245);
      tGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      thud.connect(tGain);
      const tp = this._connectSpatial(tGain, { pan: 0, bus: 'sfx' });
      thud.onended = () => {
        try { thud.disconnect(); } catch {}
        try { tGain.disconnect(); } catch {}
        try { tp?.disconnect(); } catch {}
      };
      thud.start(t + 0.22);
      thud.stop(t + 0.52);

      const noise = this._getNoiseBuffer();
      if (noise) {
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
        const np = this._connectSpatial(g, { pan: 0, bus: 'sfx' });
        src.onended = () => {
          try { src.disconnect(); } catch {}
          try { filt.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
          try { np?.disconnect(); } catch {}
        };
        src.start(t);
        src.stop(t + 0.45);
      }
    }
    this.vibrate([26, 20, 35]);
  }

  /**
   * Crisp titanium shears dual-blade snip + snapping monofilament line twang (upgraded v151).
   */
  playLineCut() {
    this.unlock();
    this.playTone(1520, 0.036, 'sawtooth', 0.068, 0);
    this.playTone(2340, 0.048, 'triangle', 0.064, 0.018);
    if (!this.muted && this.ctx && this.ctx.state === 'running') {
      const t = this.ctx.currentTime + 0.042;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.058, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(g);
      const p = this._connectSpatial(g, { pan: 0, bus: 'sfx' });
      osc.onended = () => {
        try { osc.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
        try { p?.disconnect(); } catch {}
      };
      osc.start(t);
      osc.stop(t + 0.17);
    }
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
    this._connectSpatial(g, { pan: 0, bus: 'sfx' });
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
   * Distant, ethereal open-ocean humpback whale song (dual-harmonic pitch glide through warm lowpass).
   */
  playWhaleSong(pan = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(460, t);
    filter.Q.value = 1.2;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    const base = 135 + Math.random() * 42;
    osc1.frequency.setValueAtTime(base, t);
    osc1.frequency.exponentialRampToValueAtTime(base * 1.48, t + 1.15);
    osc1.frequency.exponentialRampToValueAtTime(base * 0.84, t + 3.1);

    osc2.frequency.setValueAtTime(base * 1.99, t);
    osc2.frequency.exponentialRampToValueAtTime(base * 2.94, t + 1.15);
    osc2.frequency.exponentialRampToValueAtTime(base * 1.66, t + 3.1);

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.linearRampToValueAtTime(0.02, t + 0.9);
    g1.gain.linearRampToValueAtTime(0.014, t + 2.1);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 3.25);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(0.007, t + 1.0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(filter);
    g2.connect(filter);
    const panner = this._connectSpatial(filter, { pan, bus: 'ambience' });
    osc1.onended = () => {
      try { osc1.disconnect(); } catch {}
      try { osc2.disconnect(); } catch {}
      try { g1.disconnect(); } catch {}
      try { g2.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { panner?.disconnect(); } catch {}
    };
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 3.3);
    osc2.stop(t + 3.3);
  }

  /**
   * Pressurized nose-exhale bubble purge when clearing a flooded dive mask (v122).
   */
  playMaskPurge() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const dur = 0.42;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.7;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(620, t);
    filt.frequency.exponentialRampToValueAtTime(1280, t + dur);
    filt.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    this._connectSpatial(g, { pan: 0, bus: 'sfx' });
    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { filt.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
    };
    src.start(t);
    src.stop(t + dur + 0.02);
    this.vibrate?.([18, 22, 16]);
  }

  /**
   * Urgent regulator free-flow gas hiss burst (v122).
   */
  playFreeFlowHiss() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const dur = 0.28;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.55;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1150, t);
    filt.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    this._connectSpatial(g, { pan: 0, bus: 'sfx' });
    src.onended = () => {
      try { src.disconnect(); } catch {}
      try { filt.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
    };
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /**
   * Crisp two-tone confirmation chime when mastering a technical failure drill (v122).
   */
  playDrillClear() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone?.(660, 0.11, 'triangle', 0.055, 0);
    this.playTone?.(990, 0.18, 'sine', 0.06, 0.09);
    this.vibrate?.([14, 18, 28]);
  }

  /**
   * Subtle procedural biome-specific underwater acoustics while submerged:
   * - Caves: 3-tap resonant karst cavern water-drip echoes & deep aquifer hush
   * - Shipwrecks: distant humpback whale song, deep steel hull settling creak & oceanic swell sub-thrum
   * - Geothermal / Glacial Iceland & Arctic: mineral vent crackle or crystalline ice-creak chime
   */
  stepAmbience(dt, level, depthM = 0, diver = null, tensionState = null) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running' || !level || depthM < 2.2) return;

    // Adaptive underwater tension pulse when silt-out, tight squeeze, or reserve gas kicks in (v168 / v171 hysteresis)
    if (tensionState) {
      const siltT = Math.max(0, ((tensionState.siltDensity || 0) - 0.42) / 0.55);
      const sqT = tensionState.inTightSqueeze ? 0.55 : 0;
      const gasT = tensionState.lowGas ? 0.65 : 0;
      const calmMult = tensionState.inAirDome ? 0.15 : 1.0;
      const tension = Math.min(1, Math.max(siltT, sqT, gasT) * calmMult);
      if (tension > 0.28) {
        this._tensionTimer = (this._tensionTimer ?? 0.65) - dt;
        if (this._tensionTimer <= 0) {
          this._tensionTimer = Math.max(2.1, 3.8 - tension * 1.4);
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const harm = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          harm.type = 'triangle';
          const f0 = 48 + tension * 7;
          osc.frequency.setValueAtTime(f0, t);
          osc.frequency.exponentialRampToValueAtTime(f0 * 0.78, t + 1.45);
          // Warm audible 2nd harmonic (~96Hz) so tension pulse translates on laptop & phone speakers
          harm.frequency.setValueAtTime(f0 * 2.0, t);
          harm.frequency.exponentialRampToValueAtTime(f0 * 1.56, t + 1.45);
          const peak = 0.012 + tension * 0.02;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.34);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
          osc.connect(g);
          harm.connect(g);
          const panner = this._connectSpatial(g, { pan: 0, bus: 'ambience' });
          osc.onended = () => {
            try { osc.disconnect(); } catch {}
            try { harm.disconnect(); } catch {}
            try { g.disconnect(); } catch {}
            try { panner?.disconnect(); } catch {}
          };
          osc.start(t);
          harm.start(t);
          osc.stop(t + 1.55);
          harm.stop(t + 1.55);
        }
      } else {
        // Entry hysteresis: reset timer smoothly when calm so grazing a wall never fires on frame 1
        this._tensionTimer = Math.min(0.85, (this._tensionTimer ?? 0.85) + dt * 0.6);
      }
    }

    this._ambienceTimer -= dt;
    if (this._ambienceTimer > 0) return;

    // Derive spatial stereo pan from nearest landmark (vent / surge / wreck hull center) relative to diver (v133)
    let ambPan = (Math.random() - 0.5) * 0.7;
    if (diver && Number.isFinite(diver.x)) {
      const landmarks = [
        ...(Array.isArray(level.geothermalVents) ? level.geothermalVents : []),
        ...(Array.isArray(level.surgeZones) ? level.surgeZones : []),
      ];
      let bestDist = Infinity;
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm || !Number.isFinite(lm.x)) continue;
        const mix = computeSpatialMix(diver.x, diver.y, lm.x, lm.y, { maxDistM: 42 });
        if (mix.gain > 0.08 && mix.distanceM < bestDist) {
          bestDist = mix.distanceM;
          ambPan = mix.pan;
        }
      }
      if (bestDist === Infinity && level.isWreck && Number.isFinite(level.wreckHullXMin) && Number.isFinite(level.wreckHullXMax)) {
        const hullMidX = (level.wreckHullXMin + level.wreckHullXMax) * 0.5;
        ambPan = computeSpatialMix(diver.x, diver.y, hullMidX, level.wreckDeckY || 30, { maxDistM: 90 }).pan;
      }
    }

    const style = level.theme?.surfaceStyle || '';
    const isGlacier =
      style === 'kverkfjoll-glacier' ||
      style === 'aurora-basalt' ||
      style === 'scoresby-iceberg' ||
      String(level.id || '').includes('scoresby');
    const hasVents = Array.isArray(level.geothermalVents) && level.geothermalVents.length > 0;

    if (level.isWreck) {
      const nowMs = performance.now();
      const roll = Math.random();
      if (depthM > 8 && nowMs - this._lastWhaleAt > 28000 && roll < 0.28) {
        this._lastWhaleAt = nowMs;
        this._ambienceTimer = 9.0 + Math.random() * 7.0;
        this.playWhaleSong(ambPan);
      } else if (depthM > 20 && roll < 0.56) {
        // Distant deep-water steel hull settling creak (spatialized onto ambienceBus)
        this._ambienceTimer = 7.2 + Math.random() * 6.5;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filt = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        const f0 = 72 + Math.random() * 24;
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.68, t + 1.65);
        filt.type = 'lowpass';
        filt.frequency.value = 260;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.02, t + 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
        osc.connect(filt);
        filt.connect(g);
        const panner = this._connectSpatial(g, { pan: ambPan, bus: 'ambience' });
        osc.onended = () => {
          try { osc.disconnect(); } catch {}
          try { filt.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
          try { panner?.disconnect(); } catch {}
        };
        osc.start(t);
        osc.stop(t + 1.75);
      } else {
        // Gentle low ocean swell sub-thrum (spatialized onto ambienceBus)
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
        const panner = this._connectSpatial(g, { pan: ambPan, bus: 'ambience' });
        osc.onended = () => {
          try { osc.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
          try { panner?.disconnect(); } catch {}
        };
        osc.start(t);
        osc.stop(t + 2.25);
      }
    } else if (isGlacier && Math.random() < 0.65) {
      // Crystalline subglacial ice groan & harmonic shimmer (spatialized onto ambienceBus)
      this._ambienceTimer = 5.2 + Math.random() * 5.2;
      const f = 540 + Math.random() * 420;
      this.playTone(f, 0.55, 'sine', 0.018, 0, { pan: ambPan, bus: 'ambience' });
      this.playTone(f * 1.498, 0.72, 'triangle', 0.012, 0.08, { pan: ambPan * 0.85, bus: 'ambience' });
      this.playTone(f * 2.0, 0.42, 'sine', 0.006, 0.22, { pan: ambPan * 0.65, bus: 'ambience' });
      // Deep glacial pressure groan underneath the crystalline ping
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(118, t);
      osc.frequency.exponentialRampToValueAtTime(58, t + 1.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.016, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
      osc.connect(g);
      const panner = this._connectSpatial(g, { pan: ambPan, bus: 'ambience' });
      osc.onended = () => {
        try { osc.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
        try { panner?.disconnect(); } catch {}
      };
      osc.start(t);
      osc.stop(t + 1.5);
    } else if (hasVents && Math.random() < 0.55) {
      // Delicate hydrothermal mineral hiss burst (spatialized onto ambienceBus)
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
        const panner = this._connectSpatial(g, { pan: ambPan, bus: 'ambience' });
        src.onended = () => {
          try { src.disconnect(); } catch {}
          try { filt.disconnect(); } catch {}
          try { g.disconnect(); } catch {}
          try { panner?.disconnect(); } catch {}
        };
        src.start(t, Math.random() * 0.5);
        src.stop(t + 1.3);
      }
    } else {
      // Resonant 3-tap karst cave water-drip echo (spatialized onto ambienceBus)
      this._ambienceTimer = 5.2 + Math.random() * 6.5;
      const base = 680 + Math.random() * 480;
      this.playTone(base, 0.14, 'sine', 0.016, 0, { pan: ambPan, bus: 'ambience' });
      this.playTone(base * 1.18, 0.18, 'sine', 0.01, 0.14, { pan: ambPan * 0.7, bus: 'ambience' });
      this.playTone(base * 1.16, 0.22, 'sine', 0.0055, 0.32, { pan: ambPan * 0.4, bus: 'ambience' });
    }
  }

  /**
   * Tactile metallic cylinder-on-limestone scrape & grit foley in tight cave restrictions (v168).
   */
  playTankScrape(intensity = 0.6, pan = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const lvl = Math.max(0.25, Math.min(1, Number(intensity) || 0.6));
    // Metallic aluminum cylinder ring + harmonic overtone
    this.playTone(1080 + Math.random() * 140, 0.14, 'triangle', 0.022 * lvl, 0, { pan, bus: 'sfx' });
    this.playTone(1640 + Math.random() * 180, 0.11, 'sine', 0.014 * lvl, 0.015, { pan, bus: 'sfx' });
    const noise = this._getNoiseBuffer?.();
    if (noise) {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1450;
      filt.Q.value = 2.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.026 * lvl, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      src.connect(filt);
      filt.connect(g);
      const panner = this._connectSpatial(g, { pan, bus: 'sfx' });
      src.onended = () => {
        try { src.disconnect(); } catch {}
        try { filt.disconnect(); } catch {}
        try { g.disconnect(); } catch {}
        try { panner?.disconnect(); } catch {}
      };
      src.start(t, Math.random() * 0.4);
      src.stop(t + 0.26);
    }
    this.vibrate?.(12);
  }

  /**
   * Crystalline expedition treasure chime when recovering an artifact into the Trophy Vault (v168).
   */
  playArtifactDiscover(isGrand = false) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const notes = isGrand ? [587.33, 739.99, 880, 1174.66, 1318.5] : [587.33, 880, 1174.66];
    notes.forEach((hz, idx) => {
      this.playTone(hz, isGrand ? 0.34 : 0.22, 'sine', isGrand ? 0.045 : 0.036, idx * 0.055, { bus: 'sfx' });
    });
    this.vibrate?.(isGrand ? [16, 22, 30] : 16);
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
    this._connectSpatial(g, { pan: 0, bus: 'sfx' });
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
  playEncounterChime(kind = 'beacon', pan = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    if (kind === 'beacon') {
      this.playTone(1180, 0.09, 'sine', 0.055, 0, { pan, bus: 'sfx' });
      this.playTone(1568, 0.14, 'triangle', 0.06, 0.085, { pan, bus: 'sfx' });
      this.vibrate?.(24);
      return;
    }
    if (kind === 'buddy-ping') {
      this.playTone(784, 0.11, 'sine', 0.048, 0, { pan, bus: 'sfx' });
      this.playTone(1174.6, 0.15, 'sine', 0.052, 0.11, { pan, bus: 'sfx' });
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
    const panner = this._connectSpatial(g, { pan, bus: 'ambience' });
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { g.disconnect(); } catch {}
      try { panner?.disconnect(); } catch {}
    };
    osc.start(t);
    osc.stop(t + 1.24);
  }

  /**
   * Directional underwater locator beacon (ULB) ping for hidden Black Boxes & Lost Hydro-Probes (v159).
   * Stereo pan & distance attenuation let players hunt by ear + sonar.
   */
  playBlackBoxPing(distM = 18, pan = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const prox = Math.max(0.12, Math.min(1, 1 - (Number(distM) || 0) / 36));
    const gain = 0.015 + prox * 0.055;
    this.playTone(2640, 0.065, 'sine', gain, 0, { pan, bus: 'sfx' });
    this.playTone(3120, 0.045, 'triangle', gain * 0.42, 0.08, { pan, bus: 'sfx' });
  }

  /**
   * Tactile polymer-on-line snap click when clipping a directional Line Cookie (v159).
   */
  playCookieClip() {
    this.unlock();
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone(1480, 0.025, 'triangle', 0.05, 0, { bus: 'sfx' });
    this.playTone(2220, 0.032, 'sine', 0.04, 0.028, { bus: 'sfx' });
    this.vibrate?.(12);
  }

  /**
   * Subtle procedural biome hydrophone ambience cues on the ambience bus (v159/v160):
   *  - 'ice'     -> crystalline ice-shelf stress crack
   *  - 'volcanic'-> deep geothermal sub-bass rumble
   *  - 'wreck'   -> distant metallic hull creak
   *  - 'cenote'  -> resonant cavern water-drip / limestone echo
   */
  playBiomeHydrophoneCue(biomeKind = 'cenote', pan = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (biomeKind === 'ice') {
      this.playTone(1860, 0.045, 'sawtooth', 0.018, 0, { pan, bus: 'ambience' });
      this.playTone(1120, 0.14, 'triangle', 0.022, 0.04, { pan: pan * 0.7, bus: 'ambience' });
      return;
    }
    if (biomeKind === 'volcanic') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(54, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 1.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
      osc.connect(g);
      const panner = this._connectSpatial(g, { pan, bus: 'ambience' });
      osc.onended = () => {
        try { osc.disconnect(); g.disconnect(); panner?.disconnect(); } catch {}
      };
      osc.start(t);
      osc.stop(t + 1.48);
      return;
    }
    if (biomeKind === 'wreck') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(118, t);
      osc.frequency.exponentialRampToValueAtTime(84, t + 0.95);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.024, t + 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      osc.connect(g);
      const panner = this._connectSpatial(g, { pan, bus: 'ambience' });
      osc.onended = () => {
        try { osc.disconnect(); g.disconnect(); panner?.disconnect(); } catch {}
      };
      osc.start(t);
      osc.stop(t + 1.04);
      return;
    }
    // Cenote / Karst resonant drop & shimmer
    this.playTone(620, 0.08, 'sine', 0.014, 0, { pan, bus: 'ambience' });
    this.playTone(840, 0.12, 'sine', 0.011, 0.06, { pan: pan * 0.6, bus: 'ambience' });
  }

  /**
   * Heavy waterproof shipwreck breaker clunk + rising tungsten floodlight ballast hum (v162).
   */
  playBreakerSwitch() {
    this.unlock();
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    // Heavy steel toggle clunk
    this.playTone(145, 0.065, 'square', 0.085, 0, { bus: 'sfx' });
    this.playTone(92, 0.09, 'sawtooth', 0.075, 0.03, { bus: 'sfx' });
    // Rising ballast power-on hum
    const t = this.ctx.currentTime + 0.07;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.65);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    osc.connect(g);
    const dest = this._getBusNode('sfx');
    if (dest) g.connect(dest);
    osc.onended = () => {
      try { osc.disconnect(); g.disconnect(); } catch {}
    };
    osc.start(t);
    osc.stop(t + 0.75);
    this.vibrate?.([18, 25, 30]);
  }

  /**
   * Crisp octo purge inflation hiss + rapid rising dSMB ascent whoosh (v162).
   */
  playSmbDeploy() {
    this.unlock();
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone(540, 0.14, 'sawtooth', 0.04, 0, { bus: 'sfx' });
    this.playTone(880, 0.18, 'sine', 0.045, 0.1, { bus: 'sfx' });
    this.playTone(1320, 0.22, 'triangle', 0.04, 0.22, { bus: 'sfx' });
    this.vibrate?.([14, 18, 14]);
  }

  /**
   * Serene harmonic underwater shimmer chord when a curious Megafauna glides in to escort you (v162).
   */
  playWildlifeHarmony() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.playTone(440, 0.32, 'sine', 0.036, 0, { bus: 'ambience' });
    this.playTone(554.37, 0.36, 'sine', 0.032, 0.09, { bus: 'ambience' });
    this.playTone(659.25, 0.44, 'triangle', 0.034, 0.18, { bus: 'ambience' });
  }
}
