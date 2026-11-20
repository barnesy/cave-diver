/**
 * High-Fidelity Procedural Art & Pre-Baked Glow Stamps
 * Stylized Yucatan Cenote / Life Aquatic / Finding Dory aesthetic.
 */

function makeGlowStamp(colorInner, colorMid, size = 64) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const half = size * 0.5;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, colorInner);
  g.addColorStop(0.42, colorMid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function makeSiltWispStamp(size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const lobes = [
    [0.50, 0.50, 0.44, 'rgba(154, 138, 110, 0.52)', 'rgba(104, 92, 72, 0.22)'],
    [0.37, 0.43, 0.28, 'rgba(176, 160, 130, 0.48)', 'rgba(116, 102, 80, 0.16)'],
    [0.64, 0.47, 0.26, 'rgba(166, 150, 120, 0.46)', 'rgba(112, 99, 78, 0.15)'],
    [0.46, 0.62, 0.27, 'rgba(142, 127, 100, 0.44)', 'rgba(96, 85, 67, 0.16)'],
    [0.56, 0.34, 0.23, 'rgba(182, 166, 136, 0.38)', 'rgba(120, 106, 84, 0.12)'],
  ];
  for (const [lx, ly, lr, inner, mid] of lobes) {
    const cx = lx * size;
    const cy = ly * size;
    const r = lr * size;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.48, mid);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function makeVerticalBandStamp(width = 1, height = 64) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, 'rgba(56, 189, 248, 0)');
  g.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
  g.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  return c;
}

function makeRadialStamp(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const half = size * 0.5;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (let i = 0; i < stops.length; i++) {
    g.addColorStop(stops[i][0], stops[i][1]);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function createGlowStamps() {
  return {
    cyan: makeGlowStamp('rgba(186, 230, 253, 0.9)', 'rgba(56, 189, 248, 0.32)'),
    warm: makeGlowStamp('rgba(254, 243, 199, 0.85)', 'rgba(251, 191, 36, 0.25)'),
    magenta: makeGlowStamp('rgba(245, 208, 254, 0.85)', 'rgba(217, 70, 239, 0.28)'),
    emerald: makeGlowStamp('rgba(167, 243, 208, 0.85)', 'rgba(16, 185, 129, 0.28)'),
    silt: makeGlowStamp('rgba(164, 148, 118, 0.78)', 'rgba(112, 99, 78, 0.34)'),
    rustSilt: makeGlowStamp('rgba(186, 84, 30, 0.85)', 'rgba(124, 45, 18, 0.38)'),
    cutout: makeGlowStamp('rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 0.45)', 128),
    torchSpillCutout: makeRadialStamp(
      [
        [0, 'rgba(0,0,0,1)'],
        [0.45, 'rgba(0,0,0,0.88)'],
        [0.78, 'rgba(0,0,0,0.45)'],
        [1, 'rgba(0,0,0,0)'],
      ],
      160
    ),
    torchHotCutout: makeRadialStamp(
      [
        [0, 'rgba(0,0,0,1)'],
        [0.7, 'rgba(0,0,0,0.95)'],
        [1, 'rgba(0,0,0,0)'],
      ],
      128
    ),
    torchBeamScatter: makeRadialStamp(
      [
        [0, 'rgba(254, 249, 195, 0.32)'],
        [0.28, 'rgba(186, 230, 253, 0.18)'],
        [0.7, 'rgba(14, 165, 233, 0.065)'],
        [1, 'rgba(2, 132, 199, 0)'],
      ],
      160
    ),
    bandGlow: makeVerticalBandStamp(1, 64),
    siltWisp: makeSiltWispStamp(128),
  };
}

/**
 * Draws authentic Yucatan cenote & cave fishes:
 * - cavefish: Dama Blanca (Typhliasina pearsei) blind pearl-pink brotula
 * - catfish: Pale cenote catfish (Rhamdia guatemalensis) with sensory barbels
 * - cichlid: Mayan cichlid (Mayaheros urophthalmus) with vertical bars & tail ocellus
 * - molly: Yucatan sailfin molly (Poecilia velifera) with tall dotted sail dorsal fin
 */
export function drawStyledFish(ctx, f, sx, sy, scale, timeSec) {
  const ang = Math.atan2(f.vy, f.vx || 0.01);
  const facingLeft = (f.vx || 0) < 0;
  const sz = f.size * scale;
  const wag = Math.sin(timeSec * 12 + f.phase) * 0.34;
  const finFlutter = Math.sin(timeSec * 9 + f.phase * 1.3) * 0.22;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  if (facingLeft) ctx.scale(1, -1);

  if (f.kind === 'barracuda') {
    // Sleek silver pelagic Great Barracuda patrolling shipwreck superstructures
    ctx.save();
    ctx.translate(-sz * 1.15, 0);
    ctx.rotate(wag * 0.7);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz * 0.58, -sz * 0.38);
    ctx.lineTo(-sz * 0.32, 0);
    ctx.lineTo(-sz * 0.58, sz * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(sz * 1.35, 0);
    ctx.quadraticCurveTo(sz * 0.35, -sz * 0.24, -sz * 1.18, -sz * 0.08);
    ctx.lineTo(-sz * 1.18, sz * 0.08);
    ctx.quadraticCurveTo(sz * 0.35, sz * 0.24, sz * 1.35, 0);
    ctx.closePath();
    ctx.fill();
    // Counter-shaded silver-slate dorsal ridge
    ctx.fillStyle = 'rgba(71, 85, 105, 0.52)';
    ctx.beginPath();
    ctx.moveTo(sz * 1.3, -sz * 0.01);
    ctx.quadraticCurveTo(sz * 0.35, -sz * 0.24, -sz * 1.16, -sz * 0.08);
    ctx.lineTo(-sz * 1.16, 0);
    ctx.closePath();
    ctx.fill();

    // Characteristic dark chevron stripes along upper flank
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = Math.max(1, sz * 0.055);
    for (let k = -3; k <= 2; k++) {
      const bx = k * sz * 0.26;
      ctx.beginPath();
      ctx.moveTo(bx, -sz * 0.16);
      ctx.lineTo(bx - sz * 0.08, 0.04 * sz);
      ctx.stroke();
    }
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sz * 0.88, -sz * 0.05, Math.max(1.2, sz * 0.065), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(sz * 0.9, -sz * 0.05, Math.max(0.7, sz * 0.035), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (f.kind === 'cavefish') {
    // Dama Blanca (Typhliasina pearsei) - translucent pearl-pink eyeless cavefish
    ctx.fillStyle = 'rgba(252, 231, 243, 0.56)';
    ctx.strokeStyle = 'rgba(251, 182, 206, 0.72)';
    ctx.lineWidth = Math.max(1, sz * 0.08);
    ctx.beginPath();
    ctx.moveTo(sz * 0.95, 0);
    ctx.quadraticCurveTo(sz * 0.25, -sz * 0.44, -sz * 0.9, -sz * 0.16);
    ctx.lineTo(-sz * 1.38, -sz * 0.3 + wag * sz * 0.3);
    ctx.quadraticCurveTo(-sz * 1.18, 0, -sz * 1.38, sz * 0.3 + wag * sz * 0.3);
    ctx.lineTo(-sz * 0.9, sz * 0.16);
    ctx.quadraticCurveTo(sz * 0.25, sz * 0.44, sz * 0.95, 0);
    ctx.fill();
    ctx.stroke();

    // Delicate spine, rose-pink gill arch & blind sensory head pores (no eyes)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(sz * 0.42, 0);
    ctx.lineTo(-sz * 0.85, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251, 113, 133, 0.58)';
    ctx.beginPath();
    ctx.arc(sz * 0.34, sz * 0.04, sz * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (f.kind === 'catfish') {
    // Pale Cenote Catfish (Rhamdia guatemalensis) with whiskered barbels
    ctx.save();
    ctx.translate(-sz * 0.82, 0);
    ctx.rotate(wag * 0.85);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz * 0.68, -sz * 0.38);
    ctx.lineTo(-sz * 0.48, 0);
    ctx.lineTo(-sz * 0.68, sz * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(sz * 0.92, 0.05 * sz);
    ctx.bezierCurveTo(sz * 0.5, -sz * 0.4, -sz * 0.4, -sz * 0.34, -sz * 0.88, 0);
    ctx.bezierCurveTo(-sz * 0.4, sz * 0.32, sz * 0.5, sz * 0.36, sz * 0.92, 0.05 * sz);
    ctx.fill();

    // Sweeping maxillary sensory barbels
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = Math.max(1, sz * 0.06);
    ctx.beginPath();
    ctx.moveTo(sz * 0.86, 0.06 * sz);
    ctx.quadraticCurveTo(sz * 1.15, sz * 0.25, sz * 0.65, sz * 0.42);
    ctx.moveTo(sz * 0.82, -0.02 * sz);
    ctx.quadraticCurveTo(sz * 1.05, -sz * 0.14, sz * 0.68, -sz * 0.28);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(sz * 0.58, -sz * 0.08, Math.max(1, sz * 0.075), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Tail fin (rounded sailfin for molly, spade for Mayan cichlid)
  ctx.save();
  ctx.translate(-sz * 0.78, 0);
  ctx.rotate(wag);
  ctx.fillStyle = f.kind === 'cichlid' ? '#b45309' : f.stripe;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-sz * 0.45, -sz * 0.52, -sz * 0.72, -sz * 0.42);
  ctx.quadraticCurveTo(-sz * 0.5, 0, -sz * 0.72, sz * 0.42);
  ctx.quadraticCurveTo(-sz * 0.45, sz * 0.52, 0, 0);
  ctx.fill();
  ctx.restore();

  // Tall Sailfin Molly dorsal fin or cichlid ridge
  ctx.fillStyle = f.kind === 'molly' ? 'rgba(94, 234, 212, 0.85)' : 'rgba(202, 138, 4, 0.85)';
  ctx.beginPath();
  ctx.moveTo(sz * 0.18, -sz * 0.34);
  ctx.quadraticCurveTo(-sz * 0.2, f.kind === 'molly' ? -sz * 0.96 : -sz * 0.66, -sz * 0.62, -sz * 0.26);
  ctx.closePath();
  ctx.fill();

  // Sculpted two-tone body (zero per-frame gradient allocation)
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.moveTo(sz * 0.96, 0.04 * sz);
  ctx.bezierCurveTo(sz * 0.55, -sz * 0.58, -sz * 0.45, -sz * 0.5, -sz * 0.84, 0);
  ctx.bezierCurveTo(-sz * 0.45, sz * 0.5, sz * 0.55, sz * 0.55, sz * 0.96, 0.04 * sz);
  ctx.fill();
  ctx.fillStyle = f.kind === 'cichlid' ? 'rgba(251, 113, 133, 0.42)' : 'rgba(236, 254, 255, 0.45)';
  ctx.beginPath();
  ctx.moveTo(sz * 0.84, 0.08 * sz);
  ctx.quadraticCurveTo(sz * 0.1, sz * 0.46, -sz * 0.72, 0.04 * sz);
  ctx.quadraticCurveTo(sz * 0.1, sz * 0.18, sz * 0.84, 0.08 * sz);
  ctx.fill();

  if (f.kind === 'cichlid') {
    // Mayan cichlid dark vertical bars + dark tail ocellus spot
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.lineWidth = Math.max(1, sz * 0.11);
    for (let b = -2; b <= 1; b++) {
      const bx = b * sz * 0.22;
      ctx.beginPath();
      ctx.moveTo(bx, -sz * 0.36);
      ctx.lineTo(bx, sz * 0.34);
      ctx.stroke();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(-sz * 0.62, -sz * 0.05, Math.max(1.5, sz * 0.15), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-sz * 0.62, -sz * 0.05, Math.max(1, sz * 0.095), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Silver-gold iridescent dorsal glint on sailfin molly
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(1, sz * 0.09);
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, -sz * 0.24);
    ctx.quadraticCurveTo(-sz * 0.15, -sz * 0.15, -sz * 0.52, -sz * 0.1);
    ctx.stroke();
  }

  // Pectoral fin fluttering
  ctx.save();
  ctx.translate(sz * 0.12, sz * 0.16);
  ctx.rotate(finFlutter);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(-sz * 0.18, sz * 0.12, sz * 0.24, sz * 0.11, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Expressive eye with glint
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(sz * 0.56, -sz * 0.11, Math.max(1.5, sz * 0.15), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(sz * 0.59, -sz * 0.11, Math.max(1, sz * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sz * 0.62, -sz * 0.14, Math.max(0.6, sz * 0.038), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an authentic Mesoamerican freshwater cenote slider turtle (Trachemys venusta)
 * with crimson post-orbital ear stripe, webbed feet, and olive-gold scute rings.
 */
export function drawStyledTurtle(ctx, t, sx, sy, scale, timeSec) {
  const sz = 0.58 * scale;
  const facingLeft = Math.cos(t.angle) < 0;
  const paddle = Math.sin(timeSec * 3.4 + t.phase) * 0.42;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t.angle);
  if (facingLeft) ctx.scale(1, -1);

  // Far front webbed foot
  ctx.fillStyle = '#3f6212';
  ctx.save();
  ctx.translate(sz * 0.32, sz * 0.14);
  ctx.rotate(-paddle * 0.65);
  ctx.beginPath();
  ctx.ellipse(-sz * 0.04, sz * 0.28, sz * 0.15, sz * 0.3, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Hind webbed foot
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.ellipse(-sz * 0.68, sz * 0.22, sz * 0.16, sz * 0.22, 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Head & neck with orange/crimson cenote slider ear stripe
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.ellipse(sz * 0.82, 0.02 * sz, sz * 0.26, sz * 0.17, -0.06, 0, Math.PI * 2);
  ctx.fill();

  // Slider crimson-orange ear stripe
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = Math.max(1.5, sz * 0.075);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sz * 0.66, 0.02 * sz);
  ctx.lineTo(sz * 0.84, -0.01 * sz);
  ctx.stroke();

  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(sz * 0.92, -0.045 * sz, Math.max(2, sz * 0.072), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(sz * 0.94, -0.045 * sz, Math.max(1.2, sz * 0.045), 0, Math.PI * 2);
  ctx.fill();

  // Sculpted Domed Carapace Shell
  ctx.fillStyle = '#3f6212';
  ctx.beginPath();
  ctx.moveTo(sz * 0.65, 0.08 * sz);
  ctx.bezierCurveTo(sz * 0.45, -sz * 0.5, -sz * 0.48, -sz * 0.46, -sz * 0.82, 0.1 * sz);
  ctx.quadraticCurveTo(-sz * 0.1, sz * 0.28, sz * 0.65, 0.08 * sz);
  ctx.fill();

  // Warm yellow slider scute ocelli rings
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
  ctx.lineWidth = Math.max(1, sz * 0.035);
  for (let s = -1; s <= 1; s++) {
    ctx.beginPath();
    ctx.ellipse(s * sz * 0.24 - sz * 0.08, -sz * 0.14, sz * 0.13, sz * 0.085, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Near paddling front webbed foot
  ctx.fillStyle = '#65a30d';
  ctx.save();
  ctx.translate(sz * 0.34, sz * 0.18);
  ctx.rotate(paddle);
  ctx.beginPath();
  ctx.ellipse(-sz * 0.06, sz * 0.28, sz * 0.17, sz * 0.34, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/**
 * Draws authentic Yucatan halocline blind cave crustaceans:
 * - remipede: Xibalbanus tulumensis translucent multi-segmented swimmer with undulating paddles
 * - prawn: Creaseria morleyi eyeless white cave prawn with sweeping long antennae
 */
export function drawStyledRemipede(ctx, r, sx, sy, scale, timeSec) {
  const sz = r.size * scale;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(r.angle);

  if (r.kind === 'prawn') {
    // Translucent glass-white cave prawn with swept antennae
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.72)';
    ctx.lineWidth = Math.max(1, sz * 0.06);
    ctx.beginPath();
    ctx.moveTo(sz * 0.75, -sz * 0.06);
    ctx.quadraticCurveTo(sz * 1.45, -sz * 0.55, sz * 1.85, -sz * 0.25);
    ctx.moveTo(sz * 0.75, sz * 0.06);
    ctx.quadraticCurveTo(sz * 1.35, sz * 0.45, sz * 1.75, sz * 0.22);
    ctx.stroke();

    ctx.fillStyle = 'rgba(226, 232, 240, 0.52)';
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.lineWidth = Math.max(1, sz * 0.07);
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.72, sz * 0.26, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fine walking pereiopods
    for (let l = -2; l <= 2; l++) {
      const kick = Math.sin(timeSec * 6 + r.phase + l) * sz * 0.08;
      ctx.beginPath();
      ctx.moveTo(l * sz * 0.16, sz * 0.18);
      ctx.lineTo(l * sz * 0.16 + kick, sz * 0.48);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Xibalbanus blind cave remipede: graceful sinuous segmented trunk + feathery paddles
  const segCount = 10;
  const segStep = (sz * 1.9) / segCount;
  ctx.lineCap = 'round';

  // Paired long anterior antennae
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.7)';
  ctx.lineWidth = Math.max(1, sz * 0.05);
  ctx.beginPath();
  ctx.moveTo(sz * 0.95, 0);
  ctx.quadraticCurveTo(sz * 1.35, -sz * 0.35, sz * 1.55, -sz * 0.18);
  ctx.moveTo(sz * 0.95, 0);
  ctx.quadraticCurveTo(sz * 1.35, sz * 0.35, sz * 1.55, sz * 0.18);
  ctx.stroke();

  for (let s = 0; s < segCount; s++) {
    const x = sz * 0.85 - s * segStep;
    const wave = Math.sin(timeSec * 5.2 + r.phase - s * 0.55) * sz * 0.12;
    const w = sz * (0.16 - s * 0.008);

    // Delicate lateral swimming paddles
    const legSwing = Math.sin(timeSec * 8.5 + r.phase - s * 0.65) * sz * 0.14;
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)';
    ctx.lineWidth = Math.max(1, sz * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, wave);
    ctx.lineTo(x - legSwing, wave - w * 2.1);
    ctx.moveTo(x, wave);
    ctx.lineTo(x - legSwing, wave + w * 2.1);
    ctx.stroke();

    // Translucent ivory-gold body tergite
    ctx.fillStyle = s === 0 ? 'rgba(254, 243, 199, 0.85)' : 'rgba(253, 230, 138, 0.52)';
    ctx.beginPath();
    ctx.ellipse(x, wave, segStep * 0.62, w, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

const _rigGradByCtx = new WeakMap();

function _getRigGradients(ctx, u) {
  let ctxMap = _rigGradByCtx.get(ctx);
  if (!ctxMap) {
    ctxMap = new Map();
    _rigGradByCtx.set(ctx, ctxMap);
  }
  const uKey = Math.round(u * 2); // 0.5px quantization keeps crisp shading with high hit-rate
  let cached = ctxMap.get(uKey);
  if (cached) return cached;

  const q = uKey * 0.5 || 1;
  const suitGrad = ctx.createLinearGradient(0, -q * 0.4, 0, q * 0.45);
  suitGrad.addColorStop(0, '#1e293b');
  suitGrad.addColorStop(0.55, '#0f172a');
  suitGrad.addColorStop(1, '#020617');

  const tankGrad = ctx.createLinearGradient(0, -q * 0.62, 0, -q * 0.24);
  tankGrad.addColorStop(0, '#f8fafc');
  tankGrad.addColorStop(0.4, '#cbd5e1');
  tankGrad.addColorStop(1, '#64748b');

  const stageGrad = ctx.createLinearGradient(0, q * 0.24, 0, q * 0.52);
  stageGrad.addColorStop(0, '#e2e8f0');
  stageGrad.addColorStop(0.5, '#94a3b8');
  stageGrad.addColorStop(1, '#475569');

  const glassGrad = ctx.createLinearGradient(q * 0.5, -q * 0.2, q * 0.75, q * 0.06);
  glassGrad.addColorStop(0, '#cffafe');
  glassGrad.addColorStop(0.45, '#22d3ee');
  glassGrad.addColorStop(1, '#0e7490');

  cached = { suitGrad, tankGrad, stageGrad, glassGrad };
  if (ctxMap.size > 24) ctxMap.clear();
  ctxMap.set(uKey, cached);
  return cached;
}

/**
 * Draws the Life Aquatic / technical cave diver rig details (drysuit seam, Zissou accent,
 * brushed twinset or CCR rebreather shell, glass mask glint, optional torpedo DPV scooter).
 */
export function drawStyledDiverRig(ctx, u, scale, isPeer, rollScale, gearOpts = null) {
  const accent = isPeer ? '#fb923c' : '#ef4444'; // Classic Zissou red cap/accent vs buddy orange
  const trim = isPeer ? '#fdba74' : '#38bdf8';
  const { suitGrad, tankGrad, stageGrad, glassGrad } = _getRigGradients(ctx, u);
  const hasCcr = Boolean(gearOpts?.hasCcr);
  const hasDpv = Boolean(gearOpts?.hasDpv);
  const dpvActive = Boolean(gearOpts?.dpvActive);
  const dpvThrusting = Boolean(gearOpts?.dpvThrusting);
  const timeSec = gearOpts?.timeSec || 0;

  // Sculpted drysuit torso shell with shading
  ctx.fillStyle = suitGrad;
  ctx.beginPath();
  ctx.ellipse(-u * 0.22, u * 0.02, u * 0.72, u * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();

  // Harness webbing & chest D-ring highlight
  ctx.strokeStyle = trim;
  ctx.lineWidth = Math.max(1.3, u * 0.055);
  ctx.beginPath();
  ctx.moveTo(-u * 0.65, -u * 0.18);
  ctx.lineTo(u * 0.18, u * 0.18);
  ctx.stroke();

  if (hasCcr) {
    // Closed-Circuit Rebreather (CCR) back-mount yellow/graphite canister & corrugated breathing loop
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.roundRect(-u * 0.92, -u * 0.62, u * 1.18, u * 0.40, u * 0.14);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1.2, u * 0.045);
    ctx.stroke();
    // Graphite scrubber head cap & twin corrugated loop hoses arching over shoulder to mouthpiece
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-u * 0.88, -u * 0.62, u * 0.32, u * 0.40);
    ctx.fillRect(u * 0.06, -u * 0.62, u * 0.20, u * 0.40);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(2.2, u * 0.11);
    ctx.beginPath();
    ctx.moveTo(u * 0.18, -u * 0.42);
    ctx.quadraticCurveTo(u * 0.65, -u * 0.50, u * 0.70, u * 0.12);
    ctx.stroke();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1, u * 0.04);
    ctx.setLineDash([u * 0.08, u * 0.06]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Glowing green CCR PPO2 setpoint HUD LED on mouthpiece
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(u * 0.66, -u * 0.24, Math.max(1.5, u * 0.055), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Twin Backgas Cylinders (brushed aluminum metallic gradient)
    ctx.fillStyle = tankGrad;
    ctx.beginPath();
    ctx.roundRect(-u * 0.9, -u * 0.58, u * 1.15, u * 0.35, u * 0.15);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.stroke();

    // Specular streak & manifold valve
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-u * 0.8, -u * 0.53, u * 0.9, u * 0.05);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(u * 0.16, -u * 0.55, u * 0.15, u * 0.28);
    ctx.fillRect(-u * 0.66, -u * 0.58, u * 0.1, u * 0.35);
  }

  // Slung Stage Cylinder (Deco / Travel bottle) with color band
  ctx.fillStyle = stageGrad;
  ctx.beginPath();
  ctx.roundRect(-u * 0.58, u * 0.26, u * 0.9, u * 0.24, u * 0.11);
  ctx.fill();
  ctx.fillStyle = isPeer ? '#fb923c' : '#22c55e';
  ctx.fillRect(-u * 0.2, u * 0.26, u * 0.14, u * 0.24);

  // Hood / Helmet with subtle Zissou-inspired stripe accent & top rim catchlight
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(u * 0.44, -u * 0.02 * Math.sign(rollScale || 1), u * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(u * 0.40, -u * 0.14, u * 0.22, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.28)';
  ctx.lineWidth = Math.max(1, u * 0.032);
  ctx.beginPath();
  ctx.arc(u * 0.44, -u * 0.02 * Math.sign(rollScale || 1), u * 0.30, Math.PI * 1.15, Math.PI * 1.82);
  ctx.stroke();

  // Frameless Dive Mask with Cyan Glass Reflection & Curved Specular Glint
  ctx.fillStyle = '#083344';
  ctx.beginPath();
  ctx.roundRect(u * 0.50, -u * 0.2, u * 0.25, u * 0.26, u * 0.07);
  ctx.fill();
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.roundRect(u * 0.53, -u * 0.18, u * 0.20, u * 0.21, u * 0.05);
  ctx.fill();
  // Diagonal curved lens specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.moveTo(u * 0.56, -u * 0.155);
  ctx.quadraticCurveTo(u * 0.62, -u * 0.165, u * 0.685, -u * 0.125);
  ctx.lineTo(u * 0.655, -u * 0.095);
  ctx.quadraticCurveTo(u * 0.60, -u * 0.128, u * 0.555, -u * 0.12);
  ctx.closePath();
  ctx.fill();

  // Regulator 2nd Stage & Curved Long Hose
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(u * 0.68, u * 0.14, u * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = Math.max(1.5, u * 0.055);
  ctx.beginPath();
  ctx.moveTo(u * 0.2, -u * 0.38);
  ctx.quadraticCurveTo(u * 0.62, u * 0.42, u * 0.68, u * 0.14);
  ctx.stroke();

  // Torpedo DPV Underwater Scooter gripped ahead of diver when equipped
  if (hasDpv) {
    ctx.save();
    ctx.translate(u * 1.18, u * 0.26);
    // Tow cord linking scooter shroud to chest harness D-ring
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.beginPath();
    ctx.moveTo(-u * 0.42, 0);
    ctx.lineTo(-u * 1.0, -u * 0.1);
    ctx.stroke();
    // Rear prop shroud
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = dpvActive ? '#22d3ee' : '#64748b';
    ctx.lineWidth = Math.max(1.1, u * 0.045);
    ctx.beginPath();
    ctx.roundRect(-u * 0.46, -u * 0.24, u * 0.34, u * 0.48, u * 0.08);
    ctx.fill();
    ctx.stroke();
    // Spinning cyan propeller blur when throttling
    if (dpvThrusting) {
      const spin = Math.sin(timeSec * 42) * u * 0.16;
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)';
      ctx.lineWidth = Math.max(1.4, u * 0.06);
      ctx.beginPath();
      ctx.moveTo(-u * 0.38, -Math.abs(spin) - u * 0.04);
      ctx.lineTo(-u * 0.38, Math.abs(spin) + u * 0.04);
      ctx.stroke();
    }
    // Streamlined yellow torpedo battery body & nosecone
    ctx.fillStyle = dpvActive ? '#facc15' : '#ca8a04';
    ctx.beginPath();
    ctx.moveTo(-u * 0.14, -u * 0.19);
    ctx.lineTo(u * 0.36, -u * 0.19);
    ctx.quadraticCurveTo(u * 0.64, 0, u * 0.36, u * 0.19);
    ctx.lineTo(-u * 0.14, u * 0.19);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, u * 0.04);
    ctx.stroke();
    // Nosecone active status LED
    if (dpvActive) {
      ctx.fillStyle = dpvThrusting ? '#67e8f9' : '#4ade80';
      ctx.beginPath();
      ctx.arc(u * 0.34, 0, Math.max(1.4, u * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Translucent pelagic moon jellyfish pulsing gently along open-water shipwreck shot lines.
 */
export function drawStyledJellyfish(ctx, j, sx, sy, scale, timeSec) {
  const r = (j.size || 0.45) * scale;
  const pulse = Math.sin(timeSec * 2.4 + (j.phase || 0));
  const rx = r * (1.0 + pulse * 0.12);
  const ry = r * (0.62 - pulse * 0.1);

  ctx.save();
  ctx.translate(sx, sy);

  // Trailing gossamer tentacles
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.34)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let t = -2; t <= 2; t++) {
    const ox = t * rx * 0.32;
    const len = r * (1.55 + (t % 2 === 0 ? 0.45 : 0.15));
    const sway = Math.sin(timeSec * 2.1 + t + (j.phase || 0)) * r * 0.35;
    ctx.beginPath();
    ctx.moveTo(ox, ry * 0.2);
    ctx.quadraticCurveTo(ox + sway, len * 0.55, ox - sway * 0.7, len);
    ctx.stroke();
  }

  // Translucent bioluminescent bell
  ctx.fillStyle = j.hue || '#38bdf8';
  ctx.globalAlpha = 0.26;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(0, ry * 0.45, -rx, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.58;
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = Math.max(1.1, r * 0.06);
  ctx.stroke();

  // Inner four-leaf gonad ring
  ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
  ctx.beginPath();
  ctx.arc(0, -ry * 0.28, rx * 0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Shipwreck megafauna silhouettes & reef giants:
 * - shark: Sleek oceanic reef shark patrolling the blue above deep wrecks
 * - grouper: Massive territorial Goliath Grouper lurking inside dark ship holds
 * - laketrout: Deep cold-water Lake Superior trout gliding past Edmund Fitzgerald
 */
export function drawStyledMegafauna(ctx, m, sx, sy, scale, timeSec) {
  const sz = (m.size || 1.2) * scale;
  const facingLeft = (m.vx || 0) < 0;
  const swim = Math.sin(timeSec * (m.kind === 'shark' ? 4.2 : 3.2) + (m.phase || 0));

  ctx.save();
  ctx.translate(sx, sy);
  if (facingLeft) ctx.scale(-1, 1);

  if (m.kind === 'shark') {
    // Sleek grey oceanic reef shark silhouette with dorsal & sweeping caudal fin
    ctx.globalAlpha = 0.78;
    // Tail fin (asymmetric heterocercal caudal fin)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-sz * 1.15, 0);
    ctx.lineTo(-sz * 1.95, -sz * 0.68 + swim * sz * 0.14);
    ctx.lineTo(-sz * 1.52, swim * sz * 0.08);
    ctx.lineTo(-sz * 1.78, sz * 0.36 + swim * sz * 0.1);
    ctx.closePath();
    ctx.fill();

    // Sweeping dorsal fin
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(sz * 0.25, -sz * 0.22);
    ctx.quadraticCurveTo(-sz * 0.08, -sz * 0.82, -sz * 0.35, -sz * 0.18);
    ctx.closePath();
    ctx.fill();

    // Pectoral fin
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(sz * 0.45, sz * 0.14);
    ctx.quadraticCurveTo(sz * 0.15, sz * 0.65, -sz * 0.2, sz * 0.16);
    ctx.closePath();
    ctx.fill();

    // Counter-shaded torpedo torso (two-tone, zero per-frame gradient allocation)
    ctx.fillStyle = '#5a6b80';
    ctx.beginPath();
    ctx.moveTo(sz * 1.45, sz * 0.02);
    ctx.bezierCurveTo(sz * 0.85, -sz * 0.34, -sz * 0.4, -sz * 0.28, -sz * 1.25, 0);
    ctx.bezierCurveTo(-sz * 0.4, sz * 0.24, sz * 0.82, sz * 0.28, sz * 1.45, sz * 0.02);
    ctx.fill();
    ctx.fillStyle = 'rgba(203, 213, 225, 0.58)';
    ctx.beginPath();
    ctx.moveTo(sz * 1.25, sz * 0.04);
    ctx.quadraticCurveTo(sz * 0.2, sz * 0.25, -sz * 1.05, sz * 0.03);
    ctx.quadraticCurveTo(sz * 0.2, sz * 0.08, sz * 1.25, sz * 0.04);
    ctx.fill();

    // Gill slits & dark eye
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = Math.max(1, sz * 0.03);
    for (let g = 0; g < 4; g++) {
      const gx = sz * (0.58 - g * 0.075);
      ctx.beginPath();
      ctx.moveTo(gx, -sz * 0.06);
      ctx.lineTo(gx - sz * 0.02, sz * 0.08);
      ctx.stroke();
    }
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(sz * 1.02, -sz * 0.05, Math.max(1.5, sz * 0.045), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Massive Goliath Grouper (or deep Lake Trout) lurking in dark ship holds
    const isTrout = m.kind === 'laketrout';
    ctx.fillStyle = isTrout ? '#475569' : '#574332';
    // Broad paddle tail
    ctx.beginPath();
    ctx.moveTo(-sz * 0.85, 0);
    ctx.quadraticCurveTo(-sz * 1.35, -sz * 0.44 + swim * sz * 0.14, -sz * 1.38, swim * sz * 0.12);
    ctx.quadraticCurveTo(-sz * 1.35, sz * 0.44 + swim * sz * 0.14, -sz * 0.85, 0);
    ctx.fill();

    // Spiny dorsal ridge
    ctx.fillStyle = isTrout ? '#64748b' : '#71533b';
    ctx.beginPath();
    ctx.moveTo(sz * 0.32, -sz * 0.34);
    ctx.quadraticCurveTo(-sz * 0.25, -sz * 0.64, -sz * 0.72, -sz * 0.22);
    ctx.closePath();
    ctx.fill();

    // Heavy mottled body (zero per-frame gradient allocation)
    ctx.fillStyle = isTrout ? '#5c6c80' : '#6c4d34';
    ctx.beginPath();
    ctx.moveTo(sz * 1.05, sz * 0.06);
    ctx.bezierCurveTo(sz * 0.65, -sz * 0.56, -sz * 0.45, -sz * 0.5, -sz * 0.92, 0);
    ctx.bezierCurveTo(-sz * 0.45, sz * 0.48, sz * 0.58, sz * 0.52, sz * 1.05, sz * 0.06);
    ctx.fill();
    ctx.fillStyle = isTrout ? 'rgba(148, 163, 184, 0.48)' : 'rgba(168, 137, 108, 0.44)';
    ctx.beginPath();
    ctx.moveTo(sz * 0.92, sz * 0.12);
    ctx.quadraticCurveTo(sz * 0.1, sz * 0.46, -sz * 0.78, sz * 0.06);
    ctx.quadraticCurveTo(sz * 0.1, sz * 0.18, sz * 0.92, sz * 0.12);
    ctx.fill();

    // Mottled spots + glowing reflective eye in torchlight
    ctx.fillStyle = isTrout ? 'rgba(226, 232, 240, 0.32)' : 'rgba(28, 25, 23, 0.35)';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.arc(k * sz * 0.24, -sz * 0.12 + (k % 2) * sz * 0.14, sz * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(sz * 0.68, -sz * 0.1, Math.max(1.8, sz * 0.07), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(sz * 0.7, -sz * 0.1, Math.max(1, sz * 0.038), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
