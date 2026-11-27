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
    id: 'bounty-glacier-crab',
    contractCode: 'BOUNTY #03',
    threatClass: 'CLASS III · ARCTIC',
    accentColor: '#7dd3fc',
    silhouetteKind: 'crab',
    bossKind: 'frost-crab',
    previewScale: 8.6,
    previewOffsetY: 4,
    codename: 'THE GLACIER CRAB',
    watersRumor: 'East Greenland Drift Ice',
    tale: 'Kayakers along the northern icebergs tell of thunderous snapping claws rattling hydrophones beneath turquoise shelves. Listen for hollow crystalline echoes where the submerged glacier drops into cobalt dark.',
    bountyPts: 3000,
    levelId: 'scoresby-sund-iceberg',
    trophyRelicId: 'scoresby-frost-heart',
    trophyName: 'Heart of Borealis',
    trueName: 'BOREALIS KING CRAB',
    trueTitle: 'Colossal Glacial Arctic King Crab',
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
    id: 'bounty-solar-lobster',
    contractCode: 'BOUNTY #05',
    threatClass: 'CLASS III · PELAGIC',
    accentColor: '#fb7185',
    silhouetteKind: 'lobster',
    bossKind: 'solar-lobster',
    previewScale: 8.4,
    previewOffsetY: 3,
    codename: 'THE SOLAR LOBSTER',
    watersRumor: 'Sinai Reef Drop-Off',
    tale: 'Free-divers hovering above the desert sinkhole’s outer arch claim fiery crimson claws and golden antennae flare from below long after dusk. Ping the shadowed coral flank where open-ocean blue swallows the reef shaft.',
    bountyPts: 2800,
    levelId: 'blue-hole-dahab-arch',
    trophyRelicId: 'bluehole-solar-prism',
    trophyName: 'Solar Reef Prism',
    trueName: 'SOLAR REEF LOBSTER',
    trueTitle: 'Colossal Radiant Red Sea Reef Lobster',
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
  Object.freeze({
    id: 'bounty-voltaic-eel',
    contractCode: 'BOUNTY #13',
    threatClass: 'CLASS IV · VOLTAIC',
    accentColor: '#fde047',
    silhouetteKind: 'eel',
    bossKind: 'electric-eel',
    previewScale: 10.4,
    previewOffsetY: 4,
    codename: 'THE VOLTAIC EEL',
    watersRumor: 'Brazilian Cerrado Sinkhole',
    tale: 'Expedition teams dropping into the crystal jungle sinkhole report dive computers flickering and blue sparks arcing across submerged dolomite walls. Sound the deepest dark conduit with active sonar — a crackling cavern hums beyond the stone.',
    bountyPts: 3300,
    levelId: 'lagoa-misteriosa-abyss',
    trophyRelicId: 'lagoa-voltaic-cell',
    trophyName: 'Voltaic Abyssal Organ',
    trueName: 'VOLTAIC EMPEROR EEL',
    trueTitle: 'High-Voltage Brazilian Sinkhole Electric Eel',
  }),
  Object.freeze({
    id: 'bounty-loch-ness',
    contractCode: 'BOUNTY #14',
    threatClass: 'CLASS III · HIGHLAND',
    accentColor: '#34d399',
    silhouetteKind: 'nessie',
    bossKind: 'loch-ness',
    previewScale: 10.0,
    previewOffsetY: 16,
    codename: 'THE LOCH NESS PHANTOM',
    watersRumor: 'Northern Glacial Marble Waters',
    tale: 'Old northern cave divers whisper of a graceful long-necked silhouette gliding beneath glacial marble vaults, leaving swirling emerald wakes in silence. Sweep your active sonar along the deepest cold sump — an ancient highland loch hides behind a pale marble seam.',
    bountyPts: 3150,
    levelId: 'plura-marble-sump',
    trophyRelicId: 'plura-nessie-scale',
    trophyName: 'Highland Plesiosaur Crest',
    trueName: 'LOCH NESS LEVIATHAN',
    trueTitle: 'Ancient Highland Plesiosaur of the Deep',
  }),
  Object.freeze({
    id: 'bounty-great-white',
    contractCode: 'BOUNTY #15',
    threatClass: 'CLASS IV · APEX',
    accentColor: '#38bdf8',
    silhouetteKind: 'shark',
    bossKind: 'great-white',
    previewScale: 10.0,
    previewOffsetY: 4,
    codename: 'THE APEX PHANTOM',
    watersRumor: 'Gulf Aircraft Carrier Reef',
    tale: 'Charter skippers anchored over the sunken flattop speak of a massive silver-backed silhouette circling beneath the hangar steel. Ping your active sonar along the lowest engine bulkhead — a torn hull seam opens into a prowling abyssal trench.',
    bountyPts: 3250,
    levelId: 'uss-oriskany-carrier',
    trophyRelicId: 'oriskany-apex-tooth',
    trophyName: 'Fossil Megalodon Apex Fang',
    trueName: 'GREAT WHITE SOVEREIGN',
    trueTitle: 'Apex Gulf Carrier-Reef Great White Shark',
  }),
  Object.freeze({
    id: 'bounty-orca-whale',
    contractCode: 'BOUNTY #16',
    threatClass: 'CLASS V · SOVEREIGN',
    accentColor: '#67e8f9',
    silhouetteKind: 'orca',
    bossKind: 'orca-whale',
    previewScale: 9.8,
    previewOffsetY: 4,
    codename: 'THE ARCTIC ORCA',
    watersRumor: 'Icelandic Aurora Rift',
    tale: 'Geothermal divers exploring the northern tectonic chasm hear melodic pod-calls reverberating through solid black basalt beneath the northern lights. Sweep your active sonar past the deepest rift vault — an aurora cathedral awaits.',
    bountyPts: 3550,
    levelId: 'silfra-katla-aurora-abyss',
    trophyRelicId: 'silfra-orca-fluke',
    trophyName: 'Aurora Orca Fluke Charm',
    trueName: 'AURORA ORCA MATRIARCH',
    trueTitle: 'Sovereign Subglacial Killer Whale of the Rift',
  }),
  Object.freeze({
    id: 'bounty-giant-clam',
    contractCode: 'BOUNTY #17',
    threatClass: 'CLASS IV · NACRE',
    accentColor: '#f472b6',
    silhouetteKind: 'clam',
    bossKind: 'giant-clam',
    previewScale: 10.2,
    previewOffsetY: 6,
    codename: 'THE PEARL MONARCH',
    watersRumor: 'Micronesian Coral Lagoon Wreck',
    tale: 'Lagoon wreck guides whisper of an iridescent pink-and-teal luminescence pulsing behind the coral-blanketed stern holds of the sunken aircraft ferry. Sound your active sonar near the aft bulkhead to unveil a shimmering pearl grotto.',
    bountyPts: 3200,
    levelId: 'fujikawa-maru-chuuk',
    trophyRelicId: 'chuuk-imperial-pearl',
    trophyName: 'Imperial Tridacna Moon-Pearl',
    trueName: 'TRIDACNA PEARL EMPEROR',
    trueTitle: 'Iridescent Giant Clam Monarch of Chuuk Lagoon',
  }),
  Object.freeze({
    id: 'bounty-piranha-trio',
    contractCode: 'BOUNTY #18',
    threatClass: 'CLASS III · JUNGLE',
    accentColor: '#fb7185',
    silhouetteKind: 'piranha',
    bossKind: 'piranha-trio',
    previewScale: 10.6,
    previewOffsetY: 3,
    codename: 'THE CHOMP TRIO',
    watersRumor: 'Tulum Jungle Sinkholes',
    tale: 'Cenote guides whisper of three scarlet-bellied shadows darting in perfect triangle formation beneath the drifting forest mist. Sweep your active sonar past the sunken limestone overhangs — triple synchronized snaps guard their hidden grotto.',
    bountyPts: 3300,
    levelId: 'cenote-angelita-river',
    trophyRelicId: 'angelita-piranha-crest',
    trophyName: 'Tri-Fang Piranha Crest',
    trueName: 'CRIMSON PIRANHA TRIO',
    trueTitle: 'Synchronized Triple-Fang Jungle Cenote Pack',
  }),
  Object.freeze({
    id: 'bounty-grumpy-turtle',
    contractCode: 'BOUNTY #19',
    threatClass: 'CLASS IV · SARGASSO',
    accentColor: '#34d399',
    silhouetteKind: 'turtle',
    bossKind: 'grumpy-turtle',
    previewScale: 9.8,
    previewOffsetY: 3,
    codename: 'THE GRUMPY SHELL',
    watersRumor: 'Bermuda Sargasso Drop-Off',
    tale: 'Old island captains tell of a cantankerous ancient green sea turtle who despises noisy bubbles and guards a hidden coral terrace beyond the turquoise sea-wall arches. Sweep your active sonar along the deepest limestone shelf — if you hear a grumpy huff, step lively.',
    bountyPts: 3500,
    levelId: 'bermuda-devils-wall',
    trophyRelicId: 'bermuda-ironbrow-scute',
    trophyName: 'Ancient Ironbrow Scute Crest',
    trueName: 'OLD IRONBROW TURTLE',
    trueTitle: 'Cantankerous Ancient Sargasso Sea Turtle Sovereign',
  }),
  Object.freeze({
    id: 'bounty-venom-lionfish',
    contractCode: 'BOUNTY #20',
    threatClass: 'CLASS III · VENOM',
    accentColor: '#fb7185',
    silhouetteKind: 'lionfish',
    bossKind: 'venom-lionfish',
    previewScale: 9.6,
    previewOffsetY: 3,
    codename: 'THE PLUMED VENOM',
    watersRumor: 'Cyprus Capsized Ferry Wreck',
    tale: 'Mediterranean wreck guides warn of a dazzling crimson-and-ivory feathered silhouette fanning venomous plumes behind the deepest sealed cargo alleys of the capsized ferry. Ping your active sonar along the aft iron bulkhead to uncover her sunken ballroom.',
    bountyPts: 3350,
    levelId: 'ms-zenobia-ferry',
    trophyRelicId: 'zenobia-lionfish-plume',
    trophyName: 'Scarlet Lionfish Venom Plume',
    trueName: 'SCARLET LIONFISH QUEEN',
    trueTitle: 'Plumed Crimson-Zebra Venom Lionfish Sovereign',
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
    case 'crab':
    case 'frost':
      shape = `
        <ellipse cx="60" cy="40" rx="22" ry="15" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.4"/>
        <path d="M40 34 C24 22, 16 14, 26 10 C33 8, 38 16, 34 22 C40 20, 44 26, 44 32 M80 34 C96 22, 104 14, 94 10 C87 8, 82 16, 86 22 C80 20, 76 26, 76 32" fill="#07111f" stroke="${glow}" stroke-width="1.5"/>
        <path d="M38 42 L20 48 M40 48 L24 58 M82 42 L100 48 M80 48 L96 58" stroke="${glow}" stroke-opacity="0.7" stroke-width="2.1" stroke-linecap="round"/>
        <circle cx="52" cy="34" r="2.6" fill="${glow}"/><circle cx="68" cy="34" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'lobster':
      shape = `
        <path d="M20 42 C34 30, 56 28, 76 34 C86 36, 94 40, 100 44 L88 52 C70 50, 46 50, 26 48 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.4"/>
        <path d="M74 34 C88 18, 104 16, 106 24 C107 30, 96 32, 92 28 M72 44 C88 54, 104 54, 106 46 C107 41, 96 40, 92 44" fill="#07111f" stroke="${glow}" stroke-width="1.6"/>
        <path d="M84 32 Q100 10, 114 8 M84 36 Q102 18, 114 20" fill="none" stroke="${glow}" stroke-opacity="0.75" stroke-width="1.2"/>
        <circle cx="80" cy="37" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'eel':
      shape = `
        <path d="M12 44 Q32 18, 54 38 T98 30 L108 36 L96 42 Q76 54, 54 44 T14 54 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.7" stroke-width="1.4"/>
        <polyline points="26,34 34,24 40,34 50,22 58,34 70,22 78,32" fill="none" stroke="${glow}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="95" cy="35" r="2.7" fill="${glow}"/>
      `;
      break;
    case 'nessie':
      shape = `
        <path d="M16 50 Q32 34, 48 48 Q62 32, 74 44 C80 34, 82 18, 92 14 C100 12, 106 16, 102 22 C96 24, 92 22, 88 26 C84 34, 86 48, 76 54 L20 56 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.7" stroke-width="1.4"/>
        <path d="M44 52 L36 64 L52 56 M68 52 L64 65 L78 56" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.3"/>
        <circle cx="96" cy="17" r="2.4" fill="${glow}"/>
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
    case 'shark':
      shape = `
        <path d="M16 38 Q38 22, 74 26 L84 12 L92 28 Q106 32, 108 38 Q94 48, 66 48 L56 58 L50 48 Q30 48, 16 38 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.4"/>
        <path d="M16 38 L6 24 L12 38 L6 52 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
        <circle cx="88" cy="35" r="2.6" fill="${glow}"/>
      `;
      break;
    case 'orca':
      shape = `
        <path d="M18 40 Q36 22, 76 24 L82 10 L90 26 Q106 30, 108 40 Q94 50, 64 49 L52 58 L48 48 Q28 48, 18 40 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.4"/>
        <ellipse cx="86" cy="34" rx="7" ry="3.5" fill="${glow}" fill-opacity="0.45"/>
        <path d="M18 40 L6 28 L12 40 L6 52 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
      `;
      break;
    case 'clam':
      shape = `
        <path d="M24 44 C24 22, 42 16, 60 16 C78 16, 96 22, 96 44 Q78 36, 60 40 Q42 36, 24 44 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.65" stroke-width="1.4"/>
        <path d="M24 46 Q42 60, 60 58 Q78 60, 96 46 Q78 50, 60 48 Q42 50, 24 46 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.4"/>
        <circle cx="60" cy="40" r="7" fill="${glow}" fill-opacity="0.72"/>
      `;
      break;
    case 'piranha':
      shape = `
        <g fill="#07111f" stroke="${glow}" stroke-opacity="0.68" stroke-width="1.3">
          <path d="M62 36 Q74 22, 94 28 Q102 36, 94 44 Q74 50, 62 36 L52 28 L55 36 L52 44 Z"/>
          <path d="M26 22 Q36 12, 52 17 Q58 22, 52 27 Q36 32, 26 22 L18 16 L20 22 L18 28 Z"/>
          <path d="M26 50 Q36 40, 52 45 Q58 50, 52 55 Q36 60, 26 50 L18 44 L20 50 L18 56 Z"/>
        </g>
        <circle cx="88" cy="34" r="2.4" fill="${glow}"/>
        <circle cx="48" cy="20" r="2.0" fill="${glow}"/>
        <circle cx="48" cy="48" r="2.0" fill="${glow}"/>
      `;
      break;
    case 'turtle':
      shape = `
        <path d="M24 44 C26 20, 74 18, 82 42 Q54 50, 24 44 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.68" stroke-width="1.4"/>
        <ellipse cx="94" cy="38" rx="11" ry="9" fill="#07111f" stroke="${glow}" stroke-opacity="0.68" stroke-width="1.4"/>
        <path d="M64 46 Q72 62, 52 60 Q48 52, 54 46 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
        <path d="M28 44 Q18 54, 14 48 Q18 42, 24 42 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.3"/>
        <line x1="90" y1="33" x2="99" y2="36" stroke="${glow}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="95" cy="38" r="2.2" fill="${glow}"/>
      `;
      break;
    case 'lionfish':
      shape = `
        <g stroke="${glow}" stroke-opacity="0.72" stroke-width="1.5" stroke-linecap="round">
          <line x1="56" y1="32" x2="36" y2="10"/><line x1="60" y1="30" x2="54" y2="8"/>
          <line x1="66" y1="30" x2="72" y2="9"/><line x1="72" y1="32" x2="88" y2="14"/>
          <line x1="54" y1="42" x2="32" y2="60"/><line x1="62" y1="44" x2="52" y2="64"/>
          <line x1="70" y1="44" x2="78" y2="62"/>
        </g>
        <path d="M24 38 L10 26 L16 38 L10 50 Z" fill="#07111f" stroke="${glow}" stroke-opacity="0.6" stroke-width="1.2"/>
        <ellipse cx="60" cy="38" rx="28" ry="13" fill="#07111f" stroke="${glow}" stroke-opacity="0.68" stroke-width="1.4"/>
        <circle cx="78" cy="35" r="2.5" fill="${glow}"/>
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
