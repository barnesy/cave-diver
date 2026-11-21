/**
 * Authentic Technical Cave-Diving Hand Signals & Torch Light-Signaling System (v127).
 * Shared between local diver physics/renderer, HUD radial wheel, and P2P/LAN co-op sync.
 */

export const SCUBA_SIGNALS = [
  {
    id: 'ok',
    text: '👌 OK',
    shortLabel: 'OK',
    hotkey: '1',
    torchPattern: 'circle',
    color: '#4ade80',
    bgRgba: 'rgba(6, 78, 59, 0.94)',
    textColor: '#d1fae5',
    durationSec: 2.8,
    desc: 'Torch O-Circle — "Are you OK? / I am OK"',
  },
  {
    id: 'attention',
    text: '🔦 LOOK / ATTENTION',
    shortLabel: 'LOOK',
    hotkey: '2',
    torchPattern: 'wave',
    color: '#38bdf8',
    bgRgba: 'rgba(8, 47, 73, 0.94)',
    textColor: '#e0f2fe',
    durationSec: 2.8,
    desc: 'Rapid Lateral Torch Sweep — "Look here!"',
  },
  {
    id: 'low-gas',
    text: '⛽ LOW GAS',
    shortLabel: 'LOW GAS',
    hotkey: '3',
    torchPattern: 'strobe',
    color: '#fbbf24',
    bgRgba: 'rgba(69, 26, 3, 0.94)',
    textColor: '#fef3c7',
    durationSec: 3.4,
    desc: 'Fist-to-Chest + Amber Torch Flash',
  },
  {
    id: 'hold',
    text: '✋ STOP / HOLD',
    shortLabel: 'HOLD',
    hotkey: '4',
    torchPattern: 'steady-pulse',
    color: '#f59e0b',
    bgRgba: 'rgba(69, 26, 3, 0.94)',
    textColor: '#fef3c7',
    durationSec: 3.2,
    desc: 'Open-Palm Stop & Neutral Trim Hold',
  },
  {
    id: 'ascend',
    text: '👍 ASCEND / TURN',
    shortLabel: 'ASCEND',
    hotkey: '5',
    torchPattern: 'nod-up',
    color: '#60a5fa',
    bgRgba: 'rgba(23, 37, 84, 0.94)',
    textColor: '#dbeafe',
    durationSec: 3.0,
    desc: 'Thumb-Up Turnaround / Begin Ascent',
  },
  {
    id: 'share-air',
    text: '🆘 SHARE AIR!',
    shortLabel: 'SHARE AIR',
    hotkey: '6',
    torchPattern: 'sos-wave',
    color: '#f87171',
    bgRgba: 'rgba(69, 10, 10, 0.95)',
    textColor: '#fee2e2',
    durationSec: 3.8,
    desc: 'Out-of-Air Emergency Sweep + Urgent Beacon',
  },
];

const SIGNAL_BY_ID = new Map(SCUBA_SIGNALS.map((s) => [s.id, s]));

/**
 * Resolve a SCUBA_SIGNALS entry by id or by its displayed/relayed signalText string.
 * @param {string|null|undefined} idOrText
 */
export function getScubaSignalById(idOrText) {
  if (!idOrText || typeof idOrText !== 'string') return null;
  const direct = SIGNAL_BY_ID.get(idOrText.trim().toLowerCase());
  if (direct) return direct;
  const up = idOrText.toUpperCase();
  if (up.includes('SHARE') || up.includes('OUT OF AIR') || up.includes('SOS')) return SIGNAL_BY_ID.get('share-air');
  if (up.includes('GAS') || up.includes('BAR')) return SIGNAL_BY_ID.get('low-gas');
  if (up.includes('HOLD') || up.includes('STOP') || up.includes('DECO')) return SIGNAL_BY_ID.get('hold');
  if (up.includes('ASCEND') || up.includes('TURN') || up.includes('UP')) return SIGNAL_BY_ID.get('ascend');
  if (up.includes('LOOK') || up.includes('ATTENTION') || up.includes('HERE')) return SIGNAL_BY_ID.get('attention');
  if (up.includes('OK')) return SIGNAL_BY_ID.get('ok');
  return null;
}

/**
 * Stamp an active hand/torch signal onto a diver (local or remote peer).
 */
export function triggerDiverSignal(diver, idOrText, nowMs = Date.now()) {
  if (!diver) return null;
  const spec = getScubaSignalById(idOrText);
  const text = spec ? spec.text : String(idOrText || '').trim().slice(0, 32);
  if (!text) return null;
  const durMs = Math.round((spec?.durationSec || 3.4) * 1000);
  diver.signalId = spec?.id || 'custom';
  diver.signalText = text;
  diver.signalStartedAt = nowMs;
  diver.signalExpiresAt = nowMs + durMs;
  return spec || { id: 'custom', text, torchPattern: 'wave', color: '#38bdf8', durationSec: 3.4 };
}

/**
 * Compute live dive-light gesture modulation (angleOffsetRad & strobeMod) while signaling.
 * Returns null once the 2.2s torch gesture window finishes so normal aim resumes cleanly.
 */
export function computeTorchSignalGesture(signalSpec, elapsedSec) {
  if (!signalSpec || !Number.isFinite(elapsedSec) || elapsedSec < 0) return null;
  const gestureDur = Math.min(2.3, signalSpec.durationSec || 2.3);
  if (elapsedSec > gestureDur) return null;
  const env = Math.min(1, elapsedSec / 0.16) * Math.min(1, (gestureDur - elapsedSec) / 0.28);
  const pat = signalSpec.torchPattern || 'wave';

  if (pat === 'circle') {
    // Smooth cave-diving "O" light circle oscillation
    return {
      pattern: pat,
      angleOffsetRad: Math.sin(elapsedSec * Math.PI * 2.2) * 0.24 * env,
      strobeMod: 0.92 + 0.08 * Math.cos(elapsedSec * Math.PI * 2.2),
      envelope: env,
    };
  }
  if (pat === 'wave') {
    // Rapid side-to-side attention sweep
    return {
      pattern: pat,
      angleOffsetRad: Math.sin(elapsedSec * Math.PI * 5.2) * 0.46 * env,
      strobeMod: 1.0,
      envelope: env,
    };
  }
  if (pat === 'sos-wave') {
    // Urgent wide rapid sweep + high-visibility beam pulse
    return {
      pattern: pat,
      angleOffsetRad: Math.sin(elapsedSec * Math.PI * 6.8) * 0.58 * env,
      strobeMod: 0.55 + 0.45 * Math.abs(Math.sin(elapsedSec * Math.PI * 5.0)),
      envelope: env,
    };
  }
  if (pat === 'strobe') {
    // Rhythmic triple-flash low-gas warning
    return {
      pattern: pat,
      angleOffsetRad: Math.sin(elapsedSec * Math.PI * 3.0) * 0.14 * env,
      strobeMod: 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(elapsedSec * Math.PI * 6.0)),
      envelope: env,
    };
  }
  if (pat === 'nod-up') {
    // Rhythmic upward beckon toward surface
    const wave = 0.5 + 0.5 * Math.sin(elapsedSec * Math.PI * 2.6 - Math.PI * 0.5);
    return {
      pattern: pat,
      angleOffsetRad: -0.42 * wave * env,
      strobeMod: 1.0,
      envelope: env,
    };
  }
  // steady-pulse ('hold')
  return {
    pattern: pat,
    angleOffsetRad: 0,
    strobeMod: 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(elapsedSec * Math.PI * 3.2)),
    envelope: env,
  };
}
