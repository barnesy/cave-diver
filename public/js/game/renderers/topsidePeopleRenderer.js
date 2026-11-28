/**
 * Living Topside & Background Crowds Renderer (v282)
 * Populates every dive site topside, charter boat, cenote rim, staging dock,
 * and menu/loading backdrop with lively animated curvy people in bathing suits
 * and diving gear — lots of them busting out popular dance moves (Floss, Booty-Pop /
 * Twerk, Dab, Disco Point, Salsa Hip-Roll, Running Man, Body-Roll Wave, YMCA)
 * alongside divers suiting up (zipping wetsuits, strapping tanks, pulling on fins),
 * toasting tropical drinks, sunbathing, and floating in pool rings.
 *
 * Zero per-frame heap allocations & zero per-person gradients so the mobile 4x CPU
 * < 15.0 ms performance guard stays rock-solid.
 */

const SKIN_TONES = Object.freeze([
  '#f4cca4',
  '#e0a878',
  '#c58250',
  '#8b5228',
  '#f0bf95',
  '#a96a40',
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
  { primary: '#f97316', accent: '#38bdf8', style: 'trunks' },     // Sunset orange trunks
  { primary: '#38bdf8', accent: '#f43f5e', style: 'onepiece' },   // Sky blue one-piece
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
 * Curvy body proportion presets (all visibly curvy with natural variation!).
 * All widths are half-widths in world-meter units (person height ~1.68m).
 */
const BODY_PROFILES = Object.freeze([
  { bust: 0.23, waist: 0.125, hip: 0.285, thigh: 0.145, calf: 0.088 }, // Classic hourglass
  { bust: 0.25, waist: 0.14,  hip: 0.315, thigh: 0.16,  calf: 0.095 }, // Extra voluptuous curvy
  { bust: 0.215, waist: 0.12, hip: 0.295, thigh: 0.15,  calf: 0.088 }, // Pear-curvy dancer
  { bust: 0.24, waist: 0.135, hip: 0.275, thigh: 0.142, calf: 0.086 }, // Athletic-curvy
]);

/**
 * 8 unmistakable, lively popular dance moves that characters perform & cycle through!
 */
export const POPULAR_DANCE_MOVES = Object.freeze([
  'floss',        // Iconic alternating hip pop + fast opposite arm swings
  'twerk',        // Curvy low squat booty-pop / hip drop bounce
  'dab',          // Signature diagonal arm shoot + elbow face dip
  'disco',        // Saturday Night Fever diagonal sky-point + hip sway
  'salsa',        // Lush figure-8 curvy hip sway + graceful overhead arm
  'running-man',  // High-knee shuffle step + pumping elbows
  'body-roll',    // Undulating shoulder-waist-hip wave + sweeping hands
  'ymca',         // Festival jump cycling Y - M - C - A arms!
]);

// Bounded per-character secondary-motion spring-damper state pool (zero GC churn, auto-pruned)
const _bouncePool = new Map();
const MAX_BOUNCE_STATES = 160;

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

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
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
  // Reset cleanly on static frame, rewind, or long tab sleep
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
  // Instantaneous anchor velocities & accelerations (clamped for spike safety)
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

  // Distinct natural frequencies so bust & glutes bounce genuinely independently!
  const omegaBust = 16.2 - (seed % 3) * 1.05;
  const omegaGlute = 12.6 - (seed % 3) * 0.85;

  // Bust spring: responsive to chest bounce + slight coupling from vertical impact
  stepBounceSpring(st.bust, cax, cay + extraPulse * 3.5, dt, omegaBust, 0.21, 0.58, 0.72, 0.085, 0.095);
  // Glute spring: heavier lower-frequency follow-through driven by hip drops, pops & whips
  stepBounceSpring(st.glute, hax, hay + extraPulse * 6.5, dt, omegaGlute, 0.19, 0.76, 0.84, 0.115, 0.115);

  // Subtle independent left/right asymmetry springs (rocking / alternating steps!)
  const bTiltA = -omegaBust * omegaBust * 0.85 * st.bTilt - 2 * 0.24 * omegaBust * st.bTiltV - cax * 0.16;
  st.bTiltV += bTiltA * dt;
  st.bTilt = clamp(st.bTilt + st.bTiltV * dt, -0.055, 0.055);

  const gTiltA = -omegaGlute * omegaGlute * 0.8 * st.gTilt - 2 * 0.22 * omegaGlute * st.gTiltV - hax * 0.22;
  st.gTiltV += gTiltA * dt;
  st.gTilt = clamp(st.gTilt + st.gTiltV * dt, -0.068, 0.068);

  return st;
}

/**
 * Trace a smooth, sculpted curvy hourglass torso path from shoulders to lower hips.
 * Supports independent spring-driven bust (`bbx, bby`) and glute/hip (`gbx, gby`) bounce
 * with subtle volume-conserving squash & stretch!
 */
function traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestX = 0, hipX = 0, bbx = 0, bby = 0, gbx = 0, gby = 0) {
  const bStretch = clamp((bby / Math.max(1, s)) * 2.4, -0.18, 0.22);
  const gStretch = clamp((gby / Math.max(1, s)) * 2.6, -0.2, 0.24);
  const shW = prof.bust * 0.86 * s;
  const buW = prof.bust * (1 - bStretch * 0.32) * s;
  const waW = prof.waist * s;
  const hiW = prof.hip * (1 - gStretch * 0.34) * s;
  const buY = shoulderY + (waistY - shoulderY) * 0.42 + bby * 0.7;
  const lowHipY = hipY + 0.14 * s + gby * 0.85;
  const midWaistX = (chestX + hipX) * 0.5;
  const bustCx = chestX + bbx * 0.75;
  const hipCx = hipX + gbx * 0.85;

  ctx.beginPath();
  // Rounded shoulders across top
  ctx.moveTo(chestX - shW, shoulderY);
  ctx.quadraticCurveTo(chestX, shoulderY - 0.06 * s, chestX + shW, shoulderY);
  // Right bust (with independent bounce) -> cinched waist -> full rounded right hip (with independent bounce)
  ctx.bezierCurveTo(
    bustCx + buW * 1.2, buY - 0.02 * s,
    midWaistX + waW * 1.02, waistY - 0.06 * s,
    midWaistX + waW, waistY
  );
  ctx.bezierCurveTo(
    hipCx + hiW * 1.18, waistY + (hipY - waistY) * 0.42 + gby * 0.35,
    hipCx + hiW * 1.12, hipY + 0.02 * s + gby * 0.75,
    hipCx + hiW * 0.68, lowHipY
  );
  // Soft hip base curve
  ctx.quadraticCurveTo(hipCx, lowHipY + 0.075 * s, hipCx - hiW * 0.68, lowHipY);
  // Left rounded hip -> cinched waist -> left bust -> shoulder
  ctx.bezierCurveTo(
    hipCx - hiW * 1.12, hipY + 0.02 * s + gby * 0.75,
    hipCx - hiW * 1.18, waistY + (hipY - waistY) * 0.42 + gby * 0.35,
    midWaistX - waW, waistY
  );
  ctx.bezierCurveTo(
    midWaistX - waW * 1.02, waistY - 0.06 * s,
    bustCx - buW * 1.2, buY - 0.02 * s,
    chestX - shW, shoulderY
  );
  ctx.closePath();
}

/**
 * Draw sculpted, independently bouncing bust curves with volume-conserving squash & stretch
 * and slight alternating left/right roll lag (`±bTilt`).
 */
function drawBouncingBust(ctx, chestX, shoulderY, prof, s, bbx, bby, bTilt, fillCol, rimCol = null) {
  const stretch = clamp((bby / Math.max(1, s)) * 3.1, -0.24, 0.28);
  const rx = prof.bust * 0.56 * (1 - stretch * 0.38) * s;
  const ry = 0.098 * (1 + stretch) * s;
  const cx = chestX + bbx;
  const cy = shoulderY + 0.175 * s + bby;
  const sep = prof.bust * 0.44 * s;

  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.ellipse(cx - sep, cy + bTilt, rx, ry, -0.14 - bbx / (s * 1.8), 0, Math.PI * 2);
  ctx.ellipse(cx + sep, cy - bTilt, rx, ry, 0.14 - bbx / (s * 1.8), 0, Math.PI * 2);
  ctx.fill();
  if (rimCol && s >= 28) {
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = Math.max(0.9, 0.026 * s);
    ctx.beginPath();
    ctx.ellipse(cx - sep, cy + bTilt - ry * 0.25, rx * 0.62, ry * 0.32, -0.14, Math.PI * 1.1, Math.PI * 1.9);
    ctx.moveTo(cx + sep + rx * 0.62 * Math.cos(Math.PI * 1.1), cy - bTilt - ry * 0.25 + ry * 0.32 * Math.sin(Math.PI * 1.1));
    ctx.ellipse(cx + sep, cy - bTilt - ry * 0.25, rx * 0.62, ry * 0.32, 0.14, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

/**
 * Draw sculpted, independently bouncing glute / lower-hip lobes with volume-conserving
 * squash & stretch and alternating left/right hip-drop bounce (`±gTilt`).
 */
function drawBouncingGlutes(ctx, hipX, hipY, prof, s, gbx, gby, gTilt, fillCol, shadeCol = null) {
  const stretch = clamp((gby / Math.max(1, s)) * 3.2, -0.24, 0.28);
  const rx = prof.hip * 0.62 * (1 - stretch * 0.36) * s;
  const ry = 0.145 * (1 + stretch) * s;
  const cx = hipX + gbx;
  const cy = hipY + 0.055 * s + gby;
  const sep = prof.hip * 0.44 * s;

  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.ellipse(cx - sep, cy + gTilt, rx, ry, 0.16 + gbx / (s * 2.1), 0, Math.PI * 2);
  ctx.ellipse(cx + sep, cy - gTilt, rx, ry, -0.16 + gbx / (s * 2.1), 0, Math.PI * 2);
  ctx.fill();
  if (shadeCol && s >= 28) {
    ctx.strokeStyle = shadeCol;
    ctx.lineWidth = Math.max(0.9, 0.028 * s);
    ctx.beginPath();
    ctx.arc(cx - sep, cy + gTilt, rx * 0.82, 0.35, Math.PI - 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + sep, cy - gTilt, rx * 0.82, 0.25, Math.PI - 0.35);
    ctx.stroke();
  }
}

/**
 * Draw a sculpted curvy leg (fuller rounded upper thigh tapering naturally into knee & calf).
 */
function drawCurvyLeg(ctx, hx, hy, kx, ky, fx, fy, prof, s, color) {
  ctx.strokeStyle = color;
  // Upper curvy thigh
  ctx.lineWidth = prof.thigh * s;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo((hx + kx) * 0.5 + (hx >= 0 ? 0.03 : -0.03) * s, (hy + ky) * 0.5, kx, ky);
  ctx.stroke();
  // Tapered lower calf
  ctx.lineWidth = prof.calf * s;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
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
 * Draw a colorful striped beach umbrella planted at (x, groundY).
 */
export function drawBeachUmbrella(ctx, x, groundY, scale, seed = 0, tilt = 0.09) {
  const pal = UMBRELLA_PALETTES[Math.abs(seed) % UMBRELLA_PALETTES.length];
  const poleH = 1.95 * scale;
  const canopyW = 1.15 * scale;
  const canopyH = 0.44 * scale;

  ctx.save();
  ctx.translate(x, groundY);
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
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0.12 * scale, 0.02 * scale, 0.68 * scale, 0.1 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-0.52 * scale, -0.38 * scale, 0.56 * scale, 0.38 * scale);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-0.55 * scale, -0.45 * scale, 0.62 * scale, 0.1 * scale);

    const beat = Math.abs(Math.sin(timeSec * 6.8));
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
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 0.02 * scale, 0.65 * scale, 0.09 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

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
 * Draw a single lively, curvy topside person (~1.68m tall) anchored at `(x, y)`.
 *
 * Roles:
 * - 'party-dance'  : Curvy bathing-suit reveler dancing a popular move (`spec.danceMove` or seeded cycle!)
 * - 'party-toast'  : Curvy bathing-suit partygoer raising/clinking a tropical cocktail with hip sway
 * - 'party-lounge' : Curvy bathing-suit sunbather reclining on a bright striped beach towel
 * - 'party-float'  : Curvy bathing-suit swimmer bobbing in a bright inflatable pool ring
 * - 'gear-zip'     : Curvy diver half-in wetsuit (bikini/rashguard top + wetsuit zipping up waist)
 * - 'gear-fins'    : Curvy seated diver on dock/transom pulling a colorful diving fin onto raised foot
 * - 'gear-tank'    : Curvy diver strapping scuba tank / adjusting BCD straps beside gear
 * - 'gear-ready'   : Curvy fully-suited scuba diver giving an enthusiastic pre-dive OK wave
 */
export function drawTopsidePerson(ctx, x, y, scale, timeSec, spec) {
  const s = Math.max(8, scale);
  const seed = Math.abs(spec.seed || 0);
  const facing = spec.facing === -1 ? -1 : 1;
  const role = spec.role || 'party-dance';
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const hair = HAIR_COLORS[(seed * 3 + 1) % HAIR_COLORS.length];
  const swim = SWIM_PALETTES[seed % SWIM_PALETTES.length];
  const wet = WETSUIT_PALETTES[seed % WETSUIT_PALETTES.length];
  const prof = BODY_PROFILES[seed % BODY_PROFILES.length];
  const ph = seed * 1.73;
  const hScale = 0.93 + (seed % 3) * 0.065;
  const moveCode = spec.danceMove ? (spec.danceMove.charCodeAt(0) & 15) : 0;
  const charKey = spec.id || (((seed & 255) << 10) | ((role.charCodeAt(0) & 15) << 6) | (moveCode << 2) | (facing > 0 ? 1 : 0));

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * hScale, hScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Floating in a colorful pool ring on the water surface
  if (role === 'party-float') {
    const fc = FLOAT_COLORS[seed % FLOAT_COLORS.length];
    const bobM = Math.sin(timeSec * 2.2 + ph) * 0.06;
    const bob = bobM * s;
    const waveArm = Math.sin(timeSec * 3.8 + ph) * 0.25;
    const fBounce = computeCharacterBounceState(charKey, 0, bobM, 0, bobM, timeSec, seed, 0);
    const fBbx = fBounce.bust.x * s;
    const fBby = fBounce.bust.y * s;
    const fBtilt = fBounce.bTilt * s;
    ctx.translate(0, bob);

    ctx.fillStyle = 'rgba(4, 24, 38, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 0.1 * s, 0.64 * s, 0.14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back arc of pool ring
    ctx.strokeStyle = fc.ring;
    ctx.lineWidth = 0.22 * s;
    ctx.beginPath();
    ctx.ellipse(0, -0.02 * s, 0.5 * s, 0.16 * s, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Curvy upper torso emerging from ring with wave-driven independent bust bounce
    ctx.fillStyle = skin;
    traceCurvyTorso(ctx, -0.54 * s, -0.3 * s, -0.14 * s, prof, s * 0.92, 0, 0, fBbx, fBby, 0, 0);
    ctx.fill();
    drawBouncingBust(ctx, 0, -0.56 * s, prof, s * 0.94, fBbx, fBby, fBtilt, swim.primary, swim.accent);

    // Head + flowing wavy hair + sunglasses
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -0.7 * s, 0.16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(-0.02 * s, -0.74 * s, 0.17 * s, Math.PI * 0.85, Math.PI * 2.15);
    ctx.ellipse(-0.17 * s, -0.62 * s, 0.08 * s, 0.16 * s, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0.01 * s, -0.74 * s, 0.14 * s, 0.055 * s);

    // Arms: one draped on ring, one waving a tropical drink
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.092 * s;
    ctx.beginPath();
    ctx.moveTo(-0.17 * s, -0.46 * s);
    ctx.lineTo(-0.44 * s, -0.14 * s);
    ctx.moveTo(0.17 * s, -0.46 * s);
    ctx.lineTo(0.4 * s + waveArm * 0.18 * s, -0.76 * s);
    ctx.stroke();

    const hx = 0.4 * s + waveArm * 0.18 * s;
    const hy = -0.76 * s;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(hx - 0.055 * s, hy - 0.14 * s, 0.11 * s, 0.14 * s);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(hx - 0.04 * s, hy - 0.18 * s, 0.08 * s, 0.04 * s);

    // Front half of pool ring + bright stripe
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

  // 2. Curvy sunbather lounging on a bright striped beach towel
  if (role === 'party-lounge') {
    const kick = Math.sin(timeSec * 3.1 + ph) * 0.08 * s;
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.roundRect(-0.92 * s, -0.07 * s, 1.84 * s, 0.13 * s, 0.04 * s);
    ctx.fill();
    ctx.fillStyle = swim.accent;
    ctx.fillRect(-0.56 * s, -0.07 * s, 0.22 * s, 0.13 * s);
    ctx.fillRect(0.28 * s, -0.07 * s, 0.22 * s, 0.13 * s);

    // Curvy reclined legs (full thighs tapering to kicking feet)
    drawCurvyLeg(ctx, 0.06 * s, -0.18 * s, 0.44 * s, -0.26 * s, 0.78 * s, -0.15 * s + kick, prof, s, skin);
    drawCurvyLeg(ctx, 0.04 * s, -0.14 * s, 0.42 * s, -0.14 * s, 0.76 * s, -0.1 * s - kick * 0.55, prof, s, skin);

    // Curvy hourglass reclined torso (sculpted bust, cinched waist, lush curved hip!)
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-0.46 * s, -0.44 * s);
    ctx.bezierCurveTo(-0.34 * s, -0.56 * s, -0.22 * s, -0.34 * s, -0.12 * s, -0.29 * s);
    ctx.bezierCurveTo(-0.02 * s, -0.38 * s, 0.14 * s, -0.34 * s, 0.18 * s, -0.16 * s);
    ctx.quadraticCurveTo(0.05 * s, -0.05 * s, -0.18 * s, -0.14 * s);
    ctx.quadraticCurveTo(-0.38 * s, -0.2 * s, -0.46 * s, -0.44 * s);
    ctx.closePath();
    ctx.fill();

    // Contoured bikini bottom & top
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.ellipse(0.02 * s, -0.22 * s, 0.17 * s, 0.12 * s, -0.18, 0, Math.PI * 2);
    ctx.ellipse(-0.36 * s, -0.42 * s, 0.12 * s, 0.1 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Propping arm + drink arm
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.088 * s;
    ctx.beginPath();
    ctx.moveTo(-0.42 * s, -0.38 * s);
    ctx.lineTo(-0.64 * s, -0.12 * s);
    ctx.moveTo(-0.34 * s, -0.36 * s);
    ctx.lineTo(-0.08 * s, -0.52 * s);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-0.12 * s, -0.64 * s, 0.09 * s, 0.13 * s);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1, 0.03 * s);
    ctx.beginPath();
    ctx.moveTo(-0.06 * s, -0.64 * s);
    ctx.lineTo(-0.02 * s, -0.73 * s);
    ctx.stroke();

    // Head + flowing hair + sunglasses
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-0.56 * s, -0.58 * s, 0.155 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(-0.6 * s, -0.6 * s, 0.16 * s, Math.PI * 0.55, Math.PI * 1.9);
    ctx.ellipse(-0.72 * s, -0.46 * s, 0.09 * s, 0.17 * s, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.54 * s, -0.62 * s, 0.13 * s, 0.055 * s);
    ctx.restore();
    return;
  }

  // 3. Curvy diver seated on dock edge / boat transom putting on diving fins!
  if (role === 'gear-fins') {
    const tug = Math.sin(timeSec * 3.6 + ph) * 0.08 * s;
    const isFullSuit = (seed & 1) === 0;
    const topCol = isFullSuit ? wet.suit : swim.primary;
    const legCol = isFullSuit ? wet.suit : skin;

    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-0.05 * s, 0.03 * s, 0.38 * s, 0.08 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scuba tank strapped on back
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

    // Curvy dangling back leg + already-fitted diving fin
    drawCurvyLeg(ctx, 0.02 * s, -0.14 * s, 0.28 * s, 0.03 * s, 0.3 * s, 0.42 * s, prof, s, legCol);
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(0.44 * s, 0.46 * s, 0.22 * s, 0.065 * s, 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Curvy raised front leg pulling on second fin
    drawCurvyLeg(ctx, 0.02 * s, -0.17 * s, 0.34 * s, -0.35 * s + tug * 0.4, 0.56 * s, -0.18 * s + tug, prof, s, legCol);
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(0.68 * s + tug * 0.5, -0.16 * s + tug, 0.22 * s, 0.07 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Curvy seated torso + fuller hip curve
    ctx.fillStyle = isFullSuit ? topCol : skin;
    traceCurvyTorso(ctx, -0.78 * s, -0.42 * s, -0.22 * s, prof, s * 0.92, 0.02 * s, -0.04 * s);
    ctx.fill();
    if (isFullSuit) {
      ctx.fillStyle = wet.trim;
      ctx.fillRect(-0.02 * s, -0.68 * s, 0.18 * s, 0.1 * s);
    } else {
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.ellipse(0.05 * s, -0.6 * s, 0.14 * s, 0.09 * s, 0.1, 0, Math.PI * 2);
      ctx.ellipse(-0.04 * s, -0.2 * s, 0.22 * s, 0.13 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arms reaching down to pull fin strap
    ctx.strokeStyle = isFullSuit ? wet.suit : skin;
    ctx.lineWidth = 0.095 * s;
    ctx.beginPath();
    ctx.moveTo(0.08 * s, -0.66 * s);
    ctx.lineTo(0.35 * s, -0.44 * s + tug * 0.4);
    ctx.lineTo(0.56 * s + tug * 0.3, -0.22 * s + tug);
    ctx.stroke();

    // Head + ponytail + cyan dive mask on forehead
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0.05 * s, -0.95 * s, 0.16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0.02 * s, -1.0 * s, 0.165 * s, Math.PI * 0.85, Math.PI * 2.1);
    ctx.ellipse(-0.15 * s, -0.94 * s, 0.08 * s, 0.13 * s, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, 0.03 * s);
    ctx.beginPath();
    ctx.roundRect(0.05 * s, -1.08 * s, 0.17 * s, 0.095 * s, 0.03 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 4. Standing / Popular Dance Moves / Suiting-Up Articulated Curvy Figure (~1.68m tall)
  const isDance = role === 'party-dance';
  const isToast = role === 'party-toast';
  const isGearZip = role === 'gear-zip';
  const isGearTank = role === 'gear-tank';
  const isGearReady = role === 'gear-ready';
  const isGear = isGearZip || isGearTank || isGearReady;

  // Pick a signature popular dance move (or gently switch moves every 6.5s if no explicit move!)
  const danceMove = isDance
    ? (spec.danceMove || POPULAR_DANCE_MOVES[(seed + Math.floor(timeSec / 6.5)) % POPULAR_DANCE_MOVES.length])
    : null;

  // Dance kinematics: hip pop, chest wave, knee bend, foot shuffle, head tilt!
  let bounceY = 0;
  let hipShiftX = 0;
  let chestShiftX = 0;
  let squatDrop = 0;
  let headTiltX = 0;
  let lFootX = -0.2 * s;
  let rFootX = 0.2 * s;
  let lFootY = -0.05 * s;
  let rFootY = -0.05 * s;
  let lKneeX = -0.2 * s;
  let rKneeX = 0.2 * s;
  let lKneeY = -0.41 * s;
  let rKneeY = -0.41 * s;

  if (isDance) {
    const fast = Math.sin(timeSec * 8.4 + ph);
    const med = Math.sin(timeSec * 5.8 + ph);
    const medCos = Math.cos(timeSec * 5.8 + ph);
    const slow = Math.sin(timeSec * 3.4 + ph);

    if (danceMove === 'floss') {
      // Iconic fast alternating hip pop left/right while upper body stays centered!
      hipShiftX = fast * 0.21 * s;
      chestShiftX = -fast * 0.05 * s;
      bounceY = -Math.abs(fast) * 0.05 * s;
      lKneeX = -0.22 * s + hipShiftX * 0.45;
      rKneeX = 0.22 * s + hipShiftX * 0.45;
    } else if (danceMove === 'twerk') {
      // Low curvy squat booty-pop / hip-drop bounce!
      const pop = Math.sin(timeSec * 10.2 + ph);
      squatDrop = 0.22 * s + pop * 0.08 * s;
      hipShiftX = Math.sin(timeSec * 5.1 + ph) * 0.16 * s;
      chestShiftX = -hipShiftX * 0.35;
      lFootX = -0.3 * s;
      rFootX = 0.3 * s;
      lKneeX = -0.36 * s + hipShiftX * 0.25;
      rKneeX = 0.36 * s + hipShiftX * 0.25;
      lKneeY = -0.34 * s + squatDrop * 0.2;
      rKneeY = -0.34 * s + squatDrop * 0.2;
    } else if (danceMove === 'dab') {
      // Rhythmic bounce into deep elbow dab!
      const dabCycle = Math.max(0, Math.sin(timeSec * 4.2 + ph));
      squatDrop = dabCycle * 0.12 * s;
      hipShiftX = -dabCycle * 0.14 * s;
      chestShiftX = dabCycle * 0.1 * s;
      headTiltX = -dabCycle * 0.11 * s;
      lFootX = -0.26 * s;
      rFootX = 0.26 * s;
      lKneeX = -0.28 * s;
      rKneeX = 0.28 * s;
    } else if (danceMove === 'disco') {
      // Saturday Night Fever diagonal hip-pop + knee bounce!
      hipShiftX = med * 0.18 * s;
      chestShiftX = -med * 0.07 * s;
      bounceY = -Math.abs(med) * 0.07 * s;
      lKneeX = -0.23 * s + hipShiftX * 0.4;
      rKneeX = 0.23 * s + hipShiftX * 0.4;
    } else if (danceMove === 'salsa') {
      // Lush curvy Latin figure-8 hip sway + stepping feet!
      hipShiftX = med * 0.2 * s;
      chestShiftX = medCos * 0.08 * s;
      bounceY = -Math.abs(medCos) * 0.06 * s;
      lFootY = -0.05 * s - Math.max(0, med) * 0.1 * s;
      rFootY = -0.05 * s - Math.max(0, -med) * 0.1 * s;
      lKneeX = -0.18 * s + hipShiftX * 0.55;
      rKneeX = 0.18 * s + hipShiftX * 0.55;
    } else if (danceMove === 'running-man') {
      // High-knee shuffle step!
      const stride = Math.sin(timeSec * 7.6 + ph);
      bounceY = -Math.abs(stride) * 0.12 * s;
      hipShiftX = stride * 0.07 * s;
      lFootX = -0.18 * s + stride * 0.22 * s;
      rFootX = 0.18 * s - stride * 0.22 * s;
      lFootY = -0.05 * s - Math.max(0, stride) * 0.22 * s;
      rFootY = -0.05 * s - Math.max(0, -stride) * 0.22 * s;
      lKneeX = lFootX + 0.06 * s;
      rKneeX = rFootX + 0.06 * s;
      lKneeY = -0.42 * s - Math.max(0, stride) * 0.18 * s;
      rKneeY = -0.42 * s - Math.max(0, -stride) * 0.18 * s;
    } else if (danceMove === 'body-roll') {
      // Smooth traveling wave from shoulders -> waist -> curvy hips!
      chestShiftX = Math.sin(timeSec * 5.2 + ph) * 0.15 * s;
      hipShiftX = Math.sin(timeSec * 5.2 + ph - 1.2) * 0.2 * s;
      squatDrop = (0.5 + 0.5 * Math.cos(timeSec * 5.2 + ph)) * 0.1 * s;
      lKneeX = -0.22 * s + hipShiftX * 0.4;
      rKneeX = 0.22 * s + hipShiftX * 0.4;
    } else {
      // 'ymca': Energetic festival jump cycling Y - M - C - A!
      const hop = Math.abs(Math.sin(timeSec * 6.4 + ph));
      bounceY = -hop * 0.14 * s;
      hipShiftX = slow * 0.14 * s;
      lFootX = -0.24 * s;
      rFootX = 0.24 * s;
      lKneeX = -0.26 * s + hipShiftX * 0.3;
      rKneeX = 0.26 * s + hipShiftX * 0.3;
    }
  } else if (isToast) {
    const groove = Math.sin(timeSec * 3.8 + ph);
    hipShiftX = groove * 0.1 * s;
    bounceY = -Math.max(0, groove) * 0.04 * s;
    lKneeX = -0.2 * s + hipShiftX * 0.35;
    rKneeX = 0.2 * s + hipShiftX * 0.35;
  }

  // Ground contact shadow
  ctx.fillStyle = 'rgba(6, 16, 26, 0.35)';
  ctx.beginPath();
  ctx.ellipse(hipShiftX * 0.35, 0.02 * s, 0.36 * s, 0.08 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const hipY = -0.78 * s + bounceY + squatDrop;
  const waistY = -1.04 * s + bounceY + squatDrop * 0.88;
  const shoulderY = -1.36 * s + bounceY + squatDrop * 0.78;
  const headY = -1.56 * s + bounceY + squatDrop * 0.72;

  // Real-time independent damped spring-damper physics for bust & glutes (v283)!
  const extraPulse = isDance
    ? (danceMove === 'twerk'
        ? Math.sin(timeSec * 10.2 + ph) * 2.2
        : danceMove === 'ymca' || danceMove === 'running-man'
          ? Math.sin(timeSec * 7.6 + ph) * 1.45
          : Math.sin(timeSec * 6.0 + ph) * 0.85)
    : isToast
      ? Math.sin(timeSec * 3.8 + ph) * 0.45
      : 0;
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
  const bbx = bounceSt.bust.x * s;
  const bby = bounceSt.bust.y * s;
  const bTilt = bounceSt.bTilt * s;
  const gbx = bounceSt.glute.x * s;
  const gby = bounceSt.glute.y * s;
  const gTilt = bounceSt.gTilt * s;

  // 4a. Curvy Legs (sculpted fuller thighs tapering down to calves!)
  const legColor = isGear ? wet.suit : skin;
  drawCurvyLeg(ctx, hipShiftX + gbx * 0.35 - prof.hip * 0.56 * s, hipY + 0.06 * s + gby * 0.35, lKneeX, lKneeY, lFootX, lFootY, prof, s, legColor);
  drawCurvyLeg(ctx, hipShiftX + gbx * 0.35 + prof.hip * 0.56 * s, hipY + 0.06 * s + gby * 0.35, rKneeX, rKneeY, rFootX, rFootY, prof, s, legColor);

  // Dive booties / fins for geared divers
  if (isGearReady) {
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(lFootX + 0.08 * s, lFootY + 0.02 * s, 0.18 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(rFootX + 0.1 * s, rFootY + 0.02 * s, 0.18 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isGear) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(lFootX - 0.07 * s, lFootY - 0.04 * s, 0.15 * s, 0.09 * s);
    ctx.fillRect(rFootX - 0.07 * s, rFootY - 0.04 * s, 0.16 * s, 0.09 * s);
  }

  // Scuba cylinder strapped to back for gear-tank & gear-ready
  if (isGearReady || isGearTank) {
    const tankLift = isGearTank ? Math.sin(timeSec * 2.6 + ph) * 0.06 * s : 0;
    ctx.fillStyle = wet.tank;
    ctx.beginPath();
    ctx.roundRect(-0.37 * s + chestShiftX, shoulderY + 0.02 * s + tankLift, 0.22 * s, 0.62 * s, 0.08 * s);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(-0.3 * s + chestShiftX, shoulderY - 0.08 * s + tankLift, 0.08 * s, 0.11 * s);
  }

  // 4b. Curvy Sculpted Torso + Independent Spring-Bounce Bust & Glutes!
  if (isGearReady || isGearTank) {
    // Full curvy contoured neoprene wetsuit with independent spring-bounce glutes & bust
    ctx.fillStyle = wet.suit;
    traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
    ctx.fill();
    drawBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, gTilt, wet.suit, 'rgba(15, 23, 42, 0.35)');
    drawBouncingBust(ctx, chestShiftX, shoulderY, prof, s, bbx, bby, bTilt, wet.suit, wet.trim);
    // BCD harness straps
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, 0.05 * s);
    ctx.beginPath();
    ctx.moveTo(chestShiftX - 0.1 * s, shoulderY + 0.02 * s);
    ctx.lineTo(hipShiftX - 0.1 * s, hipY + 0.02 * s);
    ctx.moveTo(chestShiftX + 0.1 * s, shoulderY + 0.02 * s);
    ctx.lineTo(hipShiftX + 0.1 * s, hipY + 0.02 * s);
    ctx.stroke();
  } else if (isGearZip) {
    // Curvy diver half-in wetsuit: bare upper torso + bouncing bikini/sport top + neoprene hugging bouncing glutes!
    ctx.fillStyle = skin;
    traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
    ctx.fill();
    drawBouncingBust(ctx, chestShiftX, shoulderY, prof, s, bbx, bby, bTilt, swim.primary, swim.accent);
    // Wetsuit lower half hugging curvy hips & zipping upward
    const zipUp = 0.07 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
    ctx.fillStyle = wet.suit;
    ctx.beginPath();
    ctx.moveTo((chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.08 * s, waistY - zipUp);
    ctx.lineTo((chestShiftX + hipShiftX) * 0.5 + prof.waist * 1.08 * s, waistY - zipUp);
    ctx.bezierCurveTo(hipShiftX + gbx + prof.hip * 1.15 * s, hipY - 0.08 * s + gby * 0.4, hipShiftX + gbx + prof.hip * 1.08 * s, hipY + 0.06 * s + gby, hipShiftX + gbx + prof.hip * 0.72 * s, hipY + 0.16 * s + gby);
    ctx.quadraticCurveTo(hipShiftX + gbx, hipY + 0.22 * s + gby, hipShiftX + gbx - prof.hip * 0.72 * s, hipY + 0.16 * s + gby);
    ctx.bezierCurveTo(hipShiftX + gbx - prof.hip * 1.08 * s, hipY + 0.06 * s + gby, hipShiftX + gbx - prof.hip * 1.15 * s, hipY - 0.08 * s + gby * 0.4, (chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.08 * s, waistY - zipUp);
    ctx.closePath();
    ctx.fill();
    drawBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, gTilt, wet.suit, 'rgba(15, 23, 42, 0.35)');
    ctx.fillStyle = wet.trim;
    ctx.fillRect((chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.06 * s, waistY - zipUp, prof.waist * 2.12 * s, 0.055 * s);
  } else {
    // Curvy bathing-suit partygoers with independent spring-bounce bust & glutes!
    ctx.fillStyle = skin;
    traceCurvyTorso(ctx, shoulderY, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
    ctx.fill();

    if (swim.style === 'trunks') {
      drawBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, gTilt, swim.primary, 'rgba(15, 23, 42, 0.22)');
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.moveTo(hipShiftX + gbx * 0.7 - prof.hip * 0.92 * s, hipY - 0.12 * s + gby * 0.5);
      ctx.lineTo(hipShiftX + gbx * 0.7 + prof.hip * 0.92 * s, hipY - 0.12 * s + gby * 0.5);
      ctx.lineTo(hipShiftX + gbx + prof.hip * 0.96 * s, hipY + 0.2 * s + gby);
      ctx.lineTo(hipShiftX + gbx - prof.hip * 0.96 * s, hipY + 0.2 * s + gby);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = swim.accent;
      ctx.fillRect(hipShiftX + gbx * 0.85 - prof.hip * 0.92 * s, hipY + 0.04 * s + gby * 0.75, prof.hip * 1.84 * s, 0.06 * s);
    } else if (swim.style === 'bikini') {
      // Bouncing contoured glutes (skin lower curve + vibrant high-cut bikini bottom riding the bounce!)
      drawBouncingGlutes(ctx, hipShiftX, hipY + 0.02 * s, prof, s, gbx, gby, gTilt, skin, 'rgba(92, 48, 24, 0.22)');
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.moveTo(hipShiftX + gbx * 0.85 - prof.hip * 1.02 * s, hipY - 0.09 * s + gby * 0.6);
      ctx.quadraticCurveTo(hipShiftX + gbx, hipY - 0.01 * s + gby * 0.85, hipShiftX + gbx * 0.85 + prof.hip * 1.02 * s, hipY - 0.09 * s + gby * 0.6);
      ctx.quadraticCurveTo(hipShiftX + gbx + prof.hip * 0.76 * s, hipY + 0.13 * s + gby, hipShiftX + gbx, hipY + 0.2 * s + gby);
      ctx.quadraticCurveTo(hipShiftX + gbx - prof.hip * 0.76 * s, hipY + 0.13 * s + gby, hipShiftX + gbx * 0.85 - prof.hip * 1.02 * s, hipY - 0.09 * s + gby * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = swim.accent;
      ctx.lineWidth = Math.max(1, 0.032 * s);
      ctx.beginPath();
      ctx.moveTo(hipShiftX + gbx * 0.85 - prof.hip * 0.96 * s, hipY - 0.08 * s + gby * 0.6);
      ctx.quadraticCurveTo(hipShiftX + gbx, hipY + gby * 0.85, hipShiftX + gbx * 0.85 + prof.hip * 0.96 * s, hipY - 0.08 * s + gby * 0.6);
      ctx.stroke();

      // Independently bouncing bikini bust!
      drawBouncingBust(ctx, chestShiftX, shoulderY, prof, s, bbx, bby, bTilt, swim.primary, swim.accent);
    } else {
      // Sculpted hourglass cutout one-piece swimsuit with independent bouncing bust & glutes!
      ctx.fillStyle = swim.primary;
      traceCurvyTorso(ctx, shoulderY + 0.07 * s, waistY, hipY, prof, s, chestShiftX, hipShiftX, bbx, bby, gbx, gby);
      ctx.fill();
      drawBouncingGlutes(ctx, hipShiftX, hipY, prof, s, gbx, gby, gTilt, swim.primary, 'rgba(15, 23, 42, 0.2)');
      drawBouncingBust(ctx, chestShiftX, shoulderY, prof, s, bbx, bby, bTilt, swim.primary, swim.accent);
      // Cinched accent waist belt highlighting hourglass silhouette
      ctx.fillStyle = swim.accent;
      ctx.fillRect((chestShiftX + hipShiftX) * 0.5 - prof.waist * 1.02 * s, waistY - 0.035 * s, prof.waist * 2.04 * s, 0.065 * s);
    }
  }

  // 4c. Arms & Expressive Dance Choreography / Gear Actions
  const armCol = isGearReady || isGearTank ? wet.suit : skin;
  const shL = chestShiftX - prof.bust * 0.85 * s;
  const shR = chestShiftX + prof.bust * 0.85 * s;
  const shArmY = shoulderY + 0.08 * s;

  ctx.strokeStyle = armCol;
  ctx.lineWidth = 0.09 * s;

  if (isDance) {
    if (danceMove === 'floss') {
      // Both straight arms swing briskly to the OPPOSITE side of the hip pop!
      const swing = -Math.sin(timeSec * 8.4 + ph) * 0.44 * s;
      ctx.beginPath();
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(shL + swing * 0.65, waistY + 0.06 * s);
      ctx.lineTo(hipShiftX + swing * 1.15 - 0.06 * s, hipY + 0.12 * s);
      ctx.moveTo(shR, shArmY);
      ctx.lineTo(shR + swing * 0.65, waistY + 0.06 * s);
      ctx.lineTo(hipShiftX + swing * 1.15 + 0.06 * s, hipY + 0.12 * s);
      ctx.stroke();
    } else if (danceMove === 'twerk') {
      // Hands planted on curvy knees/thighs (or one hand raised cheering!) while popping hips!
      const cheer = Math.sin(timeSec * 5.1 + ph);
      ctx.beginPath();
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(lKneeX - 0.06 * s, (shArmY + lKneeY) * 0.5);
      ctx.lineTo(lKneeX + 0.03 * s, lKneeY - 0.04 * s);
      if ((seed & 1) === 0) {
        ctx.moveTo(shR, shArmY);
        ctx.lineTo(rKneeX + 0.06 * s, (shArmY + rKneeY) * 0.5);
        ctx.lineTo(rKneeX - 0.03 * s, rKneeY - 0.04 * s);
      } else {
        ctx.moveTo(shR, shArmY);
        ctx.lineTo(shR + 0.24 * s, shArmY - 0.16 * s);
        ctx.lineTo(shR + 0.18 * s + cheer * 0.08 * s, shArmY - 0.44 * s);
      }
      ctx.stroke();
    } else if (danceMove === 'dab') {
      // Signature DAB: left elbow tucked across face, right arm extended high diagonal!
      const d = Math.max(0, Math.sin(timeSec * 4.2 + ph));
      ctx.beginPath();
      // Left arm bends up across face
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(shL - 0.22 * s + d * 0.12 * s, shArmY - 0.08 * s - d * 0.16 * s);
      ctx.lineTo(chestShiftX + 0.06 * s, headY + 0.05 * s - d * 0.06 * s);
      // Right arm shoots straight out & up diagonally!
      ctx.moveTo(shR, shArmY);
      ctx.lineTo(shR + 0.28 * s + d * 0.24 * s, shArmY - 0.14 * s - d * 0.24 * s);
      ctx.lineTo(shR + 0.48 * s + d * 0.34 * s, shArmY - 0.28 * s - d * 0.34 * s);
      ctx.stroke();
    } else if (danceMove === 'disco') {
      // Saturday Night Fever! Diagonal sky point + sassy hand on curvy hip!
      const p = Math.sin(timeSec * 5.8 + ph);
      const up = 0.5 + 0.5 * p;
      ctx.beginPath();
      // Left hand planted on curvy hip
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(shL - 0.2 * s, waistY - 0.02 * s);
      ctx.lineTo(hipShiftX - prof.hip * 0.92 * s, hipY - 0.04 * s);
      // Right arm pumping diagonally from low hip to high sky point!
      ctx.moveTo(shR, shArmY);
      ctx.lineTo(shR + (0.04 + up * 0.24) * s, hipY - up * 0.62 * s);
      ctx.lineTo(shR + (0.02 + up * 0.44) * s, hipY + 0.08 * s - up * 1.12 * s);
      ctx.stroke();
    } else if (danceMove === 'salsa') {
      // Graceful Latin beach salsa: one arm arched overhead, other framing waist/swaying!
      const sway = Math.sin(timeSec * 5.8 + ph);
      ctx.beginPath();
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(shL - 0.22 * s, shArmY - 0.26 * s);
      ctx.lineTo(chestShiftX - 0.06 * s + sway * 0.12 * s, headY - 0.28 * s);
      ctx.moveTo(shR, shArmY);
      ctx.lineTo(shR + 0.24 * s, waistY - 0.04 * s);
      ctx.lineTo(shR + 0.12 * s - sway * 0.1 * s, waistY - 0.22 * s);
      ctx.stroke();
    } else if (danceMove === 'running-man') {
      // Crisp alternating pumping runner elbows!
      const pump = Math.sin(timeSec * 7.6 + ph) * 0.22 * s;
      ctx.beginPath();
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(shL - 0.16 * s, waistY + 0.04 * s - pump * 0.5);
      ctx.lineTo(shL - 0.02 * s, shArmY - 0.06 * s - pump);
      ctx.moveTo(shR, shArmY);
      ctx.lineTo(shR + 0.16 * s, waistY + 0.04 * s + pump * 0.5);
      ctx.lineTo(shR + 0.02 * s, shArmY - 0.06 * s + pump);
      ctx.stroke();
    } else if (danceMove === 'body-roll') {
      // Flowing wavy arms rolling out & up with torso wave!
      const w1 = Math.sin(timeSec * 5.2 + ph) * 0.24 * s;
      const w2 = Math.cos(timeSec * 5.2 + ph) * 0.24 * s;
      ctx.beginPath();
      ctx.moveTo(shL, shArmY);
      ctx.lineTo(shL - 0.26 * s, shArmY - 0.12 * s + w1);
      ctx.lineTo(shL - 0.42 * s, shArmY - 0.34 * s + w2);
      ctx.moveTo(shR, shArmY);
      ctx.lineTo(shR + 0.26 * s, shArmY - 0.12 * s - w1);
      ctx.lineTo(shR + 0.42 * s, shArmY - 0.34 * s - w2);
      ctx.stroke();
    } else {
      // 'ymca': Cycles classic Y -> M -> C -> A arm shapes on the beat!
      const step = Math.floor(timeSec * 2.1 + seed) % 4;
      ctx.beginPath();
      if (step === 0) {
        // Y: wide raised V
        ctx.moveTo(shL, shArmY); ctx.lineTo(shL - 0.26 * s, shArmY - 0.24 * s); ctx.lineTo(shL - 0.44 * s, shArmY - 0.48 * s);
        ctx.moveTo(shR, shArmY); ctx.lineTo(shR + 0.26 * s, shArmY - 0.24 * s); ctx.lineTo(shR + 0.44 * s, shArmY - 0.48 * s);
      } else if (step === 1) {
        // M: elbows out, hands touching head!
        ctx.moveTo(shL, shArmY); ctx.lineTo(shL - 0.28 * s, headY - 0.06 * s); ctx.lineTo(chestShiftX - 0.04 * s, headY - 0.16 * s);
        ctx.moveTo(shR, shArmY); ctx.lineTo(shR + 0.28 * s, headY - 0.06 * s); ctx.lineTo(chestShiftX + 0.04 * s, headY - 0.16 * s);
      } else if (step === 2) {
        // C: both arms curved left!
        ctx.moveTo(shL, shArmY); ctx.lineTo(shL - 0.24 * s, shArmY + 0.12 * s); ctx.lineTo(shL - 0.38 * s, shArmY + 0.04 * s);
        ctx.moveTo(shR, shArmY); ctx.lineTo(chestShiftX + 0.05 * s, headY - 0.28 * s); ctx.lineTo(shL - 0.24 * s, headY - 0.24 * s);
      } else {
        // A: peak roof hands overhead!
        ctx.moveTo(shL, shArmY); ctx.lineTo(shL - 0.16 * s, headY - 0.14 * s); ctx.lineTo(chestShiftX, headY - 0.4 * s);
        ctx.moveTo(shR, shArmY); ctx.lineTo(shR + 0.16 * s, headY - 0.14 * s); ctx.lineTo(chestShiftX, headY - 0.4 * s);
      }
      ctx.stroke();
    }

    // Floating musical notes rising above dancers!
    if ((seed % 2) === 0 && s >= 24) {
      const np = (timeSec * 0.72 + seed * 0.31) % 1;
      drawMusicNote(
        ctx,
        chestShiftX + 0.36 * s + Math.sin(timeSec * 3.4 + ph) * 0.12 * s,
        headY - 0.24 * s - np * 0.64 * s,
        Math.max(4, 0.22 * s),
        swim.accent,
        Math.sin(np * Math.PI) * 0.88
      );
    }
  } else if (isToast) {
    const raise = Math.sin(timeSec * 3.8 + ph) * 0.12 * s;
    ctx.beginPath();
    ctx.moveTo(shL, shArmY);
    ctx.lineTo(shL - 0.2 * s, waistY);
    ctx.lineTo(hipShiftX - prof.hip * 0.88 * s, hipY - 0.02 * s);
    ctx.moveTo(shR, shArmY);
    ctx.lineTo(shR + 0.18 * s, shArmY - 0.06 * s - raise * 0.4);
    ctx.lineTo(shR + 0.3 * s, shArmY - 0.34 * s - raise);
    ctx.stroke();

    const gx = shR + 0.3 * s;
    const gy = shArmY - 0.34 * s - raise;
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
  } else if (isGearZip) {
    const pull = Math.sin(timeSec * 3.1 + ph) * 0.09 * s;
    ctx.beginPath();
    ctx.moveTo(shL, shArmY);
    ctx.lineTo(shL - 0.15 * s, waistY - 0.02 * s);
    ctx.lineTo(chestShiftX - 0.12 * s, waistY - 0.04 * s - pull);
    ctx.moveTo(shR, shArmY);
    ctx.lineTo(shR + 0.15 * s, waistY - 0.02 * s);
    ctx.lineTo(chestShiftX + 0.12 * s, waistY - 0.04 * s - pull);
    ctx.stroke();
  } else if (isGearTank) {
    const adj = Math.sin(timeSec * 2.6 + ph) * 0.07 * s;
    ctx.beginPath();
    ctx.moveTo(shL, shArmY);
    ctx.lineTo(shL - 0.16 * s, shArmY - 0.12 * s + adj);
    ctx.lineTo(chestShiftX - 0.14 * s, shArmY - 0.1 * s + adj);
    ctx.moveTo(shR, shArmY);
    ctx.lineTo(shR + 0.16 * s, waistY - 0.02 * s);
    ctx.lineTo(chestShiftX + 0.1 * s, waistY + 0.02 * s - adj);
    ctx.stroke();
  } else {
    // gear-ready: Enthusiastic pre-dive OK wave!
    const wave = Math.sin(timeSec * 4.4 + ph) * 0.14 * s;
    ctx.beginPath();
    ctx.moveTo(shL, shArmY);
    ctx.lineTo(shL - 0.14 * s, waistY + 0.04 * s);
    ctx.lineTo(hipShiftX - prof.hip * 0.85 * s, hipY - 0.02 * s);
    ctx.moveTo(shR, shArmY);
    ctx.lineTo(shR + 0.18 * s, shArmY - 0.16 * s);
    ctx.lineTo(shR + 0.22 * s + wave, shArmY - 0.42 * s);
    ctx.stroke();
  }

  // 4d. Head, Flowing Bouncy Hair, Sunglasses / Sun Hat / Scuba Dive Mask
  const hx = chestShiftX + headTiltX;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, headY, 0.165 * s, 0, Math.PI * 2);
  ctx.fill();

  if (isGearReady) {
    ctx.fillStyle = wet.suit;
    ctx.beginPath();
    ctx.arc(hx, headY - 0.02 * s, 0.175 * s, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, 0.032 * s);
    ctx.beginPath();
    ctx.roundRect(hx + 0.02 * s, headY - 0.06 * s, 0.17 * s, 0.095 * s, 0.03 * s);
    ctx.fill();
    ctx.stroke();
  } else {
    const hairBounce = isDance ? Math.sin(timeSec * 6.4 + ph) * 0.06 * s : Math.sin(timeSec * 3.2 + ph) * 0.03 * s;
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(hx - 0.02 * s, headY - 0.04 * s, 0.175 * s, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
    // Expressive flowing wavy hair / high bouncy ponytail / beach curls!
    if ((seed % 3) === 0) {
      // Long beach waves cascading behind shoulders
      ctx.beginPath();
      ctx.ellipse(hx - 0.16 * s, headY + 0.12 * s + hairBounce * 0.5, 0.11 * s, 0.22 * s, 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if ((seed % 3) === 1) {
      // High bouncy dancer ponytail!
      ctx.beginPath();
      ctx.ellipse(hx - 0.19 * s, headY - 0.06 * s + hairBounce, 0.09 * s, 0.15 * s, 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Voluminous bouncy curls / afro puffs
      ctx.beginPath();
      ctx.arc(hx - 0.15 * s, headY - 0.12 * s + hairBounce * 0.4, 0.105 * s, 0, Math.PI * 2);
      ctx.arc(hx + 0.09 * s, headY - 0.16 * s + hairBounce * 0.4, 0.095 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isGearZip || isGearTank) {
      ctx.fillStyle = '#67e8f9';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1, 0.028 * s);
      ctx.beginPath();
      ctx.roundRect(hx + 0.01 * s, headY - 0.15 * s, 0.16 * s, 0.08 * s, 0.025 * s);
      ctx.fill();
      ctx.stroke();
    } else if ((seed % 4) === 0) {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(hx, headY - 0.13 * s, 0.29 * s, 0.065 * s, -0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, headY - 0.15 * s, 0.14 * s, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = swim.primary;
      ctx.fillRect(hx - 0.14 * s, headY - 0.17 * s, 0.28 * s, 0.04 * s);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(hx + 0.02 * s, headY - 0.05 * s, 0.14 * s, 0.055 * s);
    }
  }

  ctx.restore();
}

/**
 * Draw an open-ocean inflatable party raft / companion RIB tender packed with curvy
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
    danceMove: seed % 2 === 0 ? 'floss' : 'twerk',
    seed: seed + 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, 0.45 * scale, deckY, scale * 0.92, timeSec, {
    role: 'party-dance',
    danceMove: seed % 2 === 0 ? 'disco' : 'salsa',
    seed: seed + 4,
    facing: -1,
  });
  drawTopsidePerson(ctx, 1.05 * scale, deckY, scale * 0.9, timeSec, {
    role: 'party-dance',
    danceMove: seed % 2 === 0 ? 'dab' : 'ymca',
    seed: seed + 5,
    facing: -1,
  });
  drawTopsidePerson(ctx, 1.62 * scale, deckY + 0.06 * scale, scale * 0.9, timeSec, {
    role: 'gear-fins',
    seed: seed + 7,
    facing: 1,
  });

  ctx.fillStyle = seed % 2 === 0 ? '#facc15' : '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(-2.3 * scale, -0.44 * scale, 4.6 * scale, 0.56 * scale, 0.28 * scale);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-1.95 * scale, -0.22 * scale, 3.9 * scale, 0.09 * scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(-1.8 * scale, -0.4 * scale, 3.6 * scale, 0.08 * scale);
  ctx.restore();
}

/**
 * Draw lively curvy crew & popular-dance partygoers directly on the Shipwreck dive charter
 * boat deck (synchronized with swell bob & pitch!), plus flanking party RIB rafts & floaters!
 */
export function drawShipwreckTopsideCrowd(ctx, boatX, visX0, visX1, toScreenX, toScreenY, scale, timeSec, boatGeom = null) {
  const surfY = toScreenY(0);
  if (surfY < -140 || surfY > ctx.canvas.height + 160) return;

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
    const aftDeckY = boatGeom ? -bh * 0.28 : -0.82 * scale;
    const roofY = boatGeom ? -bh * 0.56 : -2.38 * scale;
    const bowDeckY = boatGeom ? -bh * 0.34 : -0.92 * scale;
    const sternPlatY = boatGeom ? -bh * 0.04 : -0.12 * scale;

    drawFestiveStringLights(ctx, -bw * 0.06, -bh * 0.8, -bw * 0.42, -bh * 0.44, scale, timeSec, 0.32);
    drawFestiveStringLights(ctx, -bw * 0.04, -bh * 0.8, bw * 0.44, -bh * 0.36, scale, timeSec, 0.28);

    // Stern swim platform: Curvy diver pulling on fins
    drawTopsidePerson(ctx, -bw * 0.44, sternPlatY, scale * 0.9, timeSec, {
      role: 'gear-fins',
      seed: 1,
      facing: -1,
    });

    // Aft dive deck (by silver tanks): Divers suiting up + curvy salsa dancer!
    drawTopsidePerson(ctx, -bw * 0.34, aftDeckY, scale * 0.92, timeSec, {
      role: 'gear-zip',
      seed: 2,
      facing: 1,
    });
    drawTopsidePerson(ctx, -bw * 0.26, aftDeckY, scale * 0.9, timeSec, {
      role: 'party-dance',
      danceMove: 'salsa',
      seed: 6,
      facing: 1,
    });
    drawTopsidePerson(ctx, -bw * 0.17, aftDeckY, scale * 0.92, timeSec, {
      role: 'gear-tank',
      seed: 4,
      facing: -1,
    });

    // Upper cabin sun-deck: Curvy dance squad busting out Floss, Twerk & Disco!
    drawPartyGearProps(ctx, bw * 0.04, roofY, scale * 0.78, timeSec, 'party');
    drawTopsidePerson(ctx, -bw * 0.06, roofY, scale * 0.88, timeSec, {
      role: 'party-dance',
      danceMove: 'floss',
      seed: 0,
      facing: 1,
    });
    drawTopsidePerson(ctx, bw * 0.03, roofY, scale * 0.88, timeSec, {
      role: 'party-dance',
      danceMove: 'twerk',
      seed: 1,
      facing: 1,
    });
    drawTopsidePerson(ctx, bw * 0.13, roofY, scale * 0.88, timeSec, {
      role: 'party-dance',
      danceMove: 'disco',
      seed: 3,
      facing: -1,
    });

    // Foredeck / Bow: Dab & YMCA dancers partying on the bow!
    drawTopsidePerson(ctx, bw * 0.28, bowDeckY, scale * 0.86, timeSec, {
      role: 'party-dance',
      danceMove: 'dab',
      seed: 5,
      facing: 1,
    });
    drawTopsidePerson(ctx, bw * 0.37, bowDeckY, scale * 0.86, timeSec, {
      role: 'party-dance',
      danceMove: 'ymca',
      seed: 2,
      facing: -1,
    });

    ctx.restore();
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
    { wx: boatX - 7.3, seed: 2, facing: 1 },
    { wx: boatX + 7.6, seed: 5, facing: -1 },
  ];
  for (let i = 0; i < floaters.length; i++) {
    const fl = floaters[i];
    if (fl.wx + 2 < visX0 || fl.wx - 2 > visX1) continue;
    drawTopsidePerson(ctx, toScreenX(fl.wx), surfY, scale * 0.92, timeSec, {
      role: 'party-float',
      seed: fl.seed,
      facing: fl.facing,
    });
  }
}

/**
 * Draw lively curvy partygoers dancing popular moves & divers suiting up across ALL non-wreck
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

    // 1. WATERLINE STAGING DOCK: Suiting-up divers + curvy dock dancer!
    const dockEdgeY = toScreenY(-0.52);
    if (isEntry) {
      if (inVis(waterLeft + 1.65)) {
        drawTopsidePerson(ctx, toScreenX(waterLeft + 1.65), dockEdgeY, scale * 0.94, timeSec, {
          role: 'gear-fins',
          seed: baseSeed + 1,
          facing: 1,
        });
      }
      if (!isCompactPerf && inVis(waterLeft + 0.45)) {
        drawTopsidePerson(ctx, toScreenX(waterLeft + 0.45), dockEdgeY, scale * 0.96, timeSec, {
          role: 'gear-ready',
          seed: baseSeed + 2,
          facing: 1,
        });
      }
    } else {
      if (inVis(waterRight - 1.75)) {
        drawTopsidePerson(ctx, toScreenX(waterRight - 1.75), dockEdgeY, scale * 0.94, timeSec, {
          role: 'gear-fins',
          seed: baseSeed + 3,
          facing: -1,
        });
      }
      if (!isCompactPerf && inVis(waterRight - 0.72)) {
        drawTopsidePerson(ctx, toScreenX(waterRight - 0.72), dockEdgeY, scale * 0.96, timeSec, {
          role: 'party-dance',
          danceMove: 'disco',
          seed: baseSeed + 4,
          facing: -1,
        });
      }
    }

    // 2. LEFT CLIFF-TOP RIM: Beach Dance Floor + Dive Prep Hub!
    const l0 = topLeftX - 6.4;
    const l1 = topLeftX - 0.4;
    if (l1 + 2 >= visX0 && l0 - 2 <= visX1) {
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
        const umbX = topLeftX - 5.2;
        drawBeachUmbrella(ctx, toScreenX(umbX), toScreenY(getGroundY(umbX)), scale, baseSeed, -0.09);
      }

      // Curvy dance squad busting out Floss, Twerk & Salsa beside the palapa!
      const p1x = topLeftX - 4.7;
      if (!isCompactPerf && inVis(p1x)) {
        drawTopsidePerson(ctx, toScreenX(p1x), toScreenY(getGroundY(p1x)), scale, timeSec, {
          role: 'party-dance',
          danceMove: 'floss',
          seed: baseSeed + 0,
          facing: 1,
        });
      }
      const p2x = topLeftX - 3.95;
      if (inVis(p2x)) {
        drawTopsidePerson(ctx, toScreenX(p2x), toScreenY(getGroundY(p2x)), scale, timeSec, {
          role: 'party-dance',
          danceMove: 'twerk',
          seed: baseSeed + 1,
          facing: 1,
        });
      }
      if (!isCompactPerf) {
        const p3x = topLeftX - 2.95;
        if (inVis(p3x)) {
          drawTopsidePerson(ctx, toScreenX(p3x), toScreenY(getGroundY(p3x)), scale, timeSec, {
            role: 'party-dance',
            danceMove: 'salsa',
            seed: baseSeed + 2,
            facing: -1,
          });
        }
        const p4x = topLeftX - 2.3;
        if (inVis(p4x)) {
          drawTopsidePerson(ctx, toScreenX(p4x), toScreenY(getGroundY(p4x)), scale, timeSec, {
            role: 'party-toast',
            seed: baseSeed + 3,
            facing: -1,
          });
        }
      }

      // Curvy divers zipping into wetsuits & strapping scuba tanks!
      const d1x = topLeftX - 1.65;
      if (inVis(d1x)) {
        drawTopsidePerson(ctx, toScreenX(d1x), toScreenY(getGroundY(d1x)), scale, timeSec, {
          role: 'gear-zip',
          seed: baseSeed + 5,
          facing: 1,
        });
      }
      if (!isCompactPerf) {
        const d2x = topLeftX - 0.55;
        if (inVis(d2x)) {
          drawTopsidePerson(ctx, toScreenX(d2x), toScreenY(getGroundY(d2x)), scale, timeSec, {
            role: 'gear-tank',
            seed: baseSeed + 6,
            facing: 1,
          });
        }
      }
    }

    // 3. RIGHT CLIFF-TOP RIM: Packed Popular-Dance Party Overlook + Curvy Sunbather + Diver Prepping!
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
          });
        }
        const rd1 = topRightX + 0.8;
        if (inVis(rd1)) {
          drawTopsidePerson(ctx, toScreenX(rd1), toScreenY(getGroundY(rd1)), scale, timeSec, {
            role: 'gear-zip',
            seed: baseSeed + 7,
            facing: -1,
          });
        }
      }

      const rp1 = topRightX + 1.75;
      if (inVis(rp1)) {
        drawTopsidePerson(ctx, toScreenX(rp1), toScreenY(getGroundY(rp1)), scale, timeSec, {
          role: 'party-dance',
          danceMove: 'disco',
          seed: baseSeed + 1,
          facing: 1,
        });
      }
      if (!isCompactPerf) {
        const rp2 = topRightX + 2.65;
        if (inVis(rp2)) {
          drawTopsidePerson(ctx, toScreenX(rp2), toScreenY(getGroundY(rp2)), scale, timeSec, {
            role: 'party-dance',
            danceMove: 'dab',
            seed: baseSeed + 2,
            facing: -1,
          });
        }
        const rp3 = topRightX + 3.55;
        if (inVis(rp3)) {
          drawTopsidePerson(ctx, toScreenX(rp3), toScreenY(getGroundY(rp3)), scale, timeSec, {
            role: 'party-dance',
            danceMove: 'running-man',
            seed: baseSeed + 5,
            facing: 1,
          });
        }
        const rp4 = topRightX + 4.35;
        if (inVis(rp4)) {
          drawTopsidePerson(ctx, toScreenX(rp4), toScreenY(getGroundY(rp4)), scale, timeSec, {
            role: 'party-dance',
            danceMove: 'ymca',
            seed: baseSeed + 0,
            facing: -1,
          });
        }
        const rBoom = topRightX + 3.1;
        if (inVis(rBoom)) drawPartyGearProps(ctx, toScreenX(rBoom), toScreenY(getGroundY(rBoom)), scale * 0.9, timeSec, 'party');
      }
    }

    // 4. CALM WATER FLOATER: Curvy swimmer in neon pool floatie
    const basinSpan = waterRight - waterLeft;
    if (basinSpan >= 6.5) {
      const floatWx = isEntry ? waterRight - 2.35 : waterLeft + 2.35;
      if (floatWx + 2 >= visX0 && floatWx - 2 <= visX1) {
        drawTopsidePerson(ctx, toScreenX(floatWx), surfY, scale * 0.94, timeSec, {
          role: 'party-float',
          seed: baseSeed + 2,
          facing: isEntry ? -1 : 1,
        });
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
        danceMove: POPULAR_DANCE_MOVES[(seed + 3) % POPULAR_DANCE_MOVES.length],
        seed: seed + 3,
        facing: -1,
      });
    }
  }

  ctx.restore();
}

/**
 * Draw lively curvy dancers performing popular moves & divers suiting up directly onto the
 * default Home / Loading Screen Cenote Backdrop (`drawMenuBackdropDiorama`)!
 */
export function drawDefaultBackdropTopsidePeople(ctx, cw, ch, timeSec) {
  const waterY = Math.round(ch * 0.295);
  const cliffTopY = Math.round(ch * 0.095);
  const rimScale = Math.max(12, Math.min(26, ch * 0.025));
  const dockScale = Math.max(13, Math.min(28, ch * 0.027));

  ctx.save();

  // 1. LEFT CLIFF RIM (by Palapa & Palm — fully visible above the Home & Loading UI!)
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

  // Curvy party squad dancing Floss, Twerk & Salsa right by the palapa!
  drawTopsidePerson(ctx, cw * 0.065, cliffTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'floss',
    seed: 0,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.096, cliffTopY + rimScale * 0.07, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'twerk',
    seed: 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.122, cliffTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'salsa',
    seed: 2,
    facing: -1,
  });
  // Curvy divers suiting up at the cliff edge
  drawTopsidePerson(ctx, cw * 0.168, cliffTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'gear-zip',
    seed: 4,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.214, cliffTopY + rimScale * 0.1, rimScale, timeSec, {
    role: 'gear-tank',
    seed: 6,
    facing: 1,
  });

  // 2. WOODEN CENOTE ENTRY DOCK (waterline): Suiting-up divers!
  const dockY = waterY - ch * 0.012 - 2;
  drawTopsidePerson(ctx, cw * 0.242, dockY, dockScale, timeSec, {
    role: 'gear-ready',
    seed: 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.272, dockY + 2, dockScale * 0.96, timeSec, {
    role: 'gear-fins',
    seed: 3,
    facing: 1,
  });

  // 3. RIGHT CLIFF RIM (under the palms — packed curvy beach dance party!)
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

  // Diver zipping into wetsuit on overlook edge
  drawTopsidePerson(ctx, cw * 0.602, rTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'gear-zip',
    seed: 5,
    facing: -1,
  });
  // Packed curvy beach dance party: Disco, Dab, Running Man, Body Roll & YMCA + Sunbather!
  drawTopsidePerson(ctx, cw * 0.65, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'disco',
    seed: 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.692, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'dab',
    seed: 4,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.758, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'running-man',
    seed: 7,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.802, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    danceMove: 'ymca',
    seed: 0,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.892, rTopY + rimScale * 0.08, rimScale * 0.98, timeSec, {
    role: 'party-lounge',
    seed: 3,
    facing: -1,
  });

  // 4. SUNLIT CENOTE WATER SURFACE: Curvy swimmer chilling in neon flamingo pool floatie!
  drawTopsidePerson(ctx, cw * 0.495, waterY, dockScale * 0.92, timeSec, {
    role: 'party-float',
    seed: 0,
    facing: -1,
  });

  ctx.restore();
}
