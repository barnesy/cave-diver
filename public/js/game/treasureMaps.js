import { evaluateCaveSDF } from './collision.js';

/**
 * Sunken Treasure Map & Skill-Targeted Sonar Beacon System (v230).
 *
 * Divers discover sealed waterproof brass-tube Treasure Maps hidden along cave routes.
 * Each map unmistakably displays the exact Gameplay Skill its linked Vault Chest will boost
 * (Speed, Silt-Piercing Lamp, Always-On Wide Sonar, Cold & Depth, Armor & Hydro-Shield, or Stealth)
 * and locks a live pulsing Beacon onto the player's Sonar so they can hunt it down.
 */

export const TREASURE_SKILL_PROFILES = Object.freeze({
  speed: Object.freeze({
    id: 'speed',
    icon: '⚡',
    label: 'PROPULSION & SPEED',
    short: 'SPEED',
    verb: 'Boosts Swim Speed, DPV & Hydro-Dash',
    color: '#34d399',
    rgb: '52, 211, 153',
  }),
  visibility: Object.freeze({
    id: 'visibility',
    icon: '🔦',
    label: 'SILT-PIERCING OPTICS',
    short: 'SILT LAMP',
    verb: 'Cuts Cave Silt & Extends Torch Reach',
    color: '#fde047',
    rgb: '253, 224, 71',
  }),
  sonar: Object.freeze({
    id: 'sonar',
    icon: '📡',
    label: 'WIDE TRACKING SONAR',
    short: 'SONAR',
    verb: 'Always-On Wide Sweep · Tracks Chests & Threats',
    color: '#38bdf8',
    rgb: '56, 189, 248',
  }),
  resistance: Object.freeze({
    id: 'resistance',
    icon: '❄️',
    label: 'COLD & CRUSH DEPTH',
    short: 'DEPTH RES',
    verb: 'Cold Resistance, Depth Clarity & Start Gas',
    color: '#67e8f9',
    rgb: '103, 232, 249',
  }),
  armor: Object.freeze({
    id: 'armor',
    icon: '🛡️',
    label: 'ARMOR & HYDRO-SHIELD',
    short: 'SHIELD',
    verb: 'Damage Reduction & Rechargeable Hydro-Shield',
    color: '#60a5fa',
    rgb: '96, 165, 250',
  }),
  stealth: Object.freeze({
    id: 'stealth',
    icon: '🥷',
    label: 'ABYSSAL STEALTH',
    short: 'STEALTH',
    verb: 'Slashes Predator Detection & Wildlife Startle',
    color: '#c084fc',
    rgb: '192, 132, 252',
  }),
});

export const TREASURE_SKILL_ORDER = Object.freeze([
  'speed',
  'visibility',
  'sonar',
  'resistance',
  'armor',
  'stealth',
]);

export function getTreasureSkillProfile(skillId) {
  return (skillId && TREASURE_SKILL_PROFILES[skillId]) || TREASURE_SKILL_PROFILES.speed;
}

function _hashMapSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick the most exciting skill focus for a Treasure Map — strongly favoring
 * skills where the diver still has unowned chest/legendary drops!
 */
export function chooseTreasureMapSkill({
  chestPool = [],
  foundGearMap = null,
  usedSkills = [],
  rng = Math.random,
} = {}) {
  const found = foundGearMap && typeof foundGearMap === 'object' ? foundGearMap : {};
  const used = new Set(Array.isArray(usedSkills) ? usedSkills : []);
  const unownedBySkill = [];
  for (const skillId of TREASURE_SKILL_ORDER) {
    if (used.has(skillId)) continue;
    const matches = chestPool.filter(
      (d) => d.skillId === skillId && !found[`${d.slot}:${d.itemId}`]
    );
    if (matches.length > 0) {
      // Weight slightly higher if a Legendary is still unowned in this skill
      const hasLeg = matches.some((d) => d.tier === 'legendary');
      unownedBySkill.push({ skillId, weight: matches.length + (hasLeg ? 1.5 : 0) });
    }
  }
  if (unownedBySkill.length > 0) {
    const total = unownedBySkill.reduce((acc, x) => acc + x.weight, 0);
    let pick = (Number(rng()) || 0) * total;
    for (const entry of unownedBySkill) {
      pick -= entry.weight;
      if (pick <= 0) return entry.skillId;
    }
    return unownedBySkill[0].skillId;
  }
  const available = TREASURE_SKILL_ORDER.filter((id) => !used.has(id));
  const pool = available.length > 0 ? available : TREASURE_SKILL_ORDER;
  return pool[Math.floor((Number(rng()) || 0) * pool.length) % pool.length];
}

/**
 * Deterministically spawn 1–2 waterproof Treasure Maps on an expedition dive.
 * Each map links to a deeper Treasure Chest (marking it as a Skill Vault Chest)
 * so picking up the map fires an unmistakable Skill Sonar Beacon straight to that chest.
 */
export function createTreasureMapsForLevel(
  level,
  {
    chests = [],
    chestPool = [],
    foundGearMap = null,
    seed = null,
    excludePoints = [],
  } = {}
) {
  if (!level || level.isProvingGrounds) return [];
  const segs = Array.isArray(level.segments) ? level.segments : [];
  if (segs.length < 2 || !Array.isArray(chests) || chests.length === 0) return [];

  const spawnX = level.spawn?.x ?? 10;
  const spawnY = level.spawn?.y ?? 2;
  const seedVal = Number.isFinite(seed)
    ? (seed >>> 0)
    : _hashMapSeed(`tmap:${level.id || 'site'}:${chests.length}:${Date.now() ^ Math.floor(Math.random() * 1e9)}`);

  let s = (seedVal || 4242) >>> 0;
  const nextRng = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // Prefer linking deeper chests first (vault / grotto chests make the best sonar hunts!)
  const sortedChests = [...chests].sort((a, b) => {
    const scoreA = (a.isMapVault ? 100 : 0) + Math.hypot(a.x - spawnX, a.y - spawnY);
    const scoreB = (b.isMapVault ? 100 : 0) + Math.hypot(b.x - spawnX, b.y - spawnY);
    return scoreB - scoreA;
  });

  // 1 map on standard sites; 2 maps on grand deep expeditions with 3+ chests
  const desiredCount = Math.min(
    sortedChests.length,
    chests.length >= 3 && (segs.length >= 10 || (level.maxDepthM || 0) >= 80) ? 2 : 1
  );

  const maps = [];
  const usedSkills = [];
  const mapFracs = [0.22 + nextRng() * 0.14, 0.44 + nextRng() * 0.12];

  for (let i = 0; i < desiredCount; i++) {
    const targetChest = sortedChests[i];
    if (!targetChest) continue;

    const segIdx = Math.max(
      0,
      Math.min(segs.length - 1, Math.floor(segs.length * mapFracs[i % mapFracs.length]))
    );
    const seg = segs[segIdx];
    const ax = seg.x1 ?? seg.ax ?? spawnX;
    const ay = seg.y1 ?? seg.ay ?? spawnY + 8;
    const bx = seg.x2 ?? seg.bx ?? ax;
    const by = seg.y2 ?? seg.by ?? ay;
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const r = Math.max(1.2, (seg.r ?? seg.ra ?? seg.radius ?? 3.0) * 0.48);
    const sign = nextRng() < 0.5 ? -1 : 1;

    const candidates = [
      { x: mx + sign * r * 0.5, y: my + r * 0.3 },
      { x: mx - sign * r * 0.45, y: my - r * 0.25 },
      { x: mx, y: my },
    ];

    let best = null;
    for (const pt of candidates) {
      if (Math.hypot(pt.x - spawnX, pt.y - spawnY) < 7) continue;
      if (Math.hypot(pt.x - targetChest.x, pt.y - targetChest.y) < 9) continue;
      if (excludePoints.some((ep) => Math.hypot(pt.x - ep.x, pt.y - ep.y) < 5)) continue;
      if (maps.some((m) => Math.hypot(pt.x - m.x, pt.y - m.y) < 10)) continue;
      if (evaluateCaveSDF(level, pt.x, pt.y) < -0.6) {
        best = pt;
        break;
      }
    }
    if (!best) {
      // Safe fallback along an earlier navigable segment midpoint
      for (let k = Math.max(0, segIdx - 1); k < segs.length; k++) {
        const sg = segs[k];
        const fx = ((sg.x1 ?? sg.ax ?? spawnX) + (sg.x2 ?? sg.bx ?? spawnX)) * 0.5;
        const fy = ((sg.y1 ?? sg.ay ?? spawnY) + (sg.y2 ?? sg.by ?? spawnY)) * 0.5;
        if (Math.hypot(fx - targetChest.x, fy - targetChest.y) < 8) continue;
        if (evaluateCaveSDF(level, fx, fy) < -0.55) {
          best = { x: fx, y: fy };
          break;
        }
      }
    }
    if (!best) continue;

    const skillId =
      targetChest.skillFocus && !usedSkills.includes(targetChest.skillFocus)
        ? targetChest.skillFocus
        : chooseTreasureMapSkill({ chestPool, foundGearMap, usedSkills, rng: nextRng });
    usedSkills.push(skillId);
    const skill = getTreasureSkillProfile(skillId);

    // Stamp the target chest so opening it is guaranteed to target this exact Skill + Vault prestige!
    targetChest.isMapVault = true;
    targetChest.skillFocus = skill.id;
    targetChest.linkedMapId = `tmap-${level.id || 's'}-${i + 1}`;
    targetChest.chestTier = 'vault';
    targetChest.name = `${skill.short} Vault Chest`;
    targetChest.beamColor = skill.color;

    maps.push({
      id: targetChest.linkedMapId,
      skillId: skill.id,
      skillLabel: skill.label,
      skillShort: skill.short,
      skillIcon: skill.icon,
      skillVerb: skill.verb,
      color: skill.color,
      rgb: skill.rgb,
      targetChestId: targetChest.id,
      targetChestName: targetChest.name,
      targetX: targetChest.x,
      targetY: targetChest.y,
      x: Math.round(best.x * 100) / 100,
      y: Math.round(best.y * 100) / 100,
      claimed: false,
      claimAnim: 0,
      bobPhase: nextRng() * Math.PI * 2,
    });
  }

  return maps;
}

/**
 * Claim a discovered Treasure Map and lock a live Sonar Beacon onto its linked gear chest.
 */
export function claimTreasureMap(session, map) {
  if (!session || !map || map.claimed) return null;
  map.claimed = true;
  map.claimAnim = 0.01;
  if (!Array.isArray(session.activeTreasureBeacons)) {
    session.activeTreasureBeacons = [];
  }
  const linkedChest = (session.treasureChests || []).find((c) => c.id === map.targetChestId) || null;
  if (linkedChest) {
    linkedChest.beaconRevealed = true;
    linkedChest.skillFocus = map.skillId;
  }
  const tx = linkedChest ? linkedChest.x : map.targetX;
  const ty = linkedChest ? linkedChest.y : map.targetY;
  const skill = getTreasureSkillProfile(map.skillId);
  const beacon = {
    id: `beacon-${map.id}`,
    mapId: map.id,
    chestId: map.targetChestId,
    chestName: linkedChest?.name || map.targetChestName || `${skill.short} Vault Chest`,
    skillId: skill.id,
    skillLabel: skill.label,
    skillShort: skill.short,
    skillIcon: skill.icon,
    skillVerb: skill.verb,
    color: skill.color,
    rgb: skill.rgb,
    x: tx,
    y: ty,
    claimedAt: session.elapsedSec || 0,
    completed: Boolean(linkedChest?.opened),
  };
  const existingIdx = session.activeTreasureBeacons.findIndex((b) => b.chestId === beacon.chestId);
  if (existingIdx >= 0) {
    session.activeTreasureBeacons[existingIdx] = beacon;
  } else {
    session.activeTreasureBeacons.push(beacon);
  }
  return beacon;
}

/**
 * Resolve/clear a Treasure Map Sonar Beacon once its linked chest has been opened.
 */
export function resolveTreasureBeaconOnChestOpen(session, chestId) {
  if (!session || !chestId || !Array.isArray(session.activeTreasureBeacons)) return false;
  let resolved = false;
  for (const b of session.activeTreasureBeacons) {
    if (b.chestId === chestId && !b.completed) {
      b.completed = true;
      resolved = true;
    }
  }
  return resolved;
}
