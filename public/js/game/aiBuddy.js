/**
 * Autonomous Technical Dive Buddy ("Solo Co-op" Wingman) — v134.
 *
 * Swims realistic SDF-safe formation alongside solo divers, sweeps an intelligent
 * secondary ray-cast torch across dark passages & nearby collectibles, responds to
 * player scuba hand-signals (OK / HOLD / LOOK / LOW GAS / ASCEND / SHARE AIR),
 * cuts snagged players free, and performs automatic emergency gas shares with live
 * air-share hose VFX.
 */

import { evaluateCaveSDF, evaluateCaveNormal, resolveDiverCollision, resolveDiverPeerCollisions } from './collision.js';
import { createDiverBody, stepDiverBody } from './diverBody.js';
import { getScubaSignalById, triggerDiverSignal } from './diveSignals.js';
import { GAS_MIXES, getRecommendedGas, receiveGasIntoState } from '../physics/diveModel.js';
import { pushAirShareBeam } from './diveSession.js';

export const AI_BUDDY_ID = 'ai-wingman-01';
export const AI_BUDDY_DEFAULT_NAME = '🔦 Maya';
export const HARDCORE_LEADERSHIP_BONUS_PTS = 175;

/**
 * Mode-specific AI Squad behavioral profiles (v158):
 *  - Guided   -> Pro Instructor & Guardian Angel (finds artifacts/lore & keeps you alive)
 *  - Standard -> Expert Technical Co-Diver (balanced flank partner & reserve backup)
 *  - Hardcore -> Vulnerable Rookies (unhelpful — YOU are the pro who leads & rescues them)
 */
export const AI_DIFFICULTY_PROFILES = Object.freeze({
  guided: Object.freeze({
    id: 'guided',
    badge: '🛡️ Pro Guide',
    title: 'Pro Instructor & Guardian',
    shortDesc:
      'Pro AI leads you to every artifact & lore landmark, paces deco stops, shares gas early (<65b), cuts snags fast (0.65s) & actively stabilizes your vitals so you stay safe.',
    leadsWaypoints: true,
    guideCollectibleRangeM: 28,
    guideLoreRangeM: 20,
    spotlightCollectibles: true,
    spotlightRangeM: 28,
    canAutoCutPlayerSnag: true,
    snagCutTimeSec: 0.65,
    canAutoShareGas: true,
    autoShareThresholdBar: 65,
    maxDonateBar: 45,
    gasShareCooldownSec: 6,
    minGasFloor: 85,
    gasBurnRate: 0.03,
    guardianStabilize: true,
    canScoutMode: true,
    allowTeleportRegroup: true,
    triggersHardcoreIssues: false,
    requireExtraction: false,
  }),
  standard: Object.freeze({
    id: 'standard',
    badge: '🤿 Expert Co-Diver',
    title: 'Expert Technical Co-Diver',
    shortDesc:
      'Balanced technical partner — holds disciplined flank trim, spotlights nearby artifacts (14m), obeys hand-signals, cuts snags & shares reserve gas in true emergencies (<34b).',
    leadsWaypoints: false,
    guideCollectibleRangeM: 0,
    guideLoreRangeM: 0,
    spotlightCollectibles: true,
    spotlightRangeM: 14,
    canAutoCutPlayerSnag: true,
    snagCutTimeSec: 1.55,
    canAutoShareGas: true,
    autoShareThresholdBar: 34,
    maxDonateBar: 35,
    gasShareCooldownSec: 14,
    minGasFloor: 40,
    gasBurnRate: 0.055,
    guardianStabilize: false,
    canScoutMode: true,
    allowTeleportRegroup: true,
    triggersHardcoreIssues: false,
    requireExtraction: false,
  }),
  hardcore: Object.freeze({
    id: 'hardcore',
    badge: '🔥 Rookie Squad (You Lead)',
    title: 'Vulnerable Rookies — You Are The Pro',
    shortDesc:
      'Unhelpful rookies who cling behind you, never scout, never auto-cut your snags or auto-share gas, suffer real emergencies (light fail, narcosis, panic, snags, low gas) & must be led home.',
    leadsWaypoints: false,
    guideCollectibleRangeM: 0,
    guideLoreRangeM: 0,
    spotlightCollectibles: false,
    spotlightRangeM: 0,
    canAutoCutPlayerSnag: false,
    snagCutTimeSec: 999,
    canAutoShareGas: false,
    autoShareThresholdBar: 0,
    maxDonateBar: 15,
    gasShareCooldownSec: 28,
    minGasFloor: 0,
    gasBurnRate: 0.085,
    guardianStabilize: false,
    canScoutMode: false,
    allowTeleportRegroup: false,
    triggersHardcoreIssues: true,
    requireExtraction: true,
  }),
});

export function getAiDifficultyProfile(difficulty = 'standard') {
  if (difficulty === 'guided') return AI_DIFFICULTY_PROFILES.guided;
  if (difficulty === 'hardcore') return AI_DIFFICULTY_PROFILES.hardcore;
  return AI_DIFFICULTY_PROFILES.standard;
}

export const HARDCORE_ISSUE_SPECS = Object.freeze({
  'torch-fail': {
    kind: 'torch-fail',
    condition: 'NO LIGHT',
    icon: '🔦',
    title: 'Primary Light Failure',
    hudLabel: '🔦 LEAD W/ LIGHT',
    hint: 'Shine your torch nearby & lead them forward slowly (or press [E] / signal OK)',
    countdownSec: 65,
  },
  narcosis: {
    kind: 'narcosis',
    condition: 'NARCOSIS',
    icon: '🫧',
    title: 'Nitrogen Narcosis',
    hudLabel: '🫧 LEAD SHALLOWER',
    hint: 'Swim close & lead them shallower (4m up) or signal ASCEND / OK [E]',
    countdownSec: 62,
  },
  panic: {
    kind: 'panic',
    condition: 'PANIC',
    icon: '💓',
    title: 'Claustrophobic Panic',
    hudLabel: '💓 CALM & HOVER',
    hint: 'Hover calmly beside them, signal OK / HOLD [E], or lead into an Air Dome',
    countdownSec: 58,
  },
  snagged: {
    kind: 'snagged',
    condition: 'SNAGGED!',
    icon: '✂️',
    title: 'Line Entanglement',
    hudLabel: '✂️ SNAGGED · [E]',
    hint: 'Swim back to them and press [E] / Cut Free before their gas drains!',
    countdownSec: 55,
  },
  'low-gas': {
    kind: 'low-gas',
    condition: 'LOW GAS',
    icon: '⛽',
    title: 'Regulator Free-Flow',
    hudLabel: '⛽ SHARE AIR [E]',
    hint: 'Close in and share gas via [E] or the Share Gas button before they run dry!',
    countdownSec: 60,
  },
});

export const AI_SQUAD_ROSTER = Object.freeze([
  {
    id: 'ai-wingman-01',
    name: '🔦 Maya',
    callsign: 'Maya',
    nickname: 'Torch',
    role: 'Point Scout',
    specialty: 'torch',
    spotlightBonusM: 4,
    extraStartBar: 0,
    extraDonateBar: 0,
    snagSpeedMult: 1.0,
    quipOk: '🔦 Torch steady — right on your wing!',
    quipScout: '🔦 Sweeping ahead with high-CRI beam!',
    livery: { suitId: 'arctic-cobalt', torchId: 'amber-silt', patchId: 'cenote-explorer' },
  },
  {
    id: 'ai-wingman-02',
    name: '⛽ Kai',
    callsign: 'Kai',
    nickname: 'Tanks',
    role: 'Gas Mule',
    specialty: 'gas',
    spotlightBonusM: 0,
    extraStartBar: 25,
    extraDonateBar: 10,
    snagSpeedMult: 1.0,
    quipOk: '⛽ Full stages on my hip — rolling with you!',
    quipScout: '⛽ Checking the corridor — plenty of gas on tap!',
    livery: { suitId: 'expedition-amber', torchId: 'warm-halogen', patchId: 'wreck-penetrator' },
  },
  {
    id: 'ai-wingman-03',
    name: '🪢 Elena',
    callsign: 'Elena',
    nickname: 'Line',
    role: 'Safety & Line',
    specialty: 'line',
    spotlightBonusM: 0,
    extraStartBar: 0,
    extraDonateBar: 0,
    snagSpeedMult: 1.32,
    quipOk: '🪢 Line clear — holding trim on your six!',
    quipScout: '🪢 Scouting the line — keeping exit bearing locked!',
    livery: { suitId: 'wreck-titanium', torchId: 'emerald-spot', patchId: 'abyss-veteran' },
  },
]);

/**
 * Passive zero-config Veteran Bond tier based on dives survived together (v161).
 */
export function getCrewBondRank(bond = null) {
  const dives = Math.max(0, Number(bond?.dives) || 0);
  const rescues = Math.max(0, Number(bond?.rescues) || 0);
  if (dives >= 15 || rescues >= 5) return { tier: 3, badge: '⭐ Blood-Sworn Buddy', dives, rescues };
  if (dives >= 8 || rescues >= 2) return { tier: 2, badge: '🎖️ Dive Veteran', dives, rescues };
  if (dives >= 3 || rescues >= 1) return { tier: 1, badge: '🤝 Trusted Wingman', dives, rescues };
  return { tier: 0, badge: '🤿 Dive Partner', dives, rescues };
}

const _normScratch = { nx: 0, ny: 0 };

function normalizeAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function lerpAngle(cur, target, t) {
  const diff = normalizeAngle(target - cur);
  return cur + diff * Math.min(1, Math.max(0, t));
}

function openWaterClearance(level, x, y) {
  if (!level) return 4;
  // evaluateCaveSDF: < 0 is open water, >= 0 is solid rock
  return -evaluateCaveSDF(level, x, y);
}

function findSafeSpawnOffset(level, diver, slotIndex = 0) {
  const baseX = Number(diver?.x) || 0;
  const baseY = Number(diver?.y) || 1.2;
  const candidatesBySlot = [
    [
      { dx: -1.7, dy: 0.3 },
      { dx: 1.7, dy: 0.3 },
      { dx: -1.2, dy: 1.1 },
      { dx: 1.2, dy: 1.1 },
      { dx: 0, dy: 1.3 },
      { dx: 0, dy: 0.2 },
    ],
    [
      { dx: 1.85, dy: 0.4 },
      { dx: -2.85, dy: 0.5 },
      { dx: 1.3, dy: 1.45 },
      { dx: -1.3, dy: 1.45 },
      { dx: 0.6, dy: 1.8 },
    ],
    [
      { dx: -2.95, dy: 0.55 },
      { dx: 2.95, dy: 0.55 },
      { dx: 0, dy: 2.25 },
      { dx: -1.5, dy: 2.1 },
      { dx: 1.5, dy: 2.1 },
    ],
  ];
  const candidates = candidatesBySlot[slotIndex % candidatesBySlot.length];
  for (let i = 0; i < candidates.length; i++) {
    const cx = baseX + candidates[i].dx;
    const cy = Math.max(0.85, baseY + candidates[i].dy);
    if (openWaterClearance(level, cx, cy) >= 0.72) {
      return { x: cx, y: cy };
    }
  }
  return { x: baseX + (slotIndex - 1) * 0.4, y: Math.max(0.85, baseY + 0.35 + slotIndex * 0.45) };
}

/**
 * Create a new AI Autonomous Dive Buddy state anchored cleanly near the diver spawn.
 */
export function createAiBuddyState(level, diver, opts = {}) {
  const slotIndex = Math.max(0, Math.min(2, Math.floor(Number(opts.slotIndex) || 0)));
  const roster = AI_SQUAD_ROSTER[slotIndex] || AI_SQUAD_ROSTER[0];
  const spawn = findSafeSpawnOffset(level, diver, slotIndex);
  const angle = Number(diver?.angle) || 0;
  const buddy = {
    id: opts.id || roster.id,
    name: opts.name || roster.name,
    callsign: roster.callsign || 'Maya',
    nickname: roster.nickname || 'Torch',
    role: roster.role,
    specialty: roster.specialty || 'torch',
    spotlightBonusM: roster.spotlightBonusM || 0,
    extraDonateBar: roster.extraDonateBar || 0,
    snagSpeedMult: roster.snagSpeedMult || 1.0,
    quipOk: roster.quipOk || '👌 OK — back on your wing',
    quipScout: roster.quipScout || '👀 Scouting passage ahead!',
    slotIndex,
    isAiBuddy: true,
    livery: opts.livery ? { ...opts.livery } : { ...roster.livery },
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle,
    depthM: Math.max(0, spawn.y),
    torchOn: true,
    torchAngle: angle,
    torchManualAim: true,
    alive: true,
    surfaced: false,
    rescued: false,
    rescuedBy: '',
    rescueTargetId: '',
    gasId: opts.initialGasId || 'EAN32',
    activeBar: 205 + (roster.extraStartBar || 0),
    maxBar: 205 + (roster.extraStartBar || 0),
    heartRateBpm: 72,
    cnsPercent: 0,
    dcsStress: 0,
    hypoxiaStress: 0,
    cardiacStress: 0,
    narcosisLevel: 0,
    condition: 'NOMINAL',
    hasCcr: false,
    signalId: '',
    signalText: '',
    signalStartedAt: 0,
    signalExpiresAt: 0,
    body: createDiverBody(spawn.x, spawn.y, angle),

    // AI Wingman tactical state
    mode: 'follow', // 'follow' | 'hold' | 'scout' | 'ascend' | 'assist-gas' | 'assist-snag'
    modeTimer: 0,
    holdX: spawn.x,
    holdY: spawn.y,
    sweepPhase: slotIndex * 2.1,
    gasShareCooldown: 0,
    snagAssistTimer: 0,
    strandedTimer: 0,
    calloutCooldowns: {
      lowGas: 0,
      deco: 0,
      collectible: 0,
      snag: 0,
      guardian: 0,
    },
    spottedCollectibleIds: new Set(),
    spottedStoryIds: new Set(),
    playerTrail: [{ x: Number(diver?.x) || 0, y: Number(diver?.y) || 1.2 }],
    _lastTrailX: Number(diver?.x) || 0,
    _lastTrailY: Number(diver?.y) || 1.2,

    // Telemetry counters for debrief summary
    gasDonatedTotalBar: 0,
    gasDonationsCount: 0,
    snagsAssisted: 0,
    signalsExchanged: 0,

    // Hardcore AI Leadership & Incident state (v157)
    issue: null,
    separated: false,
    hardcoreIncidentCooldown: 20 + slotIndex * 18,
    issuesResolvedCount: 0,
    _lastLeadX: spawn.x,
    _lastLeadY: spawn.y,
  };

  if (level) {
    resolveDiverCollision(level, buddy, 0.52);
    buddy.depthM = Math.max(0, buddy.y);
  }
  return buddy;
}

const SQUAD_UNIFORM_TRIMS = Object.freeze(['tech-cyan', 'safety-orange', 'cavern-yellow']);

/**
 * Create a full solo AI Dive Squad of 1 to 3 distinct wingmen (2-diver up to 4-diver squad).
 * When `opts.teamUniform` is enabled with `opts.leaderLivery`, wingmen share the player's
 * drysuit, headgear, tank finish & visor with distinct high-vis wingman trim stripes (v155).
 */
export function createAiSquad(level, diver, count = 1, opts = {}) {
  const cleanCount = Math.max(0, Math.min(AI_SQUAD_ROSTER.length, Math.floor(Number(count) || 0)));
  const useUniform = Boolean(opts.teamUniform && opts.leaderLivery && typeof opts.leaderLivery === 'object');
  const squad = [];
  for (let i = 0; i < cleanCount; i++) {
    const roster = AI_SQUAD_ROSTER[i] || AI_SQUAD_ROSTER[0];
    const buddyLivery = useUniform
      ? {
          ...opts.leaderLivery,
          trimId: SQUAD_UNIFORM_TRIMS[i % SQUAD_UNIFORM_TRIMS.length],
          patchId: roster.livery?.patchId || opts.leaderLivery.patchId || 'cave-arrow',
        }
      : undefined;
    squad.push(
      createAiBuddyState(level, diver, {
        ...opts,
        slotIndex: i,
        ...(buddyLivery ? { livery: buddyLivery } : {}),
      })
    );
  }
  return squad;
}

/**
 * Trigger a Hardcore Mode AI wingman technical emergency that the player must lead
 * them through or physically help solve (v157).
 */
export function triggerHardcoreBuddyIssue(buddy, kind, session, nowMs = Date.now(), callbacks = {}) {
  if (!buddy || buddy.alive === false || buddy.issue) return null;
  const spec = HARDCORE_ISSUE_SPECS[kind] || HARDCORE_ISSUE_SPECS['torch-fail'];
  const issue = {
    kind: spec.kind,
    condition: spec.condition,
    icon: spec.icon,
    title: spec.title,
    hudLabel: spec.hudLabel,
    hint: spec.hint,
    progress: 0,
    startedAt: nowMs,
    startDepthM: Math.max(0, Number(buddy.depthM ?? buddy.y) || 0),
    anchorX: buddy.x,
    anchorY: buddy.y,
    snagIndex: Number.isInteger(callbacks.snagIndex) ? callbacks.snagIndex : -1,
    snagKey: callbacks.snagKey || '',
    countdownSec: spec.countdownSec,
    maxCountdownSec: spec.countdownSec,
  };
  buddy.issue = issue;
  buddy.condition = spec.condition;
  buddy.mode = 'follow';
  buddy.modeTimer = 0;
  buddy._lastLeadX = buddy.x;
  buddy._lastLeadY = buddy.y;
  if (spec.kind === 'torch-fail') {
    buddy.torchOn = false;
  } else if (spec.kind === 'low-gas') {
    buddy.activeBar = Math.min(buddy.activeBar || 140, 42);
  } else if (spec.kind === 'narcosis') {
    buddy.narcosisLevel = Math.max(buddy.narcosisLevel || 0, 0.72);
  } else if (spec.kind === 'panic') {
    buddy.heartRateBpm = Math.max(buddy.heartRateBpm || 90, 148);
  }
  const sig = spec.kind === 'low-gas' ? 'share-air' : spec.kind === 'narcosis' ? 'ascend' : 'attention';
  triggerDiverSignal(buddy, sig, nowMs);
  callbacks.onBuddySignal?.(buddy, sig);
  callbacks.onBuddyIssueStarted?.(buddy, issue);
  return issue;
}

/**
 * Mark an active Hardcore AI buddy issue resolved and award Leadership Mastery bonus.
 */
export function resolveHardcoreBuddyIssue(buddy, session, nowMs = Date.now(), callbacks = {}, reason = '') {
  if (!buddy || !buddy.issue) return false;
  const resolved = buddy.issue;
  buddy.issue = null;
  buddy.torchOn = true;
  buddy.narcosisLevel = 0;
  buddy.condition = buddy.separated ? 'SEPARATED' : 'NOMINAL';
  buddy.hardcoreIncidentCooldown = 34 + (buddy.slotIndex || 0) * 10;
  buddy.issuesResolvedCount = (buddy.issuesResolvedCount || 0) + 1;
  if (session) {
    session.aiIssuesResolved = (session.aiIssuesResolved || 0) + 1;
    session.aiLeadBonusScore = (session.aiLeadBonusScore || 0) + HARDCORE_LEADERSHIP_BONUS_PTS;
  }
  triggerDiverSignal(buddy, 'ok', nowMs);
  callbacks.onBuddySignal?.(buddy, 'ok');
  callbacks.onBuddyIssueResolved?.(buddy, resolved, {
    bonusPts: HARDCORE_LEADERSHIP_BONUS_PTS,
    reason,
  });
  return true;
}

/**
 * Receive emergency donated gas from the player into an AI wingman's tank (resolves Hardcore low-gas!).
 */
export function receiveGasForAiBuddy(buddy, amountBar, gasId, session, nowMs = Date.now(), callbacks = {}) {
  if (!buddy || buddy.alive === false) return { accepted: false, addedBar: 0 };
  const add = Math.max(0, Number(amountBar) || 0);
  if (add <= 0) return { accepted: false, addedBar: 0 };
  const prev = Number(buddy.activeBar) || 0;
  const maxBar = Number(buddy.maxBar) || 205;
  buddy.activeBar = Math.min(maxBar, prev + add);
  const addedBar = Math.round(buddy.activeBar - prev);
  if (gasId) buddy.gasId = gasId;
  if (buddy.issue?.kind === 'low-gas' && buddy.activeBar >= 48) {
    resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, 'shared gas via long hose');
  } else if (buddy.condition === 'LOW GAS' || buddy.condition === 'NO GAS') {
    buddy.condition = 'NOMINAL';
    triggerDiverSignal(buddy, 'ok', nowMs);
  }
  return { accepted: true, addedBar };
}

/**
 * Direct close-range player assistance (`[E]`) for a Hardcore distressed AI buddy:
 * cuts snagged buddies free, or hands over backup light / steadies panicked & narc'd buddies.
 */
export function assistHardcoreBuddyIssue(buddy, session, nowMs = Date.now(), callbacks = {}) {
  if (!buddy || buddy.alive === false || !buddy.issue) return { handled: false };
  const kind = buddy.issue.kind;
  if (kind === 'snagged') {
    if (buddy.issue.snagKey && session?.cutSnagIds) {
      session.cutSnagIds.add(buddy.issue.snagKey);
    }
    resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, 'cut entanglement free');
    return { handled: true, resolved: true, kind };
  }
  if (kind === 'torch-fail' || kind === 'narcosis' || kind === 'panic') {
    buddy.issue.progress = Math.min(1, (buddy.issue.progress || 0) + 0.5);
    buddy.issue.countdownSec = Math.min(buddy.issue.maxCountdownSec, (buddy.issue.countdownSec || 20) + 12);
    if (buddy.issue.progress >= 1) {
      resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, 'direct buddy assist & leadership');
      return { handled: true, resolved: true, kind };
    }
    triggerDiverSignal(buddy, 'ok', nowMs);
    return {
      handled: true,
      resolved: false,
      kind,
      progress: buddy.issue.progress,
      toast:
        kind === 'torch-fail'
          ? `${buddy.name}: 🔦 Locked on your beam (${Math.round(buddy.issue.progress * 100)}%) — lead forward slowly!`
          : kind === 'narcosis'
            ? `${buddy.name}: 🫧 Focusing on your eyes (${Math.round(buddy.issue.progress * 100)}%) — lead me shallower!`
            : `${buddy.name}: 💓 Slowing breathing (${Math.round(buddy.issue.progress * 100)}%) — stay calm beside me!`,
    };
  }
  return { handled: false, kind };
}

/**
 * Glide a downed AI buddy smoothly behind the rescuing player during an active umbilical tow.
 */
export function updateTowedAiBuddy(buddy, diver, level, dt) {
  if (!buddy || !diver || dt <= 0) return;
  const clampedDt = Math.min(0.1, dt);
  const ang = Number(diver.angle) || 0;
  const tx = diver.x - Math.cos(ang) * 1.55;
  const ty = Math.max(0.75, diver.y - Math.sin(ang) * 1.55);
  buddy.x += (tx - buddy.x) * Math.min(1, clampedDt * 7.5);
  buddy.y += (ty - buddy.y) * Math.min(1, clampedDt * 7.5);
  buddy.vx = 0;
  buddy.vy = 0;
  buddy.angle = lerpAngle(buddy.angle || 0, ang, clampedDt * 6);
  if (level) {
    resolveDiverCollision(level, buddy, 0.52);
  }
  buddy.depthM = Math.max(0, buddy.y);
  stepDiverBody(buddy, clampedDt, { thrustMag: 0, level });
}

/**
 * React immediately when the local diver flashes a scuba hand-signal / torch gesture.
 */
export function handlePlayerSignalForAiBuddy(buddy, idOrText, session, nowMs = Date.now(), callbacks = {}) {
  if (!buddy || buddy.alive === false) return { responded: false };
  const spec = getScubaSignalById(idOrText);
  const sigId = spec?.id || 'ok';
  buddy.signalsExchanged = (buddy.signalsExchanged || 0) + 1;

  // Hardcore Leadership Signal Coaching: signaling OK / HOLD / LOOK / ASCEND near a distressed AI buddy actively calms & rallies them!
  const diver = session?.diver;
  const distToPlayer = diver ? Math.hypot(diver.x - buddy.x, diver.y - buddy.y) : 0;
  if (buddy.issue && distToPlayer <= 8.0) {
    const kind = buddy.issue.kind;
    const helpfulSignal =
      (kind === 'torch-fail' && (sigId === 'ok' || sigId === 'attention')) ||
      (kind === 'narcosis' && (sigId === 'ok' || sigId === 'ascend')) ||
      (kind === 'panic' && (sigId === 'ok' || sigId === 'hold'));
    if (helpfulSignal) {
      buddy.issue.progress = Math.min(1, (buddy.issue.progress || 0) + 0.38);
      buddy.issue.countdownSec = Math.min(buddy.issue.maxCountdownSec, (buddy.issue.countdownSec || 20) + 10);
      if (buddy.issue.progress >= 1) {
        resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, `led via ${sigId.toUpperCase()} signal`);
        return {
          responded: true,
          replySignalId: 'ok',
          mode: buddy.mode,
          resolvedIssue: kind,
          toast: `${buddy.name}: 👌 Stabilized! Back on your wing (+${HARDCORE_LEADERSHIP_BONUS_PTS} Leadership pts)!`,
        };
      }
      triggerDiverSignal(buddy, 'ok', nowMs);
      return {
        responded: true,
        replySignalId: 'ok',
        mode: buddy.mode,
        toast: `${buddy.name}: ${buddy.issue.icon} Copy! (${Math.round(buddy.issue.progress * 100)}%) — ${buddy.issue.hint}`,
      };
    }
  }

  if (sigId === 'ok') {
    buddy.mode = 'follow';
    buddy.modeTimer = 0;
    buddy.condition = 'NOMINAL';
    triggerDiverSignal(buddy, 'ok', nowMs);
    return {
      responded: true,
      replySignalId: 'ok',
      mode: buddy.mode,
      toast: `${buddy.name}: ${buddy.quipOk || '👌 OK — back on your wing'}`,
    };
  }

  if (sigId === 'hold') {
    buddy.mode = 'hold';
    buddy.modeTimer = 30;
    buddy.holdX = buddy.x;
    buddy.holdY = buddy.y;
    buddy.condition = 'HOLDING';
    triggerDiverSignal(buddy, 'hold', nowMs);
    return {
      responded: true,
      replySignalId: 'hold',
      mode: buddy.mode,
      toast: `${buddy.name}: ✋ Holding position & holding light`,
    };
  }

  if (sigId === 'low-gas' || sigId === 'share-air') {
    const prof = getAiDifficultyProfile(session?.difficulty);
    const minReqBar = prof.id === 'hardcore' ? 95 : 55;
    const hasReserve = !buddy.issue && buddy.activeBar >= minReqBar;
    buddy.mode = 'assist-gas';
    buddy.modeTimer = 14;
    buddy.condition = hasReserve ? 'GAS ASSIST' : 'LOW GAS';
    triggerDiverSignal(buddy, hasReserve ? 'share-air' : 'low-gas', nowMs);
    return {
      responded: true,
      replySignalId: hasReserve ? 'share-air' : 'low-gas',
      mode: buddy.mode,
      toast: hasReserve
        ? prof.id === 'hardcore'
          ? `${buddy.name}: 😰 Nervous — can only spare a small ${prof.maxDonateBar}b sip, turn dive!`
          : `${buddy.name}: 🆘 Closing in to share emergency gas!`
        : `${buddy.name}: ⛽ Low reserve (${Math.round(buddy.activeBar)}b) — turn dive!`,
    };
  }

  if (sigId === 'attention') {
    const prof = getAiDifficultyProfile(session?.difficulty);
    if (!prof.canScoutMode) {
      triggerDiverSignal(buddy, 'hold', nowMs);
      return {
        responded: true,
        replySignalId: 'hold',
        mode: buddy.mode,
        toast: `${buddy.name}: 😰 Staying behind your fins — you're on point, lead the way!`,
      };
    }
    buddy.mode = 'scout';
    buddy.modeTimer = 9;
    buddy.condition = 'SCOUTING';
    triggerDiverSignal(buddy, 'attention', nowMs);
    return {
      responded: true,
      replySignalId: 'attention',
      mode: buddy.mode,
      toast:
        prof.id === 'guided'
          ? `${buddy.name}: 🛡️ Sweeping ahead for every artifact & landmark — follow my light!`
          : `${buddy.name}: 🔦 Sweeping passage & scanning targets`,
    };
  }

  if (sigId === 'ascend') {
    buddy.mode = 'ascend';
    buddy.modeTimer = 16;
    buddy.condition = 'ASCEND';
    triggerDiverSignal(buddy, 'ascend', nowMs);
    return {
      responded: true,
      replySignalId: 'ascend',
      mode: buddy.mode,
      toast: `${buddy.name}: 👍 Leading controlled ascent`,
    };
  }

  triggerDiverSignal(buddy, 'ok', nowMs);
  return { responded: true, replySignalId: 'ok', mode: buddy.mode, toast: `${buddy.name}: 👌 Copy` };
}

function findNearestUncollected(level, collectedIds, x, y, maxRangeM) {
  const list = level?.collectibles;
  if (!Array.isArray(list) || list.length === 0) return null;
  let best = null;
  let bestD = maxRangeM;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c || collectedIds?.has(c.id)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ? { item: best, dist: bestD } : null;
}

function findNearestUndiscoveredStory(stories, x, y, maxRangeM) {
  const list = stories?.setPieces;
  if (!Array.isArray(list) || list.length === 0) return null;
  let best = null;
  let bestD = maxRangeM;
  for (let i = 0; i < list.length; i++) {
    const sp = list[i];
    if (!sp || sp.discovered) continue;
    const d = Math.hypot(sp.x - x, sp.y - y);
    if (d < bestD) {
      bestD = d;
      best = sp;
    }
  }
  return best ? { item: best, dist: bestD } : null;
}

function chooseFormationTarget(level, diver, buddy, session = null, profile = AI_DIFFICULTY_PROFILES.standard) {
  const hardcore = profile.id === 'hardcore';
  const backX = -Math.cos(diver.angle || 0);
  const backY = -Math.sin(diver.angle || 0);
  const perpX = -backY;
  const perpY = backX;

  if (buddy.mode === 'assist-gas' || buddy.mode === 'assist-snag' || buddy.condition === 'SAFETY GUARD') {
    // Pull right alongside diver (1.35m) for hose transfer, line-shears assist, or Guardian stabilization
    const closeCandidates = [
      { x: diver.x + perpX * 1.35, y: Math.max(0.75, diver.y + perpY * 1.35) },
      { x: diver.x - perpX * 1.35, y: Math.max(0.75, diver.y - perpY * 1.35) },
      { x: diver.x + backX * 1.4, y: Math.max(0.75, diver.y + backY * 1.4) },
    ];
    let best = closeCandidates[0];
    let bestClear = -Infinity;
    for (let i = 0; i < closeCandidates.length; i++) {
      const c = openWaterClearance(level, closeCandidates[i].x, closeCandidates[i].y);
      if (c > bestClear) {
        bestClear = c;
        best = closeCandidates[i];
      }
    }
    return best;
  }

  if (buddy.mode === 'hold') {
    return { x: buddy.holdX, y: buddy.holdY };
  }

  if (buddy.mode === 'ascend') {
    const exit = level?.exitZone;
    const dx = exit ? exit.x - diver.x : 0;
    const dy = exit ? exit.y - diver.y : -4;
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const tx = diver.x + (dx / len) * 2.15;
    const ty = Math.max(0.9, diver.y + (dy / len) * 2.15 - 0.35);
    if (openWaterClearance(level, tx, ty) >= 0.72) {
      return { x: tx, y: ty };
    }
  }

  // Guided Mode Pro Instructor: lead wingman (slot 0) swims on point toward artifacts, lore, checkpoints & deco depth!
  const slot = Math.max(0, Number(buddy?.slotIndex) || 0);
  if (profile.leadsWaypoints && slot === 0 && (buddy.mode === 'follow' || buddy.mode === 'scout')) {
    const stopDepth = Number(session?.diveState?.stopDepthM) || 0;
    if (stopDepth >= 3 && Math.abs((diver.y || 0) - stopDepth) <= 6) {
      const decX = diver.x + (diver.facingX || Math.cos(diver.angle || 0) || 1) * 1.9;
      const decY = Math.max(1.2, stopDepth);
      if (openWaterClearance(level, decX, decY) >= 0.65) {
        return { x: decX, y: decY };
      }
    }
    let guideTarget = null;
    const nearCol = findNearestUncollected(level, session?.collectedIds, diver.x, diver.y, profile.guideCollectibleRangeM);
    if (nearCol) {
      guideTarget = nearCol.item;
    } else {
      const nearLore = findNearestUndiscoveredStory(session?.stories, diver.x, diver.y, profile.guideLoreRangeM);
      if (nearLore) {
        guideTarget = nearLore.item;
      } else {
        const nextCp = Array.isArray(level?.checkpoints)
          ? level.checkpoints.find((cp) => cp && !session?.checkpointsHit?.has(cp.id))
          : null;
        guideTarget = nextCp || level?.exitZone || null;
      }
    }
    if (guideTarget && Number.isFinite(guideTarget.x) && Number.isFinite(guideTarget.y)) {
      const gx = guideTarget.x - diver.x;
      const gy = guideTarget.y - diver.y;
      const gDist = Math.hypot(gx, gy);
      if (gDist > 1.2) {
        const leadDist = Math.min(2.65, gDist * 0.72);
        const tx = diver.x + (gx / gDist) * leadDist;
        const ty = Math.max(0.85, diver.y + (gy / gDist) * leadDist);
        if (openWaterClearance(level, tx, ty) >= 0.68) {
          return { x: tx, y: ty };
        }
      }
    }
  }

  // Standard wingman formation: evaluate flanking & staggered single-file slots for 1..3 AI wingmen
  // In Hardcore mode, trail slightly wider to avoid bumping tanks during diver-to-diver collisions
  const hcPad = hardcore ? 0.55 : 0;
  const trailStep = slot * (hardcore ? 1.85 : 1.5);
  const sideSign = slot % 2 === 0 ? 1 : -1;
  const slots = [
    {
      x: diver.x + backX * (2.25 + hcPad + trailStep) + perpX * sideSign * (0.95 + hcPad * 0.35),
      y: Math.max(0.8, diver.y + backY * (2.25 + hcPad + trailStep) + perpY * sideSign * (0.95 + hcPad * 0.35) - 0.3),
      bonus: 0.35,
    },
    {
      x: diver.x + backX * (2.25 + hcPad + trailStep) - perpX * sideSign * (0.95 + hcPad * 0.35),
      y: Math.max(0.8, diver.y + backY * (2.25 + hcPad + trailStep) - perpY * sideSign * (0.95 + hcPad * 0.35) - 0.3),
      bonus: 0.25,
    },
    {
      x: diver.x + backX * (2.15 + hcPad + trailStep),
      y: Math.max(0.8, diver.y + backY * (2.15 + hcPad + trailStep)),
      bonus: 0.22,
    },
    {
      x: diver.x + backX * (1.35 + hcPad * 0.85 + trailStep * 0.85),
      y: Math.max(0.8, diver.y + backY * (1.35 + hcPad * 0.85 + trailStep * 0.85)),
      bonus: 0.1,
    },
  ];
  let bestSlot = slots[2];
  let bestScore = -Infinity;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const clear = openWaterClearance(level, s.x, s.y);
    const score = Math.min(2.4, clear) + s.bonus;
    if (score > bestScore) {
      bestScore = score;
      bestSlot = s;
    }
  }
  return { x: bestSlot.x, y: bestSlot.y };
}

function chooseTorchAimAngle(buddy, session, dt, profile = AI_DIFFICULTY_PROFILES.standard) {
  const { level, diver, collectedIds, checkpointsHit, drills } = session;
  buddy.sweepPhase = (buddy.sweepPhase || 0) + dt * (profile.id === 'hardcore' ? 1.65 : 1.15);

  // Hardcore rookies do NOT spotlight artifacts, checkpoints, or bail out your light failures!
  if (!profile.spotlightCollectibles) {
    const baseHeading = Number.isFinite(buddy.angle) ? buddy.angle : diver.angle || 0;
    return baseHeading + Math.sin(buddy.sweepPhase) * 0.22;
  }

  // 1. Primary torch failure backup: lock beam directly ahead of player
  if (!diver.torchOn || drills?.active?.kind === 'torch-fail') {
    const aheadX = diver.x + Math.cos(diver.angle || 0) * 6.5;
    const aheadY = diver.y + Math.sin(diver.angle || 0) * 6.5;
    return Math.atan2(aheadY - buddy.y, aheadX - buddy.x);
  }

  // 2. Assisting player close-up (snag cut, gas share, or safety guard): illuminate player workspace
  if (buddy.mode === 'assist-snag' || buddy.mode === 'assist-gas' || buddy.condition === 'SAFETY GUARD') {
    return Math.atan2(diver.y - buddy.y, diver.x - buddy.x);
  }

  // 3. Spotlight nearest uncollected collectible (Guided: 28m, Standard: 14m / 24m scouting)
  const searchRange = buddy.mode === 'scout' ? Math.max(24, profile.spotlightRangeM) : profile.spotlightRangeM;
  const nearCol = findNearestUncollected(level, collectedIds, buddy.x, buddy.y, searchRange);
  if (nearCol) {
    return Math.atan2(nearCol.item.y - buddy.y, nearCol.item.x - buddy.x);
  }

  // 3b. Guided Pro Instructor also spotlights undiscovered Submerged Lore landmarks!
  if (profile.guideLoreRangeM > 0) {
    const nearLore = findNearestUndiscoveredStory(session?.stories, buddy.x, buddy.y, profile.guideLoreRangeM);
    if (nearLore) {
      return Math.atan2(nearLore.item.y - buddy.y, nearLore.item.x - buddy.x);
    }
  }

  // 4. Scout or guide toward next unhit checkpoint or exit during ascent
  if (buddy.mode === 'ascend' && level?.exitZone) {
    return Math.atan2(level.exitZone.y - buddy.y, level.exitZone.x - buddy.x);
  }
  const nextCp = Array.isArray(level?.checkpoints)
    ? level.checkpoints.find((cp) => cp && !checkpointsHit?.has(cp.id))
    : null;
  if (nextCp) {
    const cpDist = Math.hypot(nextCp.x - buddy.x, nextCp.y - buddy.y);
    const cpRange = profile.leadsWaypoints ? 30 : buddy.mode === 'scout' ? 26 : 16;
    if (cpDist <= cpRange) {
      return Math.atan2(nextCp.y - buddy.y, nextCp.x - buddy.x);
    }
  }

  // 5. Gentle lateral cave-wall sweep ahead of player's travel direction
  const baseHeading = Number.isFinite(diver.angle) ? diver.angle : buddy.angle;
  return baseHeading + Math.sin(buddy.sweepPhase) * 0.34;
}

/**
 * Advance AI Dive Buddy steering, collision avoidance, secondary torch targeting,
 * proactive scuba safety callouts, snag-cut rescue, and emergency gas sharing.
 */
export function stepAiBuddy(buddy, session, dt, callbacks = {}) {
  if (!buddy || buddy.alive === false || !session || !session.level || !session.diver || dt <= 0) {
    return null;
  }
  if (session.endedState || session.diveState?.alive === false) {
    return null;
  }

  const { level, diver, diveState } = session;
  const nowMs = callbacks.timestampMs ?? callbacks.nowMs ?? Date.now();
  const clampedDt = Math.min(0.1, dt);

  // Record breadcrumb trail behind player for anti-stranding follow through tight sumps
  const trailDx = diver.x - (buddy._lastTrailX ?? diver.x);
  const trailDy = diver.y - (buddy._lastTrailY ?? diver.y);
  if (Math.hypot(trailDx, trailDy) >= 1.5) {
    buddy._lastTrailX = diver.x;
    buddy._lastTrailY = diver.y;
    buddy.playerTrail.push({ x: diver.x, y: diver.y });
    if (buddy.playerTrail.length > 24) buddy.playerTrail.shift();
  }

  // Tick cooldowns
  buddy.gasShareCooldown = Math.max(0, (buddy.gasShareCooldown || 0) - clampedDt);
  for (const key of Object.keys(buddy.calloutCooldowns)) {
    buddy.calloutCooldowns[key] = Math.max(0, (buddy.calloutCooldowns[key] || 0) - clampedDt);
  }
  if (buddy.modeTimer > 0) {
    buddy.modeTimer = Math.max(0, buddy.modeTimer - clampedDt);
    if (buddy.modeTimer === 0 && buddy.mode !== 'follow') {
      buddy.mode = 'follow';
      buddy.condition = 'NOMINAL';
    }
  }

  // Keep AI buddy gas mix optimal for its depth & simulate gentle realistic consumption
  const recGas = getRecommendedGas(
    { ...diveState, depthM: buddy.depthM },
    { ascending: buddy.mode === 'ascend' }
  );
  if (recGas && (diveState.mixes?.[recGas] || GAS_MIXES[recGas])) {
    buddy.gasId = recGas;
  } else if (diveState.activeGasId) {
    buddy.gasId = diveState.activeGasId;
  }
  const ata = 1 + Math.max(0, buddy.depthM) / 10;
  const profile = getAiDifficultyProfile(session.difficulty);
  const isHardcore = profile.triggersHardcoreIssues;
  const baseGasRate = isHardcore
    ? buddy.issue?.kind === 'low-gas'
      ? 0.42
      : buddy.issue?.kind === 'snagged' || buddy.issue?.kind === 'panic'
        ? 0.16
        : profile.gasBurnRate
    : profile.gasBurnRate;
  const minGasFloor = profile.minGasFloor;
  buddy.activeBar = Math.max(minGasFloor, buddy.activeBar - baseGasRate * ata * clampedDt);

  const distToPlayer = Math.hypot(diver.x - buddy.x, diver.y - buddy.y);
  const activeTank = diveState.tanks?.[diveState.activeGasId];
  const playerBar = Number.isFinite(activeTank?.bar) ? activeTank.bar : 200;

  // === HARDCORE MODE: AI WINGMAN SEPARATION, REAL INCIDENTS & LEADERSHIP RESOLUTION (v157) ===
  if (isHardcore) {
    // 1. Separation detection (no magical teleport in Hardcore — you must return to lead!)
    if (buddy.mode !== 'hold') {
      if (!buddy.separated && distToPlayer > 14.5) {
        buddy.separated = true;
        if (!buddy.issue) buddy.condition = 'SEPARATED';
        triggerDiverSignal(buddy, 'attention', nowMs);
        callbacks.onBuddySignal?.(buddy, 'attention');
        callbacks.onBuddySeparated?.(buddy, distToPlayer);
      } else if (buddy.separated && distToPlayer <= 8.5) {
        buddy.separated = false;
        if (!buddy.issue) buddy.condition = 'NOMINAL';
        triggerDiverSignal(buddy, 'ok', nowMs);
        callbacks.onBuddyRejoined?.(buddy);
      }
    }

    // 2. Physical snag-zone hazard check for AI wingmen in Hardcore
    if (!buddy.issue && Array.isArray(level.snagZones) && session.simTimeSec >= 10) {
      for (let s = 0; s < level.snagZones.length; s++) {
        const sn = level.snagZones[s];
        const snKey = sn?.id || `snag_${s}`;
        if (!sn || session.cutSnagIds?.has(snKey)) continue;
        if (Math.hypot(buddy.x - sn.x, buddy.y - sn.y) <= (sn.radius || 2.2) * 0.85) {
          triggerHardcoreBuddyIssue(buddy, 'snagged', session, nowMs, {
            ...callbacks,
            snagIndex: s,
            snagKey: snKey,
          });
          break;
        }
      }
    }

    // 3. Organic paced Hardcore technical incident trigger (max 1 active issue across squad at once)
    const squadList = Array.isArray(callbacks.squadPeers) ? callbacks.squadPeers : [buddy];
    const squadHasActiveIssue = squadList.some((p) => p && p.alive !== false && Boolean(p.issue));
    if (!buddy.issue && !buddy.separated && !squadHasActiveIssue && session.simTimeSec >= 18 && buddy.depthM >= 7.0) {
      buddy.hardcoreIncidentCooldown = Math.max(0, (buddy.hardcoreIncidentCooldown ?? 24) - clampedDt);
      if (buddy.hardcoreIncidentCooldown <= 0) {
        const rollPool = ['torch-fail', 'panic', 'low-gas'];
        if (buddy.depthM >= 22) rollPool.push('narcosis', 'narcosis');
        const idx = Math.floor(Math.abs(Math.sin(session.simTimeSec * 12.7 + (buddy.slotIndex || 0) * 3.1)) * rollPool.length) % rollPool.length;
        triggerHardcoreBuddyIssue(buddy, rollPool[idx], session, nowMs, callbacks);
      }
    }

    // 4. Step active Hardcore incident: player leadership resolves it; total abandonment downs the buddy!
    if (buddy.issue) {
      const iss = buddy.issue;
      const playerNear = distToPlayer <= 6.5;
      const playerSpeed = Math.hypot(diver.vx || 0, diver.vy || 0);
      // Pause/slow countdown generously whenever the leader is actively nearby helping
      const decayRate = playerNear ? 0.18 : 1.0;
      iss.countdownSec = Math.max(0, (iss.countdownSec ?? 55) - clampedDt * decayRate);

      if (iss.kind === 'torch-fail') {
        buddy.torchOn = false;
        if (playerNear && diver.torchOn !== false) {
          const stepDist = Math.hypot(buddy.x - (buddy._lastLeadX ?? buddy.x), buddy.y - (buddy._lastLeadY ?? buddy.y));
          buddy._lastLeadX = buddy.x;
          buddy._lastLeadY = buddy.y;
          // Progress fills as leader shines torch nearby & leads buddy forward
          iss.progress = Math.min(1, iss.progress + clampedDt * 0.14 + stepDist * 0.085);
          if (iss.progress >= 1) {
            resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, 'led safely under your torchlight');
          }
        }
      } else if (iss.kind === 'narcosis') {
        buddy.narcosisLevel = Math.max(0.25, 0.78 * (1 - iss.progress));
        if (playerNear) {
          const depthGain = Math.max(0, (iss.startDepthM || buddy.depthM) - buddy.depthM);
          const climbProg = depthGain / 4.2;
          iss.progress = Math.min(1, Math.max(iss.progress, climbProg) + (diver.vy < -0.15 ? clampedDt * 0.12 : clampedDt * 0.06));
          if (iss.progress >= 1) {
            resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, 'led shallower to clear narcosis');
          }
        }
      } else if (iss.kind === 'panic') {
        const calmNearby = distToPlayer <= 4.4 && playerSpeed <= 1.25;
        const inAirDome = Boolean(session.stories?.inAirDome && distToPlayer <= 5.0);
        if (calmNearby || inAirDome) {
          iss.progress = Math.min(1, iss.progress + clampedDt * (inAirDome ? 0.34 : 0.2));
          if (iss.progress >= 1) {
            resolveHardcoreBuddyIssue(buddy, session, nowMs, callbacks, 'calmed & stabilized');
          }
        }
      } else if (iss.kind === 'low-gas') {
        if (buddy.activeBar <= 10) buddy.condition = 'NO GAS';
      }

      // If completely abandoned until countdown hits 0 or tank runs dry -> buddy goes DOWN and must be towed!
      if (buddy.issue && (buddy.activeBar <= 0.2 || iss.countdownSec <= 0)) {
        const causeTitle = buddy.activeBar <= 0.2 ? 'Out of Gas' : iss.title;
        buddy.alive = false;
        buddy.torchOn = false;
        buddy.vx = 0;
        buddy.vy = 0;
        buddy.condition = 'DOWN';
        buddy.issue = null;
        buddy.separated = false;
        callbacks.onBuddyDowned?.(buddy, causeTitle);
        return { mode: 'down', distToPlayer, torchAngle: buddy.torchAngle };
      }
    }
  }

  // === GUIDED MODE PRO INSTRUCTOR: GUARDIAN ANGEL LIFE-SAVING & WAYPOINT GUIDING (v158) ===
  if (profile.guardianStabilize && buddy.mode !== 'hold') {
    const pCns = Number(diveState.cnsPercent) || 0;
    const pHyp = Number(diveState.hypoxiaStress) || 0;
    const pDcs = Number(diveState.dcsStress) || 0;
    const pPanic = Number(diveState.panicLevel) || 0;
    const pHealth = Number.isFinite(diveState.health) ? diveState.health : 100;
    const playerInDanger = pCns >= 40 || pHyp >= 30 || pDcs >= 32 || pPanic >= 0.52 || pHealth <= 65;

    if (playerInDanger) {
      buddy.condition = 'SAFETY GUARD';
      if (distToPlayer <= 5.8) {
        // Actively buffer physiological stress & stabilize vitals so Guided players survive while listening to coaching
        if (pPanic > 0.15) diveState.panicLevel = Math.max(0.1, pPanic - 0.28 * clampedDt);
        if ((diveState.heartRateBpm || 75) > 95) {
          diveState.heartRateBpm = Math.max(85, diveState.heartRateBpm - 18 * clampedDt);
        }
        if (pCns > 25) diveState.cnsPercent = Math.max(25, pCns - 7.5 * clampedDt);
        if (pHyp > 18) diveState.hypoxiaStress = Math.max(18, pHyp - 9.0 * clampedDt);
        if (pDcs > 18) diveState.dcsStress = Math.max(18, pDcs - 7.5 * clampedDt);
        if (pHealth < 78) diveState.health = Math.min(78, pHealth + 5.5 * clampedDt);
      }
      if ((buddy.calloutCooldowns.guardian || 0) <= 0) {
        buddy.calloutCooldowns.guardian = 9.5;
        const playerRecGas = getRecommendedGas(diveState, { ascending: Boolean(diveState.stopDepthM >= 3) });
        let coachMsg = '';
        if (pHyp >= 30 || pCns >= 40) {
          coachMsg = `🛡️ ${buddy.name}: Switch to ${playerRecGas || 'recommended gas'} now — stabilizing your breathing!`;
        } else if (pDcs >= 32 || (diveState.stopDepthM || 0) >= 3) {
          coachMsg = `🛡️ ${buddy.name}: Hold steady at ${Math.max(3, Math.round(diveState.stopDepthM || 6))}m deco stop — I've got you!`;
        } else {
          coachMsg = `🛡️ ${buddy.name}: Slow your fins & breathe easy — stabilizing your vitals!`;
        }
        triggerDiverSignal(buddy, 'hold', nowMs);
        callbacks.onBuddySignal?.(buddy, 'hold');
        callbacks.onBuddyCoach?.(buddy, coachMsg);
      }
    } else if (buddy.condition === 'SAFETY GUARD') {
      buddy.condition = 'NOMINAL';
    } else if (buddy.slotIndex === 0 && buddy.mode === 'follow') {
      if ((diveState.stopDepthM || 0) >= 3 && Math.abs((diver.y || 0) - diveState.stopDepthM) <= 6) {
        buddy.condition = 'DECO PACE';
      } else {
        buddy.condition = 'GUIDING';
      }
    }
  }

  // --- Priority 1: Emergency Wreck Snag / Line Entanglement Assist (Guided fast / Standard / OFF in Hardcore!) ---
  if (
    profile.canAutoCutPlayerSnag &&
    !buddy.issue &&
    !buddy.separated &&
    Number.isInteger(session.activeSnagIndex) &&
    session.activeSnagIndex >= 0
  ) {
    buddy.mode = 'assist-snag';
    buddy.modeTimer = 4.0;
    buddy.condition = 'NET ASSIST';
    if (buddy.calloutCooldowns.snag <= 0) {
      buddy.calloutCooldowns.snag = 12;
      triggerDiverSignal(buddy, 'attention', nowMs);
      callbacks.onBuddySignal?.(buddy, 'attention');
    }
    if (distToPlayer <= 2.9) {
      buddy.snagAssistTimer = (buddy.snagAssistTimer || 0) + clampedDt * (buddy.snagSpeedMult || 1.0);
      if (buddy.snagAssistTimer >= profile.snagCutTimeSec) {
        buddy.snagAssistTimer = 0;
        const snags = level.snagZones || [];
        const snag = snags[session.activeSnagIndex];
        if (snag && session.cutSnagIds) {
          session.cutSnagIds.add(snag.id || `snag-${session.activeSnagIndex}`);
        }
        session.activeSnagIndex = -1;
        buddy.snagsAssisted = (buddy.snagsAssisted || 0) + 1;
        buddy.mode = 'follow';
        buddy.modeTimer = 0;
        buddy.condition = 'NOMINAL';
        triggerDiverSignal(buddy, 'ok', nowMs);
        callbacks.onBuddyCutSnag?.(buddy);
      }
    }
  } else {
    buddy.snagAssistTimer = 0;
  }

  // --- Priority 2: Automatic or Requested Emergency Gas Share (Guided <65b / Standard <34b / Hardcore NO auto!) ---
  const minDonateReserve = profile.id === 'hardcore' ? 95 : 58;
  const autoGasNeed =
    profile.canAutoShareGas &&
    !buddy.issue &&
    !buddy.separated &&
    playerBar < profile.autoShareThresholdBar &&
    buddy.activeBar >= Math.max(62, profile.minGasFloor) &&
    buddy.gasShareCooldown <= 0;
  const requestedGasNeed =
    !buddy.issue &&
    buddy.mode === 'assist-gas' &&
    playerBar < 165 &&
    buddy.activeBar >= minDonateReserve &&
    buddy.gasShareCooldown <= 0;

  if (autoGasNeed && buddy.mode !== 'assist-gas' && buddy.mode !== 'assist-snag') {
    buddy.mode = 'assist-gas';
    buddy.modeTimer = 14;
    buddy.condition = 'GAS ASSIST';
    triggerDiverSignal(buddy, 'share-air', nowMs);
    callbacks.onBuddySignal?.(buddy, 'share-air');
  }

  if ((autoGasNeed || requestedGasNeed) && distToPlayer <= 3.2) {
    const maxCap = profile.maxDonateBar + (profile.id === 'hardcore' ? 0 : buddy.extraDonateBar || 0);
    const donateBar = Math.min(maxCap, Math.max(12, Math.round(buddy.activeBar - Math.max(42, profile.minGasFloor - 20))));
    const safeGasId = diveState.activeGasId || buddy.gasId || 'EAN32';
    const added = receiveGasIntoState(diveState, safeGasId, donateBar);
    if (added > 0) {
      buddy.activeBar = Math.max(profile.minGasFloor, buddy.activeBar - added);
      buddy.gasShareCooldown = profile.gasShareCooldownSec;
      buddy.gasDonatedTotalBar = Math.round((buddy.gasDonatedTotalBar + added) * 10) / 10;
      buddy.gasDonationsCount = (buddy.gasDonationsCount || 0) + 1;
      buddy.mode = 'follow';
      buddy.modeTimer = 0;
      buddy.condition = 'NOMINAL';
      pushAirShareBeam(session, {
        peerId: buddy.id,
        peerName: buddy.name,
        fromSelf: false,
        gasId: safeGasId,
        amountBar: Math.round(added),
      });
      triggerDiverSignal(buddy, 'ok', nowMs);
      callbacks.onBuddyGasShare?.({
        buddy,
        gasId: safeGasId,
        amountBar: Math.round(added),
      });
    }
  }

  // --- Auto-rejoin if player swims far past a HOLD position ---
  if (buddy.mode === 'hold' && distToPlayer > 24 && profile.allowTeleportRegroup) {
    buddy.mode = 'follow';
    buddy.modeTimer = 0;
    buddy.condition = 'NOMINAL';
  }

  // --- Proactive Technical Safety & Discovery Callouts (Guided spots ALL loot+lore / Standard spots nearby / Hardcore silent) ---
  if (profile.spotlightCollectibles && (buddy.mode === 'follow' || buddy.mode === 'scout')) {
    if (playerBar < Math.max(58, profile.autoShareThresholdBar + 15) && playerBar >= profile.autoShareThresholdBar && buddy.calloutCooldowns.lowGas <= 0) {
      buddy.calloutCooldowns.lowGas = 26;
      triggerDiverSignal(buddy, 'low-gas', nowMs);
      callbacks.onBuddySignal?.(buddy, 'low-gas');
    } else if (diveState.stopDepthM >= 3 && diveState.ascentRateMpm > 8 && buddy.calloutCooldowns.deco <= 0) {
      buddy.calloutCooldowns.deco = 24;
      triggerDiverSignal(buddy, 'hold', nowMs);
      callbacks.onBuddySignal?.(buddy, 'hold');
    } else if (buddy.calloutCooldowns.collectible <= 0) {
      const colRange = (profile.leadsWaypoints ? 22 : 10.5) + (buddy.spotlightBonusM || 0);
      const spotted = findNearestUncollected(level, session.collectedIds, buddy.x, buddy.y, colRange);
      if (spotted && !buddy.spottedCollectibleIds.has(spotted.item.id)) {
        buddy.spottedCollectibleIds.add(spotted.item.id);
        buddy.calloutCooldowns.collectible = profile.leadsWaypoints ? 9 : 14;
        triggerDiverSignal(buddy, 'attention', nowMs);
        callbacks.onBuddySignal?.(buddy, 'attention');
        if (profile.leadsWaypoints) {
          callbacks.onBuddyCoach?.(buddy, `🔦 ${buddy.name}: Spotted ${spotted.item.name} ahead — follow my light!`);
        }
      } else if (profile.guideLoreRangeM > 0) {
        const spottedLore = findNearestUndiscoveredStory(session?.stories, buddy.x, buddy.y, 16);
        if (spottedLore && !buddy.spottedStoryIds?.has(spottedLore.item.id)) {
          if (!buddy.spottedStoryIds) buddy.spottedStoryIds = new Set();
          buddy.spottedStoryIds.add(spottedLore.item.id);
          buddy.calloutCooldowns.collectible = 10;
          triggerDiverSignal(buddy, 'attention', nowMs);
          callbacks.onBuddySignal?.(buddy, 'attention');
          callbacks.onBuddyCoach?.(buddy, `🧭 ${buddy.name}: Submerged landmark nearby (${spottedLore.item.title}) — shine your torch here!`);
        }
      }
    }
  }

  // --- Steering & SDF-Safe Wall Avoidance ---
  let target = chooseFormationTarget(level, diver, buddy, session, profile);
  // If far away, follow the player's recent breadcrumb trail so buddy navigates around rock bends cleanly
  if (buddy.mode !== 'hold' && distToPlayer > 7.5 && buddy.playerTrail.length > 0) {
    let bestTrail = null;
    for (let i = buddy.playerTrail.length - 1; i >= 0; i--) {
      const pt = buddy.playerTrail[i];
      if (Math.hypot(pt.x - buddy.x, pt.y - buddy.y) <= 6.5) {
        bestTrail = buddy.playerTrail[Math.min(buddy.playerTrail.length - 1, i + 2)];
        break;
      }
    }
    if (bestTrail) target = bestTrail;
  }

  const dx = target.x - buddy.x;
  const dy = target.y - buddy.y;
  const distToTarget = Math.hypot(dx, dy);

  const urgent = buddy.mode === 'assist-gas' || buddy.mode === 'assist-snag';
  const issueKind = buddy.issue?.kind || '';
  const pinnedByIssue = issueKind === 'snagged' || (issueKind === 'panic' && distToPlayer > 3.5) || buddy.separated;
  const needsLeadNear = (issueKind === 'torch-fail' && (distToPlayer > 6.5 || diver.torchOn === false)) || (issueKind === 'narcosis' && distToPlayer > 6.5);
  let maxSpeed = urgent ? 4.35 : distToPlayer > 10 ? 4.1 : 3.1;
  if (issueKind === 'torch-fail') maxSpeed = 2.05;
  else if (issueKind === 'narcosis') maxSpeed = 2.15;
  else if (issueKind === 'low-gas') maxSpeed = 2.35;
  const desiredSpeed =
    pinnedByIssue || needsLeadNear
      ? 0
      : distToTarget < 0.35
        ? 0
        : Math.min(maxSpeed, Math.max(0.55, distToTarget * (urgent ? 2.4 : 1.55)));

  let desVx = !pinnedByIssue && !needsLeadNear && distToTarget > 0.05 ? (dx / distToTarget) * desiredSpeed : 0;
  let desVy = !pinnedByIssue && !needsLeadNear && distToTarget > 0.05 ? (dy / distToTarget) * desiredSpeed : 0;
  if (issueKind === 'narcosis' && !needsLeadNear) {
    // Slight disoriented lateral sway until player guides them shallower
    desVx += Math.sin(nowMs * 0.0022 + (buddy.slotIndex || 0)) * 0.45;
  }

  // Gentle wall-clearance repulsion using cave SDF gradient (normal points INTO rock, so push along -normal)
  const wallClear = openWaterClearance(level, buddy.x, buddy.y);
  if (wallClear < 1.25) {
    evaluateCaveNormal(level, buddy.x, buddy.y, _normScratch);
    const push = (1.25 - wallClear) * 2.4;
    desVx -= _normScratch.nx * push;
    desVy -= _normScratch.ny * push;
  }

  // Friendly inter-squadmate spacing repulsion so 2–3 AI wingmen hold staggered single-file trim
  const squadPeers = Array.isArray(callbacks.squadPeers) ? callbacks.squadPeers : null;
  if (squadPeers && squadPeers.length > 0) {
    const minSep = session.difficulty === 'hardcore' ? 1.65 : 1.25;
    for (let i = 0; i < squadPeers.length; i++) {
      const other = squadPeers[i];
      if (!other || other === buddy || other.alive === false) continue;
      const sx = buddy.x - other.x;
      const sy = buddy.y - other.y;
      const sd = Math.hypot(sx, sy);
      if (sd > 0.01 && sd < minSep) {
        const rep = ((minSep - sd) / minSep) * 2.6;
        desVx += (sx / sd) * rep;
        desVy += (sy / sd) * rep;
      }
    }
  }

  const accel = Math.min(1, clampedDt * (urgent ? 5.6 : 4.2));
  buddy.vx += (desVx - buddy.vx) * accel;
  buddy.vy += (desVy - buddy.vy) * accel;

  if (issueKind === 'snagged' && buddy.issue) {
    // Physically anchored at snag entanglement point until leader cuts them free
    buddy.x = buddy.issue.anchorX;
    buddy.y = buddy.issue.anchorY;
    buddy.vx = 0;
    buddy.vy = 0;
  } else {
    buddy.x += buddy.vx * clampedDt;
    buddy.y = Math.max(0.65, buddy.y + buddy.vy * clampedDt);
    resolveDiverCollision(level, buddy, 0.52);
  }

  // Anti-stranding warp ONLY in Standard/Guided — in Hardcore you must swim back to lead separated buddies!
  if (!isHardcore && buddy.mode !== 'hold' && distToPlayer > 22) {
    buddy.strandedTimer = (buddy.strandedTimer || 0) + clampedDt;
    if (buddy.strandedTimer >= 2.6) {
      buddy.strandedTimer = 0;
      const regroup = findSafeSpawnOffset(level, diver, buddy.slotIndex || 0);
      buddy.x = regroup.x;
      buddy.y = regroup.y;
      buddy.vx = 0;
      buddy.vy = 0;
      resolveDiverCollision(level, buddy, 0.52);
    }
  } else {
    buddy.strandedTimer = 0;
  }

  buddy.depthM = Math.max(0, buddy.y);

  // Smooth swimming orientation + intelligent secondary torch aim
  const speed = Math.hypot(buddy.vx, buddy.vy);
  const desiredBodyAngle =
    speed > 0.32 ? Math.atan2(buddy.vy, buddy.vx) : Math.atan2(diver.y - buddy.y, diver.x - buddy.x);
  buddy.angle = lerpAngle(buddy.angle, desiredBodyAngle, clampedDt * 5.2);

  const desiredTorchAngle = chooseTorchAimAngle(buddy, session, clampedDt, profile);
  buddy.torchAngle = lerpAngle(buddy.torchAngle, desiredTorchAngle, clampedDt * 6.5);
  buddy.torchManualAim = true;
  buddy.torchOn = buddy.issue?.kind !== 'torch-fail';

  // Realistic calm physiological heart rate reflecting exertion & Hardcore distress
  const distressHr = buddy.issue ? (buddy.issue.kind === 'panic' ? 54 : 36) : buddy.separated ? 20 : 0;
  const targetHr = Math.round(68 + Math.min(1, speed / 3.8) * 32 + (urgent ? 18 : 0) + distressHr);
  buddy.heartRateBpm += (targetHr - buddy.heartRateBpm) * Math.min(1, clampedDt * 2.0);

  // Update articulated limbs & fins
  stepDiverBody(buddy, clampedDt, {
    thrustMag: Math.min(1, speed / 3.0),
    level,
  });

  return {
    mode: buddy.mode,
    distToPlayer,
    torchAngle: buddy.torchAngle,
  };
}

/**
 * Step an entire 1..3 wingman AI Dive Squad cleanly, including Hardcore mutual collision among squadmates.
 */
export function stepAiSquad(squad, session, dt, callbacks = {}) {
  if (!Array.isArray(squad) || squad.length === 0 || !session) return [];
  const results = [];
  for (let i = 0; i < squad.length; i++) {
    const buddy = squad[i];
    if (!buddy) continue;
    results.push(stepAiBuddy(buddy, session, dt, { ...callbacks, squadPeers: squad }));
  }
  if (session.difficulty === 'hardcore' && squad.length > 1 && (session.simTimeSec >= 2.0 || (session.diver?.y || 0) > 2.2)) {
    for (let i = 0; i < squad.length; i++) {
      const a = squad[i];
      if (!a || a.alive === false) continue;
      const others = squad.slice(i + 1);
      resolveDiverPeerCollisions(session.level, a, others);
    }
  }
  return results;
}

/**
 * Dispatch a player hand-signal across an AI Dive Squad (closest wingman handles emergency gas/snag assists;
 * full squad responds to OK / HOLD / ATTENTION / ASCEND).
 */
export function handlePlayerSignalForAiSquad(squad, idOrText, session, nowMs = Date.now(), callbacks = {}) {
  if (!Array.isArray(squad) || squad.length === 0) return { responded: false };
  const spec = getScubaSignalById(idOrText);
  const sigId = spec?.id || 'ok';
  const diver = session?.diver;

  if (sigId === 'low-gas' || sigId === 'share-air') {
    let best = squad[0];
    let bestScore = -Infinity;
    for (let i = 0; i < squad.length; i++) {
      const b = squad[i];
      if (!b || b.alive === false) continue;
      const d = diver ? Math.hypot(b.x - diver.x, b.y - diver.y) : 0;
      const score = (b.activeBar || 0) - d * 6 - (b.issue ? 90 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return handlePlayerSignalForAiBuddy(best, idOrText, session, nowMs, callbacks);
  }

  let primaryRes = null;
  let issueRes = null;
  for (let i = 0; i < squad.length; i++) {
    const b = squad[i];
    if (!b || b.alive === false) continue;
    const hadIssue = Boolean(b.issue);
    const res = handlePlayerSignalForAiBuddy(b, idOrText, session, nowMs, callbacks);
    if (hadIssue && res.responded && !issueRes) issueRes = res;
    if (!primaryRes && res.responded) primaryRes = res;
  }
  if (issueRes) return issueRes;
  if (!primaryRes) return { responded: false };
  if (squad.length > 1) {
    const names = squad.filter((b) => b && b.alive !== false).map((b) => b.name.replace(/^🤖\s*/, '')).join(', ');
    primaryRes = {
      ...primaryRes,
      toast: `🤖 Squad (${names}): ${primaryRes.toast.replace(/^[^:]+:\s*/, '')}`,
    };
  }
  return primaryRes;
}
