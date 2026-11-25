import { getSecretCosmeticsForTrophy } from './rigLivery.js';

/**
 * 10-Guardian Abyssal Wanted Bounty Contracts (v199).
 *
 * Strictly zero-spoiler before a bounty is claimed:
 * - Only general regional waters rumors, dockside folklore tales, and atmospheric
 *   exploration/sonar clues — never exact depths, checkpoint names, level numbers,
 *   world coordinates, or boss combat mechanics.
 * - True boss identity, trophy relic, and unlocked secret cosmetics are revealed
 *   only after the player defeats the guardian and recovers its trophy relic.
 */
export const BOSS_BOUNTIES = Object.freeze([
  Object.freeze({
    id: 'bounty-cenote-maw',
    contractCode: 'BOUNTY #01',
    threatClass: 'CLASS I · KARST',
    accentColor: '#38bdf8',
    silhouetteKind: 'kraken',
    bossKind: 'cave-kraken',
    previewScale: 7.4,
    previewOffsetY: -12,
    codename: 'THE CENOTE MAW',
    watersRumor: 'Yucatan Limestone Waters',
    tale: 'Sponge divers along the jungle sinkholes whisper of violet light breathing behind solid limestone far below the sunlit basin. Sweep an active sonar pulse along the deepest blind wall — some rock faces are only a veil.',
    bountyPts: 2500,
    levelId: 'cenote-el-abismo',
    trophyRelicId: 'l1-kraken-crown',
    trophyName: 'Abyssal Kraken Crown',
    trueName: "XIBALBA'S MAW",
    trueTitle: 'Ancient Bioluminescent Cave Kraken',
  }),
  Object.freeze({
    id: 'bounty-iron-angler',
    contractCode: 'BOUNTY #02',
    threatClass: 'CLASS II · WRECK',
    accentColor: '#f59e0b',
    silhouetteKind: 'iron',
    bossKind: 'iron-leviathan',
    previewScale: 9.2,
    previewOffsetY: 4,
    codename: 'THE IRON ANGLER',
    watersRumor: 'Red Sea Cargo Lanes',
    tale: 'Salvage crews swore a sunken wartime freighter’s lowest engine hold still beats like a furnace heart. Follow the dull metallic thrum beyond the dark cargo decks, where corroded iron hides a forgotten bulkhead.',
    bountyPts: 2750,
    levelId: 'ss-thistlegorm-wreck',
    trophyRelicId: 'thistlegorm-engine-core',
    trophyName: 'Sunken Engine Core',
    trueName: 'IRON LEVIATHAN MK-IV',
    trueTitle: 'Submerged WWII Angler-Mech Engine Sentinel',
  }),
  Object.freeze({
    id: 'bounty-glacier-wyrm',
    contractCode: 'BOUNTY #03',
    threatClass: 'CLASS III · ARCTIC',
    accentColor: '#7dd3fc',
    silhouetteKind: 'frost',
    bossKind: 'frost-wyrm',
    previewScale: 8.6,
    previewOffsetY: 2,
    codename: 'THE GLACIER WYRM',
    watersRumor: 'East Greenland Drift Ice',
    tale: 'Kayakers along the northern icebergs tell of singing turquoise walls that rattle hydrophones in a single chime. Listen for hollow crystalline echoes where the submerged glacier shelves drop into cobalt dark.',
    bountyPts: 3000,
    levelId: 'scoresby-sund-iceberg',
    trophyRelicId: 'scoresby-frost-heart',
    trophyName: 'Heart of Borealis',
    trueName: 'BOREALIS WYRM',
    trueTitle: 'Crystalline Glacial Fjord Leviathan',
  }),
  Object.freeze({
    id: 'bounty-selenite-fang',
    contractCode: 'BOUNTY #04',
    threatClass: 'CLASS III · CRYSTAL',
    accentColor: '#c084fc',
    silhouetteKind: 'crystal',
    bossKind: 'crystal-basilisk',
    previewScale: 8.8,
    previewOffsetY: 2,
    codename: 'THE SELENITE FANG',
    watersRumor: 'Ural Gypsum Caverns',
    tale: 'Cold-water cavers charting the pale Siberian gypsum labyrinth report torchbeams bending backward off living crystal scales. Somewhere in the quietest flooded gallery, a false mineral seam rings hollow to sonar.',
    bountyPts: 2900,
    levelId: 'orda-crystal-maze',
    trophyRelicId: 'orda-selenite-prism',
    trophyName: 'Crown of Selenite',
    trueName: 'CRYSTAL BASILISK',
    trueTitle: 'Iridescent Ural Selenite Mirror Wyrm',
  }),
  Object.freeze({
    id: 'bounty-solar-serpent',
    contractCode: 'BOUNTY #05',
    threatClass: 'CLASS III · PELAGIC',
    accentColor: '#facc15',
    silhouetteKind: 'solar',
    bossKind: 'solar-leviathan',
    previewScale: 8.8,
    previewOffsetY: 2,
    codename: 'THE SOLAR SERPENT',
    watersRumor: 'Sinai Reef Drop-Off',
    tale: 'Free-divers hovering above the desert sinkhole’s outer arch claim golden caustics flare from below long after dusk. Ping the shadowed coral flank where open-ocean blue swallows the reef shaft.',
    bountyPts: 2800,
    levelId: 'blue-hole-dahab-arch',
    trophyRelicId: 'bluehole-solar-prism',
    trophyName: 'Solar Reef Prism',
    trueName: 'SOLAR LEVIATHAN',
    trueTitle: 'Radiant Red Sea Caustic Reef Serpent',
  }),
  Object.freeze({
    id: 'bounty-chimney-titan',
    contractCode: 'BOUNTY #06',
    threatClass: 'CLASS IV · VOLCANIC',
    accentColor: '#fb7185',
    silhouetteKind: 'volcanic',
    bossKind: 'thermal-nautilus',
    previewScale: 9.0,
    previewOffsetY: 2,
    codename: 'THE CHIMNEY TITAN',
    watersRumor: 'North Iceland Thermal Rift',
    tale: 'Skippers off the northern fjords haul up scorched lines whenever the submerged mineral spires groan. Drift past the scalding plumes and sound the dark basalt floor where heat shimmer hides a sealed vault.',
    bountyPts: 3100,
    levelId: 'strytan-hydrothermal-chimneys',
    trophyRelicId: 'strytan-magma-pearl',
    trophyName: 'Heart of the Thermal Spire',
    trueName: 'HYDROTHERMAL NAUTILUS',
    trueTitle: 'Armored Volcanic Smectite Spire Titan',
  }),
  Object.freeze({
    id: 'bounty-north-sea-phantom',
    contractCode: 'BOUNTY #07',
    threatClass: 'CLASS IV · U-BOAT',
    accentColor: '#94a3b8',
    silhouetteKind: 'uboat',
    bossKind: 'phantom-uboat',
    previewScale: 8.4,
    previewOffsetY: 4,
    codename: 'THE NORTH SEA PHANTOM',
    watersRumor: 'Cold North Sea Floor',
    tale: 'Trawlers drifting over a forgotten wartime submarine wreck still catch phantom telegraph ticks and twin props humming in empty silt. Sound the shadowed hull with active sonar — the steel keeps a hidden berth.',
    bountyPts: 3400,
    levelId: 'u1206-north-sea-sub',
    trophyRelicId: 'u1206-phantom-compass',
    trophyName: 'Phantom U-Boat Gyrocompass',
    trueName: 'PHANTOM TORPEDO SENTINEL',
    trueTitle: 'Haunted North Sea Type-VIIC U-Boat Leviathan',
  }),
  Object.freeze({
    id: 'bounty-sunken-warden',
    contractCode: 'BOUNTY #08',
    threatClass: 'CLASS IV · ANCIENT',
    accentColor: '#fbbf24',
    silhouetteKind: 'atlantis',
    bossKind: 'orichalcum-colossus',
    previewScale: 8.6,
    previewOffsetY: 2,
    codename: 'THE SUNKEN WARDEN',
    watersRumor: 'Bahamas Megalith Shelf',
    tale: 'Treasure hunters mapping the pale submerged stone blocks off the island shelf swear compasses spin wildly at dusk. Probe the carved flagstones where the ancient causeway plunges into cobalt darkness.',
    bountyPts: 3200,
    levelId: 'bimini-road-megalith',
    trophyRelicId: 'bimini-orichalcum-astrolabe',
    trophyName: 'Orichalcum Astrolabe',
    trueName: 'ORICHALCUM COLOSSUS',
    trueTitle: 'Ancient Atlantean Astrolabe Guardian',
  }),
  Object.freeze({
    id: 'bounty-foundry-colossus',
    contractCode: 'BOUNTY #09',
    threatClass: 'CLASS V · INDUSTRIAL',
    accentColor: '#fb923c',
    silhouetteKind: 'foundry',
    bossKind: 'drill-wyrm',
    previewScale: 8.4,
    previewOffsetY: 2,
    codename: 'THE FOUNDRY COLOSSUS',
    watersRumor: 'Nordic Flooded Iron Mines',
    tale: 'Mine divers descending the pitch-black northern ore shafts still hear a rhythmic grinding echo from abandoned galleries. Sound the deepest flooded drift — rusted timber shoring conceals a forgotten bore.',
    bountyPts: 3500,
    levelId: 'ojamo-iron-mine',
    trophyRelicId: 'ojamo-tungsten-core',
    trophyName: 'Heart of the Iron Shaft',
    trueName: 'ABYSSAL DRILL-WYRM',
    trueTitle: 'Armored Tungsten Tunneling Leviathan',
  }),
  Object.freeze({
    id: 'bounty-abyssal-empress',
    contractCode: 'BOUNTY #10',
    threatClass: 'CLASS V · APEX',
    accentColor: '#e879f9',
    silhouetteKind: 'empress',
    bossKind: 'abyssal-empress',
    previewScale: 8.2,
    previewOffsetY: 2,
    codename: 'THE ABYSSAL EMPRESS',
    watersRumor: 'Caucasus Extreme Sumps',
    tale: 'Only the world’s deepest expedition cavers have returned from the mountain abyss speaking of a bioluminescent monarch veiled in velvet dark. Near the very floor of the deepest sump, a silent seam awaits the boldest ping.',
    bountyPts: 4000,
    levelId: 'krubera-voronya-sump',
    trophyRelicId: 'krubera-empress-diadem',
    trophyName: 'Abyssal Empress Diadem',
    trueName: 'ABYSSAL EMPRESS',
    trueTitle: 'Sovereign Bioluminescent Manta-Hydra Queen',
  }),
  Object.freeze({
    id: 'bounty-terraced-dragon',
    contractCode: 'BOUNTY #11',
    threatClass: 'CLASS IV · PACIFIC',
    accentColor: '#2dd4bf',
    silhouetteKind: 'solar',
    bossKind: 'coral-dragon',
    previewScale: 8.2,
    previewOffsetY: 3,
    codename: 'THE TERRACED DRAGON',
    watersRumor: 'Okinawa Pacific Shelf',
    tale: 'Island fishermen drifting past the stepped underwater stone ledges report glowing jade coils darting through the Kuroshio surge. Sweep an active sonar pulse along the deepest carved stone face — a hidden chamber breathes beyond the terrace.',
    bountyPts: 3450,
    levelId: 'yonaguni-submerged-monument',
    trophyRelicId: 'yonaguni-dragon-pearl',
    trophyName: 'Pearl of Ryūjin',
    trueName: "RYŪJIN'S SERPENT",
    trueTitle: 'Pacific Coral Dragon Leviathan',
  }),
  Object.freeze({
    id: 'bounty-orkney-dreadnought',
    contractCode: 'BOUNTY #12',
    threatClass: 'CLASS V · FLEET',
    accentColor: '#34d399',
    silhouetteKind: 'uboat',
    bossKind: 'spectral-dreadnought',
    previewScale: 8.0,
    previewOffsetY: 6,
    codename: 'THE ORKNEY DREADNOUGHT',
    watersRumor: 'North Atlantic Scuttled Fleet',
    tale: 'Cold-water wreck divers exploring the inverted wartime battleship in the northern sound swear twin turret gears still groan beneath the keel. Ping the shadowed armor bulkheads past the chart vault — an entire spectral citadel waits behind false steel.',
    bountyPts: 3650,
    levelId: 'sms-markgraf-scapa-flow',
    trophyRelicId: 'markgraf-fleet-heart',
    trophyName: 'Heart of Scapa Flow',
    trueName: 'SCAPA DREADNOUGHT',
    trueTitle: 'Spectral WWI Armored Battleship Leviathan',
  }),
]);

/**
 * Career Bounty Hunter Milestone Rewards (v201).
 */
export const BOUNTY_MILESTONES = Object.freeze([
  Object.freeze({
    id: 'bounty-tier-1',
    threshold: 3,
    icon: '🕶️',
    title: 'Deep Stalker',
    rewardLabel: 'Deep Stalker Visor',
    itemId: 'bounty-hunter-visor',
  }),
  Object.freeze({
    id: 'bounty-tier-2',
    threshold: 6,
    icon: '🔦',
    title: 'Leviathan Hunter',
    rewardLabel: 'Leviathan Hunter Plasma Torch',
    itemId: 'bounty-hunter-torch',
  }),
  Object.freeze({
    id: 'bounty-tier-3',
    threshold: 12,
    icon: '👑',
    title: 'Master Bounty Hunter',
    rewardLabel: 'Gilded Hunter Suit & Master Patch',
    itemId: 'bounty-hunter-suit',
  }),
]);

function hasTrophyInLogbook(logbook, relicId) {
  if (!logbook?.artifacts || typeof logbook.artifacts !== 'object' || !relicId) return false;
  if (logbook.artifacts[relicId]) return true;
  const suffix = `:${relicId}`;
  for (const key of Object.keys(logbook.artifacts)) {
    if (key.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * Resolve live Wanted Bounty Board state against the player's Career Logbook.
 * Unclaimed bounties keep true names, trophy names & secret cosmetic unlocks redacted.
 */
export function resolveBountyBoardState(logbook = null) {
  let claimedCount = 0;
  const bounties = BOSS_BOUNTIES.map((b) => {
    const claimed = hasTrophyInLogbook(logbook, b.trophyRelicId);
    if (claimed) claimedCount++;
    return {
      ...b,
      claimed,
      displayName: claimed ? b.trueName : b.codename,
      displaySubtitle: claimed ? b.trueTitle : 'UNIDENTIFIED DEEP-WATER ANOMALY',
      unlockedRewards: claimed ? getSecretCosmeticsForTrophy(b.trophyRelicId) : [],
    };
  });
  const milestones = BOUNTY_MILESTONES.map((m) => ({
    ...m,
    unlocked: claimedCount >= m.threshold,
  }));
  return {
    bounties,
    claimedCount,
    totalCount: BOSS_BOUNTIES.length,
    milestones,
  };
}

/**
 * Bespoke dark-ink nautical silhouette portraits (120×72 viewBox) for each Wanted Bounty card.
 */
export function getBossSilhouetteSvg(kind = 'kraken', accent = '#38bdf8') {
  const glow = accent || '#38bdf8';
  let shape = '';
  switch (kind) {
    case 'kraken':
      shape = `
        <path d="M44 36 C44 16, 76 16, 76 36 C76 44, 69 47, 60 47 C51 47, 44 44, 44 36 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.55" stroke-width="1.3"/>
        <path d="M48 44 C38 52, 26 48, 18 58 M53 46 C44 58, 36 62, 28 67 M60 47 C59 58, 61 63, 58 69 M67 46 C75 57, 84 61, 92 67 M72 44 C82 52, 94 48, 102 58" fill="none" stroke="#07111f" stroke-width="5.2" stroke-linecap="round"/>
        <path d="M48 44 C38 52, 26 48, 18 58 M53 46 C44 58, 36 62, 28 67 M60 47 C59 58, 61 63, 58 69 M67 46 C75 57, 84 61, 92 67 M72 44 C82 52, 94 48, 102 58" fill="none" stroke="${glow}" stroke-opacity="0.4" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="53" cy="34" r="2.6" fill="${glow}"/><circle cx="67" cy="34" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'iron':
      shape = `
        <path d="M24 38 L42 20 L80 18 L96 34 L88 54 L40 54 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.55" stroke-width="1.4"/>
        <path d="M78 18 C82 8, 94 8, 98 16" fill="none" stroke="${glow}" stroke-width="1.6"/>
        <circle cx="99" cy="18" r="3.4" fill="${glow}"/>
        <path d="M84 36 L94 42 L82 47 L92 52" fill="none" stroke="${glow}" stroke-opacity="0.7" stroke-width="1.4"/>
        <circle cx="72" cy="31" r="3" fill="${glow}"/>
      `;
      break;
    case 'frost':
      shape = `
        <path d="M16 48 Q34 18, 56 36 T98 28 L108 36 L95 44 Q74 56, 54 44 T18 58 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
        <path d="M36 27 L41 16 L46 29 M58 34 L64 20 L69 33 M80 28 L87 16 L90 29" fill="#07111f" stroke="${glow}" stroke-opacity="0.75" stroke-width="1.2"/>
        <circle cx="95" cy="34" r="2.5" fill="${glow}"/>
      `;
      break;
    case 'crystal':
      shape = `
        <polygon points="22,48 44,24 62,32 82,18 102,34 86,52 54,48 34,58" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.3"/>
        <polygon points="50,28 57,10 65,28" fill="#07111f" stroke="${glow}" stroke-width="1.2"/>
        <polygon points="68,24 76,8 82,25" fill="#07111f" stroke="${glow}" stroke-width="1.2"/>
        <circle cx="88" cy="34" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'solar':
      shape = `
        <path d="M18 46 Q42 18, 66 36 T104 32 Q84 52, 58 46 T18 56 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
        <path d="M62 24 L66 11 L72 24 L82 14 L80 28" fill="none" stroke="${glow}" stroke-width="1.6"/>
        <circle cx="91" cy="34" r="2.8" fill="${glow}"/>
      `;
      break;
    case 'volcanic':
      shape = `
        <circle cx="52" cy="38" r="21" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.4"/>
        <path d="M52 24 A14 14 0 1 1 38 38 A8 8 0 1 1 52 38" fill="none" stroke="${glow}" stroke-opacity="0.55" stroke-width="1.3"/>
        <path d="M71 32 L98 26 M72 38 L104 39 M70 45 L97 52" stroke="${glow}" stroke-opacity="0.7" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="67" cy="35" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'uboat':
      shape = `
        <path d="M16 42 Q32 30, 88 32 L106 40 L90 49 Q34 50, 16 42 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.4"/>
        <path d="M46 32 L50 18 L66 18 L70 32 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
        <line x1="57" y1="18" x2="57" y2="9" stroke="${glow}" stroke-width="1.6"/>
        <circle cx="88" cy="40" r="2.4" fill="${glow}"/><circle cx="96" cy="40" r="2.4" fill="${glow}"/>
      `;
      break;
    case 'atlantis':
      shape = `
        <circle cx="60" cy="36" r="22" fill="none" stroke="${glow}" stroke-opacity="0.55" stroke-width="1.6"/>
        <polygon points="60,12 76,36 60,60 44,36" fill="#07111f" stroke="${glow}" stroke-opacity="0.7" stroke-width="1.4"/>
        <circle cx="60" cy="36" r="6" fill="#07111f" stroke="${glow}" stroke-width="1.5"/>
        <circle cx="60" cy="36" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'foundry':
      shape = `
        <path d="M16 32 L76 26 L106 36 L76 46 L16 42 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.4"/>
        <path d="M78 27 L84 45 M86 29 L91 43 M94 32 L98 40" stroke="${glow}" stroke-opacity="0.8" stroke-width="1.6"/>
        <circle cx="64" cy="35" r="2.8" fill="${glow}"/>
      `;
      break;
    case 'empress':
    default:
      shape = `
        <path d="M60 18 C78 26, 98 20, 108 38 C92 44, 78 44, 68 54 L60 66 L52 54 C42 44, 28 44, 12 38 C22 20, 42 26, 60 18 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.4"/>
        <path d="M51 20 L55 11 L60 18 L65 11 L69 20" fill="none" stroke="${glow}" stroke-width="1.5"/>
        <circle cx="53" cy="34" r="2.4" fill="${glow}"/><circle cx="67" cy="34" r="2.4" fill="${glow}"/>
      `;
      break;
  }
  return `<svg class="bounty-silhouette-svg" viewBox="0 0 120 72" aria-hidden="true">
    <defs>
      <radialGradient id="bg-${kind}" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="${glow}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#020814" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="120" height="72" fill="url(#bg-${kind})"/>
    <circle cx="60" cy="36" r="28" fill="none" stroke="${glow}" stroke-opacity="0.16" stroke-dasharray="3 3"/>
    <line x1="12" y1="36" x2="108" y2="36" stroke="${glow}" stroke-opacity="0.1"/>
    <line x1="60" y1="6" x2="60" y2="66" stroke="${glow}" stroke-opacity="0.1"/>
    ${shape}
  </svg>`;
}
