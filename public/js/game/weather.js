/**
 * Dynamic Surface Weather, Day/Night Cycle & Bioluminescent Night-Dive System (v137).
 * Drives sky atmosphere, rain/snow/lightning overlays, daylight & caustic attenuation,
 * shallow-water storm swell currents, night bioluminescence activation, and score bonuses.
 */

export const MAX_WEATHER_BONUS = 250;

export const WEATHER_PRESETS = Object.freeze([
  {
    id: 'clear-day',
    label: 'Clear Day',
    shortLabel: 'Clear Day',
    icon: '☀️',
    pillText: '☀️ Clear Day',
    desc: 'Crisp noon daylight with full cenote sunbeams, turquoise caustic webs, and calm entry water.',
    sunIntensity: 1.0,
    causticIntensity: 1.0,
    darknessBoost: 0.0,
    skyDarken: 0.0,
    skyTintRgba: '',
    sunTintRgba: '',
    swellStrength: 0.0,
    precip: 'none',
    lightning: false,
    stars: false,
    forceBiolum: false,
    biolumBoost: 0.0,
    bioWakeBoost: 1.0,
    scoreBonus: 0,
  },
  {
    id: 'golden-hour',
    label: 'Golden Hour',
    shortLabel: 'Golden Hour',
    icon: '🌅',
    pillText: '🌅 Golden Hour',
    desc: 'Low amber sunset casts molten gold across the horizon, softens sun shafts, and awakens twilight plankton (+80 pts).',
    sunIntensity: 0.76,
    causticIntensity: 0.82,
    darknessBoost: 0.14,
    skyDarken: 0.16,
    skyTintRgba: 'rgba(249, 115, 22, 0.34)',
    sunTintRgba: 'rgba(253, 186, 116, 0.24)',
    swellStrength: 0.18,
    precip: 'none',
    lightning: false,
    stars: false,
    forceBiolum: false,
    biolumBoost: 0.25,
    bioWakeBoost: 1.25,
    scoreBonus: 80,
  },
  {
    id: 'night-biolum',
    label: 'Bioluminescent Night',
    shortLabel: 'Night Dive',
    icon: '🌙',
    pillText: '🌙 Night Dive',
    desc: 'Pitch-black starry sky with crescent moon — zero daylight, rely on your torch while glowing cyan-violet plankton illuminates every kick (+250 pts).',
    sunIntensity: 0.04,
    causticIntensity: 0.06,
    darknessBoost: 0.68,
    skyDarken: 0.78,
    skyTintRgba: 'rgba(15, 23, 62, 0.68)',
    sunTintRgba: '',
    swellStrength: 0.08,
    precip: 'none',
    lightning: false,
    stars: true,
    forceBiolum: true,
    biolumBoost: 1.0,
    bioWakeBoost: 1.85,
    scoreBonus: 250,
  },
  {
    id: 'tropical-storm',
    label: 'Tropical Storm',
    shortLabel: 'Storm',
    icon: '⛈️',
    pillText: '⛈️ Storm',
    desc: 'Driving squall rain, distant lightning flashes, dimmed water clarity, and rolling surface swells down to 9m (+200 pts).',
    sunIntensity: 0.32,
    causticIntensity: 0.32,
    darknessBoost: 0.28,
    skyDarken: 0.56,
    skyTintRgba: 'rgba(15, 23, 42, 0.62)',
    sunTintRgba: '',
    swellStrength: 0.95,
    precip: 'rain',
    lightning: true,
    stars: false,
    forceBiolum: false,
    biolumBoost: 0.15,
    bioWakeBoost: 1.15,
    scoreBonus: 200,
  },
  {
    id: 'arctic-blizzard',
    label: 'Arctic Snow',
    shortLabel: 'Snow',
    icon: '❄️',
    pillText: '❄️ Snow',
    desc: 'Crisp polar twilight with blowing snow flurries, glacial overcast light shafts, and brisk surface chop (+160 pts).',
    sunIntensity: 0.52,
    causticIntensity: 0.54,
    darknessBoost: 0.18,
    skyDarken: 0.24,
    skyTintRgba: 'rgba(148, 163, 184, 0.34)',
    sunTintRgba: 'rgba(186, 230, 253, 0.18)',
    swellStrength: 0.62,
    precip: 'snow',
    lightning: false,
    stars: false,
    forceBiolum: false,
    biolumBoost: 0.1,
    bioWakeBoost: 1.1,
    scoreBonus: 160,
  },
]);

export const WEATHER_CYCLE_ORDER = Object.freeze([
  'clear-day',
  'golden-hour',
  'night-biolum',
  'tropical-storm',
  'arctic-blizzard',
  'auto',
]);

const WEATHER_BY_ID = new Map(WEATHER_PRESETS.map((w) => [w.id, w]));

export function getWeatherById(weatherId) {
  if (!weatherId || typeof weatherId !== 'string') return WEATHER_PRESETS[0];
  return WEATHER_BY_ID.get(weatherId.trim().toLowerCase()) || WEATHER_PRESETS[0];
}

/**
 * Resolve 'auto' or an explicit weatherId into a concrete WEATHER_PRESETS entry.
 * In 'auto' mode, uses local clock hour + site climate cues for an authentic atmosphere.
 */
export function resolveEffectiveWeather(prefId = 'clear-day', { level = null, hourLocal = null } = {}) {
  const clean = typeof prefId === 'string' ? prefId.trim().toLowerCase() : 'clear-day';
  if (clean && clean !== 'auto' && WEATHER_BY_ID.has(clean)) {
    return WEATHER_BY_ID.get(clean);
  }
  if (clean !== 'auto') {
    return WEATHER_PRESETS[0];
  }
  const h = Number.isFinite(hourLocal) ? ((hourLocal % 24) + 24) % 24 : new Date().getHours();
  const style = String(level?.theme?.surfaceStyle || '');
  const isColdSite =
    style.includes('glacier') ||
    style.includes('iceberg') ||
    style.includes('fjord') ||
    style.includes('aurora') ||
    style.includes('nordic');

  if (h >= 20 || h < 5) return WEATHER_BY_ID.get('night-biolum');
  if (h >= 17 || h === 5 || h === 6) return WEATHER_BY_ID.get('golden-hour');
  if (isColdSite && h >= 13 && h <= 16) return WEATHER_BY_ID.get('arctic-blizzard');
  return WEATHER_BY_ID.get('clear-day');
}

/**
 * Compute shallow-water storm/chop swell force (m/s^2) on a diver near open water surface.
 * Attenuates smoothly with depth (0m -> 9m) and is strictly zero inside deep sheltered caves.
 */
export function computeWeatherSwellForce(weather, depthM, timeSec, { nearOpenBasin = true } = {}) {
  const w = typeof weather === 'string' ? getWeatherById(weather) : weather;
  if (!w || !w.swellStrength || w.swellStrength <= 0 || !nearOpenBasin) {
    return { ax: 0, ay: 0 };
  }
  const d = Math.max(0, Number(depthM) || 0);
  if (d >= 9.5) return { ax: 0, ay: 0 };
  const depthFade = Math.max(0, 1 - d / 9.5);
  const amp = w.swellStrength * depthFade * depthFade;
  const phase = (Number(timeSec) || 0) * 1.35;
  return {
    ax: Math.sin(phase) * amp * 1.15,
    ay: Math.cos(phase * 1.45) * amp * 0.42,
  };
}

/**
 * Deterministic lightning flash intensity [0..1] for stormy weather without per-frame allocations.
 */
export function computeStormLightningFlash(weather, timeSec) {
  const w = typeof weather === 'string' ? getWeatherById(weather) : weather;
  if (!w?.lightning) return 0;
  const t = Math.max(0, Number(timeSec) || 0);
  // Fires a double-pulse flash roughly every 13.5 seconds
  const cycle = t % 13.5;
  if (cycle > 0.55) return 0;
  if (cycle < 0.12) return Math.sin((cycle / 0.12) * Math.PI) * 0.85;
  if (cycle >= 0.22 && cycle < 0.46) return Math.sin(((cycle - 0.22) / 0.24) * Math.PI) * 0.52;
  return 0;
}
