import {
  DEFAULT_RIG_LIVERY,
  GEAR_SET_SYNERGIES,
  getAllGearCatalogEntries,
  getGearItemBySlot,
  getGearTierMeta,
  getSetsForGearItem,
  sanitizeRigLivery,
} from './rigLivery.js';
import {
  GEAR_ARCHETYPES,
  SET_TIER_BONUSES,
  WORLD_CACHE_BY_KEY,
  CHEST_GEAR_DROPS,
  formatStatPills,
  getGearItemStats,
} from './gearStats.js';
import { BOSS_BOUNTIES } from './bossBounties.js';

/**
 * Sets & Legendaries Codex Data & Filter Engine (v270).
 *
 * Pure zero-DOM ES module aggregating all 8 tiered Armor Sets, 9 Ultra-Rare Legendaries,
 * 27 Mythic Relics & Guardian Drysuits, and full catalog entries with ownership status,
 * acquisition provenance, stat pills, and live rig-preview builders.
 */

export const CODEX_SLOT_META = Object.freeze({
  suit: Object.freeze({ slot: 'suit', field: 'suitId', setKey: 'suits', label: 'Drysuit', icon: '🤿' }),
  trim: Object.freeze({ slot: 'trim', field: 'trimId', setKey: 'trims', label: 'Trim & Fins', icon: '🩴' }),
  headgear: Object.freeze({ slot: 'headgear', field: 'headgearId', setKey: 'headgears', label: 'Headgear', icon: '🪖' }),
  visor: Object.freeze({ slot: 'visor', field: 'visorId', setKey: 'visors', label: 'Visor Lens', icon: '🕶️' }),
  tank: Object.freeze({ slot: 'tank', field: 'tankId', setKey: 'tanks', label: 'Twin Tanks', icon: '🫧' }),
  torch: Object.freeze({ slot: 'torch', field: 'torchId', setKey: 'torches', label: 'Primary Torch', icon: '🔦' }),
  scooter: Object.freeze({ slot: 'scooter', field: 'scooterId', setKey: 'scooters', label: 'DPV Scooter', icon: '🚤' }),
  harpoon: Object.freeze({ slot: 'harpoon', field: 'harpoonId', setKey: 'harpoons', label: 'Harpoon', icon: '🔱' }),
  patch: Object.freeze({ slot: 'patch', field: 'patchId', setKey: 'patches', label: 'Shoulder Patch', icon: '🎖️' }),
});

export const CODEX_SLOT_ORDER = Object.freeze([
  'suit',
  'trim',
  'headgear',
  'visor',
  'tank',
  'torch',
  'scooter',
  'harpoon',
  'patch',
]);

export const CODEX_ORIGIN_META = Object.freeze({
  legendary: Object.freeze({ id: 'legendary', label: 'Treasure Chests & Maps', icon: '🔥', color: '#fb923c' }),
  boss: Object.freeze({ id: 'boss', label: 'Boss Guardian Trophy', icon: '🏆', color: '#c084fc' }),
  world: Object.freeze({ id: 'world', label: 'Sunken World Cache', icon: '🗺️', color: '#38bdf8' }),
  chest: Object.freeze({ id: 'chest', label: 'Rare Chest Drop', icon: '🧰', color: '#fde047' }),
  milestone: Object.freeze({ id: 'milestone', label: 'Career Milestone', icon: '🎖️', color: '#34d399' }),
});

const BOUNTY_BY_TROPHY_ID = new Map(
  BOSS_BOUNTIES.map((b) => [b.trophyRelicId, b])
);

const CHEST_DROP_KEYS = new Set(
  (Array.isArray(CHEST_GEAR_DROPS) ? CHEST_GEAR_DROPS : []).map((d) => `${d.slot}:${d.itemId}`)
);

function _isOwned(unlocked, setKey, itemId) {
  if (!unlocked || !setKey) return false;
  const set = unlocked[setKey];
  if (set instanceof Set) return set.has(itemId);
  if (Array.isArray(set)) return set.includes(itemId);
  return false;
}

function _classifyOrigin(slot, item, tierId) {
  const key = `${slot}:${item.id}`;
  if (tierId === 'legendary') {
    return {
      category: 'legendary',
      label: 'Treasure Chests & Legendary Maps',
      detail: item.unlockHint || 'Ultra-Rare Sunken Treasure Chest & Vault Map drop',
      icon: '🔥',
      bounty: null,
      cache: null,
    };
  }
  if (item.trophyRelicId) {
    const bounty = BOUNTY_BY_TROPHY_ID.get(item.trophyRelicId) || null;
    return {
      category: 'boss',
      label: bounty ? `${bounty.contractCode} · ${bounty.watersRumor}` : 'Abyssal Guardian Relic',
      detail: bounty
        ? `Defeat the hidden guardian in ${bounty.watersRumor} (${bounty.codename})`
        : (item.unlockHint || 'Hidden Secret Lair Boss Trophy'),
      icon: '🏆',
      bounty,
      cache: null,
    };
  }
  const cache = WORLD_CACHE_BY_KEY.get(key) || null;
  if (cache || item.source === 'world') {
    return {
      category: 'world',
      label: cache ? `World Cache · ${cache.siteName}` : 'Sunken World Cache',
      detail: cache?.clue || item.unlockHint || 'Hidden in a sunken expedition cache',
      icon: '🗺️',
      bounty: null,
      cache,
    };
  }
  if (CHEST_DROP_KEYS.has(key) || item.source === 'chest') {
    return {
      category: 'chest',
      label: 'Sunken Treasure Chest Drop',
      detail: item.unlockHint || 'Rare drop from sunken expedition treasure chests',
      icon: '🧰',
      bounty: null,
      cache: null,
    };
  }
  return {
    category: 'milestone',
    label: 'Career Milestone',
    detail: item.unlockHint || 'Unlocked through expedition career mastery',
    icon: '🎖️',
    bounty: null,
    cache: null,
  };
}

function _enrichItemEntry(entry, unlocked) {
  const { slot, field, setKey, item, tier } = entry;
  const slotMeta = CODEX_SLOT_META[slot] || { slot, field, setKey, label: entry.categoryLabel || slot, icon: '⚙️' };
  const statsObj = getGearItemStats(slot, item.id) || {};
  const statPills = formatStatPills(statsObj.stats || {});
  const origin = _classifyOrigin(slot, item, tier.id);
  const memberSets = getSetsForGearItem(slot, item.id) || [];
  return {
    key: `${slot}:${item.id}`,
    slot,
    field,
    setKey,
    slotLabel: slotMeta.label,
    slotIcon: slotMeta.icon,
    item,
    tier,
    owned: _isOwned(unlocked, setKey, item.id),
    stats: statsObj.stats || {},
    statPills,
    power: statsObj.power || null,
    fx: item.fx || null,
    origin,
    memberSets: memberSets.map((s) => ({ id: s.id, name: s.name, icon: s.icon, color: s.color })),
  };
}

/**
 * Build the complete structured Codex dataset for Armor Sets, Legendaries, Mythics & full catalog.
 */
export function buildGearCodexData(unlocked = null) {
  const rawCatalog = getAllGearCatalogEntries();
  const byKey = new Map();
  const allItems = [];

  for (const entry of rawCatalog) {
    const enriched = _enrichItemEntry(entry, unlocked);
    byKey.set(enriched.key, enriched);
    allItems.push(enriched);
  }

  const sets = GEAR_SET_SYNERGIES.map((setDef) => {
    const bonusDef = SET_TIER_BONUSES[setDef.id] || {};
    const archetypeId = bonusDef.archetype || 'explorer';
    const archetype = GEAR_ARCHETYPES[archetypeId] || {
      id: archetypeId,
      icon: '✨',
      label: archetypeId,
      color: setDef.color || '#38bdf8',
      tagline: '',
    };

    const previewPatch = {};
    const pieces = (setDef.slots || []).map((slotReq) => {
      const primaryId = slotReq.ids?.[0];
      const existing = primaryId ? byKey.get(`${slotReq.slot}:${primaryId}`) : null;
      const fallbackItem = !existing && primaryId ? getGearItemBySlot(slotReq.slot, primaryId) : null;
      const pieceEntry = existing || (fallbackItem
        ? _enrichItemEntry(
          {
            slot: slotReq.slot,
            field: slotReq.field,
            setKey: CODEX_SLOT_META[slotReq.slot]?.setKey || '',
            item: fallbackItem,
            tier: getGearTierMeta(fallbackItem.tier),
          },
          unlocked
        )
        : null);
      if (slotReq.field && primaryId) {
        previewPatch[slotReq.field] = primaryId;
      }
      const anyOwned = (slotReq.ids || []).some((id) =>
        _isOwned(unlocked, CODEX_SLOT_META[slotReq.slot]?.setKey, id)
      );
      return {
        slot: slotReq.slot,
        field: slotReq.field,
        ids: slotReq.ids || [],
        primaryId,
        owned: anyOwned,
        entry: pieceEntry,
      };
    });

    const ownedCount = pieces.filter((p) => p.owned).length;
    const totalCount = pieces.length;
    const tierMeta = getGearTierMeta(setDef.tier || 'epic');

    return {
      id: setDef.id,
      name: setDef.name,
      icon: setDef.icon,
      tier: tierMeta,
      color: setDef.color || '#38bdf8',
      rgb: setDef.rgb || '56, 189, 248',
      secret: Boolean(setDef.secret),
      required: setDef.required || totalCount,
      auraName: setDef.auraName || '',
      auraDesc: setDef.auraDesc || '',
      archetype,
      capstoneReq: bonusDef.capstoneReq || totalCount,
      tier2: bonusDef.tier2 || null,
      tierFull: bonusDef.tierFull || null,
      pieces,
      ownedCount,
      totalCount,
      completed: totalCount > 0 && ownedCount >= totalCount,
      previewPatch,
    };
  });

  const legendaries = allItems
    .filter((e) => e.tier.id === 'legendary')
    .sort((a, b) => CODEX_SLOT_ORDER.indexOf(a.slot) - CODEX_SLOT_ORDER.indexOf(b.slot));

  const mythics = allItems
    .filter((e) => e.tier.id === 'mythic')
    .sort((a, b) => {
      const order = { boss: 0, world: 1, chest: 2, milestone: 3 };
      const diff = (order[a.origin.category] ?? 9) - (order[b.origin.category] ?? 9);
      if (diff !== 0) return diff;
      return (a.item.name || '').localeCompare(b.item.name || '');
    });

  const summary = {
    totalSets: sets.length,
    completedSets: sets.filter((s) => s.completed).length,
    totalLegendaries: legendaries.length,
    ownedLegendaries: legendaries.filter((x) => x.owned).length,
    totalMythics: mythics.length,
    ownedMythics: mythics.filter((x) => x.owned).length,
    totalGear: allItems.length,
    ownedGear: allItems.filter((x) => x.owned).length,
  };

  return {
    sets,
    legendaries,
    mythics,
    allItems,
    byKey,
    summary,
  };
}

/**
 * Filter Armor Sets by search query, archetype, and ownership status.
 */
export function filterCodexSets(sets, { query = '', archetype = 'all', ownership = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return (sets || []).filter((s) => {
    if (archetype && archetype !== 'all' && s.archetype?.id !== archetype) return false;
    if (ownership === 'owned' && !s.completed) return false;
    if (ownership === 'missing' && s.completed) return false;
    if (!q) return true;
    const hay = [
      s.name,
      s.auraName,
      s.auraDesc,
      s.archetype?.label,
      s.tier2?.label,
      s.tier2?.desc,
      s.tierFull?.label,
      s.tierFull?.desc,
      ...s.pieces.map((p) => `${p.entry?.item?.name || ''} ${p.entry?.slotLabel || ''} ${p.entry?.origin?.label || ''}`),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Filter Legendary / Mythic items by search query, slot, origin category, and ownership.
 */
export function filterCodexItems(items, { query = '', slot = 'all', origin = 'all', ownership = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return (items || []).filter((e) => {
    if (slot && slot !== 'all' && e.slot !== slot) return false;
    if (origin && origin !== 'all' && e.origin?.category !== origin) return false;
    if (ownership === 'owned' && !e.owned) return false;
    if (ownership === 'missing' && e.owned) return false;
    if (!q) return true;
    const hay = [
      e.item?.name,
      e.slotLabel,
      e.tier?.badge,
      e.power?.name,
      e.power?.desc,
      e.fx?.name,
      e.fx?.desc,
      e.origin?.label,
      e.origin?.detail,
      ...(e.statPills || []),
      ...(e.memberSets || []).map((ms) => ms.name),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Build a sanitized preview rig with one Codex item overlaid onto a base rig.
 */
export function applyCodexItemToLivery(baseLivery, slot, itemId) {
  const meta = CODEX_SLOT_META[slot];
  if (!meta) return sanitizeRigLivery(baseLivery || DEFAULT_RIG_LIVERY);
  return sanitizeRigLivery({
    ...(baseLivery || DEFAULT_RIG_LIVERY),
    [meta.field]: itemId,
  });
}

/**
 * Build a sanitized preview rig with all pieces of an Armor Set applied onto a base rig.
 */
export function applyCodexSetToLivery(baseLivery, setEntry) {
  if (!setEntry?.previewPatch) return sanitizeRigLivery(baseLivery || DEFAULT_RIG_LIVERY);
  return sanitizeRigLivery({
    ...(baseLivery || DEFAULT_RIG_LIVERY),
    ...setEntry.previewPatch,
  });
}

/**
 * Build an all-Legendary showcase rig (every major slot outfitted in its Ultra-Rare Legendary).
 */
export function buildAllLegendaryPreviewRig(codexData) {
  const patch = { ...DEFAULT_RIG_LIVERY };
  for (const leg of codexData?.legendaries || []) {
    if (leg.field && leg.item?.id) {
      patch[leg.field] = leg.item.id;
    }
  }
  return sanitizeRigLivery(patch);
}
