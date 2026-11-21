/**
 * Diver Gear Workshop, Custom Rig Liveries, Technical Torch Optics & Milestone Patches (v138).
 * Pure data catalog, career unlock evaluation, sanitization, and animated workshop preview renderer.
 */

import { drawStyledDiverRig } from './artSprites.js';

export const SUIT_LIVERIES = Object.freeze([
  {
    id: 'zissou-classic',
    name: 'Zissou Tech',
    suitTop: '#1e293b',
    suitMid: '#0f172a',
    suitBot: '#020617',
    accent: '#ef4444',
    trim: '#38bdf8',
    finColor: '#1e293b',
    finTip: '#38bdf8',
    stageBand: '#22c55e',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'arctic-cobalt',
    name: 'Arctic Cobalt',
    suitTop: '#1e3a5f',
    suitMid: '#0c2444',
    suitBot: '#041226',
    accent: '#22d3ee',
    trim: '#e2e8f0',
    finColor: '#0369a1',
    finTip: '#bae6fd',
    stageBand: '#38bdf8',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'expedition-amber',
    name: 'Rescue Amber',
    suitTop: '#292524',
    suitMid: '#1c1917',
    suitBot: '#0c0a09',
    accent: '#f97316',
    trim: '#fbbf24',
    finColor: '#44403c',
    finTip: '#fbbf24',
    stageBand: '#f59e0b',
    unlockHint: 'Standard Expedition Issue',
    isUnlocked: () => true,
  },
  {
    id: 'abyss-emerald',
    name: 'Cenote Emerald',
    suitTop: '#064e3b',
    suitMid: '#052e23',
    suitBot: '#021a14',
    accent: '#10b981',
    trim: '#5eead4',
    finColor: '#065f46',
    finTip: '#6ee7b7',
    stageBand: '#34d399',
    unlockHint: 'Clear 3+ expedition sites',
    isUnlocked: (stats) => stats.sitesCleared >= 3,
  },
  {
    id: 'wreck-titanium',
    name: 'Wreck Titanium',
    suitTop: '#334155',
    suitMid: '#1e293b',
    suitBot: '#0f172a',
    accent: '#eab308',
    trim: '#cbd5e1',
    finColor: '#475569',
    finTip: '#facc15',
    stageBand: '#eab308',
    unlockHint: 'Clear any shipwreck or 6+ sites',
    isUnlocked: (stats) => stats.wreckClears >= 1 || stats.sitesCleared >= 6,
  },
  {
    id: 'krubera-obsidian',
    name: 'Abyssal Sovereign',
    suitTop: '#27272a',
    suitMid: '#18181b',
    suitBot: '#09090b',
    accent: '#a855f7',
    trim: '#e879f9',
    finColor: '#1e1b4b',
    finTip: '#c084fc',
    stageBand: '#a855f7',
    unlockHint: 'Clear 12+ sites or log 8+ species',
    isUnlocked: (stats) => stats.sitesCleared >= 12 || stats.speciesLogged >= 8,
  },
]);

export const TORCH_OPTICS = Object.freeze([
  {
    id: 'tech-led',
    name: '6500K Tech LED',
    shortLabel: '6500K LED',
    swatch: '#bae6fd',
    coreRgb: '224, 242, 254',
    shaftRgb: '186, 230, 253',
    warmRgb: '255, 224, 182',
    rangeMult: 1.0,
    siltPierce: 0.0,
    specText: 'Balanced cold-white cave LED beam',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'warm-halogen',
    name: '3200K Halogen',
    shortLabel: 'Halogen',
    swatch: '#fde047',
    coreRgb: '254, 240, 138',
    shaftRgb: '253, 224, 71',
    warmRgb: '255, 206, 128',
    rangeMult: 0.96,
    siltPierce: 0.14,
    specText: 'Warm high-CRI spectrum · +14% silt clarity',
    unlockHint: 'Standard Issue',
    isUnlocked: () => true,
  },
  {
    id: 'amber-silt',
    name: 'Amber Silt-Piercer',
    shortLabel: 'Amber Piercer',
    swatch: '#fb923c',
    coreRgb: '253, 186, 116',
    shaftRgb: '251, 146, 60',
    warmRgb: '255, 178, 92',
    rangeMult: 1.04,
    siltPierce: 0.28,
    specText: 'Low-backscatter amber · +28% silt penetration',
    unlockHint: 'Clear 2+ expedition sites',
    isUnlocked: (stats) => stats.sitesCleared >= 2,
  },
  {
    id: 'emerald-spot',
    name: '5000K Emerald Spot',
    shortLabel: 'Emerald Spot',
    swatch: '#5eead4',
    coreRgb: '167, 243, 208',
    shaftRgb: '94, 234, 212',
    warmRgb: '180, 250, 224',
    rangeMult: 1.08,
    siltPierce: 0.12,
    specText: 'Long-throw pelagic focus · +8% beam reach',
    unlockHint: 'Clear 5+ sites or log 4+ species',
    isUnlocked: (stats) => stats.sitesCleared >= 5 || stats.speciesLogged >= 4,
  },
]);

export const MILESTONE_PATCHES = Object.freeze([
  { id: 'none', icon: '—', name: 'Clean Harness', unlockHint: 'Standard', isUnlocked: () => true },
  { id: 'cave-arrow', icon: '▷', name: 'Line Arrow', unlockHint: 'Standard', isUnlocked: () => true },
  { id: 'cenote-explorer', icon: '🌴', name: 'Cenote Diver', unlockHint: '3+ clears', isUnlocked: (s) => s.sitesCleared >= 3 },
  { id: 'wreck-penetrator', icon: '⚓', name: 'Wreck Tech', unlockHint: '1+ wreck or 5+ clears', isUnlocked: (s) => s.wreckClears >= 1 || s.sitesCleared >= 5 },
  { id: 'wildlife-biologist', icon: '📷', name: 'Marine Bio', unlockHint: '5+ Field Guide species', isUnlocked: (s) => s.speciesLogged >= 5 },
  { id: 'abyss-veteran', icon: '🔱', name: 'Abyss Veteran', unlockHint: '10+ clears', isUnlocked: (s) => s.sitesCleared >= 10 },
]);

export const DEFAULT_RIG_LIVERY = Object.freeze({
  suitId: 'zissou-classic',
  torchId: 'tech-led',
  patchId: 'cave-arrow',
});

const SUIT_BY_ID = new Map(SUIT_LIVERIES.map((s) => [s.id, s]));
const TORCH_BY_ID = new Map(TORCH_OPTICS.map((t) => [t.id, t]));
const PATCH_BY_ID = new Map(MILESTONE_PATCHES.map((p) => [p.id, p]));

export function getSuitLivery(suitId) {
  return (suitId && SUIT_BY_ID.get(suitId)) || SUIT_LIVERIES[0];
}

export function getTorchOptic(torchId) {
  return (torchId && TORCH_BY_ID.get(torchId)) || TORCH_OPTICS[0];
}

export function getMilestonePatch(patchId) {
  return (patchId && PATCH_BY_ID.get(patchId)) || MILESTONE_PATCHES[0];
}

/**
 * Evaluate career progress stats from a career logbook to determine unlocked liveries, torches & patches.
 */
export function computeUnlockedLiveries(logbook = null, wreckLevelIds = null) {
  const sites =
    logbook?.cleared && typeof logbook.cleared === 'object'
      ? logbook.cleared
      : logbook?.sites && typeof logbook.sites === 'object'
        ? logbook.sites
        : {};
  let sitesCleared = 0;
  let wreckClears = 0;
  const wreckSet = wreckLevelIds instanceof Set ? wreckLevelIds : new Set(Array.isArray(wreckLevelIds) ? wreckLevelIds : []);
  for (const [siteId, rec] of Object.entries(sites)) {
    if (rec && (rec.clears > 0 || rec.score > 0 || rec.bestScore > 0)) {
      sitesCleared++;
      if (wreckSet.has(siteId) || siteId.includes('wreck') || siteId.includes('oriskany') || siteId.includes('britannic') || siteId.includes('fitzgerald') || siteId.includes('thistlegorm') || siteId.includes('u1206') || siteId.includes('zenobia') || siteId.includes('andrea-doria') || siteId.includes('victoria')) {
        wreckClears++;
      }
    }
  }
  const speciesLogged = logbook?.fieldGuide && typeof logbook.fieldGuide === 'object'
    ? Object.keys(logbook.fieldGuide).length
    : 0;
  const stats = { sitesCleared, wreckClears, speciesLogged };

  const suits = new Set();
  for (const s of SUIT_LIVERIES) if (s.isUnlocked(stats)) suits.add(s.id);
  const torches = new Set();
  for (const t of TORCH_OPTICS) if (t.isUnlocked(stats)) torches.add(t.id);
  const patches = new Set();
  for (const p of MILESTONE_PATCHES) if (p.isUnlocked(stats)) patches.add(p.id);

  return { stats, suits, torches, patches };
}

/**
 * Validate and clamp a livery selection against catalog (and optionally against unlocked sets).
 */
export function sanitizeRigLivery(raw = null, unlocked = null) {
  let suitId = typeof raw?.suitId === 'string' && SUIT_BY_ID.has(raw.suitId) ? raw.suitId : DEFAULT_RIG_LIVERY.suitId;
  let torchId = typeof raw?.torchId === 'string' && TORCH_BY_ID.has(raw.torchId) ? raw.torchId : DEFAULT_RIG_LIVERY.torchId;
  let patchId = typeof raw?.patchId === 'string' && PATCH_BY_ID.has(raw.patchId) ? raw.patchId : DEFAULT_RIG_LIVERY.patchId;

  if (unlocked) {
    if (unlocked.suits && !unlocked.suits.has(suitId)) suitId = DEFAULT_RIG_LIVERY.suitId;
    if (unlocked.torches && !unlocked.torches.has(torchId)) torchId = DEFAULT_RIG_LIVERY.torchId;
    if (unlocked.patches && !unlocked.patches.has(patchId)) patchId = DEFAULT_RIG_LIVERY.patchId;
  }
  return { suitId, torchId, patchId };
}

export function isDefaultRigLivery(livery) {
  if (!livery) return true;
  return (
    (livery.suitId || DEFAULT_RIG_LIVERY.suitId) === DEFAULT_RIG_LIVERY.suitId &&
    (livery.torchId || DEFAULT_RIG_LIVERY.torchId) === DEFAULT_RIG_LIVERY.torchId &&
    (livery.patchId || DEFAULT_RIG_LIVERY.patchId) === DEFAULT_RIG_LIVERY.patchId
  );
}

/**
 * Render a live animated preview of the customized diver rig + torch beam in the Gear Workshop modal.
 */
export function drawLiveryPreview(ctx, w, h, livery, { hasCcr = false, hasDpv = false, timeSec = 0 } = {}) {
  if (!ctx || !w || !h) return;
  const suit = getSuitLivery(livery?.suitId);
  const torch = getTorchOptic(livery?.torchId);
  const patch = getMilestonePatch(livery?.patchId);

  ctx.save();
  // Deep aquatic workshop backdrop
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#041224');
  bg.addColorStop(0.55, '#07223a');
  bg.addColorStop(1, '#020914');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle floating particles
  ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
  for (let i = 0; i < 16; i++) {
    const px = (((i * 67 + timeSec * 14) % w) + w) % w;
    const py = (((i * 41 + Math.sin(timeSec + i) * 8) % h) + h) % h;
    ctx.beginPath();
    ctx.arc(px, py, 1.2 + (i % 2) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = w * 0.34;
  const cy = h * 0.54 + Math.sin(timeSec * 1.9) * 3.5;
  const u = Math.min(w, h) * 0.32;

  // Volumetric torch cone preview using selected torch optic
  const torchX = cx + u * 0.82;
  const torchY = cy + u * 0.22;
  const coneLen = w * 0.58 * torch.rangeMult;
  const coneGrad = ctx.createRadialGradient(torchX, torchY, 4, torchX + coneLen * 0.45, torchY, coneLen * 0.68);
  coneGrad.addColorStop(0, `rgba(${torch.coreRgb}, 0.62)`);
  coneGrad.addColorStop(0.38, `rgba(${torch.shaftRgb}, 0.26)`);
  coneGrad.addColorStop(1, `rgba(${torch.shaftRgb}, 0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(torchX, torchY);
  ctx.arc(torchX, torchY, coneLen, -0.26, 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Animated trailing fin preview behind torso
  const kick = Math.sin(timeSec * 3.6) * 0.16;
  ctx.save();
  ctx.translate(cx - u * 0.85, cy + u * 0.08);
  ctx.rotate(kick);
  ctx.fillStyle = suit.finColor;
  ctx.beginPath();
  ctx.moveTo(0, -u * 0.08);
  ctx.lineTo(-u * 0.78, -u * 0.24);
  ctx.lineTo(-u * 0.82, u * 0.18);
  ctx.lineTo(0, u * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = suit.finTip;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-u * 0.78, -u * 0.24);
  ctx.lineTo(-u * 0.82, u * 0.18);
  ctx.stroke();
  ctx.restore();

  // Draw the authentic styled diver rig
  ctx.save();
  ctx.translate(cx, cy);
  drawStyledDiverRig(ctx, u, u / 0.55, false, 1, {
    hasCcr,
    hasDpv,
    dpvActive: hasDpv,
    dpvThrusting: false,
    timeSec,
    liveryPalette: {
      suitTop: suit.suitTop,
      suitMid: suit.suitMid,
      suitBot: suit.suitBot,
      accent: suit.accent,
      trim: suit.trim,
      stageBand: suit.stageBand,
      patchIcon: patch.id !== 'none' ? patch.icon : '',
    },
  });
  ctx.restore();

  // Torch canister in hand
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(torchX - 10, torchY - 4, 18, 8, 3);
  ctx.fill();
  ctx.fillStyle = torch.swatch;
  ctx.beginPath();
  ctx.arc(torchX + 8, torchY, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Corner optical telemetry tag
  ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
  ctx.textAlign = 'right';
  ctx.fillText(`${suit.name} · ${torch.shortLabel}${patch.id !== 'none' ? ` · ${patch.icon}` : ''}`, w - 12, h - 10);
  ctx.restore();
}
