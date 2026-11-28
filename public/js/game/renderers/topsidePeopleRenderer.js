/**
 * Living Topside & Background Crowds Renderer (v289)
 * Populates every dive site topside, charter boat, cenote rim, staging dock,
 * and menu/loading backdrop with lively animated co-ed crowds (women & men across
 * 8 varied body types) in resort swimwear and diving gear — busting out 14 popular
 * dances with natural beat-snapped groove, 2-bone IK grounded legs, contrapposto
 * shoulder tilt, and independent spring-mass secondary motion alongside divers
 * suiting up, toasting drinks, sunbathing, and floating in pool rings.
 *
 * Zero per-frame heap allocations & zero per-person gradients so the mobile 4x CPU
 * < 15.0 ms performance guard stays rock-solid.
 */
import {
  drawBiomeSurfaceHangout,
  drawPartyDiveBoatEnhancements,
  drawTopsideCannonballer,
  drawTopsideHypeOverlay,
  getTopsideHypeEnergy,
} from './topsidePropsRenderer.js';
import { getHyperRealSprite, HYPER_REAL_UMBRELLA_KEYS } from '../hyperRealSprites.js';
import { buildTopsideSpecFromAvatar, getAvatarSiteJumpState } from '../playerAvatar.js';

const SKIN_TONES = Object.freeze([
  '#f4cca4',
  '#e0a878',
  '#c58250',
  '#8b5228',
  '#f0bf95',
  '#a96a40',
]);

// Precomputed warm depth-shading & sunlit-highlight pairs for zero-allocation 3D anatomical shading
const SKIN_SHADES = Object.freeze([
  '#dca97e',
  '#c58859',
  '#a56336',
  '#6e3d1b',
  '#d49b6e',
  '#8c502a',
]);

const SKIN_HIGHLIGHTS = Object.freeze([
  '#fde3c8',
  '#f0c29a',
  '#da9d6f',
  '#a86c42',
  '#fad5b4',
  '#c4865c',
]);

const HAIR_COLORS = Object.freeze([
  '#1e1b18',
  '#4a2e19',
  '#b45309',
  '#eab308',
  '#7c2d12',
  '#0f172a',
]);

const SWIM_PALETTES = Object.freeze([
  { primary: '#fb7185', accent: '#fef08a', style: 'bikini' },     // Coral-pink bikini
  { primary: '#ec4899', accent: '#ffffff', style: 'bikini' },     // Hot pink bikini
  { primary: '#facc15', accent: '#ec4899', style: 'onepiece' },   // Sunny yellow one-piece
  { primary: '#06b6d4', accent: '#f97316', style: 'bikini' },     // Turquoise bikini
  { primary: '#a855f7', accent: '#67e8f9', style: 'bikini' },     // Violet-cyan bikini
  { primary: '#10b981', accent: '#fde047', style: 'onepiece' },   // Emerald cutout one-piece
  { primary: '#f97316', accent: '#38bdf8', style: 'bikini' },     // Sunset orange bikini
  { primary: '#38bdf8', accent: '#f43f5e', style: 'onepiece' },   // Sky blue one-piece
]);

const MALE_SWIM_PALETTES = Object.freeze([
  { primary: '#0284c7', accent: '#fde047', style: 'boardshorts' },  // Ocean blue boardshorts
  { primary: '#ef4444', accent: '#ffffff', style: 'boardshorts' },  // Lifeguard red boardshorts
  { primary: '#10b981', accent: '#fef08a', style: 'resort-shirt' }, // Emerald open tropical shirt + shorts
  { primary: '#f97316', accent: '#0f172a', style: 'rashguard' },    // Sunset surf rashguard + trunks
  { primary: '#6366f1', accent: '#38bdf8', style: 'boardshorts' },  // Indigo striped boardshorts
  { primary: '#14b8a6', accent: '#fb7185', style: 'resort-shirt' }, // Teal resort shirt + coral trim
  { primary: '#0ea5e9', accent: '#facc15', style: 'rashguard' },    // Cyan dive rashguard
  { primary: '#ec4899', accent: '#fef08a', style: 'swim-briefs' },  // Retro neon lifeguard briefs
]);

const WETSUIT_PALETTES = Object.freeze([
  { suit: '#1e293b', trim: '#38bdf8', tank: '#eab308', fin: '#facc15' },
  { suit: '#18181b', trim: '#f97316', tank: '#cbd5e1', fin: '#fb923c' },
  { suit: '#0f2942', trim: '#2dd4bf', tank: '#e2e8f0', fin: '#22d3ee' },
  { suit: '#1f2937', trim: '#ec4899', tank: '#facc15', fin: '#f472b6' },
]);

const UMBRELLA_PALETTES = Object.freeze([
  ['#f43f5e', '#fef9c3'],
  ['#0ea5e9', '#ffffff'],
  ['#f97316', '#fde047'],
  ['#10b981', '#ecfeff'],
]);

const FLOAT_COLORS = Object.freeze([
  { ring: '#f472b6', stripe: '#fdf2f8' }, // Flamingo pink
  { ring: '#38bdf8', stripe: '#fef08a' }, // Tropical cyan-gold
  { ring: '#fb923c', stripe: '#ffffff' }, // Sunset tangerine
  { ring: '#a78bfa', stripe: '#67e8f9' }, // Electric violet
]);

/**
 * 4 distinct female body presets (petite -> athletic -> classic hourglass -> tall voluptuous).
 * All widths are half-widths in world-meter units (base height ~1.68m * hScale).
 */
export const FEMALE_BODY_PROFILES = Object.freeze([
  { id: 'petite',     gender: 'female', hScale: 0.91, sh: 0.188, bust: 0.20,  waist: 0.112, hip: 0.238, thigh: 0.120, calf: 0.072, arm: 0.072, cupScale: 0.92, gluteScale: 0.88, belly: 0 },
  { id: 'athletic-f', gender: 'female', hScale: 1.00, sh: 0.218, bust: 0.218, waist: 0.132, hip: 0.252, thigh: 0.134, calf: 0.080, arm: 0.082, cupScale: 1.00, gluteScale: 0.94, belly: 0 },
  { id: 'hourglass',  gender: 'female', hScale: 0.98, sh: 0.208, bust: 0.238, waist: 0.118, hip: 0.284, thigh: 0.144, calf: 0.082, arm: 0.078, cupScale: 1.12, gluteScale: 1.06, belly: 0 },
  { id: 'voluptuous', gender: 'female', hScale: 1.04, sh: 0.224, bust: 0.256, waist: 0.148, hip: 0.308, thigh: 0.156, calf: 0.090, arm: 0.088, cupScale: 1.20, gluteScale: 1.14, belly: 0.02 },
]);

/**
 * 4 distinct male body presets (lean surfer -> athletic diver -> muscular lifeguard -> sturdy dad-bod captain).
 */
export const MALE_BODY_PROFILES = Object.freeze([
  { id: 'lean-surfer', gender: 'male', hScale: 1.05, sh: 0.242, bust: 0.202, waist: 0.154, hip: 0.182, thigh: 0.120, calf: 0.078, arm: 0.082, cupScale: 0, gluteScale: 0.56, belly: 0 },
  { id: 'athletic-m',  gender: 'male', hScale: 1.08, sh: 0.284, bust: 0.234, waist: 0.168, hip: 0.198, thigh: 0.136, calf: 0.086, arm: 0.096, cupScale: 0, gluteScale: 0.62, belly: 0 },
  { id: 'muscular',    gender: 'male', hScale: 1.12, sh: 0.324, bust: 0.268, waist: 0.182, hip: 0.212, thigh: 0.152, calf: 0.095, arm: 0.114, cupScale: 0, gluteScale: 0.68, belly: 0 },
  { id: 'dad-bod',     gender: 'male', hScale: 1.04, sh: 0.274, bust: 0.256, waist: 0.248, hip: 0.238, thigh: 0.146, calf: 0.092, arm: 0.102, cupScale: 0, gluteScale: 0.72, belly: 0.12 },
]);

const PROFILE_BY_ID = Object.freeze(
  Object.fromEntries([...FEMALE_BODY_PROFILES, ...MALE_BODY_PROFILES].map((p) => [p.id, p]))
);

/**
 * 6 distinct women's swim/resort top styles with genuinely varied necklines & cleavage!
 */
export const FEMALE_TOP_STYLES = Object.freeze([
  'triangle-halter', // Classic V-cleavage triangle bikini cups + halter straps & center tie
  'balconette',      // Push-up sweetheart balconette with generous upper cleavage & straps
  'bandeau',         // Chic strapless sweetheart bandeau showing clean bare collarbones
  'plunge-onepiece', // Glamorous deep-V plunge one-piece with sculpted center cleavage cutout
  'sporty-crop',     // Athletic high-scoop surf bikini crop-top with contrast underband
  'wrap-crisscross', // Criss-cross halter wrap top with chic teardrop keyhole cleavage window
]);

/**
 * 5 varied bust-size scale tiers (petite -> medium -> full -> curvy -> bombshell).
 */
export const FEMALE_BUST_SIZES = Object.freeze([0.80, 0.95, 1.10, 1.24, 1.36]);

/**
 * 14 unmistakable, lively popular dance moves that co-ed characters perform & cycle through!
 */
export const POPULAR_DANCE_MOVES = Object.freeze([
  'floss',        // Iconic alternating hip pop + fast opposite arm swings
  'twerk',        // Curvy low squat booty-pop / hip drop bounce
  'dab',          // Signature diagonal arm shoot + elbow face dip
  'disco',        // Saturday Night Fever diagonal sky-point + hip sway
  'salsa',        // Lush figure-8 hip sway + graceful overhead arm
  'running-man',  // High-knee shuffle stomp + grounded slide & pumping elbows
  'body-roll',    // Undulating head-shoulder-waist-hip wave + sweeping hands
  'ymca',         // Festival jump cycling Y - M - C - A arms!
  'moonwalk',     // Smooth side-profile heel-pop & backward gliding stride!
  'shuffle',      // Energetic Melbourne shuffle heel-toe scissor steps + crisp arm bounce!
  'robot',        // Snappy quantized mechanical 90-degree pose locks with micro-snap!
  'hula',         // Tropical island figure-8 hip sway + synchronized flowing wave hands!
  'macarena',     // Classic 6-beat cycle: hands out -> cross -> head -> hips -> hop!
  'air-guitar',   // Rock-out power stance, headbanging groove & shredding hands!
]);

// Bounded per-character secondary-motion spring-damper state pool (zero GC churn, auto-pruned)
const _bouncePool = new Map();
const MAX_BOUNCE_STATES = 160;

// Reusable scratch coordinates for zero-allocation analytical 2-bone IK solver
let _ikX = 0;
let _ikY = 0;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Musical beat-snapped groove wave: quicker energetic accent into the beat + brief natural hang!
 */
function grooveWave(phase) {
  return (Math.sin(phase) + 0.18 * Math.sin(phase * 2 - 0.45)) * 0.91;
}

/**
 * Smoothstepped elastic beat bounce in [0, 1] (crisp downbeat + airy float at peak).
 */
function beatBounce(phase) {
  const u = Math.abs(Math.sin(phase));
  return u * u * (3 - 2 * u);
}

/**
 * Quantized mechanical robot step value with sharp snap + tiny damped overshoot!
 */
function robotPulse(timeSec, seed) {
  const beat = timeSec * 2.9 + seed * 0.7;
  const idx = Math.floor(beat);
  const f = beat - idx;
  const snap = f < 0.18 ? (f / 0.18) : (1 + Math.sin((f - 0.18) * 18) * 0.06 * Math.exp(-(f - 0.18) * 8));
  return { idx: idx & 3, snap: clamp(snap, 0, 1.08) };
}

/**
 * Zero-allocation analytical 2-bone IK solver for knees & elbows.
 * Writes joint position to module scratch `(_ikX, _ikY)`.
 * For a vertical downward limb (ux=0, uy=1): bendSign=+1 bends toward +x (forward in side view).
 */
function solveJoint2Bone(ax, ay, bx, by, len1, len2, bendSign) {
  const dx = bx - ax;
  const dy = by - ay;
  const distSq = dx * dx + dy * dy;
  const minD = Math.max(0.001, Math.abs(len1 - len2) + 0.001);
  const maxD = len1 + len2 - 0.001;
  const d = clamp(Math.sqrt(distSq), minD, maxD);
  const cosA = clamp((len1 * len1 + d * d - len2 * len2) / (2 * len1 * d), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const invD = 1 / (d || 1);
  const ux = dx * invD;
  const uy = dy * invD;
  const px = uy * bendSign;
  const py = -ux * bendSign;
  _ikX = ax + (ux * cosA + px * sinA) * len1;
  _ikY = ay + (uy * cosA + py * sinA) * len1;
}

/**
 * Resolve gender ('female' | 'male'), body profile, topStyle & bustScale for any topside character.
 * Provides an organic co-ed crowd (~40% men, ~60% women) with 8 body types, 6 female top styles,
 * and 5 varied bust sizes.
 */
export function resolveTopsidePersonProfile(spec = {}) {
  const seed = Math.abs(spec.seed || 0);
  const explicitProf = spec.bodyType ? PROFILE_BY_ID[spec.bodyType] : null;
  let gender;
  if (spec.gender === 'male' || spec.gender === 'female') {
    gender = spec.gender;
  } else if (explicitProf) {
    gender = explicitProf.gender;
  } else if (spec.danceMove === 'twerk') {
    gender = 'female';
  } else {
    gender = ((seed * 7 + 1) % 5) < 2 ? 'male' : 'female';
  }

  let prof;
  if (explicitProf && explicitProf.gender === gender) {
    prof = explicitProf;
  } else if (spec.bodyType === 'athletic') {
    prof = gender === 'male' ? MALE_BODY_PROFILES[1] : FEMALE_BODY_PROFILES[1];
  } else {
    const pool = gender === 'male' ? MALE_BODY_PROFILES : FEMALE_BODY_PROFILES;
    prof = pool[(seed + (seed >> 2)) % pool.length];
  }

  let topStyle = null;
  let bustScale = 0;
  if (gender === 'female') {
    if (spec.topStyle && FEMALE_TOP_STYLES.includes(spec.topStyle)) {
      topStyle = spec.topStyle;
    } else if (spec.customSwim?.style === 'onepiece') {
      topStyle = 'plunge-onepiece';
    } else {
      topStyle = FEMALE_TOP_STYLES[(seed * 5 + (seed >> 1)) % FEMALE_TOP_STYLES.length];
    }
    if (typeof spec.bustScale === 'number' && Number.isFinite(spec.bustScale)) {
      bustScale = clamp(spec.bustScale, 0.72, 1.48);
    } else {
      const tier = FEMALE_BUST_SIZES[(seed * 3 + 1) % FEMALE_BUST_SIZES.length];
      bustScale = clamp(prof.cupScale * 0.42 + tier * 0.58, 0.78, 1.40);
    }
  }
  return { gender, prof, topStyle, bustScale };
}

/**
 * Draw a tiny vector musical note (zero fillText cost) floating near dancers / boombox.
 */
function drawMusicNote(ctx, x, y, s, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.34, s * 0.24, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.26, y - s * 0.05);
  ctx.lineTo(x + s * 0.26, y - s * 1.15);
  ctx.lineTo(x + s * 0.85, y - s * 0.92);
  ctx.stroke();
  ctx.restore();
}

/**
 * Integrate one 2D underdamped spring-mass oscillator driven by anchor acceleration:
 *   x'' = -k * x - c * x' - gain * driveAccel
 * Uses semi-implicit Euler (with 2x sub-stepping for large dt) for rock-solid stability.
 */
export function stepBounceSpring(state, driveAx, driveAy, dt, omega, zeta, gainX, gainY, maxX, maxY) {
  const k = omega * omega;
  const c = 2 * zeta * omega;
  const steps = dt > 0.018 ? 2 : 1;
  const h = dt / steps;
  let x = state.x;
  let y = state.y;
  let vx = state.vx;
  let vy = state.vy;
  for (let i = 0; i < steps; i++) {
    const ax = -k * x - c * vx - gainX * driveAx;
    const ay = -k * y - c * vy - gainY * driveAy;
    vx += ax * h;
    vy += ay * h;
    x += vx * h;
    y += vy * h;
  }
  if (x > maxX) { x = maxX; if (vx > 0) vx *= -0.35; }
  else if (x < -maxX) { x = -maxX; if (vx < 0) vx *= -0.35; }
  if (y > maxY) { y = maxY; if (vy > 0) vy *= -0.35; }
  else if (y < -maxY) { y = -maxY; if (vy < 0) vy *= -0.35; }
  state.x = x;
  state.y = y;
  state.vx = vx;
  state.vy = vy;
  return state;
}

/**
 * Compute & integrate independent real-time damped spring physics for a character's
 * bust (driven by chest/shoulder acceleration) and glutes (driven by hip/pelvis acceleration),
 * plus subtle independent left/right roll tilt from lateral & stride twist.
 * All coordinates are in world meters (scale-invariant).
 */
export function computeCharacterBounceState(charKey, chestX, chestY, hipX, hipY, timeSec, seed = 0, extraPulse = 0) {
  let st = _bouncePool.get(charKey);
  if (!st) {
    if (_bouncePool.size >= MAX_BOUNCE_STATES) {
      const oldest = _bouncePool.keys().next().value;
      if (oldest !== undefined) _bouncePool.delete(oldest);
    }
    st = {
      t: timeSec,
      pCx: chestX, pCy: chestY, pCvx: 0, pCvy: 0,
      pHx: hipX, pHy: hipY, pHvx: 0, pHvy: 0,
      bust: { x: 0, y: 0, vx: 0, vy: 0 },
      glute: { x: 0, y: 0, vx: 0, vy: 0 },
      bTilt: 0, bTiltV: 0,
      gTilt: 0, gTiltV: 0,
    };
    _bouncePool.set(charKey, st);
    return st;
  }

  const rawDt = timeSec - st.t;
  if (rawDt <= 0.0001 || rawDt > 0.25) {
    st.t = timeSec;
    st.pCx = chestX; st.pCy = chestY; st.pCvx = 0; st.pCvy = 0;
    st.pHx = hipX; st.pHy = hipY; st.pHvx = 0; st.pHvy = 0;
    if (rawDt <= 0 || timeSec === 0) {
      st.bust.x = st.bust.y = st.bust.vx = st.bust.vy = 0;
      st.glute.x = st.glute.y = st.glute.vx = st.glute.vy = 0;
      st.bTilt = st.bTiltV = st.gTilt = st.gTiltV = 0;
    }
    return st;
  }

  const dt = Math.min(0.045, rawDt);
  const cvx = (chestX - st.pCx) / dt;
  const cvy = (chestY - st.pCy) / dt;
  const cax = clamp((cvx - st.pCvx) / dt, -26, 26);
  const cay = clamp((cvy - st.pCvy) / dt, -30, 30);

  const hvx = (hipX - st.pHx) / dt;
  const hvy = (hipY - st.pHy) / dt;
  const hax = clamp((hvx - st.pHvx) / dt, -32, 32);
  const hay = clamp((hvy - st.pHvy) / dt, -36, 36);

  st.t = timeSec;
  st.pCx = chestX; st.pCy = chestY; st.pCvx = cvx; st.pCvy = cvy;
  st.pHx = hipX; st.pHy = hipY; st.pHvx = hvx; st.pHvy = hvy;

  const omegaBust = 16.2 - (seed % 3) * 1.05;
  const omegaGlute = 12.6 - (seed % 3) * 0.85;

  stepBounceSpring(st.bust, cax, cay + extraPulse * 3.5, dt, omegaBust, 0.22, 0.56, 0.70, 0.082, 0.092);
  stepBounceSpring(st.glute, hax, hay + extraPulse * 6.2, dt, omegaGlute, 0.20, 0.72, 0.80, 0.105, 0.108);

  const bTiltA = -omegaBust * omegaBust * 0.85 * st.bTilt - 2 * 0.25 * omegaBust * st.bTiltV - cax * 0.15;
  st.bTiltV += bTiltA * dt;
  st.bTilt = clamp(st.bTilt + st.bTiltV * dt, -0.052, 0.052);

  const gTiltA = -omegaGlute * omegaGlute * 0.8 * st.gTilt - 2 * 0.23 * omegaGlute * st.gTiltV - hax * 0.20;
  st.gTiltV += gTiltA * dt;
  st.gTilt = clamp(st.gTilt + st.gTiltV * dt, -0.064, 0.064);

  return st;
}

/**
 * Trace a sculpted, anatomically accurate female torso path (v290):
 * Graceful sloping shoulders -> defined ribcage -> high cinched waist -> sweeping iliac hip curve
 * blending seamlessly into upper thighs (zero boxy shoulders or bulbous hip step!).
 */
function traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX = 0, hipX = 0, bbx = 0, bby = 0, gbx = 0, gby = 0, shTilt = 0) {
  const bStretch = clamp((bby / Math.max(1, s)) * 1.8, -0.12, 0.14);
  const gStretch = clamp((gby / Math.max(1, s)) * 2.0, -0.16, 0.18);
  const shW = prof.sh * s;
  const buW = prof.bust * (1 - bStretch * 0.18) * s;
  const waW = prof.waist * 0.94 * s;
  const hiW = prof.hip * (1 - gStretch * 0.24) * s;
  const buY = shoulderY + (waistY - shoulderY) * 0.42 + clamp(bby * 0.35, -0.024 * s, 0.026 * s);
  const lowHipY = hipY + 0.11 * s + gby * 0.55;
  const midWaistX = (chestX + hipX) * 0.5;
  // Lock upper ribcage center to spine interpolation + tiny subtle elastic follow (zero chest/bust drift!)
  const ribCx = chestX + (hipX - chestX) * 0.18;
  const bustCx = ribCx + clamp(bbx * 0.22, -0.020 * s, 0.020 * s);
  const hipCx = hipX + gbx * 0.58;

  ctx.beginPath();
  // Graceful sloping trapezius shoulder line into rounded deltoid caps
  ctx.moveTo(chestX - shW, shoulderY + 0.03 * s - shTilt);
  ctx.bezierCurveTo(
    chestX - shW * 0.52, shoulderY - 0.03 * s - shTilt * 0.5,
    chestX - 0.06 * s, shoulderY - 0.055 * s,
    chestX, shoulderY - 0.055 * s
  );
  ctx.bezierCurveTo(
    chestX + 0.06 * s, shoulderY - 0.055 * s,
    chestX + shW * 0.52, shoulderY - 0.03 * s + shTilt * 0.5,
    chestX + shW, shoulderY + 0.03 * s + shTilt
  );
  // Ribcage -> cinched waist -> sweeping iliac hip flare -> seamless upper thigh blend
  ctx.bezierCurveTo(
    bustCx + buW * 1.06, buY - 0.02 * s,
    midWaistX + waW * 1.04, waistY - 0.06 * s,
    midWaistX + waW, waistY
  );
  ctx.bezierCurveTo(
    hipCx + hiW * 0.96, waistY + (hipY - waistY) * 0.44 + gby * 0.28,
    hipCx + hiW * 0.94, hipY + 0.01 * s + gby * 0.5,
    hipCx + hiW * 0.56, lowHipY
  );
  ctx.quadraticCurveTo(hipCx, lowHipY + 0.048 * s, hipCx - hiW * 0.56, lowHipY);
  ctx.bezierCurveTo(
    hipCx - hiW * 0.94, hipY + 0.01 * s + gby * 0.5,
    hipCx - hiW * 0.96, waistY + (hipY - waistY) * 0.44 + gby * 0.28,
    midWaistX - waW, waistY
  );
  ctx.bezierCurveTo(
    midWaistX - waW * 1.04, waistY - 0.06 * s,
    bustCx - buW * 1.06, buY - 0.02 * s,
    chestX - shW, shoulderY + 0.03 * s - shTilt
  );
  ctx.closePath();
}

/**
 * Draw delicate warm anatomical landmarks on bare female torso (collarbones & subtle navel).
 */
function drawFemaleTorsoLandmarks(ctx, chestX, hipX, shoulderY, waistY, hipY, prof, s, shadeCol, showMidriff = true) {
  if (s < 22) return;
  const midX = (chestX + hipX) * 0.5;
  ctx.strokeStyle = shadeCol;
  ctx.lineWidth = Math.max(0.75, 0.016 * s);
  // Subtle collarbones framing the base of the neck
  ctx.beginPath();
  ctx.moveTo(chestX - prof.sh * 0.58 * s, shoulderY + 0.025 * s);
  ctx.quadraticCurveTo(chestX - prof.sh * 0.24 * s, shoulderY + 0.048 * s, chestX - 0.028 * s, shoulderY + 0.035 * s);
  ctx.moveTo(chestX + prof.sh * 0.58 * s, shoulderY + 0.025 * s);
  ctx.quadraticCurveTo(chestX + prof.sh * 0.24 * s, shoulderY + 0.048 * s, chestX + 0.028 * s, shoulderY + 0.035 * s);
  ctx.stroke();

  if (showMidriff) {
    // Delicate vertical navel indent & subtle waist shadow line
    ctx.fillStyle = shadeCol;
    ctx.beginPath();
    ctx.ellipse(midX + (hipX - midX) * 0.32, waistY + (hipY - waistY) * 0.34, 0.011 * s, 0.019 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Trace a masculine front/back torso (broad shoulders, athletic V-taper OR warm relaxed dad-bod!).
 */
function traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX = 0, hipX = 0, shTilt = 0) {
  const shW = prof.sh * s;
  const chW = prof.bust * s;
  const waW = prof.waist * s;
  const hiW = prof.hip * s;
  const chY = shoulderY + (waistY - shoulderY) * 0.38;
  const lowHipY = hipY + 0.13 * s;
  const midX = (chestX + hipX) * 0.5;
  const isDadBod = prof.belly > 0.05;

  ctx.beginPath();
  // Broad squared-rounded shoulders
  ctx.moveTo(chestX - shW, shoulderY + 0.02 * s - shTilt);
  ctx.quadraticCurveTo(chestX - shW * 0.45, shoulderY - 0.055 * s - shTilt * 0.5, chestX, shoulderY - 0.055 * s);
  ctx.quadraticCurveTo(chestX + shW * 0.45, shoulderY - 0.055 * s + shTilt * 0.5, chestX + shW, shoulderY + 0.02 * s + shTilt);
  // Right lats -> waist (tapered V or relaxed dad-bod curve) -> trim hip
  ctx.bezierCurveTo(
    chestX + chW * 1.08, chY,
    midX + waW * (isDadBod ? 1.08 : 1.01), waistY - 0.04 * s,
    midX + waW, waistY
  );
  ctx.bezierCurveTo(
    hipX + hiW * (isDadBod ? 1.06 : 1.0), waistY + (hipY - waistY) * 0.5,
    hipX + hiW * 0.96, hipY + 0.03 * s,
    hipX + hiW * 0.72, lowHipY
  );
  ctx.quadraticCurveTo(hipX, lowHipY + 0.045 * s, hipX - hiW * 0.72, lowHipY);
  ctx.bezierCurveTo(
    hipX - hiW * 0.96, hipY + 0.03 * s,
    hipX - hiW * (isDadBod ? 1.06 : 1.0), waistY + (hipY - waistY) * 0.5,
    midX - waW, waistY
  );
  ctx.bezierCurveTo(
    midX - waW * (isDadBod ? 1.08 : 1.01), waistY - 0.04 * s,
    chestX - chW * 1.08, chY,
    chestX - shW, shoulderY + 0.02 * s - shTilt
  );
  ctx.closePath();
}

/**
 * Draw clean, ring-free, editorial-quality female bust & top styling across 6 distinct swim/resort
 * top styles (triangle-halter, balconette, bandeau, plunge-onepiece, sporty-crop, wrap-crisscross).
 * Every swimsuit cup clips/locks directly onto the exact breast silhouette and stretches elastically
 * with the moving ribcage (`chestX -> hipX`, `shTilt`) so fabric holds breasts in with ZERO independent drift!
 */
function drawBouncingBust(
  ctx,
  chestX,
  hipX,
  shoulderY,
  waistY,
  prof,
  s,
  bbx,
  bby,
  bTilt,
  fillCol,
  rimCol = null,
  skinCol = '#e0a878',
  topStyle = 'triangle-halter',
  bustScale = 1.0,
  isWetsuit = false,
  shTilt = 0
) {
  const cs = bustScale || prof.cupScale || 1.0;
  // Tightly contained elastic swimsuit bounce anchored onto exact spine/ribcage centerline
  const dy = clamp(bby * 0.54, -0.034 * s, 0.036 * s);
  const dx = clamp(bbx * 0.30, -0.022 * s, 0.022 * s);
  const stretch = clamp((dy / Math.max(1, s)) * 2.8, -0.14, 0.17);
  const rx = prof.bust * 0.56 * Math.pow(cs, 0.72) * (1 - stretch * 0.20) * s;
  const ry = 0.114 * Math.pow(cs, 0.80) * (1 + stretch) * s;
  const ribCx = chestX + (hipX - chestX) * 0.18;
  const cx = ribCx + dx;
  const cy = Math.min(waistY - ry * 0.96, shoulderY + 0.175 * s + dy);
  // Closer anatomical cup spacing so inner breast curves create genuine, lush pushed-together cleavage!
  const sep = prof.bust * (0.40 + (cs - 1) * 0.055) * s;
  const tilt = clamp(bTilt * 0.55, -0.020 * s, 0.020 * s) - shTilt * 0.42;
  const lx = cx - sep;
  const ly = cy + tilt;
  const rxPos = cx + sep;
  const ryPos = cy - tilt;
  // Mild fixed anatomical cup angle so fabric and skin NEVER spin apart on side-to-side sway!
  const rotL = -0.06;
  const rotR = 0.06;

  const traceTwinBreasts = (rX = rx, rY = ry) => {
    ctx.beginPath();
    ctx.ellipse(lx, ly, rX, rY, rotL, 0, Math.PI * 2);
    ctx.ellipse(rxPos, ryPos, rX, rY, rotR, 0, Math.PI * 2);
  };

  // Helper: sculpted tight-fit cleavage Y-curve + subtle warm sunlit upper-bust highlight
  const drawCleavageContour = (yTop, yBot, showTopSheen = true) => {
    if (s < 15) return;
    ctx.strokeStyle = 'rgba(72, 28, 14, 0.30)';
    ctx.lineWidth = Math.max(0.8, 0.019 * s);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.24, yTop);
    ctx.quadraticCurveTo(cx - 0.008 * s, (yTop + yBot) * 0.52, cx, yBot);
    ctx.moveTo(cx + rx * 0.24, yTop);
    ctx.quadraticCurveTo(cx + 0.008 * s, (yTop + yBot) * 0.52, cx, yBot);
    ctx.stroke();
    if (showTopSheen && s >= 22) {
      ctx.fillStyle = 'rgba(255, 246, 236, 0.22)';
      ctx.beginPath();
      ctx.ellipse(lx - rx * 0.1, ly - ry * 0.42, rx * 0.42, ry * 0.22, -0.15, 0, Math.PI * 2);
      ctx.ellipse(rxPos + rx * 0.1, ryPos - ry * 0.42, rx * 0.42, ry * 0.22, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Helper: sleek tight-fit lower underbust support arc hugging strictly beneath each breast
  const drawUnderbustArc = (col, alpha = 0.22, arcRx = rx) => {
    if (s < 15) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.85, 0.020 * s);
    ctx.beginPath();
    ctx.ellipse(lx, ly, arcRx * 0.96, ry * 0.96, rotL, 0.24, Math.PI * 0.80);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(rxPos, ryPos, arcRx * 0.96, ry * 0.96, rotR, Math.PI * 0.20, Math.PI * 0.76);
    ctx.stroke();
    ctx.restore();
  };

  // 1. Wetsuit / full dive suit: tight-fitting neoprene bust definition + diagonal trim
  if (isWetsuit) {
    ctx.fillStyle = fillCol;
    traceTwinBreasts(rx * 0.96, ry * 0.94);
    ctx.fill();
    drawUnderbustArc('#020617', 0.34, rx * 0.96);
    if (s >= 20) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.beginPath();
      ctx.ellipse(lx - rx * 0.08, ly - ry * 0.34, rx * 0.44, ry * 0.2, -0.12, 0, Math.PI * 2);
      ctx.ellipse(rxPos + rx * 0.08, ryPos - ry * 0.34, rx * 0.44, ry * 0.2, 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    if (rimCol && s >= 16) {
      ctx.strokeStyle = rimCol;
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = Math.max(1, 0.026 * s);
      ctx.beginPath();
      ctx.moveTo(lx - rx * 0.75, ly - ry * 0.65);
      ctx.quadraticCurveTo(cx, cy - ry * 0.25, rxPos + rx * 0.75, ryPos - ry * 0.65);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return;
  }

  // Soft warm underbust ribcage shadow tucked cleanly beneath 2-piece tops
  if (topStyle !== 'plunge-onepiece' && s >= 14) {
    ctx.fillStyle = 'rgba(82, 38, 18, 0.14)';
    ctx.beginPath();
    ctx.ellipse(lx, ly + ry * 0.22, rx * 0.84, ry * 0.62, rotL, 0, Math.PI * 2);
    ctx.ellipse(rxPos, ryPos + ry * 0.22, rx * 0.84, ry * 0.62, rotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Helper: subtle tight-swimwear fabric apex contour (realistic tight fitted swimsuit silhouette!)
  const drawFabricApex = (ax, ay) => {
    if (s < 20) return;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
    ctx.beginPath();
    ctx.arc(ax, ay + 0.004 * s, Math.max(1.1, 0.017 * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(ax - 0.004 * s, ay - 0.004 * s, Math.max(0.8, 0.011 * s), 0, Math.PI * 2);
    ctx.fill();
  };

  if (topStyle === 'plunge-onepiece') {
    // Tight-fitting sculpted one-piece bust volume clamped cleanly inside the ribcage contour!
    const opRx = Math.min(rx * 0.98, prof.bust * 0.58 * s);
    ctx.fillStyle = fillCol;
    traceTwinBreasts(opRx, ry * 0.98);
    ctx.fill();
    drawUnderbustArc('#0f172a', 0.22, opRx);
    if (s >= 20) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.ellipse(lx - opRx * 0.2, ly - ry * 0.34, opRx * 0.36, ry * 0.18, -0.18, 0, Math.PI * 2);
      ctx.ellipse(rxPos + opRx * 0.2, ryPos - ry * 0.34, opRx * 0.36, ry * 0.18, 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bold sculpted deep-V skin plunge stretching smoothly from sloping collarbones down between the cups!
    const vTopY = shoulderY + 0.032 * s;
    const vHalf = Math.max(0.062 * s, sep * 0.86);
    const vTipY = Math.min(waistY - 0.048 * s, cy + ry * 0.98);
    ctx.fillStyle = skinCol;
    ctx.beginPath();
    ctx.moveTo(chestX - vHalf, vTopY - shTilt * 0.45);
    ctx.quadraticCurveTo(cx - vHalf * 0.42, cy + ry * 0.20, cx, vTipY);
    ctx.quadraticCurveTo(cx + vHalf * 0.42, cy + ry * 0.20, chestX + vHalf, vTopY + shTilt * 0.45);
    ctx.closePath();
    ctx.fill();
    drawCleavageContour(cy - ry * 0.38, cy + ry * 0.44, true);
    drawFabricApex(lx - opRx * 0.18, ly + ry * 0.12);
    drawFabricApex(rxPos + opRx * 0.18, ryPos + ry * 0.12);
    if (rimCol && s >= 14) {
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = Math.max(0.95, 0.024 * s);
      ctx.beginPath();
      ctx.moveTo(chestX - vHalf, vTopY - shTilt * 0.45);
      ctx.quadraticCurveTo(cx - vHalf * 0.42, cy + ry * 0.20, cx, vTipY);
      ctx.quadraticCurveTo(cx + vHalf * 0.42, cy + ry * 0.20, chestX + vHalf, vTopY + shTilt * 0.45);
      ctx.stroke();
    }
  } else if (topStyle === 'balconette') {
    // Taut elastic shoulder straps seated flush ON sloping shoulders stretching straight into cups
    ctx.strokeStyle = fillCol;
    ctx.lineWidth = Math.max(0.95, 0.024 * s);
    ctx.beginPath();
    ctx.moveTo(chestX - prof.sh * 0.64 * s, shoulderY + 0.026 * s - shTilt);
    ctx.lineTo(lx - rx * 0.36, ly - ry * 0.14);
    ctx.moveTo(chestX + prof.sh * 0.64 * s, shoulderY + 0.026 * s + shTilt);
    ctx.lineTo(rxPos + rx * 0.36, ryPos - ry * 0.14);
    ctx.stroke();

    // Exact twin skin breast domes + cleavage
    ctx.fillStyle = skinCol;
    traceTwinBreasts(rx, ry);
    ctx.fill();
    drawCleavageContour(cy - ry * 0.56, cy + ry * 0.20, true);

    // Glove-tight sweetheart push-up half-cups CLIPPED strictly onto the twin breast silhouette!
    ctx.save();
    traceTwinBreasts(rx * 1.02, ry * 1.02);
    if (typeof ctx.clip === 'function') ctx.clip();
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.moveTo(lx - rx * 1.15, ly - ry * 0.08);
    ctx.quadraticCurveTo(lx, ly - ry * 0.42, cx, cy + ry * 0.18);
    ctx.quadraticCurveTo(rxPos, ryPos - ry * 0.42, rxPos + rx * 1.15, ryPos - ry * 0.08);
    ctx.lineTo(rxPos + rx * 1.2, cy + ry * 1.35);
    ctx.lineTo(lx - rx * 1.2, cy + ry * 1.35);
    ctx.closePath();
    ctx.fill();
    if (rimCol && s >= 14) {
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = Math.max(0.9, 0.023 * s);
      ctx.beginPath();
      ctx.moveTo(lx - rx * 1.05, ly - ry * 0.06);
      ctx.quadraticCurveTo(lx, ly - ry * 0.40, cx, cy + ry * 0.18);
      ctx.quadraticCurveTo(rxPos, ryPos - ry * 0.40, rxPos + rx * 1.05, ryPos - ry * 0.06);
      ctx.stroke();
    }
    ctx.restore();

    // Taut center underwire bridge connecting left & right cups seamlessly
    ctx.strokeStyle = fillCol;
    ctx.lineWidth = Math.max(1.2, 0.036 * s);
    ctx.beginPath();
    ctx.moveTo(lx + rx * 0.35, ly + ry * 0.62);
    ctx.quadraticCurveTo(cx, cy + ry * 0.45, rxPos - rx * 0.35, ryPos + ry * 0.62);
    ctx.stroke();
    drawUnderbustArc('#0f172a', 0.22);
    drawFabricApex(lx - rx * 0.08, ly + ry * 0.24);
    drawFabricApex(rxPos + rx * 0.08, ryPos + ry * 0.24);
  } else if (topStyle === 'bandeau') {
    // Exact twin skin breast domes + upper cleavage
    ctx.fillStyle = skinCol;
    traceTwinBreasts(rx, ry);
    ctx.fill();
    drawCleavageContour(cy - ry * 0.56, cy - ry * 0.02, true);

    // Sleek strapless sweetheart bandeau CLIPPED strictly onto the twin breasts (zero skin escape!)
    ctx.save();
    traceTwinBreasts(rx * 1.02, ry * 1.02);
    if (typeof ctx.clip === 'function') ctx.clip();
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.moveTo(lx - rx * 1.15, ly - ry * 0.28);
    ctx.quadraticCurveTo(lx, ly - ry * 0.64, cx, cy - ry * 0.04);
    ctx.quadraticCurveTo(rxPos, ryPos - ry * 0.64, rxPos + rx * 1.15, ryPos - ry * 0.28);
    ctx.lineTo(rxPos + rx * 1.2, cy + ry * 1.35);
    ctx.lineTo(lx - rx * 1.2, cy + ry * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Taut center bandeau gather & contrast clasp holding twin cups tightly together
    ctx.fillStyle = fillCol;
    ctx.fillRect(cx - sep * 0.45, cy - ry * 0.02, sep * 0.90, ry * 0.72);
    drawUnderbustArc('#0f172a', 0.22);
    drawFabricApex(lx - rx * 0.10, ly + ry * 0.14);
    drawFabricApex(rxPos + rx * 0.10, ryPos + ry * 0.14);
    ctx.fillStyle = rimCol || '#fef08a';
    ctx.beginPath();
    ctx.roundRect(cx - 0.020 * s, cy - ry * 0.04, 0.040 * s, ry * 0.76, 0.016 * s);
    ctx.fill();
  } else if (topStyle === 'sporty-crop') {
    // Glove-tight fitted athletic crop stretching from sloping shoulders over exact twin breasts!
    const topY = shoulderY + 0.082 * s;
    const hemY = Math.min(waistY - 0.012 * s, cy + ry * 0.98);
    const shIn = prof.sh * 0.58 * s;
    const hemHalf = sep + rx * 0.46;
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.moveTo(chestX - shIn, shoulderY + 0.020 * s - shTilt);
    ctx.quadraticCurveTo(chestX, topY + 0.045 * s, chestX + shIn, shoulderY + 0.020 * s + shTilt);
    ctx.bezierCurveTo(rxPos + rx * 1.04, ryPos - ry * 0.14, rxPos + rx * 1.00, ryPos + ry * 0.74, cx + hemHalf, hemY);
    ctx.lineTo(cx - hemHalf, hemY);
    ctx.bezierCurveTo(lx - rx * 1.00, ly + ry * 0.74, lx - rx * 1.04, ly - ry * 0.14, chestX - shIn, shoulderY + 0.020 * s - shTilt);
    ctx.closePath();
    ctx.fill();
    drawUnderbustArc('#0f172a', 0.24);
    drawFabricApex(lx - rx * 0.08, ly + ry * 0.10);
    drawFabricApex(rxPos + rx * 0.08, ryPos + ry * 0.10);
    if (s >= 18) {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.lineWidth = Math.max(0.75, 0.016 * s);
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry * 0.28);
      ctx.lineTo(cx, cy + ry * 0.36);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.ellipse(lx - rx * 0.1, ly - ry * 0.28, rx * 0.42, ry * 0.19, -0.14, 0, Math.PI * 2);
      ctx.ellipse(rxPos + rx * 0.1, ryPos - ry * 0.28, rx * 0.42, ry * 0.19, 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rimCol || '#ffffff';
    ctx.fillRect(cx - hemHalf, hemY - 0.038 * s, hemHalf * 2, 0.038 * s);
  } else if (topStyle === 'wrap-crisscross') {
    // Taut elastic criss-cross halter neck straps stretching from collar directly into moving cup peaks
    ctx.strokeStyle = fillCol;
    ctx.lineWidth = Math.max(1.2, 0.030 * s);
    ctx.beginPath();
    ctx.moveTo(lx + rx * 0.12, ly - ry * 0.56);
    ctx.lineTo(chestX + 0.040 * s, shoulderY - 0.01 * s);
    ctx.moveTo(rxPos - rx * 0.12, ryPos - ry * 0.56);
    ctx.lineTo(chestX - 0.040 * s, shoulderY - 0.01 * s);
    ctx.stroke();

    // Exact twin skin breast domes + keyhole cleavage
    ctx.fillStyle = skinCol;
    traceTwinBreasts(rx, ry);
    ctx.fill();
    drawCleavageContour(cy - ry * 0.42, cy + ry * 0.42, false);

    // Sculpted wrap cups CLIPPED strictly onto the twin breast silhouette (holds outer & lower curves tightly!)
    ctx.save();
    traceTwinBreasts(rx * 1.02, ry * 1.02);
    if (typeof ctx.clip === 'function') ctx.clip();
    ctx.fillStyle = fillCol;
    // Left wrap half leaving crisp center keyhole
    ctx.beginPath();
    ctx.moveTo(lx + rx * 0.18, ly - ry * 1.15);
    ctx.quadraticCurveTo(cx - rx * 0.34, cy + ry * 0.06, cx + 0.015 * s, cy + ry * 0.62);
    ctx.lineTo(cx + 0.015 * s, cy + ry * 1.35);
    ctx.lineTo(lx - rx * 1.25, cy + ry * 1.35);
    ctx.lineTo(lx - rx * 1.25, ly - ry * 1.15);
    ctx.closePath();
    ctx.fill();
    // Right wrap half leaving crisp center keyhole
    ctx.beginPath();
    ctx.moveTo(rxPos - rx * 0.18, ryPos - ry * 1.15);
    ctx.quadraticCurveTo(cx + rx * 0.34, cy + ry * 0.06, cx - 0.015 * s, cy + ry * 0.62);
    ctx.lineTo(cx - 0.015 * s, cy + ry * 1.35);
    ctx.lineTo(rxPos + rx * 1.25, cy + ry * 1.35);
    ctx.lineTo(rxPos + rx * 1.25, ryPos - ry * 1.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawUnderbustArc('#0f172a', 0.22);
    drawFabricApex(lx - rx * 0.16, ly + ry * 0.18);
    drawFabricApex(rxPos + rx * 0.16, ryPos + ry * 0.18);

    // Flush underband supporting directly beneath the twin wrap cups
    const bandHalf = sep + rx * 0.56;
    ctx.fillStyle = rimCol || fillCol;
    ctx.beginPath();
    ctx.roundRect(cx - bandHalf, cy + ry * 0.68, bandHalf * 2, 0.036 * s, 0.018 * s);
    ctx.fill();
  } else {
    // 'triangle-halter': Taut elastic halter strings + tight sculpted triangle cups CLIPPED onto breasts!
    ctx.strokeStyle = rimCol || fillCol;
    ctx.lineWidth = Math.max(0.95, 0.024 * s);
    ctx.beginPath();
    ctx.moveTo(chestX - 0.040 * s, shoulderY - 0.015 * s);
    ctx.lineTo(lx + rx * 0.02, ly - ry * 0.82);
    ctx.moveTo(chestX + 0.040 * s, shoulderY - 0.015 * s);
    ctx.lineTo(rxPos - rx * 0.02, ryPos - ry * 0.82);
    ctx.stroke();

    // Exact twin skin breast domes + lush V cleavage
    ctx.fillStyle = skinCol;
    traceTwinBreasts(rx, ry);
    ctx.fill();
    drawCleavageContour(cy - ry * 0.44, cy + ry * 0.54, true);

    // Clipped triangle halter cups holding 100% of outer & lower breast tightly with ZERO skin escape!
    ctx.save();
    traceTwinBreasts(rx * 1.02, ry * 1.02);
    if (typeof ctx.clip === 'function') ctx.clip();
    ctx.fillStyle = fillCol;
    // Left halter triangle
    ctx.beginPath();
    ctx.moveTo(lx + rx * 0.04, ly - ry * 1.08);
    ctx.quadraticCurveTo(lx + rx * 0.48, ly - ry * 0.02, cx - 0.018 * s, cy + ry * 0.72);
    ctx.lineTo(cx - 0.018 * s, cy + ry * 1.35);
    ctx.lineTo(lx - rx * 1.25, cy + ry * 1.35);
    ctx.lineTo(lx - rx * 1.25, ly - ry * 0.12);
    ctx.closePath();
    ctx.fill();
    // Right halter triangle
    ctx.beginPath();
    ctx.moveTo(rxPos - rx * 0.04, ryPos - ry * 1.08);
    ctx.quadraticCurveTo(rxPos - rx * 0.48, ryPos - ry * 0.02, cx + 0.018 * s, cy + ry * 0.72);
    ctx.lineTo(cx + 0.018 * s, cy + ry * 1.35);
    ctx.lineTo(rxPos + rx * 1.25, cy + ry * 1.35);
    ctx.lineTo(rxPos + rx * 1.25, ryPos - ry * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawUnderbustArc('#0f172a', 0.20);
    drawFabricApex(lx - rx * 0.10, ly + ry * 0.18);
    drawFabricApex(rxPos + rx * 0.10, ryPos + ry * 0.18);

    // Flush underbust tie string clamped strictly along the bottom of the twin cups!
    ctx.strokeStyle = rimCol || fillCol;
    ctx.lineWidth = Math.max(0.95, 0.024 * s);
    ctx.beginPath();
    ctx.moveTo(lx - rx * 0.68, ly + ry * 0.78);
    ctx.quadraticCurveTo(cx, cy + ry * 0.70, rxPos + rx * 0.68, ryPos + ry * 0.78);
    ctx.stroke();
    ctx.fillStyle = rimCol || fillCol;
    ctx.beginPath();
    ctx.arc(cx, cy + ry * 0.70, 0.022 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw subtle masculine chest / pectoral definition, natural male nipples & abs hint on bare male torso.
 */
function drawMaleChestDetails(ctx, chestX, shoulderY, waistY, prof, s) {
  if (s < 16) return;
  ctx.strokeStyle = 'rgba(72, 38, 18, 0.24)';
  ctx.lineWidth = Math.max(0.85, 0.021 * s);
  const pw = prof.bust * 0.44 * s;
  const py = shoulderY + 0.19 * s;
  if (prof.belly > 0.05) {
    ctx.beginPath();
    ctx.moveTo(chestX - pw * 1.18, py + 0.01 * s);
    ctx.quadraticCurveTo(chestX - pw * 0.5, py + 0.05 * s, chestX - 0.015 * s, py + 0.02 * s);
    ctx.moveTo(chestX + 0.015 * s, py + 0.02 * s);
    ctx.quadraticCurveTo(chestX + pw * 0.5, py + 0.05 * s, chestX + pw * 1.18, py + 0.01 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(chestX, waistY - 0.03 * s, prof.waist * 0.42 * s, 0.25, Math.PI - 0.25);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(chestX - pw * 1.24, py - 0.01 * s);
    ctx.quadraticCurveTo(chestX - pw * 0.62, py + 0.055 * s, chestX - 0.015 * s, py + 0.015 * s);
    ctx.moveTo(chestX + 0.015 * s, py + 0.015 * s);
    ctx.quadraticCurveTo(chestX + pw * 0.62, py + 0.055 * s, chestX + pw * 1.24, py - 0.01 * s);
    ctx.stroke();
  }
  // Natural anatomical male nipples tucked cleanly at lower-outer pectoral contour
  if (s >= 18) {
    ctx.fillStyle = 'rgba(104, 48, 28, 0.48)';
    const nipR = Math.max(1.1, 0.014 * s);
    ctx.beginPath();
    ctx.arc(chestX - pw * 0.90, py + 0.005 * s, nipR, 0, Math.PI * 2);
    ctx.arc(chestX + pw * 0.90, py + 0.005 * s, nipR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw sculpted, seamless bouncing back glutes nested cleanly inside the hip silhouette
 * with natural center gluteal cleft, soft lower infragluteal fold curves & upper-cheek highlights!
 */
function drawBouncingGlutes(ctx, hipX, hipY, prof, s, gbx, gby, gTilt, fillCol, shadeCol = null, isFabric = false) {
  const gs = prof.gluteScale || 1.0;
  const stretch = clamp((gby / Math.max(1, s)) * 2.4, -0.18, 0.20);
  // Seamless hip-matched width so cheeks blend cleanly into outer hips & thighs with zero double-bump!
  const rx = prof.hip * 0.44 * Math.min(1.05, 0.72 + gs * 0.28) * (1 - stretch * 0.24) * s;
  const ry = 0.126 * Math.min(1.08, 0.68 + gs * 0.32) * (1 + stretch) * s;
  const cx = hipX + gbx * 0.80;
  const cy = hipY + 0.024 * s + gby * 0.80;
  const sep = prof.hip * 0.34 * s;
  const lx = cx - sep;
  const ly = cy + gTilt;
  const rxPos = cx + sep;
  const ryPos = cy - gTilt;

  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.ellipse(lx, ly, rx, ry, 0.12 + gbx / (s * 2.3), 0, Math.PI * 2);
  ctx.ellipse(rxPos, ryPos, rx, ry, -0.12 + gbx / (s * 2.3), 0, Math.PI * 2);
  ctx.fill();

  if (s >= 18) {
    ctx.fillStyle = isFabric ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 246, 236, 0.18)';
    ctx.beginPath();
    ctx.ellipse(lx - rx * 0.12, ly - ry * 0.24, rx * 0.42, ry * 0.26, -0.18, 0, Math.PI * 2);
    ctx.ellipse(rxPos + rx * 0.12, ryPos - ry * 0.24, rx * 0.42, ry * 0.26, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft, natural center gluteal cleft & delicate lower cheek folds (no heavy dark circles!)
  if (s >= 15) {
    ctx.strokeStyle = isFabric ? 'rgba(15, 23, 42, 0.24)' : 'rgba(72, 28, 14, 0.26)';
    ctx.lineWidth = Math.max(0.8, 0.020 * s);
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry * 0.52);
    ctx.lineTo(cx, cy + ry * 0.82);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lx, ly + ry * 0.04, rx * 0.82, 0.40, Math.PI * 0.82);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rxPos, ryPos + ry * 0.04, rx * 0.82, Math.PI * 0.18, Math.PI - 0.40);
    ctx.stroke();
  }
}

/**
 * Resolve natural anatomical viewing angle ('front' | 'back' | 'side') for any topside character.
 * Prevents front-facing people from showing back glutes (and vice versa) while organically varying
 * crowd orientation across front, back, and side profiles!
 */
export function resolveTopsidePersonView(spec = {}) {
  if (spec.view === 'front' || spec.view === 'back' || spec.view === 'side') {
    return spec.view;
  }
  const role = spec.role || 'party-dance';
  const move = spec.danceMove || '';
  const seed = Math.abs(spec.seed || 0);
  if (move === 'twerk') return seed % 3 === 0 ? 'side' : 'back';
  if (move === 'running-man' || move === 'body-roll' || move === 'moonwalk') return 'side';
  if (move === 'macarena') return 'front';
  if (move === 'air-guitar' || move === 'hula' || move === 'shuffle' || move === 'robot') {
    return seed % 3 === 0 ? 'side' : 'front';
  }
  if (role === 'gear-tank') return 'side';
  if (role === 'gear-zip') return seed % 2 === 0 ? 'back' : 'side';
  if (role === 'gear-ready') return seed % 2 === 0 ? 'front' : 'side';
  if (role === 'party-toast') return seed % 3 === 0 ? 'front' : 'side';
  const cycle = ['front', 'side', 'back', 'side', 'front'];
  return cycle[seed % cycle.length];
}

// Zero-allocation scratch result for exact side-torso ribcage cubic Bezier evaluation
const _sideRib = { frontX: 0, backX: 0, y: 0 };

/**
 * Evaluate exact (frontX, backX, y) on `traceSideCurvyTorso`'s upper ribcage cubic Beziers for t in [0..1]
 * (0 = shoulderY, 1 = waistY). Guarantees side breasts, back straps, bandeaus & crops track the
 * curved ribcage and spine in 100% lockstep across every side-to-side sway!
 */
function evalSideTorsoAtT(t, chestX, hipX, shoulderY, waistY, prof, s) {
  const tc = clamp(t, 0, 1);
  const mt = 1 - tc;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const tc2 = tc * tc;
  const tc3 = tc2 * tc;
  const midX = (chestX + hipX) * 0.5;
  const frontChest = prof.bust * 0.68 * s;
  const backSh = prof.sh * 0.52 * s;
  const frontWaist = prof.waist * 0.62 * s;
  const backWaist = prof.waist * 0.52 * s;
  const buY = shoulderY + (waistY - shoulderY) * 0.44;

  const f0 = chestX + frontChest * 0.72;
  const f1 = chestX + frontChest * 1.04;
  const f2 = midX + frontWaist * 1.02;
  const f3 = midX + frontWaist;
  _sideRib.frontX = mt3 * f0 + 3 * mt2 * tc * f1 + 3 * mt * tc2 * f2 + tc3 * f3;

  const b0 = chestX - backSh;
  const b1 = chestX - backSh * 1.04;
  const b2 = midX - backWaist * 0.96;
  const b3 = midX - backWaist;
  _sideRib.backX = mt3 * b0 + 3 * mt2 * tc * b1 + 3 * mt * tc2 * b2 + tc3 * b3;

  const y0 = shoulderY + 0.015 * s;
  const y1 = buY - 0.02 * s;
  const y2 = waistY - 0.05 * s;
  const y3 = waistY;
  _sideRib.y = mt3 * y0 + 3 * mt2 * tc * y1 + 3 * mt * tc2 * y2 + tc3 * y3;
  return _sideRib;
}

/**
 * Trace a true side-profile S-curve female torso (facing +x):
 * Ribcage tracks spine rigidly (matching `evalSideTorsoAtT` exactly!), waist tapers cleanly,
 * and glutes curve smoothly backward (-x).
 */
function traceSideCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX = 0, hipX = 0, bbx = 0, bby = 0, gbx = 0, gby = 0) {
  const gStretch = clamp((gby / Math.max(1, s)) * 2.0, -0.18, 0.2);
  const midX = (chestX + hipX) * 0.5;
  const frontChest = prof.bust * 0.68 * s;
  const backSh = prof.sh * 0.52 * s;
  const frontWaist = prof.waist * 0.62 * s;
  const backWaist = prof.waist * 0.52 * s;
  const frontHip = prof.hip * 0.52 * s;
  const backGlute = prof.hip * (0.76 - gStretch * 0.18) * (0.7 + (prof.gluteScale || 1) * 0.3) * s;
  const buY = shoulderY + (waistY - shoulderY) * 0.44;
  const lowHipY = hipY + 0.13 * s + gby * 0.65;

  ctx.beginPath();
  ctx.moveTo(chestX - backSh, shoulderY + 0.015 * s);
  ctx.quadraticCurveTo(chestX, shoulderY - 0.055 * s, chestX + frontChest * 0.72, shoulderY + 0.015 * s);
  ctx.bezierCurveTo(
    chestX + frontChest * 1.04, buY - 0.02 * s,
    midX + frontWaist * 1.02, waistY - 0.05 * s,
    midX + frontWaist, waistY
  );
  ctx.bezierCurveTo(
    hipX + frontHip * 1.02, waistY + (hipY - waistY) * 0.45,
    hipX + frontHip * 0.96, hipY + 0.03 * s,
    hipX + frontHip * 0.62, lowHipY
  );
  ctx.quadraticCurveTo(hipX - backGlute * 0.1 + gbx * 0.3, lowHipY + 0.055 * s, hipX - backGlute * 0.68 + gbx * 0.55, lowHipY - 0.01 * s);
  ctx.bezierCurveTo(
    hipX - backGlute * 1.14 + gbx * 0.68, hipY + 0.02 * s + gby * 0.6,
    hipX - backGlute * 0.96 + gbx * 0.45, waistY + (hipY - waistY) * 0.44 + gby * 0.25,
    midX - backWaist, waistY
  );
  ctx.bezierCurveTo(
    midX - backWaist * 0.96, waistY - 0.05 * s,
    chestX - backSh * 1.04, buY - 0.02 * s,
    chestX - backSh, shoulderY + 0.015 * s
  );
  ctx.closePath();
}

/**
 * Trace a true side-profile masculine torso (facing +x):
 * Broad upper chest (+x), optional warm dad-bod belly curve (+x), broad lats & compact glute (-x).
 */
function traceSideMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX = 0, hipX = 0) {
  const midX = (chestX + hipX) * 0.5;
  const frontChest = prof.bust * 0.76 * s;
  const backSh = prof.sh * 0.54 * s;
  const bellyOut = (prof.belly || 0) * s;
  const frontWaist = prof.waist * 0.64 * s + bellyOut;
  const backWaist = prof.waist * 0.52 * s;
  const frontHip = prof.hip * 0.58 * s + bellyOut * 0.45;
  const backGlute = prof.hip * 0.68 * s;
  const chY = shoulderY + (waistY - shoulderY) * 0.38;
  const lowHipY = hipY + 0.13 * s;

  ctx.beginPath();
  ctx.moveTo(chestX - backSh, shoulderY + 0.01 * s);
  ctx.quadraticCurveTo(chestX, shoulderY - 0.055 * s, chestX + frontChest * 0.75, shoulderY + 0.02 * s);
  // Broad flat/muscular chest -> flat tummy OR warm dad-bod belly -> front hip
  ctx.bezierCurveTo(
    chestX + frontChest * 1.14, chY,
    midX + frontWaist * 1.08, waistY - 0.04 * s,
    midX + frontWaist, waistY
  );
  ctx.bezierCurveTo(
    hipX + frontHip * 1.08, waistY + (hipY - waistY) * 0.46,
    hipX + frontHip * 0.96, hipY + 0.03 * s,
    hipX + frontHip * 0.68, lowHipY
  );
  ctx.quadraticCurveTo(hipX - backGlute * 0.08, lowHipY + 0.045 * s, hipX - backGlute * 0.66, lowHipY - 0.01 * s);
  ctx.bezierCurveTo(
    hipX - backGlute * 1.06, hipY + 0.02 * s,
    hipX - backGlute * 0.92, waistY + (hipY - waistY) * 0.45,
    midX - backWaist, waistY
  );
  ctx.bezierCurveTo(
    midX - backWaist * 0.96, waistY - 0.08 * s,
    chestX - backSh * 1.12, chY,
    chestX - backSh, shoulderY + 0.01 * s
  );
  ctx.closePath();
}

/**
 * Draw an anatomical gravity-draped teardrop side-profile female breast (+x) welded directly onto
 * `traceSideCurvyTorso`'s exact curved ribcage contour (`evalSideTorsoAtT`).
 * - Back straps, bandeaus & sporty-crops track the EXACT curved back contour (0.0px poke-out on any sway!).
 * - Swimsuit cups clip directly onto the moving teardrop breast so fabric visibly holds breasts in and
 *   stretches elastically WITH them (zero independent drift during side-to-side movement!).
 */
function drawSideBouncingBust(
  ctx,
  chestX,
  hipX,
  shoulderY,
  waistY,
  prof,
  s,
  bbx,
  bby,
  fillCol,
  rimCol = null,
  skinCol = '#e0a878',
  topStyle = 'triangle-halter',
  bustScale = 1.0,
  isWetsuit = false
) {
  const cs = bustScale || prof.cupScale || 1.0;
  // Tightly contained elastic swimsuit bounce anchored onto exact curved ribcage!
  const vBounce = clamp(bby * 0.48, -0.028 * s, 0.032 * s);
  const hLag = clamp(bbx * 0.14, -0.014 * s, 0.014 * s);
  const stretch = clamp((vBounce / Math.max(1, s)) * 2.6, -0.14, 0.16);
  const torsoH = Math.max(0.18 * s, waistY - shoulderY);

  // Evaluate exact ribcage front & back edges at shoulder-top, neckline-cut, apex, and underbust-base!
  const tTop = 0.20;
  const dropFrac = clamp(0.62 * Math.pow(cs, 0.65) * (1 + stretch * 0.35), 0.46, 0.72);
  const tBase = clamp(tTop + dropFrac + (vBounce * 0.45) / torsoH, tTop + 0.38, 0.94);
  const tApex = clamp(tTop + (tBase - tTop) * 0.58 + (vBounce * 0.55) / torsoH, tTop + 0.20, tBase - 0.14);
  const tCut = clamp(tTop + (tBase - tTop) * (topStyle === 'bandeau' ? 0.34 : 0.44), tTop + 0.12, tApex - 0.04);

  const rTop = evalSideTorsoAtT(tTop, chestX, hipX, shoulderY, waistY, prof, s);
  const topFrontX = rTop.frontX;
  const topBackX = rTop.backX;
  const topY = rTop.y;

  const rCut = evalSideTorsoAtT(tCut, chestX, hipX, shoulderY, waistY, prof, s);
  const cutFrontX = rCut.frontX;
  const cutBackX = rCut.backX;
  const cutY = rCut.y;

  const rApex = evalSideTorsoAtT(tApex, chestX, hipX, shoulderY, waistY, prof, s);
  const midFrontX = rApex.frontX;
  const midBackX = rApex.backX;
  const apexY = rApex.y + vBounce * 0.22;

  const rBase = evalSideTorsoAtT(tBase, chestX, hipX, shoulderY, waistY, prof, s);
  const baseFrontX = rBase.frontX;
  const baseBackX = rBase.backX;
  const baseY = rBase.y + vBounce * 0.12;

  const dropH = Math.max(0.08 * s, baseY - topY);
  // Natural forward projection measured cleanly FROM the moving front chest wall (`midFrontX`)!
  const proj = prof.bust * (0.04 + 0.30 * Math.pow(cs, 1.15)) * (1 - stretch * 0.16) * s;
  const topX = topFrontX - 0.032 * s;
  const baseX = baseFrontX - 0.028 * s;
  const apexX = midFrontX + proj + hLag;
  const cupSpan = Math.max(0.05 * s, apexX - midFrontX);

  // Trace C1-continuous anatomical teardrop welded directly into the curved ribcage wall!
  const traceTeardrop = () => {
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.bezierCurveTo(
      topFrontX + cupSpan * 0.34, topY + dropH * 0.14,
      apexX, apexY - dropH * 0.28,
      apexX, apexY
    );
    ctx.bezierCurveTo(
      apexX, apexY + dropH * 0.34,
      baseFrontX + cupSpan * 0.42, baseY + 0.018 * s,
      baseX, baseY
    );
    ctx.quadraticCurveTo(midFrontX - 0.045 * s, (topY + baseY) * 0.5, topX, topY);
    ctx.closePath();
  };

  // Subtle tight-swimwear fabric apex contour at the natural teardrop peak
  const drawSideFabricApex = () => {
    if (s < 20) return;
    const ax = apexX - 0.016 * s;
    const ay = apexY + 0.002 * s;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
    ctx.beginPath();
    ctx.arc(ax, ay + 0.004 * s, Math.max(1.0, 0.015 * s), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.arc(ax - 0.003 * s, ay - 0.004 * s, Math.max(0.75, 0.010 * s), 0, Math.PI * 2);
    ctx.fill();
  };

  // Soft underbust ribcage shadow tucked cleanly beneath the teardrop base
  if (s >= 14) {
    ctx.fillStyle = isWetsuit ? 'rgba(2, 6, 23, 0.20)' : 'rgba(82, 38, 18, 0.15)';
    ctx.beginPath();
    ctx.ellipse(baseFrontX + cupSpan * 0.34, baseY + 0.009 * s, cupSpan * 0.42, Math.max(1.1, 0.018 * s), 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // 1. Torso-hugging back strap / curved back panel STRICTLY INSIDE `evalSideTorsoAtT`'s curved back edge!
  const backInset = 0.010 * s;
  if (!isWetsuit && topStyle === 'sporty-crop') {
    const rSh = evalSideTorsoAtT(0.05, chestX, hipX, shoulderY, waistY, prof, s);
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.moveTo(rSh.backX + backInset, rSh.y);
    ctx.lineTo(rSh.frontX - 0.02 * s, rSh.y);
    ctx.quadraticCurveTo(midBackX + (midFrontX - midBackX) * 0.52, (rSh.y + baseY) * 0.56, baseFrontX + 0.02 * s, baseY + 0.008 * s);
    ctx.lineTo(baseBackX + backInset, baseY + 0.008 * s);
    ctx.quadraticCurveTo(midBackX + backInset, (rSh.y + baseY) * 0.5, rSh.backX + backInset, rSh.y);
    ctx.closePath();
    ctx.fill();
  } else if (!isWetsuit && topStyle === 'bandeau') {
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.moveTo(cutBackX + backInset, cutY + 0.014 * s);
    ctx.lineTo(cutFrontX + 0.02 * s, cutY + 0.014 * s);
    ctx.lineTo(baseFrontX + 0.02 * s, baseY - 0.004 * s);
    ctx.lineTo(baseBackX + backInset, baseY - 0.004 * s);
    ctx.quadraticCurveTo(midBackX + backInset, (cutY + baseY) * 0.5, cutBackX + backInset, cutY + 0.014 * s);
    ctx.closePath();
    ctx.fill();
  } else if (!isWetsuit && (topStyle === 'triangle-halter' || topStyle === 'wrap-crisscross' || topStyle === 'balconette')) {
    // Horizontal bikini back band anchored strictly inside exact curved back edge -> outer cup base!
    ctx.strokeStyle = fillCol;
    ctx.lineWidth = Math.max(1.0, 0.026 * s);
    ctx.beginPath();
    ctx.moveTo(baseBackX + backInset * 1.3, baseY - 0.018 * s);
    ctx.lineTo(baseFrontX + cupSpan * 0.24, baseY - 0.018 * s);
    ctx.stroke();
  }

  // 2. Full anatomical skin teardrop welded seamlessly onto curved ribcage wall
  const showUpperSkin = !isWetsuit && topStyle !== 'sporty-crop';
  if (showUpperSkin) {
    ctx.fillStyle = skinCol;
    traceTeardrop();
    ctx.fill();
    if (s >= 18) {
      ctx.strokeStyle = 'rgba(72, 28, 14, 0.20)';
      ctx.lineWidth = Math.max(0.7, 0.015 * s);
      ctx.beginPath();
      ctx.moveTo(topFrontX + cupSpan * 0.22, topY + dropH * 0.16);
      ctx.quadraticCurveTo(midFrontX + cupSpan * 0.56, topY + dropH * 0.34, midFrontX + cupSpan * 0.48, apexY - dropH * 0.08);
      ctx.stroke();
    }
  }

  // 3. Tight fitted swimsuit cup CLIPPED STRICTLY onto the moving teardrop breast (zero independent drift!)
  // Sculpted open-side cup contours reveal natural lateral side-boob skin along the ribcage/armhole!
  ctx.save();
  traceTeardrop();
  if (typeof ctx.clip === 'function') ctx.clip();
  ctx.fillStyle = fillCol;
  if (isWetsuit) {
    ctx.fillRect(topX - 0.1 * s, topY - 0.1 * s, (apexX - topX) + 0.25 * s, dropH + 0.25 * s);
  } else if (topStyle === 'sporty-crop') {
    // Athletic low-cut armhole revealing a clean crescent of lateral side-boob!
    const sideBackX = midFrontX + cupSpan * 0.24;
    ctx.beginPath();
    ctx.moveTo(topFrontX + cupSpan * 0.08, topY - 0.02 * s);
    ctx.lineTo(apexX + 0.10 * s, topY - 0.02 * s);
    ctx.lineTo(apexX + 0.10 * s, baseY + 0.08 * s);
    ctx.lineTo(baseX - 0.06 * s, baseY + 0.08 * s);
    ctx.quadraticCurveTo(sideBackX, (topY + baseY) * 0.54, topFrontX + cupSpan * 0.08, topY - 0.02 * s);
    ctx.closePath();
    ctx.fill();
  } else if (topStyle === 'plunge-onepiece') {
    // Low-cut open-side monokini armhole revealing a sleek curved side-boob contour!
    const armCutX = midFrontX + cupSpan * 0.34;
    ctx.beginPath();
    ctx.moveTo(topFrontX + cupSpan * 0.24, topY + dropH * 0.08);
    ctx.quadraticCurveTo(midFrontX + cupSpan * 0.56, topY + dropH * 0.24, apexX + 0.06 * s, apexY - dropH * 0.18);
    ctx.lineTo(apexX + 0.10 * s, baseY + 0.08 * s);
    ctx.lineTo(baseFrontX + cupSpan * 0.14, baseY + 0.08 * s);
    ctx.quadraticCurveTo(armCutX, (topY + baseY) * 0.56, topFrontX + cupSpan * 0.24, topY + dropH * 0.08);
    ctx.closePath();
    ctx.fill();
    if (s >= 16) {
      ctx.strokeStyle = 'rgba(72, 28, 14, 0.22)';
      ctx.lineWidth = Math.max(0.75, 0.017 * s);
      ctx.beginPath();
      ctx.moveTo(topFrontX + cupSpan * 0.24, topY + dropH * 0.08);
      ctx.quadraticCurveTo(armCutX, (topY + baseY) * 0.56, baseFrontX + cupSpan * 0.14, baseY + 0.01 * s);
      ctx.stroke();
    }
  } else if (topStyle === 'balconette') {
    const wingX = midFrontX + cupSpan * 0.24;
    ctx.beginPath();
    ctx.moveTo(wingX, cutY + 0.008 * s);
    ctx.quadraticCurveTo(midFrontX + cupSpan * 0.54, cutY - 0.008 * s, apexX + 0.06 * s, apexY - dropH * 0.14);
    ctx.lineTo(apexX + 0.10 * s, baseY + 0.08 * s);
    ctx.lineTo(baseFrontX + cupSpan * 0.10, baseY + 0.08 * s);
    ctx.quadraticCurveTo(wingX - 0.01 * s, (cutY + baseY) * 0.55, wingX, cutY + 0.008 * s);
    ctx.closePath();
    ctx.fill();
    if (rimCol && s >= 15) {
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = Math.max(0.85, 0.022 * s);
      ctx.beginPath();
      ctx.moveTo(wingX, cutY + 0.008 * s);
      ctx.quadraticCurveTo(midFrontX + cupSpan * 0.54, cutY - 0.008 * s, apexX + 0.04 * s, apexY - dropH * 0.14);
      ctx.stroke();
    }
  } else if (topStyle === 'bandeau') {
    const wingX = midFrontX + cupSpan * 0.22;
    ctx.beginPath();
    ctx.moveTo(wingX, cutY + 0.012 * s);
    ctx.lineTo(apexX + 0.06 * s, apexY - dropH * 0.20);
    ctx.lineTo(apexX + 0.10 * s, baseY + 0.08 * s);
    ctx.lineTo(baseFrontX + cupSpan * 0.10, baseY + 0.08 * s);
    ctx.quadraticCurveTo(wingX - 0.01 * s, (cutY + baseY) * 0.55, wingX, cutY + 0.012 * s);
    ctx.closePath();
    ctx.fill();
  } else {
    // Triangle-halter & wrap-crisscross: diagonal outer triangle seam curves cleanly forward,
    // leaving a natural, unmistakable lateral side-boob skin curve down to the underbust strap!
    const peakX = topFrontX + cupSpan * 0.34;
    const peakY = topY + dropH * 0.16;
    const outerBaseX = baseFrontX + cupSpan * 0.22;
    const outerMidX = midFrontX + cupSpan * 0.38;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(apexX + 0.08 * s, apexY - dropH * 0.22);
    ctx.lineTo(apexX + 0.10 * s, baseY + 0.08 * s);
    ctx.lineTo(outerBaseX, baseY + 0.08 * s);
    ctx.quadraticCurveTo(outerMidX, (peakY + baseY) * 0.56, peakX, peakY);
    ctx.closePath();
    ctx.fill();
    if (rimCol && s >= 15) {
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = Math.max(0.8, 0.020 * s);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.quadraticCurveTo(outerMidX, (peakY + baseY) * 0.56, outerBaseX, baseY);
      ctx.stroke();
    }
    if (s >= 18) {
      // Soft skin-compression shadow along the lateral cup edge against the exposed side-boob!
      ctx.strokeStyle = 'rgba(72, 28, 14, 0.22)';
      ctx.lineWidth = Math.max(0.75, 0.016 * s);
      ctx.beginPath();
      ctx.moveTo(peakX - 0.008 * s, peakY + 0.008 * s);
      ctx.quadraticCurveTo(outerMidX - 0.014 * s, (peakY + baseY) * 0.56, outerBaseX - 0.010 * s, baseY);
      ctx.stroke();
    }
  }

  // Subtle lateral side-boob skin highlight & curve contour along the exposed outer breast!
  if (!isWetsuit && s >= 18) {
    ctx.fillStyle = 'rgba(255, 246, 236, 0.16)';
    ctx.beginPath();
    ctx.ellipse(midFrontX + cupSpan * 0.14, apexY + dropH * 0.04, Math.max(1.2, cupSpan * 0.16), dropH * 0.24, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunlit upper-cup sheen & subtle tight-swimwear apex contour inside the clip
  if (s >= 20) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.ellipse(midFrontX + cupSpan * 0.52, apexY - dropH * 0.14, cupSpan * 0.22, dropH * 0.08, 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!isWetsuit) drawSideFabricApex();
  ctx.restore();

  // 4. Taut elastic shoulder/halter straps & sporty-crop contrast underband (strictly inside back edge!)
  if (!isWetsuit && topStyle === 'balconette') {
    ctx.strokeStyle = fillCol;
    ctx.lineWidth = Math.max(0.95, 0.023 * s);
    ctx.beginPath();
    ctx.moveTo(chestX - 0.01 * s, shoulderY + 0.024 * s);
    ctx.lineTo(cutFrontX + cupSpan * 0.14, cutY + 0.006 * s);
    ctx.stroke();
  } else if (!isWetsuit && (topStyle === 'triangle-halter' || topStyle === 'wrap-crisscross')) {
    ctx.strokeStyle = rimCol || fillCol;
    ctx.lineWidth = Math.max(0.95, 0.022 * s);
    ctx.beginPath();
    ctx.moveTo(chestX + 0.02 * s, shoulderY + 0.014 * s);
    ctx.lineTo(topFrontX + cupSpan * 0.24, topY + dropH * 0.14);
    ctx.stroke();
  } else if (!isWetsuit && topStyle === 'bandeau') {
    if (rimCol && s >= 15) {
      // Single continuous unbroken top trim running seamlessly from curved back edge across the teardrop cup!
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = Math.max(0.85, 0.020 * s);
      ctx.beginPath();
      ctx.moveTo(cutBackX + backInset * 1.2, cutY + 0.008 * s);
      ctx.quadraticCurveTo(cutFrontX + cupSpan * 0.16, cutY + 0.006 * s, apexX - cupSpan * 0.14, apexY - dropH * 0.20);
      ctx.stroke();
    }
  } else if (!isWetsuit && topStyle === 'sporty-crop') {
    const bandL = baseBackX + backInset * 1.6;
    const bandR = baseFrontX + cupSpan * 0.34;
    ctx.fillStyle = rimCol || '#ffffff';
    ctx.fillRect(bandL, baseY - 0.022 * s, Math.max(0.05 * s, bandR - bandL), 0.036 * s);
  } else if (isWetsuit && rimCol && s >= 16) {
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = Math.max(0.9, 0.022 * s);
    ctx.beginPath();
    ctx.moveTo(topFrontX - 0.01 * s, topY + dropH * 0.16);
    ctx.quadraticCurveTo(midFrontX + cupSpan * 0.56, apexY - dropH * 0.06, baseFrontX + cupSpan * 0.40, baseY - 0.01 * s);
    ctx.stroke();
  }

  // 5. Crisp underbust inframammary tuck crease hugging the exact lower teardrop bezier
  if (s >= 16) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = Math.max(0.8, 0.018 * s);
    ctx.beginPath();
    ctx.moveTo(apexX - cupSpan * 0.02, apexY + dropH * 0.14);
    ctx.bezierCurveTo(
      apexX - cupSpan * 0.02, apexY + dropH * 0.36,
      baseFrontX + cupSpan * 0.42, baseY + 0.018 * s,
      baseX + 0.01 * s, baseY
    );
    ctx.stroke();
  }
}

/**
 * Draw sculpted tight-fit backward-projecting side-profile glutes (-x) blended cleanly into the hip S-curve!
 */
function drawSideBouncingGlutes(ctx, hipX, hipY, prof, s, gbx, gby, fillCol, shadeCol = null, isFabric = false) {
  const gs = prof.gluteScale || 1.0;
  const stretch = clamp((gby / Math.max(1, s)) * 2.4, -0.16, 0.18);
  const rx = prof.hip * 0.50 * (0.72 + gs * 0.28) * (1 - stretch * 0.22) * s;
  const ry = 0.130 * (0.72 + gs * 0.28) * (1 + stretch) * s;
  const cx = hipX - prof.hip * 0.24 * s + gbx * 0.68;
  const cy = hipY + 0.022 * s + gby * 0.68;

  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, -0.14 + gbx / (s * 2.4), 0, Math.PI * 2);
  ctx.fill();
  if (s >= 18) {
    ctx.fillStyle = isFabric ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 246, 236, 0.13)';
    ctx.beginPath();
    ctx.ellipse(
      cx - rx * 0.16,
      isFabric ? cy - ry * 0.24 : cy + ry * 0.28,
      rx * 0.36,
      ry * 0.22,
      -0.22,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  if (s >= 16) {
    // Crisp infragluteal lower-butt tuck crease where round glute meets back of thigh!
    ctx.strokeStyle = isFabric ? 'rgba(15, 23, 42, 0.24)' : 'rgba(72, 28, 14, 0.26)';
    ctx.lineWidth = Math.max(0.85, 0.020 * s);
    ctx.beginPath();
    ctx.arc(cx, cy + ry * 0.04, rx * 0.88, Math.PI * 0.42, Math.PI * 0.96);
    ctx.stroke();
  }
}

/**
 * Draw natural lateral side-boob contours peeking subtly past the outer ribcage in Female Back View (v296)!
 * Drawn behind the back torso so ONLY the smooth outer rounded curves protrude naturally beyond the lats,
 * synced with spring-mass bust bounce (`bbx, bby, bTilt`) and `prof.cupScale * bustScale`.
 */
function drawBackViewSideBoob(ctx, chestX, hipX, shoulderY, waistY, prof, s, bbx, bby, bTilt, skin, skinShade, swim, topStyle, bustScale = 1.0) {
  const cs = Math.min(1.45, (prof.cupScale || 1.0) * (bustScale || 1.0));
  const vBounce = clamp(bby * 0.45, -0.024 * s, 0.028 * s);
  const hLag = clamp(bbx * 0.24, -0.015 * s, 0.015 * s);
  const torsoH = Math.max(0.18 * s, waistY - shoulderY);
  const ribCx = chestX + (hipX - chestX) * 0.18 + hLag;
  // Sit naturally below the armpit/shoulder joint so outer breast curves peek tastefully past the ribcage!
  const buY = shoulderY + torsoH * 0.49 + vBounce;
  const sideRx = prof.bust * (0.18 + 0.09 * cs) * s;
  const sideRy = torsoH * (0.18 + 0.05 * cs);
  const outOff = prof.bust * (0.64 + 0.07 * cs) * s;

  // Exposed rounded outer breast curves peeking subtly past left & right ribcage edges!
  for (const side of [-1, 1]) {
    const bx = ribCx + side * outOff;
    const by = buY + side * bTilt * 0.4;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(bx, by, sideRx, sideRy, side * 0.20, 0, Math.PI * 2);
    ctx.fill();

    // Soft warm contour shading along outer lower side-boob + delicate cup edge wrap
    if (s >= 16) {
      ctx.strokeStyle = 'rgba(72, 28, 14, 0.22)';
      ctx.lineWidth = Math.max(0.7, 0.014 * s);
      ctx.beginPath();
      ctx.arc(bx, by, sideRx * 0.94, side > 0 ? -Math.PI * 0.24 : Math.PI * 0.76, side > 0 ? Math.PI * 0.44 : Math.PI * 1.24);
      ctx.stroke();

      if (topStyle !== 'sporty-crop') {
        ctx.strokeStyle = swim.primary;
        ctx.lineWidth = Math.max(0.95, 0.022 * s);
        ctx.beginPath();
        ctx.arc(bx, by + sideRy * 0.06, sideRx * 0.96, side > 0 ? 0.12 : Math.PI - 0.50, side > 0 ? 0.50 : Math.PI - 0.12);
        ctx.stroke();
      }
    }
  }
}

const _hipEdge = { leftX: 0, rightX: 0, y: 0, cx: 0, halfW: 0 };
const _sideHipEdge = { frontX: 0, backX: 0, y: 0 };

/**
 * Evaluate exact left/right hip silhouette points along `traceCurvyTorso`'s lower cubic Bezier
 * from waistY (t=0) to lowHipY (t=1) so swimwear waistbands & hip ties lock 100% flush to skin!
 */
function evalFrontHipEdgeAtT(t, chestX, hipX, waistY, hipY, prof, s, gbx = 0, gby = 0) {
  const tc = clamp(t, 0, 1);
  const mt = 1 - tc;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const tc2 = tc * tc;
  const tc3 = tc2 * tc;
  const gStretch = clamp((gby / Math.max(1, s)) * 2.0, -0.16, 0.18);
  const waW = prof.waist * 0.94 * s;
  const hiW = prof.hip * (1 - gStretch * 0.24) * s;
  const midWaistX = (chestX + hipX) * 0.5;
  const hipCx = hipX + gbx * 0.58;
  const lowHipY = hipY + 0.11 * s + gby * 0.55;

  const rx0 = midWaistX + waW;
  const rx1 = hipCx + hiW * 0.96;
  const rx2 = hipCx + hiW * 0.94;
  const rx3 = hipCx + hiW * 0.56;
  _hipEdge.rightX = mt3 * rx0 + 3 * mt2 * tc * rx1 + 3 * mt * tc2 * rx2 + tc3 * rx3;

  const lx0 = midWaistX - waW;
  const lx1 = hipCx - hiW * 0.96;
  const lx2 = hipCx - hiW * 0.94;
  const lx3 = hipCx - hiW * 0.56;
  _hipEdge.leftX = mt3 * lx0 + 3 * mt2 * tc * lx1 + 3 * mt * tc2 * lx2 + tc3 * lx3;

  const y0 = waistY;
  const y1 = waistY + (hipY - waistY) * 0.44 + gby * 0.28;
  const y2 = hipY + 0.01 * s + gby * 0.5;
  const y3 = lowHipY;
  _hipEdge.y = mt3 * y0 + 3 * mt2 * tc * y1 + 3 * mt * tc2 * y2 + tc3 * y3;
  _hipEdge.cx = (_hipEdge.leftX + _hipEdge.rightX) * 0.5;
  _hipEdge.halfW = (_hipEdge.rightX - _hipEdge.leftX) * 0.5;
  return _hipEdge;
}

/**
 * Evaluate exact front (+x) and back (-x) hip/glute boundaries along `traceSideCurvyTorso`'s
 * lower cubic Beziers from waistY (t=0) to lowHipY (t=1) so side-view bottoms fit skin-tight!
 */
function evalSideHipEdgeAtT(t, chestX, hipX, waistY, hipY, prof, s, gbx = 0, gby = 0) {
  const tc = clamp(t, 0, 1);
  const mt = 1 - tc;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const tc2 = tc * tc;
  const tc3 = tc2 * tc;
  const gStretch = clamp((gby / Math.max(1, s)) * 2.0, -0.18, 0.2);
  const midX = (chestX + hipX) * 0.5;
  const frontWaist = prof.waist * 0.62 * s;
  const backWaist = prof.waist * 0.52 * s;
  const frontHip = prof.hip * 0.52 * s;
  const backGlute = prof.hip * (0.76 - gStretch * 0.18) * (0.7 + (prof.gluteScale || 1) * 0.3) * s;
  const lowHipY = hipY + 0.13 * s + gby * 0.65;

  const fx0 = midX + frontWaist;
  const fx1 = hipX + frontHip * 1.02;
  const fx2 = hipX + frontHip * 0.96;
  const fx3 = hipX + frontHip * 0.62;
  _sideHipEdge.frontX = mt3 * fx0 + 3 * mt2 * tc * fx1 + 3 * mt * tc2 * fx2 + tc3 * fx3;

  const bx0 = midX - backWaist;
  const bx1 = hipX - backGlute * 0.96 + gbx * 0.45;
  const bx2 = hipX - backGlute * 1.14 + gbx * 0.68;
  const bx3 = hipX - backGlute * 0.68 + gbx * 0.55;
  _sideHipEdge.backX = mt3 * bx0 + 3 * mt2 * tc * bx1 + 3 * mt * tc2 * bx2 + tc3 * bx3;

  const y0 = waistY;
  const y1 = waistY + (hipY - waistY) * 0.45;
  const y2 = hipY + 0.03 * s;
  const y3 = lowHipY;
  _sideHipEdge.y = mt3 * y0 + 3 * mt2 * tc * y1 + 3 * mt * tc2 * y2 + tc3 * y3;
  return _sideHipEdge;
}

/**
 * Draw body-locked, clip-fitted female swimwear bottoms (v295) across Front, Back, and Side views!
 * Clips fabric strictly to the exact anatomical body + glute silhouette so edges NEVER overhang,
 * while rendering authentic hip-crest elastic compression, leg-pivot contours & fabric tension lines.
 */
function drawFittedFemaleBottoms(
  ctx,
  view,
  chestX,
  hipX,
  shoulderY,
  waistY,
  hipY,
  lHipX,
  rHipX,
  lKneeX,
  rKneeX,
  prof,
  s,
  bbx,
  bby,
  gbx,
  gby,
  gTilt,
  shTilt,
  swim,
  skin,
  topStyle,
  isOnePiece = false
) {
  const hasSideTies = !isOnePiece && (topStyle === 'triangle-halter' || topStyle === 'wrap-crisscross');

  if (view === 'side') {
    const gs = prof.gluteScale || 1.0;
    const stretch = clamp((gby / Math.max(1, s)) * 2.4, -0.16, 0.18);
    const glRx = prof.hip * 0.50 * (0.72 + gs * 0.28) * (1 - stretch * 0.22) * s;
    const glRy = 0.130 * (0.72 + gs * 0.28) * (1 + stretch) * s;
    const glCx = hipX - prof.hip * 0.24 * s + gbx * 0.68;
    const glCy = hipY + 0.025 * s + gby * 0.68;
    const glRot = -0.14 + gbx / (s * 2.4);

    const eTop = evalSideHipEdgeAtT(0.38, chestX, hipX, waistY, hipY, prof, s, gbx, gby);
    const topFrontX = eTop.frontX;
    const topBackX = eTop.backX;
    const topY = eTop.y;
    const eMid = evalSideHipEdgeAtT(0.64, chestX, hipX, waistY, hipY, prof, s, gbx, gby);
    const midFrontX = eMid.frontX;
    const midBackX = Math.min(eMid.backX, glCx - glRx * 0.96);
    const midY = eMid.y;

    // Leg-socket pivot flex so the high-cut French leg arch responds cleanly when the front thigh lifts!
    const frontLegLift = clamp((rKneeX - rHipX) / Math.max(1, s), -0.35, 0.45);
    const hipApexX = midFrontX * 0.46 + midBackX * 0.54;
    const hipApexY = topY + (midY - topY) * 0.22 - frontLegLift * 0.025 * s;
    const frontWaistY = topY + 0.040 * s;
    const backWaistY = topY - 0.015 * s;
    const strapH = isOnePiece ? 0.088 * s : 0.072 * s;
    // Front groin-pelvis point sits cleanly on the front pelvic edge; rear cheek seam follows the rounded
    // butt cheek smoothly past its fullest apex down to the lower-rear curve (matching Back View cheeky fit!).
    const frontPelvisX = midFrontX + 0.06 * s;
    const frontPelvisY = midY + 0.088 * s;
    const apexArchY = hipApexY + strapH * 0.90;
    const cheekEdgeX = Math.min(eMid.backX, glCx - glRx) - 0.02 * s;
    const cheekEdgeY = glCy + glRy * (isOnePiece ? 0.62 : 0.54);
    const farBackX = cheekEdgeX - 0.34 * s;
    const farFrontX = Math.max(topFrontX, frontPelvisX) + 0.24 * s;

    // 1. Clip fabric strictly inside the exact side torso + glute silhouette (ZERO overhang & ZERO rear chop-off!)
    ctx.save();
    traceSideCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX, bbx, bby, gbx, gby);
    ctx.moveTo(glCx + glRx * Math.cos(glRot), glCy + glRx * Math.sin(glRot));
    ctx.ellipse(glCx, glCy, glRx, glRy, glRot, 0, Math.PI * 2);
    ctx.clip?.();

    const traceLegAndCheekOpening = () => {
      // C1-continuous high-cut French leg arch UP from front groin to lateral hip crest (zero pinch/kink!),
      // then sweeping smoothly down around the rounded butt cheek just like Back View!
      ctx.bezierCurveTo(
        midFrontX - 0.01 * s, apexArchY + 0.032 * s,
        hipApexX + 0.062 * s, apexArchY,
        hipApexX, apexArchY
      );
      ctx.bezierCurveTo(
        hipApexX - 0.062 * s, apexArchY,
        glCx - glRx * 0.26, cheekEdgeY - 0.028 * s,
        cheekEdgeX, cheekEdgeY
      );
    };

    const traceSideGarmentPath = () => {
      ctx.beginPath();
      if (!isOnePiece) {
        ctx.moveTo(farBackX, backWaistY - 0.01 * s);
        ctx.lineTo(topBackX, backWaistY);
        ctx.quadraticCurveTo(hipApexX, hipApexY - 0.014 * s, topFrontX + 0.16 * s, frontWaistY);
        ctx.lineTo(frontPelvisX, frontPelvisY);
      } else {
        ctx.moveTo(farBackX, shoulderY + 0.03 * s);
        ctx.lineTo(farFrontX, shoulderY + 0.03 * s);
        ctx.lineTo(farFrontX, frontPelvisY);
        ctx.lineTo(frontPelvisX, frontPelvisY);
      }
      traceLegAndCheekOpening();
      ctx.lineTo(farBackX, cheekEdgeY);
      ctx.closePath();
    };

    if (!isOnePiece) {
      // Soft skin-compression shadow directly above the elastic waistband
      if (s >= 18) {
        ctx.strokeStyle = 'rgba(72, 28, 14, 0.24)';
        ctx.lineWidth = Math.max(0.9, 0.022 * s);
        ctx.beginPath();
        ctx.moveTo(farBackX, backWaistY - 0.012 * s);
        ctx.lineTo(topBackX, backWaistY - 0.012 * s);
        ctx.quadraticCurveTo(hipApexX, hipApexY - 0.024 * s, topFrontX + 0.10 * s, frontWaistY - 0.012 * s);
        ctx.stroke();
      }
    }

    // Fill swimsuit fabric cleanly (bikini bottom OR unified one-piece bodice + cheeky leg cut)
    ctx.fillStyle = swim.primary;
    traceSideGarmentPath();
    ctx.fill();

    // Clip fabric highlight & curved tension lines strictly INSIDE the garment (ZERO bleed onto bare cheek!)
    if (s >= 18) {
      ctx.save();
      traceSideGarmentPath();
      ctx.clip?.();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.ellipse(glCx - glRx * 0.26, glCy - glRy * 0.22, glRx * 0.34, glRy * 0.18, -0.26, 0, Math.PI * 2);
      ctx.fill();

      if (s >= 20) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = Math.max(0.7, 0.013 * s);
        ctx.beginPath();
        ctx.moveTo(hipApexX - 0.01 * s, hipApexY + strapH * 0.28);
        ctx.quadraticCurveTo(glCx + glRx * 0.04, glCy - glRy * 0.26, glCx - glRx * 0.68, glCy - glRy * 0.12);
        ctx.moveTo(hipApexX - 0.01 * s, hipApexY + strapH * 0.60);
        ctx.quadraticCurveTo(glCx - glRx * 0.04, glCy - glRy * 0.04, glCx - glRx * 0.64, glCy + glRy * 0.18);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (!isOnePiece) {
      // Elastic waistband contrast trim locked flush along the top contour
      ctx.strokeStyle = swim.accent;
      ctx.lineWidth = Math.max(0.95, 0.025 * s);
      ctx.beginPath();
      ctx.moveTo(farBackX, backWaistY + 0.005 * s);
      ctx.lineTo(topBackX, backWaistY + 0.005 * s);
      ctx.quadraticCurveTo(hipApexX, hipApexY - 0.008 * s, topFrontX + 0.08 * s, frontWaistY + 0.005 * s);
      ctx.stroke();
    }

    // Crisp elastic leg-opening & cheek-hugging seam + skin-compression shadow directly under fabric edge!
    if (s >= 16) {
      ctx.strokeStyle = 'rgba(72, 28, 14, 0.28)';
      ctx.lineWidth = Math.max(0.85, 0.020 * s);
      ctx.beginPath();
      ctx.moveTo(frontPelvisX, frontPelvisY);
      traceLegAndCheekOpening();
      ctx.stroke();
    }
    ctx.restore();

    // Side-tie knot & slim ribbons seated strictly ON the lateral hip-crest tension point!
    if (hasSideTies && s >= 18) {
      ctx.fillStyle = swim.accent;
      ctx.beginPath();
      ctx.arc(hipApexX, hipApexY + strapH * 0.16, Math.max(1.2, 0.022 * s), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = swim.accent;
      ctx.lineWidth = Math.max(0.8, 0.016 * s);
      ctx.beginPath();
      ctx.moveTo(hipApexX, hipApexY + strapH * 0.16);
      ctx.lineTo(hipApexX - 0.026 * s, hipApexY + strapH * 0.16 + 0.068 * s);
      ctx.moveTo(hipApexX, hipApexY + strapH * 0.16);
      ctx.lineTo(hipApexX + 0.024 * s, hipApexY + strapH * 0.16 + 0.062 * s);
      ctx.stroke();
    }
    return;
  }

  // FRONT & BACK VIEWS: evaluate exact hip-crest anchors on `traceCurvyTorso`!
  const eCrest = evalFrontHipEdgeAtT(0.44, chestX, hipX, waistY, hipY, prof, s, gbx, gby);
  const lxCrest = eCrest.leftX;
  const rxCrest = eCrest.rightX;
  const yCrest = eCrest.y;
  const cxCrest = eCrest.cx;
  const hwCrest = eCrest.halfW;
  const eLow = evalFrontHipEdgeAtT(0.95, chestX, hipX, waistY, hipY, prof, s, gbx, gby);
  const crotchY = eLow.y + 0.042 * s;
  const cxBot = eLow.cx;

  // Subtle leg-stride flex on left/right inguinal leg openings
  const lLegPull = clamp((lKneeX - lHipX) / Math.max(1, s), -0.35, 0.35) * 0.03 * s;
  const rLegPull = clamp((rKneeX - rHipX) / Math.max(1, s), -0.35, 0.35) * 0.03 * s;

  if (view === 'back') {
    const gs = prof.gluteScale || 1.0;
    const stretch = clamp((gby / Math.max(1, s)) * 2.4, -0.18, 0.20);
    const glRx = prof.hip * 0.44 * Math.min(1.05, 0.72 + gs * 0.28) * (1 - stretch * 0.24) * s;
    const glRy = 0.126 * Math.min(1.08, 0.68 + gs * 0.32) * (1 + stretch) * s;
    const glCx = hipX + gbx * 0.80;
    const glCy = hipY + 0.024 * s + gby * 0.80;
    const sep = prof.hip * 0.34 * s;
    const bhx = glCx;
    const bhy = hipY + gby * 0.80;

    // Clip strictly to exact torso + bouncing glutes union so fabric hugs cheeks with ZERO overhang!
    ctx.save();
    traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX, 0, 0, gbx, gby, shTilt);
    ctx.ellipse(glCx - sep, glCy + gTilt, glRx, glRy, 0.12 + gbx / (s * 2.3), 0, Math.PI * 2);
    ctx.ellipse(glCx + sep, glCy - gTilt, glRx, glRy, -0.12 + gbx / (s * 2.3), 0, Math.PI * 2);
    ctx.clip?.();

    if (!isOnePiece) {
      // Soft skin-compression shadow directly above the high-hip elastic waistband
      if (s >= 18) {
        ctx.strokeStyle = 'rgba(72, 28, 14, 0.22)';
        ctx.lineWidth = Math.max(0.9, 0.024 * s);
        ctx.beginPath();
        ctx.moveTo(lxCrest - 0.04 * s, yCrest - 0.012 * s);
        ctx.quadraticCurveTo(bhx, yCrest + 0.095 * s, rxCrest + 0.04 * s, yCrest - 0.012 * s);
        ctx.stroke();
      }
      // Cheeky Brazilian scrunch-cut V-bottom locked directly to exact hip-crest anchors!
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.moveTo(lxCrest - 0.04 * s, yCrest);
      ctx.quadraticCurveTo(bhx, yCrest + 0.105 * s, rxCrest + 0.04 * s, yCrest);
      ctx.quadraticCurveTo(rxCrest - hwCrest * 0.42 + rLegPull, bhy + 0.032 * s - gTilt * 0.4, bhx, crotchY);
      ctx.quadraticCurveTo(lxCrest + hwCrest * 0.42 + lLegPull, bhy + 0.032 * s + gTilt * 0.4, lxCrest - 0.04 * s, yCrest);
      ctx.closePath();
      ctx.fill();

      // Accent elastic waistband trim flush along the high-hip V curve
      ctx.strokeStyle = swim.accent;
      ctx.lineWidth = Math.max(0.95, 0.025 * s);
      ctx.beginPath();
      ctx.moveTo(lxCrest - 0.02 * s, yCrest + 0.008 * s);
      ctx.quadraticCurveTo(bhx, yCrest + 0.112 * s, rxCrest + 0.02 * s, yCrest + 0.008 * s);
      ctx.stroke();
    }

    // Cheek-cupping elastic leg seams + compression shadow against lower bare cheeks
    if (s >= 16) {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.lineWidth = Math.max(0.85, 0.020 * s);
      ctx.beginPath();
      ctx.moveTo(lxCrest, yCrest + 0.02 * s);
      ctx.quadraticCurveTo(lxCrest + hwCrest * 0.42 + lLegPull, bhy + 0.036 * s + gTilt * 0.4, bhx, crotchY);
      ctx.moveTo(rxCrest, yCrest + 0.02 * s);
      ctx.quadraticCurveTo(rxCrest - hwCrest * 0.42 + rLegPull, bhy + 0.036 * s - gTilt * 0.4, bhx, crotchY);
      ctx.stroke();

      // Center ruched scrunch-seam down the gluteal cleft + 3 delicate radial tension gather chevrons!
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.lineWidth = Math.max(0.8, 0.019 * s);
      ctx.beginPath();
      ctx.moveTo(bhx, yCrest + 0.085 * s);
      ctx.lineTo(bhx, crotchY - 0.01 * s);
      ctx.stroke();

      if (s >= 20) {
        // Soft curved elastic tension gathers hugging the rounded cheeks outward from the center scrunch
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.13)';
        ctx.lineWidth = Math.max(0.65, 0.012 * s);
        for (let g = 0; g < 2; g++) {
          const gy = yCrest + (0.115 + g * 0.044) * s;
          const span = hwCrest * (0.44 - g * 0.12);
          ctx.beginPath();
          ctx.moveTo(bhx - 0.01 * s, gy);
          ctx.quadraticCurveTo(bhx - span * 0.55, gy - 0.026 * s, bhx - span, gy - 0.042 * s);
          ctx.moveTo(bhx + 0.01 * s, gy);
          ctx.quadraticCurveTo(bhx + span * 0.55, gy - 0.026 * s, bhx + span, gy - 0.042 * s);
          ctx.stroke();
        }
        // Subtle taut upper-cheek sheen
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(bhx - sep * 0.72, bhy - 0.03 * s + gTilt * 0.5, hwCrest * 0.24, 0.030 * s, -0.25, 0, Math.PI * 2);
        ctx.ellipse(bhx + sep * 0.72, bhy - 0.03 * s - gTilt * 0.5, hwCrest * 0.24, 0.030 * s, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Side-tie knots seated cleanly at exact outer hip-crest anchors
    if (hasSideTies && s >= 19) {
      ctx.strokeStyle = swim.accent;
      ctx.lineWidth = Math.max(0.8, 0.018 * s);
      ctx.beginPath();
      ctx.moveTo(lxCrest, yCrest + 0.005 * s);
      ctx.lineTo(lxCrest - 0.045 * s, yCrest + 0.075 * s);
      ctx.moveTo(rxCrest, yCrest + 0.005 * s);
      ctx.lineTo(rxCrest + 0.045 * s, yCrest + 0.075 * s);
      ctx.stroke();
      ctx.fillStyle = swim.accent;
      ctx.beginPath();
      ctx.arc(lxCrest, yCrest + 0.005 * s, 0.020 * s, 0, Math.PI * 2);
      ctx.arc(rxCrest, yCrest + 0.005 * s, 0.020 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // FRONT VIEW: clip strictly to exact `traceCurvyTorso` boundary!
  ctx.save();
  traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX, bbx, bby, gbx, gby, shTilt);
  ctx.clip?.();

  if (!isOnePiece) {
    // Soft skin-compression indentation shadow right above the elastic waistband
    if (s >= 18) {
      ctx.strokeStyle = 'rgba(72, 28, 14, 0.22)';
      ctx.lineWidth = Math.max(0.9, 0.024 * s);
      ctx.beginPath();
      ctx.moveTo(lxCrest - 0.04 * s, yCrest - 0.012 * s);
      ctx.quadraticCurveTo(cxCrest, yCrest + 0.088 * s, rxCrest + 0.04 * s, yCrest - 0.012 * s);
      ctx.stroke();
    }

    // Sleek high-cut French-leg V bikini bottom locked 100% flush to exact hip-crest anchors!
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.moveTo(lxCrest - 0.04 * s, yCrest);
    ctx.quadraticCurveTo(cxCrest, yCrest + 0.098 * s, rxCrest + 0.04 * s, yCrest);
    ctx.quadraticCurveTo(rxCrest - hwCrest * 0.44 + rLegPull, hipY + 0.048 * s + gby * 0.45, cxBot, crotchY);
    ctx.quadraticCurveTo(lxCrest + hwCrest * 0.44 + lLegPull, hipY + 0.048 * s + gby * 0.45, lxCrest - 0.04 * s, yCrest);
    ctx.closePath();
    ctx.fill();

    // Accent contrast elastic waistband hugging exact hip curve
    ctx.strokeStyle = swim.accent;
    ctx.lineWidth = Math.max(0.95, 0.025 * s);
    ctx.beginPath();
    ctx.moveTo(lxCrest - 0.02 * s, yCrest + 0.008 * s);
    ctx.quadraticCurveTo(cxCrest, yCrest + 0.105 * s, rxCrest + 0.02 * s, yCrest + 0.008 * s);
    ctx.stroke();
  }

  // Elastic high-cut leg opening compression shadows & subtle diagonal hip-strap tension creases!
  if (s >= 17) {
    ctx.strokeStyle = 'rgba(72, 28, 14, 0.24)';
    ctx.lineWidth = Math.max(0.8, 0.019 * s);
    ctx.beginPath();
    ctx.moveTo(lxCrest, yCrest + 0.024 * s);
    ctx.quadraticCurveTo(lxCrest + hwCrest * 0.44 + lLegPull, hipY + 0.052 * s + gby * 0.45, cxBot - 0.012 * s, crotchY);
    ctx.moveTo(rxCrest, yCrest + 0.024 * s);
    ctx.quadraticCurveTo(rxCrest - hwCrest * 0.44 + rLegPull, hipY + 0.052 * s + gby * 0.45, cxBot + 0.012 * s, crotchY);
    ctx.stroke();

    if (s >= 20) {
      // Delicate radial tension pull creases fanning inward from both taut hip-crest anchor points!
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
      ctx.lineWidth = Math.max(0.7, 0.014 * s);
      ctx.beginPath();
      ctx.moveTo(lxCrest + 0.015 * s, yCrest + 0.02 * s);
      ctx.quadraticCurveTo(cxCrest - hwCrest * 0.42, yCrest + 0.095 * s, cxCrest - hwCrest * 0.16, yCrest + 0.125 * s);
      ctx.moveTo(rxCrest - 0.015 * s, yCrest + 0.02 * s);
      ctx.quadraticCurveTo(cxCrest + hwCrest * 0.42, yCrest + 0.095 * s, cxCrest + hwCrest * 0.16, yCrest + 0.125 * s);
      ctx.stroke();

      // Soft central taut fabric highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
      ctx.beginPath();
      ctx.ellipse(cxCrest, yCrest + 0.125 * s, hwCrest * 0.26, 0.026 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Delicate side-tie bows/strings anchored cleanly at exact outer iliac hip-crest points!
  if (hasSideTies && s >= 19) {
    ctx.strokeStyle = swim.accent;
    ctx.lineWidth = Math.max(0.85, 0.019 * s);
    ctx.beginPath();
    ctx.moveTo(lxCrest, yCrest + 0.005 * s);
    ctx.lineTo(lxCrest - 0.055 * s, yCrest + 0.088 * s);
    ctx.moveTo(rxCrest, yCrest + 0.005 * s);
    ctx.lineTo(rxCrest + 0.055 * s, yCrest + 0.088 * s);
    ctx.stroke();
    ctx.fillStyle = swim.accent;
    ctx.beginPath();
    ctx.arc(lxCrest, yCrest + 0.005 * s, 0.021 * s, 0, Math.PI * 2);
    ctx.arc(rxCrest, yCrest + 0.005 * s, 0.021 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw one articulated boardshorts leg sleeve strictly aligned along the 2-bone IK thigh vector
 * (hx, hy) -> (kx, ky), with a curved tubular cuff hem, inner shadow, outer stripe & hip stride creases!
 */
function drawShortsLegSleeve(ctx, hx, hy, kx, ky, topHalfW, hemHalfW, lenFrac, fillCol, accentCol, sideStripeDir, s, isDarkRear = false) {
  const dx = kx - hx;
  const dy = ky - hy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Rightward normal (+x when pointing straight down)
  const nx = uy;
  const ny = -ux;

  const startOff = -0.04 * s;
  const endOff = Math.max(0.18 * s, len * lenFrac);
  const sx0 = hx + ux * startOff;
  const sy0 = hy + uy * startOff;
  const ex = hx + ux * endOff;
  const ey = hy + uy * endOff;

  // Inner cuff opening shadow peeking slightly past the hem where bare thigh emerges
  ctx.fillStyle = 'rgba(10, 18, 32, 0.30)';
  ctx.beginPath();
  ctx.moveTo(ex - nx * (hemHalfW * 0.88), ey - ny * (hemHalfW * 0.88));
  ctx.quadraticCurveTo(ex + ux * 0.036 * s, ey + uy * 0.036 * s, ex + nx * (hemHalfW * 0.88), ey + ny * (hemHalfW * 0.88));
  ctx.quadraticCurveTo(ex - ux * 0.015 * s, ey - uy * 0.015 * s, ex - nx * (hemHalfW * 0.88), ey - ny * (hemHalfW * 0.88));
  ctx.closePath();
  ctx.fill();

  // Main pivoted shorts leg fabric polygon with natural curved hem
  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.moveTo(sx0 - nx * topHalfW, sy0 - ny * topHalfW);
  ctx.lineTo(sx0 + nx * topHalfW, sy0 + ny * topHalfW);
  ctx.lineTo(ex + nx * hemHalfW, ey + ny * hemHalfW);
  ctx.quadraticCurveTo(ex + ux * 0.022 * s, ey + uy * 0.022 * s, ex - nx * hemHalfW, ey - ny * hemHalfW);
  ctx.closePath();
  ctx.fill();

  // Depth shading on rear/far leg in side view so scissoring legs read unmistakably in 3D!
  if (isDarkRear) {
    ctx.fillStyle = 'rgba(10, 18, 32, 0.24)';
    ctx.fill();
  }

  // Athletic contrast side stripe running strictly along the pivoted seam (lateral center when sideStripeDir === 2)!
  if (sideStripeDir !== 0 && !isDarkRear) {
    const sw = Math.max(1.2, 0.032 * s);
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = sw;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    if (sideStripeDir === 2) {
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(ex, ey);
    } else {
      const edgeSign = sideStripeDir > 0 ? 1 : -1;
      const tOut = topHalfW - sw * 0.55;
      const hOut = hemHalfW - sw * 0.55;
      ctx.moveTo(sx0 + nx * (tOut * edgeSign), sy0 + ny * (tOut * edgeSign));
      ctx.lineTo(ex + nx * (hOut * edgeSign), ey + ny * (hOut * edgeSign));
    }
    ctx.stroke();
  }

  // Subtle diagonal hip-flex tension crease when thigh pivots away from vertical!
  const swingAmt = Math.abs(ux);
  if (s >= 18 && swingAmt > 0.08 && !isDarkRear) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = Math.max(0.75, 0.016 * s);
    const midOff = endOff * 0.42;
    const mx = hx + ux * midOff;
    const my = hy + uy * midOff;
    ctx.beginPath();
    ctx.moveTo(mx - nx * (topHalfW * 0.55), my - ny * (topHalfW * 0.55));
    ctx.quadraticCurveTo(mx + ux * 0.025 * s, my + uy * 0.025 * s, mx + nx * (hemHalfW * 0.48), my + ny * (hemHalfW * 0.48));
    ctx.stroke();
  }

  // Crisp stitched hem seam near cuff
  if (s >= 18) {
    ctx.strokeStyle = isDarkRear ? 'rgba(15, 23, 42, 0.30)' : 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = Math.max(0.75, 0.015 * s);
    const hxOff = endOff - 0.022 * s;
    const cmx = hx + ux * hxOff;
    const cmy = hy + uy * hxOff;
    ctx.beginPath();
    ctx.moveTo(cmx - nx * (hemHalfW * 0.94), cmy - ny * (hemHalfW * 0.94));
    ctx.quadraticCurveTo(cmx + ux * 0.018 * s, cmy + uy * 0.018 * s, cmx + nx * (hemHalfW * 0.94), cmy + ny * (hemHalfW * 0.94));
    ctx.stroke();
  }
}

/**
 * Draw articulated, body-fitted men's boardshorts & swim trunks (v295) across Front, Back, and Side!
 * Pelvis yoke clips strictly to the exact male torso silhouette, while both boardshorts legs
 * pivot & scissor dynamically along the actual 2-bone IK thigh axes `(lHip -> lKnee)` and `(rHip -> rKnee)`.
 */
function drawArticulatedMaleShorts(
  ctx,
  view,
  chestX,
  hipX,
  shoulderY,
  waistY,
  hipY,
  lHipX,
  rHipX,
  legHipY,
  lKneeX,
  lKneeY,
  rKneeX,
  rKneeY,
  prof,
  s,
  shTilt,
  swim
) {
  const isBriefs = swim.style === 'swim-briefs';
  const topY = hipY - 0.115 * s;

  if (view === 'side') {
    if (isBriefs) {
      ctx.save();
      traceSideMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX);
      ctx.clip?.();
      ctx.fillStyle = swim.primary;
      ctx.fillRect(hipX - prof.hip * 1.3 * s, topY, prof.hip * 2.6 * s + (prof.belly || 0) * s, 0.28 * s);
      ctx.fillStyle = swim.accent;
      ctx.fillRect(hipX - prof.hip * 1.3 * s, topY, prof.hip * 2.6 * s + (prof.belly || 0) * s, 0.036 * s);
      ctx.restore();
      return;
    }

    const thighHalfW = prof.thigh * 0.62 * s;
    const hemHalfW = thighHalfW * 0.94;
    // 1. Rear/far shorts leg pivoting cleanly with back thigh (shaded for 3D depth)
    drawShortsLegSleeve(ctx, lHipX, legHipY, lKneeX, lKneeY, thighHalfW * 0.96, hemHalfW * 0.96, 0.56, swim.primary, swim.accent, 0, s, true);

    // 2. Body-clipped pelvis yoke & fitted waistband hugging exact waist/belly/glute contour
    ctx.save();
    traceSideMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX);
    ctx.clip?.();
    ctx.fillStyle = swim.primary;
    ctx.fillRect(hipX - prof.hip * 1.4 * s, topY, prof.hip * 2.8 * s + (prof.belly || 0) * s, 0.32 * s);
    // Contrast waistband flush along exact torso width
    ctx.fillStyle = swim.accent;
    ctx.fillRect(hipX - prof.hip * 1.4 * s, topY, prof.hip * 2.8 * s + (prof.belly || 0) * s, 0.040 * s);
    // Subtle skin compression line directly above waistband
    if (s >= 18) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
      ctx.fillRect(hipX - prof.hip * 1.4 * s, topY + 0.040 * s, prof.hip * 2.8 * s + (prof.belly || 0) * s, 0.012 * s);
    }
    ctx.restore();

    // 3. Front/near shorts leg pivoting live along the forward thigh axis (with lateral center side stripe!)
    drawShortsLegSleeve(ctx, rHipX, legHipY, rKneeX, rKneeY, thighHalfW, hemHalfW, 0.57, swim.primary, swim.accent, 2, s, false);
    return;
  }

  // FRONT & BACK VIEWS
  if (isBriefs) {
    ctx.save();
    traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX, shTilt);
    ctx.clip?.();
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.moveTo(hipX - prof.hip * 1.12 * s, topY);
    ctx.quadraticCurveTo(hipX, topY + 0.045 * s, hipX + prof.hip * 1.12 * s, topY);
    ctx.quadraticCurveTo(hipX + prof.hip * 0.44 * s, hipY + 0.095 * s, hipX, hipY + 0.18 * s);
    ctx.quadraticCurveTo(hipX - prof.hip * 0.44 * s, hipY + 0.095 * s, hipX - prof.hip * 1.12 * s, topY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = swim.accent;
    ctx.fillRect(hipX - prof.hip * 1.12 * s, topY, prof.hip * 2.24 * s, 0.036 * s);
    ctx.restore();
    return;
  }

  const thighHalfW = prof.thigh * 0.60 * s;
  const hemHalfW = thighHalfW * 0.94;
  // 1. Both boardshorts legs pivot independently with the left & right 2-bone IK thighs!
  drawShortsLegSleeve(ctx, lHipX, legHipY, lKneeX, lKneeY, thighHalfW, hemHalfW, 0.56, swim.primary, swim.accent, -1, s, false);
  drawShortsLegSleeve(ctx, rHipX, legHipY, rKneeX, rKneeY, thighHalfW, hemHalfW, 0.56, swim.primary, swim.accent, 1, s, false);

  // 2. Body-clipped pelvis yoke bridging waistband cleanly into both pivoted legs (zero bare crotch gap!)
  ctx.save();
  traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX, hipX, shTilt);
  ctx.clip?.();
  ctx.fillStyle = swim.primary;
  ctx.fillRect(hipX - prof.hip * 1.25 * s, topY, prof.hip * 2.5 * s, 0.32 * s);
  // Contrast fitted waistband flush with torso edges
  ctx.fillStyle = swim.accent;
  ctx.fillRect(hipX - prof.hip * 1.25 * s, topY, prof.hip * 2.5 * s, 0.038 * s);
  if (s >= 18) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.fillRect(hipX - prof.hip * 1.25 * s, topY + 0.038 * s, prof.hip * 2.5 * s, 0.011 * s);
  }
  ctx.restore();

  // 3. Tailored fly stitch + drawstrings (Front) OR back pocket welt + seat seam (Back)
  if (s >= 18) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.lineWidth = Math.max(0.8, 0.016 * s);
    ctx.beginPath();
    ctx.moveTo(hipX, topY + 0.042 * s);
    ctx.lineTo(hipX, hipY + 0.11 * s);
    ctx.stroke();
    if (view === 'front' && s >= 20) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = Math.max(0.9, 0.018 * s);
      ctx.beginPath();
      ctx.moveTo(hipX, topY + 0.02 * s);
      ctx.lineTo(hipX - 0.032 * s, topY + 0.105 * s);
      ctx.moveTo(hipX, topY + 0.02 * s);
      ctx.lineTo(hipX + 0.032 * s, topY + 0.105 * s);
      ctx.stroke();
    } else if (view === 'back' && s >= 20) {
      // Back right boardshort pocket welt with accent flap
      ctx.fillStyle = swim.accent;
      ctx.fillRect(hipX + prof.hip * 0.22 * s, hipY - 0.03 * s, prof.hip * 0.44 * s, 0.026 * s);
    }
  }
}

/**
 * Draw a sculpted filled anatomical leg polygon (v290):
 * Seamless hip-to-thigh flare -> slim knee -> shapely gastrocnemius calf curve -> slender ankle
 * + sleek arched foot! Zero tube-stroke seams & single-fill performance.
 */
function drawArticulatedLeg(ctx, hx, hy, kx, ky, fx, fy, prof, s, color, drawBareFoot = true, footDir = 1, isSide = false) {
  const tdx = kx - hx;
  const tdy = ky - hy;
  const tLen = Math.hypot(tdx, tdy) || 1;
  // Rightward normal (+x for downward leg)
  const tnx = tdy / tLen;
  const tny = -tdx / tLen;

  const sdx = fx - kx;
  const sdy = fy - ky;
  const sLen = Math.hypot(sdx, sdy) || 1;
  const snx = sdy / sLen;
  const sny = -sdx / sLen;

  // Determine which side is "outer/back" curve vs "inner/front"
  const outerSign = isSide ? -1 : (footDir >= 0 ? 1 : -1);
  const wHipOut = prof.thigh * 0.55 * s;
  const wHipIn = prof.thigh * 0.47 * s;
  const wThighOut = prof.thigh * 0.59 * s;
  const wThighIn = prof.thigh * 0.45 * s;
  const wKnee = prof.calf * 0.54 * s;
  const wCalfOut = prof.calf * (isSide ? 0.58 : 0.55) * s;
  const wCalfIn = prof.calf * (isSide ? 0.38 : 0.43) * s;
  const wAnkle = prof.calf * 0.26 * s;

  const mThighX = hx + tdx * 0.38;
  const mThighY = hy + tdy * 0.38;
  const mShinX = kx + sdx * 0.34;
  const mShinY = ky + sdy * 0.34;

  // Side A = +normal, Side B = -normal
  const aHip = outerSign > 0 ? wHipOut : wHipIn;
  const bHip = outerSign > 0 ? wHipIn : wHipOut;
  const aThigh = outerSign > 0 ? wThighOut : wThighIn;
  const bThigh = outerSign > 0 ? wThighIn : wThighOut;
  const aCalf = outerSign > 0 ? wCalfOut : wCalfIn;
  const bCalf = outerSign > 0 ? wCalfIn : wCalfOut;

  // Normalized blended knee normal + smooth knee wrap points (zero sharp inner-knee pinch on deep bends!)
  let knx = tnx + snx;
  let kny = tny + sny;
  const kNorm = Math.hypot(knx, kny) || 1;
  knx /= kNorm;
  kny /= kNorm;

  const wKneeA = outerSign > 0 ? wKnee * 1.02 : wKnee * 0.94;
  const wKneeB = outerSign > 0 ? wKnee * 0.94 : wKnee * 1.02;
  const tKneeInX = hx + tdx * 0.78;
  const tKneeInY = hy + tdy * 0.78;
  const sKneeOutX = kx + sdx * 0.22;
  const sKneeOutY = ky + sdy * 0.22;
  const mCalfX = kx + sdx * 0.44;
  const mCalfY = ky + sdy * 0.44;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(hx + tnx * aHip, hy + tny * aHip);
  // Thigh Side A -> smooth rounded knee wrap -> shapely calf -> slender ankle
  ctx.quadraticCurveTo(mThighX + tnx * aThigh, mThighY + tny * aThigh, tKneeInX + tnx * (aThigh * 0.28 + wKneeA * 0.72), tKneeInY + tny * (aThigh * 0.28 + wKneeA * 0.72));
  ctx.quadraticCurveTo(kx + knx * wKneeA, ky + kny * wKneeA, sKneeOutX + snx * (aCalf * 0.28 + wKneeA * 0.72), sKneeOutY + sny * (aCalf * 0.28 + wKneeA * 0.72));
  ctx.quadraticCurveTo(mCalfX + snx * aCalf, mCalfY + sny * aCalf, fx + snx * wAnkle, fy + sny * wAnkle);
  // Rounded ankle base across to Side B
  ctx.quadraticCurveTo(fx, fy + wAnkle * 0.9, fx - snx * wAnkle, fy - sny * wAnkle);
  // Ankle -> Calf Side B -> smooth rounded knee wrap -> Thigh Side B -> Hip
  ctx.quadraticCurveTo(mCalfX - snx * bCalf, mCalfY - sny * bCalf, sKneeOutX - snx * (bCalf * 0.28 + wKneeB * 0.72), sKneeOutY - sny * (bCalf * 0.28 + wKneeB * 0.72));
  ctx.quadraticCurveTo(kx - knx * wKneeB, ky - kny * wKneeB, tKneeInX - tnx * (bThigh * 0.28 + wKneeB * 0.72), tKneeInY - tny * (bThigh * 0.28 + wKneeB * 0.72));
  ctx.quadraticCurveTo(mThighX - tnx * bThigh, mThighY - tny * bThigh, hx - tnx * bHip, hy - tny * bHip);
  ctx.quadraticCurveTo(hx, hy - prof.thigh * 0.34 * s, hx + tnx * aHip, hy + tny * aHip);
  ctx.closePath();
  ctx.fill();

  // Sleek arched barefoot silhouette grounded cleanly on the deck
  if (drawBareFoot) {
    const dir = footDir >= 0 ? 1 : -1;
    const fLen = isSide ? 0.13 * s : 0.088 * s;
    ctx.beginPath();
    ctx.moveTo(fx - dir * 0.025 * s, fy - 0.005 * s);
    ctx.quadraticCurveTo(fx + dir * fLen * 0.52, fy - 0.015 * s, fx + dir * fLen, fy + 0.032 * s);
    ctx.quadraticCurveTo(fx + dir * fLen * 0.45, fy + 0.048 * s, fx - dir * 0.03 * s, fy + 0.038 * s);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw a sculpted tapered filled 2-segment arm (v290):
 * Rounded deltoid shoulder -> naturally tapered upper arm -> slim elbow -> graceful wrist + slender oval hand!
 */
function drawArticulatedArm(ctx, sx, sy, ex, ey, hx, hy, armW, s, upperCol, forearmCol = upperCol, handCol = forearmCol) {
  const udx = ex - sx;
  const udy = ey - sy;
  const uLen = Math.hypot(udx, udy) || 1;
  const unx = udy / uLen;
  const uny = -udx / uLen;

  const fdx = hx - ex;
  const fdy = hy - ey;
  const fLen = Math.hypot(fdx, fdy) || 1;
  const fnx = fdy / fLen;
  const fny = -fdx / fLen;

  const rSh = armW * 0.52 * s;
  const rElb = armW * 0.36 * s;
  const rWri = armW * 0.24 * s;

  // Sculpted tapered upper arm polygon
  ctx.fillStyle = upperCol;
  ctx.beginPath();
  ctx.moveTo(sx + unx * rSh, sy + uny * rSh);
  ctx.quadraticCurveTo((sx + ex) * 0.5 + unx * (rSh * 0.92), (sy + ey) * 0.5 + uny * (rSh * 0.92), ex + unx * rElb, ey + uny * rElb);
  ctx.arc(ex, ey, rElb, Math.atan2(uny, unx), Math.atan2(-uny, -unx), false);
  ctx.quadraticCurveTo((sx + ex) * 0.5 - unx * (rSh * 0.88), (sy + ey) * 0.5 - uny * (rSh * 0.88), sx - unx * rSh, sy - uny * rSh);
  ctx.arc(sx, sy, rSh, Math.atan2(-uny, -unx), Math.atan2(uny, unx), false);
  ctx.closePath();
  ctx.fill();

  // Sculpted tapered forearm polygon
  ctx.fillStyle = forearmCol;
  ctx.beginPath();
  ctx.moveTo(ex + fnx * rElb, ey + fny * rElb);
  ctx.lineTo(hx + fnx * rWri, hy + fny * rWri);
  ctx.lineTo(hx - fnx * rWri, hy - fny * rWri);
  ctx.lineTo(ex - fnx * rElb, ey - fny * rElb);
  ctx.closePath();
  ctx.fill();

  // Refined slender oval hand aligned naturally with forearm direction
  const ang = Math.atan2(fdy, fdx);
  const handLen = armW * 0.68 * s;
  const handWid = armW * 0.32 * s;
  ctx.fillStyle = handCol;
  ctx.beginPath();
  ctx.ellipse(hx + (fdx / fLen) * handLen * 0.48, hy + (fdy / fLen) * handLen * 0.48, handLen, handWid, ang, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw festive overhead string lights / colorful beach pennants between two screen points.
 */
export function drawFestiveStringLights(ctx, x0, y0, x1, y1, scale, timeSec, sagM = 0.45) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const span = Math.hypot(dx, dy);
  if (span < 18) return;
  const sag = sagM * scale;
  const midX = (x0 + x1) * 0.5;
  const midY = (y0 + y1) * 0.5 + sag;

  ctx.save();
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.72)';
  ctx.lineWidth = Math.max(1, 0.032 * scale);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(midX, midY, x1, y1);
  ctx.stroke();

  const colors = ['#fb7185', '#facc15', '#38bdf8', '#4ade80', '#fb923c', '#e879f9'];
  const count = Math.max(5, Math.min(11, Math.round(span / Math.max(10, 0.52 * scale))));
  const bulbR = Math.max(1.8, 0.075 * scale);
  const flagH = Math.max(3.2, 0.22 * scale);
  const flagW = Math.max(2.4, 0.14 * scale);

  for (let i = 1; i < count; i++) {
    const t = i / count;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * midX + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * midY + t * t * y1;
    const col = colors[i % colors.length];
    const flutter = Math.sin(timeSec * 3.8 + i * 1.1) * 0.04 * scale;

    if ((i & 1) === 0) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(px - flagW * 0.5, py);
      ctx.lineTo(px + flagW * 0.5, py);
      ctx.lineTo(px + flutter, py + flagH);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = col;
      if (scale >= 18) {
        const pulse = 0.72 + 0.28 * Math.sin(timeSec * 4.5 + i * 1.7);
        ctx.globalAlpha = 0.28 * pulse;
        ctx.beginPath();
        ctx.arc(px, py + bulbR * 0.9, bulbR * 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(px, py + bulbR * 0.9, bulbR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Draw a hyper-real resort striped beach umbrella planted at (x, groundY) (v295).
 */
export function drawBeachUmbrella(ctx, x, groundY, scale, seed = 0, tilt = 0.09) {
  const umbKey = HYPER_REAL_UMBRELLA_KEYS[Math.abs(seed) % HYPER_REAL_UMBRELLA_KEYS.length];
  const umbImg = getHyperRealSprite(umbKey);

  ctx.save();
  ctx.translate(x, groundY);
  if (umbImg) {
    // Ground contact shadow beneath pole
    ctx.fillStyle = 'rgba(8, 18, 28, 0.30)';
    ctx.beginPath();
    ctx.ellipse(tilt * 0.45 * scale, 0.03 * scale, 0.72 * scale, 0.09 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(tilt);
    const uh = 2.48 * scale;
    const uw = uh * ((umbImg.naturalWidth || umbImg.width) / Math.max(1, umbImg.naturalHeight || umbImg.height));
    ctx.drawImage(umbImg, -uw * 0.5, -uh + 0.08 * scale, uw, uh);
    ctx.restore();
    return;
  }

  const pal = UMBRELLA_PALETTES[Math.abs(seed) % UMBRELLA_PALETTES.length];
  const poleH = 1.95 * scale;
  const canopyW = 1.15 * scale;
  const canopyH = 0.44 * scale;

  ctx.rotate(tilt);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(1.4, 0.065 * scale);
  ctx.beginPath();
  ctx.moveTo(0, 0.06 * scale);
  ctx.lineTo(0, -poleH);
  ctx.stroke();

  ctx.fillStyle = pal[0];
  ctx.beginPath();
  ctx.moveTo(-canopyW, -poleH + canopyH);
  ctx.quadraticCurveTo(0, -poleH - canopyH * 0.65, canopyW, -poleH + canopyH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal[1];
  ctx.beginPath();
  ctx.moveTo(-canopyW * 0.45, -poleH + canopyH);
  ctx.quadraticCurveTo(0, -poleH - canopyH * 0.52, canopyW * 0.45, -poleH + canopyH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(0, -poleH - canopyH * 0.08, Math.max(1.4, 0.06 * scale), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a dive-party cooler + pulsing boombox + spare scuba tank rack prop cluster.
 */
export function drawPartyGearProps(ctx, x, groundY, scale, timeSec, mode = 'party') {
  ctx.save();
  ctx.translate(x, groundY);
  if (mode === 'party') {
    const partyImg = getHyperRealSprite('party-cooler-boombox');
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0.06 * scale, 0.02 * scale, 0.72 * scale, 0.1 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const beat = Math.abs(Math.sin(timeSec * 6.8));
    if (partyImg) {
      const pw = 1.48 * scale;
      const ph = pw * ((partyImg.naturalHeight || partyImg.height) / Math.max(1, partyImg.naturalWidth || partyImg.width));
      ctx.drawImage(partyImg, -pw * 0.48, -ph + 0.04 * scale, pw, ph);
      // Subtle beat-synced speaker LED pulse over the boombox woofers
      if (beat > 0.35) {
        ctx.fillStyle = `rgba(56, 189, 248, ${(beat * 0.36).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pw * 0.16, -ph * 0.42, (0.06 + beat * 0.025) * scale, 0, Math.PI * 2);
        ctx.arc(pw * 0.37, -ph * 0.42, (0.06 + beat * 0.025) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      const notePhase = (timeSec * 0.8) % 1;
      const ny = -ph - 0.12 * scale - notePhase * 0.98 * scale;
      const nx = pw * 0.24 + Math.sin(timeSec * 3.5) * 0.18 * scale;
      const na = Math.sin(notePhase * Math.PI) * 0.92;
      drawMusicNote(ctx, nx, ny, Math.max(4.5, 0.26 * scale), '#fde047', na);
      ctx.restore();
      return;
    }

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-0.52 * scale, -0.38 * scale, 0.56 * scale, 0.38 * scale);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-0.55 * scale, -0.45 * scale, 0.62 * scale, 0.1 * scale);

    const bx = 0.14 * scale;
    const by = -0.34 * scale;
    const bw = 0.54 * scale;
    const bh = 0.34 * scale;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1.1, 0.045 * scale);
    ctx.strokeRect(bx + bw * 0.18, by - 0.11 * scale, bw * 0.64, 0.11 * scale);
    const spR = (0.09 + beat * 0.026) * scale;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(bx + bw * 0.26, by + bh * 0.55, spR, 0, Math.PI * 2);
    ctx.arc(bx + bw * 0.74, by + bh * 0.55, spR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(bx + bw * 0.26, by + bh * 0.55, spR * 0.45, 0, Math.PI * 2);
    ctx.arc(bx + bw * 0.74, by + bh * 0.55, spR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    const notePhase = (timeSec * 0.8) % 1;
    const ny = by - 0.18 * scale - notePhase * 0.98 * scale;
    const nx = bx + bw * 0.5 + Math.sin(timeSec * 3.5) * 0.18 * scale;
    const na = Math.sin(notePhase * Math.PI) * 0.92;
    drawMusicNote(ctx, nx, ny, Math.max(4.5, 0.26 * scale), '#fde047', na);
  } else {
    const rackImg = getHyperRealSprite('scuba-gear-rack');
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0.08 * scale, 0.02 * scale, 0.72 * scale, 0.09 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (rackImg) {
      const rw = 1.54 * scale;
      const rh = rw * ((rackImg.naturalHeight || rackImg.height) / Math.max(1, rackImg.naturalWidth || rackImg.width));
      ctx.drawImage(rackImg, -rw * 0.46, -rh + 0.05 * scale, rw, rh);
      ctx.restore();
      return;
    }

    const tankCols = ['#eab308', '#cbd5e1'];
    for (let i = 0; i < 2; i++) {
      const tx = (-0.34 + i * 0.26) * scale;
      ctx.fillStyle = tankCols[i];
      ctx.beginPath();
      ctx.roundRect(tx - 0.1 * scale, -0.78 * scale, 0.2 * scale, 0.78 * scale, 0.07 * scale);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillRect(tx - 0.04 * scale, -0.88 * scale, 0.08 * scale, 0.11 * scale);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(tx - 0.1 * scale, -0.1 * scale, 0.2 * scale, 0.1 * scale);
    }
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0.12 * scale, -0.32 * scale, 0.48 * scale, 0.32 * scale);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0.1 * scale, -0.36 * scale, 0.52 * scale, 0.06 * scale);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(0.68 * scale, -0.06 * scale, 0.22 * scale, 0.065 * scale, -0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw editorial-proportion view-aware head (tapered oval face, graceful neck-trapezius,
 * lush layered S-curved hair, chic cat-eye/aviator shades OR expressive eyes & soft lips,
 * and optional neat beard strictly for men only!).
 */
function drawTopsideHead(ctx, hx, headY, shoulderY, s, timeSec, ph, seed, isMale, view, skin, skinShade, hair, swim, wet, isGearZip, isGearTank, isGearReady, isDance) {
  const isFrontView = view === 'front';
  const isBackView = view === 'back';
  const hairBounce = isDance ? Math.sin(timeSec * 6.4 + ph - 0.9) * 0.05 * s : Math.sin(timeSec * 3.0 + ph) * 0.022 * s;
  const wearShades = (seed % 5) < 3;
  const hairStyle = seed % 4;
  const hasMaleBeard = isMale && !isGearReady && (seed % 3 === 2);

  // Refined 7.5-head editorial oval dimensions (graceful heart-oval on women, crisp jaw on men)
  const hRx = isMale ? 0.136 * s : 0.126 * s;
  const hRy = isMale ? 0.158 * s : 0.150 * s;

  // Female front-view flowing S-curved hair behind OUTER shoulders only (chin & neck stay 100% clean skin!)
  if (!isMale && isFrontView && !isGearReady) {
    ctx.fillStyle = hair;
    if (hairStyle === 0) {
      // Lush cascading beach waves sweeping past collarbones on left & right
      ctx.beginPath();
      ctx.moveTo(hx - hRx * 0.92, headY - hRy * 0.25);
      ctx.bezierCurveTo(hx - hRx * 1.65, headY + 0.08 * s, hx - hRx * 1.25, headY + 0.26 * s + hairBounce * 0.4, hx - hRx * 1.52, headY + 0.36 * s + hairBounce * 0.5);
      ctx.quadraticCurveTo(hx - hRx * 0.86, headY + 0.32 * s + hairBounce * 0.4, hx - hRx * 0.72, headY + 0.14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hRx * 0.92, headY - hRy * 0.25);
      ctx.bezierCurveTo(hx + hRx * 1.65, headY + 0.08 * s, hx + hRx * 1.25, headY + 0.26 * s + hairBounce * 0.4, hx + hRx * 1.52, headY + 0.36 * s + hairBounce * 0.5);
      ctx.quadraticCurveTo(hx + hRx * 0.86, headY + 0.32 * s + hairBounce * 0.4, hx + hRx * 0.72, headY + 0.14 * s);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 1) {
      // High sleek tapered S-curved ponytail peeking gracefully above right shoulder!
      ctx.beginPath();
      ctx.moveTo(hx + hRx * 0.65, headY - hRy * 0.78);
      ctx.bezierCurveTo(hx + hRx * 1.95, headY - hRy * 0.55 + hairBounce * 0.5, hx + hRx * 1.78, headY + 0.12 * s + hairBounce * 0.8, hx + hRx * 1.35, headY + 0.22 * s + hairBounce * 0.9);
      ctx.quadraticCurveTo(hx + hRx * 1.25, headY - 0.02 * s + hairBounce * 0.5, hx + hRx * 0.55, headY - hRy * 0.45);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 2) {
      // Chic high twin puffs / beach space buns
      ctx.beginPath();
      ctx.arc(hx - hRx * 1.04, headY - hRy * 0.82 + hairBounce * 0.28, 0.075 * s, 0, Math.PI * 2);
      ctx.arc(hx + hRx * 1.04, headY - hRy * 0.82 + hairBounce * 0.28, 0.075 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sleek chin-framing angled beach bob
      ctx.beginPath();
      ctx.moveTo(hx - hRx * 0.95, headY - hRy * 0.3);
      ctx.quadraticCurveTo(hx - hRx * 1.48, headY + 0.04 * s, hx - hRx * 1.02, headY + 0.18 * s + hairBounce * 0.25);
      ctx.lineTo(hx - hRx * 0.75, headY + 0.08 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + hRx * 0.95, headY - hRy * 0.3);
      ctx.quadraticCurveTo(hx + hRx * 1.48, headY + 0.04 * s, hx + hRx * 1.02, headY + 0.18 * s + hairBounce * 0.25);
      ctx.lineTo(hx + hRx * 0.75, headY + 0.08 * s);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Graceful tapered neck flaring smoothly into trapezius collar line + subtle under-chin shadow
  if (!isGearReady) {
    const neckTopW = isMale ? 0.098 * s : 0.072 * s;
    const neckBaseW = isMale ? 0.145 * s : 0.108 * s;
    const ny0 = headY + hRy * 0.65;
    const ny1 = Math.max(ny0 + 0.05 * s, shoulderY + 0.02 * s);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(hx - neckTopW * 0.5, ny0);
    ctx.lineTo(hx + neckTopW * 0.5, ny0);
    ctx.quadraticCurveTo(hx + neckTopW * 0.55, (ny0 + ny1) * 0.55, hx + neckBaseW * 0.62, ny1);
    ctx.lineTo(hx - neckBaseW * 0.62, ny1);
    ctx.quadraticCurveTo(hx - neckTopW * 0.55, (ny0 + ny1) * 0.55, hx - neckTopW * 0.5, ny0);
    ctx.closePath();
    ctx.fill();
    if (!isBackView && s >= 20) {
      ctx.fillStyle = skinShade;
      ctx.beginPath();
      ctx.ellipse(hx, headY + hRy * 0.96, neckTopW * 0.48, 0.024 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sculpted anatomical oval head with tapered chin/jawline
  ctx.fillStyle = skin;
  ctx.beginPath();
  if (isMale) {
    ctx.moveTo(hx, headY - hRy);
    ctx.bezierCurveTo(hx + hRx * 1.08, headY - hRy * 0.96, hx + hRx * 1.05, headY + hRy * 0.28, hx + hRx * 0.64, headY + hRy * 0.82);
    ctx.quadraticCurveTo(hx, headY + hRy * 1.08, hx - hRx * 0.64, headY + hRy * 0.82);
    ctx.bezierCurveTo(hx - hRx * 1.05, headY + hRy * 0.28, hx - hRx * 1.08, headY - hRy * 0.96, hx, headY - hRy);
  } else {
    ctx.moveTo(hx, headY - hRy);
    ctx.bezierCurveTo(hx + hRx * 1.08, headY - hRy * 0.95, hx + hRx * 1.02, headY + hRy * 0.22, hx + hRx * 0.54, headY + hRy * 0.80);
    ctx.quadraticCurveTo(hx, headY + hRy * 1.06, hx - hRx * 0.54, headY + hRy * 0.80);
    ctx.bezierCurveTo(hx - hRx * 1.02, headY + hRy * 0.22, hx - hRx * 1.08, headY - hRy * 0.95, hx, headY - hRy);
  }
  ctx.closePath();
  ctx.fill();

  if (isGearReady) {
    ctx.fillStyle = wet.suit;
    ctx.beginPath();
    ctx.ellipse(hx, headY - 0.01 * s, hRx * 1.12, hRy * 1.06, 0, isBackView ? 0 : Math.PI * 0.85, isBackView ? Math.PI * 2 : Math.PI * 2.15);
    ctx.fill();
    if (!isBackView) {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1, 0.026 * s);
      ctx.beginPath();
      if (isFrontView) {
        ctx.roundRect(hx - hRx * 0.84, headY - 0.055 * s, hRx * 1.68, 0.085 * s, 0.028 * s);
      } else {
        ctx.roundRect(hx + 0.015 * s, headY - 0.055 * s, hRx * 1.05, 0.085 * s, 0.028 * s);
      }
      ctx.fill();
      ctx.stroke();
    }
    return;
  }

  if (isBackView) {
    ctx.fillStyle = hair;
    if (isMale) {
      ctx.beginPath();
      ctx.ellipse(hx, headY - 0.03 * s, hRx * 1.08, hRy * 0.96, 0, Math.PI * 0.82, Math.PI * 2.18);
      ctx.fill();
      ctx.fillRect(hx - hRx * 0.88, headY - 0.04 * s, hRx * 1.76, 0.095 * s);
      if (hairStyle === 1) {
        ctx.beginPath();
        ctx.arc(hx - 0.055 * s, headY - hRy * 0.94, 0.062 * s, 0, Math.PI * 2);
        ctx.arc(hx + 0.05 * s, headY - hRy * 0.98, 0.062 * s, 0, Math.PI * 2);
        ctx.fill();
      } else if (hairStyle === 3 && !isGearZip && !isGearTank) {
        ctx.fillStyle = swim.primary;
        ctx.beginPath();
        ctx.ellipse(hx, headY - 0.045 * s, hRx * 1.12, hRy * 0.85, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = swim.accent;
        ctx.beginPath();
        ctx.ellipse(hx, headY - 0.035 * s, hRx * 1.12, 0.044 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(hx, headY - 0.01 * s, hRx * 1.12, hRy * 1.04, 0, 0, Math.PI * 2);
      ctx.fill();
      if (hairStyle === 0) {
        // Lush cascading V-tapered beach waves down upper back
        ctx.beginPath();
        ctx.moveTo(hx - hRx * 1.14, headY);
        ctx.bezierCurveTo(hx - hRx * 1.42, headY + 0.16 * s, hx - hRx * 1.05, headY + 0.34 * s + hairBounce * 0.4, hx, headY + 0.40 * s + hairBounce * 0.5);
        ctx.bezierCurveTo(hx + hRx * 1.05, headY + 0.34 * s + hairBounce * 0.4, hx + hRx * 1.42, headY + 0.16 * s, hx + hRx * 1.14, headY);
        ctx.closePath();
        ctx.fill();
      } else if (hairStyle === 1) {
        const sway = Math.sin(timeSec * 6.4 + ph - 0.9) * 0.065 * s;
        ctx.beginPath();
        ctx.moveTo(hx - 0.035 * s, headY - 0.02 * s);
        ctx.bezierCurveTo(hx - 0.11 * s + sway * 0.6, headY + 0.10 * s, hx - 0.08 * s + sway, headY + 0.24 * s + hairBounce, hx + sway * 1.15, headY + 0.31 * s + hairBounce);
        ctx.bezierCurveTo(hx + 0.08 * s + sway, headY + 0.24 * s + hairBounce, hx + 0.11 * s + sway * 0.6, headY + 0.10 * s, hx + 0.035 * s, headY - 0.02 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = swim.primary;
        ctx.lineWidth = Math.max(1.2, 0.032 * s);
        ctx.beginPath();
        ctx.moveTo(hx - 0.048 * s, headY - 0.02 * s);
        ctx.lineTo(hx + 0.048 * s, headY - 0.02 * s);
        ctx.stroke();
      } else if (hairStyle === 2) {
        ctx.beginPath();
        ctx.arc(hx - hRx * 1.0, headY - hRy * 0.78 + hairBounce * 0.3, 0.086 * s, 0, Math.PI * 2);
        ctx.arc(hx + hRx * 1.0, headY - hRy * 0.78 + hairBounce * 0.3, 0.086 * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.roundRect(hx - hRx * 1.18, headY - 0.04 * s, hRx * 2.36, 0.20 * s, 0.07 * s);
        ctx.fill();
      }
      if ((seed % 4) === 0 && !isGearZip && !isGearTank) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.ellipse(hx, headY - hRy * 0.80, 0.25 * s, 0.052 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, headY - hRy * 0.90, 0.115 * s, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = swim.primary;
        ctx.fillRect(hx - 0.115 * s, headY - hRy * 1.0, 0.23 * s, 0.032 * s);
      }
    }
    return;
  }

  if (isFrontView) {
    // Crown & parted bangs
    ctx.fillStyle = hair;
    if (isMale) {
      ctx.beginPath();
      ctx.ellipse(hx, headY - hRy * 0.35, hRx * 1.08, hRy * 0.76, 0, Math.PI * 0.94, Math.PI * 2.06);
      ctx.fill();
      if (hairStyle === 1) {
        ctx.beginPath();
        ctx.ellipse(hx - 0.04 * s, headY - hRy * 1.02, 0.082 * s, 0.046 * s, -0.22, 0, Math.PI * 2);
        ctx.ellipse(hx + 0.06 * s, headY - hRy * 0.98, 0.072 * s, 0.042 * s, 0.26, 0, Math.PI * 2);
        ctx.fill();
      } else if (hairStyle === 0) {
        ctx.beginPath();
        ctx.ellipse(hx + 0.025 * s, headY - hRy * 0.96, 0.105 * s, 0.044 * s, -0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (hasMaleBeard) {
        // Tailored sculpted jawline beard (men only!)
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.moveTo(hx - hRx * 0.86, headY + hRy * 0.22);
        ctx.quadraticCurveTo(hx - hRx * 0.58, headY + hRy * 0.90, hx, headY + hRy * 1.04);
        ctx.quadraticCurveTo(hx + hRx * 0.58, headY + hRy * 0.90, hx + hRx * 0.86, headY + hRy * 0.22);
        ctx.quadraticCurveTo(hx, headY + hRy * 0.62, hx - hRx * 0.86, headY + hRy * 0.22);
        ctx.closePath();
        ctx.fill();
      }
      if (hairStyle === 3 && !isGearZip && !isGearTank) {
        ctx.fillStyle = swim.primary;
        ctx.beginPath();
        ctx.ellipse(hx, headY - hRy * 0.36, hRx * 1.12, hRy * 0.78, 0, Math.PI * 1.02, Math.PI * 1.98);
        ctx.fill();
        ctx.fillStyle = swim.accent;
        ctx.fillRect(hx - 0.05 * s, headY - hRy * 0.66, 0.10 * s, 0.028 * s);
      }
    } else {
      // Soft side-parted feminine crown & sweeping temple bangs
      ctx.beginPath();
      ctx.ellipse(hx, headY - hRy * 0.32, hRx * 1.12, hRy * 0.78, 0, Math.PI * 0.90, Math.PI * 2.10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - hRx * 1.06, headY - hRy * 0.22);
      ctx.quadraticCurveTo(hx - hRx * 0.25, headY - hRy * 0.88, hx + hRx * 0.92, headY - hRy * 0.38);
      ctx.quadraticCurveTo(hx + hRx * 0.15, headY - hRy * 0.62, hx - hRx * 1.06, headY - hRy * 0.22);
      ctx.fill();
      if ((seed % 4) === 0 && !isGearZip && !isGearTank) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.ellipse(hx, headY - hRy * 0.80, 0.25 * s, 0.052 * s, -0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx, headY - hRy * 0.90, 0.115 * s, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = swim.primary;
        ctx.fillRect(hx - 0.115 * s, headY - hRy * 1.0, 0.23 * s, 0.032 * s);
      }
    }

    if (isGearZip || isGearTank) {
      ctx.fillStyle = '#67e8f9';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1, 0.024 * s);
      ctx.beginPath();
      ctx.roundRect(hx - hRx * 0.76, headY - hRy * 0.92, hRx * 1.52, 0.068 * s, 0.022 * s);
      ctx.fill();
      ctx.stroke();
    }

    // Chic cat-eye shades (women) / aviator shades (men) OR refined expressive eyes & brows
    if (wearShades) {
      ctx.fillStyle = '#0f172a';
      if (!isMale) {
        // Sleek angled cat-eye resort sunglasses!
        ctx.beginPath();
        ctx.moveTo(hx - hRx * 0.94, headY - 0.036 * s);
        ctx.lineTo(hx - 0.015 * s, headY - 0.022 * s);
        ctx.quadraticCurveTo(hx - hRx * 0.45, headY + 0.032 * s, hx - hRx * 0.86, headY + 0.008 * s);
        ctx.closePath();
        ctx.moveTo(hx + hRx * 0.94, headY - 0.036 * s);
        ctx.lineTo(hx + 0.015 * s, headY - 0.022 * s);
        ctx.quadraticCurveTo(hx + hRx * 0.45, headY + 0.032 * s, hx + hRx * 0.86, headY + 0.008 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(hx - 0.016 * s, headY - 0.024 * s, 0.032 * s, 0.012 * s);
      } else {
        // Sleek teardrop aviator sunglasses!
        ctx.beginPath();
        ctx.roundRect(hx - hRx * 0.84, headY - 0.036 * s, hRx * 0.72, 0.048 * s, 0.02 * s);
        ctx.roundRect(hx + hRx * 0.12, headY - 0.036 * s, hRx * 0.72, 0.048 * s, 0.02 * s);
        ctx.fill();
        ctx.fillRect(hx - 0.018 * s, headY - 0.026 * s, 0.036 * s, 0.014 * s);
      }
      if (s >= 22) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
        ctx.fillRect(hx - hRx * 0.68, headY - 0.026 * s, 0.028 * s, 0.012 * s);
        ctx.fillRect(hx + hRx * 0.28, headY - 0.026 * s, 0.028 * s, 0.012 * s);
      }
    } else if (s >= 16) {
      // Refined expressive eyes + subtle natural brows
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(hx - hRx * 0.40, headY - 0.014 * s, 0.015 * s, 0, Math.PI * 2);
      ctx.arc(hx + hRx * 0.40, headY - 0.014 * s, 0.015 * s, 0, Math.PI * 2);
      ctx.fill();
      if (s >= 24) {
        ctx.strokeStyle = hair;
        ctx.lineWidth = Math.max(0.7, 0.014 * s);
        ctx.beginPath();
        ctx.moveTo(hx - hRx * 0.62, headY - 0.044 * s);
        ctx.quadraticCurveTo(hx - hRx * 0.40, headY - 0.056 * s, hx - hRx * 0.18, headY - 0.042 * s);
        ctx.moveTo(hx + hRx * 0.18, headY - 0.042 * s);
        ctx.quadraticCurveTo(hx + hRx * 0.40, headY - 0.056 * s, hx + hRx * 0.62, headY - 0.044 * s);
        ctx.stroke();
      }
    }

    // Subtle feminine coral/rose lip curve OR crisp confident male smile
    if (s >= 18) {
      if (!isMale) {
        ctx.fillStyle = 'rgba(190, 62, 72, 0.72)';
        ctx.beginPath();
        ctx.ellipse(hx, headY + hRy * 0.44, 0.030 * s, 0.013 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = hasMaleBeard ? 'rgba(248, 250, 252, 0.85)' : 'rgba(110, 48, 32, 0.65)';
        ctx.lineWidth = Math.max(0.85, 0.017 * s);
        ctx.beginPath();
        ctx.arc(hx, headY + hRy * 0.30, 0.036 * s, 0.22, Math.PI - 0.22);
        ctx.stroke();
      }
    }
    return;
  }

  // SIDE PROFILE HEAD (facing +x)
  ctx.fillStyle = hair;
  if (isMale) {
    ctx.beginPath();
    ctx.ellipse(hx - 0.018 * s, headY - 0.032 * s, hRx * 1.06, hRy * 0.92, 0, Math.PI * 0.72, Math.PI * 2.02);
    ctx.quadraticCurveTo(hx - 0.05 * s, headY - 0.01 * s, hx - hRx * 0.88, headY + 0.05 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx - hRx * 0.82, headY + 0.008 * s, 0.046 * s, 0.074 * s, 0.18, 0, Math.PI * 2);
    ctx.fill();
    if (hairStyle === 1) {
      ctx.beginPath();
      ctx.ellipse(hx + 0.032 * s, headY - hRy * 1.0, 0.092 * s, 0.046 * s, -0.15, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 3 && !isGearZip && !isGearTank) {
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.ellipse(hx - 0.01 * s, headY - 0.04 * s, hRx * 1.12, hRy * 0.85, 0, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.fillStyle = swim.accent;
      ctx.beginPath();
      ctx.roundRect(hx - hRx * 1.65, headY - 0.075 * s, 0.13 * s, 0.038 * s, 0.018 * s);
      ctx.fill();
    }
    if (hasMaleBeard) {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx + 0.032 * s, headY + 0.025 * s, hRx * 0.76, 0.08, Math.PI * 0.72);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(hx - 0.016 * s, headY - 0.032 * s, hRx * 1.10, hRy * 0.94, 0, Math.PI * 0.82, Math.PI * 2.12);
    ctx.fill();
    if (hairStyle === 0) {
      // Sweeping S-curved beach waves flowing behind neck/shoulders!
      ctx.beginPath();
      ctx.moveTo(hx - hRx * 0.55, headY - hRy * 0.65);
      ctx.bezierCurveTo(hx - hRx * 1.65, headY + 0.02 * s, hx - hRx * 1.82, headY + 0.24 * s + hairBounce * 0.5, hx - hRx * 1.18, headY + 0.36 * s + hairBounce * 0.6);
      ctx.quadraticCurveTo(hx - hRx * 0.82, headY + 0.18 * s + hairBounce * 0.4, hx - hRx * 0.78, headY - 0.02 * s);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 1) {
      // Sleek tapered high ponytail streaming back!
      ctx.beginPath();
      ctx.moveTo(hx - hRx * 0.88, headY - hRy * 0.52);
      ctx.bezierCurveTo(hx - hRx * 2.05, headY - hRy * 0.42 + hairBounce, hx - hRx * 2.15, headY + 0.08 * s + hairBounce * 1.1, hx - hRx * 1.62, headY + 0.18 * s + hairBounce * 1.2);
      ctx.quadraticCurveTo(hx - hRx * 1.38, headY - 0.04 * s + hairBounce * 0.6, hx - hRx * 0.86, headY - hRy * 0.26);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 2) {
      ctx.beginPath();
      ctx.arc(hx - hRx * 0.96, headY - hRy * 0.78 + hairBounce * 0.3, 0.082 * s, 0, Math.PI * 2);
      ctx.arc(hx + hRx * 0.56, headY - hRy * 0.96 + hairBounce * 0.3, 0.072 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(hx - hRx * 0.82, headY + 0.03 * s + hairBounce * 0.22, 0.078 * s, 0.125 * s, 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isGearZip || isGearTank) {
    ctx.fillStyle = '#67e8f9';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, 0.024 * s);
    ctx.beginPath();
    ctx.roundRect(hx + 0.01 * s, headY - hRy * 0.92, hRx * 1.02, 0.068 * s, 0.022 * s);
    ctx.fill();
    ctx.stroke();
  } else if (!isMale && (seed % 4) === 0) {
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(hx, headY - hRy * 0.80, 0.25 * s, 0.052 * s, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, headY - hRy * 0.90, 0.115 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = swim.primary;
    ctx.fillRect(hx - 0.115 * s, headY - hRy * 1.0, 0.23 * s, 0.032 * s);
  }

  if (wearShades) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(hx + 0.018 * s, headY - 0.036 * s, hRx * 0.86, 0.046 * s, 0.018 * s);
    ctx.fill();
    if (s >= 22) {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
      ctx.fillRect(hx + 0.042 * s, headY - 0.028 * s, 0.034 * s, 0.012 * s);
    }
  } else if (s >= 16) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(hx + hRx * 0.54, headY - 0.014 * s, 0.015 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s >= 18) {
    if (!isMale) {
      ctx.fillStyle = 'rgba(190, 62, 72, 0.72)';
      ctx.beginPath();
      ctx.ellipse(hx + hRx * 0.72, headY + hRy * 0.44, 0.022 * s, 0.012 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = hasMaleBeard ? 'rgba(248, 250, 252, 0.85)' : 'rgba(110, 48, 32, 0.65)';
      ctx.lineWidth = Math.max(0.8, 0.017 * s);
      ctx.beginPath();
      ctx.arc(hx + hRx * 0.62, headY + hRy * 0.34, 0.030 * s, 0.1, Math.PI * 0.62);
      ctx.stroke();
    }
  }
}

// Zero-allocation scratch pose for 2-pass depth-sorted arm layering (far/back arms -> torso -> near/front arms)
const _armPose = {
  lx0: 0, ly0: 0, lx1: 0, ly1: 0, lx2: 0, ly2: 0,
  rx0: 0, ry0: 0, rx1: 0, ry1: 0, rx2: 0, ry2: 0,
  backL: false, backR: false,
  toastX: 0, toastY: 0, hasToast: false,
};

function computePersonArmPose(
  view,
  role,
  danceMove,
  timeSec,
  ph,
  seed,
  s,
  prof,
  chestShiftX,
  hipShiftX,
  shoulderY,
  waistY,
  hipY,
  headY,
  shTilt,
  lKneeX,
  lKneeY,
  rKneeX,
  rKneeY
) {
  const isSideView = view === 'side';
  const isBackView = view === 'back';
  const isDance = role === 'party-dance';
  const isToast = role === 'party-toast';
  const isGearZip = role === 'gear-zip';
  const isGearTank = role === 'gear-tank';

  // Seamless deltoid-welded shoulder anchors (side view puts far arm L behind chest, near arm R at side deltoid)
  const shHalf = prof.sh * 0.87 * s;
  const shL = isSideView ? chestShiftX + prof.sh * 0.06 * s : chestShiftX - shHalf;
  const shR = isSideView ? chestShiftX - prof.sh * 0.14 * s : chestShiftX + shHalf;
  const shLY = shoulderY + 0.044 * s - (isSideView ? 0 : shTilt);
  const shRY = shoulderY + 0.044 * s + (isSideView ? 0 : shTilt);

  _armPose.lx0 = shL; _armPose.ly0 = shLY;
  _armPose.rx0 = shR; _armPose.ry0 = shRY;
  _armPose.backL = isSideView;
  _armPose.backR = false;
  _armPose.hasToast = false;

  if (isDance) {
    if (danceMove === 'floss') {
      const swing = -grooveWave(timeSec * 8.2 + ph) * 0.42 * s;
      _armPose.lx1 = shL + swing * 0.62; _armPose.ly1 = waistY + 0.05 * s;
      _armPose.lx2 = hipShiftX + swing * 1.12 - 0.06 * s; _armPose.ly2 = hipY + 0.12 * s;
      _armPose.rx1 = shR + swing * 0.62; _armPose.ry1 = waistY + 0.05 * s;
      _armPose.rx2 = hipShiftX + swing * 1.12 + 0.06 * s; _armPose.ry2 = hipY + 0.12 * s;
      if (!isSideView) {
        if (isBackView) {
          _armPose.backL = swing > 0;
          _armPose.backR = swing <= 0;
        } else {
          _armPose.backR = swing > 0;
          _armPose.backL = swing <= 0;
        }
      }
    } else if (danceMove === 'twerk') {
      const cheer = Math.sin(timeSec * 4.9 + ph);
      _armPose.lx1 = lKneeX - 0.06 * s; _armPose.ly1 = (shLY + lKneeY) * 0.5;
      _armPose.lx2 = lKneeX + 0.03 * s; _armPose.ly2 = lKneeY - 0.03 * s;
      if ((seed & 1) === 0) {
        _armPose.rx1 = rKneeX + (isSideView ? -0.04 : 0.06) * s; _armPose.ry1 = (shRY + rKneeY) * 0.5;
        _armPose.rx2 = rKneeX - 0.02 * s; _armPose.ry2 = rKneeY - 0.03 * s;
      } else {
        _armPose.rx1 = shR + (isSideView ? -0.18 : 0.24) * s; _armPose.ry1 = shRY - 0.16 * s;
        _armPose.rx2 = shR + (isSideView ? -0.12 : 0.18) * s + cheer * 0.08 * s; _armPose.ry2 = shRY - 0.44 * s;
      }
    } else if (danceMove === 'dab') {
      const raw = Math.max(0, Math.sin(timeSec * 4.2 + ph));
      const d = raw * raw * (3 - 2 * raw);
      _armPose.lx1 = shL - 0.22 * s + d * 0.12 * s; _armPose.ly1 = shLY - 0.08 * s - d * 0.16 * s;
      _armPose.lx2 = chestShiftX + 0.06 * s; _armPose.ly2 = headY + 0.05 * s - d * 0.05 * s;
      _armPose.rx1 = shR + 0.28 * s + d * 0.22 * s; _armPose.ry1 = shRY - 0.14 * s - d * 0.22 * s;
      _armPose.rx2 = shR + 0.48 * s + d * 0.32 * s; _armPose.ry2 = shRY - 0.28 * s - d * 0.32 * s;
      if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
    } else if (danceMove === 'disco') {
      const up = 0.5 + 0.5 * grooveWave(timeSec * 5.6 + ph);
      _armPose.lx1 = shL - 0.20 * s; _armPose.ly1 = waistY - 0.02 * s;
      _armPose.lx2 = hipShiftX - prof.hip * 0.95 * s; _armPose.ly2 = hipY - 0.04 * s;
      _armPose.rx1 = shR + (0.04 + up * 0.24) * s; _armPose.ry1 = hipY - up * 0.62 * s;
      _armPose.rx2 = shR + (0.02 + up * 0.44) * s; _armPose.ry2 = hipY + 0.06 * s - up * 1.10 * s;
      if (isBackView) { _armPose.backR = up < 0.35; }
    } else if (danceMove === 'salsa') {
      const sway = grooveWave(timeSec * 5.6 + ph - 0.45);
      _armPose.lx1 = shL - 0.22 * s; _armPose.ly1 = shLY - 0.26 * s;
      _armPose.lx2 = chestShiftX - 0.05 * s + sway * 0.12 * s; _armPose.ly2 = headY - 0.28 * s;
      _armPose.rx1 = shR + 0.24 * s; _armPose.ry1 = waistY - 0.04 * s;
      _armPose.rx2 = shR + 0.12 * s - sway * 0.10 * s; _armPose.ry2 = waistY - 0.22 * s;
    } else if (danceMove === 'running-man') {
      const pump = Math.sin(timeSec * 7.4 + ph - 0.2) * 0.22 * s;
      _armPose.lx1 = shL - (isSideView ? 0.10 : 0.15) * s; _armPose.ly1 = waistY + 0.04 * s - pump * 0.5;
      _armPose.lx2 = shL + (isSideView ? 0.14 : 0.02) * s; _armPose.ly2 = shLY - 0.05 * s - pump;
      _armPose.rx1 = shR - (isSideView ? 0.16 : -0.15) * s; _armPose.ry1 = waistY + 0.04 * s + pump * 0.5;
      _armPose.rx2 = shR + (isSideView ? 0.04 : 0.06) * s; _armPose.ry2 = shRY - 0.05 * s + pump;
      if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
    } else if (danceMove === 'body-roll') {
      const w1 = Math.sin(timeSec * 5.0 + ph - 0.35) * 0.22 * s;
      const w2 = Math.cos(timeSec * 5.0 + ph - 0.35) * 0.22 * s;
      _armPose.lx1 = shL + (isSideView ? 0.18 : -0.24) * s; _armPose.ly1 = shLY - 0.12 * s + w1;
      _armPose.lx2 = shL + (isSideView ? 0.34 : -0.40) * s; _armPose.ly2 = shLY - 0.32 * s + w2;
      _armPose.rx1 = shR + (isSideView ? -0.18 : 0.24) * s; _armPose.ry1 = shRY - 0.12 * s - w1;
      _armPose.rx2 = shR + (isSideView ? -0.30 : 0.40) * s; _armPose.ry2 = shRY - 0.32 * s - w2;
    } else if (danceMove === 'moonwalk') {
      const sw = Math.sin(timeSec * 4.2 + ph) * 0.14 * s;
      _armPose.lx1 = shL + (isSideView ? 0.14 : -0.16) * s - sw * 0.5; _armPose.ly1 = waistY + 0.02 * s;
      _armPose.lx2 = shL + (isSideView ? 0.24 : -0.22) * s - sw; _armPose.ly2 = hipY + 0.06 * s;
      _armPose.rx1 = shR + (isSideView ? -0.14 : 0.22) * s; _armPose.ry1 = shRY - 0.16 * s;
      _armPose.rx2 = chestShiftX + 0.14 * s; _armPose.ry2 = headY - 0.08 * s;
    } else if (danceMove === 'shuffle') {
      const p = grooveWave(timeSec * 8.6 + ph) * 0.20 * s;
      _armPose.lx1 = shL - (isSideView ? 0.04 : 0.22) * s; _armPose.ly1 = waistY - 0.02 * s + p * 0.4;
      _armPose.lx2 = shL + (isSideView ? 0.18 : -0.06) * s; _armPose.ly2 = waistY - 0.16 * s + p;
      _armPose.rx1 = shR + (isSideView ? -0.18 : 0.22) * s; _armPose.ry1 = waistY - 0.02 * s - p * 0.4;
      _armPose.rx2 = shR + (isSideView ? 0.02 : 0.06) * s; _armPose.ry2 = waistY - 0.16 * s - p;
    } else if (danceMove === 'robot') {
      const rp = robotPulse(timeSec, seed);
      const k = rp.snap;
      if (rp.idx === 0) {
        _armPose.lx1 = shL - 0.26 * k * s; _armPose.ly1 = shLY;
        _armPose.lx2 = shL - 0.26 * k * s; _armPose.ly2 = shLY - 0.28 * k * s;
        _armPose.rx1 = shR + 0.26 * k * s; _armPose.ry1 = shRY;
        _armPose.rx2 = shR + 0.26 * k * s; _armPose.ry2 = shRY + 0.26 * k * s;
      } else if (rp.idx === 1) {
        _armPose.lx1 = shL - 0.26 * k * s; _armPose.ly1 = shLY;
        _armPose.lx2 = shL - 0.26 * k * s; _armPose.ly2 = shLY + 0.26 * k * s;
        _armPose.rx1 = shR + 0.26 * k * s; _armPose.ry1 = shRY;
        _armPose.rx2 = shR + 0.26 * k * s; _armPose.ry2 = shRY - 0.28 * k * s;
      } else if (rp.idx === 2) {
        _armPose.lx1 = shL - 0.18 * k * s; _armPose.ly1 = waistY;
        _armPose.lx2 = chestShiftX + 0.06 * k * s; _armPose.ly2 = waistY;
        _armPose.rx1 = shR + 0.28 * k * s; _armPose.ry1 = shRY - 0.04 * s;
        _armPose.rx2 = shR + 0.28 * k * s; _armPose.ry2 = shRY - 0.30 * k * s;
        if (isBackView) _armPose.backL = true;
      } else {
        _armPose.lx1 = shL - 0.28 * k * s; _armPose.ly1 = shRY - 0.04 * s;
        _armPose.lx2 = shL - 0.28 * k * s; _armPose.ly2 = shRY - 0.30 * k * s;
        _armPose.rx1 = shR + 0.18 * k * s; _armPose.ry1 = waistY;
        _armPose.rx2 = chestShiftX - 0.06 * k * s; _armPose.ry2 = waistY;
        if (isBackView) _armPose.backR = true;
      }
    } else if (danceMove === 'hula') {
      const sweep = Math.sin(timeSec * 3.8 + ph - 0.35);
      const rip1 = Math.sin(timeSec * 7.6 + ph) * 0.07 * s;
      const rip2 = Math.cos(timeSec * 7.6 + ph) * 0.08 * s;
      if (isSideView) {
        const fwd = 0.24 * s + sweep * 0.14 * s;
        _armPose.lx1 = chestShiftX + fwd * 0.65; _armPose.ly1 = shLY + 0.08 * s + rip1;
        _armPose.lx2 = chestShiftX + fwd + 0.18 * s; _armPose.ly2 = shLY + 0.02 * s + rip2;
        _armPose.rx1 = chestShiftX + fwd * 0.50; _armPose.ry1 = shRY + 0.12 * s - rip1;
        _armPose.rx2 = chestShiftX + fwd + 0.10 * s; _armPose.ry2 = shRY + 0.06 * s - rip2;
      } else {
        const sideX = sweep * 0.34 * s;
        _armPose.lx1 = chestShiftX + sideX * 0.65 - 0.16 * s; _armPose.ly1 = shLY + 0.08 * s + rip1;
        _armPose.lx2 = chestShiftX + sideX - 0.14 * s; _armPose.ly2 = shLY + 0.02 * s + rip2;
        _armPose.rx1 = chestShiftX + sideX * 0.65 + 0.16 * s; _armPose.ry1 = shRY + 0.12 * s - rip1;
        _armPose.rx2 = chestShiftX + sideX + 0.14 * s; _armPose.ry2 = shRY + 0.06 * s - rip2;
        if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
      }
    } else if (danceMove === 'macarena') {
      const step = Math.floor(timeSec * 2.5 + seed) % 6;
      if (step === 0) {
        _armPose.lx1 = shL - 0.22 * s; _armPose.ly1 = shLY + 0.12 * s;
        _armPose.lx2 = shL - 0.42 * s; _armPose.ly2 = shLY + 0.14 * s;
        _armPose.rx1 = shR + 0.16 * s; _armPose.ry1 = waistY + 0.04 * s;
        _armPose.rx2 = shR + 0.12 * s; _armPose.ry2 = hipY + 0.04 * s;
        if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
      } else if (step === 1) {
        _armPose.lx1 = shL - 0.22 * s; _armPose.ly1 = shLY + 0.10 * s;
        _armPose.lx2 = shL - 0.44 * s; _armPose.ly2 = shLY + 0.10 * s;
        _armPose.rx1 = shR + 0.22 * s; _armPose.ry1 = shRY + 0.10 * s;
        _armPose.rx2 = shR + 0.44 * s; _armPose.ry2 = shRY + 0.10 * s;
        if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
      } else if (step === 2) {
        _armPose.lx1 = shL - 0.10 * s; _armPose.ly1 = waistY - 0.06 * s;
        _armPose.lx2 = shR - 0.04 * s; _armPose.ly2 = shRY + 0.04 * s;
        _armPose.rx1 = shR + 0.10 * s; _armPose.ry1 = waistY - 0.06 * s;
        _armPose.rx2 = shL + 0.04 * s; _armPose.ry2 = shLY + 0.04 * s;
        if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
      } else if (step === 3) {
        _armPose.lx1 = shL - 0.26 * s; _armPose.ly1 = headY - 0.02 * s;
        _armPose.lx2 = chestShiftX - 0.09 * s; _armPose.ly2 = headY - 0.08 * s;
        _armPose.rx1 = shR + 0.26 * s; _armPose.ry1 = headY - 0.02 * s;
        _armPose.rx2 = chestShiftX + 0.09 * s; _armPose.ry2 = headY - 0.08 * s;
      } else {
        // Hands resting naturally on outer hips (never clipping inside swim briefs/boardshorts!)
        _armPose.lx1 = shL - 0.22 * s; _armPose.ly1 = waistY;
        _armPose.lx2 = hipShiftX - prof.hip * 0.96 * s; _armPose.ly2 = hipY - 0.04 * s;
        _armPose.rx1 = shR + 0.22 * s; _armPose.ry1 = waistY;
        _armPose.rx2 = hipShiftX + prof.hip * 0.96 * s; _armPose.ry2 = hipY - 0.04 * s;
      }
    } else if (danceMove === 'air-guitar') {
      const strum = Math.sin(timeSec * 14.5 + ph) * 0.12 * s;
      const fret = Math.sin(timeSec * 4.6 + ph) * 0.05 * s;
      _armPose.lx1 = shL - 0.24 * s; _armPose.ly1 = waistY - 0.04 * s;
      _armPose.lx2 = shL - 0.44 * s + fret; _armPose.ly2 = shLY + 0.04 * s - fret;
      _armPose.rx1 = shR + 0.18 * s; _armPose.ry1 = waistY - 0.02 * s;
      _armPose.rx2 = chestShiftX + 0.05 * s; _armPose.ry2 = waistY + 0.06 * s + strum;
      if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
    } else {
      // 'ymca': Y -> M -> C -> A
      const step = Math.floor(timeSec * 2.1 + seed) % 4;
      if (step === 0) {
        _armPose.lx1 = shL - 0.26 * s; _armPose.ly1 = shLY - 0.24 * s;
        _armPose.lx2 = shL - 0.44 * s; _armPose.ly2 = shLY - 0.48 * s;
        _armPose.rx1 = shR + 0.26 * s; _armPose.ry1 = shRY - 0.24 * s;
        _armPose.rx2 = shR + 0.44 * s; _armPose.ry2 = shRY - 0.48 * s;
      } else if (step === 1) {
        _armPose.lx1 = shL - 0.28 * s; _armPose.ly1 = headY - 0.06 * s;
        _armPose.lx2 = chestShiftX - 0.04 * s; _armPose.ly2 = headY - 0.16 * s;
        _armPose.rx1 = shR + 0.28 * s; _armPose.ry1 = headY - 0.06 * s;
        _armPose.rx2 = chestShiftX + 0.04 * s; _armPose.ry2 = headY - 0.16 * s;
      } else if (step === 2) {
        _armPose.lx1 = shL - 0.24 * s; _armPose.ly1 = shLY + 0.12 * s;
        _armPose.lx2 = shL - 0.38 * s; _armPose.ly2 = shLY + 0.04 * s;
        _armPose.rx1 = chestShiftX + 0.05 * s; _armPose.ry1 = headY - 0.28 * s;
        _armPose.rx2 = shL - 0.24 * s; _armPose.ry2 = headY - 0.24 * s;
      } else {
        _armPose.lx1 = shL - 0.16 * s; _armPose.ly1 = headY - 0.14 * s;
        _armPose.lx2 = chestShiftX; _armPose.ly2 = headY - 0.4 * s;
        _armPose.rx1 = shR + 0.16 * s; _armPose.ry1 = headY - 0.14 * s;
        _armPose.rx2 = chestShiftX; _armPose.ry2 = headY - 0.4 * s;
      }
    }
  } else if (isToast) {
    const raise = Math.sin(timeSec * 3.4 + ph) * 0.11 * s;
    _armPose.lx1 = shL - 0.18 * s; _armPose.ly1 = waistY;
    _armPose.lx2 = hipShiftX - prof.hip * 0.94 * s; _armPose.ly2 = hipY - 0.02 * s;
    const gx = shR + (isSideView ? 0.34 : 0.28) * s;
    const gy = shRY - 0.34 * s - raise;
    _armPose.rx1 = shR + (isSideView ? 0.14 : 0.18) * s; _armPose.ry1 = shRY - 0.06 * s - raise * 0.4;
    _armPose.rx2 = gx; _armPose.ry2 = gy;
    _armPose.toastX = gx; _armPose.toastY = gy; _armPose.hasToast = true;
  } else if (isGearZip) {
    const pull = Math.sin(timeSec * 3.1 + ph) * 0.085 * s;
    _armPose.lx1 = shL - 0.15 * s; _armPose.ly1 = waistY - 0.02 * s;
    _armPose.lx2 = chestShiftX - 0.12 * s; _armPose.ly2 = waistY - 0.04 * s - pull;
    _armPose.rx1 = shR + 0.15 * s; _armPose.ry1 = waistY - 0.02 * s;
    _armPose.rx2 = chestShiftX + 0.12 * s; _armPose.ry2 = waistY - 0.04 * s - pull;
    if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
  } else if (isGearTank) {
    const adj = Math.sin(timeSec * 2.6 + ph) * 0.065 * s;
    _armPose.lx1 = shL - 0.16 * s; _armPose.ly1 = shLY - 0.12 * s + adj;
    _armPose.lx2 = chestShiftX - 0.14 * s; _armPose.ly2 = shLY - 0.10 * s + adj;
    _armPose.rx1 = shR + 0.16 * s; _armPose.ry1 = waistY - 0.02 * s;
    _armPose.rx2 = chestShiftX + 0.10 * s; _armPose.ry2 = waistY + 0.02 * s - adj;
    if (isBackView) { _armPose.backL = true; _armPose.backR = true; }
  } else {
    const wave = Math.sin(timeSec * 4.2 + ph) * 0.13 * s;
    _armPose.lx1 = shL - 0.14 * s; _armPose.ly1 = waistY + 0.04 * s;
    _armPose.lx2 = hipShiftX - prof.hip * 0.90 * s; _armPose.ly2 = hipY - 0.02 * s;
    _armPose.rx1 = shR + 0.18 * s; _armPose.ry1 = shRY - 0.16 * s;
    _armPose.rx2 = shR + 0.22 * s + wave; _armPose.ry2 = shRY - 0.42 * s;
  }
}

/**
 * Draw a single lively topside person (female or male, across 8 varied body types!) anchored at `(x, y)`.
 *
 * Roles:
 * - 'party-dance'  : Bathing-suit/resort reveler busting out any of 14 popular dance moves!
 * - 'party-toast'  : Partygoer raising/clinking a tropical drink with relaxed hip sway & breathing
 * - 'party-lounge' : Sunbather reclining on a bright striped beach towel
 * - 'party-float'  : Swimmer bobbing in a bright inflatable pool ring
 * - 'gear-zip'     : Diver half-in wetsuit zipping up waist
 * - 'gear-fins'    : Seated diver on dock/transom pulling a colorful diving fin onto raised foot
 * - 'gear-tank'    : Diver strapping scuba tank / adjusting BCD straps beside gear
 * - 'gear-ready'   : Fully-suited scuba diver giving an enthusiastic pre-dive OK wave
 */
export function drawTopsidePerson(ctx, x, y, scale, timeSec, spec) {
  const s = Math.max(8, scale);
  const seed = Math.abs(spec.seed || 0);
  const facing = spec.facing === -1 ? -1 : 1;
  const role = spec.role || 'party-dance';
  const { gender, prof, topStyle, bustScale } = resolveTopsidePersonProfile(spec);
  const isMale = gender === 'male';
  const isOnePiece = !isMale && topStyle === 'plunge-onepiece';
  const skinIdx = seed % SKIN_TONES.length;
  const skin = spec.customSkin?.skin || spec.skin || SKIN_TONES[skinIdx];
  const skinShade = spec.customSkin?.shade || SKIN_SHADES[skinIdx];
  const skinHi = SKIN_HIGHLIGHTS[skinIdx];
  const hair = spec.customHair || spec.hair || HAIR_COLORS[(seed * 3 + 1) % HAIR_COLORS.length];
  const defaultSwimPool = isMale ? MALE_SWIM_PALETTES : SWIM_PALETTES;
  let swim = spec.customSwim || defaultSwimPool[seed % defaultSwimPool.length];
  if (isMale && spec.customSwim && (swim.style === 'bikini' || swim.style === 'onepiece')) {
    swim = { primary: swim.primary, accent: swim.accent, style: (seed & 1) === 0 ? 'boardshorts' : 'rashguard' };
  }
  const wet = spec.customWet || WETSUIT_PALETTES[seed % WETSUIT_PALETTES.length];
  const hypeEnergy = Math.max(0, Math.min(1, Number(spec.hypeEnergy) || 0));
  const ph = seed * 1.73;
  const hScale = prof.hScale * (0.97 + (seed % 3) * 0.022);
  const moveCode = spec.danceMove ? (spec.danceMove.charCodeAt(0) & 15) : 0;
  const charKey = spec.id || (((seed & 255) << 11) | ((isMale ? 1 : 0) << 10) | ((role.charCodeAt(0) & 15) << 6) | (moveCode << 2) | (facing > 0 ? 1 : 0));

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * hScale, hScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Floating in a colorful pool ring on the water surface (co-ed!)
  if (role === 'party-float') {
    const fc = FLOAT_COLORS[seed % FLOAT_COLORS.length];
    const bobM = Math.sin(timeSec * 2.2 + ph) * 0.06;
    const bob = bobM * s;
    const waveArm = Math.sin(timeSec * 3.6 + ph) * 0.22;
    const fBounce = computeCharacterBounceState(charKey, 0, bobM, 0, bobM, timeSec, seed, 0);
    const fBbx = fBounce.bust.x * s;
    const fBby = fBounce.bust.y * s;
    const fBtilt = fBounce.bTilt * s;
    ctx.translate(0, bob);

    ctx.fillStyle = 'rgba(4, 24, 38, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 0.1 * s, 0.64 * s, 0.14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = fc.ring;
    ctx.lineWidth = 0.22 * s;
    ctx.beginPath();
    ctx.ellipse(0, -0.02 * s, 0.5 * s, 0.16 * s, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    if (isMale) {
      ctx.fillStyle = swim.style === 'rashguard' ? swim.primary : skin;
      traceMaleTorso(ctx, -0.56 * s, -0.3 * s, -0.14 * s, prof, s * 0.92, 0, 0, 0);
      ctx.fill();
      if (swim.style === 'rashguard') {
        ctx.fillStyle = swim.accent;
        ctx.fillRect(-prof.bust * 0.85 * s, -0.44 * s, prof.bust * 1.7 * s, 0.065 * s);
      } else {
        drawMaleChestDetails(ctx, 0, -0.56 * s, -0.3 * s, prof, s * 0.92);
      }
    } else {
      ctx.fillStyle = skin;
      traceCurvyTorso(ctx, -0.54 * s, -0.3 * s, -0.14 * s, prof, s * 0.92, 0, 0, fBbx, fBby, 0, 0, 0);
      ctx.fill();
      if (isOnePiece) {
        ctx.fillStyle = swim.primary;
        traceCurvyTorso(ctx, -0.48 * s, -0.3 * s, -0.14 * s, prof, s * 0.92, 0, 0, fBbx, fBby, 0, 0, 0);
        ctx.fill();
      }
      drawBouncingBust(ctx, 0, 0, -0.56 * s, -0.3 * s, prof, s * 0.94, fBbx, fBby, fBtilt, swim.primary, swim.accent, skin, topStyle, bustScale, false, 0);
    }

    drawTopsideHead(ctx, 0, -0.71 * s, -0.54 * s, s * 0.96, timeSec, ph, seed, isMale, 'front', skin, skinShade, hair, swim, wet, false, false, false, false);

    const armC = isMale && swim.style === 'rashguard' ? swim.primary : skin;
    drawArticulatedArm(ctx, -prof.sh * 0.85 * s, -0.46 * s, -0.34 * s, -0.3 * s, -0.44 * s, -0.14 * s, prof.arm, s, armC, skin, skin);
    const hx = 0.4 * s + waveArm * 0.16 * s;
    const hy = -0.76 * s;
    drawArticulatedArm(ctx, prof.sh * 0.85 * s, -0.46 * s, 0.34 * s, -0.56 * s, hx, hy, prof.arm, s, armC, skin, skin);

    ctx.fillStyle = '#fde047';
    ctx.fillRect(hx - 0.055 * s, hy - 0.14 * s, 0.11 * s, 0.14 * s);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(hx - 0.04 * s, hy - 0.18 * s, 0.08 * s, 0.04 * s);

    ctx.strokeStyle = fc.ring;
    ctx.lineWidth = 0.24 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0.01 * s, 0.52 * s, 0.17 * s, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = fc.stripe;
    ctx.lineWidth = 0.065 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0.03 * s, 0.22 * s, 0.16 * s, 0, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 2. Sunbather lounging on a bright striped beach towel (co-ed!)
  if (role === 'party-lounge') {
    const kick = Math.sin(timeSec * 2.8 + ph) * 0.07 * s;
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.roundRect(-0.92 * s, -0.07 * s, 1.84 * s, 0.13 * s, 0.04 * s);
    ctx.fill();
    ctx.fillStyle = swim.accent;
    ctx.fillRect(-0.56 * s, -0.07 * s, 0.22 * s, 0.13 * s);
    ctx.fillRect(0.28 * s, -0.07 * s, 0.22 * s, 0.13 * s);

    drawArticulatedLeg(ctx, 0.06 * s, -0.18 * s, 0.44 * s, -0.26 * s, 0.78 * s, -0.15 * s + kick, prof, s, skin, true, 1);
    drawArticulatedLeg(ctx, 0.04 * s, -0.14 * s, 0.42 * s, -0.14 * s, 0.76 * s, -0.1 * s - kick * 0.55, prof, s, skin, true, 1);

    ctx.fillStyle = skin;
    ctx.beginPath();
    if (isMale) {
      // Broad masculine reclined torso (with subtle dad-bod curve if applicable)
      const bel = (prof.belly || 0) * 0.7 * s;
      ctx.moveTo(-0.48 * s, -0.46 * s);
      ctx.bezierCurveTo(-0.34 * s, -0.54 * s, -0.16 * s, -0.44 * s - bel, 0.14 * s, -0.28 * s);
      ctx.quadraticCurveTo(0.2 * s, -0.14 * s, 0.08 * s, -0.09 * s);
      ctx.quadraticCurveTo(-0.22 * s, -0.12 * s, -0.48 * s, -0.46 * s);
    } else {
      ctx.moveTo(-0.46 * s, -0.44 * s);
      ctx.bezierCurveTo(-0.34 * s, -0.55 * s, -0.22 * s, -0.34 * s, -0.12 * s, -0.29 * s);
      ctx.bezierCurveTo(-0.02 * s, -0.37 * s, 0.14 * s, -0.33 * s, 0.18 * s, -0.16 * s);
      ctx.quadraticCurveTo(0.05 * s, -0.06 * s, -0.18 * s, -0.14 * s);
      ctx.quadraticCurveTo(-0.38 * s, -0.2 * s, -0.46 * s, -0.44 * s);
    }
    ctx.closePath();
    ctx.fill();

    if (isMale) {
      // Boardshorts on reclined male lounger
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.roundRect(-0.08 * s, -0.31 * s, 0.34 * s, 0.22 * s, 0.06 * s);
      ctx.fill();
      ctx.fillStyle = swim.accent;
      ctx.fillRect(0.08 * s, -0.31 * s, 0.055 * s, 0.22 * s);
    } else {
      const cs = Math.pow(bustScale || prof.cupScale || 1.0, 0.8);
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.ellipse(0.02 * s, -0.22 * s, 0.175 * s, 0.12 * s, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-0.3 * s, -0.45 * s, 0.105 * cs * s, 0.095 * cs * s, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(82, 38, 18, 0.14)';
      ctx.beginPath();
      ctx.ellipse(-0.31 * s, -0.44 * s, 0.10 * cs * s, 0.09 * cs * s, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.ellipse(-0.37 * s, -0.42 * s, 0.125 * cs * s, 0.108 * cs * s, -0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    drawArticulatedArm(ctx, -0.42 * s, -0.38 * s, -0.54 * s, -0.24 * s, -0.64 * s, -0.12 * s, prof.arm, s, skin);
    drawArticulatedArm(ctx, -0.34 * s, -0.36 * s, -0.2 * s, -0.42 * s, -0.08 * s, -0.52 * s, prof.arm, s, skin);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-0.12 * s, -0.64 * s, 0.09 * s, 0.13 * s);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1, 0.03 * s);
    ctx.beginPath();
    ctx.moveTo(-0.06 * s, -0.64 * s);
    ctx.lineTo(-0.02 * s, -0.73 * s);
    ctx.stroke();

    drawTopsideHead(ctx, -0.56 * s, -0.58 * s, -0.46 * s, s * 0.96, timeSec, ph, seed, isMale, 'side', skin, skinShade, hair, swim, wet, false, false, false, false);
    ctx.restore();
    return;
  }

  // 3. Diver seated on dock edge / boat transom putting on diving fins (co-ed!)
  if (role === 'gear-fins') {
    const tug = Math.sin(timeSec * 3.4 + ph) * 0.075 * s;
    const isFullSuit = (seed & 1) === 0;
    const topCol = isFullSuit ? wet.suit : swim.primary;
    const legCol = isFullSuit ? wet.suit : skin;

    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-0.05 * s, 0.03 * s, 0.38 * s, 0.08 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-0.24 * s, -0.58 * s);
    ctx.rotate(0.24);
    ctx.fillStyle = wet.tank;
    ctx.beginPath();
    ctx.roundRect(-0.11 * s, -0.34 * s, 0.22 * s, 0.64 * s, 0.08 * s);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(-0.04 * s, -0.43 * s, 0.08 * s, 0.1 * s);
    ctx.restore();

    drawArticulatedLeg(ctx, 0.02 * s, -0.14 * s, 0.28 * s, 0.03 * s, 0.3 * s, 0.42 * s, prof, s, legCol, false, 1);
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(0.44 * s, 0.46 * s, 0.22 * s, 0.065 * s, 0.22, 0, Math.PI * 2);
    ctx.fill();

    drawArticulatedLeg(ctx, 0.02 * s, -0.17 * s, 0.34 * s, -0.35 * s + tug * 0.4, 0.56 * s, -0.18 * s + tug, prof, s, legCol, false, 1);
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(0.68 * s + tug * 0.5, -0.16 * s + tug, 0.22 * s, 0.07 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();

    if (isMale) {
      ctx.fillStyle = isFullSuit ? topCol : (swim.style === 'rashguard' ? swim.primary : skin);
      traceSideMaleTorso(ctx, -0.79 * s, -0.42 * s, -0.22 * s, prof, s * 0.92, 0.02 * s, -0.04 * s);
      ctx.fill();
      if (isFullSuit) {
        ctx.fillStyle = wet.trim;
        ctx.fillRect(-0.02 * s, -0.68 * s, 0.16 * s, 0.085 * s);
      } else {
        ctx.fillStyle = swim.primary;
        ctx.beginPath();
        ctx.roundRect(-0.2 * s, -0.32 * s, 0.36 * s, 0.24 * s, 0.06 * s);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = isFullSuit ? topCol : skin;
      traceSideCurvyTorso(ctx, -0.78 * s, -0.42 * s, -0.22 * s, prof, s * 0.92, 0.02 * s, -0.04 * s);
      ctx.fill();
      if (isFullSuit) {
        drawSideBouncingBust(ctx, 0.02 * s, -0.04 * s, -0.78 * s, -0.42 * s, prof, s * 0.92, 0, 0, topCol, wet.trim, skin, topStyle, bustScale, true);
        ctx.fillStyle = wet.trim;
        ctx.fillRect(-0.02 * s, -0.68 * s, 0.16 * s, 0.085 * s);
      } else {
        ctx.fillStyle = swim.primary;
        ctx.beginPath();
        ctx.ellipse(-0.04 * s, -0.2 * s, 0.21 * s, 0.125 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        drawSideBouncingBust(ctx, 0.02 * s, -0.04 * s, -0.78 * s, -0.42 * s, prof, s * 0.92, 0, 0, swim.primary, swim.accent, skin, topStyle, bustScale, false);
      }
    }

    const finArmCol = isFullSuit ? wet.suit : (isMale && swim.style === 'rashguard' ? swim.primary : skin);
    drawArticulatedArm(ctx, 0.08 * s, -0.66 * s, 0.35 * s, -0.44 * s + tug * 0.4, 0.56 * s + tug * 0.3, -0.22 * s + tug, prof.arm, s, finArmCol, isFullSuit ? wet.suit : skin, skin);

    drawTopsideHead(ctx, 0.05 * s, -0.95 * s, -0.78 * s, s * 0.96, timeSec, ph, seed, isMale, 'side', skin, skinShade, hair, swim, wet, true, false, false, false);
    ctx.restore();
    return;
  }

  // 4. Standing / 14 Popular Dance Moves / Suiting-Up Articulated Co-Ed Figure
  const isDance = role === 'party-dance';
  const isToast = role === 'party-toast';
  const isGearZip = role === 'gear-zip';
  const isGearTank = role === 'gear-tank';
  const isGearReady = role === 'gear-ready';
  const isGear = isGearZip || isGearTank || isGearReady;

  const danceMove = isDance
    ? (spec.danceMove || POPULAR_DANCE_MOVES[(seed + Math.floor(timeSec / 6.5)) % POPULAR_DANCE_MOVES.length])
    : null;
  const view = resolveTopsidePersonView({ role, danceMove, seed, view: spec.view });
  const isFrontView = view === 'front';
  const isBackView = view === 'back';
  const isSideView = view === 'side';

  // Natural grounded dance & idle kinematics (with beat-snapped groove, contrapposto shoulder tilt & head lag!)
  let bounceY = 0;
  let hipShiftX = 0;
  let chestShiftX = 0;
  let squatDrop = 0;
  let shTilt = 0;
  let headTiltX = 0;
  let headNodY = 0;
  let lFootX = -0.19 * s;
  let rFootX = 0.19 * s;
  let lFootY = -0.04 * s;
  let rFootY = -0.04 * s;
  let useWideKnees = false;

  if (isDance) {
    const fast = grooveWave(timeSec * 8.2 + ph);
    const med = grooveWave(timeSec * 5.6 + ph);
    const medLag = grooveWave(timeSec * 5.6 + ph - 0.38);
    const medCos = Math.cos(timeSec * 5.6 + ph);
    const slow = grooveWave(timeSec * 3.3 + ph);

    if (danceMove === 'floss') {
      hipShiftX = fast * 0.19 * s;
      chestShiftX = -fast * 0.045 * s;
      shTilt = -fast * 0.032 * s;
      bounceY = -beatBounce(timeSec * 8.2 + ph) * 0.045 * s;
      headNodY = beatBounce(timeSec * 8.2 + ph - 0.5) * 0.02 * s;
      lFootX = -0.21 * s;
      rFootX = 0.21 * s;
    } else if (danceMove === 'twerk') {
      const pop = grooveWave(timeSec * 9.8 + ph);
      squatDrop = 0.21 * s + pop * 0.075 * s;
      hipShiftX = Math.sin(timeSec * 4.9 + ph) * 0.13 * s;
      chestShiftX = -hipShiftX * 0.35;
      shTilt = -hipShiftX * 0.14;
      lFootX = -0.29 * s;
      rFootX = 0.29 * s;
      useWideKnees = true;
    } else if (danceMove === 'dab') {
      const raw = Math.max(0, Math.sin(timeSec * 4.2 + ph));
      const d = raw * raw * (3 - 2 * raw);
      squatDrop = d * 0.12 * s;
      hipShiftX = -d * 0.12 * s;
      chestShiftX = d * 0.09 * s;
      shTilt = -d * 0.045 * s;
      headTiltX = -d * 0.11 * s;
      headNodY = d * 0.03 * s;
      lFootX = -0.25 * s;
      rFootX = 0.25 * s;
      useWideKnees = true;
    } else if (danceMove === 'disco') {
      hipShiftX = med * 0.16 * s;
      chestShiftX = -medLag * 0.06 * s;
      shTilt = -med * 0.055 * s;
      bounceY = -beatBounce(timeSec * 5.6 + ph) * 0.065 * s;
      headNodY = beatBounce(timeSec * 5.6 + ph - 0.55) * 0.025 * s;
      lFootX = -0.22 * s;
      rFootX = 0.22 * s;
    } else if (danceMove === 'salsa') {
      // Natural weight transfer: pelvis glides over planted support foot while free heel lifts!
      hipShiftX = med * 0.18 * s;
      chestShiftX = medCos * 0.065 * s;
      shTilt = -medLag * 0.045 * s;
      bounceY = -beatBounce(timeSec * 5.6 + ph) * 0.05 * s;
      const stepL = Math.max(0, Math.sin(timeSec * 5.6 + ph));
      const stepR = Math.max(0, -Math.sin(timeSec * 5.6 + ph));
      lFootX = -0.17 * s - stepL * 0.06 * s;
      rFootX = 0.17 * s + stepR * 0.06 * s;
      lFootY = -0.04 * s - stepL * stepL * 0.095 * s;
      rFootY = -0.04 * s - stepR * stepR * 0.095 * s;
      headTiltX = medLag * 0.03 * s;
    } else if (danceMove === 'running-man') {
      // Authentic grounded back slide + crisp high-knee front stomp!
      const stride = Math.sin(timeSec * 7.4 + ph);
      const liftL = Math.max(0, stride);
      const liftR = Math.max(0, -stride);
      bounceY = -beatBounce(timeSec * 7.4 + ph) * 0.095 * s;
      hipShiftX = stride * 0.05 * s;
      chestShiftX = 0.04 * s;
      shTilt = stride * 0.035 * s;
      lFootX = -0.02 * s + stride * 0.24 * s;
      rFootX = -0.02 * s - stride * 0.24 * s;
      lFootY = -0.04 * s - liftL * liftL * 0.21 * s;
      rFootY = -0.04 * s - liftR * liftR * 0.21 * s;
    } else if (danceMove === 'body-roll') {
      // Smooth traveling wave from head -> chest -> hips -> knees!
      headTiltX = Math.sin(timeSec * 5.0 + ph + 0.55) * 0.08 * s;
      chestShiftX = Math.sin(timeSec * 5.0 + ph) * 0.13 * s;
      hipShiftX = Math.sin(timeSec * 5.0 + ph - 1.15) * 0.17 * s;
      squatDrop = (0.5 + 0.5 * Math.cos(timeSec * 5.0 + ph - 0.6)) * 0.11 * s;
      lFootX = -0.20 * s;
      rFootX = 0.20 * s;
    } else if (danceMove === 'moonwalk') {
      // Iconic smooth backward glide: front foot stays flat sliding back while back heel pops up!
      const cyc = (timeSec * 2.1 + ph * 0.35) % 2;
      const half = cyc < 1 ? cyc : cyc - 1;
      const smooth = half * half * (3 - 2 * half);
      const isLeftSlide = cyc < 1;
      const slideX = (0.24 - smooth * 0.48) * s;
      const popX = (-0.24 + smooth * 0.48) * s;
      const heelPopY = -Math.sin(smooth * Math.PI) * 0.085 * s;
      if (isLeftSlide) {
        lFootX = slideX; lFootY = -0.04 * s;
        rFootX = popX;   rFootY = -0.04 * s + heelPopY;
      } else {
        rFootX = slideX; rFootY = -0.04 * s;
        lFootX = popX;   lFootY = -0.04 * s + heelPopY;
      }
      chestShiftX = 0.075 * s; // Classic cool smooth forward lean!
      hipShiftX = -0.03 * s;
      squatDrop = 0.055 * s + Math.sin(smooth * Math.PI) * 0.025 * s;
      headTiltX = 0.05 * s + Math.sin(timeSec * 4.2 + ph) * 0.025 * s;
    } else if (danceMove === 'shuffle') {
      // Energetic Melbourne shuffle / cutting-shapes heel-toe scissor steps!
      const shuf = Math.sin(timeSec * 8.6 + ph);
      const hop = beatBounce(timeSec * 8.6 + ph);
      bounceY = -hop * 0.09 * s;
      hipShiftX = shuf * 0.085 * s;
      shTilt = -shuf * 0.04 * s;
      const scis = Math.abs(shuf);
      lFootX = (-0.09 - scis * 0.21) * s;
      rFootX = (0.09 + scis * 0.21) * s;
      lFootY = -0.04 * s - Math.max(0, shuf) * 0.09 * s;
      rFootY = -0.04 * s - Math.max(0, -shuf) * 0.09 * s;
    } else if (danceMove === 'robot') {
      // Crisp quantized pose-locks with tiny mechanical micro-overshoot!
      const rp = robotPulse(timeSec, seed);
      const dir = (rp.idx === 0 || rp.idx === 3) ? 1 : -1;
      chestShiftX = dir * 0.065 * rp.snap * s;
      hipShiftX = -dir * 0.03 * rp.snap * s;
      shTilt = dir * 0.045 * rp.snap * s;
      headTiltX = -dir * 0.055 * rp.snap * s;
      squatDrop = (rp.idx & 1) ? 0.06 * rp.snap * s : 0.015 * s;
      lFootX = -0.22 * s;
      rFootX = 0.22 * s;
    } else if (danceMove === 'hula') {
      // Lush slow tropical figure-8 hip sway with soft grounded knees!
      const sw = Math.sin(timeSec * 3.8 + ph);
      const sw2 = Math.cos(timeSec * 3.8 + ph);
      hipShiftX = sw * 0.19 * s;
      chestShiftX = sw2 * 0.04 * s;
      shTilt = -sw * 0.03 * s;
      squatDrop = 0.07 * s + (0.5 - 0.5 * Math.cos(timeSec * 7.6 + ph)) * 0.03 * s;
      headTiltX = -sw * 0.03 * s;
      lFootX = -0.20 * s;
      rFootX = 0.20 * s;
    } else if (danceMove === 'macarena') {
      // Classic 6-step beat cycle (0..4 arm steps, 5 hip wiggle + hop!)
      const step = Math.floor(timeSec * 2.5 + seed) % 6;
      const beatF = (timeSec * 2.5 + seed) % 1;
      if (step === 5) {
        hipShiftX = Math.sin(beatF * Math.PI * 4) * 0.16 * s;
        bounceY = -Math.sin(beatF * Math.PI) * 0.12 * s;
      } else {
        hipShiftX = Math.sin(timeSec * 5.0 + ph) * 0.06 * s;
        bounceY = -beatBounce(timeSec * 2.5 * Math.PI + ph) * 0.04 * s;
      }
      lFootX = -0.20 * s;
      rFootX = 0.20 * s;
    } else if (danceMove === 'air-guitar') {
      // Rock-star power stance + headbanging groove!
      const shred = Math.sin(timeSec * 9.2 + ph);
      const rock = Math.sin(timeSec * 4.6 + ph);
      squatDrop = 0.13 * s + Math.abs(rock) * 0.045 * s;
      hipShiftX = rock * 0.08 * s;
      chestShiftX = -rock * 0.06 * s;
      shTilt = -0.055 * s + rock * 0.03 * s;
      headNodY = (0.5 + 0.5 * shred) * 0.055 * s;
      headTiltX = rock * 0.05 * s;
      lFootX = -0.28 * s;
      rFootX = 0.28 * s;
      useWideKnees = true;
    } else {
      // 'ymca': Energetic festival hop cycling Y - M - C - A!
      const hop = beatBounce(timeSec * 6.2 + ph);
      bounceY = -hop * 0.13 * s;
      hipShiftX = slow * 0.12 * s;
      shTilt = -slow * 0.035 * s;
      lFootX = -0.23 * s;
      rFootX = 0.23 * s;
    }
  } else if (isToast) {
    // Relaxed musical weight shift + subtle breathing & head nod
    const groove = grooveWave(timeSec * 3.4 + ph);
    hipShiftX = groove * 0.085 * s;
    chestShiftX = -groove * 0.025 * s;
    shTilt = -groove * 0.025 * s;
    bounceY = -Math.max(0, groove) * 0.03 * s;
    headNodY = Math.sin(timeSec * 6.8 + ph - 0.5) * 0.015 * s;
  } else {
    // Natural subtle breathing & relaxed weight shift for suiting-up divers!
    const breath = Math.sin(timeSec * 2.1 + ph);
    bounceY = breath * 0.012 * s;
    hipShiftX = Math.sin(timeSec * 1.4 + ph) * 0.025 * s;
  }

  // Live crowd hype jump-cheer overlay
  if (hypeEnergy > 0.04) {
    const cheerHop = beatBounce(timeSec * (11.0 + (seed % 3) * 1.0) + ph);
    bounceY -= cheerHop * (0.18 * hypeEnergy) * s;
    hipShiftX += Math.sin(timeSec * 7.6 + ph) * 0.05 * hypeEnergy * s;
  }

  // Ground contact shadow (shrinks subtly during jumps; hidden during mid-air dive leaps!)
  if (!spec.noShadow) {
    const airFactor = clamp(1 + bounceY / (0.45 * s), 0.65, 1.05);
    ctx.fillStyle = 'rgba(6, 16, 26, 0.34)';
    ctx.beginPath();
    ctx.ellipse(hipShiftX * 0.35, 0.02 * s, 0.35 * airFactor * s, 0.075 * airFactor * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7.5-head editorial beach proportions (long sculpted legs, defined high waist, graceful neck)
  const hipY = -0.82 * s + bounceY + squatDrop;
  const waistY = -1.10 * s + bounceY + squatDrop * 0.88;
  const shoulderY = -1.41 * s + bounceY + squatDrop * 0.78;
  const headY = -1.61 * s + bounceY + squatDrop * 0.72 + headNodY;

  // Real-time independent damped spring-damper physics for female bust & glutes!
  const hypePulse = hypeEnergy > 0.04 ? Math.sin(timeSec * 12.0 + ph) * (2.4 * hypeEnergy) : 0;
  const extraPulse = isMale ? 0 : ((isDance
    ? (danceMove === 'twerk'
        ? Math.sin(timeSec * 9.8 + ph) * 2.1
        : danceMove === 'ymca' || danceMove === 'running-man' || danceMove === 'shuffle'
          ? Math.sin(timeSec * 7.6 + ph) * 1.4
          : Math.sin(timeSec * 5.8 + ph) * 0.8)
    : isToast
      ? Math.sin(timeSec * 3.4 + ph) * 0.4
      : 0) + hypePulse);
  const bounceSt = computeCharacterBounceState(
    charKey,
    chestShiftX / s,
    shoulderY / s,
    hipShiftX / s,
    hipY / s,
    timeSec,
    seed,
    extraPulse
  );
  const bbx = isMale ? 0 : bounceSt.bust.x * s;
  const bby = isMale ? 0 : bounceSt.bust.y * s;
  const bTilt = isMale ? 0 : bounceSt.bTilt * s;
  const gbx = isMale ? 0 : bounceSt.glute.x * s;
  const gby = isMale ? 0 : bounceSt.glute.y * s;
  const gTilt = isMale ? 0 : bounceSt.gTilt * s;

  // 4a. Grounded 2-Bone IK Sculpted Legs (warm depth shading on rear leg in side view!)
  const legColor = isGear ? wet.suit : skin;
  const rearLegColor = (isSideView && !isGear) ? skinShade : legColor;
  const hipLegOff = isSideView ? prof.hip * 0.16 * s : prof.hip * 0.50 * s;
  const lHipX = hipShiftX + gbx * 0.25 - hipLegOff;
  const rHipX = hipShiftX + gbx * 0.25 + hipLegOff;
  const legHipY = hipY + 0.04 * s + gby * 0.25;
  const legLfx = isSideView ? lFootX * 0.72 - 0.03 * s : lFootX;
  const legRfx = isSideView ? rFootX * 0.72 + 0.05 * s : rFootX;
  const thighLen = 0.42 * s;
  const shinLen = 0.41 * s;
  const lBend = isSideView ? 1 : (useWideKnees ? -1 : -0.75);
  const rBend = isSideView ? 1 : (useWideKnees ? 1 : 0.75);

  solveJoint2Bone(lHipX, legHipY, legLfx, lFootY, thighLen, shinLen, lBend >= 0 ? 1 : -1);
  const lKneeX = isSideView ? _ikX : lHipX + (_ikX - lHipX) * (useWideKnees ? 0.78 : 0.56);
  const lKneeY = _ikY;

  solveJoint2Bone(rHipX, legHipY, legRfx, rFootY, thighLen, shinLen, rBend >= 0 ? 1 : -1);
  const rKneeX = isSideView ? _ikX : rHipX + (_ikX - rHipX) * (useWideKnees ? 0.78 : 0.56);
  const rKneeY = _ikY;

  drawArticulatedLeg(ctx, lHipX, legHipY, lKneeX, lKneeY, legLfx, lFootY, prof, s, rearLegColor, !isGear, isSideView ? 1 : -0.65, isSideView);
  drawArticulatedLeg(ctx, rHipX, legHipY, rKneeX, rKneeY, legRfx, rFootY, prof, s, legColor, !isGear, isSideView ? 1 : 0.65, isSideView);

  // Dive booties / fins for geared divers
  if (isGearReady) {
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(legLfx + 0.08 * s, lFootY + 0.02 * s, 0.18 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(legRfx + 0.1 * s, rFootY + 0.02 * s, 0.18 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isGear) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(legLfx - 0.07 * s, lFootY - 0.03 * s, 0.15 * s, 0.085 * s);
    ctx.fillRect(legRfx - 0.07 * s, rFootY - 0.03 * s, 0.16 * s, 0.085 * s);
  }

  // Compute 2-pass depth-sorted arm pose BEFORE torso so far/back-layer arms tuck naturally behind torso & bust!
  const hasSleeves = isGearReady || isGearTank;
  const hasShortSleeve = isMale && !isGear && (swim.style === 'rashguard' || swim.style === 'resort-shirt');
  const upperArmCol = hasSleeves ? wet.suit : (hasShortSleeve ? swim.primary : skin);
  const foreArmCol = hasSleeves ? wet.suit : skin;
  const backUpperCol = (isSideView && !hasSleeves && !hasShortSleeve) ? skinShade : upperArmCol;
  const backForeCol = (isSideView && !hasSleeves) ? skinShade : foreArmCol;
  const backHandCol = isSideView ? skinShade : skin;
  computePersonArmPose(
    view, role, danceMove, timeSec, ph, seed, s, prof,
    chestShiftX, hipShiftX, shoulderY, waistY, hipY, headY, shTilt,
    lKneeX, lKneeY, rKneeX, rKneeY
  );
  if (_armPose.backL) {
    drawArticulatedArm(ctx, _armPose.lx0, _armPose.ly0, _armPose.lx1, _armPose.ly1, _armPose.lx2, _armPose.ly2, prof.arm, s, backUpperCol, backForeCol, backHandCol);
  }
  if (_armPose.backR) {
    drawArticulatedArm(ctx, _armPose.rx0, _armPose.ry0, _armPose.rx1, _armPose.ry1, _armPose.rx2, _armPose.ry2, prof.arm, s, backUpperCol, backForeCol, backHandCol);
  }

  // Scuba cylinder strapped to back for gear-tank & gear-ready (behind torso in front/side views!)
  const tankLift = isGearTank ? Math.sin(timeSec * 2.6 + ph) * 0.055 * s : 0;
  if ((isGearReady || isGearTank) && !isBackView) {
    const tankX = isSideView ? chestShiftX - 0.34 * s : chestShiftX - 0.12 * s;
    const tankW = isSideView ? 0.22 * s : 0.24 * s;
    ctx.fillStyle = wet.tank;
    ctx.beginPath();
    ctx.roundRect(tankX, shoulderY + 0.02 * s + tankLift, tankW, 0.62 * s, 0.08 * s);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(tankX + tankW * 0.32, shoulderY - 0.08 * s + tankLift, 0.08 * s, 0.11 * s);
  }

  // 4b. Anatomically Accurate Co-Ed Torso & Swimwear/Gear by View ('front' | 'back' | 'side')
  if (isMale) {
    if (isSideView) {
      if (isGearReady || isGearTank) {
        ctx.fillStyle = wet.suit;
        traceSideMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = Math.max(1.2, 0.05 * s);
        ctx.beginPath();
        ctx.moveTo(chestShiftX + 0.04 * s, shoulderY + 0.03 * s);
        ctx.lineTo(hipShiftX - 0.04 * s, hipY + 0.02 * s);
        ctx.stroke();
      } else if (isGearZip) {
        ctx.fillStyle = swim.style === 'rashguard' ? swim.primary : skin;
        traceSideMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX);
        ctx.fill();
        if (swim.style !== 'rashguard' && s >= 18) {
          ctx.fillStyle = 'rgba(104, 48, 28, 0.48)';
          ctx.beginPath();
          ctx.arc(chestShiftX + prof.bust * 0.60 * s, shoulderY + (waistY - shoulderY) * 0.44, Math.max(1.0, 0.013 * s), 0, Math.PI * 2);
          ctx.fill();
        }
        const zipUp = 0.065 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
        ctx.fillStyle = wet.suit;
        ctx.beginPath();
        ctx.roundRect(hipShiftX - prof.hip * 0.78 * s, waistY - zipUp, prof.hip * 1.48 * s, hipY - waistY + 0.22 * s + zipUp, 0.08 * s);
        ctx.fill();
        ctx.fillStyle = wet.trim;
        ctx.fillRect(hipShiftX - prof.hip * 0.72 * s, waistY - zipUp, prof.hip * 1.36 * s, 0.05 * s);
      } else {
        const isShirt = swim.style === 'resort-shirt';
        const isRash = swim.style === 'rashguard';
        ctx.fillStyle = isRash ? swim.primary : skin;
        traceSideMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX);
        ctx.fill();
        if (isShirt) {
          // Breezy open Hawaiian resort shirt draped over back & shoulders!
          ctx.fillStyle = swim.primary;
          ctx.beginPath();
          ctx.roundRect(chestShiftX - prof.sh * 0.56 * s, shoulderY, prof.sh * 0.92 * s, hipY - shoulderY + 0.02 * s, 0.07 * s);
          ctx.fill();
          ctx.fillStyle = swim.accent;
          ctx.fillRect(chestShiftX - prof.sh * 0.45 * s, waistY - 0.1 * s, prof.sh * 0.7 * s, 0.055 * s);
        } else if (isRash) {
          ctx.fillStyle = swim.accent;
          ctx.fillRect(chestShiftX - prof.bust * 0.45 * s, shoulderY + 0.16 * s, prof.bust * 1.15 * s, 0.065 * s);
        } else if (s >= 18) {
          // Natural side-profile male nipple tucked cleanly on bare chest contour
          ctx.fillStyle = 'rgba(104, 48, 28, 0.48)';
          ctx.beginPath();
          ctx.arc(chestShiftX + prof.bust * 0.60 * s, shoulderY + (waistY - shoulderY) * 0.44, Math.max(1.0, 0.013 * s), 0, Math.PI * 2);
          ctx.fill();
        }
        // Articulated leg-pivoting male boardshorts / trunks (v295 — follows 2-bone IK thigh pivots!)
        drawArticulatedMaleShorts(
          ctx, 'side', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, legHipY, lKneeX, lKneeY, rKneeX, rKneeY,
          prof, s, shTilt, swim
        );
      }
    } else if (isBackView) {
      if (isGearReady || isGearTank) {
        ctx.fillStyle = wet.suit;
        traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, shTilt);
        ctx.fill();
        ctx.fillStyle = wet.tank;
        ctx.beginPath();
        ctx.roundRect(chestShiftX - 0.12 * s, shoulderY + 0.02 * s + tankLift, 0.24 * s, 0.58 * s, 0.08 * s);
        ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.fillRect(chestShiftX - 0.04 * s, shoulderY - 0.08 * s + tankLift, 0.08 * s, 0.1 * s);
      } else if (isGearZip) {
        ctx.fillStyle = swim.style === 'rashguard' ? swim.primary : skin;
        traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, shTilt);
        ctx.fill();
        const zipUp = 0.065 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
        ctx.fillStyle = wet.suit;
        ctx.beginPath();
        ctx.roundRect(hipShiftX - prof.hip * 1.04 * s, waistY - zipUp, prof.hip * 2.08 * s, hipY - waistY + 0.22 * s + zipUp, 0.08 * s);
        ctx.fill();
        ctx.strokeStyle = wet.trim;
        ctx.lineWidth = Math.max(1.1, 0.036 * s);
        ctx.beginPath();
        ctx.moveTo((chestShiftX + hipShiftX) * 0.5, waistY - zipUp);
        ctx.lineTo(hipShiftX, hipY + 0.04 * s);
        ctx.stroke();
      } else {
        const isShirt = swim.style === 'resort-shirt';
        const isRash = swim.style === 'rashguard';
        ctx.fillStyle = (isShirt || isRash) ? swim.primary : skin;
        traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, shTilt);
        ctx.fill();
        if (isShirt || isRash) {
          ctx.fillStyle = swim.accent;
          ctx.fillRect(chestShiftX - prof.bust * 0.85 * s, shoulderY + 0.16 * s, prof.bust * 1.7 * s, 0.06 * s);
        }
        // Articulated leg-pivoting boardshorts / trunks back view (v295)
        drawArticulatedMaleShorts(
          ctx, 'back', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, legHipY, lKneeX, lKneeY, rKneeX, rKneeY,
          prof, s, shTilt, swim
        );
      }
    } else {
      // MALE FRONT VIEW
      if (isGearReady || isGearTank) {
        ctx.fillStyle = wet.suit;
        traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, shTilt);
        ctx.fill();
        ctx.fillStyle = wet.trim;
        ctx.fillRect(chestShiftX - prof.bust * 0.72 * s, shoulderY + 0.13 * s, prof.bust * 1.44 * s, 0.06 * s);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = Math.max(1.2, 0.05 * s);
        ctx.beginPath();
        ctx.moveTo(chestShiftX - 0.11 * s, shoulderY + 0.02 * s);
        ctx.lineTo(hipShiftX - 0.11 * s, hipY + 0.02 * s);
        ctx.moveTo(chestShiftX + 0.11 * s, shoulderY + 0.02 * s);
        ctx.lineTo(hipShiftX + 0.11 * s, hipY + 0.02 * s);
        ctx.stroke();
      } else if (isGearZip) {
        ctx.fillStyle = swim.style === 'rashguard' ? swim.primary : skin;
        traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, shTilt);
        ctx.fill();
        if (swim.style !== 'rashguard') drawMaleChestDetails(ctx, chestShiftX, shoulderY, waistY, prof, s);
        const zipUp = 0.065 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
        ctx.fillStyle = wet.suit;
        ctx.beginPath();
        ctx.roundRect(hipShiftX - prof.hip * 1.02 * s, waistY - zipUp, prof.hip * 2.04 * s, hipY - waistY + 0.22 * s + zipUp, 0.08 * s);
        ctx.fill();
        ctx.fillStyle = wet.trim;
        ctx.fillRect(hipShiftX - prof.hip * 0.98 * s, waistY - zipUp, prof.hip * 1.96 * s, 0.055 * s);
      } else {
        const isShirt = swim.style === 'resort-shirt';
        const isRash = swim.style === 'rashguard';
        ctx.fillStyle = isRash ? swim.primary : skin;
        traceMaleTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, shTilt);
        ctx.fill();
        if (isShirt) {
          // Tailored open unbuttoned Hawaiian resort shirt hugging torso taper cleanly!
          const midX = (chestShiftX + hipShiftX) * 0.5;
          const gap = 0.052 * s;
          ctx.fillStyle = swim.primary;
          // Left shirt panel
          ctx.beginPath();
          ctx.moveTo(chestShiftX - prof.sh * 0.94 * s, shoulderY + 0.01 * s - shTilt);
          ctx.lineTo(chestShiftX - gap * 1.15, shoulderY - 0.02 * s);
          ctx.lineTo(hipShiftX - gap, hipY - 0.04 * s);
          ctx.lineTo(hipShiftX - prof.hip * 0.96 * s, hipY - 0.04 * s);
          ctx.quadraticCurveTo(midX - prof.waist * 1.02 * s, waistY, chestShiftX - prof.sh * 0.94 * s, shoulderY + 0.01 * s - shTilt);
          ctx.closePath();
          ctx.fill();
          // Right shirt panel
          ctx.beginPath();
          ctx.moveTo(chestShiftX + prof.sh * 0.94 * s, shoulderY + 0.01 * s + shTilt);
          ctx.lineTo(chestShiftX + gap * 1.15, shoulderY - 0.02 * s);
          ctx.lineTo(hipShiftX + gap, hipY - 0.04 * s);
          ctx.lineTo(hipShiftX + prof.hip * 0.96 * s, hipY - 0.04 * s);
          ctx.quadraticCurveTo(midX + prof.waist * 1.02 * s, waistY, chestShiftX + prof.sh * 0.94 * s, shoulderY + 0.01 * s + shTilt);
          ctx.closePath();
          ctx.fill();
          // Crisp collar lapel & subtle pocket accent
          ctx.fillStyle = swim.accent;
          ctx.fillRect(midX - prof.waist * 0.82 * s, waistY - 0.1 * s, prof.waist * 0.42 * s, 0.042 * s);
          ctx.fillRect(midX + prof.waist * 0.40 * s, waistY - 0.1 * s, prof.waist * 0.42 * s, 0.042 * s);
        } else if (isRash) {
          ctx.fillStyle = swim.accent;
          ctx.fillRect(chestShiftX - prof.bust * 0.92 * s, shoulderY + 0.16 * s, prof.bust * 1.84 * s, 0.065 * s);
        } else {
          drawMaleChestDetails(ctx, chestShiftX, shoulderY, waistY, prof, s);
        }

        // Articulated leg-pivoting mid-thigh boardshorts & swim briefs (v295 — follows both thigh pivots!)
        drawArticulatedMaleShorts(
          ctx, 'front', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, legHipY, lKneeX, lKneeY, rKneeX, rKneeY,
          prof, s, shTilt, swim
        );
      }
    }
  } else if (isSideView) {
    // FEMALE TRUE SIDE PROFILE (+x front bust, -x smoothly integrated glutes)
    if (isGearReady || isGearTank) {
      ctx.fillStyle = wet.suit;
      traceSideCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
      ctx.fill();
      drawSideBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, wet.suit, 'rgba(15, 23, 42, 0.24)');
      drawSideBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, wet.suit, wet.trim, skin, topStyle, bustScale, true);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.2, 0.05 * s);
      ctx.beginPath();
      ctx.moveTo(chestShiftX + 0.04 * s, shoulderY + 0.03 * s);
      ctx.lineTo(hipShiftX - 0.04 * s, hipY + 0.02 * s);
      ctx.stroke();
    } else if (isGearZip) {
      ctx.fillStyle = skin;
      traceSideCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
      ctx.fill();
      drawSideBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, swim.primary, swim.accent, skin, topStyle === 'plunge-onepiece' ? 'triangle-halter' : topStyle, bustScale, false);
      const zipUp = 0.065 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
      ctx.fillStyle = wet.suit;
      ctx.beginPath();
      ctx.roundRect(hipShiftX - prof.hip * 0.72 * s, waistY - zipUp, prof.hip * 1.32 * s, hipY - waistY + 0.2 * s + zipUp, 0.09 * s);
      ctx.fill();
      drawSideBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, wet.suit, 'rgba(15, 23, 42, 0.24)');
      ctx.fillStyle = wet.trim;
      ctx.fillRect(hipShiftX - prof.hip * 0.68 * s, waistY - zipUp, prof.hip * 1.24 * s, 0.05 * s);
    } else {
      ctx.fillStyle = skin;
      traceSideCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
      ctx.fill();
      if (!isOnePiece) {
        // Body-locked high-cut French-leg side bikini bottom with hip-crest elastic tension & glute wrap (v295)
        drawSideBouncingGlutes(ctx, hipShiftX, hipY + 0.005 * s, prof, s, gbx, gby, skin, skinShade);
        drawFittedFemaleBottoms(
          ctx, 'side', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, lKneeX, rKneeX, prof, s, bbx, bby, gbx, gby, gTilt, shTilt,
          swim, skin, topStyle, false
        );
        drawSideBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, swim.primary, swim.accent, skin, topStyle, bustScale, false);
      } else {
        // Side-profile designer high-cut monokini one-piece: render bare skin glutes first so the unified
        // clipped one-piece bodice + cheek-hugging leg cut leaves a razor-clean bare lower butt cheek!
        const midX = (chestShiftX + hipShiftX) * 0.5;
        const frontWaist = prof.waist * 0.62 * s;
        const backWaist = prof.waist * 0.52 * s;
        drawSideBouncingGlutes(ctx, hipShiftX, hipY + 0.005 * s, prof, s, gbx, gby, skin, skinShade);
        drawFittedFemaleBottoms(
          ctx, 'side', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, lKneeX, rKneeX, prof, s, bbx, bby, gbx, gby, gTilt, shTilt,
          swim, skin, topStyle, true
        );
        drawSideBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, swim.primary, swim.accent, skin, topStyle, bustScale, false);
        ctx.strokeStyle = swim.accent;
        ctx.lineWidth = Math.max(1.2, 0.040 * s);
        ctx.beginPath();
        ctx.moveTo(midX - backWaist + 0.01 * s, waistY);
        ctx.quadraticCurveTo(midX + 0.04 * s, waistY + 0.02 * s, midX + frontWaist - 0.01 * s, waistY);
        ctx.stroke();
      }
    }
  } else if (isBackView) {
    // FEMALE TRUE BACK VIEW
    if (isGearReady || isGearTank) {
      ctx.fillStyle = wet.suit;
      traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, 0, 0, gbx, gby, shTilt);
      ctx.fill();
      drawBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, gTilt, wet.suit, 'rgba(15, 23, 42, 0.28)');
      ctx.fillStyle = wet.tank;
      ctx.beginPath();
      ctx.roundRect(chestShiftX - 0.12 * s, shoulderY + 0.02 * s + tankLift, 0.24 * s, 0.58 * s, 0.08 * s);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillRect(chestShiftX - 0.04 * s, shoulderY - 0.08 * s + tankLift, 0.08 * s, 0.1 * s);
    } else if (isGearZip) {
      ctx.fillStyle = skin;
      traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, 0, 0, gbx, gby, shTilt);
      ctx.fill();
      ctx.strokeStyle = swim.primary;
      ctx.lineWidth = Math.max(1.3, 0.044 * s);
      ctx.beginPath();
      ctx.moveTo(chestShiftX - prof.bust * 0.72 * s, shoulderY + 0.18 * s);
      ctx.lineTo(chestShiftX + prof.bust * 0.72 * s, shoulderY + 0.18 * s);
      ctx.stroke();
      const zipUp = 0.065 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
      ctx.fillStyle = wet.suit;
      ctx.beginPath();
      ctx.moveTo((chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.04 * s, waistY - zipUp);
      ctx.lineTo((chestShiftX + hipShiftX) * 0.5 + prof.waist * 1.04 * s, waistY - zipUp);
      ctx.bezierCurveTo(hipShiftX + gbx * 0.7 + prof.hip * 1.02 * s, hipY - 0.06 * s + gby * 0.35, hipShiftX + gbx * 0.7 + prof.hip * 0.98 * s, hipY + 0.05 * s + gby * 0.65, hipShiftX + gbx * 0.7 + prof.hip * 0.64 * s, hipY + 0.14 * s + gby * 0.65);
      ctx.quadraticCurveTo(hipShiftX + gbx * 0.7, hipY + 0.19 * s + gby * 0.65, hipShiftX + gbx * 0.7 - prof.hip * 0.64 * s, hipY + 0.14 * s + gby * 0.65);
      ctx.bezierCurveTo(hipShiftX + gbx * 0.7 - prof.hip * 0.98 * s, hipY + 0.05 * s + gby * 0.65, hipShiftX + gbx * 0.7 - prof.hip * 1.02 * s, hipY - 0.06 * s + gby * 0.35, (chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.04 * s, waistY - zipUp);
      ctx.closePath();
      ctx.fill();
      drawBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, gTilt, wet.suit, 'rgba(15, 23, 42, 0.28)');
      ctx.strokeStyle = wet.trim;
      ctx.lineWidth = Math.max(1.1, 0.036 * s);
      ctx.beginPath();
      ctx.moveTo((chestShiftX + hipShiftX) * 0.5, waistY - zipUp);
      ctx.lineTo(hipShiftX + gbx * 0.4, hipY + 0.02 * s + gby * 0.4);
      ctx.stroke();
    } else {
      // Natural side-boob curves peeking cleanly past left & right ribcage edges in Back View (v296)!
      drawBackViewSideBoob(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, bTilt, skin, skinShade, swim, topStyle, bustScale);
      ctx.fillStyle = skin;
      traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, 0, 0, gbx, gby, shTilt);
      ctx.fill();
      if (!isOnePiece) {
        if (topStyle === 'sporty-crop') {
          const topHalf = prof.bust * 0.78 * s;
          const botHalf = prof.waist * 0.98 * s;
          ctx.fillStyle = swim.primary;
          ctx.beginPath();
          ctx.moveTo(chestShiftX - topHalf, shoulderY + 0.05 * s - shTilt);
          ctx.lineTo(chestShiftX + topHalf, shoulderY + 0.05 * s + shTilt);
          ctx.lineTo(chestShiftX + botHalf, shoulderY + 0.30 * s);
          ctx.lineTo(chestShiftX - botHalf, shoulderY + 0.30 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = swim.accent;
          ctx.fillRect(chestShiftX - botHalf, shoulderY + 0.265 * s, botHalf * 2, 0.040 * s);
        } else {
          // Back strap anchored cleanly across the ribcage & meeting the outer side-boob contour!
          const strapW = prof.bust * (0.82 + 0.04 * Math.min(1.45, (prof.cupScale || 1) * (bustScale || 1))) * s;
          ctx.strokeStyle = swim.primary;
          ctx.lineWidth = Math.max(1.3, (topStyle === 'bandeau' ? 0.082 : 0.042) * s);
          ctx.beginPath();
          ctx.moveTo(chestShiftX - strapW, shoulderY + 0.19 * s);
          ctx.lineTo(chestShiftX + strapW, shoulderY + 0.19 * s);
          ctx.stroke();
          if (topStyle === 'balconette' || topStyle === 'wrap-crisscross') {
            ctx.lineWidth = Math.max(1, 0.025 * s);
            ctx.beginPath();
            ctx.moveTo(chestShiftX - prof.sh * 0.56 * s, shoulderY + 0.032 * s - shTilt);
            ctx.lineTo(chestShiftX - prof.bust * 0.48 * s, shoulderY + 0.19 * s);
            ctx.moveTo(chestShiftX + prof.sh * 0.56 * s, shoulderY + 0.032 * s + shTilt);
            ctx.lineTo(chestShiftX + prof.bust * 0.48 * s, shoulderY + 0.19 * s);
            ctx.stroke();
          }
          ctx.fillStyle = swim.accent;
          ctx.beginPath();
          ctx.arc(chestShiftX, shoulderY + 0.19 * s, 0.032 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        drawBouncingGlutes(ctx, hipShiftX, hipY + 0.015 * s, prof, s, gbx, gby, gTilt, skin, skinShade, false);
        drawFittedFemaleBottoms(
          ctx, 'back', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, lKneeX, rKneeX, prof, s, 0, 0, gbx, gby, gTilt, shTilt,
          swim, skin, topStyle, false
        );
      } else {
        // Tight scooped-back cheeky high-cut monokini one-piece clipped strictly onto torso & glutes (v295)!
        const bhx = hipShiftX + gbx * 0.80;
        const bhy = hipY + gby * 0.80;
        const midX = (chestShiftX + hipShiftX) * 0.5;
        const waW = prof.waist * 0.94 * s;
        // Exposed rounded lower butt cheeks beneath the cheeky high-cut back!
        drawBouncingGlutes(ctx, hipShiftX, hipY + 0.015 * s, prof, s, gbx, gby, gTilt, skin, skinShade, false);
        ctx.save();
        traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, 0, 0, gbx, gby, shTilt);
        ctx.clip?.();
        const eCrest = evalFrontHipEdgeAtT(0.44, chestShiftX, hipShiftX, waistY, hipY, prof, s, gbx, gby);
        ctx.fillStyle = swim.primary;
        ctx.beginPath();
        ctx.moveTo(chestShiftX - prof.sh * 1.05 * s, shoulderY + 0.055 * s - shTilt);
        ctx.lineTo(chestShiftX + prof.sh * 1.05 * s, shoulderY + 0.055 * s + shTilt);
        ctx.lineTo(eCrest.rightX + 0.06 * s, eCrest.y);
        ctx.quadraticCurveTo(eCrest.rightX - eCrest.halfW * 0.42, bhy + 0.036 * s - gTilt * 0.4, bhx, hipY + 0.155 * s + gby * 0.6);
        ctx.quadraticCurveTo(eCrest.leftX + eCrest.halfW * 0.42, bhy + 0.036 * s + gTilt * 0.4, eCrest.leftX - 0.06 * s, eCrest.y);
        ctx.closePath();
        ctx.fill();
        // Low-back scoop skin cutout
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.ellipse(chestShiftX, shoulderY + 0.17 * s, prof.bust * 0.48 * s, 0.15 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawFittedFemaleBottoms(
          ctx, 'back', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, lKneeX, rKneeX, prof, s, 0, 0, gbx, gby, gTilt, shTilt,
          swim, skin, topStyle, true
        );
        ctx.strokeStyle = swim.accent;
        ctx.lineWidth = Math.max(1.2, 0.042 * s);
        ctx.beginPath();
        ctx.moveTo(midX - waW, waistY);
        ctx.quadraticCurveTo(midX, waistY + 0.025 * s, midX + waW, waistY);
        ctx.stroke();
      }
    }
  } else {
    // FEMALE TRUE FRONT VIEW
    if (isGearReady || isGearTank) {
      ctx.fillStyle = wet.suit;
      traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby, shTilt);
      ctx.fill();
      drawBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, bTilt, wet.suit, wet.trim, skin, topStyle, bustScale, true, shTilt);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.2, 0.048 * s);
      ctx.beginPath();
      ctx.moveTo(chestShiftX - 0.1 * s, shoulderY + 0.02 * s);
      ctx.lineTo(hipShiftX - 0.1 * s, hipY + 0.02 * s);
      ctx.moveTo(chestShiftX + 0.1 * s, shoulderY + 0.02 * s);
      ctx.lineTo(hipShiftX + 0.1 * s, hipY + 0.02 * s);
      ctx.stroke();
    } else if (isGearZip) {
      ctx.fillStyle = skin;
      traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby, shTilt);
      ctx.fill();
      drawBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, bTilt, swim.primary, swim.accent, skin, topStyle === 'plunge-onepiece' ? 'triangle-halter' : topStyle, bustScale, false, shTilt);
      const zipUp = 0.065 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
      const fhx = hipShiftX + gbx * 0.62;
      ctx.fillStyle = wet.suit;
      ctx.beginPath();
      ctx.moveTo((chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.03 * s, waistY - zipUp);
      ctx.lineTo((chestShiftX + hipShiftX) * 0.5 + prof.waist * 1.03 * s, waistY - zipUp);
      ctx.bezierCurveTo(fhx + prof.hip * 0.99 * s, hipY - 0.05 * s, fhx + prof.hip * 0.95 * s, hipY + 0.04 * s, fhx + prof.hip * 0.64 * s, hipY + 0.14 * s);
      ctx.quadraticCurveTo(fhx, hipY + 0.18 * s, fhx - prof.hip * 0.64 * s, hipY + 0.14 * s);
      ctx.bezierCurveTo(fhx - prof.hip * 0.95 * s, hipY + 0.04 * s, fhx - prof.hip * 0.99 * s, hipY - 0.05 * s, (chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.03 * s, waistY - zipUp);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = wet.trim;
      ctx.fillRect((chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.01 * s, waistY - zipUp, prof.waist * 2.02 * s, 0.052 * s);
    } else {
      ctx.fillStyle = skin;
      traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby, shTilt);
      ctx.fill();

      if (!isOnePiece) {
        drawFemaleTorsoLandmarks(ctx, chestShiftX, hipShiftX, shoulderY, waistY, hipY, prof, s, skinShade, true);
        drawFittedFemaleBottoms(
          ctx, 'front', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, lKneeX, rKneeX, prof, s, bbx, bby, gbx, gby, gTilt, shTilt,
          swim, skin, topStyle, false
        );
        drawBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, bTilt, swim.primary, swim.accent, skin, topStyle, bustScale, false, shTilt);
      } else {
        // Designer high-cut French-leg deep-V plunge monokini one-piece clipped strictly to exact torso!
        const fhx = hipShiftX + gbx * 0.58;
        const fhy = hipY + gby * 0.52;
        const midX = (chestShiftX + hipShiftX) * 0.5;
        const waW = prof.waist * 0.94 * s;
        ctx.save();
        traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby, shTilt);
        ctx.clip?.();
        const eCrest = evalFrontHipEdgeAtT(0.44, chestShiftX, hipShiftX, waistY, hipY, prof, s, gbx, gby);
        ctx.fillStyle = swim.primary;
        ctx.beginPath();
        ctx.moveTo(chestShiftX - prof.sh * 1.05 * s, shoulderY + 0.045 * s - shTilt);
        ctx.lineTo(chestShiftX + prof.sh * 1.05 * s, shoulderY + 0.045 * s + shTilt);
        ctx.lineTo(eCrest.rightX + 0.06 * s, eCrest.y);
        ctx.quadraticCurveTo(eCrest.rightX - eCrest.halfW * 0.44, fhy + 0.048 * s, fhx, hipY + 0.155 * s + gby * 0.55);
        ctx.quadraticCurveTo(eCrest.leftX + eCrest.halfW * 0.44, fhy + 0.048 * s, eCrest.leftX - 0.06 * s, eCrest.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        drawFittedFemaleBottoms(
          ctx, 'front', chestShiftX, hipShiftX, shoulderY, waistY, hipY,
          lHipX, rHipX, lKneeX, rKneeX, prof, s, bbx, bby, gbx, gby, gTilt, shTilt,
          swim, skin, topStyle, true
        );
        drawFemaleTorsoLandmarks(ctx, chestShiftX, hipShiftX, shoulderY, waistY, hipY, prof, s, skinShade, false);
        // Curved sleek waist trim sitting cleanly BELOW the deep-V plunge (zero weird overlap!)
        ctx.strokeStyle = swim.accent;
        ctx.lineWidth = Math.max(1.2, 0.040 * s);
        ctx.beginPath();
        ctx.moveTo(midX - waW, waistY);
        ctx.quadraticCurveTo(midX, waistY + 0.028 * s, midX + waW, waistY);
        ctx.stroke();
        drawBouncingBust(ctx, chestShiftX, hipShiftX, shoulderY, waistY, prof, s, bbx, bby, bTilt, swim.primary, swim.accent, skin, 'plunge-onepiece', bustScale, false, shTilt);
      }
    }
  }

  // 4c. Pass 2: Front/Near-Layer Articulated Arms (drawn cleanly OVER torso, BEFORE head/hair!)
  if (!_armPose.backL) {
    drawArticulatedArm(ctx, _armPose.lx0, _armPose.ly0, _armPose.lx1, _armPose.ly1, _armPose.lx2, _armPose.ly2, prof.arm, s, upperArmCol, foreArmCol, skin);
  }
  if (!_armPose.backR) {
    drawArticulatedArm(ctx, _armPose.rx0, _armPose.ry0, _armPose.rx1, _armPose.ry1, _armPose.rx2, _armPose.ry2, prof.arm, s, upperArmCol, foreArmCol, skin);
  }

  if (isDance && (seed % 2) === 0 && s >= 24) {
    const np = (timeSec * 0.72 + seed * 0.31) % 1;
    drawMusicNote(
      ctx,
      chestShiftX + 0.36 * s + Math.sin(timeSec * 3.4 + ph) * 0.12 * s,
      headY - 0.24 * s - np * 0.64 * s,
      Math.max(4, 0.22 * s),
      swim.accent,
      Math.sin(np * Math.PI) * 0.88
    );
  } else if (_armPose.hasToast) {
    const gx = _armPose.toastX;
    const gy = _armPose.toastY;
    ctx.fillStyle = seed % 2 === 0 ? '#fb7185' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(gx - 0.08 * s, gy - 0.17 * s);
    ctx.lineTo(gx + 0.08 * s, gy - 0.17 * s);
    ctx.lineTo(gx + 0.04 * s, gy);
    ctx.lineTo(gx - 0.04 * s, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(gx + 0.05 * s, gy - 0.2 * s, 0.08 * s, Math.PI, 0);
    ctx.fill();
  }

  // 4d. View-Aware Co-Ed Head, Clean Neck, Hair/Cap/Hat & Expressive Face
  drawTopsideHead(
    ctx,
    chestShiftX + headTiltX,
    headY,
    shoulderY,
    s,
    timeSec,
    ph,
    seed,
    isMale,
    view,
    skin,
    skinShade,
    hair,
    swim,
    wet,
    isGearZip,
    isGearTank,
    isGearReady,
    isDance
  );

  ctx.restore();
}

/**
 * Draw an open-ocean inflatable party raft / companion RIB tender packed with co-ed
 * dancers busting out popular moves & a diver pulling on fins!
 */
function drawCompanionPartyRaft(ctx, wx, toScreenX, toScreenY, scale, timeSec, seed = 0) {
  const bob = Math.sin(timeSec * 1.9 + seed * 1.7) * 0.11;
  const tilt = Math.sin(timeSec * 1.5 + seed * 2.1) * 0.032;
  const rx = toScreenX(wx);
  const ry = toScreenY(bob);

  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(tilt);

  ctx.fillStyle = 'rgba(4, 18, 34, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 0.22 * scale, 2.45 * scale, 0.22 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const deckY = -0.34 * scale;
  drawBeachUmbrella(ctx, -1.45 * scale, deckY, scale * 0.88, seed + 1, -0.1);
  drawPartyGearProps(ctx, -0.05 * scale, deckY, scale * 0.82, timeSec, 'party');
  drawTopsidePerson(ctx, -0.95 * scale, deckY, scale * 0.92, timeSec, {
    role: 'party-dance',
    danceMove: seed % 2 === 0 ? 'shuffle' : 'hula',
    gender: seed % 2 === 0 ? 'male' : 'female',
    seed: seed + 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, 0.45 * scale, deckY, scale * 0.92, timeSec, {
    role: 'party-dance',
    danceMove: seed % 2 === 0 ? 'salsa' : 'moonwalk',
    gender: seed % 2 === 0 ? 'female' : 'male',
    seed: seed + 4,
    facing: -1,
  });
  drawTopsidePerson(ctx, 1.05 * scale, deckY, scale * 0.9, timeSec, {
    role: 'party-dance',
    danceMove: seed % 2 === 0 ? 'air-guitar' : 'macarena',
    seed: seed + 5,
    facing: -1,
  });
  drawTopsidePerson(ctx, 1.62 * scale, deckY + 0.06 * scale, scale * 0.9, timeSec, {
    role: 'gear-fins',
    seed: seed + 7,
    facing: 1,
  });

  const raftImg = getHyperRealSprite('party-raft');
  if (raftImg) {
    const rw = 5.0 * scale;
    const rh = rw * ((raftImg.naturalHeight || raftImg.height) / Math.max(1, raftImg.naturalWidth || raftImg.width));
    ctx.drawImage(raftImg, -rw * 0.5, deckY - rh * 0.42, rw, rh);
  } else {
    ctx.fillStyle = seed % 2 === 0 ? '#facc15' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-2.3 * scale, -0.44 * scale, 4.6 * scale, 0.56 * scale, 0.28 * scale);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-1.95 * scale, -0.22 * scale, 3.9 * scale, 0.09 * scale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(-1.8 * scale, -0.4 * scale, 3.6 * scale, 0.08 * scale);
  }
  ctx.restore();
}

/**
 * Subtle golden floating "YOU" badge hovering cleanly above the player's custom topside avatar (v296).
 */
export function drawAvatarYouBadge(ctx, x, headTopY, scale, label = 'YOU') {
  if (!Number.isFinite(x) || !Number.isFinite(headTopY) || scale < 10) return;
  ctx.save();
  const fontPx = Math.max(8, Math.min(11, Math.round(scale * 0.30)));
  ctx.font = `800 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const tw = typeof ctx.measureText === 'function' ? ctx.measureText(label).width : label.length * fontPx * 0.62;
  const pw = tw + 10;
  const ph = fontPx + 6;
  const py = headTopY - ph * 0.5 - Math.max(4, scale * 0.14);
  ctx.fillStyle = 'rgba(10, 22, 38, 0.86)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.92)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x - pw * 0.5, py - ph * 0.5, pw, ph, ph * 0.5);
  } else {
    ctx.rect(x - pw * 0.5, py - ph * 0.5, pw, ph);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText?.(label, x, py + 0.5);
  ctx.restore();
}

/**
 * Draw the player's custom avatar running out onto the dock/boat stern and jumping into the water! (v296)
 * 4-stage choreographed sequence (3.65s):
 *   1. Run out along dock/deck (0.00 -> 0.85s)
 *   2. Springboard parabolic dive leap over water (0.85 -> 1.68s)
 *   3. Big joyful turquoise/white splash plume + foam rings + "SPLASH!" pill (1.68 -> 2.48s)
 *   4. Surface pop-up grinning & waving in custom bathing suit & hair (2.48 -> 3.65s)
 */
export function drawPlayerAvatarSiteJump(ctx, startX, edgeX, deckY, surfY, dir, scale, timeSec, opts = {}) {
  const jump = opts.forcedElapsed !== undefined
    ? { active: opts.forcedElapsed >= 0 && opts.forcedElapsed < 3.65, elapsed: opts.forcedElapsed }
    : getAvatarSiteJumpState();
  if (!jump.active || !Number.isFinite(edgeX) || !Number.isFinite(surfY) || scale < 8) return false;

  const elapsed = jump.elapsed;
  const avSpec = buildTopsideSpecFromAvatar(opts.avatar || null, {
    id: 777001,
    seed: 11,
    facing: dir,
    hypeEnergy: 0.95,
  });
  const skinCol = avSpec.customSkin?.skin || '#e0a878';
  const hairCol = avSpec.customHair || '#3b2414';
  const suitCol = avSpec.customSwim?.primary || '#fb7185';
  const accentCol = avSpec.customSwim?.accent || '#fef08a';

  const runDur = 0.85;
  const leapDur = 0.83;
  const splashDur = 0.80;
  const waveDur = 1.17;
  const reachX = dir * scale * 2.65;
  const splashX = edgeX + reachX;

  ctx.save();
  if (elapsed < runDur) {
    // Stage 1: Energetic sprint out along the dock / boat deck toward the jump edge!
    const t = elapsed / runDur;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const px = startX + (edgeX - startX) * ease;
    drawTopsidePerson(ctx, px, deckY, scale * 0.98, timeSec * 1.45, {
      ...avSpec,
      role: 'party-dance',
      danceMove: 'running-man',
      view: 'side',
      facing: dir,
    });
    drawAvatarYouBadge(ctx, px, deckY - scale * 1.92, scale, 'YOU');
  } else if (elapsed < runDur + leapDur) {
    // Stage 2: Graceful springboard dive leap arc out over the water!
    const t = (elapsed - runDur) / leapDur;
    const px = edgeX + reachX * t;
    const baseY = deckY + (surfY - deckY) * (t * t);
    const peakLift = scale * 1.68;
    const arcY = baseY - Math.sin(t * Math.PI) * peakLift;
    const divePitch = dir * (-0.35 + t * 2.45);

    // Trailing joyful air-sparkle droplets behind leap
    if (scale >= 12) {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
      for (let d = 1; d <= 3; d++) {
        const dt = Math.max(0, t - d * 0.08);
        const tx = edgeX + reachX * dt;
        const ty = deckY + (surfY - deckY) * (dt * dt) - Math.sin(dt * Math.PI) * peakLift - scale * 0.55;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(1.5, scale * (0.09 - d * 0.02)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(px, arcY - scale * 0.65);
    ctx.rotate(divePitch);
    drawTopsidePerson(ctx, 0, scale * 0.78, scale * 0.92, timeSec * 1.3, {
      ...avSpec,
      role: 'party-dance',
      danceMove: t < 0.45 ? 'ymca' : 'running-man',
      view: 'side',
      facing: dir,
      noShadow: true,
    });
    ctx.restore();
    drawAvatarYouBadge(ctx, px, arcY - scale * 1.82, scale, 'YOU');
  } else if (elapsed < runDur + leapDur + splashDur) {
    // Stage 3: Big joyful multi-droplet splash crown + expanding foam rings + "SPLASH!" pill!
    const t = (elapsed - runDur - leapDur) / splashDur;
    const alpha = Math.max(0, 1 - t);
    const plumeH = Math.sin(t * Math.PI) * scale * 1.92;
    const plumeW = (0.42 + t * 1.62) * scale;

    // Expanding concentric white foam rings
    ctx.strokeStyle = `rgba(224, 242, 254, ${(alpha * 0.92).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.6, scale * 0.09 * (1 - t * 0.45));
    ctx.beginPath();
    ctx.ellipse(splashX, surfY + scale * 0.05, plumeW, scale * 0.19, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(103, 232, 249, ${(alpha * 0.65).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, scale * 0.06);
    ctx.beginPath();
    ctx.ellipse(splashX, surfY + scale * 0.05, plumeW * 0.64, scale * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Lush spray crown droplets
    for (let i = -4; i <= 4; i++) {
      const ang = -Math.PI * 0.5 + i * 0.24;
      const dist = plumeH * (0.64 + (1 - Math.abs(i) * 0.14) * 0.46);
      const dx = splashX + Math.cos(ang) * dist * 0.92;
      const dy = surfY + Math.sin(ang) * dist;
      const dr = Math.max(1.8, scale * (0.16 - Math.abs(i) * 0.017) * (1 - t * 0.3));
      ctx.fillStyle = i % 2 === 0
        ? `rgba(240, 249, 255, ${(alpha * 0.88).toFixed(3)})`
        : `rgba(125, 211, 252, ${(alpha * 0.78).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    if (scale >= 12) {
      drawAvatarYouBadge(ctx, splashX, surfY - plumeH * 0.88 - scale * 0.25, scale, 'SPLASH! 💦');
    }
  } else {
    // Stage 4: Popping back up at the waterline grinning & waving in your exact avatar colors!
    const t = Math.min(1, (elapsed - runDur - leapDur - splashDur) / waveDur);
    const emerge = t < 0.25 ? t / 0.25 : t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1;
    const bob = Math.sin(timeSec * 6.5) * scale * 0.04;
    const by = surfY - emerge * scale * 0.42 + bob;
    const r = scale * 0.16;

    // Shoulders + bathing suit neckline peeking above waterline
    ctx.fillStyle = skinCol;
    ctx.beginPath();
    ctx.ellipse(splashX, by + r * 0.45, r * 1.45, r * 0.72, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = suitCol;
    ctx.beginPath();
    ctx.ellipse(splashX, by + r * 0.58, r * 1.12, r * 0.48, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = Math.max(1.2, scale * 0.036);
    ctx.beginPath();
    ctx.moveTo(splashX - r * 0.75, by + r * 0.24);
    ctx.lineTo(splashX + r * 0.75, by + r * 0.24);
    ctx.stroke();

    // Head + hair matching player avatar!
    ctx.fillStyle = skinCol;
    ctx.beginPath();
    ctx.arc(splashX, by - r * 0.78, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hairCol;
    ctx.beginPath();
    ctx.arc(splashX, by - r * 0.96, r * 0.96, Math.PI * 0.92, Math.PI * 2.08);
    ctx.fill();

    // Enthusiastic waving arm!
    const waveX = Math.sin(timeSec * 15) * r * 0.48;
    ctx.strokeStyle = skinCol;
    ctx.lineWidth = Math.max(1.8, scale * 0.072);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(splashX + r * 1.05 * dir, by + r * 0.1);
    ctx.lineTo(splashX + (r * 1.95 * dir) + waveX, by - r * 1.65);
    ctx.stroke();

    // Expanding gentle water ripple collar
    ctx.strokeStyle = `rgba(224, 242, 254, ${(0.78 * emerge).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, scale * 0.055);
    ctx.beginPath();
    ctx.ellipse(splashX, surfY + scale * 0.04, scale * (0.48 + (t % 0.5) * 0.6), scale * 0.11, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawAvatarYouBadge(ctx, splashX, by - r * 2.2, scale, 'YOU');
  }
  ctx.restore();
  return true;
}

/**
 * Draw lively co-ed crew & popular-dance partygoers directly on the Shipwreck dive charter
 * boat deck (synchronized with swell bob & pitch!), plus flanking party RIB rafts & floaters!
 */
export function drawShipwreckTopsideCrowd(ctx, boatX, visX0, visX1, toScreenX, toScreenY, scale, timeSec, boatGeom = null, renderer = null) {
  const surfY = toScreenY(0);
  if (surfY < -140 || surfY > ctx.canvas.height + 160) return;

  const hypeEnergy = renderer ? getTopsideHypeEnergy(renderer, timeSec) : 0;

  if (boatX + 12 >= visX0 && boatX - 12 <= visX1) {
    const bobY = Math.sin(timeSec * 1.7) * 0.14;
    const pitch = Math.sin(timeSec * 1.35 + 0.6) * 0.022;
    const bx = toScreenX(boatX);
    const by = toScreenY(bobY);

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(pitch);

    const bw = boatGeom?.bw || 12.2 * scale;
    const bh = boatGeom?.bh || 5.4 * scale;
    // Pixel-locked deck anchors for surf-dive-boat.webp (560x261, hullDraftY = 0.23 * bh)
    const aftDeckY = boatGeom ? -bh * 0.175 : -0.82 * scale;
    const roofY = boatGeom ? -bh * 0.47 : -2.36 * scale;
    const bowInnerY = boatGeom ? -bh * 0.275 : -0.92 * scale;
    const bowOuterY = boatGeom ? -bh * 0.245 : -0.88 * scale;
    const sternPlatY = boatGeom ? -bh * 0.025 : -0.12 * scale;

    drawPartyDiveBoatEnhancements(ctx, 0, 0, bw, bh, scale, timeSec, hypeEnergy, { isPhotoBoat: Boolean(boatGeom) });

    // Stern swim platform: Diver seated squarely on transom pulling on fins
    drawTopsidePerson(ctx, -bw * 0.455, sternPlatY, scale * 0.88, timeSec, {
      role: 'gear-fins',
      gender: 'female',
      seed: 1,
      facing: -1,
      hypeEnergy,
    });

    // Aft dive deck (feet planted right on white gunwale deck beside the silver tanks!)
    drawTopsidePerson(ctx, -bw * 0.36, aftDeckY, scale * 0.9, timeSec, {
      role: 'gear-zip',
      gender: 'female',
      view: 'back',
      seed: 2,
      facing: 1,
      hypeEnergy,
    });
    drawTopsidePerson(ctx, -bw * 0.25, aftDeckY, scale * 0.88, timeSec, {
      role: 'party-dance',
      danceMove: 'hula',
      gender: 'female',
      view: 'front',
      seed: 6,
      facing: 1,
      hypeEnergy,
    });
    drawTopsidePerson(ctx, -bw * 0.14, aftDeckY, scale * 0.9, timeSec, {
      role: 'gear-tank',
      gender: 'male',
      bodyType: 'dad-bod',
      view: 'side',
      seed: 4,
      facing: -1,
      hypeEnergy,
    });

    // Upper cabin sun-deck roof (feet planted strictly within flat roof span [-0.03*bw .. +0.15*bw]!)
    drawPartyGearProps(ctx, bw * 0.05, roofY, scale * 0.72, timeSec, 'party');
    drawTopsidePerson(ctx, -bw * 0.025, roofY, scale * 0.84, timeSec, {
      role: 'party-dance',
      danceMove: 'shuffle',
      gender: 'male',
      bodyType: 'athletic-m',
      view: 'front',
      seed: 0,
      facing: 1,
      hypeEnergy,
    });
    drawTopsidePerson(ctx, bw * 0.055, roofY, scale * 0.84, timeSec, {
      role: 'party-dance',
      danceMove: 'twerk',
      gender: 'female',
      bodyType: 'voluptuous',
      view: 'back',
      seed: 1,
      facing: 1,
      hypeEnergy,
    });
    drawTopsidePerson(ctx, bw * 0.125, roofY, scale * 0.84, timeSec, {
      role: 'party-dance',
      danceMove: 'disco',
      gender: 'female',
      bodyType: 'hourglass',
      view: 'side',
      seed: 3,
      facing: -1,
      hypeEnergy,
    });

    // Foredeck / Bow: Air-Guitar & Macarena dancers planted solidly on forward bow deck!
    drawTopsidePerson(ctx, bw * 0.285, bowInnerY, scale * 0.84, timeSec, {
      role: 'party-dance',
      danceMove: 'air-guitar',
      gender: 'male',
      bodyType: 'muscular',
      view: 'front',
      seed: 5,
      facing: 1,
      hypeEnergy,
    });
    drawTopsidePerson(ctx, bw * 0.37, bowOuterY, scale * 0.84, timeSec, {
      role: 'party-dance',
      danceMove: 'moonwalk',
      gender: 'female',
      bodyType: 'petite',
      view: 'side',
      seed: 2,
      facing: -1,
      hypeEnergy,
    });

    ctx.restore();

    // Player custom avatar runs off the boat stern & leaps into the ocean when a wreck site is picked (v296)!
    const boatJumpPlayed = drawPlayerAvatarSiteJump(
      ctx,
      bx - bw * 0.16,
      bx - bw * 0.44,
      by + sternPlatY - scale * 0.04,
      surfY,
      -1,
      scale,
      timeSec
    );
    if (!boatJumpPlayed) {
      // Otherwise show your custom avatar hanging out prominently at the stern swim platform!
      const playerBoatX = bx - bw * 0.34;
      const playerBoatY = by + sternPlatY - scale * 0.04;
      drawTopsidePerson(ctx, playerBoatX, playerBoatY, scale * 0.94, timeSec, buildTopsideSpecFromAvatar(null, {
        id: 777002,
        role: 'party-dance',
        danceMove: 'disco',
        view: 'front',
        seed: 11,
        facing: 1,
        hypeEnergy,
      }));
      drawAvatarYouBadge(ctx, playerBoatX, playerBoatY - scale * 1.92, scale, 'YOU');
      drawTopsideCannonballer(ctx, bx - bw * 0.46, by + sternPlatY - scale * 0.12, surfY, -1, scale, timeSec, 7, hypeEnergy);
    }
  }

  const leftRaftX = boatX - 11.4;
  if (leftRaftX + 4 >= visX0 && leftRaftX - 4 <= visX1) {
    drawCompanionPartyRaft(ctx, leftRaftX, toScreenX, toScreenY, scale, timeSec, 0);
  }
  const rightRaftX = boatX + 11.8;
  if (rightRaftX + 4 >= visX0 && rightRaftX - 4 <= visX1) {
    drawCompanionPartyRaft(ctx, rightRaftX, toScreenX, toScreenY, scale, timeSec, 3);
  }

  const floaters = [
    { wx: boatX - 7.3, seed: 2, gender: 'male', facing: 1 },
    { wx: boatX + 7.6, seed: 5, gender: 'female', facing: -1 },
  ];
  for (let i = 0; i < floaters.length; i++) {
    const fl = floaters[i];
    if (fl.wx + 2 < visX0 || fl.wx - 2 > visX1) continue;
    drawTopsidePerson(ctx, toScreenX(fl.wx), surfY, scale * 0.92, timeSec, {
      role: 'party-float',
      gender: fl.gender,
      seed: fl.seed,
      facing: fl.facing,
      hypeEnergy,
    });
  }
  if (renderer) {
    drawTopsideHypeOverlay(renderer, ctx, toScreenX, toScreenY, scale, timeSec);
  }
}

/**
 * Draw lively co-ed partygoers dancing 14 popular moves & divers suiting up across ALL non-wreck
 * site topsides (Cenotes, Florida Springs, Caves, Polar Sites, Proving Grounds, etc.)!
 */
export function drawAllSiteTopsidePeople(renderer, ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
  const level = renderer.level;
  if (!level) return;
  const surfY = toScreenY(0);
  if (surfY < -40 || surfY > ctx.canvas.height + 160) return;

  const style = level.theme?.surfaceStyle || '';
  if (level.isWreck || style === 'open-ocean-wreck') {
    return;
  }

  const dpr = renderer._cachedDpr || 1;
  const isCompactPerf = Boolean(renderer.isMobilePerf || (ctx.canvas.width / dpr) <= 540);
  const hypeEnergy = getTopsideHypeEnergy(renderer, timeSec);
  const inVis = (wx) => wx + 1.6 >= visX0 && wx - 1.6 <= visX1;
  const getGroundY = (wx) =>
    typeof renderer._getHorizonGroundY === 'function' ? renderer._getHorizonGroundY(level, wx) : -3.4;

  ctx.save();
  const basins = level.openBasins || [];
  for (let bIdx = 0; bIdx < basins.length; bIdx++) {
    const basin = basins[bIdx];
    if (basin.xMax + 18 < visX0 || basin.xMin - 18 > visX1) continue;

    const isEntry = basin.kind === 'entry';
    const hasEdgeCache = Boolean(renderer._basinEdgeCache && typeof renderer._findBasinCliffEdgeX === 'function');
    const waterLeft = hasEdgeCache
      ? renderer._findBasinCliffEdgeX(basin, -0.35, -1)
      : basin.xMin + 0.5;
    const waterRight = hasEdgeCache
      ? renderer._findBasinCliffEdgeX(basin, -0.35, 1)
      : basin.xMax - 0.5;
    const leftRimY = getGroundY(waterLeft - 2.6);
    const rightRimY = getGroundY(waterRight + 2.6);
    const topLeftX =
      (hasEdgeCache
        ? renderer._findBasinCliffEdgeX(basin, leftRimY, -1)
        : waterLeft - 1.0) - 1.2;
    const topRightX =
      (hasEdgeCache
        ? renderer._findBasinCliffEdgeX(basin, rightRimY, 1)
        : waterRight + 1.0) + 1.2;

    const baseSeed = bIdx * 11 + (level.id ? level.id.length : 3);

    // 1. WATERLINE STAGING DOCK: Player's custom avatar (with site-pick jump-in!) + suiting-up buddy!
    const dockEdgeY = toScreenY(-0.52);
    if (isEntry) {
      const dockJumpPlayed = drawPlayerAvatarSiteJump(
        ctx,
        toScreenX(waterLeft - 0.15),
        toScreenX(waterLeft + 1.82),
        dockEdgeY,
        surfY,
        1,
        scale,
        timeSec
      );
      if (!dockJumpPlayed && inVis(waterLeft + 1.65)) {
        const px = toScreenX(waterLeft + 1.65);
        drawTopsidePerson(ctx, px, dockEdgeY, scale * 0.96, timeSec, buildTopsideSpecFromAvatar(null, {
          id: 777003,
          role: 'party-dance',
          danceMove: 'disco',
          view: 'front',
          seed: 11,
          facing: 1,
          hypeEnergy,
        }));
        drawAvatarYouBadge(ctx, px, dockEdgeY - scale * 1.92, scale, 'YOU');
      }
      if (!isCompactPerf && inVis(waterLeft + 0.45)) {
        drawTopsidePerson(ctx, toScreenX(waterLeft + 0.45), dockEdgeY, scale * 0.96, timeSec, {
          role: 'gear-ready',
          gender: 'male',
          seed: baseSeed + 2,
          facing: 1,
        });
      }
    } else {
      if (inVis(waterRight - 1.75)) {
        drawTopsidePerson(ctx, toScreenX(waterRight - 1.75), dockEdgeY, scale * 0.94, timeSec, {
          role: 'gear-fins',
          gender: 'male',
          seed: baseSeed + 3,
          facing: -1,
        });
      }
      if (!isCompactPerf && inVis(waterRight - 0.72)) {
        drawTopsidePerson(ctx, toScreenX(waterRight - 0.72), dockEdgeY, scale * 0.96, timeSec, {
          role: 'party-dance',
          danceMove: 'hula',
          seed: baseSeed + 4,
          facing: -1,
        });
      }
    }

    // 2. LEFT CLIFF-TOP RIM: Biome-Specific Surface Hangout + Co-Ed Dance Floor + Dive Prep Hub!
    const l0 = topLeftX - 6.8;
    const l1 = topLeftX - 0.4;
    if (l1 + 2 >= visX0 && l0 - 2 <= visX1) {
      const hangoutX = topLeftX - 5.4;
      if (inVis(hangoutX)) {
        drawBiomeSurfaceHangout(ctx, level, toScreenX(hangoutX), toScreenY(getGroundY(hangoutX)), scale, timeSec, {
          compact: isCompactPerf,
          facing: 1,
        });
      }
      if (!isCompactPerf) {
        drawFestiveStringLights(
          ctx,
          toScreenX(topLeftX - 5.8),
          toScreenY(getGroundY(topLeftX - 5.8) - 2.4),
          toScreenX(topLeftX - 0.6),
          toScreenY(getGroundY(topLeftX - 0.6) - 2.3),
          scale,
          timeSec,
          0.48
        );
        const boomX = topLeftX - 3.65;
        drawPartyGearProps(ctx, toScreenX(boomX), toScreenY(getGroundY(boomX)), scale, timeSec, 'party');
        const rackX = topLeftX - 1.2;
        drawPartyGearProps(ctx, toScreenX(rackX), toScreenY(getGroundY(rackX)), scale, timeSec, 'gear');
      }

      const p1x = topLeftX - 4.75;
      if (!isCompactPerf && inVis(p1x)) {
        drawTopsidePerson(ctx, toScreenX(p1x), toScreenY(getGroundY(p1x) - 0.14), scale * 0.96, timeSec, {
          role: 'party-dance',
          danceMove: (baseSeed & 1) === 0 ? 'floss' : 'shuffle',
          gender: 'male',
          view: 'front',
          seed: baseSeed + 0,
          facing: 1,
          hypeEnergy,
        });
      }
      const p2x = topLeftX - 3.92;
      if (inVis(p2x)) {
        drawTopsidePerson(ctx, toScreenX(p2x), toScreenY(getGroundY(p2x) + 0.08), scale, timeSec, {
          role: 'party-dance',
          danceMove: 'twerk',
          gender: 'female',
          view: (baseSeed % 2) === 0 ? 'back' : 'side',
          seed: baseSeed + 1,
          facing: 1,
          hypeEnergy,
        });
      }
      if (!isCompactPerf) {
        const p3x = topLeftX - 2.95;
        if (inVis(p3x)) {
          drawTopsidePerson(ctx, toScreenX(p3x), toScreenY(getGroundY(p3x) - 0.18), scale * 0.94, timeSec, {
            role: 'party-dance',
            danceMove: (baseSeed & 1) === 0 ? 'salsa' : 'hula',
            gender: 'female',
            view: 'side',
            seed: baseSeed + 2,
            facing: -1,
            hypeEnergy,
          });
        }
        const p4x = topLeftX - 2.25;
        if (inVis(p4x)) {
          drawTopsidePerson(ctx, toScreenX(p4x), toScreenY(getGroundY(p4x) + 0.05), scale, timeSec, {
            role: 'party-toast',
            gender: 'male',
            view: 'front',
            seed: baseSeed + 3,
            facing: -1,
            hypeEnergy,
          });
        }
      }

      const d1x = topLeftX - 1.58;
      if (inVis(d1x)) {
        drawTopsidePerson(ctx, toScreenX(d1x), toScreenY(getGroundY(d1x) - 0.08), scale * 0.98, timeSec, {
          role: 'gear-zip',
          gender: 'female',
          view: 'back',
          seed: baseSeed + 5,
          facing: 1,
          hypeEnergy,
        });
      }
      if (!isCompactPerf) {
        const d2x = topLeftX - 0.55;
        if (inVis(d2x)) {
          drawTopsidePerson(ctx, toScreenX(d2x), toScreenY(getGroundY(d2x) + 0.06), scale, timeSec, {
            role: 'gear-tank',
            gender: 'male',
            view: 'side',
            seed: baseSeed + 6,
            facing: 1,
            hypeEnergy,
          });
        }
      }
    }

    // 3. RIGHT CLIFF-TOP RIM: Packed Co-Ed Popular-Dance Party Overlook
    const r0 = topRightX + 0.3;
    const r1 = topRightX + 6.8;
    if (r1 + 2 >= visX0 && r0 - 2 <= visX1) {
      if (!isCompactPerf) {
        drawFestiveStringLights(
          ctx,
          toScreenX(topRightX + 0.6),
          toScreenY(getGroundY(topRightX + 0.6) - 2.3),
          toScreenX(topRightX + 6.1),
          toScreenY(getGroundY(topRightX + 6.1) - 2.45),
          scale,
          timeSec,
          0.5
        );
        const rUmbX = topRightX + 5.1;
        if (inVis(rUmbX)) drawBeachUmbrella(ctx, toScreenX(rUmbX), toScreenY(getGroundY(rUmbX)), scale, baseSeed + 2, 0.1);
        const lngX = topRightX + 5.55;
        if (inVis(lngX)) {
          drawTopsidePerson(ctx, toScreenX(lngX), toScreenY(getGroundY(lngX)), scale * 0.96, timeSec, {
            role: 'party-lounge',
            seed: baseSeed + 4,
            facing: -1,
            hypeEnergy,
          });
        }
        const rd1 = topRightX + 0.8;
        if (inVis(rd1)) {
          drawTopsidePerson(ctx, toScreenX(rd1), toScreenY(getGroundY(rd1) + 0.06), scale, timeSec, {
            role: 'gear-zip',
            view: 'side',
            seed: baseSeed + 7,
            facing: -1,
            hypeEnergy,
          });
        }
      }

      const rp1 = topRightX + 1.75;
      if (inVis(rp1)) {
        drawTopsidePerson(ctx, toScreenX(rp1), toScreenY(getGroundY(rp1) - 0.12), scale * 0.97, timeSec, {
          role: 'party-dance',
          danceMove: (baseSeed & 1) === 0 ? 'air-guitar' : 'disco',
          gender: 'male',
          view: 'front',
          seed: baseSeed + 1,
          facing: 1,
          hypeEnergy,
        });
      }
      if (!isCompactPerf) {
        const rp2 = topRightX + 2.65;
        if (inVis(rp2)) {
          drawTopsidePerson(ctx, toScreenX(rp2), toScreenY(getGroundY(rp2) + 0.08), scale, timeSec, {
            role: 'party-dance',
            danceMove: (baseSeed & 1) === 0 ? 'macarena' : 'dab',
            gender: 'female',
            view: 'front',
            seed: baseSeed + 2,
            facing: -1,
            hypeEnergy,
          });
        }
        const rp3 = topRightX + 3.55;
        if (inVis(rp3)) {
          drawTopsidePerson(ctx, toScreenX(rp3), toScreenY(getGroundY(rp3) - 0.16), scale * 0.95, timeSec, {
            role: 'party-dance',
            danceMove: (baseSeed & 1) === 0 ? 'moonwalk' : 'running-man',
            gender: 'male',
            view: 'side',
            seed: baseSeed + 5,
            facing: 1,
            hypeEnergy,
          });
        }
        const rp4 = topRightX + 4.35;
        if (inVis(rp4)) {
          drawTopsidePerson(ctx, toScreenX(rp4), toScreenY(getGroundY(rp4) + 0.05), scale, timeSec, {
            role: 'party-dance',
            danceMove: (baseSeed & 1) === 0 ? 'robot' : 'ymca',
            gender: 'female',
            view: 'front',
            seed: baseSeed + 0,
            facing: -1,
            hypeEnergy,
          });
        }
        const rBoom = topRightX + 3.1;
        if (inVis(rBoom)) drawPartyGearProps(ctx, toScreenX(rBoom), toScreenY(getGroundY(rBoom)), scale * 0.9, timeSec, 'party');
      }
    }

    // 4. CALM WATER FLOATER + ANIMATED CANNONBALLER
    const basinSpan = waterRight - waterLeft;
    if (basinSpan >= 6.5) {
      const floatWx = isEntry ? waterRight - 2.35 : waterLeft + 2.35;
      if (floatWx + 2 >= visX0 && floatWx - 2 <= visX1) {
        drawTopsidePerson(ctx, toScreenX(floatWx), surfY, scale * 0.94, timeSec, {
          role: 'party-float',
          seed: baseSeed + 2,
          facing: isEntry ? -1 : 1,
          hypeEnergy,
        });
      }
      if (!isCompactPerf) {
        const launchWx = isEntry ? waterLeft + 1.8 : waterRight - 1.8;
        if (inVis(launchWx)) {
          drawTopsideCannonballer(
            ctx,
            toScreenX(launchWx),
            dockEdgeY - scale * 0.15,
            surfY,
            isEntry ? 1 : -1,
            scale,
            timeSec,
            baseSeed + 9,
            hypeEnergy
          );
        }
      }
    }
  }

  // 5. DISTANT SURFACE OVERLOOK DANCE DUOS along longer horizon spans (desktop)
  if (!isCompactPerf) {
    const spanStep = 22;
    const firstIdx = Math.floor((visX0 - 4) / spanStep);
    const lastIdx = Math.ceil((visX1 + 4) / spanStep);
    for (let idx = firstIdx; idx <= lastIdx; idx++) {
      const gx = idx * spanStep + 6.5;
      let nearBasin = false;
      for (let b = 0; b < basins.length; b++) {
        if (gx >= basins[b].xMin - 9 && gx <= basins[b].xMax + 9) {
          nearBasin = true;
          break;
        }
      }
      if (nearBasin) continue;
      const seed = Math.abs(idx * 17 + 5);
      const gy = toScreenY(getGroundY(gx));
      drawBeachUmbrella(ctx, toScreenX(gx - 0.85), toScreenY(getGroundY(gx - 0.85)), scale * 0.92, seed, -0.08);
      drawTopsidePerson(ctx, toScreenX(gx), gy, scale * 0.94, timeSec, {
        role: 'party-dance',
        danceMove: POPULAR_DANCE_MOVES[seed % POPULAR_DANCE_MOVES.length],
        seed,
        facing: 1,
      });
      drawTopsidePerson(ctx, toScreenX(gx + 1.15), toScreenY(getGroundY(gx + 1.15)), scale * 0.94, timeSec, {
        role: (seed % 3) === 0 ? 'gear-zip' : 'party-dance',
        danceMove: POPULAR_DANCE_MOVES[(seed + 5) % POPULAR_DANCE_MOVES.length],
        seed: seed + 3,
        facing: -1,
        hypeEnergy,
      });
    }
  }

  // 6. Live Crowd Hype Confetti & Comic Cheer Callouts
  drawTopsideHypeOverlay(renderer, ctx, toScreenX, toScreenY, scale, timeSec);

  ctx.restore();
}

/**
 * Draw lively co-ed dancers performing popular moves & divers suiting up directly onto the
 * default Home / Loading Screen Cenote Backdrop (`drawMenuBackdropDiorama`)!
 */
export function drawDefaultBackdropTopsidePeople(ctx, cw, ch, timeSec) {
  const waterY = Math.round(ch * 0.295);
  const cliffTopY = Math.round(ch * 0.095);
  const rimScale = Math.max(12, Math.min(26, ch * 0.025));
  const dockScale = Math.max(13, Math.min(28, ch * 0.027));

  ctx.save();

  // 1. LEFT CLIFF RIM
  drawFestiveStringLights(
    ctx,
    cw * 0.025,
    cliffTopY - rimScale * 2.1,
    cw * 0.228,
    cliffTopY - rimScale * 1.9,
    rimScale,
    timeSec,
    0.42
  );
  drawBeachUmbrella(ctx, cw * 0.045, cliffTopY + rimScale * 0.08, rimScale, 0, -0.09);
  drawPartyGearProps(ctx, cw * 0.132, cliffTopY + rimScale * 0.06, rimScale, timeSec, 'party');
  drawPartyGearProps(ctx, cw * 0.196, cliffTopY + rimScale * 0.08, rimScale, timeSec, 'gear');

  drawTopsidePerson(ctx, cw * 0.065, cliffTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'shuffle',
    gender: 'male',
    seed: 0,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.096, cliffTopY + rimScale * 0.07, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'twerk',
    gender: 'female',
    seed: 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.122, cliffTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'hula',
    gender: 'female',
    seed: 2,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.168, cliffTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'gear-zip',
    gender: 'female',
    seed: 4,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.214, cliffTopY + rimScale * 0.1, rimScale, timeSec, {
    role: 'gear-tank',
    gender: 'male',
    seed: 6,
    facing: 1,
  });

  // 2. WOODEN CENOTE ENTRY DOCK (waterline — showcases player's custom avatar & live jump-in!)
  const dockY = waterY - ch * 0.012 - 2;
  drawTopsidePerson(ctx, cw * 0.242, dockY, dockScale, timeSec, {
    role: 'gear-ready',
    gender: 'male',
    seed: 1,
    facing: 1,
  });
  const bgJumpPlayed = drawPlayerAvatarSiteJump(
    ctx,
    cw * 0.235,
    cw * 0.282,
    dockY + 2,
    waterY,
    1,
    dockScale,
    timeSec
  );
  if (!bgJumpPlayed) {
    drawTopsidePerson(ctx, cw * 0.275, dockY + 2, dockScale * 0.98, timeSec, buildTopsideSpecFromAvatar(null, {
      id: 777004,
      role: 'party-dance',
      danceMove: 'disco',
      view: 'front',
      seed: 11,
      facing: 1,
    }));
    drawAvatarYouBadge(ctx, cw * 0.275, dockY + 2 - dockScale * 1.94, dockScale, 'YOU');
  }

  // 3. RIGHT CLIFF RIM
  const rTopY = cliffTopY - ch * 0.004;
  drawFestiveStringLights(
    ctx,
    cw * 0.58,
    rTopY - rimScale * 2.0,
    cw * 0.95,
    rTopY - rimScale * 2.1,
    rimScale,
    timeSec,
    0.45
  );
  drawBeachUmbrella(ctx, cw * 0.855, rTopY + rimScale * 0.06, rimScale, 2, 0.1);
  drawPartyGearProps(ctx, cw * 0.725, rTopY + rimScale * 0.06, rimScale, timeSec, 'party');

  drawTopsidePerson(ctx, cw * 0.602, rTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'gear-zip',
    gender: 'male',
    seed: 5,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.65, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'air-guitar',
    gender: 'male',
    seed: 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.692, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'macarena',
    gender: 'female',
    seed: 4,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.758, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'moonwalk',
    gender: 'male',
    seed: 7,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.802, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'robot',
    gender: 'female',
    seed: 0,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.892, rTopY + rimScale * 0.08, rimScale * 0.98, timeSec, {
    role: 'party-lounge',
    gender: 'female',
    seed: 3,
    facing: -1,
  });

  // 4. SUNLIT CENOTE WATER SURFACE
  drawTopsidePerson(ctx, cw * 0.495, waterY, dockScale * 0.92, timeSec, {
    role: 'party-float',
    gender: 'male',
    seed: 0,
    facing: -1,
  });

  ctx.restore();
}
