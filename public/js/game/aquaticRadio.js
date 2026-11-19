/**
 * Chill MIDI-based Procedural Aquatic Radio.
 * Converts MIDI note tracks into warm underwater pads, sub-bass, and marimba/kalimba plucks
 * scheduled with zero allocations using the shared Web Audio API context.
 */

export const RADIO_TRACKS = [
  {
    id: 'off',
    name: 'Off',
    bpm: 0,
    stepsPerBeat: 2,
    padChords: [],
    melodyNotes: [],
    bassNotes: [],
  },
  {
    id: 'cenote-drift',
    name: 'Cenote Drift',
    bpm: 72,
    stepsPerBeat: 2, // 8th-note steps (16-step bar cycle)
    padChords: [
      [53, 60, 64, 67, 72], // Fmaj9
      [50, 57, 60, 64, 69], // Dm9
      [48, 55, 59, 62, 67], // Cmaj9
      [46, 53, 57, 60, 65], // Bbmaj9
    ],
    bassNotes: [41, null, 41, null, 38, null, 38, null, 36, null, 36, null, 34, null, 36, null],
    melodyNotes: [69, null, 72, 76, null, 74, 72, null, 67, null, 72, 74, null, 79, 76, null],
  },
  {
    id: 'halocline-haze',
    name: 'Halocline Haze',
    bpm: 66,
    stepsPerBeat: 2,
    padChords: [
      [48, 55, 59, 66, 71], // Cmaj7#11 (Lydian)
      [50, 57, 62, 66, 69], // D6/9
      [45, 52, 59, 64, 67], // Am9
      [43, 50, 57, 62, 66], // Gmaj9
    ],
    bassNotes: [36, null, null, 36, 38, null, null, 38, 33, null, null, 33, 31, null, null, 35],
    melodyNotes: [71, null, 74, null, 78, 76, null, 74, 71, null, 67, 71, null, 74, 78, null],
  },
  {
    id: 'abyssal-pulse',
    name: 'Abyssal Pulse',
    bpm: 78,
    stepsPerBeat: 2,
    padChords: [
      [50, 57, 60, 65, 69], // Dm7
      [48, 55, 60, 62, 67], // Csus2
      [46, 53, 58, 62, 65], // Bbmaj7
      [45, 52, 57, 60, 64], // Am7
    ],
    bassNotes: [38, null, 38, 45, 36, null, 36, 43, 34, null, 34, 41, 33, null, 33, 40],
    melodyNotes: [62, 65, 69, null, 72, null, 69, 67, 65, null, 62, 65, 69, null, 67, null],
  },
  {
    id: 'kelp-glow',
    name: 'Kelp Glow',
    bpm: 82,
    stepsPerBeat: 2,
    padChords: [
      [55, 62, 66, 69, 71], // Gmaj9
      [52, 59, 62, 66, 71], // Em9
      [48, 55, 59, 64, 67], // Cmaj7
      [50, 57, 62, 66, 69], // D6/9
    ],
    bassNotes: [43, null, 43, null, 40, null, 40, null, 36, null, 36, null, 38, null, 38, 42],
    melodyNotes: [74, null, 71, 74, 78, null, 74, 71, 67, null, 71, 74, 76, null, 74, null],
  },
];

export function midiToFreq(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export class AquaticRadio {
  constructor(getAudioCtx, { isMutedFn = () => false } = {}) {
    this.getAudioCtx = getAudioCtx;
    this.isMutedFn = isMutedFn;
    this.trackIndex = 0; // 0 = Off
    this._timer = null;
    this._step = 0;
    this._nextStepTime = 0;
    this._busGain = null;
    this._lowpass = null;
    this._boundCtx = null;
  }

  getCurrentTrack() {
    return RADIO_TRACKS[this.trackIndex] || RADIO_TRACKS[0];
  }

  getButtonLabel() {
    const tr = this.getCurrentTrack();
    return tr.id === 'off' ? '📻 Off' : `📻 ${tr.name}`;
  }

  setTrackIndex(idx) {
    const clean = ((Math.round(Number(idx) || 0) % RADIO_TRACKS.length) + RADIO_TRACKS.length) % RADIO_TRACKS.length;
    this.trackIndex = clean;
    if (clean === 0) {
      this.stop();
    } else {
      this.start();
    }
    return this.getCurrentTrack();
  }

  cycleTrack() {
    return this.setTrackIndex(this.trackIndex + 1);
  }

  _ensureBus(ctx) {
    if (!ctx) return null;
    if (this._boundCtx === ctx && this._busGain && this._lowpass) {
      return this._busGain;
    }
    this._boundCtx = ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1180, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(this.isMutedFn() ? 0.0001 : 0.16, ctx.currentTime);
    bus.connect(filter);
    filter.connect(ctx.destination);
    this._lowpass = filter;
    this._busGain = bus;
    return bus;
  }

  syncMuted(muted) {
    const ctx = this.getAudioCtx?.();
    if (!ctx || !this._busGain) return;
    this._busGain.gain.setTargetAtTime(muted ? 0.0001 : 0.16, ctx.currentTime, 0.06);
  }

  start() {
    const tr = this.getCurrentTrack();
    if (!tr || tr.id === 'off') {
      this.stop();
      return;
    }
    const ctx = this.getAudioCtx?.();
    if (!ctx) return;
    this._ensureBus(ctx);
    if (this._busGain && !this.isMutedFn()) {
      this._busGain.gain.cancelScheduledValues?.(ctx.currentTime);
      this._busGain.gain.setTargetAtTime(0.16, ctx.currentTime, 0.08);
    }
    this._step = 0;
    this._nextStepTime = Math.max(ctx.currentTime + 0.04, this._nextStepTime);
    if (!this._timer) {
      this._timer = setInterval(() => this._schedulerTick(), 110);
    }
    this._schedulerTick();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    const ctx = this.getAudioCtx?.();
    if (this._busGain && ctx) {
      this._busGain.gain.cancelScheduledValues?.(ctx.currentTime);
      this._busGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
    }
  }

  setDepthMuffle(depthM = 0, narcosisLevel = 0) {
    const ctx = this.getAudioCtx?.();
    if (!this._filter || !ctx) return;
    const depthRatio = Math.max(0, Math.min(1, depthM / 120));
    const narcRatio = Math.max(0, Math.min(1, narcosisLevel || 0));
    const targetHz = Math.max(460, 1450 - depthRatio * 550 - narcRatio * 480);
    this._filter.frequency.setTargetAtTime(targetHz, ctx.currentTime, 0.25);
  }

  _playVoice(ctx, bus, freq, when, duration, type, peakGain) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peakGain, when + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(g);
    g.connect(bus);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  }

  _schedulerTick() {
    const tr = this.getCurrentTrack();
    if (!tr || tr.id === 'off' || this.isMutedFn()) return;
    const ctx = this.getAudioCtx?.();
    if (!ctx || ctx.state !== 'running') return;
    const bus = this._ensureBus(ctx);
    if (!bus) return;

    const stepDur = 60 / (tr.bpm * (tr.stepsPerBeat || 2));
    if (this._nextStepTime < ctx.currentTime - 0.5) {
      this._nextStepTime = ctx.currentTime + 0.04;
    }

    while (this._nextStepTime < ctx.currentTime + 0.28) {
      const s = this._step % 16;
      const chordIdx = Math.floor(s / 4) % tr.padChords.length;

      // Soft warm underwater pad chord every 4 steps
      if (s % 4 === 0 && tr.padChords[chordIdx]) {
        const chord = tr.padChords[chordIdx];
        const padDur = stepDur * 3.85;
        for (let i = 0; i < chord.length; i++) {
          this._playVoice(ctx, bus, midiToFreq(chord[i]), this._nextStepTime, padDur, 'sine', 0.065);
        }
      }

      // Deep sub-bass anchor
      const bassMidi = tr.bassNotes[s];
      if (bassMidi != null) {
        this._playVoice(ctx, bus, midiToFreq(bassMidi), this._nextStepTime, stepDur * 1.85, 'triangle', 0.14);
      }

      // Gentle pentatonic marimba/kalimba droplet melody
      const melMidi = tr.melodyNotes[s];
      if (melMidi != null) {
        this._playVoice(ctx, bus, midiToFreq(melMidi), this._nextStepTime, stepDur * 1.45, 'sine', 0.11);
      }

      this._step += 1;
      this._nextStepTime += stepDur;
    }
  }
}
