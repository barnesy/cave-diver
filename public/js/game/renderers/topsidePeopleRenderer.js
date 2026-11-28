/**
 * Living Topside & Background Crowds Renderer (v281)
 * Populates every dive site topside, charter boat, cenote rim, staging dock,
 * and menu/loading backdrop with lively animated people in bathing suits and
 * diving gear — some suiting up (zipping wetsuits, strapping tanks, pulling on fins)
 * and some partying (dancing, toasting tropical drinks, lounging under umbrellas,
 * and floating in pool rings).
 *
 * Designed for crisp readability at 14–48 px/m and zero per-frame allocations /
 * zero gradients so the mobile 4x CPU < 15ms performance guard stays rock-solid.
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
  { primary: '#06b6d4', accent: '#f97316', style: 'trunks' },     // Turquoise boardshorts
  { primary: '#facc15', accent: '#ec4899', style: 'onepiece' },   // Sunny yellow one-piece
  { primary: '#f97316', accent: '#38bdf8', style: 'trunks' },     // Sunset orange trunks
  { primary: '#ec4899', accent: '#ffffff', style: 'bikini' },     // Hot pink bikini
  { primary: '#10b981', accent: '#fde047', style: 'onepiece' },   // Emerald one-piece
  { primary: '#38bdf8', accent: '#f43f5e', style: 'trunks' },     // Sky blue boardshorts
  { primary: '#a855f7', accent: '#67e8f9', style: 'bikini' },     // Violet-cyan bikini
]);

const WETSUIT_PALETTES = Object.freeze([
  { suit: '#1e293b', trim: '#38bdf8', tank: '#eab308', fin: '#facc15' },
  { suit: '#18181b', trim: '#f97316', tank: '#cbd5e1', fin: '#fb923c' },
  { suit: '#0f2942', trim: '#2dd4bf', tank: '#e2e8f0', fin: '#22d3ee' },
  { suit: '#1f2937', trim: '#ef4444', tank: '#facc15', fin: '#f87171' },
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

    // Alternating pennant flag & glowing party bulb
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

  // Pole
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(1.4, 0.065 * scale);
  ctx.beginPath();
  ctx.moveTo(0, 0.06 * scale);
  ctx.lineTo(0, -poleH);
  ctx.stroke();

  // Canopy dome
  ctx.fillStyle = pal[0];
  ctx.beginPath();
  ctx.moveTo(-canopyW, -poleH + canopyH);
  ctx.quadraticCurveTo(0, -poleH - canopyH * 0.65, canopyW, -poleH + canopyH);
  ctx.closePath();
  ctx.fill();

  // Alternating bright stripe wedges
  ctx.fillStyle = pal[1];
  ctx.beginPath();
  ctx.moveTo(-canopyW * 0.45, -poleH + canopyH);
  ctx.quadraticCurveTo(0, -poleH - canopyH * 0.52, canopyW * 0.45, -poleH + canopyH);
  ctx.closePath();
  ctx.fill();

  // Top finial
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
    // Ground contact shadow
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0.12 * scale, 0.02 * scale, 0.68 * scale, 0.1 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red & white tropical beverage cooler
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-0.52 * scale, -0.38 * scale, 0.56 * scale, 0.38 * scale);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-0.55 * scale, -0.45 * scale, 0.62 * scale, 0.1 * scale);

    // Pulsing portable boombox perched beside cooler
    const beat = Math.abs(Math.sin(timeSec * 6.4));
    const bx = 0.14 * scale;
    const by = -0.34 * scale;
    const bw = 0.54 * scale;
    const bh = 0.34 * scale;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, bw, bh);
    // Handle
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1.1, 0.045 * scale);
    ctx.strokeRect(bx + bw * 0.18, by - 0.11 * scale, bw * 0.64, 0.11 * scale);
    // Two speaker cones pulsing with beat
    const spR = (0.09 + beat * 0.022) * scale;
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

    // Floating music note rising from boombox
    const notePhase = (timeSec * 0.75) % 1;
    const ny = by - 0.18 * scale - notePhase * 0.95 * scale;
    const nx = bx + bw * 0.5 + Math.sin(timeSec * 3.2) * 0.16 * scale;
    const na = Math.sin(notePhase * Math.PI) * 0.92;
    drawMusicNote(ctx, nx, ny, Math.max(4.5, 0.26 * scale), '#fde047', na);
  } else {
    // Scuba tank prep rack & orange dive gear crate
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 0.02 * scale, 0.65 * scale, 0.09 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Two standing AL80 scuba cylinders (yellow & brushed silver)
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
    // Dive gear crate + pair of bright fins leaning beside it
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
 * Draw a single lively, readable topside person (standing ~1.68m tall in world meters)
 * anchored at feet/seat `(x, y)` in screen pixels.
 *
 * Supported roles:
 * - 'party-dance'  : Bathing suit reveler dancing with raised arms & rhythmic groove
 * - 'party-toast'  : Bathing suit partygoer holding/clinking a tropical umbrella drink
 * - 'party-lounge' : Bathing suit sunbather relaxing on a bright striped beach towel
 * - 'party-float'  : Bathing suit swimmer chilling in a colorful inflatable pool ring
 * - 'gear-zip'     : Diver half-in wetsuit (suit at waist or pulling chest zip over swimsuit)
 * - 'gear-fins'    : Seated diver on dock/transom pulling a colorful diving fin onto raised foot
 * - 'gear-tank'    : Diver strapping scuba tank / checking mask & regulator beside gear
 * - 'gear-ready'   : Fully suited scuba diver giving an enthusiastic pre-dive OK wave
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
  const ph = seed * 1.73;
  const hScale = 0.92 + (seed % 3) * 0.07; // subtle natural height variation

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * hScale, hScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Special Role: Floating in a colorful pool ring on the water surface
  if (role === 'party-float') {
    const fc = FLOAT_COLORS[seed % FLOAT_COLORS.length];
    const bob = Math.sin(timeSec * 2.2 + ph) * 0.06 * s;
    const waveArm = Math.sin(timeSec * 3.8 + ph) * 0.25;
    ctx.translate(0, bob);

    // Subtle water shadow
    ctx.fillStyle = 'rgba(4, 24, 38, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 0.1 * s, 0.62 * s, 0.14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back half of pool ring
    ctx.strokeStyle = fc.ring;
    ctx.lineWidth = 0.22 * s;
    ctx.beginPath();
    ctx.ellipse(0, -0.02 * s, 0.48 * s, 0.16 * s, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Torso in bathing suit leaning back comfortably in ring
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.roundRect(-0.17 * s, -0.52 * s, 0.34 * s, 0.42 * s, 0.1 * s);
    ctx.fill();
    // Swimsuit top
    ctx.fillStyle = swim.primary;
    ctx.fillRect(-0.17 * s, -0.44 * s, 0.34 * s, 0.18 * s);

    // Head + hair + sunglasses
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -0.68 * s, 0.16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(-0.02 * s, -0.73 * s, 0.16 * s, Math.PI * 0.9, Math.PI * 2.15);
    ctx.fill();
    // Sunglasses
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0.01 * s, -0.72 * s, 0.14 * s, 0.055 * s);

    // Arms: one draped on ring, one waving with a drink
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.095 * s;
    ctx.beginPath();
    ctx.moveTo(-0.15 * s, -0.44 * s);
    ctx.lineTo(-0.42 * s, -0.14 * s);
    ctx.moveTo(0.15 * s, -0.44 * s);
    ctx.lineTo(0.38 * s + waveArm * 0.18 * s, -0.74 * s);
    ctx.stroke();

    // Tropical drink cup in raised hand
    const hx = 0.38 * s + waveArm * 0.18 * s;
    const hy = -0.74 * s;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(hx - 0.055 * s, hy - 0.14 * s, 0.11 * s, 0.14 * s);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(hx - 0.04 * s, hy - 0.18 * s, 0.08 * s, 0.04 * s);

    // Front half of inflatable pool ring + bright white/gold stripe
    ctx.strokeStyle = fc.ring;
    ctx.lineWidth = 0.24 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0.01 * s, 0.5 * s, 0.17 * s, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = fc.stripe;
    ctx.lineWidth = 0.065 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0.03 * s, 0.22 * s, 0.16 * s, 0, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Special Role: Lounging on a bright striped beach towel
  if (role === 'party-lounge') {
    const kick = Math.sin(timeSec * 3.1 + ph) * 0.08 * s;
    // Beach towel
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.roundRect(-0.88 * s, -0.07 * s, 1.76 * s, 0.13 * s, 0.04 * s);
    ctx.fill();
    ctx.fillStyle = swim.accent;
    ctx.fillRect(-0.56 * s, -0.07 * s, 0.22 * s, 0.13 * s);
    ctx.fillRect(0.28 * s, -0.07 * s, 0.22 * s, 0.13 * s);

    // Legs stretched forward with relaxed animated knee/foot bob
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.13 * s;
    ctx.beginPath();
    ctx.moveTo(0.02 * s, -0.15 * s);
    ctx.lineTo(0.45 * s, -0.22 * s);
    ctx.lineTo(0.76 * s, -0.14 * s + kick);
    ctx.moveTo(0.0 * s, -0.12 * s);
    ctx.lineTo(0.42 * s, -0.11 * s);
    ctx.lineTo(0.74 * s, -0.09 * s - kick * 0.6);
    ctx.stroke();

    // Reclined torso propped on elbow
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.23 * s;
    ctx.beginPath();
    ctx.moveTo(-0.42 * s, -0.36 * s);
    ctx.lineTo(0.05 * s, -0.16 * s);
    ctx.stroke();
    // Swimsuit bottom & top
    ctx.fillStyle = swim.primary;
    ctx.beginPath();
    ctx.roundRect(-0.12 * s, -0.25 * s, 0.25 * s, 0.17 * s, 0.06 * s);
    ctx.fill();
    if (swim.style !== 'trunks') {
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.roundRect(-0.44 * s, -0.42 * s, 0.22 * s, 0.16 * s, 0.06 * s);
      ctx.fill();
    }

    // Propping arm + drink arm
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.09 * s;
    ctx.beginPath();
    ctx.moveTo(-0.4 * s, -0.36 * s);
    ctx.lineTo(-0.62 * s, -0.12 * s);
    ctx.moveTo(-0.34 * s, -0.35 * s);
    ctx.lineTo(-0.08 * s, -0.5 * s);
    ctx.stroke();
    // Cold drink in hand
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-0.12 * s, -0.62 * s, 0.09 * s, 0.13 * s);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1, 0.03 * s);
    ctx.beginPath();
    ctx.moveTo(-0.06 * s, -0.62 * s);
    ctx.lineTo(-0.02 * s, -0.71 * s);
    ctx.stroke();

    // Head + sun hat / sunglasses
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-0.56 * s, -0.56 * s, 0.15 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(-0.6 * s, -0.58 * s, 0.15 * s, Math.PI * 0.55, Math.PI * 1.85);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.54 * s, -0.6 * s, 0.13 * s, 0.055 * s);
    ctx.restore();
    return;
  }

  // Special Role: Seated on dock edge / boat transom putting on diving fins!
  if (role === 'gear-fins') {
    const tug = Math.sin(timeSec * 3.6 + ph) * 0.08 * s;
    const isFullSuit = (seed & 1) === 0;
    const topCol = isFullSuit ? wet.suit : swim.primary;
    const legCol = isFullSuit ? wet.suit : skin;

    // Seated contact shadow
    ctx.fillStyle = 'rgba(8, 18, 28, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-0.05 * s, 0.03 * s, 0.34 * s, 0.08 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scuba tank strapped on back!
    ctx.save();
    ctx.translate(-0.22 * s, -0.56 * s);
    ctx.rotate(0.24);
    ctx.fillStyle = wet.tank;
    ctx.beginPath();
    ctx.roundRect(-0.11 * s, -0.34 * s, 0.22 * s, 0.64 * s, 0.08 * s);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(-0.04 * s, -0.43 * s, 0.08 * s, 0.1 * s);
    ctx.restore();

    // Dangling back leg with fin already on!
    ctx.strokeStyle = legCol;
    ctx.lineWidth = 0.13 * s;
    ctx.beginPath();
    ctx.moveTo(0.02 * s, -0.14 * s);
    ctx.lineTo(0.26 * s, 0.04 * s);
    ctx.lineTo(0.28 * s, 0.42 * s);
    ctx.stroke();
    // Already-fitted diving fin on dangling foot
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(0.42 * s, 0.46 * s, 0.22 * s, 0.065 * s, 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Raised leg while pulling on second diving fin!
    ctx.strokeStyle = legCol;
    ctx.lineWidth = 0.13 * s;
    ctx.beginPath();
    ctx.moveTo(0.02 * s, -0.16 * s);
    ctx.lineTo(0.32 * s, -0.34 * s + tug * 0.4);
    ctx.lineTo(0.56 * s, -0.18 * s + tug);
    ctx.stroke();
    // Second fin being tugged onto foot
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(0.68 * s + tug * 0.5, -0.16 * s + tug, 0.22 * s, 0.07 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Forward-leaning torso (wetsuit or bright swimwear)
    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.roundRect(-0.18 * s, -0.78 * s, 0.34 * s, 0.64 * s, 0.11 * s);
    ctx.fill();
    if (isFullSuit) {
      ctx.fillStyle = wet.trim;
      ctx.fillRect(-0.02 * s, -0.72 * s, 0.16 * s, 0.12 * s);
    }

    // Both arms reaching down to pull the fin strap!
    ctx.strokeStyle = isFullSuit ? wet.suit : skin;
    ctx.lineWidth = 0.1 * s;
    ctx.beginPath();
    ctx.moveTo(0.08 * s, -0.66 * s);
    ctx.lineTo(0.34 * s, -0.44 * s + tug * 0.4);
    ctx.lineTo(0.56 * s + tug * 0.3, -0.22 * s + tug);
    ctx.stroke();

    // Head + dive mask perched on forehead
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0.04 * s, -0.94 * s, 0.16 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0.01 * s, -0.99 * s, 0.16 * s, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    // Cyan dive mask resting on forehead
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, 0.03 * s);
    ctx.beginPath();
    ctx.roundRect(0.04 * s, -1.07 * s, 0.17 * s, 0.095 * s, 0.03 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Standing / Dancing / Gearing-Up Articulated Human Figure (~1.68m tall)
  const isDance = role === 'party-dance';
  const isToast = role === 'party-toast';
  const isGearZip = role === 'gear-zip';
  const isGearTank = role === 'gear-tank';
  const isGearReady = role === 'gear-ready';
  const isGear = isGearZip || isGearTank || isGearReady;

  const beat = Math.sin(timeSec * (isDance ? 6.2 : 3.2) + ph);
  const beat2 = Math.cos(timeSec * (isDance ? 3.1 : 1.8) + ph);
  const bounceY = isDance ? -Math.abs(beat) * 0.11 * s : isToast ? -Math.max(0, beat) * 0.04 * s : 0;
  const swayX = isDance ? beat2 * 0.08 * s : 0;

  // Ground contact shadow
  ctx.fillStyle = 'rgba(6, 16, 26, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 0.02 * s, 0.32 * s, 0.075 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const hipY = -0.78 * s + bounceY;
  const shoulderY = -1.34 * s + bounceY;
  const headY = -1.54 * s + bounceY;

  // 1. Legs (neoprene wetsuit legs for geared divers; sun-kissed legs + swimwear for partygoers!)
  const legColor = isGear ? wet.suit : skin;
  const kneeL = isDance ? Math.max(0, beat) * 0.09 * s : 0;
  const kneeR = isDance ? Math.max(0, -beat) * 0.09 * s : 0;

  ctx.strokeStyle = legColor;
  ctx.lineWidth = 0.135 * s;
  ctx.beginPath();
  // Left leg
  ctx.moveTo(-0.11 * s + swayX * 0.4, hipY);
  ctx.lineTo(-0.17 * s + swayX * 0.2, -0.39 * s - kneeL * 0.5);
  ctx.lineTo(-0.19 * s, -0.05 * s - kneeL);
  // Right leg
  ctx.moveTo(0.11 * s + swayX * 0.4, hipY);
  ctx.lineTo(0.17 * s + swayX * 0.2, -0.39 * s - kneeR * 0.5);
  ctx.lineTo(0.2 * s, -0.05 * s - kneeR);
  ctx.stroke();

  // Dive booties / fins on feet for geared divers
  if (isGearReady) {
    ctx.fillStyle = wet.fin;
    ctx.beginPath();
    ctx.ellipse(-0.12 * s, -0.03 * s, 0.18 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(0.3 * s, -0.03 * s, 0.18 * s, 0.055 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isGear) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.26 * s, -0.09 * s, 0.15 * s, 0.09 * s);
    ctx.fillRect(0.13 * s, -0.09 * s, 0.17 * s, 0.09 * s);
  }

  // Scuba cylinder strapped to back for gear-tank & gear-ready!
  if (isGearReady || isGearTank) {
    const tankLift = isGearTank ? Math.sin(timeSec * 2.6 + ph) * 0.06 * s : 0;
    ctx.fillStyle = wet.tank;
    ctx.beginPath();
    ctx.roundRect(-0.34 * s + swayX * 0.6, shoulderY + 0.02 * s + tankLift, 0.22 * s, 0.62 * s, 0.08 * s);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(-0.27 * s + swayX * 0.6, shoulderY - 0.08 * s + tankLift, 0.08 * s, 0.11 * s);
  }

  // 2. Torso & Outfit (Bathing Suits vs Half-On Wetsuit vs Full Diving Gear)
  ctx.save();
  ctx.translate(swayX, 0);
  if (isGearReady || isGearTank) {
    // Full neoprene wetsuit with bright chest/shoulder trim
    ctx.fillStyle = wet.suit;
    ctx.beginPath();
    ctx.roundRect(-0.19 * s, shoulderY, 0.38 * s, 0.6 * s, 0.11 * s);
    ctx.fill();
    ctx.fillStyle = wet.trim;
    ctx.fillRect(-0.18 * s, shoulderY + 0.08 * s, 0.36 * s, 0.13 * s);
    // BCD harness straps across chest
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, 0.055 * s);
    ctx.beginPath();
    ctx.moveTo(-0.11 * s, shoulderY + 0.03 * s);
    ctx.lineTo(-0.11 * s, hipY + 0.03 * s);
    ctx.moveTo(0.11 * s, shoulderY + 0.03 * s);
    ctx.lineTo(0.11 * s, hipY + 0.03 * s);
    ctx.stroke();
  } else if (isGearZip) {
    // Half-in wetsuit! Bare shoulders / bright swimwear upper torso, wetsuit pulled up to waist with hanging sleeves!
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.roundRect(-0.18 * s, shoulderY, 0.36 * s, 0.6 * s, 0.11 * s);
    ctx.fill();
    // Bright swimsuit top or rashguard peeks out above half-pulled wetsuit
    ctx.fillStyle = swim.primary;
    ctx.fillRect(-0.17 * s, shoulderY + 0.1 * s, 0.34 * s, 0.14 * s);
    // Wetsuit waist & lower half rolled/zipping up
    const zipUp = 0.06 * s * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + ph));
    ctx.fillStyle = wet.suit;
    ctx.beginPath();
    ctx.roundRect(-0.2 * s, hipY - 0.24 * s - zipUp, 0.4 * s, 0.32 * s + zipUp, 0.08 * s);
    ctx.fill();
    ctx.fillStyle = wet.trim;
    ctx.fillRect(-0.2 * s, hipY - 0.24 * s - zipUp, 0.4 * s, 0.065 * s);
  } else {
    // Bathing suit partygoers!
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.roundRect(-0.18 * s, shoulderY, 0.36 * s, 0.6 * s, 0.11 * s);
    ctx.fill();
    if (swim.style === 'trunks') {
      // Bright patterned boardshorts
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.roundRect(-0.2 * s, hipY - 0.11 * s, 0.4 * s, 0.31 * s, 0.06 * s);
      ctx.fill();
      ctx.fillStyle = swim.accent;
      ctx.fillRect(-0.2 * s, hipY + 0.05 * s, 0.4 * s, 0.065 * s);
    } else if (swim.style === 'bikini') {
      // Vibrant two-piece bikini top + bottom
      ctx.fillStyle = swim.primary;
      ctx.fillRect(-0.18 * s, shoulderY + 0.11 * s, 0.36 * s, 0.13 * s);
      ctx.beginPath();
      ctx.moveTo(-0.19 * s, hipY - 0.06 * s);
      ctx.lineTo(0.19 * s, hipY - 0.06 * s);
      ctx.lineTo(0.11 * s, hipY + 0.14 * s);
      ctx.lineTo(-0.11 * s, hipY + 0.14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = swim.accent;
      ctx.fillRect(-0.18 * s, shoulderY + 0.11 * s, 0.36 * s, 0.035 * s);
    } else {
      // Vibrant one-piece swimsuit with racing stripe
      ctx.fillStyle = swim.primary;
      ctx.beginPath();
      ctx.roundRect(-0.18 * s, shoulderY + 0.07 * s, 0.36 * s, 0.56 * s, 0.09 * s);
      ctx.fill();
      ctx.fillStyle = swim.accent;
      ctx.fillRect(-0.18 * s, shoulderY + 0.28 * s, 0.36 * s, 0.07 * s);
    }
  }

  // 3. Arms & Interactive Props
  const armCol = isGearReady || isGearTank ? wet.suit : skin;
  ctx.strokeStyle = armCol;
  ctx.lineWidth = 0.095 * s;

  if (isDance) {
    // Both arms pumping joyfully overhead in sync with beat!
    const lUp = Math.sin(timeSec * 6.2 + ph) * 0.24 * s;
    const rUp = Math.sin(timeSec * 6.2 + ph + Math.PI) * 0.24 * s;
    ctx.beginPath();
    ctx.moveTo(-0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(-0.36 * s, shoulderY - 0.1 * s + lUp * 0.5);
    ctx.lineTo(-0.28 * s, shoulderY - 0.42 * s + lUp);
    ctx.moveTo(0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(0.36 * s, shoulderY - 0.1 * s + rUp * 0.5);
    ctx.lineTo(0.3 * s, shoulderY - 0.44 * s + rUp);
    ctx.stroke();

    // Tiny floating music note above dancing partygoer
    if ((seed & 1) === 0) {
      const np = (timeSec * 0.65 + seed * 0.31) % 1;
      drawMusicNote(
        ctx,
        0.34 * s + Math.sin(timeSec * 3.1 + ph) * 0.12 * s,
        headY - 0.26 * s - np * 0.62 * s,
        Math.max(4, 0.22 * s),
        swim.accent,
        Math.sin(np * Math.PI) * 0.85
      );
    }
  } else if (isToast) {
    // One hand on hip, other arm raising a festive tropical cocktail to toast!
    const raise = Math.sin(timeSec * 3.2 + ph) * 0.12 * s;
    ctx.beginPath();
    ctx.moveTo(-0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(-0.32 * s, shoulderY + 0.28 * s);
    ctx.lineTo(-0.18 * s, hipY - 0.02 * s);
    ctx.moveTo(0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(0.34 * s, shoulderY - 0.04 * s - raise * 0.4);
    ctx.lineTo(0.46 * s, shoulderY - 0.3 * s - raise);
    ctx.stroke();

    // Tropical drink glass + mini umbrella in raised hand
    const gx = 0.46 * s;
    const gy = shoulderY - 0.3 * s - raise;
    ctx.fillStyle = seed % 2 === 0 ? '#fb7185' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(gx - 0.08 * s, gy - 0.17 * s);
    ctx.lineTo(gx + 0.08 * s, gy - 0.17 * s);
    ctx.lineTo(gx + 0.04 * s, gy);
    ctx.lineTo(gx - 0.04 * s, gy);
    ctx.closePath();
    ctx.fill();
    // Little bright cocktail umbrella on rim
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(gx + 0.05 * s, gy - 0.2 * s, 0.08 * s, Math.PI, 0);
    ctx.fill();
  } else if (isGearZip) {
    // Hands pulling up wetsuit waist/chest zip!
    const pull = Math.sin(timeSec * 3.1 + ph) * 0.09 * s;
    ctx.beginPath();
    ctx.moveTo(-0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(-0.3 * s, shoulderY + 0.26 * s);
    ctx.lineTo(-0.14 * s, hipY - 0.18 * s - pull);
    ctx.moveTo(0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(0.3 * s, shoulderY + 0.26 * s);
    ctx.lineTo(0.14 * s, hipY - 0.18 * s - pull);
    ctx.stroke();
  } else if (isGearTank) {
    // Reaching back/across shoulders to tighten BCD & tank straps
    const adj = Math.sin(timeSec * 2.6 + ph) * 0.07 * s;
    ctx.beginPath();
    ctx.moveTo(-0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(-0.32 * s, shoulderY - 0.08 * s + adj);
    ctx.lineTo(-0.16 * s, shoulderY - 0.06 * s + adj);
    ctx.moveTo(0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(0.32 * s, shoulderY + 0.22 * s);
    ctx.lineTo(0.12 * s, shoulderY + 0.25 * s - adj);
    ctx.stroke();
  } else {
    // gear-ready: Enthusiastic pre-dive wave / OK sign!
    const wave = Math.sin(timeSec * 4.4 + ph) * 0.14 * s;
    ctx.beginPath();
    ctx.moveTo(-0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(-0.24 * s, hipY - 0.04 * s);
    ctx.moveTo(0.18 * s, shoulderY + 0.08 * s);
    ctx.lineTo(0.34 * s, shoulderY - 0.14 * s);
    ctx.lineTo(0.38 * s + wave, shoulderY - 0.4 * s);
    ctx.stroke();
  }

  // 4. Head, Hair, Sunglasses / Sun Hat / Scuba Dive Mask
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, headY, 0.165 * s, 0, Math.PI * 2);
  ctx.fill();

  if (isGearReady) {
    // Neoprene dive hood + glowing cyan scuba mask over eyes
    ctx.fillStyle = wet.suit;
    ctx.beginPath();
    ctx.arc(0, headY - 0.02 * s, 0.175 * s, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, 0.032 * s);
    ctx.beginPath();
    ctx.roundRect(0.02 * s, headY - 0.06 * s, 0.17 * s, 0.095 * s, 0.03 * s);
    ctx.fill();
    ctx.stroke();
  } else {
    // Expressive hair + optional ponytail / sun hat
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(-0.02 * s, headY - 0.04 * s, 0.17 * s, Math.PI * 0.88, Math.PI * 2.12);
    ctx.fill();
    if (swim.style !== 'trunks' && !isGear) {
      // Cute swaying ponytail / bun
      const pony = Math.sin(timeSec * 5 + ph) * 0.05 * s;
      ctx.beginPath();
      ctx.ellipse(-0.19 * s, headY - 0.02 * s + pony, 0.08 * s, 0.11 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isGearZip || isGearTank) {
      // Dive mask resting on forehead ready to pull down!
      ctx.fillStyle = '#67e8f9';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1, 0.028 * s);
      ctx.beginPath();
      ctx.roundRect(0.01 * s, headY - 0.15 * s, 0.16 * s, 0.08 * s, 0.025 * s);
      ctx.fill();
      ctx.stroke();
    } else if ((seed % 3) === 0) {
      // Festive straw sun hat on some partygoers!
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(0, headY - 0.13 * s, 0.29 * s, 0.065 * s, -0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, headY - 0.15 * s, 0.14 * s, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = swim.primary;
      ctx.fillRect(-0.14 * s, headY - 0.17 * s, 0.28 * s, 0.04 * s);
    } else {
      // Stylish dark sunglasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0.02 * s, headY - 0.05 * s, 0.14 * s, 0.055 * s);
    }
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Draw an open-ocean inflatable party raft / companion RIB tender with swimwear partygoers
 * and a diver suiting up (keeps Shipwreck topsides lively across the entire wide screen!).
 */
function drawCompanionPartyRaft(ctx, wx, toScreenX, toScreenY, scale, timeSec, seed = 0) {
  const bob = Math.sin(timeSec * 1.9 + seed * 1.7) * 0.11;
  const tilt = Math.sin(timeSec * 1.5 + seed * 2.1) * 0.032;
  const rx = toScreenX(wx);
  const ry = toScreenY(bob);

  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(tilt);

  // Water reflection shadow
  ctx.fillStyle = 'rgba(4, 18, 34, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 0.22 * scale, 2.35 * scale, 0.22 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Deck people standing/sitting on the party RIB / floating cabana!
  const deckY = -0.34 * scale;
  drawBeachUmbrella(ctx, -1.25 * scale, deckY, scale * 0.88, seed + 1, -0.1);
  drawPartyGearProps(ctx, 0.05 * scale, deckY, scale * 0.85, timeSec, 'party');
  drawTopsidePerson(ctx, -0.78 * scale, deckY, scale * 0.92, timeSec, {
    role: 'party-dance',
    seed: seed + 2,
    facing: 1,
  });
  drawTopsidePerson(ctx, 0.62 * scale, deckY, scale * 0.92, timeSec, {
    role: 'party-toast',
    seed: seed + 5,
    facing: -1,
  });
  drawTopsidePerson(ctx, 1.52 * scale, deckY + 0.06 * scale, scale * 0.9, timeSec, {
    role: 'gear-fins',
    seed: seed + 7,
    facing: 1,
  });

  // Bright yellow/coral inflatable RIB pontoon hull
  ctx.fillStyle = seed % 2 === 0 ? '#facc15' : '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(-2.2 * scale, -0.44 * scale, 4.4 * scale, 0.56 * scale, 0.28 * scale);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-1.85 * scale, -0.22 * scale, 3.7 * scale, 0.09 * scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(-1.7 * scale, -0.4 * scale, 3.4 * scale, 0.08 * scale);
  ctx.restore();
}

/**
 * Draw lively crew & partygoers directly on the Shipwreck dive charter boat deck
 * (synchronized with the boat's exact swell bob & pitch!), plus companion party rafts
 * and floating swimmers flanking the wreck surface so the whole open-ocean topside shines!
 */
export function drawShipwreckTopsideCrowd(ctx, boatX, visX0, visX1, toScreenX, toScreenY, scale, timeSec, boatGeom = null) {
  const surfY = toScreenY(0);
  if (surfY < -140 || surfY > ctx.canvas.height + 160) return;

  // 1. Main Dive Charter Boat Deck Crew (synchronized with hull bobY & pitch)
  if (boatX + 12 >= visX0 && boatX - 12 <= visX1) {
    const bobY = Math.sin(timeSec * 1.7) * 0.14;
    const pitch = Math.sin(timeSec * 1.35 + 0.6) * 0.022;
    const bx = toScreenX(boatX);
    const by = toScreenY(bobY);

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(pitch);

    // Coordinate layout adapts to whether photo boat (bw = 12.2*scale) or procedural boat is rendered
    const bw = boatGeom?.bw || 12.2 * scale;
    const bh = boatGeom?.bh || 5.4 * scale;
    const aftDeckY = boatGeom ? -bh * 0.28 : -0.82 * scale;
    const roofY = boatGeom ? -bh * 0.56 : -2.38 * scale;
    const bowDeckY = boatGeom ? -bh * 0.34 : -0.92 * scale;
    const sternPlatY = boatGeom ? -bh * 0.04 : -0.12 * scale;

    // Overhead festive string lights draped from radar mast to stern & bow!
    drawFestiveStringLights(ctx, -bw * 0.06, -bh * 0.8, -bw * 0.42, -bh * 0.44, scale, timeSec, 0.32);
    drawFestiveStringLights(ctx, -bw * 0.04, -bh * 0.8, bw * 0.44, -bh * 0.36, scale, timeSec, 0.28);

    // Stern swim platform: Diver seated pulling on fins ready to giant-stride!
    drawTopsidePerson(ctx, -bw * 0.44, sternPlatY, scale * 0.9, timeSec, {
      role: 'gear-fins',
      seed: 1,
      facing: -1,
    });

    // Aft dive deck (by the silver scuba tank racks): Two divers suiting up + one reveler!
    drawTopsidePerson(ctx, -bw * 0.33, aftDeckY, scale * 0.92, timeSec, {
      role: 'gear-zip',
      seed: 2,
      facing: 1,
    });
    drawTopsidePerson(ctx, -bw * 0.18, aftDeckY, scale * 0.92, timeSec, {
      role: 'gear-tank',
      seed: 4,
      facing: -1,
    });
    drawTopsidePerson(ctx, -bw * 0.25, aftDeckY, scale * 0.88, timeSec, {
      role: 'party-toast',
      seed: 6,
      facing: 1,
    });

    // Upper cabin sun-deck: Bathing-suit party squad dancing & toasting with boombox!
    drawPartyGearProps(ctx, bw * 0.03, roofY, scale * 0.78, timeSec, 'party');
    drawTopsidePerson(ctx, -bw * 0.04, roofY, scale * 0.88, timeSec, {
      role: 'party-dance',
      seed: 0,
      facing: 1,
    });
    drawTopsidePerson(ctx, bw * 0.12, roofY, scale * 0.88, timeSec, {
      role: 'party-toast',
      seed: 3,
      facing: -1,
    });

    // Foredeck / Bow: Sunbather in bathing suit + cheering friend!
    drawTopsidePerson(ctx, bw * 0.31, bowDeckY, scale * 0.86, timeSec, {
      role: 'party-dance',
      seed: 5,
      facing: 1,
    });

    ctx.restore();
  }

  // 2. Flanking Companion Party Rafts & Floating Pool-Ring Swimmers (visible even around center Home UI!)
  const leftRaftX = boatX - 11.4;
  if (leftRaftX + 4 >= visX0 && leftRaftX - 4 <= visX1) {
    drawCompanionPartyRaft(ctx, leftRaftX, toScreenX, toScreenY, scale, timeSec, 0);
  }
  const rightRaftX = boatX + 11.8;
  if (rightRaftX + 4 >= visX0 && rightRaftX - 4 <= visX1) {
    drawCompanionPartyRaft(ctx, rightRaftX, toScreenX, toScreenY, scale, timeSec, 3);
  }

  // Cheerful swimmers relaxing in bright pool rings beside the charter & party rafts
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
 * Draw lively people in bathing suits & diving gear across ALL non-wreck site topsides
 * (Cenotes, Florida Springs, Nordic Fjords, Provence, Kalahari, Bahamas, Budapest, Sinai,
 * Greenland, Proving Grounds, etc.) — covering entry dock, left & right cliff rims,
 * exit celebration rim, calm water floaters, and long horizon spans!
 */
export function drawAllSiteTopsidePeople(renderer, ctx, visX0, visX1, toScreenX, toScreenY, scale, timeSec) {
  const level = renderer.level;
  if (!level) return;
  const surfY = toScreenY(0);
  if (surfY < -40 || surfY > ctx.canvas.height + 160) return;

  const style = level.theme?.surfaceStyle || '';
  if (level.isWreck || style === 'open-ocean-wreck') {
    // Shipwreck topside crowds are drawn synchronized with the dive boat in _drawWreckSurfaceBoat
    return;
  }

  const isCompactPerf = Boolean(renderer.isMobilePerf || ctx.canvas.width <= 540);
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

    // 1. WATERLINE STAGING DOCK: Diver putting on fins + fully geared buddy waving OK!
    const dockEdgeY = toScreenY(-0.52);
    if (isEntry) {
      const seatX = toScreenX(waterLeft + 1.65);
      drawTopsidePerson(ctx, seatX, dockEdgeY, scale * 0.94, timeSec, {
        role: 'gear-fins',
        seed: baseSeed + 1,
        facing: 1,
      });
      drawTopsidePerson(ctx, toScreenX(waterLeft + 0.55), dockEdgeY, scale * 0.96, timeSec, {
        role: 'gear-ready',
        seed: baseSeed + 2,
        facing: 1,
      });
    } else {
      // Exit dock welcome crew!
      drawTopsidePerson(ctx, toScreenX(waterRight - 1.75), dockEdgeY, scale * 0.94, timeSec, {
        role: 'gear-fins',
        seed: baseSeed + 3,
        facing: -1,
      });
      drawTopsidePerson(ctx, toScreenX(waterRight - 0.72), dockEdgeY, scale * 0.96, timeSec, {
        role: 'party-toast',
        seed: baseSeed + 4,
        facing: -1,
      });
    }

    // 2. LEFT CLIFF-TOP RIM: Festive Dive Prep & Beach Party Hub!
    const l0 = topLeftX - 5.8;
    const l1 = topLeftX - 0.5;
    if (l1 + 2 >= visX0 && l0 - 2 <= visX1) {
      if (!isCompactPerf) {
        // Festive overhead string lights between trees / palapa / dive station
        drawFestiveStringLights(
          ctx,
          toScreenX(topLeftX - 5.2),
          toScreenY(getGroundY(topLeftX - 5.2) - 2.4),
          toScreenX(topLeftX - 0.6),
          toScreenY(getGroundY(topLeftX - 0.6) - 2.3),
          scale,
          timeSec,
          0.48
        );
        const boomX = topLeftX - 3.35;
        drawPartyGearProps(ctx, toScreenX(boomX), toScreenY(getGroundY(boomX)), scale, timeSec, 'party');
        const rackX = topLeftX - 1.25;
        drawPartyGearProps(ctx, toScreenX(rackX), toScreenY(getGroundY(rackX)), scale, timeSec, 'gear');
      }

      // Beach umbrella
      const umbX = topLeftX - 4.7;
      drawBeachUmbrella(ctx, toScreenX(umbX), toScreenY(getGroundY(umbX)), scale, baseSeed, -0.09);

      // Partygoers in bright bathing suits dancing & toasting drinks
      const p1x = topLeftX - 4.25;
      drawTopsidePerson(ctx, toScreenX(p1x), toScreenY(getGroundY(p1x)), scale, timeSec, {
        role: 'party-dance',
        seed: baseSeed + 0,
        facing: 1,
      });
      if (!isCompactPerf) {
        const p2x = topLeftX - 2.65;
        drawTopsidePerson(ctx, toScreenX(p2x), toScreenY(getGroundY(p2x)), scale, timeSec, {
          role: 'party-toast',
          seed: baseSeed + 3,
          facing: -1,
        });
      }

      // Divers actively getting into wetsuit & strapping tank right beside the gear rack!
      const d1x = topLeftX - 1.85;
      drawTopsidePerson(ctx, toScreenX(d1x), toScreenY(getGroundY(d1x)), scale, timeSec, {
        role: 'gear-zip',
        seed: baseSeed + 5,
        facing: 1,
      });
      if (!isCompactPerf) {
        const d2x = topLeftX - 0.55;
        drawTopsidePerson(ctx, toScreenX(d2x), toScreenY(getGroundY(d2x)), scale, timeSec, {
          role: 'gear-tank',
          seed: baseSeed + 6,
          facing: 1,
        });
      }
    }

    // 3. RIGHT CLIFF-TOP RIM: Beach Overlook Party + Sunbather Lounge + Diver Prepping!
    const r0 = topRightX + 0.3;
    const r1 = topRightX + 6.4;
    if (r1 + 2 >= visX0 && r0 - 2 <= visX1) {
      if (!isCompactPerf) {
        drawFestiveStringLights(
          ctx,
          toScreenX(topRightX + 0.6),
          toScreenY(getGroundY(topRightX + 0.6) - 2.3),
          toScreenX(topRightX + 5.6),
          toScreenY(getGroundY(topRightX + 5.6) - 2.45),
          scale,
          timeSec,
          0.5
        );
      }

      // Beach umbrella & sunbather lounging in a bright swimsuit
      const rUmbX = topRightX + 4.45;
      drawBeachUmbrella(ctx, toScreenX(rUmbX), toScreenY(getGroundY(rUmbX)), scale, baseSeed + 2, 0.1);
      const lngX = topRightX + 4.9;
      drawTopsidePerson(ctx, toScreenX(lngX), toScreenY(getGroundY(lngX)), scale * 0.96, timeSec, {
        role: 'party-lounge',
        seed: baseSeed + 4,
        facing: -1,
      });

      // Diver gearing up near the rim + bathing-suit partygoers dancing & toasting!
      const rd1 = topRightX + 0.85;
      drawTopsidePerson(ctx, toScreenX(rd1), toScreenY(getGroundY(rd1)), scale, timeSec, {
        role: 'gear-zip',
        seed: baseSeed + 7,
        facing: -1,
      });
      const rp1 = topRightX + 2.05;
      drawTopsidePerson(ctx, toScreenX(rp1), toScreenY(getGroundY(rp1)), scale, timeSec, {
        role: 'party-dance',
        seed: baseSeed + 1,
        facing: -1,
      });
      if (!isCompactPerf) {
        const rp2 = topRightX + 3.15;
        drawTopsidePerson(ctx, toScreenX(rp2), toScreenY(getGroundY(rp2)), scale, timeSec, {
          role: 'party-toast',
          seed: baseSeed + 2,
          facing: -1,
        });
        const rBoom = topRightX + 2.6;
        drawPartyGearProps(ctx, toScreenX(rBoom), toScreenY(getGroundY(rBoom)), scale * 0.9, timeSec, 'party');
      }
    }

    // 4. CALM WATER FLOATER: Swimmer in bright bathing suit + neon pool ring on far side of basin
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

  // 5. DISTANT SURFACE OVERLOOK MINI-GROUPS along longer horizon spans away from main basins
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
      drawBeachUmbrella(ctx, toScreenX(gx - 0.8), toScreenY(getGroundY(gx - 0.8)), scale * 0.92, seed, -0.08);
      drawTopsidePerson(ctx, toScreenX(gx), gy, scale * 0.94, timeSec, {
        role: (seed & 1) === 0 ? 'party-dance' : 'party-toast',
        seed,
        facing: 1,
      });
      drawTopsidePerson(ctx, toScreenX(gx + 1.15), toScreenY(getGroundY(gx + 1.15)), scale * 0.94, timeSec, {
        role: (seed % 3) === 0 ? 'gear-zip' : 'party-dance',
        seed: seed + 3,
        facing: -1,
      });
    }
  }

  ctx.restore();
}

/**
 * Draw animated people in bathing suits & diving gear directly onto the default
 * Home / Loading Screen Cenote Backdrop (`drawMenuBackdropDiorama`), so even before
 * any level finishes baking, the topside cliffs, palapa, wooden dock, and sunlit pool
 * are bursting with beach partygoers & divers suiting up!
 */
export function drawDefaultBackdropTopsidePeople(ctx, cw, ch, timeSec) {
  const waterY = Math.round(ch * 0.295);
  const cliffTopY = Math.round(ch * 0.095);
  // Natural pixel scale proportional to viewport height so figures match palapa/palms/dock cleanly
  const rimScale = Math.max(12, Math.min(26, ch * 0.025));
  const dockScale = Math.max(13, Math.min(28, ch * 0.027));

  ctx.save();

  // 1. LEFT CLIFF RIM (by Palapa & Palm — fully visible above the Home & Loading UI!)
  drawFestiveStringLights(
    ctx,
    cw * 0.03,
    cliffTopY - rimScale * 2.1,
    cw * 0.225,
    cliffTopY - rimScale * 1.9,
    rimScale,
    timeSec,
    0.42
  );
  drawBeachUmbrella(ctx, cw * 0.055, cliffTopY + rimScale * 0.08, rimScale, 0, -0.09);
  drawPartyGearProps(ctx, cw * 0.135, cliffTopY + rimScale * 0.06, rimScale, timeSec, 'party');
  drawPartyGearProps(ctx, cw * 0.195, cliffTopY + rimScale * 0.08, rimScale, timeSec, 'gear');

  // Partygoers dancing & toasting in bathing suits beside the palapa
  drawTopsidePerson(ctx, cw * 0.075, cliffTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'party-dance',
    seed: 0,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.112, cliffTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-toast',
    seed: 2,
    facing: -1,
  });
  // Diver zipping into wetsuit & strapping tank at the cenote edge
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

  // 2. WOODEN CENOTE ENTRY DOCK (waterline): Diver putting on fins + ready buddy!
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

  // 3. RIGHT CLIFF RIM (under the palms — fully visible across top-right of screen!)
  const rTopY = cliffTopY - ch * 0.004;
  drawFestiveStringLights(
    ctx,
    cw * 0.585,
    rTopY - rimScale * 2.0,
    cw * 0.94,
    rTopY - rimScale * 2.1,
    rimScale,
    timeSec,
    0.45
  );
  drawBeachUmbrella(ctx, cw * 0.84, rTopY + rimScale * 0.06, rimScale, 2, 0.1);
  drawPartyGearProps(ctx, cw * 0.725, rTopY + rimScale * 0.06, rimScale, timeSec, 'party');

  // Diver gearing up on right overlook
  drawTopsidePerson(ctx, cw * 0.605, rTopY + rimScale * 0.08, rimScale, timeSec, {
    role: 'gear-zip',
    seed: 5,
    facing: -1,
  });
  // Bathing-suit party crowd dancing, toasting, and sunbathing on beach towel!
  drawTopsidePerson(ctx, cw * 0.665, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    seed: 1,
    facing: 1,
  });
  drawTopsidePerson(ctx, cw * 0.705, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-toast',
    seed: 4,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.775, rTopY + rimScale * 0.06, rimScale, timeSec, {
    role: 'party-dance',
    seed: 7,
    facing: -1,
  });
  drawTopsidePerson(ctx, cw * 0.875, rTopY + rimScale * 0.08, rimScale * 0.98, timeSec, {
    role: 'party-lounge',
    seed: 3,
    facing: -1,
  });

  // 4. SUNLIT CENOTE WATER SURFACE: Swimmer chilling in a bright flamingo-pink pool floatie!
  drawTopsidePerson(ctx, cw * 0.495, waterY, dockScale * 0.92, timeSec, {
    role: 'party-float',
    seed: 0,
    facing: -1,
  });

  ctx.restore();
}
