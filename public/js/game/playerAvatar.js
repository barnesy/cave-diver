/**
 * Custom Player Topside Avatar Model, Persistence & Site Jump-In State (v296)
 *
 * Lets players create their own diver persona (Male/Female, body shape, skin tone, hair,
 * and bathing suit style & colors) on first visit or anytime, renders that exact avatar
 * across topside docks/boats, co-op staging, and the victory dance stage, and orchestrates
 * the run-out-and-jump-into-the-water animation whenever a dive site is picked.
 */

export const AVATAR_STORAGE_KEY = 'cave-diver-player-avatar-v1';

export const AVATAR_SKIN_PRESETS = Object.freeze([
  { id: 'fair', label: 'Sunlit Fair', skin: '#f4cca4', shade: '#d4a373' },
  { id: 'warm', label: 'Golden Tan', skin: '#e0a878', shade: '#bd7f50' },
  { id: 'bronze', label: 'Deep Bronze', skin: '#c58250', shade: '#9c5d33' },
  { id: 'ebony', label: 'Rich Espresso', skin: '#8b5228', shade: '#653516' },
]);

export const AVATAR_HAIR_PRESETS = Object.freeze([
  { id: 'espresso', label: 'Espresso', color: '#1b110d' },
  { id: 'chestnut', label: 'Chestnut', color: '#3b2414' },
  { id: 'auburn', label: 'Auburn', color: '#6b381a' },
  { id: 'honey', label: 'Honey Blonde', color: '#b47c2b' },
  { id: 'sunlit', label: 'Sunlit Gold', color: '#d4a23b' },
  { id: 'coral', label: 'Coral Wave', color: '#be185d' },
]);

export const AVATAR_FEMALE_BODIES = Object.freeze([
  { id: 'petite', label: 'Petite' },
  { id: 'athletic-f', label: 'Athletic' },
  { id: 'hourglass', label: 'Hourglass' },
  { id: 'voluptuous', label: 'Curvy' },
]);

export const AVATAR_MALE_BODIES = Object.freeze([
  { id: 'lean-surfer', label: 'Surfer' },
  { id: 'athletic-m', label: 'Athletic' },
  { id: 'muscular', label: 'Muscular' },
  { id: 'dad-bod', label: 'Relaxed' },
]);

export const AVATAR_FEMALE_TOP_STYLES = Object.freeze([
  { id: 'triangle-halter', label: 'Triangle Bikini' },
  { id: 'balconette', label: 'Balconette' },
  { id: 'bandeau', label: 'Bandeau' },
  { id: 'plunge-onepiece', label: 'Plunge 1-Piece' },
  { id: 'sporty-crop', label: 'Sporty Crop' },
  { id: 'wrap-crisscross', label: 'Wrap Keyhole' },
]);

export const AVATAR_FEMALE_SWIMS = Object.freeze([
  { id: 'coral', label: 'Coral Sun', primary: '#fb7185', accent: '#fef08a', style: 'bikini' },
  { id: 'hotpink', label: 'Hot Pink', primary: '#ec4899', accent: '#ffffff', style: 'bikini' },
  { id: 'aqua', label: 'Lagoon Aqua', primary: '#06b6d4', accent: '#f97316', style: 'bikini' },
  { id: 'violet', label: 'Reef Violet', primary: '#a855f7', accent: '#67e8f9', style: 'bikini' },
  { id: 'gold', label: 'Solar Gold', primary: '#facc15', accent: '#ec4899', style: 'bikini' },
  { id: 'sunset', label: 'Sunset', primary: '#f97316', accent: '#38bdf8', style: 'bikini' },
]);

export const AVATAR_MALE_SWIMS = Object.freeze([
  { id: 'ocean', label: 'Ocean Shorts', primary: '#0284c7', accent: '#fde047', style: 'boardshorts' },
  { id: 'lifeguard', label: 'Lifeguard Red', primary: '#ef4444', accent: '#ffffff', style: 'boardshorts' },
  { id: 'tropical', label: 'Resort Shirt', primary: '#10b981', accent: '#fef08a', style: 'resort-shirt' },
  { id: 'rashguard', label: 'Surf Rashguard', primary: '#f97316', accent: '#0f172a', style: 'rashguard' },
  { id: 'indigo', label: 'Indigo Shorts', primary: '#6366f1', accent: '#38bdf8', style: 'boardshorts' },
  { id: 'briefs', label: 'Swim Briefs', primary: '#0ea5e9', accent: '#fde047', style: 'swim-briefs' },
]);

export const DEFAULT_PLAYER_AVATAR = Object.freeze({
  configured: false,
  gender: 'female',
  bodyType: 'hourglass',
  skinIdx: 1,
  hairIdx: 1,
  topStyle: 'triangle-halter',
  swimIdx: 0,
});

let _cachedAvatar = null;

function _clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function normalizePlayerAvatar(raw = {}) {
  const gender = raw?.gender === 'male' ? 'male' : 'female';
  const validBodies = gender === 'male' ? AVATAR_MALE_BODIES : AVATAR_FEMALE_BODIES;
  const bodyType = validBodies.some((b) => b.id === raw?.bodyType)
    ? raw.bodyType
    : (gender === 'male' ? 'athletic-m' : 'hourglass');
  const topStyle = AVATAR_FEMALE_TOP_STYLES.some((t) => t.id === raw?.topStyle)
    ? raw.topStyle
    : 'triangle-halter';
  const swimList = gender === 'male' ? AVATAR_MALE_SWIMS : AVATAR_FEMALE_SWIMS;
  return {
    configured: Boolean(raw?.configured),
    gender,
    bodyType,
    skinIdx: _clampInt(raw?.skinIdx, 0, AVATAR_SKIN_PRESETS.length - 1, DEFAULT_PLAYER_AVATAR.skinIdx),
    hairIdx: _clampInt(raw?.hairIdx, 0, AVATAR_HAIR_PRESETS.length - 1, DEFAULT_PLAYER_AVATAR.hairIdx),
    topStyle,
    swimIdx: _clampInt(raw?.swimIdx, 0, swimList.length - 1, 0),
  };
}

export function loadPlayerAvatar() {
  if (_cachedAvatar) return { ..._cachedAvatar };
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (raw) {
        _cachedAvatar = normalizePlayerAvatar(JSON.parse(raw));
        return { ..._cachedAvatar };
      }
    }
  } catch (_) {}
  _cachedAvatar = { ...DEFAULT_PLAYER_AVATAR };
  return { ..._cachedAvatar };
}

export function getActivePlayerAvatar() {
  if (!_cachedAvatar) loadPlayerAvatar();
  return _cachedAvatar || DEFAULT_PLAYER_AVATAR;
}

export function savePlayerAvatar(next) {
  const clean = normalizePlayerAvatar(next);
  _cachedAvatar = clean;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(clean));
    }
  } catch (_) {}
  return { ...clean };
}

export function resetPlayerAvatarCache() {
  _cachedAvatar = null;
}

/**
 * Convert a player avatar profile into a ready-to-render `drawTopsidePerson(...)` spec.
 */
export function buildTopsideSpecFromAvatar(avatar = null, overrides = {}) {
  const av = normalizePlayerAvatar(avatar || getActivePlayerAvatar());
  const skinPreset = AVATAR_SKIN_PRESETS[av.skinIdx] || AVATAR_SKIN_PRESETS[1];
  const hairPreset = AVATAR_HAIR_PRESETS[av.hairIdx] || AVATAR_HAIR_PRESETS[1];
  const swimList = av.gender === 'male' ? AVATAR_MALE_SWIMS : AVATAR_FEMALE_SWIMS;
  const swimPreset = swimList[av.swimIdx] || swimList[0];
  const isOnePiece = av.gender === 'female' && av.topStyle === 'plunge-onepiece';

  return {
    gender: av.gender,
    bodyType: av.bodyType,
    topStyle: av.gender === 'female' ? av.topStyle : undefined,
    customSkin: { skin: skinPreset.skin, shade: skinPreset.shade },
    customHair: hairPreset.color,
    customSwim: {
      primary: swimPreset.primary,
      accent: swimPreset.accent,
      style: isOnePiece ? 'onepiece' : swimPreset.style,
    },
    ...overrides,
  };
}

// ── Reactive Topside Avatar Site Jump-In Choreography State (v296) ──
const _nowSec = () => (typeof performance !== 'undefined' && performance.now ? performance.now() * 0.001 : Date.now() * 0.001);

const _jumpState = {
  triggeredAt: -99,
  levelId: '',
  duration: 3.65,
  seq: 0,
};

/**
 * Trigger the player's custom avatar to run out onto the dock/boat stern and leap into the water!
 * Called whenever a dive site is picked on the Home Screen, when saving a new avatar, or on dive launch.
 */
export function triggerAvatarSiteJump(levelId = '') {
  _jumpState.triggeredAt = _nowSec();
  _jumpState.levelId = String(levelId || '');
  _jumpState.seq += 1;
  return _jumpState.seq;
}

/**
 * Inspect whether the player's avatar jump-in animation is currently active (`{ active, elapsed, duration, levelId, seq }`).
 */
export function getAvatarSiteJumpState(nowSec = _nowSec()) {
  const elapsed = nowSec - _jumpState.triggeredAt;
  const active = elapsed >= 0 && elapsed < _jumpState.duration;
  return {
    active,
    elapsed: active ? elapsed : -1,
    duration: _jumpState.duration,
    levelId: _jumpState.levelId,
    seq: _jumpState.seq,
  };
}
