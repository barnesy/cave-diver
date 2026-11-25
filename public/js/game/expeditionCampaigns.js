/**
 * Multi-Dive Expedition Campaigns & Repetitive Surface Interval Off-Gassing (v160).
 *
 * Stitches the 33 global dive sites into 4 structured 3-dive expedition arcs where
 * residual ZH-L16C compartment nitrogen & helium carry over between linked legs unless
 * you plan a realistic surface interval rest (Air or Surface O₂ off-gassing).
 *
 * Pure ES module with zero DOM dependencies.
 */

const SURFACE_N2_BAR = (1.0 - 0.0627) * 0.79; // ~0.7405 bar surface equilibrium
// Game-scaled ZH-L16C surface off-gassing half-times (in real-world surface-interval minutes)
const COMPARTMENT_SURF_HALF_MIN = [
  { halfN2: 8, halfHe: 3 },
  { halfN2: 20, halfHe: 8 },
  { halfN2: 45, halfHe: 18 },
  { halfN2: 95, halfHe: 38 },
];

export const SURFACE_INTERVAL_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'quick',
    label: '15m Air Rest',
    minutes: 15,
    breatheO2: false,
    desc: 'Rapid turnaround — retains residual tissue loading for a challenging repetitive dive.',
  }),
  Object.freeze({
    id: 'standard',
    label: '45m Air Rest',
    minutes: 45,
    breatheO2: false,
    desc: 'Standard expedition surface interval — clears fast & mid compartments.',
  }),
  Object.freeze({
    id: 'o2-offgas',
    label: '20m Surface O₂',
    minutes: 20,
    breatheO2: true,
    desc: 'Technical 100% O₂ surface breathing — rapid inert-gas washout with zero inspired N₂.',
  }),
]);

export const EXPEDITION_CAMPAIGNS = Object.freeze([
  Object.freeze({
    id: 'cenote-circuit',
    name: 'Yucatán & Karst Circuit',
    icon: '🧭',
    patchName: 'Karst Circuit Pioneer',
    accent: '#2dd4bf',
    desc: 'Master crystal cenote haloclines, Florida sinkholes, and deep unlined Yucatán traverses across 3 linked dives.',
    legs: Object.freeze(['cenote-el-abismo', 'eagles-nest-sink', 'ox-bel-ha-grand-traverse']),
    reward: Object.freeze({
      patchId: 'camp-karst',
      itemType: 'suit',
      itemId: 'karst-jade',
      label: '🌿 Karst Jade Drysuit + 🧭 Crest Patch',
    }),
  }),
  Object.freeze({
    id: 'wreck-salvage',
    name: 'Maritime Wreck Salvage',
    icon: '⚓',
    patchName: 'Master Wreck Salvager',
    accent: '#fb923c',
    desc: 'Descend from Red Sea WWII cargo holds to North Sea U-boats and the 120m Aegean hull of HMHS Britannic.',
    legs: Object.freeze(['ss-thistlegorm-wreck', 'u1206-north-sea-sub', 'hmhs-britannic']),
    reward: Object.freeze({
      patchId: 'camp-salvage',
      itemType: 'headgear',
      itemId: 'brass-hardhat',
      label: '🪖 Brass Salvage Helmet + ⚓ Crest Patch',
    }),
  }),
  Object.freeze({
    id: 'iceland-survey',
    name: 'Iceland Geothermal Survey',
    icon: '🌋',
    patchName: 'Polar Geothermal Surveyor',
    accent: '#38bdf8',
    desc: 'Chart tectonic rifts, hydrothermal chimneys, and subglacial ice-magma caverns across three consecutive polar legs.',
    legs: Object.freeze([
      'silfra-katla-aurora-abyss',
      'strytan-hydrothermal-chimneys',
      'kverkfjoll-subglacial-caves',
    ]),
    reward: Object.freeze({
      patchId: 'camp-polar',
      itemType: 'torch',
      itemId: 'aurora-plasma',
      label: '🌌 Aurora Plasma 9000K Optic + 🌋 Crest Patch',
    }),
  }),
  Object.freeze({
    id: 'abyssal-record',
    name: 'Abyssal World Record',
    icon: '🌌',
    patchName: 'Abyssal Frontier Legend',
    accent: '#c084fc',
    desc: 'Extreme hypoxic Trimix progression across three of Earth’s deepest flooded shafts culminating in 198m Krubera-Voronya.',
    legs: Object.freeze(['boesmansgat-abyss', 'boy-bulok-asian-sump', 'krubera-voronya-sump']),
    reward: Object.freeze({
      patchId: 'camp-abyssal',
      itemType: 'tank',
      itemId: 'abyssal-titanium',
      label: '💠 Abyssal Carbon-Ti Twinset + 🌌 Crest Patch',
    }),
  }),
  Object.freeze({
    id: 'coral-iron-wrecks',
    name: 'Coral & Iron Wrecks',
    icon: '🪸',
    patchName: 'Coral Wrecker',
    accent: '#fb7185',
    desc: 'Survey sunlit tropical shipwrecks from Chuuk Lagoon’s Zero-fighter cargo hold to the Red Sea Thistlegorm and Cyprus’s MS Zenobia.',
    legs: Object.freeze(['fujikawa-maru-chuuk', 'ss-thistlegorm-wreck', 'ms-zenobia-ferry']),
    reward: Object.freeze({
      patchId: 'camp-coral-wrecks',
      itemType: 'visor',
      itemId: 'pacific-coral-visor',
      label: '🪸 Pacific Coral Visor Tint + 🪸 Crest Patch',
    }),
  }),
  Object.freeze({
    id: 'halocline-wonders',
    name: 'Halocline Wonders',
    icon: '🧪',
    patchName: 'Halocline Pioneer',
    accent: '#a3e635',
    desc: 'Cross shimmering freshwater-saltwater boundaries across Cenote El Abismo, Bimini’s sunken megaliths, and Angelita’s glowing H₂S cloud river.',
    legs: Object.freeze(['cenote-el-abismo', 'bimini-road-megalith', 'cenote-angelita-river']),
    reward: Object.freeze({
      patchId: 'camp-halocline',
      itemType: 'tank',
      itemId: 'sulfur-emerald-tank',
      label: '🧪 Sulfur Emerald Twinset + 🧪 Crest Patch',
    }),
  }),
]);

export function getExpeditionCampaignById(id) {
  return EXPEDITION_CAMPAIGNS.find((c) => c.id === id) || null;
}

export function createCampaignRunState(campaignId) {
  const camp = getExpeditionCampaignById(campaignId);
  if (!camp) return null;
  return {
    campaignId: camp.id,
    legIndex: 0,
    completedLegs: [],
    totalScore: 0,
    residualTissues: null, // { compartments, cnsPercent, residualLoadPct }
    selectedIntervalId: 'standard',
  };
}

/**
 * Compute residual tissue loading percentage above surface equilibrium [0..100%].
 */
export function computeResidualTissueLoadPct(compartments) {
  if (!Array.isArray(compartments) || compartments.length === 0) return 0;
  let maxExcess = 0;
  for (let i = 0; i < compartments.length; i++) {
    const c = compartments[i];
    const totalInert = (Number(c?.pN2) || SURFACE_N2_BAR) + (Number(c?.pHe) || 0);
    const excess = Math.max(0, totalInert - SURFACE_N2_BAR);
    if (excess > maxExcess) maxExcess = excess;
  }
  // 1.5 bar inert excess above surface equilibrium maps to 100% residual load
  return Math.round(Math.max(0, Math.min(100, (maxExcess / 1.5) * 100)));
}

/**
 * Simulate Bühlmann exponential surface-interval off-gassing across all 4 ZH-L16C compartments + CNS%.
 */
export function computeSurfaceIntervalOffgas(compartments, cnsPercent = 0, optionId = 'standard') {
  const opt = SURFACE_INTERVAL_OPTIONS.find((o) => o.id === optionId) || SURFACE_INTERVAL_OPTIONS[1];
  const mins = Math.max(0, Number(opt.minutes) || 0);
  const inspiredN2 = opt.breatheO2 ? 0.0 : SURFACE_N2_BAR;
  const src =
    Array.isArray(compartments) && compartments.length > 0
      ? compartments
      : COMPARTMENT_SURF_HALF_MIN.map(() => ({ pN2: SURFACE_N2_BAR, pHe: 0 }));

  const nextCompartments = src.map((c, idx) => {
    const ht = COMPARTMENT_SURF_HALF_MIN[idx] || COMPARTMENT_SURF_HALF_MIN[COMPARTMENT_SURF_HALF_MIN.length - 1];
    const pN20 = Number.isFinite(c?.pN2) ? c.pN2 : SURFACE_N2_BAR;
    const pHe0 = Number.isFinite(c?.pHe) ? c.pHe : 0;
    const kN2 = Math.LN2 / ht.halfN2;
    const kHe = Math.LN2 / ht.halfHe;
    const nextN2 = Math.max(SURFACE_N2_BAR * 0.72, inspiredN2 + (pN20 - inspiredN2) * Math.exp(-kN2 * mins));
    const nextHe = Math.max(0, pHe0 * Math.exp(-kHe * mins));
    return {
      pN2: Math.round(nextN2 * 10000) / 10000,
      pHe: Math.round(nextHe * 10000) / 10000,
    };
  });

  // CNS clock decays with ~90 min half-time on air; surface O₂ pauses CNS washout slightly
  const cnsHalfMin = opt.breatheO2 ? 120 : 90;
  const nextCns = Math.max(0, Math.round((Number(cnsPercent) || 0) * Math.exp((-Math.LN2 / cnsHalfMin) * mins) * 10) / 10);

  return {
    option: opt,
    compartments: nextCompartments,
    cnsPercent: nextCns,
    residualLoadPct: computeResidualTissueLoadPct(nextCompartments),
  };
}

/**
 * Inject carried-over repetitive-dive residual compartment pressures & CNS into a fresh diveState.
 */
export function applyResidualTissuesToDiveState(diveState, residual) {
  if (!diveState || !residual) return diveState;
  if (Array.isArray(residual.compartments) && Array.isArray(diveState.compartments)) {
    for (let i = 0; i < Math.min(diveState.compartments.length, residual.compartments.length); i++) {
      const r = residual.compartments[i];
      if (Number.isFinite(r?.pN2)) diveState.compartments[i].pN2 = Math.max(SURFACE_N2_BAR, r.pN2);
      if (Number.isFinite(r?.pHe)) diveState.compartments[i].pHe = Math.max(0, r.pHe);
    }
  }
  if (Number.isFinite(residual.cnsPercent) && residual.cnsPercent > 0) {
    diveState.cnsPercent = Math.min(85, residual.cnsPercent);
  }
  return diveState;
}
