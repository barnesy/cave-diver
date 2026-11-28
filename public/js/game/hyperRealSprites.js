/**
 * Centralized Hyper-Real Transparent Sprite Registry (v295)
 *
 * Lazy-loads & caches photorealistic transparent WebP cutouts for:
 * - Underwater 3D Treasure Chests (Brass, Deep Grotto, Royal Vault — Closed & Open)
 * - Underwater Ruggedized Armored Gear Caches (Closed & Open)
 * - Underwater Vault Doors (Watertight Bulkhead Plate, Spinning Brass Handwheel, Armored Blast Gate)
 * - All Topside Environment Graphics (Tiki Gazebo, Resort Beach Umbrellas, Party Cooler & Boombox,
 *   Scuba Staging Rack, Geothermal Awning, Coastal Dive Van, Polar Snowcat, Cedar Hot Tub, Party Raft,
 *   plus existing Palapa, Research Dome & Charter Dive Boat).
 *
 * All topside human characters remain purely vector-rendered in topsidePeopleRenderer.js.
 * Safe in Node.js headless tests (returns null when DOM Image is unavailable -> graceful procedural fallback).
 */

export const HYPER_REAL_SPRITE_PATHS = Object.freeze({
  // Underwater Treasure Chests (Closed & Open states)
  'chest-brass-closed': './assets/prop-chest-brass-closed.webp',
  'chest-brass-open': './assets/prop-chest-brass-open.webp',
  'chest-grotto-closed': './assets/prop-chest-grotto-closed.webp',
  'chest-grotto-open': './assets/prop-chest-grotto-open.webp',
  'chest-vault-closed': './assets/prop-chest-vault-closed.webp',
  'chest-vault-open': './assets/prop-chest-vault-open.webp',

  // Underwater Armored Expedition Gear Cache (Closed & Open)
  'gearcache-closed': './assets/prop-gearcache-closed.webp',
  'gearcache-open': './assets/prop-gearcache-open.webp',

  // Underwater Vault Doors & Armored Bulkhead Blast Gates
  'vault-door-plate': './assets/prop-vault-door-plate.webp',
  'vault-handwheel': './assets/prop-vault-handwheel.webp',
  'blast-gate-leaf': './assets/prop-blast-gate-leaf.webp',

  // Topside Environment Structures & Props (Vector People Untouched)
  'tiki-gazebo': './assets/surf-tiki-gazebo.webp',
  'umbrella-coral': './assets/surf-umbrella-coral.webp',
  'umbrella-teal': './assets/surf-umbrella-teal.webp',
  'umbrella-gold': './assets/surf-umbrella-gold.webp',
  'party-cooler-boombox': './assets/surf-party-cooler-boombox.webp',
  'scuba-gear-rack': './assets/surf-scuba-gear-rack.webp',
  'geo-awning': './assets/surf-geo-awning.webp',
  'dive-van': './assets/surf-dive-van.webp',
  'snowcat': './assets/surf-snowcat.webp',
  'cedar-hottub': './assets/surf-cedar-hottub.webp',
  'party-raft': './assets/surf-party-raft.webp',

  // Shared existing high-res surface structures for topside hangouts & victory photo
  'research-dome': './assets/surf-research-dome.webp',
  'palapa': './assets/surf-palapa.webp',
  'dive-boat': './assets/surf-dive-boat.webp',
});

export const HYPER_REAL_UMBRELLA_KEYS = Object.freeze([
  'umbrella-coral',
  'umbrella-teal',
  'umbrella-gold',
]);

const _spriteCache = new Map();

function _startLoad(key) {
  if (typeof Image === 'undefined') return null;
  const src = HYPER_REAL_SPRITE_PATHS[key];
  if (!src) return null;
  const existing = _spriteCache.get(key);
  if (existing) return existing;

  const entry = { img: null, ready: false, failed: false };
  _spriteCache.set(key, entry);
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if ((img.naturalWidth || img.width) > 0) {
      entry.img = img;
      entry.ready = true;
    } else {
      entry.failed = true;
    }
  };
  img.onerror = () => {
    entry.failed = true;
  };
  img.src = src;
  return entry;
}

/**
 * Retrieve a decoded HTMLImageElement for `key` if ready, or kick off async load and return null.
 * Zero allocations on steady-state hit!
 */
export function getHyperRealSprite(key) {
  let entry = _spriteCache.get(key);
  if (!entry) {
    entry = _startLoad(key);
    if (!entry) return null;
  }
  return entry.ready ? entry.img : null;
}

/**
 * Preload a list of hyper-real sprite keys (or all registered keys if omitted).
 * Returns a Promise that resolves once every requested sprite finishes loading or fails safely.
 */
export function preloadHyperRealSprites(keys = null) {
  if (typeof Image === 'undefined') return Promise.resolve();
  const list = Array.isArray(keys) ? keys : Object.keys(HYPER_REAL_SPRITE_PATHS);
  return Promise.all(
    list.map((key) => {
      const entry = _startLoad(key);
      if (!entry || entry.ready || entry.failed) return Promise.resolve();
      return new Promise((resolve) => {
        const src = HYPER_REAL_SPRITE_PATHS[key];
        if (!src) return resolve();
        const check = () => {
          if (entry.ready || entry.failed) return resolve();
          setTimeout(check, 24);
        };
        setTimeout(check, 24);
      });
    })
  );
}
