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
    red: makeGlowStamp('rgba(248, 113, 113, 0.88)', 'rgba(220, 38, 38, 0.34)'),
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

    // Characteristic dark chevron stripes along upper flank (batched single stroke)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = Math.max(1, sz * 0.055);
    ctx.beginPath();
    for (let k = -3; k <= 2; k++) {
      const bx = k * sz * 0.26;
      ctx.moveTo(bx, -sz * 0.16);
      ctx.lineTo(bx - sz * 0.08, 0.04 * sz);
    }
    ctx.stroke();
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

  // Sculpted two-tone body with crisp dark ink contour & sunlit dorsal rim (v189)
  ctx.fillStyle = f.color;
  ctx.strokeStyle = 'rgba(4, 16, 33, 0.76)';
  ctx.lineWidth = Math.max(1.0, sz * 0.065);
  ctx.beginPath();
  ctx.moveTo(sz * 0.96, 0.04 * sz);
  ctx.bezierCurveTo(sz * 0.55, -sz * 0.58, -sz * 0.45, -sz * 0.5, -sz * 0.84, 0);
  ctx.bezierCurveTo(-sz * 0.45, sz * 0.5, sz * 0.55, sz * 0.55, sz * 0.96, 0.04 * sz);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = f.kind === 'cichlid' ? 'rgba(251, 113, 133, 0.48)' : 'rgba(236, 254, 255, 0.52)';
  ctx.beginPath();
  ctx.moveTo(sz * 0.84, 0.08 * sz);
  ctx.quadraticCurveTo(sz * 0.1, sz * 0.46, -sz * 0.72, 0.04 * sz);
  ctx.quadraticCurveTo(sz * 0.1, sz * 0.18, sz * 0.84, 0.08 * sz);
  ctx.fill();
  // Specular sunlit dorsal highlight ribbon
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = Math.max(0.8, sz * 0.055);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sz * 0.58, -sz * 0.24);
  ctx.quadraticCurveTo(sz * 0.05, -sz * 0.36, -sz * 0.44, -sz * 0.22);
  ctx.stroke();

  if (f.kind === 'cichlid') {
    // Mayan cichlid dark vertical bars (batched single stroke) + dark tail ocellus spot
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.lineWidth = Math.max(1, sz * 0.11);
    ctx.beginPath();
    for (let b = -2; b <= 1; b++) {
      const bx = b * sz * 0.22;
      ctx.moveTo(bx, -sz * 0.36);
      ctx.lineTo(bx, sz * 0.34);
    }
    ctx.stroke();
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
  const ink = '#061a14';
  const inkW = Math.max(1.2, sz * 0.055);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t.angle);
  if (facingLeft) ctx.scale(1, -1);

  // Far front webbed flipper
  ctx.fillStyle = '#365314';
  ctx.strokeStyle = ink;
  ctx.lineWidth = inkW;
  ctx.save();
  ctx.translate(sz * 0.32, sz * 0.14);
  ctx.rotate(-paddle * 0.65);
  ctx.beginPath();
  ctx.ellipse(-sz * 0.04, sz * 0.28, sz * 0.15, sz * 0.3, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Hind webbed flipper
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.ellipse(-sz * 0.68, sz * 0.22, sz * 0.16, sz * 0.22, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head & neck with cel-shading + crimson cenote slider ear stripe
  const headG = ctx.createLinearGradient(sz * 0.6, -sz * 0.16, sz * 0.9, sz * 0.2);
  headG.addColorStop(0, '#84cc16');
  headG.addColorStop(0.55, '#4d7c0f');
  headG.addColorStop(1, '#365314');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.ellipse(sz * 0.82, 0.02 * sz, sz * 0.27, sz * 0.175, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Slider crimson-orange ear stripe
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = Math.max(1.6, sz * 0.075);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sz * 0.65, 0.02 * sz);
  ctx.lineTo(sz * 0.84, -0.01 * sz);
  ctx.stroke();

  // Expressive eye with dark ring + bright white catchlight
  ctx.fillStyle = '#fef9c3';
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.9, sz * 0.035);
  ctx.beginPath();
  ctx.arc(sz * 0.92, -0.048 * sz, Math.max(2.1, sz * 0.076), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(sz * 0.94, -0.048 * sz, Math.max(1.2, sz * 0.044), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sz * 0.955, -0.066 * sz, Math.max(0.7, sz * 0.022), 0, Math.PI * 2);
  ctx.fill();

  // Warm cream plastron belly rim
  ctx.fillStyle = '#fef08a';
  ctx.strokeStyle = ink;
  ctx.lineWidth = inkW;
  ctx.beginPath();
  ctx.ellipse(-sz * 0.08, sz * 0.13, sz * 0.64, sz * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sculpted Domed Cel-Shaded Carapace Shell
  const shellG = ctx.createRadialGradient(sz * 0.06, -sz * 0.26, sz * 0.08, -sz * 0.08, -sz * 0.05, sz * 0.85);
  shellG.addColorStop(0, '#84cc16');
  shellG.addColorStop(0.45, '#4d7c0f');
  shellG.addColorStop(1, '#1a2e05');
  ctx.fillStyle = shellG;
  ctx.beginPath();
  ctx.moveTo(sz * 0.65, 0.08 * sz);
  ctx.bezierCurveTo(sz * 0.45, -sz * 0.52, -sz * 0.48, -sz * 0.48, -sz * 0.82, 0.1 * sz);
  ctx.quadraticCurveTo(-sz * 0.1, sz * 0.25, sz * 0.65, 0.08 * sz);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sunlit glossy dorsal carapace highlight
  ctx.fillStyle = 'rgba(236, 252, 203, 0.34)';
  ctx.beginPath();
  ctx.ellipse(sz * 0.02, -sz * 0.26, sz * 0.34, sz * 0.09, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Warm yellow slider scute ocelli rings
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
  ctx.lineWidth = Math.max(1.1, sz * 0.038);
  for (let s = -1; s <= 1; s++) {
    ctx.beginPath();
    ctx.ellipse(s * sz * 0.24 - sz * 0.08, -sz * 0.12, sz * 0.13, sz * 0.085, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Near paddling front webbed flipper with crisp outline
  const flipG = ctx.createLinearGradient(0, 0, 0, sz * 0.55);
  flipG.addColorStop(0, '#84cc16');
  flipG.addColorStop(1, '#3f6212');
  ctx.fillStyle = flipG;
  ctx.strokeStyle = ink;
  ctx.lineWidth = inkW;
  ctx.save();
  ctx.translate(sz * 0.34, sz * 0.18);
  ctx.rotate(paddle);
  ctx.beginPath();
  ctx.ellipse(-sz * 0.06, sz * 0.28, sz * 0.17, sz * 0.34, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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
  const makeGrad = (x0, y0, x1, y1, stops, fallback) => {
    const g = ctx.createLinearGradient?.(x0, y0, x1, y1);
    if (!g || typeof g.addColorStop !== 'function') return fallback;
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  };
  const suitGrad = makeGrad(0, -q * 0.4, 0, q * 0.45, [[0, '#1e293b'], [0.55, '#0f172a'], [1, '#020617']], '#0f172a');
  const tankGrad = makeGrad(0, -q * 0.62, 0, -q * 0.24, [[0, '#f8fafc'], [0.4, '#cbd5e1'], [1, '#64748b']], '#cbd5e1');
  const stageGrad = makeGrad(0, q * 0.24, 0, q * 0.52, [[0, '#e2e8f0'], [0.5, '#94a3b8'], [1, '#475569']], '#94a3b8');
  const glassGrad = makeGrad(q * 0.5, -q * 0.2, q * 0.75, q * 0.06, [[0, '#cffafe'], [0.45, '#22d3ee'], [1, '#0e7490']], '#22d3ee');

  cached = { suitGrad, tankGrad, stageGrad, glassGrad };
  if (ctxMap.size > 24) ctxMap.clear();
  ctxMap.set(uKey, cached);
  return cached;
}

/**
 * Draws the Life Aquatic / technical cave diver rig details (drysuit seam, Zissou accent,
 * brushed twinset or CCR rebreather shell, glass mask glint, optional torpedo DPV scooter).
 */
function _equipEaseOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.max(0, Math.min(1, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Draw animated special drysuit properties (Mythic/Epic FX) directly onto the torso shell (v211).
 */
function _drawAnimatedSuitFx(ctx, u, pal, timeSec) {
  const fx = pal?.suitFx;
  if (!fx) return;
  ctx.save();
  if (fx === 'biolume-pulse') {
    const p = 0.5 + 0.5 * Math.sin(timeSec * 3.4);
    ctx.strokeStyle = `rgba(34, 211, 238, ${(0.38 + p * 0.52).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, u * 0.048);
    ctx.beginPath();
    ctx.ellipse(-u * 0.22, u * 0.02, u * 0.64, u * 0.24, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
    // Drifting bioluminescent spores along torso
    for (let i = 0; i < 4; i++) {
      const ph = ((timeSec * 0.9 + i * 0.25) % 1);
      const bx = -u * 0.72 + i * u * 0.34 - ph * u * 0.22;
      const by = u * 0.14 - ph * u * 0.52 + Math.sin(timeSec * 4 + i * 2) * u * 0.06;
      ctx.fillStyle = i % 2 === 0 ? `rgba(103, 232, 249, ${(1 - ph).toFixed(2)})` : `rgba(192, 132, 252, ${(1 - ph).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1.2, u * 0.045 * (1 - ph * 0.4)), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fx === 'sovereign-aura') {
    const sweep = ((timeSec * 0.65) % 1) * 1.4 - 0.92;
    ctx.strokeStyle = `rgba(250, 204, 21, ${(0.5 + 0.35 * Math.sin(timeSec * 4.2)).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.4, u * 0.055);
    ctx.beginPath();
    ctx.moveTo(u * sweep, -u * 0.26);
    ctx.lineTo(u * (sweep + 0.16), u * 0.26);
    ctx.stroke();
    // Orbiting gilded prestige motes
    for (let i = 0; i < 3; i++) {
      const a = timeSec * 2.2 + (i * Math.PI * 2) / 3;
      const mx = -u * 0.22 + Math.cos(a) * u * 0.76;
      const my = u * 0.02 + Math.sin(a) * u * 0.34;
      ctx.fillStyle = i === 0 ? '#fef08a' : (pal.trim || '#fde047');
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(1.2, u * 0.048), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fx === 'magma-embers') {
    const p = 0.5 + 0.5 * Math.sin(timeSec * 4.4);
    ctx.strokeStyle = `rgba(251, 146, 60, ${(0.45 + p * 0.5).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, u * 0.046);
    ctx.beginPath();
    ctx.moveTo(-u * 0.75, u * 0.05);
    ctx.lineTo(-u * 0.42, -u * 0.09);
    ctx.lineTo(-u * 0.12, u * 0.1);
    ctx.lineTo(u * 0.18, -u * 0.06);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const ph = ((timeSec * 1.1 + i * 0.26) % 1);
      const ex = -u * 0.62 + i * u * 0.28 + Math.sin(timeSec * 5 + i) * u * 0.05;
      const ey = u * 0.12 - ph * u * 0.58;
      ctx.fillStyle = `rgba(253, 224, 71, ${((1 - ph) * 0.92).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.1, u * 0.042 * (1 - ph * 0.5)), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fx === 'phantom-phase') {
    const p = 0.5 + 0.5 * Math.sin(timeSec * 3.8);
    ctx.strokeStyle = `rgba(94, 234, 212, ${(0.28 + p * 0.48).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.4, u * 0.05);
    ctx.beginPath();
    ctx.ellipse(-u * 0.22, u * 0.02, u * (0.74 + p * 0.06), u * (0.33 + p * 0.04), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (fx === 'orichalcum-runes') {
    const p = 0.45 + 0.55 * Math.sin(timeSec * 3.2);
    ctx.strokeStyle = `rgba(253, 224, 71, ${(0.4 + p * 0.55).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.1, u * 0.04);
    for (let r = 0; r < 2; r++) {
      const cx = -u * (0.52 - r * 0.36);
      ctx.beginPath();
      ctx.arc(cx, u * 0.04, u * (0.09 + r * 0.02), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (fx === 'dragon-jade') {
    const p = 0.5 + 0.5 * Math.sin(timeSec * 3.6);
    ctx.strokeStyle = `rgba(45, 212, 191, ${(0.36 + p * 0.44).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.1, u * 0.04);
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.arc(-u * (0.62 - s * 0.24), u * 0.04, u * 0.13, -0.7, 0.7);
      ctx.stroke();
    }
    const ph = ((timeSec * 0.95) % 1);
    ctx.fillStyle = `rgba(251, 113, 133, ${(1 - ph).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(-u * 0.45 + ph * u * 0.55, -u * 0.16 - ph * u * 0.24, Math.max(1.3, u * 0.048), 0, Math.PI * 2);
    ctx.fill();
  } else if (fx === 'karst-caustics') {
    const wave = Math.sin(timeSec * 2.8) * u * 0.14;
    ctx.strokeStyle = 'rgba(153, 246, 228, 0.42)';
    ctx.lineWidth = Math.max(1.1, u * 0.042);
    ctx.beginPath();
    ctx.moveTo(-u * 0.68, -u * 0.08 + wave * 0.4);
    ctx.quadraticCurveTo(-u * 0.24, -u * 0.22 - wave * 0.5, u * 0.24, -u * 0.04 + wave * 0.3);
    ctx.stroke();
  } else if (fx === 'abyssal-shimmer') {
    const p = 0.4 + 0.6 * Math.sin(timeSec * 2.9);
    ctx.strokeStyle = `rgba(232, 121, 249, ${(0.28 + p * 0.42).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.1, u * 0.044);
    ctx.beginPath();
    ctx.ellipse(-u * 0.22, u * 0.02, u * 0.66, u * 0.25, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (fx === 'aurora-ribbon') {
    // Flowing green -> cyan -> violet glacial aurora ribbons along torso (v229)
    const hue = 152 + Math.sin(timeSec * 1.8) * 52;
    const wave = Math.sin(timeSec * 3.1) * u * 0.1;
    ctx.strokeStyle = `hsla(${Math.round(hue)}, 92%, 68%, 0.72)`;
    ctx.lineWidth = Math.max(1.4, u * 0.052);
    ctx.beginPath();
    ctx.moveTo(-u * 0.78, -u * 0.04 + wave);
    ctx.bezierCurveTo(-u * 0.42, -u * 0.22 - wave, -u * 0.08, u * 0.2 + wave, u * 0.26, -u * 0.04 - wave * 0.6);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${Math.round(hue + 56)}, 95%, 76%, 0.55)`;
    ctx.lineWidth = Math.max(1.0, u * 0.032);
    ctx.beginPath();
    ctx.moveTo(-u * 0.74, u * 0.08 - wave * 0.7);
    ctx.quadraticCurveTo(-u * 0.22, -u * 0.14 + wave, u * 0.22, u * 0.08);
    ctx.stroke();
  } else if (fx === 'prism-shift') {
    // Live holographic spectrum sweep + pearlescent shimmer motes (v229 Exclusive)
    const h1 = Math.round((timeSec * 110) % 360);
    const h2 = (h1 + 120) % 360;
    const sweep = ((timeSec * 0.75) % 1) * 1.44 - 0.92;
    ctx.strokeStyle = `hsla(${h1}, 96%, 74%, 0.85)`;
    ctx.lineWidth = Math.max(1.6, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(u * sweep, -u * 0.26);
    ctx.lineTo(u * (sweep + 0.18), u * 0.26);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${h2}, 96%, 76%, 0.68)`;
    ctx.lineWidth = Math.max(1.2, u * 0.042);
    ctx.beginPath();
    ctx.ellipse(-u * 0.22, u * 0.02, u * 0.68, u * 0.27, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = timeSec * 2.5 + (i * Math.PI) / 2;
      ctx.fillStyle = `hsla(${(h1 + i * 75) % 360}, 98%, 78%, 0.88)`;
      ctx.beginPath();
      ctx.arc(-u * 0.22 + Math.cos(a) * u * 0.74, u * 0.02 + Math.sin(a) * u * 0.34, Math.max(1.2, u * 0.046), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fx === 'void-plasma') {
    // Crackling ultraviolet & crimson plasma arcs (v229 Exclusive)
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6.2);
    ctx.strokeStyle = `rgba(244, 63, 94, ${(0.52 + pulse * 0.44).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.3, u * 0.048);
    ctx.beginPath();
    ctx.moveTo(-u * 0.78, u * 0.02);
    ctx.lineTo(-u * 0.48, -u * (0.12 + pulse * 0.05));
    ctx.lineTo(-u * 0.18, u * (0.11 + pulse * 0.04));
    ctx.lineTo(u * 0.14, -u * 0.09);
    ctx.lineTo(u * 0.28, u * 0.03);
    ctx.stroke();
    ctx.strokeStyle = `rgba(192, 132, 252, ${(0.42 + (1 - pulse) * 0.44).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.1, u * 0.036);
    ctx.beginPath();
    ctx.ellipse(-u * 0.22, u * 0.02, u * (0.72 + pulse * 0.05), u * (0.30 + pulse * 0.03), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStyledDiverRig(ctx, u, scale, isPeer, rollScale, gearOpts = null) {
  const pal = gearOpts?.liveryPalette || null;
  const accent = pal?.accent || (isPeer ? '#fb923c' : '#ef4444'); // Classic Zissou red cap/accent vs custom livery
  const timeSec = gearOpts?.timeSec || 0;
  let trim = pal?.trim || (isPeer ? '#fdba74' : '#38bdf8');
  if (pal?.trimFx === 'selenite-prism') {
    trim = `hsl(${Math.round((timeSec * 90) % 360)}, 92%, 78%)`;
  } else if (pal?.trimFx === 'foundry-sparks') {
    trim = `hsl(32, 98%, ${58 + Math.round(Math.sin(timeSec * 6.5) * 14)}%)`;
  }
  const stageBandColor = pal?.stageBand || (isPeer ? '#fb923c' : '#22c55e');
  const { suitGrad, tankGrad, stageGrad, glassGrad } = _getRigGradients(ctx, u);
  const hasCcr = Boolean(gearOpts?.hasCcr);
  const hasDpv = Boolean(gearOpts?.hasDpv);
  const dpvActive = Boolean(gearOpts?.dpvActive);
  const dpvThrusting = Boolean(gearOpts?.dpvThrusting);
  const equipFx = gearOpts?.equipFx || null;
  const equipT = equipFx && equipFx.progress >= 0 && equipFx.progress < 1 ? equipFx.progress : 1;

  // Sculpted drysuit torso shell with shading (supports custom livery drysuit colorway)
  if (pal?.suitTop && pal?.suitMid && pal?.suitBot) {
    const customSuitGrad = ctx.createLinearGradient?.(0, -u * 0.4, 0, u * 0.45);
    if (customSuitGrad && typeof customSuitGrad.addColorStop === 'function') {
      customSuitGrad.addColorStop(0, pal.suitTop);
      customSuitGrad.addColorStop(0.55, pal.suitMid);
      customSuitGrad.addColorStop(1, pal.suitBot);
      ctx.fillStyle = customSuitGrad;
    } else {
      ctx.fillStyle = pal.suitMid;
    }
  } else {
    ctx.fillStyle = suitGrad;
  }
  ctx.beginPath();
  ctx.ellipse(-u * 0.22, u * 0.02, u * 0.72, u * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();

  // Animated Special Drysuit FX (Mythic / Epic living effects)
  _drawAnimatedSuitFx(ctx, u, pal, timeSec);

  // Harness webbing & chest D-ring highlight (with animated plasma/foundry trim FX)
  ctx.strokeStyle = trim;
  ctx.lineWidth = Math.max(1.3, u * 0.055);
  ctx.beginPath();
  ctx.moveTo(-u * 0.65, -u * 0.18);
  ctx.lineTo(u * 0.18, u * 0.18);
  ctx.stroke();
  if (pal?.trimFx === 'plasma-wave') {
    const pt = ((timeSec * 1.45) % 1 + 1) % 1;
    const pxW = -u * 0.65 + (u * 0.83) * pt;
    const pyW = -u * 0.18 + (u * 0.36) * pt;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(pxW, pyW, Math.max(1.6, u * 0.068), 0, Math.PI * 2);
    ctx.fill();
  } else if (pal?.trimFx === 'foundry-sparks') {
    const ph = ((timeSec * 1.5) % 1);
    ctx.fillStyle = `rgba(253, 224, 71, ${(1 - ph).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(-u * 0.22 - ph * u * 0.25, -u * 0.05 - ph * u * 0.35, Math.max(1.2, u * 0.048), 0, Math.PI * 2);
    ctx.fill();
  }

  // Optional Milestone Shoulder Patch emblem (v138 / animated prestige crest ring v211)
  if (pal?.patchIcon) {
    ctx.save();
    const patchAnimScale =
      equipFx && equipFx.slot === 'patch' && equipT < 0.7
        ? 0.55 + _equipEaseOutBack(Math.min(1, equipT / 0.55)) * 0.45
        : 1;
    ctx.translate(-u * 0.18, -u * 0.02);
    ctx.scale(patchAnimScale, patchAnimScale);
    const pr = Math.max(3.5, u * 0.135);
    if (pal.patchFx === 'crest-halo') {
      const haloColor = pal.patchTier === 'mythic' ? '#facc15' : '#c084fc';
      const hp = 0.5 + 0.5 * Math.sin(timeSec * 4.2);
      ctx.strokeStyle = haloColor;
      ctx.globalAlpha = 0.55 + hp * 0.4;
      ctx.lineWidth = Math.max(1.1, u * 0.036);
      ctx.beginPath();
      ctx.arc(0, 0, pr * (1.28 + hp * 0.12), timeSec * 1.8, timeSec * 1.8 + Math.PI * 1.35);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = pal.patchTier === 'mythic' ? '#facc15' : trim;
    ctx.lineWidth = Math.max(1, u * 0.032);
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `700 ${Math.max(7, Math.round(u * 0.16))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pal.patchIcon, 0, u * 0.01);
    ctx.restore();
  }

  const tankFinish = pal?.tankFinish || null;
  const visorTint = pal?.visorTint || null;
  const headgearId = pal?.headgearId || 'zissou-cap';

  // Tank / CCR kinetic backplate clamp-down equip animation
  const tankDropY =
    equipFx && (equipFx.slot === 'tank' || equipFx.slot === 'ccr') && equipT < 0.72
      ? (1 - _equipEaseOutBack(Math.min(1, equipT / 0.58))) * (-u * 0.52)
      : 0;
  ctx.save();
  if (tankDropY) ctx.translate(0, tankDropY);
  if (hasCcr) {
    // Closed-Circuit Rebreather (CCR) back-mount canister (supports custom tank/shell finish!) & corrugated breathing loop
    ctx.fillStyle = tankFinish?.ccrShell || '#eab308';
    ctx.beginPath();
    ctx.roundRect(-u * 0.92, -u * 0.62, u * 1.18, u * 0.40, u * 0.14);
    ctx.fill();
    ctx.strokeStyle = tankFinish?.stroke || '#1e293b';
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
    // Twin Backgas Cylinders (supports custom anodized/carbon/brass/yellow metallic finishes!)
    let cylFill = tankGrad;
    if (tankFinish && tankFinish.id !== 'al80-silver' && typeof ctx.createLinearGradient === 'function') {
      const cg = ctx.createLinearGradient(0, -u * 0.58, 0, -u * 0.23);
      if (cg && typeof cg.addColorStop === 'function') {
        cg.addColorStop(0, tankFinish.top);
        cg.addColorStop(0.52, tankFinish.mid);
        cg.addColorStop(1, tankFinish.bot);
        cylFill = cg;
      } else {
        cylFill = tankFinish.mid;
      }
    }
    ctx.fillStyle = cylFill;
    ctx.beginPath();
    ctx.roundRect(-u * 0.9, -u * 0.58, u * 1.15, u * 0.35, u * 0.15);
    ctx.fill();
    ctx.strokeStyle = tankFinish?.stroke || '#475569';
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.stroke();

    // Specular streak & manifold valve
    ctx.fillStyle = tankFinish?.id === 'carbon-stealth' ? 'rgba(148,163,184,0.32)' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(-u * 0.8, -u * 0.53, u * 0.9, u * 0.05);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(u * 0.16, -u * 0.55, u * 0.15, u * 0.28);
    ctx.fillRect(-u * 0.66, -u * 0.58, u * 0.1, u * 0.35);
  }

  // Animated Special Tank FX (Reactor Core cells, Cryo-Plasma Rings, Chemocline Shimmer)
  if (pal?.tankFx === 'reactor-core') {
    const rp = 0.55 + 0.45 * Math.sin(timeSec * 5.2);
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = `rgba(254, 240, 138, ${(0.55 + rp * 0.45).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(-u * (0.56 - c * 0.24), -u * 0.41, Math.max(1.4, u * 0.058), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pal?.tankFx === 'carbon-plasma') {
    const sxRing = -u * 0.82 + ((timeSec * 0.65) % 1) * (u * 0.92);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
    ctx.lineWidth = Math.max(1.4, u * 0.055);
    ctx.beginPath();
    ctx.moveTo(sxRing, -u * 0.57);
    ctx.lineTo(sxRing, -u * 0.24);
    ctx.stroke();
  } else if (pal?.tankFx === 'halocline-glow') {
    const sxWave = -u * 0.82 + ((timeSec * 0.55) % 1) * (u * 0.92);
    ctx.fillStyle = 'rgba(217, 249, 157, 0.58)';
    ctx.fillRect(sxWave, -u * 0.56, u * 0.16, u * 0.31);
  }
  ctx.restore();

  // Slung Stage Cylinder (Deco / Travel bottle) with color band
  ctx.fillStyle = stageGrad;
  ctx.beginPath();
  ctx.roundRect(-u * 0.58, u * 0.26, u * 0.9, u * 0.24, u * 0.11);
  ctx.fill();
  ctx.fillStyle = stageBandColor;
  ctx.fillRect(-u * 0.2, u * 0.26, u * 0.14, u * 0.24);

  // Modular Headgear Silhouette + kinetic drop-in equip animation (v153 / v211)
  const headY = -u * 0.02 * Math.sign(rollScale || 1);
  const headDropY =
    equipFx && (equipFx.slot === 'headgear' || equipFx.slot === 'visor') && equipT < 0.72
      ? (1 - _equipEaseOutBack(Math.min(1, equipT / 0.56))) * (-u * 0.45)
      : 0;
  ctx.save();
  if (headDropY) ctx.translate(0, headDropY);
  if (headgearId === 'abyss-halo-helm') {
    // Armored deep-sump titanium dome + animated rotating cyan orbital telemetry halo
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.4, u * 0.05);
    ctx.stroke();
    // Titanium brow armor crest
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(u * 0.42, headY - u * 0.04, u * 0.32, Math.PI * 0.94, Math.PI * 2.02);
    ctx.fill();
    // Rotating holographic telemetry halo ring around crown
    const haloSpin = timeSec * 2.6;
    ctx.save();
    ctx.strokeStyle = `rgba(103, 232, 249, ${(0.58 + 0.35 * Math.sin(timeSec * 4.5)).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.5, u * 0.052);
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.44, haloSpin, haloSpin + Math.PI * 1.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.44, haloSpin + Math.PI * 1.4, haloSpin + Math.PI * 1.82);
    ctx.stroke();
    // Alternating twin telemetry beacon pods
    const blink = Math.sin(timeSec * 6.0) > 0;
    ctx.fillStyle = blink ? '#67e8f9' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(u * 0.34, headY - u * 0.36, Math.max(1.4, u * 0.052), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#38bdf8' : '#e0f2fe';
    ctx.beginPath();
    ctx.arc(u * 0.52, headY - u * 0.35, Math.max(1.4, u * 0.052), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (headgearId === 'cave-helmet') {
    // Hard-shell technical cave/wreck helmet with crown ridge, chinstrap & side-mounted backup LED pod
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(1.2, u * 0.04);
    ctx.stroke();
    // Armored crown shell & accent ridge stripe
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(u * 0.42, headY - u * 0.04, u * 0.33, Math.PI * 0.92, Math.PI * 2.02);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, u * 0.075);
    ctx.beginPath();
    ctx.arc(u * 0.42, headY - u * 0.03, u * 0.29, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    // Chinstrap + side-mounted dual backup cave torch pod
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, u * 0.036);
    ctx.beginPath();
    ctx.moveTo(u * 0.34, headY + u * 0.12);
    ctx.lineTo(u * 0.54, headY + u * 0.28);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(u * 0.28, headY - u * 0.34, u * 0.24, u * 0.11, u * 0.04);
    ctx.fill();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(u * 0.52, headY - u * 0.285, Math.max(1.4, u * 0.045), 0, Math.PI * 2);
    ctx.fill();
  } else if (headgearId === 'world-thermal-hood') {
    // Nordic 9mm Insulated Thermal Hood with frosted arctic fleece collar & glowing ice-cyan seal
    ctx.fillStyle = '#0c233a';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = Math.max(1.8, u * 0.068);
    ctx.beginPath();
    ctx.moveTo(u * 0.16, headY - u * 0.24);
    ctx.quadraticCurveTo(u * 0.24, headY, u * 0.16, headY + u * 0.24);
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.3, u * 0.044);
    ctx.beginPath();
    ctx.arc(u * 0.43, headY, u * 0.27, Math.PI * 1.05, Math.PI * 1.82);
    ctx.stroke();
  } else if (headgearId === 'cave-hood') {
    // Contoured 7mm technical neoprene cave hood with twin high-vis reflective trim lines
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.33, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1.4, u * 0.05);
    ctx.beginPath();
    ctx.arc(u * 0.42, headY, u * 0.26, Math.PI * 1.08, Math.PI * 1.78);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.1, u * 0.035);
    ctx.beginPath();
    ctx.arc(u * 0.42, headY, u * 0.19, Math.PI * 1.14, Math.PI * 1.72);
    ctx.stroke();
  } else if (headgearId === 'exo-mask') {
    // Full-Face Commercial/Tech Exo Mask shell with armored neck seal & dorsal accent fin
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.4, u * 0.05);
    ctx.beginPath();
    ctx.arc(u * 0.43, headY, u * 0.32, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
  } else if (headgearId === 'brass-hardhat' || headgearId === 'secret-dreadnought-helm') {
    const isMk4 = headgearId === 'secret-dreadnought-helm';
    // Riveted Mark V antique bronze/brass deep-salvage dome (or WWII Mk-IV Dreadnought armored helm!)
    ctx.fillStyle = isMk4 ? '#78350f' : '#92400e';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * (isMk4 ? 0.39 : 0.37), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isMk4 ? '#b45309' : '#d97706';
    ctx.beginPath();
    ctx.arc(u * 0.42, headY - u * 0.04, u * (isMk4 ? 0.33 : 0.31), Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.strokeStyle = isMk4 ? '#f59e0b' : '#fde68a';
    ctx.lineWidth = Math.max(1.4, u * 0.048);
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * (isMk4 ? 0.38 : 0.36), 0, Math.PI * 2);
    ctx.stroke();
    // Brass neck breastplate collar ring + top vent knob
    ctx.strokeStyle = isMk4 ? '#fbbf24' : '#fef08a';
    ctx.lineWidth = Math.max(1.8, u * 0.07);
    ctx.beginPath();
    ctx.moveTo(u * 0.16, headY - u * 0.24);
    ctx.lineTo(u * 0.16, headY + u * 0.24);
    ctx.stroke();
    ctx.fillStyle = isMk4 ? '#fde047' : '#fef08a';
    ctx.beginPath();
    ctx.arc(u * 0.42, headY - u * (isMk4 ? 0.39 : 0.37), Math.max(1.6, u * 0.06), 0, Math.PI * 2);
    ctx.fill();
    // Animated bronze sheen glint sweep
    const glintAng = Math.PI * (1.1 + ((timeSec * 0.55) % 0.72));
    ctx.strokeStyle = 'rgba(254, 249, 195, 0.78)';
    ctx.lineWidth = Math.max(1.3, u * 0.045);
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.31, glintAng, glintAng + 0.32);
    ctx.stroke();
    if (isMk4) {
      // Twin armored bronze brow rivets + pulsing amber dreadnought crown lamp + vent sparks
      const lampPulse = 0.65 + 0.35 * Math.sin(timeSec * 5.4);
      ctx.fillStyle = `rgba(254, 240, 138, ${lampPulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(u * 0.60, headY - u * 0.27, Math.max(1.5, u * (0.052 + lampPulse * 0.02)), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = Math.max(1.1, u * 0.036);
      ctx.beginPath();
      ctx.moveTo(u * 0.32, headY - u * 0.35);
      ctx.lineTo(u * 0.32, headY + u * 0.34);
      ctx.stroke();
      const sp = ((timeSec * 1.4) % 1);
      ctx.fillStyle = `rgba(253, 224, 71, ${((1 - sp) * 0.85).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(u * 0.42 - sp * u * 0.14, headY - u * 0.42 - sp * u * 0.24, Math.max(1.1, u * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Classic Zissou Beanie with subtle stripe accent & top rim catchlight
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(u * 0.40, -u * 0.14, u * 0.22, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.28)';
    ctx.lineWidth = Math.max(1, u * 0.032);
    ctx.beginPath();
    ctx.arc(u * 0.44, headY, u * 0.30, Math.PI * 1.15, Math.PI * 1.82);
    ctx.stroke();
  }

  // Custom Visor Glass Gradient (Crystal Cyan, High-Contrast Amber, Iridescent Mirror, Night-Ops Emerald, etc.)
  let maskGlassFill = glassGrad;
  if (visorTint && visorTint.id !== 'clear-cyan' && typeof ctx.createLinearGradient === 'function') {
    const vg = ctx.createLinearGradient(u * 0.52, -u * 0.2, u * 0.76, u * 0.14);
    if (vg && typeof vg.addColorStop === 'function') {
      vg.addColorStop(0, visorTint.top);
      vg.addColorStop(0.5, visorTint.mid);
      vg.addColorStop(1, visorTint.bot);
      maskGlassFill = vg;
    } else {
      maskGlassFill = visorTint.mid;
    }
  }

  if (headgearId === 'exo-mask') {
    // Panoramic Full-Face Exo Visor + animated scanning HUD bar + integrated chin comms pod
    ctx.fillStyle = visorTint?.frame || '#083344';
    ctx.beginPath();
    ctx.roundRect(u * 0.48, -u * 0.24, u * 0.30, u * 0.38, u * 0.10);
    ctx.fill();
    ctx.fillStyle = maskGlassFill;
    ctx.beginPath();
    ctx.roundRect(u * 0.51, -u * 0.21, u * 0.24, u * 0.30, u * 0.07);
    ctx.fill();
    // Live animated interior comms HUD bar
    const hudPulse = 0.55 + 0.45 * Math.sin(timeSec * 4.8);
    ctx.strokeStyle = visorTint?.hudGlow || '#38bdf8';
    ctx.globalAlpha = hudPulse;
    ctx.lineWidth = Math.max(1.2, u * 0.044);
    ctx.beginPath();
    ctx.moveTo(u * 0.54, -u * 0.16);
    ctx.lineTo(u * (0.63 + hudPulse * 0.08), -u * 0.16);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Diagonal curved visor specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath();
    ctx.moveTo(u * 0.55, -u * 0.13);
    ctx.quadraticCurveTo(u * 0.62, -u * 0.14, u * 0.71, -u * 0.08);
    ctx.lineTo(u * 0.68, -u * 0.04);
    ctx.quadraticCurveTo(u * 0.60, -u * 0.09, u * 0.54, -u * 0.08);
    ctx.closePath();
    ctx.fill();
    // Integrated lower-chin comms regulator block
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.beginPath();
    ctx.roundRect(u * 0.55, u * 0.08, u * 0.22, u * 0.14, u * 0.05);
    ctx.fill();
    ctx.stroke();
  } else if (headgearId === 'secret-dreadnought-helm') {
    // WWII Mk-IV Circular Riveted Brass Porthole Visor + pulsing furnace glow + protective cross-grille
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(u * 0.62, -u * 0.04, u * 0.17, 0, Math.PI * 2);
    ctx.fill();
    const glowP = 0.75 + 0.25 * Math.sin(timeSec * 4.5);
    ctx.fillStyle = `rgba(254, 240, 138, ${glowP.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(u * 0.63, -u * 0.04, u * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = Math.max(1.2, u * 0.038);
    ctx.beginPath();
    ctx.moveTo(u * 0.63, -u * 0.17);
    ctx.lineTo(u * 0.63, u * 0.09);
    ctx.moveTo(u * 0.50, -u * 0.04);
    ctx.lineTo(u * 0.76, -u * 0.04);
    ctx.stroke();
  } else {
    // Frameless Dive Mask with Custom Visor Tint & Curved Specular Glint
    ctx.fillStyle = visorTint?.frame || '#083344';
    ctx.beginPath();
    ctx.roundRect(u * 0.50, -u * 0.2, u * 0.25, u * 0.26, u * 0.07);
    ctx.fill();
    ctx.fillStyle = maskGlassFill;
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
  }

  // Animated Special Visor FX overlaid crisply across the glass lens (v211)
  if (pal?.visorFx && headgearId !== 'secret-dreadnought-helm') {
    const vfx = pal.visorFx;
    ctx.save();
    if (vfx === 'spectral-scan') {
      const syLine = -u * 0.16 + ((Math.sin(timeSec * 4.4) * 0.5 + 0.5) * u * 0.17);
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = Math.max(1.2, u * 0.042);
      ctx.beginPath();
      ctx.moveTo(u * 0.53, syLine);
      ctx.lineTo(u * 0.73, syLine);
      ctx.stroke();
    } else if (vfx === 'aurora-frost') {
      const wave = Math.sin(timeSec * 3.8);
      ctx.strokeStyle = wave > 0 ? '#5eead4' : '#a5f3fc';
      ctx.lineWidth = Math.max(1.2, u * 0.045);
      ctx.beginPath();
      ctx.moveTo(u * 0.54, -u * 0.06 + wave * u * 0.04);
      ctx.quadraticCurveTo(u * 0.63, -u * 0.12 - wave * u * 0.04, u * 0.72, -u * 0.05);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(u * (0.62 + wave * 0.05), -u * 0.13, Math.max(1.1, u * 0.036), 0, Math.PI * 2);
      ctx.fill();
    } else if (vfx === 'stalker-lock') {
      const p = 0.45 + 0.55 * Math.sin(timeSec * 5.2);
      ctx.strokeStyle = `rgba(254, 240, 138, ${p.toFixed(2)})`;
      ctx.lineWidth = Math.max(1, u * 0.035);
      ctx.beginPath();
      ctx.arc(u * 0.63, -u * 0.075, u * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    } else if (vfx === 'thermocline-wave' || vfx === 'coral-shimmer') {
      const shift = ((timeSec * 0.9) % 1) * u * 0.16;
      ctx.strokeStyle = vfx === 'coral-shimmer' ? 'rgba(255, 228, 230, 0.85)' : 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = Math.max(1.1, u * 0.038);
      ctx.beginPath();
      ctx.moveTo(u * 0.54 + shift, -u * 0.17);
      ctx.lineTo(u * 0.52 + shift, u * 0.02);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

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

  // Torpedo DPV Underwater Scooter gripped ahead of diver ONLY when equipped & active (v233)!
  if (hasDpv && dpvActive) {
    const scSpec = pal?.scooter && pal.scooter.id !== 'none'
      ? pal.scooter
      : { hull: '#facc15', shroud: '#1e293b', accent: '#22d3ee', tier: 'common' };
    const isLegDpv = scSpec.tier === 'legendary';
    const dpvSlideX =
      equipFx && (equipFx.slot === 'dpv' || equipFx.slot === 'scooter') && equipT < 0.72
        ? (1 - _equipEaseOutBack(Math.min(1, equipT / 0.58))) * (u * 0.85)
        : 0;
    ctx.save();
    ctx.translate(u * 1.18 + dpvSlideX, u * 0.26);
    // Tow cord linking scooter shroud to chest harness D-ring
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.lineWidth = Math.max(1, u * 0.035);
    ctx.beginPath();
    ctx.moveTo(-u * 0.42, 0);
    ctx.lineTo(-u * 1.0, -u * 0.1);
    ctx.stroke();
    // Rear prop shroud
    ctx.fillStyle = scSpec.shroud || '#1e293b';
    ctx.strokeStyle = scSpec.accent || '#22d3ee';
    ctx.lineWidth = Math.max(1.1, u * 0.045);
    ctx.beginPath();
    ctx.roundRect(-u * 0.46, -u * 0.24, u * 0.34, u * 0.48, u * 0.08);
    ctx.fill();
    ctx.stroke();
    // Spinning propeller blur when throttling
    if (dpvThrusting) {
      const spin = Math.sin(timeSec * 42) * u * 0.16;
      ctx.strokeStyle = scSpec.accent || 'rgba(103, 232, 249, 0.9)';
      ctx.lineWidth = Math.max(1.4, u * 0.06);
      ctx.beginPath();
      ctx.moveTo(-u * 0.38, -Math.abs(spin) - u * 0.04);
      ctx.lineTo(-u * 0.38, Math.abs(spin) + u * 0.04);
      ctx.stroke();
    }
    // Streamlined torpedo battery body & nosecone tinted to equipped Scooter model
    ctx.fillStyle = scSpec.hull || '#facc15';
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
    // Accent racing stripe along torpedo body
    ctx.strokeStyle = scSpec.accent || '#38bdf8';
    ctx.lineWidth = Math.max(1, u * 0.045);
    ctx.beginPath();
    ctx.moveTo(-u * 0.08, 0);
    ctx.lineTo(u * 0.34, 0);
    ctx.stroke();
    // Legendary Valkyrie supercavitation plasma arc on nosecone
    if (isLegDpv) {
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
      ctx.lineWidth = Math.max(1.2, u * 0.05);
      ctx.beginPath();
      ctx.arc(u * 0.34, 0, u * 0.28, -0.78, 0.78);
      ctx.stroke();
    }
    // Nosecone active status LED
    ctx.fillStyle = dpvThrusting ? (scSpec.accent || '#67e8f9') : '#4ade80';
    ctx.beginPath();
    ctx.arc(u * 0.34, 0, Math.max(1.4, u * 0.055), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Shared rounded-cap drysuit limb segment used identically by CaveRenderer,
 * Gear Workshop Test-Tank Preview, and Home Screen Mini-Avatar Badge (v166).
 */
export function drawDiverLimbSegment(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, width);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Shared articulated diver leg + boot + scalloped Jet Fin renderer (v166).
 * Keeps fin blade color cohesive across both legs (using finColor for blade + finTip for
 * trailing edge & rail accents) so live gameplay and Gear Workshop preview match 1:1.
 */
export function drawArticulatedDiverLeg(
  ctx,
  px,
  py,
  kx,
  ky,
  ax,
  ay,
  fx,
  fy,
  finOpen,
  scale,
  isPeer,
  isBackLeg,
  liveryPalette = null,
  timeSec = 0
) {
  const suitColor = liveryPalette
    ? (isBackLeg ? liveryPalette.suitBot : liveryPalette.suitMid)
    : (isBackLeg ? '#09111e' : '#111c2d');
  const finBladeColor = liveryPalette
    ? liveryPalette.finColor
    : isPeer
      ? (isBackLeg ? '#7c2d12' : '#9a3412')
      : (isBackLeg ? '#0c4a6e' : '#0369a1');
  let finAccentColor = liveryPalette
    ? liveryPalette.finTip
    : isPeer
      ? '#fb923c'
      : '#38bdf8';
  if (liveryPalette?.trimFx === 'selenite-prism') {
    finAccentColor = `hsl(${Math.round((timeSec * 90 + (isBackLeg ? 50 : 0)) % 360)}, 92%, 78%)`;
  } else if (liveryPalette?.trimFx === 'foundry-sparks') {
    finAccentColor = `hsl(30, 98%, ${56 + Math.round(Math.sin(timeSec * 6.5) * 14)}%)`;
  } else if (liveryPalette?.trimFx === 'plasma-wave') {
    const p = 0.5 + 0.5 * Math.sin(timeSec * 5.2 - (isBackLeg ? 0.8 : 0));
    finAccentColor = p > 0.65 ? '#e0f2fe' : '#38bdf8';
  }

  ctx.save();
  if (isBackLeg) ctx.globalAlpha *= 0.86;

  // Thigh & calf drysuit segments
  drawDiverLimbSegment(ctx, px, py, kx, ky, 0.21 * scale, suitColor);
  drawDiverLimbSegment(ctx, kx, ky, ax, ay, 0.16 * scale, suitColor);

  // Subtle Kevlar knee pad cap
  if (scale >= 14) {
    ctx.fillStyle = liveryPalette?.suitTop || '#1e293b';
    ctx.beginPath();
    ctx.arc(kx, ky, Math.max(1.4, 0.085 * scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Ankle & Boot Heel anchored at (ax, ay) aligned with fin direction
  const ang = Math.atan2(fy - ay, fx - ax);
  const dirX = Math.cos(ang);
  const dirY = Math.sin(ang);
  const nx = -dirY;
  const ny = dirX;
  const finLen = Math.hypot(fx - ax, fy - ay);

  const heelX = ax - dirX * (0.04 * scale);
  const heelY = ay - dirY * (0.04 * scale);
  const pocketX = ax + dirX * (0.14 * scale);
  const pocketY = ay + dirY * (0.14 * scale);
  drawDiverLimbSegment(ctx, heelX, heelY, pocketX, pocketY, 0.135 * scale, '#1e293b');

  // Scuba Jet Fin blade extending cleanly from foot pocket to finTip
  const open = finOpen ?? 0.65;
  const baseHalfW = Math.max(1.5, 0.045 * scale * (0.55 + open * 0.45));
  const tipHalfW = Math.max(2.0, 0.115 * scale * (0.35 + open * 0.75));
  const bladeStartX = ax + dirX * (0.08 * scale);
  const bladeStartY = ay + dirY * (0.08 * scale);
  const midX = bladeStartX * 0.46 + fx * 0.54;
  const midY = bladeStartY * 0.46 + fy * 0.54;

  ctx.fillStyle = finBladeColor;
  ctx.beginPath();
  ctx.moveTo(bladeStartX + nx * baseHalfW, bladeStartY + ny * baseHalfW);
  ctx.quadraticCurveTo(
    midX + nx * (baseHalfW * 0.6 + tipHalfW * 0.45),
    midY + ny * (baseHalfW * 0.6 + tipHalfW * 0.45),
    fx + nx * tipHalfW,
    fy + ny * tipHalfW
  );
  // Scalloped jet-fin trailing tip
  ctx.quadraticCurveTo(
    fx - dirX * (0.03 * scale),
    fy - dirY * (0.03 * scale),
    fx - nx * tipHalfW,
    fy - ny * tipHalfW
  );
  ctx.quadraticCurveTo(
    midX - nx * (baseHalfW * 0.6 + tipHalfW * 0.45),
    midY - ny * (baseHalfW * 0.6 + tipHalfW * 0.45),
    bladeStartX - nx * baseHalfW,
    bladeStartY - ny * baseHalfW
  );
  ctx.closePath();
  ctx.fill();

  // Bold high-vis trailing fin-tip accent band + side rails matching Workshop Trim/Fin Accent
  if (finLen > 4) {
    if (liveryPalette?.trimSpec?.id === 'world-hydro-fins') {
      // Split-blade hydro-fin vortex channel glowing aqua down the blade center
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = Math.max(1.3, 0.036 * scale);
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(fx - dirX * (0.02 * scale), fy - dirY * (0.02 * scale));
      ctx.stroke();
    }
    ctx.strokeStyle = finAccentColor;
    ctx.lineWidth = Math.max(1.4, 0.042 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx + nx * tipHalfW, fy + ny * tipHalfW);
    ctx.quadraticCurveTo(
      fx - dirX * (0.03 * scale),
      fy - dirY * (0.03 * scale),
      fx - nx * tipHalfW,
      fy - ny * tipHalfW
    );
    ctx.stroke();

    ctx.strokeStyle = isBackLeg ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.72)';
    ctx.lineWidth = Math.max(1, 0.025 * scale);
    ctx.beginPath();
    ctx.moveTo(bladeStartX + nx * baseHalfW, bladeStartY + ny * baseHalfW);
    ctx.lineTo(fx + nx * tipHalfW, fy + ny * tipHalfW);
    ctx.moveTo(bladeStartX - nx * baseHalfW, bladeStartY - ny * baseHalfW);
    ctx.lineTo(fx - nx * tipHalfW, fy - ny * tipHalfW);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, 0.02 * scale);
    ctx.beginPath();
    ctx.moveTo(pocketX, pocketY);
    ctx.lineTo(ax + dirX * (finLen * 0.62), ay + dirY * (finLen * 0.62));
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Shared articulated diver arm, glowing wrist dive computer, and Goodman-handle primary torch (v166).
 * Uses custom drysuit sleeve colors and equipped torch optic lens tint across gameplay & Workshop.
 */
/**
 * High-detail Pneumatic Titanium Speargun with Twin Power Bands, Pressure Gauge,
 * Underslung Line Reel, Barbed Spear Shaft & Mounted Tactical Dive Flashlight (v181).
 * Shared between diver hands (`drawDiverArmAndTorch`) and the Armory Rack pedestal.
 */
export function drawDetailedSpeargun(ctx, scale, {
  torchOn = true,
  lensColor = '#fef08a',
  glowStamps = null,
  recoil = 0,
  muzzleFlash = 0,
  harpoonSpec = null,
} = {}) {
  const s = scale;
  const hpBarrel = harpoonSpec?.barrel || '#cbd5e1';
  const hpRail = harpoonSpec?.rail || '#38bdf8';
  const hpBand = harpoonSpec?.band || '#f59e0b';
  const hpTip = harpoonSpec?.tip || '#bae6fd';
  const recoilPx = Math.max(0, Number(recoil) || 0) * 0.24 * s;
  ctx.save();
  ctx.translate(-recoilPx, 0);

  // 1. Contoured Chest-Loading Butt Pad & Receiver Stock
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(1, 0.022 * s);
  ctx.beginPath();
  ctx.moveTo(-0.34 * s, -0.075 * s);
  ctx.lineTo(-0.12 * s, -0.08 * s);
  ctx.lineTo(-0.10 * s, 0.075 * s);
  ctx.lineTo(-0.30 * s, 0.115 * s);
  ctx.quadraticCurveTo(-0.37 * s, 0.02 * s, -0.34 * s, -0.075 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ribbed rubber recoil pad strip on butt
  ctx.fillStyle = '#334155';
  ctx.fillRect(-0.34 * s, -0.055 * s, 0.055 * s, 0.15 * s);

  // 2. Ergonomic Molded Pistol Grip, Finger Grooves & Stainless Trigger Guard
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.max(1, 0.02 * s);
  ctx.beginPath();
  ctx.moveTo(-0.11 * s, 0.04 * s);
  ctx.lineTo(-0.22 * s, 0.27 * s);
  ctx.lineTo(-0.06 * s, 0.29 * s);
  ctx.lineTo(0.05 * s, 0.07 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Grip texture ridges
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = Math.max(0.8, 0.016 * s);
  ctx.beginPath();
  ctx.moveTo(-0.15 * s, 0.11 * s);
  ctx.lineTo(-0.06 * s, 0.12 * s);
  ctx.moveTo(-0.17 * s, 0.17 * s);
  ctx.lineTo(-0.08 * s, 0.18 * s);
  ctx.moveTo(-0.19 * s, 0.23 * s);
  ctx.lineTo(-0.10 * s, 0.24 * s);
  ctx.stroke();
  // Trigger guard loop & stainless trigger blade
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1, 0.022 * s);
  ctx.beginPath();
  ctx.moveTo(0.03 * s, 0.06 * s);
  ctx.quadraticCurveTo(0.14 * s, 0.17 * s, 0.02 * s, 0.18 * s);
  ctx.stroke();
  ctx.strokeStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0.05 * s, 0.07 * s);
  ctx.lineTo(0.03 * s, 0.14 * s);
  ctx.stroke();

  // 3. Underslung Anodized Line Spool Reel (coiled golden Dyneema tether!)
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.max(1, 0.02 * s);
  ctx.beginPath();
  ctx.arc(0.24 * s, 0.145 * s, 0.095 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(0.24 * s, 0.145 * s, 0.062 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(0.24 * s, 0.145 * s, 0.024 * s, 0, Math.PI * 2);
  ctx.fill();

  // 4. Sculpted Carbon-Core & Brushed-Titanium Pneumatic Barrel + Receiver Block
  const barrelGrad = ctx.createLinearGradient(0, -0.10 * s, 0, 0.08 * s);
  barrelGrad.addColorStop(0, '#f8fafc');
  barrelGrad.addColorStop(0.32, hpBarrel);
  barrelGrad.addColorStop(0.65, '#475569');
  barrelGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = barrelGrad;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = Math.max(1, 0.022 * s);
  ctx.beginPath();
  ctx.roundRect(-0.14 * s, -0.092 * s, 1.06 * s, 0.155 * s, 0.042 * s);
  ctx.fill();
  ctx.stroke();

  // Machined barrel cooling slots & glowing pneumatic pressure rail
  ctx.fillStyle = hpRail;
  ctx.fillRect(0.08 * s, -0.052 * s, 0.72 * s, 0.036 * s);
  ctx.fillStyle = hpTip;
  ctx.fillRect(0.10 * s, -0.046 * s, 0.68 * s, 0.016 * s);
  ctx.fillStyle = '#0f172a';
  for (let k = 0; k < 5; k++) {
    ctx.fillRect((0.20 + k * 0.115) * s, -0.082 * s, 0.048 * s, 0.022 * s);
  }

  // Miniature Side Pneumatic Pressure Gauge Dial on Receiver
  ctx.fillStyle = '#020617';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(0.8, 0.018 * s);
  ctx.beginPath();
  ctx.arc(-0.02 * s, -0.015 * s, 0.052 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = hpRail;
  ctx.lineWidth = Math.max(0.8, 0.016 * s);
  ctx.beginPath();
  ctx.moveTo(-0.02 * s, -0.015 * s);
  ctx.lineTo(0.015 * s, -0.042 * s);
  ctx.stroke();

  // 5. Twin Tensioned Power Sling Bands stretching from Wishbone Notch to Muzzle Roller Pulleys
  ctx.strokeStyle = hpBand;
  ctx.lineWidth = Math.max(1.2, 0.03 * s);
  ctx.beginPath();
  ctx.moveTo(0.16 * s, -0.068 * s);
  ctx.lineTo(0.88 * s, -0.075 * s);
  ctx.moveTo(0.22 * s, 0.048 * s);
  ctx.lineTo(0.88 * s, 0.036 * s);
  ctx.stroke();

  // Machined Muzzle Head & Roller Pulley Wheel
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(1, 0.02 * s);
  ctx.beginPath();
  ctx.roundRect(0.84 * s, -0.105 * s, 0.13 * s, 0.185 * s, 0.03 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hpRail;
  ctx.beginPath();
  ctx.arc(0.905 * s, -0.068 * s, 0.028 * s, 0, Math.PI * 2);
  ctx.fill();

  // 6. Long Gleaming Stainless Barbed Spear Shaft & Dual Flopper Tri-Cut Tip
  if (recoilPx < 0.09 * s) {
    // Upper guide shaft
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = Math.max(1.6, 0.044 * s);
    ctx.beginPath();
    ctx.moveTo(0.14 * s, -0.025 * s);
    ctx.lineTo(1.34 * s, -0.025 * s);
    ctx.stroke();
    // Dual hinged flopper barbs + razor broadhead tip
    ctx.fillStyle = hpTip;
    ctx.strokeStyle = hpRail;
    ctx.lineWidth = Math.max(0.8, 0.016 * s);
    ctx.beginPath();
    ctx.moveTo(1.52 * s, -0.025 * s);
    ctx.lineTo(1.24 * s, -0.105 * s);
    ctx.lineTo(1.30 * s, -0.025 * s);
    ctx.lineTo(1.24 * s, 0.055 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Secondary barb notch
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = Math.max(1, 0.024 * s);
    ctx.beginPath();
    ctx.moveTo(1.16 * s, -0.025 * s);
    ctx.lineTo(1.06 * s, -0.075 * s);
    ctx.stroke();
  }

  // 7. Mounted Tactical Dive Flashlight strapped directly onto the front end of the barrel!
  // Twin CNC-machined mount clamps
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0.55 * s, 0.045 * s, 0.075 * s, 0.055 * s);
  ctx.fillRect(0.76 * s, 0.045 * s, 0.075 * s, 0.055 * s);
  // Ribbed anodized flashlight canister body
  const torchGrad = ctx.createLinearGradient(0, 0.07 * s, 0, 0.21 * s);
  torchGrad.addColorStop(0, '#f1f5f9');
  torchGrad.addColorStop(0.5, '#94a3b8');
  torchGrad.addColorStop(1, '#334155');
  ctx.fillStyle = torchGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(0.9, 0.02 * s);
  ctx.beginPath();
  ctx.roundRect(0.49 * s, 0.078 * s, 0.36 * s, 0.115 * s, 0.032 * s);
  ctx.fill();
  ctx.stroke();
  // Flared crenellated chrome bezel head on end of flashlight
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(0.83 * s, 0.064 * s, 0.14 * s, 0.142 * s, 0.03 * s);
  ctx.fill();
  ctx.stroke();
  // Heat-sink cooling grooves on bezel
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(0.8, 0.015 * s);
  ctx.beginPath();
  ctx.moveTo(0.865 * s, 0.072 * s);
  ctx.lineTo(0.865 * s, 0.198 * s);
  ctx.moveTo(0.905 * s, 0.072 * s);
  ctx.lineTo(0.905 * s, 0.198 * s);
  ctx.stroke();

  if (torchOn) {
    // Glowing recessed optical lens & bright forward hotspot flare
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0.975 * s, 0.135 * s, 0.032 * s, 0.056 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lensColor;
    ctx.beginPath();
    ctx.arc(0.985 * s, 0.135 * s, 0.048 * s, 0, Math.PI * 2);
    ctx.fill();
    if (glowStamps?.warm) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.68;
      const lR = 0.34 * s;
      ctx.drawImage(glowStamps.warm, 0.99 * s - lR, 0.135 * s - lR, lR * 2, lR * 2);
    }
  }

  // Pneumatic cavitation muzzle flash ring when firing
  if ((muzzleFlash || 0) > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const mf = Math.min(1, muzzleFlash * 11);
    ctx.fillStyle = `rgba(125, 211, 252, ${(mf * 0.88).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(1.12 * s, -0.025 * s, 0.36 * s * mf, 0.17 * s * mf, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(224, 242, 254, ${(mf * 0.9).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, 0.04 * s);
    ctx.beginPath();
    ctx.arc(1.02 * s, -0.025 * s, 0.22 * s * (1.2 - mf * 0.4), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawDiverArmAndTorch(
  ctx,
  shoulderX,
  shoulderY,
  elbowX,
  elbowY,
  hx,
  hy,
  torchAng,
  scale,
  isPeer,
  liveryPalette = null,
  opts = null
) {
  const torchOn = opts?.torchOn !== false;
  const glowStamps = opts?.glowStamps || null;
  const upperColor = liveryPalette?.suitTop || '#1e293b';
  const foreColor = liveryPalette?.suitMid || '#0f172a';
  const trimColor = liveryPalette?.trim || (isPeer ? '#fdba74' : '#22d3ee');
  const lensColor = liveryPalette?.torch?.swatch || '#fef08a';

  // Articulated upper arm & forearm in custom drysuit colorway
  drawDiverLimbSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 0.14 * scale, upperColor);
  drawDiverLimbSegment(ctx, elbowX, elbowY, hx, hy, 0.12 * scale, foreColor);

  // Glowing wrist dive computer on forearm
  const wrX = elbowX * 0.46 + hx * 0.54;
  const wrY = elbowY * 0.46 + hy * 0.54;
  ctx.save();
  ctx.translate(wrX, wrY);
  ctx.rotate(Math.atan2(hy - elbowY, hx - elbowX));
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-0.07 * scale, -0.055 * scale, 0.14 * scale, 0.11 * scale, 0.025 * scale);
  ctx.fill();
  ctx.fillStyle = trimColor;
  ctx.fillRect(-0.045 * scale, -0.032 * scale, 0.09 * scale, 0.064 * scale);
  const wrGlow = isPeer ? glowStamps?.warm : glowStamps?.cyan;
  if (wrGlow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.42;
    const gR = 0.22 * scale;
    ctx.drawImage(wrGlow, -gR, -gR, gR * 2, gR * 2);
  }
  ctx.restore();

  // Primary weapon/light gripped in hand: High-Detail Pneumatic Titanium Speargun with Underslung Dive Torch, OR standard Goodman torch
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(torchAng);
  if (opts?.hasSpeargun) {
    if (Math.cos(torchAng) < 0) ctx.scale(1, -1);
    drawDetailedSpeargun(ctx, scale * 0.86, {
      torchOn,
      lensColor,
      glowStamps,
      recoil: opts.spearRecoil || 0,
      muzzleFlash: opts.muzzleFlash || 0,
      harpoonSpec: liveryPalette?.harpoon || null,
    });
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-0.1 * scale, -0.055 * scale, 0.28 * scale, 0.11 * scale, 0.03 * scale);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(0.8, 0.018 * scale);
    ctx.stroke();
    if (torchOn) {
      const tSec = opts?.timeSec || 0;
      const torchFx = liveryPalette?.torchFx || '';
      ctx.fillStyle = lensColor;
      ctx.beginPath();
      ctx.arc(0.18 * scale, 0, 0.052 * scale, 0, Math.PI * 2);
      ctx.fill();
      if (torchFx) {
        const pulse = 0.55 + 0.45 * Math.sin(tSec * 5.5);
        ctx.strokeStyle = lensColor;
        ctx.globalAlpha = 0.45 + pulse * 0.45;
        ctx.lineWidth = Math.max(1.1, 0.024 * scale);
        ctx.beginPath();
        ctx.arc(0.18 * scale, 0, (0.075 + pulse * 0.032) * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (glowStamps?.warm) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55;
        const lR = 0.26 * scale;
        ctx.drawImage(glowStamps.warm, 0.18 * scale - lR, -lR, lR * 2, lR * 2);
      }
    }
  }
  ctx.restore();
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

  // Trailing gossamer tentacles (batched single stroke)
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.34)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  for (let t = -2; t <= 2; t++) {
    const ox = t * rx * 0.32;
    const len = r * (1.55 + (t % 2 === 0 ? 0.45 : 0.15));
    const sway = Math.sin(timeSec * 2.1 + t + (j.phase || 0)) * r * 0.35;
    ctx.moveTo(ox, ry * 0.2);
    ctx.quadraticCurveTo(ox + sway, len * 0.55, ox - sway * 0.7, len);
  }
  ctx.stroke();

  // Translucent bioluminescent bell with cel-shaded crown glow & delicate ink rim (v192)
  const bellG = ctx.createRadialGradient(-rx * 0.2, -ry * 0.45, r * 0.08, 0, -ry * 0.1, rx * 1.1);
  bellG.addColorStop(0, 'rgba(240, 249, 255, 0.72)');
  bellG.addColorStop(0.5, j.hue || '#38bdf8');
  bellG.addColorStop(1, 'rgba(14, 116, 144, 0.28)');
  ctx.fillStyle = bellG;
  ctx.globalAlpha = 0.52;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(0, ry * 0.45, -rx, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.78;
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = Math.max(1.2, r * 0.065);
  ctx.stroke();

  // Four-leaf moon jellyfish horseshoe gonad clover + specular dome gleam
  ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
  for (let g = 0; g < 4; g++) {
    const ga = (g / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.arc(Math.cos(ga) * rx * 0.2, -ry * 0.28 + Math.sin(ga) * ry * 0.14, rx * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Helper: tiny sleek pilot fish / remora cruising in a megafauna's slipstream (v165).
 */
function drawSlipstreamPilotFish(ctx, x, y, len, timeSec, phase, striped = true) {
  const wag = Math.sin(timeSec * 8.5 + phase) * len * 0.16;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = striped ? '#cbd5e1' : '#64748b';
  ctx.beginPath();
  ctx.moveTo(len * 0.55, 0);
  ctx.quadraticCurveTo(len * 0.1, -len * 0.18, -len * 0.36, wag * 0.25);
  ctx.lineTo(-len * 0.58, -len * 0.18 + wag);
  ctx.lineTo(-len * 0.45, wag * 0.5);
  ctx.lineTo(-len * 0.58, len * 0.18 + wag);
  ctx.lineTo(-len * 0.36, wag * 0.25);
  ctx.quadraticCurveTo(len * 0.1, len * 0.18, len * 0.55, 0);
  ctx.closePath();
  ctx.fill();
  if (striped) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.lineWidth = Math.max(0.9, len * 0.08);
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(b * len * 0.17, -len * 0.11);
      ctx.lineTo(b * len * 0.17 - len * 0.03, len * 0.11);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Helper: subtle dappled sunlight caustic bands shimmering across a giant creature's upper back (v165).
 */
function drawDorsalCaustics(ctx, x0, x1, yMid, bandH, timeSec, phase, alpha = 0.18) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = `rgba(186, 230, 253, ${alpha.toFixed(3)})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, bandH * 0.18);
  const count = 4;
  for (let i = 0; i < count; i++) {
    const t = ((i / count) + ((timeSec * 0.14 + phase * 0.17) % 1)) % 1;
    const cx = x0 + (x1 - x0) * t;
    const w = (x1 - x0) * 0.11;
    const wy = yMid + Math.sin(timeSec * 2.4 + i * 1.9 + phase) * bandH * 0.22;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.85;
    ctx.beginPath();
    ctx.moveTo(cx - w, wy - bandH * 0.12);
    ctx.quadraticCurveTo(cx, wy + bandH * 0.14, cx + w, wy - bandH * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Helper: sculpted tapered muscular tentacle polygon with optional inner suction cups (v165).
 */
function drawTaperedTentacle(ctx, pts, rStart, rEnd, fillStyle, suckerColor = null) {
  const n = pts.length;
  if (n < 2) return;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(n - 1, i + 1)];
    const tx = pNext.x - pPrev.x;
    const ty = pNext.y - pPrev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    // Organic muscular taper (thick base -> fine curling whip tip)
    const r = rStart * Math.pow(1 - t, 0.82) + rEnd * t;
    left.push({ x: pts[i].x + nx * r, y: pts[i].y + ny * r });
    right.push({ x: pts[i].x - nx * r, y: pts[i].y - ny * r });
  }
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();

  // Delicate pale ivory suction cups lining the lower/inner muscular curve
  if (suckerColor) {
    ctx.fillStyle = suckerColor;
    for (let i = 1; i < n - 1; i++) {
      const t = i / (n - 1);
      const r = Math.max(1.0, (rStart * Math.pow(1 - t, 0.85) + rEnd * t) * 0.36);
      const sx = right[i].x + (pts[i].x - right[i].x) * 0.28;
      const sy = right[i].y + (pts[i].y - right[i].y) * 0.28;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Cathedral-scale Whale Shark pelagic giant (v165):
 * Flattened filter-feeding snout, 3 longitudinal dermal ridges, countershaded indigo-to-silver body,
 * authentic staggered cream polka-dot constellation & faint vertical checkerboard bars, plus escort remoras.
 */
export function drawStyledWhaleShark(ctx, v, sx, sy, scale, timeSec) {
  const sz = (v.size || 5.4) * scale;
  const dir = (v.dir ?? ((v.vx || 1) >= 0 ? 1 : -1)) < 0 ? -1 : 1;
  const phase = v.swimPhase ?? (timeSec * 1.45 + (v.phase || 0));
  const midW = Math.sin(phase) * sz * 0.025;
  const pedW = Math.sin(phase - 1.1) * sz * 0.055;
  const tailW = Math.sin(phase - 1.9) * sz * 0.095;

  ctx.save();
  ctx.translate(sx, sy);
  if (dir < 0) ctx.scale(-1, 1);

  // Far shadowed pectoral fin
  ctx.fillStyle = '#0a1f36';
  ctx.beginPath();
  ctx.moveTo(sz * 0.24, sz * 0.08);
  ctx.quadraticCurveTo(sz * 0.06, sz * 0.26, -sz * 0.1, sz * 0.21);
  ctx.lineTo(-sz * 0.02, sz * 0.08);
  ctx.closePath();
  ctx.fill();

  // Tall sweeping first dorsal & smaller second dorsal
  ctx.fillStyle = '#153454';
  ctx.beginPath();
  ctx.moveTo(sz * 0.06, -sz * 0.13 + midW * 0.4);
  ctx.quadraticCurveTo(-sz * 0.08, -sz * 0.34 + midW * 0.5, -sz * 0.18, -sz * 0.29 + midW * 0.5);
  ctx.quadraticCurveTo(-sz * 0.14, -sz * 0.17 + midW * 0.4, -sz * 0.19, -sz * 0.11 + midW * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-sz * 0.28, -sz * 0.09 + pedW * 0.6);
  ctx.quadraticCurveTo(-sz * 0.35, -sz * 0.18 + pedW * 0.7, -sz * 0.4, -sz * 0.07 + pedW * 0.7);
  ctx.closePath();
  ctx.fill();

  // Massive asymmetric lunate heterocercal tail fluke
  ctx.fillStyle = '#102b47';
  ctx.beginPath();
  ctx.moveTo(-sz * 0.48, pedW);
  ctx.quadraticCurveTo(-sz * 0.62, -sz * 0.24 + tailW, -sz * 0.74, -sz * 0.33 + tailW);
  ctx.quadraticCurveTo(-sz * 0.66, -sz * 0.08 + tailW * 0.85, -sz * 0.58, tailW * 0.75);
  ctx.quadraticCurveTo(-sz * 0.65, sz * 0.14 + tailW * 0.85, -sz * 0.68, sz * 0.22 + tailW);
  ctx.quadraticCurveTo(-sz * 0.56, sz * 0.09 + pedW, -sz * 0.46, sz * 0.04 + pedW);
  ctx.closePath();
  ctx.fill();

  // Countershaded monumental fusiform body with broad flattened filter-feeding snout
  const bodyGrad = ctx.createLinearGradient(0, -sz * 0.18, 0, sz * 0.18);
  bodyGrad.addColorStop(0, '#0f2944');
  bodyGrad.addColorStop(0.54, '#21486e');
  bodyGrad.addColorStop(0.76, '#6489aa');
  bodyGrad.addColorStop(1, '#dbeafe');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(sz * 0.58, -sz * 0.04);
  ctx.quadraticCurveTo(sz * 0.56, -sz * 0.13, sz * 0.34, -sz * 0.16);
  ctx.bezierCurveTo(sz * 0.08, -sz * 0.17 + midW * 0.4, -sz * 0.22, -sz * 0.12 + pedW * 0.6, -sz * 0.5, -sz * 0.025 + pedW);
  ctx.lineTo(-sz * 0.5, sz * 0.03 + pedW);
  ctx.bezierCurveTo(-sz * 0.22, sz * 0.1 + pedW * 0.6, sz * 0.1, sz * 0.16 + midW * 0.4, sz * 0.42, sz * 0.13);
  ctx.quadraticCurveTo(sz * 0.58, sz * 0.1, sz * 0.58, sz * 0.03);
  ctx.closePath();
  ctx.fill();

  // Subtle wide filter-feeding mouth line & 5 long gill slits
  ctx.strokeStyle = 'rgba(7, 19, 34, 0.55)';
  ctx.lineWidth = Math.max(1.2, sz * 0.012);
  ctx.beginPath();
  ctx.moveTo(sz * 0.58, sz * 0.025);
  ctx.quadraticCurveTo(sz * 0.49, sz * 0.045, sz * 0.44, sz * 0.035);
  ctx.stroke();
  for (let g = 0; g < 5; g++) {
    const gx = sz * (0.34 - g * 0.032);
    ctx.beginPath();
    ctx.moveTo(gx, -sz * 0.04);
    ctx.quadraticCurveTo(gx - sz * 0.01, sz * 0.025, gx - sz * 0.004, sz * 0.075);
    ctx.stroke();
  }

  // Authentic Whale Shark staggered cream constellation spots + delicate vertical pale checkerboard bars
  ctx.save();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
  ctx.lineWidth = Math.max(1, sz * 0.008);
  for (let c = 0; c < 8; c++) {
    const bx = sz * (0.38 - c * 0.1);
    const wOff = c > 4 ? pedW * 0.5 : midW * 0.35;
    ctx.beginPath();
    ctx.moveTo(bx, -sz * 0.11 + wOff);
    ctx.quadraticCurveTo(bx - sz * 0.015, wOff, bx, sz * 0.06 + wOff);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(224, 242, 254, 0.76)';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 11; c++) {
      const h1 = Math.sin(r * 17.3 + c * 31.7) * 0.5;
      const h2 = Math.cos(r * 23.1 + c * 19.9) * 0.5;
      const px = sz * (0.44 - c * 0.082 - (r % 2) * 0.032 + h1 * 0.022);
      const wOff = c > 5 ? pedW * 0.55 : midW * 0.35;
      const py = sz * (-0.115 + r * 0.052 + h2 * 0.018) + wOff;
      const rad = Math.max(0.9, sz * (0.0125 + h1 * 0.0045 - Math.abs(r - 1.5) * 0.0018));
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Foreground broad swept pectoral fin with pale leading-edge sheen
  ctx.fillStyle = '#1b3f63';
  ctx.beginPath();
  ctx.moveTo(sz * 0.26, sz * 0.07 + midW * 0.2);
  ctx.quadraticCurveTo(sz * 0.06, sz * 0.34 + midW * 0.5, -sz * 0.12, sz * 0.29 + midW * 0.4);
  ctx.quadraticCurveTo(-sz * 0.02, sz * 0.16, -sz * 0.04, sz * 0.08 + midW * 0.3);
  ctx.closePath();
  ctx.fill();
  // Spots along pectoral fin
  ctx.fillStyle = 'rgba(224, 242, 254, 0.48)';
  for (let s = 0; s < 4; s++) {
    ctx.beginPath();
    ctx.arc(sz * (0.14 - s * 0.05), sz * (0.15 + s * 0.032), Math.max(0.9, sz * 0.009), 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark side-set eye near broad snout corner
  ctx.fillStyle = '#040914';
  ctx.beginPath();
  ctx.arc(sz * 0.48, -sz * 0.01, Math.max(1.6, sz * 0.016), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
  ctx.beginPath();
  ctx.arc(sz * 0.485, -sz * 0.014, Math.max(0.7, sz * 0.006), 0, Math.PI * 2);
  ctx.fill();

  // Shimmering dorsal caustics + 3 escort remoras gliding under its belly
  drawDorsalCaustics(ctx, -sz * 0.35, sz * 0.46, -sz * 0.09, sz * 0.08, timeSec, v.phase || 0, 0.22);
  drawSlipstreamPilotFish(ctx, sz * 0.18, sz * 0.22, sz * 0.12, timeSec, 0.5, false);
  drawSlipstreamPilotFish(ctx, -sz * 0.12, sz * 0.19, sz * 0.1, timeSec, 2.2, false);
  drawSlipstreamPilotFish(ctx, sz * 0.38, sz * 0.17, sz * 0.085, timeSec, 4.1, true);

  ctx.restore();
}

/**
 * Museum-grade oceanic & polar megafauna (v165):
 * - manta: 3/4 side-profile Giant Oceanic Manta Ray with depth-layered flexing wings, shoulder chevrons & remoras
 * - beluga: Sculpted pearlescent Arctic Beluga Whale with spine flexion, forehead melon & rising bubble rings
 * - shark: Articulated Carcharhinid Gray Reef / Oceanic Whitetip Shark with 3-point body wave & pilot fish
 * - grouper / laketrout: Heavyweight mottled wreck monarch with spiny dorsal rays & pulsing gill cover
 */
export function drawStyledMegafauna(ctx, m, sx, sy, scale, timeSec) {
  const sz = (m.size || 1.5) * scale;
  const facingLeft = m.facing !== undefined ? m.facing < 0 : (m.vx || 0) < 0;
  const pitch = Number.isFinite(m.pitch) ? m.pitch : 0;
  const phase = m.swimPhase ?? (timeSec * (m.kind === 'shark' ? 3.2 : m.kind === 'manta' ? 2.1 : 2.3) + (m.phase || 0));
  const litBoost = Math.max(0, Math.min(1, Number(m.litIntensity) || 0));

  // 1. World-space trailing plankton / bioluminescent vortex motes (replaces cartoon UI ring!)
  if (Array.isArray(m.trail) && m.trail.length > 0) {
    ctx.save();
    for (let i = 0; i < m.trail.length; i++) {
      const pt = m.trail[i];
      const px = sx + (pt.x - m.x) * scale;
      const py = sy + (pt.y - m.y) * scale;
      const frac = Math.max(0, Math.min(1, pt.life / Math.max(0.1, pt.maxLife || 2.0)));
      const pr = Math.max(1.1, (pt.r || 0.08) * scale * (0.6 + frac * 0.6));
      ctx.fillStyle = pt.golden
        ? `rgba(186, 230, 253, ${(frac * 0.55).toFixed(3)})`
        : `rgba(148, 210, 240, ${(frac * 0.34).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Playful Arctic Beluga silver air bubble rings drifting upward
  if (Array.isArray(m.bubbleRings) && m.bubbleRings.length > 0) {
    ctx.save();
    for (let i = 0; i < m.bubbleRings.length; i++) {
      const br = m.bubbleRings[i];
      const bx = sx + (br.x - m.x) * scale;
      const by = sy + (br.y - m.y) * scale;
      const rx = Math.max(2.5, (br.r || 0.25) * scale);
      const ry = rx * 0.34;
      const frac = Math.max(0, Math.min(1, br.life / Math.max(0.1, br.maxLife || 3.8)));
      ctx.strokeStyle = `rgba(224, 242, 254, ${(frac * 0.72).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.4, rx * 0.18);
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${(frac * 0.45).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.8, rx * 0.07);
      ctx.beginPath();
      ctx.ellipse(bx, by - ry * 0.18, rx * 0.92, ry * 0.72, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(sx, sy);
  if (facingLeft) {
    ctx.scale(-1, 1);
    ctx.rotate(-pitch);
  } else {
    ctx.rotate(pitch);
  }

  if (m.kind === 'shark') {
    // Articulated Carcharhinid Gray Reef / Oceanic Whitetip Shark with 3-point traveling spine wave
    const midW = Math.sin(phase) * sz * 0.04;
    const pedW = Math.sin(phase - 1.05) * sz * 0.1;
    const tailW = Math.sin(phase - 1.85) * sz * 0.19;
    ctx.globalAlpha = 0.92;

    // Far shadowed pectoral & pelvic fins
    ctx.fillStyle = '#1e2f42';
    ctx.beginPath();
    ctx.moveTo(sz * 0.46, sz * 0.12);
    ctx.quadraticCurveTo(sz * 0.22, sz * 0.46, -sz * 0.08, sz * 0.36);
    ctx.lineTo(sz * 0.05, sz * 0.14);
    ctx.closePath();
    ctx.fill();

    // Sweeping heterocercal caudal fin with realistic upper-lobe subterminal notch
    ctx.fillStyle = '#25394f';
    ctx.beginPath();
    ctx.moveTo(-sz * 1.08, pedW);
    ctx.quadraticCurveTo(-sz * 1.48, -sz * 0.36 + tailW * 0.7, -sz * 1.92, -sz * 0.68 + tailW);
    ctx.lineTo(-sz * 1.72, -sz * 0.44 + tailW * 0.9);
    ctx.lineTo(-sz * 1.78, -sz * 0.38 + tailW * 0.85); // Subterminal notch
    ctx.quadraticCurveTo(-sz * 1.56, -sz * 0.08 + tailW * 0.7, -sz * 1.44, tailW * 0.6);
    ctx.quadraticCurveTo(-sz * 1.58, sz * 0.22 + tailW * 0.8, -sz * 1.66, sz * 0.36 + tailW);
    ctx.quadraticCurveTo(-sz * 1.32, sz * 0.14 + pedW, -sz * 1.04, sz * 0.05 + pedW);
    ctx.closePath();
    ctx.fill();

    // Tall falcate first dorsal + small second dorsal + anal fin
    ctx.fillStyle = '#334b63';
    ctx.beginPath();
    ctx.moveTo(sz * 0.32, -sz * 0.22 + midW * 0.4);
    ctx.quadraticCurveTo(sz * 0.06, -sz * 0.86 + midW * 0.5, -sz * 0.2, -sz * 0.78 + midW * 0.5);
    ctx.quadraticCurveTo(-sz * 0.12, -sz * 0.38 + midW * 0.5, -sz * 0.26, -sz * 0.2 + midW * 0.5);
    ctx.closePath();
    ctx.fill();
    // Subtle pale fin-tip highlight (Oceanic Whitetip / Reef Shark signature)
    ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.02, -sz * 0.72 + midW * 0.5);
    ctx.quadraticCurveTo(-sz * 0.12, -sz * 0.81 + midW * 0.5, -sz * 0.19, -sz * 0.76 + midW * 0.5);
    ctx.lineTo(-sz * 0.12, -sz * 0.62 + midW * 0.5);
    ctx.closePath();
    ctx.fill();

    // Second dorsal & anal fins
    ctx.fillStyle = '#2d445c';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.58, -sz * 0.13 + pedW * 0.7);
    ctx.lineTo(-sz * 0.76, -sz * 0.29 + pedW * 0.8);
    ctx.lineTo(-sz * 0.84, -sz * 0.09 + pedW * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.54, sz * 0.1 + pedW * 0.7);
    ctx.lineTo(-sz * 0.72, sz * 0.25 + pedW * 0.8);
    ctx.lineTo(-sz * 0.8, sz * 0.07 + pedW * 0.8);
    ctx.closePath();
    ctx.fill();

    // Streamlined countershaded fusiform body with crisp dark ink contour (v189)
    const bodyGrad = ctx.createLinearGradient(0, -sz * 0.34, 0, sz * 0.28);
    bodyGrad.addColorStop(0, '#1e3a5f');
    bodyGrad.addColorStop(0.52, '#4f6b85');
    bodyGrad.addColorStop(0.7, '#94adc4');
    bodyGrad.addColorStop(0.84, '#e2e8f0');
    bodyGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = 'rgba(4, 16, 33, 0.72)';
    ctx.lineWidth = Math.max(1.2, sz * 0.026);
    ctx.beginPath();
    ctx.moveTo(sz * 1.48, sz * 0.02);
    ctx.bezierCurveTo(sz * 0.92, -sz * 0.34, -sz * 0.24, -sz * 0.29 + midW, -sz * 1.12, -sz * 0.03 + pedW);
    ctx.lineTo(-sz * 1.12, sz * 0.05 + pedW);
    ctx.bezierCurveTo(-sz * 0.24, sz * 0.24 + midW, sz * 0.72, sz * 0.28, sz * 1.24, sz * 0.14);
    ctx.quadraticCurveTo(sz * 1.42, sz * 0.1, sz * 1.48, sz * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Near sweeping pectoral fin with pale underside edge
    const pecGrad = ctx.createLinearGradient(sz * 0.3, sz * 0.12, -sz * 0.1, sz * 0.72);
    pecGrad.addColorStop(0, '#364f69');
    pecGrad.addColorStop(0.8, '#23364a');
    pecGrad.addColorStop(1, 'rgba(226, 232, 240, 0.55)');
    ctx.fillStyle = pecGrad;
    ctx.beginPath();
    ctx.moveTo(sz * 0.48, sz * 0.14 + midW * 0.3);
    ctx.quadraticCurveTo(sz * 0.24, sz * 0.74 + midW * 0.6, -sz * 0.18, sz * 0.64 + midW * 0.5);
    ctx.quadraticCurveTo(sz * 0.02, sz * 0.32, -sz * 0.08, sz * 0.16 + midW * 0.3);
    ctx.closePath();
    ctx.fill();

    // 5 crisp curved gill slits + subtle lateral line + recessed jaw line
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.58)';
    ctx.lineWidth = Math.max(1.0, sz * 0.022);
    for (let g = 0; g < 5; g++) {
      const gx = sz * (0.64 - g * 0.068);
      ctx.beginPath();
      ctx.moveTo(gx, -sz * 0.07);
      ctx.quadraticCurveTo(gx - sz * 0.025, sz * 0.01, gx - sz * 0.01, sz * 0.1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(sz * 1.22, sz * 0.12);
    ctx.quadraticCurveTo(sz * 1.02, sz * 0.15, sz * 0.86, sz * 0.12);
    ctx.stroke();

    // Obsidian eye under sculpted brow ridge with subtle catchlight
    ctx.fillStyle = '#070e1a';
    ctx.beginPath();
    ctx.arc(sz * 1.06, -sz * 0.045, Math.max(1.6, sz * 0.04), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(224, 242, 254, ${(0.55 + litBoost * 0.35).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sz * 1.075, -sz * 0.058, Math.max(0.7, sz * 0.015), 0, Math.PI * 2);
    ctx.fill();

    // Dorsal caustics & 2 striped pilot fish cruising under snout
    drawDorsalCaustics(ctx, -sz * 0.6, sz * 0.8, -sz * 0.16, sz * 0.12, timeSec, m.phase || 0, 0.2 + litBoost * 0.15);
    drawSlipstreamPilotFish(ctx, sz * 1.12, sz * 0.34, sz * 0.28, timeSec, 0.4, true);
    drawSlipstreamPilotFish(ctx, sz * 0.72, sz * 0.46, sz * 0.22, timeSec, 2.7, true);
  } else if (m.kind === 'manta') {
    // 3/4 Side-Profile Giant Oceanic Manta Ray with authentic rajiform wave wing-beats (v165)
    const flapNear = Math.sin(phase);
    const tipNear = Math.sin(phase - 0.92); // Authentic delayed wingtip flex wave!
    const flapFar = Math.sin(phase - 0.45);
    const tipFar = Math.sin(phase - 1.35);
    ctx.globalAlpha = 0.94;

    // 1. Far pectoral wing sweeping behind the body (atmospheric depth shadow)
    const farWingGrad = ctx.createLinearGradient(0, -sz * 1.25, 0, 0);
    farWingGrad.addColorStop(0, '#0a1c30');
    farWingGrad.addColorStop(0.65, '#132c47');
    farWingGrad.addColorStop(1, '#1e3a5f');
    ctx.fillStyle = farWingGrad;
    ctx.beginPath();
    ctx.moveTo(sz * 0.56, -sz * 0.04);
    ctx.bezierCurveTo(
      sz * 0.36, -sz * (0.62 + flapFar * 0.34),
      sz * 0.04, -sz * (1.16 + tipFar * 0.42),
      -sz * 0.22, -sz * (1.06 + tipFar * 0.38)
    );
    ctx.bezierCurveTo(
      -sz * 0.28, -sz * (0.58 + flapFar * 0.22),
      -sz * 0.36, -sz * 0.18,
      -sz * 0.56, -sz * 0.02
    );
    ctx.closePath();
    ctx.fill();

    // 2. Long graceful whip tail + tiny dorsal fin at tail base
    ctx.strokeStyle = '#152d47';
    ctx.lineWidth = Math.max(1.5, sz * 0.036);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.56, 0);
    ctx.bezierCurveTo(
      -sz * 1.05, flapNear * sz * 0.1,
      -sz * 1.48, -tipNear * sz * 0.14,
      -sz * 2.02, tipNear * sz * 0.1
    );
    ctx.stroke();
    ctx.fillStyle = '#132c47';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.05);
    ctx.lineTo(-sz * 0.64, -sz * 0.17);
    ctx.lineTo(-sz * 0.68, -sz * 0.02);
    ctx.closePath();
    ctx.fill();

    // 3. Sculpted central hydrofoil body with crisp ink rim (v189)
    const torsoGrad = ctx.createLinearGradient(0, -sz * 0.24, 0, sz * 0.26);
    torsoGrad.addColorStop(0, '#0f253d');
    torsoGrad.addColorStop(0.45, '#1d3c5c');
    torsoGrad.addColorStop(0.62, '#94b3ce');
    torsoGrad.addColorStop(0.82, '#e2eef8');
    torsoGrad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = torsoGrad;
    ctx.strokeStyle = 'rgba(4, 16, 33, 0.68)';
    ctx.lineWidth = Math.max(1.2, sz * 0.024);
    ctx.beginPath();
    ctx.moveTo(sz * 0.78, -sz * 0.02);
    ctx.bezierCurveTo(sz * 0.45, -sz * 0.24, -sz * 0.18, -sz * 0.2, -sz * 0.62, -sz * 0.01);
    ctx.bezierCurveTo(-sz * 0.22, sz * 0.2, sz * 0.36, sz * 0.25, sz * 0.76, sz * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Iconic pale white dorsal shoulder chevron blaze (Mobula birostris hallmark!)
    ctx.fillStyle = 'rgba(219, 234, 254, 0.48)';
    ctx.beginPath();
    ctx.moveTo(sz * 0.54, -sz * 0.1);
    ctx.quadraticCurveTo(sz * 0.28, -sz * 0.18, sz * 0.06, -sz * 0.07);
    ctx.quadraticCurveTo(sz * 0.26, -sz * 0.08, sz * 0.48, -sz * 0.03);
    ctx.closePath();
    ctx.fill();

    // 5 fine ventral gill slits along the pearl belly
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.42)';
    ctx.lineWidth = Math.max(1.0, sz * 0.016);
    for (let g = 0; g < 5; g++) {
      const gx = sz * (0.42 - g * 0.095);
      ctx.beginPath();
      ctx.moveTo(gx, sz * 0.07);
      ctx.quadraticCurveTo(gx - sz * 0.02, sz * 0.13, gx - sz * 0.05, sz * 0.14);
      ctx.stroke();
    }

    // Twin unfurled curved cephalic feeding horns + shadowed filter mouth
    ctx.fillStyle = '#0c1f35';
    ctx.beginPath();
    ctx.moveTo(sz * 0.72, -sz * 0.08);
    ctx.quadraticCurveTo(sz * 0.96, -sz * 0.17, sz * 1.12, -sz * 0.06);
    ctx.quadraticCurveTo(sz * 0.94, -sz * 0.03, sz * 0.76, sz * 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(sz * 0.7, sz * 0.02);
    ctx.quadraticCurveTo(sz * 0.95, sz * 0.14, sz * 1.09, sz * 0.07);
    ctx.quadraticCurveTo(sz * 0.92, sz * 0.06, sz * 0.74, -sz * 0.01);
    ctx.closePath();
    ctx.fill();

    // Side-set dark eye with crisp wet glint
    ctx.fillStyle = '#050b14';
    ctx.beginPath();
    ctx.arc(sz * 0.72, -sz * 0.05, Math.max(1.4, sz * 0.032), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(224, 242, 254, ${(0.6 + litBoost * 0.35).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sz * 0.73, -sz * 0.058, Math.max(0.6, sz * 0.012), 0, Math.PI * 2);
    ctx.fill();

    // 4. Foreground sweeping pectoral wing with pale ventral underside flash on upstroke!
    const wingDown = flapNear > -0.1;
    const nearWingGrad = ctx.createLinearGradient(0, 0, 0, sz * 1.15);
    if (wingDown) {
      nearWingGrad.addColorStop(0, '#1c3b5e');
      nearWingGrad.addColorStop(0.55, '#132a45');
      nearWingGrad.addColorStop(1, '#2a4f73');
    } else {
      // Reveal luminous pearl-white ventral underside during graceful upstroke
      nearWingGrad.addColorStop(0, '#1e3a5f');
      nearWingGrad.addColorStop(0.45, '#cbd5e1');
      nearWingGrad.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = nearWingGrad;
    ctx.beginPath();
    ctx.moveTo(sz * 0.52, sz * 0.03);
    ctx.bezierCurveTo(
      sz * 0.34, sz * (0.58 - flapNear * 0.42),
      sz * 0.02, sz * (1.08 - tipNear * 0.56),
      -sz * 0.24, sz * (0.94 - tipNear * 0.52)
    );
    ctx.bezierCurveTo(
      -sz * 0.32, sz * (0.48 - flapNear * 0.24),
      -sz * 0.36, sz * 0.14,
      -sz * 0.52, sz * 0.02
    );
    ctx.closePath();
    ctx.fill();

    // Dorsal sunlight caustics + 2 loyal remoras tucked under its sweeping wing
    drawDorsalCaustics(ctx, -sz * 0.35, sz * 0.52, -sz * 0.08, sz * 0.14, timeSec, m.phase || 0, 0.22 + litBoost * 0.16);
    drawSlipstreamPilotFish(ctx, sz * 0.08, sz * 0.42, sz * 0.22, timeSec, 1.1, false);
    drawSlipstreamPilotFish(ctx, -sz * 0.28, sz * 0.32, sz * 0.18, timeSec, 3.6, false);
  } else if (m.kind === 'beluga') {
    // Sculpted Pearlescent Arctic Beluga Whale (Delphinapterus leucas) with dorso-ventral spine wave (v165)
    const midW = Math.sin(phase) * sz * 0.045;
    const pedW = Math.sin(phase - 1.15) * sz * 0.12;
    const flukeW = Math.sin(phase - 1.95) * sz * 0.22;
    ctx.globalAlpha = 0.96;

    // 1. Far shadowed rounded paddle flipper
    ctx.fillStyle = '#8fa9bf';
    ctx.beginPath();
    ctx.moveTo(sz * 0.44, sz * 0.14);
    ctx.quadraticCurveTo(sz * 0.34, sz * 0.44, sz * 0.08, sz * 0.36);
    ctx.quadraticCurveTo(sz * 0.16, sz * 0.2, sz * 0.24, sz * 0.14);
    ctx.closePath();
    ctx.fill();

    // 2. Wide notched horizontal tail flukes flexing with realistic phase lag
    const flukeGrad = ctx.createLinearGradient(-sz * 1.1, -sz * 0.35, -sz * 1.7, sz * 0.35);
    flukeGrad.addColorStop(0, '#cbd5e1');
    flukeGrad.addColorStop(0.55, '#e2eef8');
    flukeGrad.addColorStop(1, '#94b0c7');
    ctx.fillStyle = flukeGrad;
    ctx.beginPath();
    ctx.moveTo(-sz * 1.05, pedW);
    ctx.bezierCurveTo(
      -sz * 1.28, -sz * 0.18 + flukeW * 0.7,
      -sz * 1.56, -sz * 0.44 + flukeW,
      -sz * 1.72, -sz * 0.32 + flukeW
    );
    ctx.quadraticCurveTo(-sz * 1.58, -sz * 0.08 + flukeW * 0.85, -sz * 1.48, flukeW * 0.78); // Median notch
    ctx.quadraticCurveTo(-sz * 1.58, sz * 0.12 + flukeW * 0.85, -sz * 1.66, sz * 0.32 + flukeW);
    ctx.bezierCurveTo(
      -sz * 1.44, sz * 0.38 + flukeW * 0.8,
      -sz * 1.24, sz * 0.18 + pedW,
      -sz * 1.04, sz * 0.04 + pedW
    );
    ctx.closePath();
    ctx.fill();

    // 3. Sculpted pearlescent body: bulbous forehead melon, short curved rostrum, flexible neck & smooth dorsal ridge
    const bodyGrad = ctx.createLinearGradient(0, -sz * 0.44, 0, sz * 0.36);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.32, '#f1f7fc');
    bodyGrad.addColorStop(0.68, '#cfe3f2');
    bodyGrad.addColorStop(1, '#85a3bd');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    // Tip of short Beluga rostrum ("beak")
    ctx.moveTo(sz * 1.32, sz * 0.06);
    // Gentle step up onto iconic rounded Beluga forehead melon
    ctx.quadraticCurveTo(sz * 1.26, -sz * 0.03, sz * 1.18, -sz * 0.06);
    ctx.bezierCurveTo(sz * 1.24, -sz * 0.34, sz * 0.94, -sz * 0.42, sz * 0.68, -sz * 0.34);
    // Subtle flexible Beluga neck dip -> smooth arched dorsal ridge (no dorsal fin!)
    ctx.bezierCurveTo(sz * 0.56, -sz * 0.31, sz * 0.32, -sz * 0.42 + midW * 0.5, -sz * 0.24, -sz * 0.31 + midW);
    // Tapering muscular caudal peduncle
    ctx.bezierCurveTo(-sz * 0.62, -sz * 0.22 + pedW * 0.6, -sz * 0.88, -sz * 0.1 + pedW * 0.9, -sz * 1.12, -sz * 0.02 + pedW);
    ctx.lineTo(-sz * 1.12, sz * 0.05 + pedW);
    ctx.bezierCurveTo(-sz * 0.82, sz * 0.16 + pedW * 0.8, -sz * 0.46, sz * 0.28 + midW, sz * 0.16, sz * 0.31 + midW * 0.4);
    // Soft rounded throat & gentle Beluga smile curve
    ctx.bezierCurveTo(sz * 0.64, sz * 0.32, sz * 1.06, sz * 0.24, sz * 1.32, sz * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.58)';
    ctx.lineWidth = Math.max(1.2, sz * 0.024);
    ctx.stroke();

    // Soft sunlit dorsal rim specular sheen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.lineWidth = Math.max(1.4, sz * 0.032);
    ctx.beginPath();
    ctx.moveTo(sz * 1.1, -sz * 0.28);
    ctx.bezierCurveTo(sz * 0.82, -sz * 0.38, sz * 0.25, -sz * 0.38 + midW * 0.4, -sz * 0.36, -sz * 0.26 + midW * 0.8);
    ctx.stroke();

    // Subtle neck crease & friendly curved mouth line
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.32)';
    ctx.lineWidth = Math.max(1.0, sz * 0.018);
    ctx.beginPath();
    ctx.moveTo(sz * 0.68, -sz * 0.26);
    ctx.quadraticCurveTo(sz * 0.62, -sz * 0.05, sz * 0.68, sz * 0.12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.48)';
    ctx.beginPath();
    ctx.moveTo(sz * 1.31, sz * 0.065);
    ctx.quadraticCurveTo(sz * 1.16, sz * 0.11, sz * 1.0, sz * 0.075);
    ctx.stroke();

    // Near rounded paddle pectoral flipper with soft underside shading
    const flipGrad = ctx.createLinearGradient(sz * 0.36, sz * 0.12, sz * 0.1, sz * 0.48);
    flipGrad.addColorStop(0, '#e2eef8');
    flipGrad.addColorStop(0.65, '#b6cfe3');
    flipGrad.addColorStop(1, '#7c9cb8');
    ctx.fillStyle = flipGrad;
    ctx.beginPath();
    ctx.moveTo(sz * 0.46, sz * 0.14 + midW * 0.25);
    ctx.bezierCurveTo(sz * 0.44, sz * 0.44 + midW * 0.4, sz * 0.12, sz * 0.5 + midW * 0.4, sz * 0.02, sz * 0.36 + midW * 0.35);
    ctx.quadraticCurveTo(sz * 0.12, sz * 0.22, sz * 0.2, sz * 0.14 + midW * 0.25);
    ctx.closePath();
    ctx.fill();

    // Warm expressive dark cetacean eye with tiny specular catchlight
    ctx.fillStyle = '#0c1624';
    ctx.beginPath();
    ctx.arc(sz * 0.94, sz * 0.01, Math.max(1.8, sz * 0.036), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(sz * 0.952, -sz * 0.002, Math.max(0.7, sz * 0.013), 0, Math.PI * 2);
    ctx.fill();

    // Shimmering polar ice caustics across its pearlescent back
    drawDorsalCaustics(ctx, -sz * 0.45, sz * 0.85, -sz * 0.2, sz * 0.12, timeSec, m.phase || 0, 0.24 + litBoost * 0.16);
  } else {
    // Massive Wreck Monarch: Heavyweight Goliath Grouper (or Deep Lake Trout) (v165)
    const isTrout = m.kind === 'laketrout';
    const tailWag = Math.sin(phase) * sz * 0.15;
    const gillPulse = Math.sin(timeSec * 2.2 + (m.phase || 0)) * sz * 0.018;

    // Broad muscular rounded paddle tail
    ctx.fillStyle = isTrout ? '#3b4e63' : '#4a3525';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.82, 0);
    ctx.quadraticCurveTo(-sz * 1.24, -sz * 0.48 + tailWag, -sz * 1.44, -sz * 0.22 + tailWag);
    ctx.quadraticCurveTo(-sz * 1.48, tailWag * 0.9, -sz * 1.42, sz * 0.24 + tailWag);
    ctx.quadraticCurveTo(-sz * 1.24, sz * 0.48 + tailWag, -sz * 0.82, 0);
    ctx.closePath();
    ctx.fill();

    // Spiny fanned dorsal crest + soft rear dorsal lobe
    ctx.fillStyle = isTrout ? '#526880' : '#5e442f';
    ctx.beginPath();
    ctx.moveTo(sz * 0.42, -sz * 0.34);
    for (let sp = 0; sp < 6; sp++) {
      const sxp = sz * (0.36 - sp * 0.13);
      ctx.lineTo(sxp, -sz * (0.62 - sp * 0.02));
      ctx.lineTo(sxp - sz * 0.06, -sz * (0.48 - sp * 0.02));
    }
    ctx.quadraticCurveTo(-sz * 0.56, -sz * 0.58, -sz * 0.78, -sz * 0.22);
    ctx.closePath();
    ctx.fill();

    // Heavy countershaded mottled torso
    const gGrad = ctx.createLinearGradient(0, -sz * 0.54, 0, sz * 0.48);
    if (isTrout) {
      gGrad.addColorStop(0, '#334155');
      gGrad.addColorStop(0.55, '#64748b');
      gGrad.addColorStop(1, '#cbd5e1');
    } else {
      gGrad.addColorStop(0, '#3d2c1e');
      gGrad.addColorStop(0.5, '#6b4f35');
      gGrad.addColorStop(0.82, '#9e7d5d');
      gGrad.addColorStop(1, '#cbb396');
    }
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.moveTo(sz * 1.12, sz * 0.08);
    ctx.bezierCurveTo(sz * 0.78, -sz * 0.56, -sz * 0.42, -sz * 0.52, -sz * 0.92, 0);
    ctx.bezierCurveTo(-sz * 0.42, sz * 0.48, sz * 0.62, sz * 0.54, sz * 1.12, sz * 0.08);
    ctx.closePath();
    ctx.fill();

    // 5 authentic vertical dark mottled saddle bars + organic spots
    ctx.fillStyle = isTrout ? 'rgba(226, 232, 240, 0.22)' : 'rgba(24, 18, 12, 0.28)';
    for (let b = 0; b < 5; b++) {
      const bx = sz * (0.44 - b * 0.28);
      ctx.beginPath();
      ctx.ellipse(bx, -sz * 0.04, sz * 0.085, sz * (0.36 - Math.abs(b - 2) * 0.04), -0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wide fluttering rounded pectoral fan + pulsing operculum gill cover
    ctx.fillStyle = isTrout ? 'rgba(71, 85, 105, 0.85)' : 'rgba(92, 67, 45, 0.86)';
    ctx.beginPath();
    ctx.ellipse(sz * 0.22, sz * 0.22, sz * 0.26, sz * 0.14, 0.35 + Math.sin(phase * 0.8) * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.lineWidth = Math.max(1.2, sz * 0.024);
    ctx.beginPath();
    ctx.arc(sz * 0.56 + gillPulse, sz * 0.04, sz * 0.26, -0.75, 0.85);
    ctx.stroke();

    // Heavy underslung cavernous jaw
    ctx.strokeStyle = 'rgba(15, 10, 6, 0.68)';
    ctx.lineWidth = Math.max(1.5, sz * 0.028);
    ctx.beginPath();
    ctx.moveTo(sz * 1.12, sz * 0.1);
    ctx.quadraticCurveTo(sz * 0.92, sz * 0.18, sz * 0.72, sz * 0.14);
    ctx.stroke();

    // Deep amber-gold reflective eye with dark iris & crisp torch catchlight
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(sz * 0.74, -sz * 0.1, Math.max(2.0, sz * 0.072), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sz * 0.74, -sz * 0.1, Math.max(1.4, sz * 0.052), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(sz * 0.755, -sz * 0.1, Math.max(1.0, sz * 0.032), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.65 + litBoost * 0.35).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sz * 0.77, -sz * 0.115, Math.max(0.7, sz * 0.014), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * High-craft torch-reactive Wreck & Reef Crevice Denizens (v165):
 *  - Giant Pacific Octopus: 7 tapered muscular polygon tentacles studded with pale suction cups,
 *    radial-shaded bulbous mantle with skin papillae, pulsing siphon, rippling chromatophores & multi-lobe ink!
 *  - Emerald Moray Eel: Tapered sinuous S-curved body polygon, undulating chartreuse dorsal fin membrane,
 *    tubular nostrils, articulated gaping jaws lined with translucent needle teeth & piercing golden eye!
 */
export function drawStyledDenizen(ctx, d, sx, sy, scale, timeSec) {
  if (!d) return;
  const sz = (d.size || 1.1) * scale;
  const em = Math.max(0.12, Math.min(1, Number(d.emergence) || 0.4));
  const outAng = Math.atan2(d.ny || 0, d.nx || 1);
  const litBoost = Math.max(0, Math.min(1, Number(d.litIntensity) || 0));

  // 1. Swirling multi-lobe defensive octopus ink plumes in world space
  if (Array.isArray(d.inkPuffs) && d.inkPuffs.length > 0) {
    ctx.save();
    for (let i = 0; i < d.inkPuffs.length; i++) {
      const p = d.inkPuffs[i];
      const px = sx + (p.x - d.x) * scale;
      const py = sy + (p.y - d.y) * scale;
      const pr = (p.r || 0.5) * scale;
      const frac = Math.max(0, Math.min(1, p.life / Math.max(0.1, p.maxLife || 4.8)));
      const og = ctx.createRadialGradient(px, py, pr * 0.15, px, py, pr * 1.28);
      og.addColorStop(0, `rgba(2, 6, 18, ${(frac * 0.92).toFixed(3)})`);
      og.addColorStop(0.55, `rgba(12, 18, 36, ${(frac * 0.72).toFixed(3)})`);
      og.addColorStop(0.85, `rgba(71, 85, 105, ${(frac * 0.24).toFixed(3)})`);
      og.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(3, 7, 18, ${(frac * 0.88).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px - pr * 0.22, py - pr * 0.14, pr * 0.58, 0, Math.PI * 2);
      ctx.arc(px + pr * 0.24, py + pr * 0.16, pr * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(outAng);

  // Sculpted dark cavernous den recess
  const denGrad = ctx.createRadialGradient(-sz * 0.05, 0, sz * 0.06, -sz * 0.05, 0, sz * 0.62);
  denGrad.addColorStop(0, 'rgba(2, 6, 18, 0.92)');
  denGrad.addColorStop(0.65, 'rgba(2, 6, 18, 0.55)');
  denGrad.addColorStop(1, 'rgba(2, 6, 18, 0)');
  ctx.fillStyle = denGrad;
  ctx.beginPath();
  ctx.ellipse(-sz * 0.06, 0, sz * 0.36, sz * 0.64, 0, 0, Math.PI * 2);
  ctx.fill();

  const reach = sz * (0.24 + em * 0.92);
  if (d.kind === 'octopus') {
    const waveSpeed = d.state === 'startled' ? 7.2 : d.state === 'curious' ? 2.8 : 1.9;
    // Authentic Giant Pacific Octopus chromatophore palette
    const backArmCol = d.state === 'startled' ? '#7f1d1d' : d.state === 'curious' ? '#9a3412' : '#4a3528';
    const foreArmCol = d.state === 'startled' ? '#dc2626' : d.state === 'curious' ? '#ea580c' : '#7a5943';
    const mantleHi = d.state === 'startled' ? '#f87171' : d.state === 'curious' ? '#fb923c' : '#a17c60';
    const mantleLo = d.state === 'startled' ? '#7f1d1d' : d.state === 'curious' ? '#9a3412' : '#443023';
    const suckerCol = d.state === 'startled' ? 'rgba(254, 226, 226, 0.85)' : 'rgba(254, 243, 199, 0.78)';

    // Helper to build organic 6-node curling tentacle spine
    const buildArmPts = (spread, phaseOff, lenMult) => {
      const pts = [];
      const armLen = reach * (0.96 + em * 0.36) * lenMult;
      for (let k = 0; k < 6; k++) {
        const u = k / 5;
        const curl = Math.sin(timeSec * waveSpeed + d.phase + phaseOff - u * 3.1) * sz * (0.14 * u + 0.04);
        const hook = u > 0.7 ? Math.cos(timeSec * waveSpeed * 0.8 + phaseOff) * sz * 0.12 * (u - 0.7) * 3 : 0;
        pts.push({
          x: reach * 0.24 + armLen * u - Math.abs(spread) * sz * 0.14 * u * u,
          y: spread * sz * (0.24 + u * 0.98) + curl + hook,
        });
      }
      return pts;
    };

    // 3 shadowed background arms
    for (let t = 0; t < 3; t++) {
      const sp = (t - 1) * 0.56;
      drawTaperedTentacle(ctx, buildArmPts(sp, t * 1.9 + 0.8, 0.92), sz * 0.088, sz * 0.015, backArmCol, null);
    }
    // 4 lush foreground muscular arms studded with pale suction cups
    for (let t = 0; t < 4; t++) {
      const sp = (t - 1.5) * 0.44;
      drawTaperedTentacle(ctx, buildArmPts(sp, t * 1.4, 1.06 - Math.abs(sp) * 0.1), sz * 0.105, sz * 0.016, foreArmCol, suckerCol);
    }

    // Pulsing breathing siphon funnel tucked under head
    const siphonPulse = 1 + 0.16 * Math.sin(timeSec * 3.4 + d.phase);
    ctx.fillStyle = backArmCol;
    ctx.beginPath();
    ctx.ellipse(reach * 0.34, sz * 0.24, sz * 0.14 * siphonPulse, sz * 0.075 * siphonPulse, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Sculpted bulbous sac-like mantle with 3D radial shading & skin papillae
    const mCx = reach * 0.28;
    const mGrad = ctx.createRadialGradient(mCx + sz * 0.08, -sz * 0.1, sz * 0.05, mCx, 0, sz * 0.48);
    mGrad.addColorStop(0, mantleHi);
    mGrad.addColorStop(0.55, foreArmCol);
    mGrad.addColorStop(1, mantleLo);
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.moveTo(mCx + sz * 0.34, 0);
    ctx.bezierCurveTo(mCx + sz * 0.26, -sz * 0.32, mCx - sz * 0.22, -sz * 0.36, mCx - sz * 0.38, -sz * 0.08);
    ctx.quadraticCurveTo(mCx - sz * 0.42, 0, mCx - sz * 0.34, sz * 0.12);
    ctx.bezierCurveTo(mCx - sz * 0.18, sz * 0.34, mCx + sz * 0.24, sz * 0.3, mCx + sz * 0.34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(4, 16, 33, 0.72)';
    ctx.lineWidth = Math.max(1.2, sz * 0.036);
    ctx.stroke();

    // Rippling chromatophore bands & organic dermal mottling spots
    const chromaWave = 0.5 + 0.5 * Math.sin(timeSec * (d.state === 'startled' ? 10 : 3.5) + d.phase);
    ctx.fillStyle =
      d.state === 'startled'
        ? `rgba(254, 226, 226, ${(0.35 + chromaWave * 0.42).toFixed(3)})`
        : d.state === 'curious'
          ? `rgba(253, 224, 71, ${(0.28 + chromaWave * 0.32).toFixed(3)})`
          : 'rgba(168, 162, 158, 0.28)';
    for (let s = 0; s < 5; s++) {
      const sxp = mCx - sz * 0.22 + s * sz * 0.11;
      const syp = (s % 2 === 0 ? -1 : 1) * sz * (0.09 + (s % 3) * 0.035);
      ctx.beginPath();
      ctx.ellipse(sxp, syp, sz * 0.055, sz * 0.032, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sculpted brow ridge + luminous golden iris + authentic horizontal-slit cephalopod pupil
    const ex = mCx + sz * 0.24;
    const ey = -sz * 0.095;
    ctx.fillStyle = mantleLo;
    ctx.beginPath();
    ctx.ellipse(ex, ey - sz * 0.035, sz * 0.11, sz * 0.065, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(ex, ey, Math.max(2.2, sz * 0.088), Math.max(1.8, sz * 0.072), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(ex - sz * 0.052, ey - sz * 0.016, sz * 0.104, Math.max(1.3, sz * 0.032));
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.65 + litBoost * 0.35).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(ex + sz * 0.025, ey - sz * 0.028, Math.max(0.7, sz * 0.018), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Emerald Moray Eel: tapered S-curved muscular body, translucent golden dorsal fin ribbon & needle-toothed jaws (v165)
    const sway1 = Math.sin(timeSec * 2.6 + d.phase) * sz * 0.14;
    const sway2 = Math.sin(timeSec * 2.6 + d.phase - 1.2) * sz * 0.16;
    const jawOpen = 0.08 + 0.13 * Math.max(0, Math.sin(timeSec * 2.3 + d.phase));

    // Build 7-node S-curved muscular eel spine
    const spine = [];
    for (let k = 0; k < 7; k++) {
      const u = k / 6;
      const sxp = -sz * 0.08 + reach * u * 1.04;
      const syp = (Math.sin(u * Math.PI * 1.25) * sway1 + Math.sin(u * Math.PI * 2.1 - 0.8) * sway2 * 0.55) * u;
      spine.push({ x: sxp, y: syp });
    }

    // Translucent undulating chartreuse-gold dorsal fin membrane running down the entire spine
    ctx.fillStyle = 'rgba(163, 230, 53, 0.58)';
    ctx.beginPath();
    ctx.moveTo(spine[0].x, spine[0].y - sz * 0.12);
    for (let k = 1; k < spine.length; k++) {
      const u = k / (spine.length - 1);
      const finH = sz * (0.19 - u * 0.04) + Math.sin(timeSec * 5.2 - u * 4.5 + d.phase) * sz * 0.028;
      ctx.lineTo(spine[k].x, spine[k].y - finH);
    }
    for (let k = spine.length - 1; k >= 0; k--) {
      ctx.lineTo(spine[k].x, spine[k].y - sz * 0.05);
    }
    ctx.closePath();
    ctx.fill();

    // Thick tapered muscular iridescent emerald-jade body polygon
    const eelGrad = ctx.createLinearGradient(0, -sz * 0.22, 0, sz * 0.22);
    eelGrad.addColorStop(0, '#4d7c0f');
    eelGrad.addColorStop(0.35, '#15803d');
    eelGrad.addColorStop(0.75, '#14532d');
    eelGrad.addColorStop(1, '#3f6212');
    drawTaperedTentacle(ctx, spine, sz * 0.185, sz * 0.115, eelGrad, null);

    // Subtle dark-olive mottled dorsal markings & wet mucus highlight sheen
    ctx.strokeStyle = 'rgba(190, 242, 100, 0.28)';
    ctx.lineWidth = Math.max(1.2, sz * 0.028);
    ctx.beginPath();
    ctx.moveTo(spine[0].x, spine[0].y - sz * 0.07);
    for (let k = 1; k < spine.length; k++) ctx.lineTo(spine[k].x, spine[k].y - sz * 0.05);
    ctx.stroke();

    // Sculpted narrow predatory moray head with articulated gaping jaws & translucent needle teeth
    const head = spine[spine.length - 1];
    const hx = head.x;
    const hy = head.y;

    // Dark crimson-black inner throat recess
    ctx.fillStyle = '#1f0b12';
    ctx.beginPath();
    ctx.moveTo(hx - sz * 0.04, hy - sz * 0.04);
    ctx.lineTo(hx + sz * 0.28, hy - sz * jawOpen * 0.85);
    ctx.lineTo(hx + sz * 0.25, hy + sz * jawOpen * 0.85);
    ctx.lineTo(hx - sz * 0.04, hy + sz * 0.05);
    ctx.closePath();
    ctx.fill();

    // Upper curved snout & jaw + tiny tubular nostrils
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(hx - sz * 0.1, hy - sz * 0.11);
    ctx.quadraticCurveTo(hx + sz * 0.12, hy - sz * (0.14 + jawOpen * 0.4), hx + sz * 0.34, hy - sz * jawOpen * 0.9);
    ctx.lineTo(hx + sz * 0.26, hy - sz * jawOpen * 0.35);
    ctx.lineTo(hx - sz * 0.02, hy);
    ctx.closePath();
    ctx.fill();
    // Lower jaw
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.moveTo(hx - sz * 0.08, hy + sz * 0.1);
    ctx.quadraticCurveTo(hx + sz * 0.1, hy + sz * (0.12 + jawOpen * 0.45), hx + sz * 0.31, hy + sz * jawOpen * 0.95);
    ctx.lineTo(hx + sz * 0.24, hy + sz * jawOpen * 0.4);
    ctx.lineTo(hx - sz * 0.02, hy + sz * 0.01);
    ctx.closePath();
    ctx.fill();

    // Tiny translucent needle teeth gleaming along both jaws
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    for (let th = 0; th < 4; th++) {
      const tx = hx + sz * (0.09 + th * 0.055);
      const tSpan = sz * jawOpen * (0.35 + th * 0.18);
      ctx.beginPath();
      ctx.moveTo(tx - sz * 0.012, hy - tSpan);
      ctx.lineTo(tx, hy - tSpan + sz * 0.042);
      ctx.lineTo(tx + sz * 0.012, hy - tSpan);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - sz * 0.011, hy + tSpan);
      ctx.lineTo(tx, hy + tSpan - sz * 0.038);
      ctx.lineTo(tx + sz * 0.011, hy + tSpan);
      ctx.fill();
    }

    // Fierce golden moray eye with pinpoint pupil & wet catchlight
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(hx + sz * 0.07, hy - sz * 0.075, Math.max(1.8, sz * 0.052), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(hx + sz * 0.08, hy - sz * 0.075, Math.max(1.0, sz * 0.024), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(hx + sz * 0.088, hy - sz * 0.085, Math.max(0.6, sz * 0.012), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// MUSEUM-GRADE BESPOKE ARTIFACT & COLLECTIBLE ILLUSTRATION LIBRARY (v167)
// ============================================================================

function _safeLinGrad(ctx, x0, y0, x1, y1, stops, fallback) {
  const g = ctx.createLinearGradient?.(x0, y0, x1, y1);
  if (g && typeof g.addColorStop === 'function') {
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  return fallback;
}

function _safeRadGrad(ctx, x0, y0, r0, x1, y1, r1, stops, fallback) {
  const g = ctx.createRadialGradient?.(x0, y0, r0, x1, y1, r1);
  if (g && typeof g.addColorStop === 'function') {
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  return fallback;
}

function _deriveMineralPalette(nameLower) {
  if (/jade|emerald|olivine|algae|green/.test(nameLower)) {
    return { hi: '#a7f3d0', mid: '#10b981', deep: '#064e3b', edge: '#d1fae5', glow: 'emerald' };
  }
  if (/amber|copal|gold|sulfur|pyrite|citrine|ochre|honey/.test(nameLower)) {
    return { hi: '#fef08a', mid: '#f59e0b', deep: '#78350f', edge: '#fef9c3', glow: 'warm' };
  }
  if (/garnet|ruby|coral|red|crimson|magma/.test(nameLower)) {
    return { hi: '#fda4af', mid: '#e11d48', deep: '#4c0519', edge: '#ffe4e6', glow: 'magenta' };
  }
  if (/sapphire|cobalt|blue|ice|celestite|glacial|indigo|aqua/.test(nameLower)) {
    return { hi: '#bae6fd', mid: '#0284c7', deep: '#0c4a6e', edge: '#e0f2fe', glow: 'cyan' };
  }
  if (/obsidian|onyx|black|magnetite|meteorite|basalt|scoria|tephra|smoky|ironstone/.test(nameLower)) {
    return { hi: '#94a3b8', mid: '#334155', deep: '#090d16', edge: '#cbd5e1', glow: 'cyan' };
  }
  if (/selenite|gypsum|marble|alabaster|white|milky|chalk|pale|calcite|aragonite|barite|feldspar|dolomite|travertine/.test(nameLower)) {
    return { hi: '#ffffff', mid: '#cbd5e1', deep: '#64748b', edge: '#f8fafc', glow: 'cyan' };
  }
  // Classic quartz / amethyst / fluorite
  return { hi: '#e9d5ff', mid: '#a855f7', deep: '#4c1d95', edge: '#f3e8ff', glow: 'magenta' };
}

/**
 * Resolve any collectible item (by name & kind) to its exact visual archetype & material palette (v167).
 */
export function classifyArtifactVisual(item) {
  const n = String(item?.name || '').toLowerCase();
  const k = String(item?.kind || '').toLowerCase();
  const mineral = _deriveMineralPalette(n);

  if (/pocket watch|watch|chronometer/.test(n)) return { type: 'watch', glow: 'warm', mineral };
  if (/mask|idol|jaguar|censer/.test(n)) return { type: 'mask', glow: /gold/.test(n) ? 'warm' : 'emerald', mineral };
  if (/pearl/.test(n) || k === 'pearl') return { type: 'pearl', glow: 'magenta', mineral };
  if (/pendant|gorget|amulet|medallion|pendulum|offering|sunstone|token/.test(n) && !/blade|vessel/.test(n)) {
    return { type: 'pendant', glow: /jade/.test(n) ? 'emerald' : 'warm', mineral };
  }
  if (/amber|copal/.test(n) && !/geode|pearl/.test(n)) return { type: 'amber', glow: 'warm', mineral };
  if (/sextant/.test(n)) return { type: 'sextant', glow: 'warm', mineral };
  if (/compass|azimuth|binnacle|transit/.test(n) || k === 'compass') return { type: 'compass', glow: 'warm', mineral };
  if (/telegraph|telemotor/.test(n)) return { type: 'telegraph', glow: 'warm', mineral };
  if (/\bbell\b/.test(n)) return { type: 'bell', glow: 'warm', mineral };
  if (/candelabra/.test(n)) return { type: 'candelabra', glow: 'warm', mineral };
  if (/porcelain|dinner plate|china/.test(n)) return { type: 'plate', glow: 'cyan', mineral };
  if (/chalice|bowl/.test(n)) return { type: 'chalice', glow: 'warm', mineral };
  if (/amphora|decanter|vase|urn/.test(n)) return { type: 'amphora', glow: 'warm', mineral };
  if (/lamp|lantern|headlamp|strobe/.test(n)) return { type: 'lamp', glow: 'warm', mineral };
  if (/porthole/.test(n)) return { type: 'porthole', glow: 'cyan', mineral };
  if (/propeller|prop /.test(n)) return { type: 'propeller', glow: 'warm', mineral };
  if (/safe/.test(n) && !/plaque/.test(n)) return { type: 'safe', glow: 'warm', mineral };
  if (/wheel/.test(n)) return { type: 'wheel', glow: 'warm', mineral };
  if (/enigma|cipher|detonator/.test(n)) return { type: 'enigma', glow: 'warm', mineral };
  if (/slate|manifest| log/.test(n)) return { type: 'slate', glow: 'cyan', mineral };
  if (/spyglass|periscope|sight|speaking tube|whistle/.test(n)) return { type: 'spyglass', glow: 'warm', mineral };
  if (/gauge|oscilloscope|calculator|dial|rangefinder/.test(n)) return { type: 'gauge', glow: 'warm', mineral };
  if (/tooth/.test(n)) return { type: 'tooth', glow: 'emerald', mineral };
  if (/tusk/.test(n)) return { type: 'tusk', glow: 'cyan', mineral };
  if (/blade|spear|dagger/.test(n)) return { type: 'blade', glow: mineral.glow, mineral };
  if (/anchor/.test(n)) return { type: 'anchor', glow: 'warm', mineral };
  if (/vial|capsule|sample/.test(n) || (/core/.test(n) && !/meteorite|ammonite|scallop|limestone/.test(n))) {
    return { type: 'vial', glow: 'cyan', mineral };
  }
  if (/cookie|arrow/.test(n)) return { type: 'cookie', glow: 'warm', mineral };
  if (/reel|spool|weight/.test(n)) return { type: 'reel', glow: 'warm', mineral };
  if (/beacon|sensor|probe|relay|transponder|hydrophone|magnetometer|sonar|node|cell|scan/.test(n) || k === 'beacon') {
    return { type: 'beacon', glow: 'cyan', mineral };
  }
  if (/trilobite|crustacean|prawn/.test(n)) return { type: 'trilobite', glow: 'emerald', mineral };
  if (/coral|gorgonian|starfish|sponge|crinoid/.test(n)) return { type: 'coral', glow: 'emerald', mineral };
  if (/nautilus|ammonite|nautiloid|conch|snail|shell|limpet|scallop|vertebra|mastodon|stromatolite/.test(n) || k === 'fossil') {
    return { type: 'nautilus', glow: 'emerald', mineral };
  }
  if (/pearl|orb|drop/.test(n) || k === 'pearl') return { type: 'pearl', glow: 'magenta', mineral };
  if (/geode/.test(n)) return { type: 'geode', glow: mineral.glow, mineral };
  if (/pyrite/.test(n)) return { type: 'pyrite', glow: 'warm', mineral };
  if (/crown/.test(n)) return { type: 'crown', glow: mineral.glow, mineral };
  if (/bolt|pin|axle|wedge/.test(n)) return { type: 'hardware', glow: 'warm', mineral };
  if (/plaque|plate|tag|seal|emblem|keystone|monolith|tribute|hatch/.test(n)) {
    return { type: 'plaque', glow: 'warm', mineral };
  }
  if (k === 'crystal' || /crystal|quartz|fluorite|calcite|amethyst|selenite|barite|aragonite|garnet|olivine|obsidian|meteorite|ice|prism|spar|shard|needle|mineral|basalt|rhyolite|breccia|tephra|smectite|scoria|silicate/.test(n)) {
    return { type: 'crystal', glow: mineral.glow, mineral };
  }
  if (k === 'gear') return { type: 'gauge', glow: 'warm', mineral };
  if (k === 'survey') return { type: 'reel', glow: 'warm', mineral };
  return { type: 'pendant', glow: 'warm', mineral };
}

/**
 * Draw a museum-grade, bespoke illustrated artifact matching the item's exact name & material (v167).
 * Drawn centered at (sx, sy) with display radius `r`.
 */
export function drawStyledArtifact(ctx, item, sx, sy, r, timeSec, { index = 0, isGrand = false } = {}) {
  const vis = classifyArtifactVisual(item);
  const { type, mineral } = vis;
  const nameLower = String(item?.name || '').toLowerCase();
  const lw = Math.max(1.0, r * 0.085);

  ctx.save();
  ctx.translate(sx, sy);

  // Subtle floating micro-sparkles orbiting prized artifacts
  const moteCount = isGrand ? 4 : 2;
  for (let m = 0; m < moteCount; m++) {
    const a = timeSec * (0.9 + m * 0.25) + index * 1.7 + m * ((Math.PI * 2) / moteCount);
    const dist = r * (1.22 + 0.22 * Math.sin(timeSec * 2.4 + m * 2.1));
    const mx = Math.cos(a) * dist;
    const my = Math.sin(a) * dist * 0.78;
    const tw = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 4.5 + m * 1.9 + index));
    ctx.fillStyle = `rgba(254, 249, 195, ${(0.72 * tw).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(mx, my, Math.max(1.0, r * 0.075 * tw), 0, Math.PI * 2);
    ctx.fill();
  }

  // Gentle suspended underwater buoyancy sway
  ctx.rotate(Math.sin(timeSec * 1.55 + index * 1.3) * 0.14);

  // Bespoke Secret Boss Trophy Relics (only rendered once earned & stored in Career Trophy Vault!) (v192)
  const itemIdLower = String(item?.id || '').toLowerCase();
  if (itemIdLower.includes('xibalba-kraken-heart') || nameLower.includes('heart of the cenote')) {
    const pulse = 1 + Math.sin(timeSec * 3.4) * 0.05;
    ctx.scale(pulse, pulse);
    // Twin golden Kraken filigree tentacles cradling the abyssal crystal heart
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.2, r * 0.85);
      ctx.bezierCurveTo(s * r * 1.05, r * 0.55, s * r * 1.15, -r * 0.4, s * r * 0.62, -r * 0.65);
      ctx.stroke();
    }
    const hg = _safeLinGrad(ctx, 0, -r * 0.9, 0, r * 0.9, [[0, '#a5f3fc'], [0.45, '#38bdf8'], [1, '#6d28d9']], '#38bdf8');
    ctx.fillStyle = hg;
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.lineTo(r * 0.66, -r * 0.18);
    ctx.lineTo(0, r * 0.94);
    ctx.lineTo(-r * 0.66, -r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.lineTo(r * 0.24, -r * 0.18);
    ctx.lineTo(0, r * 0.28);
    ctx.lineTo(-r * 0.24, -r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('thistlegorm-engine-core') || nameLower.includes('sunken engine core')) {
    // Riveted brass-and-steel naval engine reactor housing a spinning glowing amber turbine
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#041021';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.rotate(timeSec * 1.8);
    ctx.fillStyle = '#fbbf24';
    for (let b = 0; b < 6; b++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.18, -r * 0.56);
      ctx.lineTo(-r * 0.18, -r * 0.56);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('scoresby-borealis-heart') || itemIdLower.includes('scoresby-frost-heart') || nameLower.includes('heart of borealis')) {
    // Six-pointed Arctic Aurora Crystal Star Gem
    ctx.save();
    ctx.rotate(timeSec * 0.35);
    const ag = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#34d399'], [0.5, '#38bdf8'], [1, '#c084fc']], '#38bdf8');
    ctx.fillStyle = ag;
    ctx.strokeStyle = '#082f49';
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let p = 0; p < 12; p++) {
      const pr = p % 2 === 0 ? r * 0.96 : r * 0.42;
      const pa = (p * Math.PI) / 6;
      if (p === 0) ctx.moveTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
      else ctx.lineTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('krubera-empress-diadem') || nameLower.includes('empress diadem')) {
    // Sculpted Royal Gold Abyssal Empress Crown with radiant pearl & twin cyan sapphires
    const dg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fef08a'], [0.5, '#f59e0b'], [1, '#b45309']], '#f59e0b');
    ctx.fillStyle = dg;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.86, r * 0.42);
    ctx.lineTo(-r * 0.92, -r * 0.32);
    ctx.lineTo(-r * 0.48, r * 0.04);
    ctx.lineTo(0, -r * 0.84);
    ctx.lineTo(r * 0.48, r * 0.04);
    ctx.lineTo(r * 0.92, -r * 0.32);
    ctx.lineTo(r * 0.86, r * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -r * 0.16, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-r * 0.5, r * 0.18, r * 0.12, 0, Math.PI * 2);
    ctx.arc(r * 0.5, r * 0.18, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('bluehole-solar-prism') || nameLower.includes('solar reef prism')) {
    // Refracting Golden-Turquoise Sunburst Reef Prism Relic (Solar Leviathan Trophy, v193)
    ctx.save();
    ctx.rotate(timeSec * 0.45);
    const sg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fef9c3'], [0.5, '#facc15'], [1, '#14b8a6']], '#facc15');
    ctx.fillStyle = sg;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let p = 0; p < 16; p++) {
      const pr = p % 2 === 0 ? r * 0.96 : r * 0.52;
      const pa = (p * Math.PI) / 8;
      if (p === 0) ctx.moveTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
      else ctx.lineTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.48);
    ctx.lineTo(r * 0.34, 0);
    ctx.lineTo(0, r * 0.48);
    ctx.lineTo(-r * 0.34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('lagoa-voltaic-cell') || nameLower.includes('voltaic abyssal organ')) {
    // High-Voltage Bio-Electric Capacitor Orb & Lightning Core (Voltaic Emperor Eel Trophy, v265)
    ctx.save();
    const vg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fef08a'], [0.45, '#38bdf8'], [1, '#1e3a8a']], '#fde047');
    ctx.fillStyle = vg;
    ctx.strokeStyle = '#090d24';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Orbiting voltaic arc ring
    ctx.rotate(timeSec * 0.9);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.2, lw * 0.78);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.96, r * 0.38, 0.45, 0, Math.PI * 2);
    ctx.stroke();
    // Crisp high-voltage lightning bolt core
    ctx.rotate(-timeSec * 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = Math.max(1.0, lw * 0.55);
    ctx.beginPath();
    ctx.moveTo(r * 0.14, -r * 0.56);
    ctx.lineTo(-r * 0.30, r * 0.04);
    ctx.lineTo(r * 0.02, r * 0.04);
    ctx.lineTo(-r * 0.14, r * 0.56);
    ctx.lineTo(r * 0.32, -r * 0.06);
    ctx.lineTo(0, -r * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('plura-nessie-scale') || nameLower.includes('highland plesiosaur crest')) {
    // Iridescent Highland Emerald Plesiosaur Crest Scale Relic (Loch Ness Leviathan Trophy, v265)
    ctx.save();
    const ng = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#a7f3d0'], [0.48, '#10b981'], [1, '#064e3b']], '#10b981');
    ctx.fillStyle = ng;
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.bezierCurveTo(r * 0.82, -r * 0.44, r * 0.88, r * 0.42, 0, r * 0.88);
    ctx.bezierCurveTo(-r * 0.88, r * 0.42, -r * 0.82, -r * 0.44, 0, -r * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Radiant Highland filigree ribs
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.2, lw * 0.72);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.66);
    ctx.lineTo(0, r * 0.64);
    ctx.moveTo(0, -r * 0.24);
    ctx.lineTo(r * 0.40, r * 0.06);
    ctx.moveTo(0, -r * 0.24);
    ctx.lineTo(-r * 0.40, r * 0.06);
    ctx.moveTo(0, r * 0.14);
    ctx.lineTo(r * 0.34, r * 0.38);
    ctx.moveTo(0, r * 0.14);
    ctx.lineTo(-r * 0.34, r * 0.38);
    ctx.stroke();
    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.arc(0, -r * 0.32, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('oriskany-apex-tooth') || nameLower.includes('megalodon apex fang')) {
    // Gleaming Ivory-Gold Fossil Great White Apex Tooth Relic (Great White Sovereign Trophy, v267)
    ctx.save();
    // Root gum crest
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.56, r * 0.66, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Gleaming curved triangular shark tooth blade
    const tg = _safeLinGrad(ctx, -r * 0.5, -r * 0.5, r * 0.5, r * 0.85, [[0, '#ffffff'], [0.5, '#e2e8f0'], [1, '#38bdf8']], '#f8fafc');
    ctx.fillStyle = tg;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.56, -r * 0.48);
    ctx.quadraticCurveTo(-r * 0.26, r * 0.28, r * 0.08, r * 0.88);
    ctx.quadraticCurveTo(r * 0.46, r * 0.20, r * 0.56, -r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold collar band & sparkle highlight
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.2, lw * 0.8);
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, -r * 0.42);
    ctx.lineTo(r * 0.48, -r * 0.42);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.14, -r * 0.08, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('silfra-orca-fluke') || nameLower.includes('aurora orca fluke')) {
    // Crisp Obsidian-and-Snow Stylized Orca Tail Fluke Charm with Aurora Rim (Aurora Orca Trophy, v267)
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = Math.max(1.4, lw * 0.95);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.72);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.12, -r * 0.86, -r * 0.44);
    ctx.quadraticCurveTo(-r * 0.36, -r * 0.62, 0, -r * 0.16);
    ctx.quadraticCurveTo(r * 0.36, -r * 0.62, r * 0.86, -r * 0.44);
    ctx.quadraticCurveTo(r * 0.18, r * 0.12, 0, r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Iconic snow-white inner fluke saddle patches
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.22, r * 0.22, r * 0.11, 0.45, 0, Math.PI * 2);
    ctx.ellipse(r * 0.32, -r * 0.22, r * 0.22, r * 0.11, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('chuuk-imperial-pearl') || nameLower.includes('tridacna moon-pearl')) {
    // Iridescent Giant Moon-Pearl nestled inside a Scalloped Pink-Teal Clam Shell (Giant Clam Trophy, v267)
    ctx.save();
    // Scalloped coral-teal shell cradle
    const shg = _safeLinGrad(ctx, -r, -r * 0.4, r, r, [[0, '#f472b6'], [0.55, '#14b8a6'], [1, '#0f766e']], '#f472b6');
    ctx.fillStyle = shg;
    ctx.strokeStyle = '#4c0519';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.84, 0, Math.PI);
    ctx.quadraticCurveTo(-r * 0.42, -r * 0.26, 0, -r * 0.18);
    ctx.quadraticCurveTo(r * 0.42, -r * 0.26, r * 0.84, r * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Giant glowing iridescent pearl orb
    const pg = _safeLinGrad(ctx, -r * 0.4, -r * 0.6, r * 0.4, r * 0.4, [[0, '#ffffff'], [0.55, '#fbcfe8'], [1, '#67e8f9']], '#ffffff');
    ctx.fillStyle = pg;
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = Math.max(1.2, lw * 0.78);
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r * 0.50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.16, -r * 0.28, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('angelita-piranha-crest') || nameLower.includes('tri-fang piranha')) {
    // Three Cute Colored Piranha Fish Swirling Inside a Golden Jungle Crest (Piranha Trio Trophy, v268)
    ctx.save();
    // Outer crimson-gold jungle ring
    const rg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fde047'], [0.5, '#fb7185'], [1, '#0d9488']], '#fb7185');
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(1.8, lw * 1.15);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.80, 0, Math.PI * 2);
    ctx.stroke();
    // 3 tiny chibi piranhas circling in triangle formation (Ruby, Gold, Berry)
    const trioColors = [
      { ang: -Math.PI * 0.5, back: '#2dd4bf', belly: '#f43f5e' },
      { ang: Math.PI * 0.17, back: '#38bdf8', belly: '#facc15' },
      { ang: Math.PI * 0.83, back: '#a78bfa', belly: '#f472b6' },
    ];
    for (const f of trioColors) {
      ctx.save();
      const fx = Math.cos(f.ang) * r * 0.42;
      const fy = Math.sin(f.ang) * r * 0.42;
      ctx.translate(fx, fy);
      ctx.rotate(f.ang + Math.PI * 0.5);
      // Tiny tail
      ctx.fillStyle = f.belly;
      ctx.beginPath();
      ctx.moveTo(-r * 0.16, 0);
      ctx.lineTo(-r * 0.32, -r * 0.14);
      ctx.lineTo(-r * 0.32, r * 0.14);
      ctx.closePath();
      ctx.fill();
      // Plump mini piranha body
      const fg = _safeLinGrad(ctx, 0, -r * 0.2, 0, r * 0.2, [[0, f.back], [0.55, f.belly], [1, f.belly]], f.belly);
      ctx.fillStyle = fg;
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = Math.max(1.0, lw * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.22, r * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Cute sparkle eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r * 0.08, -r * 0.03, Math.max(1.2, r * 0.06), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('bermuda-ironbrow-scute') || nameLower.includes('ironbrow scute')) {
    // Hexagonal Emerald-Jade & Warm-Gold Sea Turtle Shell Crest (Grumpy Sea Turtle Trophy, v269)
    ctx.save();
    const sg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#6ee7b7'], [0.5, '#059669'], [1, '#064e3b']], '#10b981');
    ctx.fillStyle = sg;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(2.0, lw * 1.15);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      const hx = Math.cos(a) * r * 0.78;
      const hy = Math.sin(a) * r * 0.84;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner golden tortoise scute polygon
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = Math.max(1.2, lw * 0.7);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      const hx = Math.cos(a) * r * 0.40;
      const hy = Math.sin(a) * r * 0.44;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
    // Cute furrowed grumpy brow gleam in center!
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = Math.max(1.6, lw * 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, -r * 0.08);
    ctx.lineTo(-r * 0.04, r * 0.04);
    ctx.moveTo(r * 0.24, -r * 0.08);
    ctx.lineTo(r * 0.04, r * 0.04);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('zenobia-lionfish-plume') || nameLower.includes('lionfish venom plume')) {
    // Fanning Scarlet-and-Ivory Feathered Lionfish Plume Crest with Violet Glow Tips (Lionfish Trophy, v269)
    ctx.save();
    for (let i = -2; i <= 2; i++) {
      const ang = i * 0.34 - Math.PI * 0.5;
      ctx.save();
      ctx.rotate(ang + Math.PI * 0.5);
      const pg = _safeLinGrad(ctx, 0, r * 0.45, 0, -r * 0.82, [[0, '#881337'], [0.4, '#fb7185'], [0.75, '#fffbeb'], [1, '#e879f9']], '#fb7185');
      ctx.fillStyle = pg;
      ctx.strokeStyle = '#4c0519';
      ctx.lineWidth = Math.max(1.1, lw * 0.65);
      ctx.beginPath();
      ctx.moveTo(-r * 0.09, r * 0.42);
      ctx.quadraticCurveTo(-r * 0.14, -r * 0.25, 0, -r * 0.84);
      ctx.quadraticCurveTo(r * 0.14, -r * 0.25, r * 0.09, r * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Glowing ivory-crimson clasp gem at base
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = Math.max(1.2, lw * 0.7);
    ctx.beginPath();
    ctx.arc(0, r * 0.38, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('strytan-magma-pearl') || nameLower.includes('heart of the thermal spire')) {
    // Spiral Basalt-and-Molten-Magma Nautilus Pearl Relic (Hydrothermal Nautilus Trophy, v193)
    const mg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fef08a'], [0.45, '#f97316'], [1, '#292524']], '#f97316');
    ctx.fillStyle = mg;
    ctx.strokeStyle = '#0c0a09';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = Math.max(1.2, lw * 0.85);
    ctx.beginPath();
    for (let s = 0; s <= 18; s++) {
      const a = s * 0.38 + timeSec * 0.5;
      const sr = (s / 18) * r * 0.68;
      if (s === 0) ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr);
      else ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.22, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('orda-selenite-prism') || nameLower.includes('crown of selenite')) {
    // Faceted Lavender-Cyan Gypsum Selenite Crystal Cluster Relic (Crystal Basilisk Trophy, v194)
    const cg = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#ffffff'], [0.45, '#e879f9'], [1, '#38bdf8']], '#c084fc');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#3b0764';
    ctx.lineWidth = lw;
    for (let k = -1; k <= 1; k++) {
      ctx.save();
      ctx.rotate(k * 0.36 + Math.sin(timeSec * 0.9 + k) * 0.04);
      const h = k === 0 ? r * 0.96 : r * 0.72;
      const w = k === 0 ? r * 0.34 : r * 0.25;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(w, -h * 0.22);
      ctx.lineTo(w * 0.7, h * 0.52);
      ctx.lineTo(-w * 0.7, h * 0.52);
      ctx.lineTo(-w, -h * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('u1206-phantom-compass') || nameLower.includes('phantom u-boat gyrocompass')) {
    // Haunted Gunmetal-and-Emerald WWII Submarine Gyrocompass Relic (Phantom Torpedo Sentinel Trophy, v194)
    const ug = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#64748b'], [0.5, '#1e293b'], [1, '#020617']], '#1e293b');
    ctx.fillStyle = ug;
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Glowing spectral sonar dial + spinning compass needle
    ctx.fillStyle = 'rgba(20, 184, 166, 0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(timeSec * 1.1);
    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.64);
    ctx.lineTo(r * 0.16, 0);
    ctx.lineTo(0, r * 0.28);
    ctx.lineTo(-r * 0.16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('bimini-orichalcum-astrolabe') || nameLower.includes('orichalcum astrolabe')) {
    // Ancient Gilded Atlantean Orichalcum Astrolabe Relic (Orichalcum Colossus Trophy, v195)
    const og = _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fef08a'], [0.5, '#f59e0b'], [1, '#92400e']], '#f59e0b');
    ctx.strokeStyle = og;
    ctx.lineWidth = Math.max(2.2, lw * 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.rotate(timeSec * 0.75);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.34, r * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (itemIdLower.includes('ojamo-tungsten-core') || nameLower.includes('heart of the iron shaft')) {
    // Spinning Armored Tungsten Drill-Core & Furnace Ember Relic (Abyssal Drill-Wyrm Trophy, v195)
    ctx.save();
    ctx.rotate(timeSec * 1.2);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rad = i % 2 === 0 ? r * 0.94 : r * 0.66;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const fg = _safeLinGrad(ctx, -r * 0.45, -r * 0.45, r * 0.45, r * 0.45, [[0, '#fef08a'], [0.55, '#f97316'], [1, '#b91c1c']], '#f97316');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const brassGrad = _safeLinGrad(ctx, -r, -r, r, r, [
    [0, '#fef08a'],
    [0.38, '#d97706'],
    [0.75, '#92400e'],
    [1, '#fde047'],
  ], '#d97706');
  const silverGrad = _safeLinGrad(ctx, -r, -r, r, r, [
    [0, '#ffffff'],
    [0.42, '#cbd5e1'],
    [0.78, '#64748b'],
    [1, '#e2e8f0'],
  ], '#cbd5e1');

  if (type === 'pendant') {
    // Ornate carved Pendant / Gorget / Amulet with golden bail cord loop & sculpted gemstone cabochon
    // Braided bail loop at top
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.4, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, -r * 0.86, r * 0.22, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();

    // Sculpted teardrop / oval hammered gold filigree bezel
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.bezierCurveTo(r * 0.72, -r * 0.45, r * 0.78, r * 0.42, 0, r * 0.96);
    ctx.bezierCurveTo(-r * 0.78, r * 0.42, -r * 0.72, -r * 0.45, 0, -r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Beaded filigree rim dots
    ctx.fillStyle = '#fef9c3';
    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ba) * r * 0.50, r * 0.12 + Math.sin(ba) * r * 0.60, Math.max(0.9, r * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }

    // Carved gemstone centerpiece (Imperial Jade / Nacre Shell / Copal / Sunstone)
    const isJade = /jade|cenote|maya/.test(nameLower);
    const isShell = /shell|gorget|bone/.test(nameLower);
    const gemGrad = isShell
      ? _safeRadGrad(ctx, -r * 0.12, -r * 0.02, r * 0.05, 0, r * 0.12, r * 0.52, [
          [0, '#ffffff'], [0.45, '#fde68a'], [0.8, '#f472b6'], [1, '#94a3b8'],
        ], '#fde68a')
      : isJade
        ? _safeRadGrad(ctx, -r * 0.14, -r * 0.04, r * 0.05, 0, r * 0.12, r * 0.52, [
            [0, '#a7f3d0'], [0.45, '#10b981'], [0.88, '#065f46'], [1, '#022c22'],
          ], '#10b981')
        : _safeRadGrad(ctx, -r * 0.14, -r * 0.04, r * 0.05, 0, r * 0.12, r * 0.52, [
            [0, mineral.hi], [0.5, mineral.mid], [1, mineral.deep],
          ], mineral.mid);
    ctx.fillStyle = gemGrad;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.38, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Incised ceremonial spiral/sun glyph inside cabochon
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = Math.max(0.9, r * 0.055);
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.18, 0, Math.PI * 1.65);
    ctx.stroke();

    // Crisp glass-like gemstone specular glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.14, -r * 0.08, r * 0.09, r * 0.16, -0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'watch') {
    // Antique Brass Pocket Watch / Marine Chronometer with winding crown, bow loop, Roman enamel dial & ticking hands
    // Top bow ring & knurled winding crown
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.4, r * 0.11);
    ctx.beginPath();
    ctx.arc(0, -r * 0.96, r * 0.24, Math.PI * 0.72, Math.PI * 2.28);
    ctx.stroke();
    ctx.fillStyle = brassGrad;
    ctx.beginPath();
    ctx.roundRect(-r * 0.15, -r * 0.86, r * 0.30, r * 0.18, r * 0.05);
    ctx.fill();

    // Polished hinged brass hunter case
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.80, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner recessed bezel & ivory porcelain enamel dial
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = Math.max(1.0, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 12 radial Roman-dial hour ticks
    ctx.strokeStyle = '#1e293b';
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI * 0.5;
      const major = h % 3 === 0;
      ctx.lineWidth = major ? Math.max(1.2, r * 0.065) : Math.max(0.7, r * 0.035);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * (major ? 0.44 : 0.49), r * 0.08 + Math.sin(a) * r * (major ? 0.44 : 0.49));
      ctx.lineTo(Math.cos(a) * r * 0.57, r * 0.08 + Math.sin(a) * r * 0.57);
      ctx.stroke();
    }

    // Miniature sub-seconds dial at 6 o'clock
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
    ctx.lineWidth = Math.max(0.7, r * 0.03);
    ctx.beginPath();
    ctx.arc(0, r * 0.35, r * 0.14, 0, Math.PI * 2);
    ctx.stroke();

    // Blued-steel hour & sweeping minute hands
    const minAng = -Math.PI * 0.35 + timeSec * 0.18;
    const hrAng = -Math.PI * 0.82;
    ctx.strokeStyle = '#0f172a';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, r * 0.075);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.08);
    ctx.lineTo(Math.cos(hrAng) * r * 0.32, r * 0.08 + Math.sin(hrAng) * r * 0.32);
    ctx.stroke();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = Math.max(1.1, r * 0.055);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.08);
    ctx.lineTo(Math.cos(minAng) * r * 0.46, r * 0.08 + Math.sin(minAng) * r * 0.46);
    ctx.stroke();

    // Brass center pin & curved sapphire crystal glint
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, r * 0.08, Math.max(1.2, r * 0.07), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.16, r * 0.22, r * 0.09, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'mask') {
    // Sculpted Obsidian Offering Mask / Golden Idol with glowing turquoise eyes & ceremonial crest
    const isGold = /gold|idol/.test(nameLower) && !/obsidian/.test(nameLower);
    const bodyGrad = isGold
      ? brassGrad
      : _safeLinGrad(ctx, -r * 0.7, -r, r * 0.7, r, [
          [0, '#475569'], [0.35, '#1e293b'], [0.7, '#090d16'], [1, '#334155'],
        ], '#0f172a');

    // Stepped ceremonial headdress crest
    ctx.fillStyle = isGold ? '#b45309' : '#0f766e';
    ctx.strokeStyle = isGold ? '#fef08a' : '#5eead4';
    ctx.lineWidth = Math.max(1.0, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.46);
    ctx.lineTo(-r * 0.78, -r * 0.82);
    ctx.lineTo(-r * 0.34, -r * 0.72);
    ctx.lineTo(0, -r * 1.02);
    ctx.lineTo(r * 0.34, -r * 0.72);
    ctx.lineTo(r * 0.78, -r * 0.82);
    ctx.lineTo(r * 0.62, -r * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Carved facial shield
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = isGold ? '#fef9c3' : '#94a3b8';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.64, -r * 0.48);
    ctx.quadraticCurveTo(0, -r * 0.62, r * 0.64, -r * 0.48);
    ctx.lineTo(r * 0.54, r * 0.46);
    ctx.quadraticCurveTo(0, r * 0.96, -r * 0.54, r * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing turquoise / jade inlaid almond eyes
    ctx.fillStyle = isGold ? '#10b981' : '#2dd4bf';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * r * 0.24, -r * 0.08, r * 0.16, r * 0.085, dir * -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // Carved nose ridge & ceremonial mouth bar
    ctx.strokeStyle = isGold ? '#fef08a' : '#cbd5e1';
    ctx.lineWidth = Math.max(1.1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.20);
    ctx.lineTo(0, r * 0.20);
    ctx.moveTo(-r * 0.24, r * 0.44);
    ctx.lineTo(r * 0.24, r * 0.44);
    ctx.stroke();
  } else if (type === 'amber') {
    // Translucent Honey-Cognac Copal Amber teardrop with prehistoric inclusions
    const ambGrad = _safeRadGrad(ctx, -r * 0.18, -r * 0.20, r * 0.08, 0, r * 0.08, r * 0.92, [
      [0, '#fef9c3'],
      [0.32, '#f59e0b'],
      [0.72, '#b45309'],
      [1, '#451a03'],
    ], '#d97706');
    ctx.fillStyle = ambGrad;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.92);
    ctx.bezierCurveTo(r * 0.68, -r * 0.42, r * 0.84, r * 0.56, 0, r * 0.90);
    ctx.bezierCurveTo(-r * 0.84, r * 0.56, -r * 0.68, -r * 0.42, 0, -r * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Trapped prehistoric botanical speck & suspended golden micro-bubbles
    ctx.fillStyle = 'rgba(69, 26, 3, 0.72)';
    ctx.beginPath();
    ctx.ellipse(r * 0.06, r * 0.14, r * 0.18, r * 0.07, 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(254, 249, 195, 0.88)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.16, r * 0.11, r * 0.22, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.22, r * 0.34, Math.max(1.0, r * 0.06), 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'sextant') {
    // 1899 Brass Marine Sextant — iconic 60° A-frame graduated arc + index arm + mirror + spyglass
    ctx.strokeStyle = brassGrad;
    ctx.lineWidth = Math.max(2.0, r * 0.15);
    ctx.lineCap = 'round';
    // Curved graduated limb arc at bottom
    ctx.beginPath();
    ctx.arc(0, -r * 0.45, r * 1.05, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
    // Side A-frame struts
    ctx.lineWidth = Math.max(1.5, r * 0.11);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.74);
    ctx.lineTo(-r * 0.74, r * 0.28);
    ctx.moveTo(0, -r * 0.74);
    ctx.lineTo(r * 0.74, r * 0.28);
    ctx.moveTo(-r * 0.42, -r * 0.14);
    ctx.lineTo(r * 0.42, -r * 0.14);
    ctx.stroke();
    // Silver graduated degree strip
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = Math.max(1.0, r * 0.055);
    ctx.beginPath();
    ctx.arc(0, -r * 0.45, r * 1.05, Math.PI * 0.28, Math.PI * 0.72);
    ctx.stroke();
    // Pivoting index arm & top index mirror
    const armAng = Math.PI * 0.5 + Math.sin(timeSec * 0.9) * 0.18;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.lineTo(Math.cos(armAng) * r * 1.05, -r * 0.45 + Math.sin(armAng) * r * 1.05);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -r * 0.72, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'compass') {
    // Brass Expedition Compass with gimbal ring, navy compass rose & glowing oscillating north needle
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.3, r * 0.09);
    ctx.beginPath();
    ctx.arc(0, -r * 0.88, r * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, r * 0.04, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#071426';
    ctx.beginPath();
    ctx.arc(0, r * 0.04, r * 0.64, 0, Math.PI * 2);
    ctx.fill();
    // Cardinal 4-point rose ticks
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
    ctx.lineWidth = Math.max(1.0, r * 0.055);
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.44, r * 0.04 + Math.sin(a) * r * 0.44);
      ctx.lineTo(Math.cos(a) * r * 0.60, r * 0.04 + Math.sin(a) * r * 0.60);
      ctx.stroke();
    }
    // Oscillating diamond compass needle (crimson North + radium cyan South)
    const nAng = -Math.PI * 0.35 + Math.sin(timeSec * 1.9 + index) * 0.25;
    ctx.save();
    ctx.translate(0, r * 0.04);
    ctx.rotate(nAng);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(r * 0.52, 0);
    ctx.lineTo(0, -r * 0.14);
    ctx.lineTo(0, r * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, 0);
    ctx.lineTo(0, -r * 0.12);
    ctx.lineTo(0, r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.2, r * 0.09), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Domed glass reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.20, r * 0.22, r * 0.08, -0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'bell') {
    // Cast Bronze Ship's Bell / Dive Bell with mounting yoke, lathe bands & hanging clapper
    // Top crown yoke
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-r * 0.24, -r * 0.92, r * 0.48, r * 0.24, r * 0.08);
    ctx.fill();
    // Bell flared bronze body
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, -r * 0.68);
    ctx.quadraticCurveTo(0, -r * 0.80, r * 0.36, -r * 0.68);
    ctx.bezierCurveTo(r * 0.42, -r * 0.10, r * 0.62, r * 0.36, r * 0.84, r * 0.62);
    ctx.quadraticCurveTo(0, r * 0.78, -r * 0.84, r * 0.62);
    ctx.bezierCurveTo(-r * 0.62, r * 0.36, -r * 0.42, -r * 0.10, -r * 0.36, -r * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Lathe bands & subtle verdigris patina
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.75)';
    ctx.lineWidth = Math.max(1.1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, r * 0.18);
    ctx.quadraticCurveTo(0, r * 0.28, r * 0.48, r * 0.18);
    ctx.stroke();
    // Hanging brass clapper ball underneath
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(0, r * 0.76, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // Specular flank highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.08, r * 0.09, r * 0.36, 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'telegraph') {
    // Chadburn Ship's Brass Engine Order Telegraph with circular sector dial & throttle lever
    // Pedestal base
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, r * 0.42);
    ctx.lineTo(r * 0.24, r * 0.42);
    ctx.lineTo(r * 0.42, r * 0.92);
    ctx.lineTo(-r * 0.42, r * 0.92);
    ctx.closePath();
    ctx.fill();
    // Protruding brass throttle handle
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.8, r * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.12);
    ctx.lineTo(r * 0.72, -r * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(r * 0.74, -r * 0.74, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    // Main circular brass dial housing
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Iconic white/black Chadburn order wedges
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r * 0.50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    for (let s = 0; s < 4; s++) {
      const a0 = (s * 2) * (Math.PI / 4) - Math.PI * 0.85;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.12);
      ctx.arc(0, -r * 0.12, r * 0.50, a0, a0 + Math.PI / 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -r * 0.12, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'lamp') {
    // Antique Carbide Miner Lamp / Ship's Brass Lantern with glowing amber Fresnel lens
    // Top bail ring & vented dome hood
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.beginPath();
    ctx.arc(0, -r * 0.82, r * 0.22, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, -r * 0.42);
    ctx.quadraticCurveTo(0, -r * 0.86, r * 0.48, -r * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glowing amber glass lantern chamber
    const lampGlow = _safeRadGrad(ctx, 0, 0, r * 0.05, 0, 0, r * 0.55, [
      [0, '#ffffff'], [0.4, '#fde047'], [0.85, '#f97316'], [1, '#7c2d12'],
    ], '#fbbf24');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.roundRect(-r * 0.42, -r * 0.42, r * 0.84, r * 0.90, r * 0.12);
    ctx.fill();
    // Protective brass cage bars
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = Math.max(1.1, r * 0.07);
    for (const bx of [-r * 0.24, 0, r * 0.24]) {
      ctx.beginPath();
      ctx.moveTo(bx, -r * 0.42);
      ctx.lineTo(bx, r * 0.48);
      ctx.stroke();
    }
    // Heavy weighted brass fuel base
    ctx.fillStyle = brassGrad;
    ctx.beginPath();
    ctx.roundRect(-r * 0.56, r * 0.46, r * 1.12, r * 0.34, r * 0.12);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'amphora') {
    // Sunken Greco-Roman Amphora / Crystal Decanter with twin arched neck handles
    const isCrystal = /crystal|decanter/.test(nameLower);
    const bodyG = isCrystal
      ? _safeLinGrad(ctx, -r * 0.5, -r, r * 0.5, r, [[0, '#e0f2fe'], [0.5, '#7dd3fc'], [1, '#0284c7']], '#7dd3fc')
      : _safeLinGrad(ctx, -r * 0.5, -r, r * 0.5, r, [[0, '#fdba74'], [0.45, '#c2410c'], [1, '#431407']], '#c2410c');
    // Twin arched handles
    ctx.strokeStyle = isCrystal ? '#bae6fd' : '#ea580c';
    ctx.lineWidth = Math.max(1.5, r * 0.11);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * r * 0.20, -r * 0.68);
      ctx.quadraticCurveTo(dir * r * 0.72, -r * 0.52, dir * r * 0.48, -r * 0.12);
      ctx.stroke();
    }
    // Tapered vessel silhouette
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = isCrystal ? '#ffffff' : '#fed7aa';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.30, -r * 0.86);
    ctx.lineTo(r * 0.30, -r * 0.86);
    ctx.lineTo(r * 0.20, -r * 0.48);
    ctx.bezierCurveTo(r * 0.66, -r * 0.22, r * 0.56, r * 0.45, r * 0.16, r * 0.88);
    ctx.lineTo(-r * 0.16, r * 0.88);
    ctx.bezierCurveTo(-r * 0.56, r * 0.45, -r * 0.66, -r * 0.22, -r * 0.20, -r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Painted shoulder stripe
    ctx.strokeStyle = isCrystal ? 'rgba(255,255,255,0.65)' : '#fef08a';
    ctx.lineWidth = Math.max(1.0, r * 0.065);
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, -r * 0.10);
    ctx.quadraticCurveTo(0, r * 0.04, r * 0.44, -r * 0.10);
    ctx.stroke();
  } else if (type === 'plate') {
    // Shipwreck Fine Porcelain Plate with cobalt maritime laurel band & gilded rim
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(1.4, r * 0.095);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = Math.max(1.8, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = Math.max(0.8, r * 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    // Subtle center maritime crest
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'candelabra') {
    // First-Class Silver 3-Branch Candelabra
    ctx.strokeStyle = silverGrad;
    ctx.lineWidth = Math.max(1.6, r * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.72);
    ctx.lineTo(0, r * 0.78);
    ctx.moveTo(-r * 0.46, r * 0.80);
    ctx.lineTo(r * 0.46, r * 0.80);
    ctx.moveTo(0, r * 0.06);
    ctx.quadraticCurveTo(-r * 0.56, r * 0.12, -r * 0.62, -r * 0.50);
    ctx.moveTo(0, r * 0.06);
    ctx.quadraticCurveTo(r * 0.56, r * 0.12, r * 0.62, -r * 0.50);
    ctx.stroke();
    ctx.fillStyle = '#fef9c3';
    for (const [cx, cy] of [[-r * 0.62, -r * 0.58], [0, -r * 0.80], [r * 0.62, -r * 0.58]]) {
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.14, cy, r * 0.28, r * 0.14, r * 0.04);
      ctx.fill();
    }
  } else if (type === 'chalice') {
    // Ceremonial Hammered Copper / Gold Chalice Bowl
    const cupGrad = /copper/.test(nameLower)
      ? _safeLinGrad(ctx, -r, -r, r, r, [[0, '#fed7aa'], [0.45, '#c2410c'], [1, '#7c2d12']], '#c2410c')
      : brassGrad;
    ctx.fillStyle = cupGrad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, -r * 0.58);
    ctx.lineTo(r * 0.72, -r * 0.58);
    ctx.quadraticCurveTo(r * 0.62, r * 0.22, 0, r * 0.28);
    ctx.quadraticCurveTo(-r * 0.62, r * 0.22, -r * 0.72, -r * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, r * 0.26);
    ctx.lineTo(r * 0.14, r * 0.26);
    ctx.lineTo(r * 0.44, r * 0.82);
    ctx.lineTo(-r * 0.44, r * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'porthole') {
    // Bolted Brass Stateroom Porthole with deep-sea glass & wing-dog latches
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const glassG = _safeRadGrad(ctx, -r * 0.2, -r * 0.2, r * 0.08, 0, 0, r * 0.6, [
      [0, '#bae6fd'], [0.55, '#0284c7'], [1, '#082f49'],
    ], '#0284c7');
    ctx.fillStyle = glassG;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    // 6 perimeter bolts
    ctx.fillStyle = '#78350f';
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.71, Math.sin(a) * r * 0.71, Math.max(1.1, r * 0.065), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, -r * 0.18, r * 0.20, r * 0.07, -0.65, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'propeller') {
    // 4-Blade Cast Bronze Ship Propeller
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = lw;
    for (let b = 0; b < 4; b++) {
      ctx.save();
      ctx.rotate((b / 4) * Math.PI * 2 + 0.35);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.48, r * 0.24, r * 0.42, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'safe') {
    // Forepeak Captain's Riveted Steel & Brass Safe
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(-r * 0.74, -r * 0.74, r * 1.48, r * 1.48, r * 0.16);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.strokeRect(-r * 0.56, -r * 0.56, r * 1.12, r * 1.12);
    ctx.fillStyle = brassGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'wheel') {
    // 6-Spoke Brass Valve Wheel / Ship's Steering Wheel
    ctx.strokeStyle = brassGrad;
    ctx.lineWidth = Math.max(2.0, r * 0.15);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.3, r * 0.095);
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
      ctx.stroke();
    }
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.20, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'enigma') {
    // Kriegsmarine Enigma Cipher Rotor — notched brass wheel with 26 alphabet teeth & contact pins
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = brassGrad;
    ctx.lineWidth = Math.max(1.8, r * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Notched outer thumb ratchet teeth
    ctx.fillStyle = '#fde047';
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, Math.max(1.0, r * 0.065), 0, Math.PI * 2);
      ctx.fill();
    }
    // Inner silver electrical spring contact pins
    ctx.fillStyle = '#e2e8f0';
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, Math.max(0.9, r * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'slate') {
    // Waterproof Dive Log Slate / Ship's Manifest with ruled lines & brass clasp
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(-r * 0.64, -r * 0.80, r * 1.28, r * 1.60, r * 0.14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-r * 0.28, -r * 0.90, r * 0.56, r * 0.20);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(0.9, r * 0.055);
    for (let ln = -2; ln <= 2; ln++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.44, ln * r * 0.24);
      ctx.lineTo(r * (ln === 2 ? 0.18 : 0.44), ln * r * 0.24);
      ctx.stroke();
    }
  } else if (type === 'spyglass') {
    // 3-Stage Telescoping Wardroom Brass Spyglass / Periscope Prism
    ctx.save();
    ctx.rotate(-0.48);
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = Math.max(0.9, r * 0.06);
    ctx.beginPath();
    ctx.roundRect(-r * 0.90, -r * 0.16, r * 0.56, r * 0.32, r * 0.06);
    ctx.roundRect(-r * 0.36, -r * 0.22, r * 0.62, r * 0.44, r * 0.07);
    ctx.roundRect(r * 0.24, -r * 0.28, r * 0.64, r * 0.56, r * 0.08);
    ctx.fill();
    ctx.stroke();
    // Leather grip sleeve on middle barrel
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-r * 0.28, -r * 0.20, r * 0.44, r * 0.40);
    // Cyan optical objective lens
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(r * 0.86, 0, r * 0.08, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (type === 'gauge') {
    // Vintage Brass Submersible Pressure / Depth Gauge (or CRT Radar Oscilloscope)
    const isOsc = /oscilloscope/.test(nameLower);
    ctx.fillStyle = isOsc ? '#334155' : brassGrad;
    ctx.strokeStyle = isOsc ? '#94a3b8' : '#fef08a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isOsc ? '#022c22' : '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2);
    ctx.fill();
    if (isOsc) {
      // Glowing green CRT oscilloscope sine waveform
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = Math.max(1.2, r * 0.075);
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const x = -r * 0.48 + (k / 12) * r * 0.96;
        const y = Math.sin(k * 0.9 + timeSec * 4.2) * r * 0.26;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.2, r * 0.075);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, -Math.PI * 0.85, Math.PI * 0.35);
      ctx.stroke();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.42, -r * 0.24);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.2, r * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.22, r * 0.20, r * 0.07, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'tooth') {
    // Prehistoric Megalodon / Miocene Shark Tooth — dark curved bourlette root + serrated ivory enamel blade
    ctx.fillStyle = '#3f3f46';
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, -r * 0.36);
    ctx.quadraticCurveTo(0, -r * 0.84, r * 0.72, -r * 0.36);
    ctx.quadraticCurveTo(0, -r * 0.14, -r * 0.72, -r * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const enamGrad = _safeLinGrad(ctx, -r * 0.5, -r * 0.3, r * 0.5, r * 0.85, [
      [0, '#f5f5f4'], [0.45, '#d6d3d1'], [1, '#78716c'],
    ], '#d6d3d1');
    ctx.fillStyle = enamGrad;
    ctx.strokeStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.30);
    ctx.quadraticCurveTo(0, -r * 0.16, r * 0.62, -r * 0.30);
    ctx.quadraticCurveTo(r * 0.42, r * 0.42, 0, r * 0.94);
    ctx.quadraticCurveTo(-r * 0.42, r * 0.42, -r * 0.62, -r * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'tusk') {
    // Spiraled Narwhal Ivory Tusk Lance
    ctx.save();
    ctx.rotate(-0.58);
    ctx.fillStyle = _safeLinGrad(ctx, -r, 0, r, 0, [[0, '#fef3c7'], [0.6, '#f8fafc'], [1, '#cbd5e1']], '#fef3c7');
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = Math.max(0.9, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(-r * 0.96, -r * 0.22);
    ctx.lineTo(r * 1.02, 0);
    ctx.lineTo(-r * 0.96, r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.55)';
    for (let s = -3; s <= 3; s++) {
      const x = s * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.08, -r * 0.15);
      ctx.lineTo(x + r * 0.08, r * 0.15);
      ctx.stroke();
    }
    ctx.restore();
  } else if (type === 'blade') {
    // Knapped Ritual Obsidian / Onyx / Calcite Ceremonial Blade with wrapped gold hilt
    ctx.save();
    ctx.rotate(-0.52);
    const blGrad = _safeLinGrad(ctx, -r, -r * 0.3, r, r * 0.3, [
      [0, mineral.hi], [0.45, mineral.mid], [1, mineral.deep],
    ], mineral.mid);
    ctx.fillStyle = blGrad;
    ctx.strokeStyle = mineral.edge;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, 0);
    ctx.quadraticCurveTo(r * 0.26, -r * 0.38, r * 1.02, 0);
    ctx.quadraticCurveTo(r * 0.26, r * 0.38, -r * 0.34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Center ridge gleam
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = Math.max(0.9, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, 0);
    ctx.lineTo(r * 0.90, 0);
    ctx.stroke();
    // Wrapped gold/bone handle
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.roundRect(-r * 0.92, -r * 0.14, r * 0.58, r * 0.28, r * 0.08);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.stroke();
    ctx.restore();
  } else if (type === 'trilobite') {
    // Segmented Fossilized Trilobite / Blind Crustacean Carapace
    ctx.fillStyle = '#d6b88e';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.62, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cephalon head shield + twin eye ridges
    ctx.fillStyle = '#b48a5a';
    ctx.beginPath();
    ctx.arc(0, -r * 0.34, r * 0.54, Math.PI, Math.PI * 2);
    ctx.fill();
    // Axial lobe & horizontal thoracic ribs
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = Math.max(0.9, r * 0.06);
    for (let seg = -2; seg <= 3; seg++) {
      const y = seg * r * 0.20;
      const hw = r * (0.54 - Math.abs(seg) * 0.07);
      ctx.beginPath();
      ctx.moveTo(-hw, y);
      ctx.lineTo(hw, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.20, -r * 0.64);
    ctx.lineTo(-r * 0.14, r * 0.72);
    ctx.moveTo(r * 0.20, -r * 0.64);
    ctx.lineTo(r * 0.14, r * 0.72);
    ctx.stroke();
  } else if (type === 'coral') {
    // Delicate Branching Fossil Coral / Starfish Skeleton
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = Math.max(1.8, r * 0.13);
    ctx.lineCap = 'round';
    if (/starfish/.test(nameLower)) {
      ctx.fillStyle = '#fdba74';
      ctx.beginPath();
      for (let p = 0; p < 10; p++) {
        const a = (p / 10) * Math.PI * 2 - Math.PI * 0.5;
        const rad = p % 2 === 0 ? r * 0.88 : r * 0.34;
        if (p === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.82);
      ctx.lineTo(0, -r * 0.76);
      ctx.moveTo(0, r * 0.24);
      ctx.lineTo(-r * 0.62, -r * 0.36);
      ctx.moveTo(0, r * 0.10);
      ctx.lineTo(r * 0.64, -r * 0.42);
      ctx.moveTo(-r * 0.32, -r * 0.06);
      ctx.lineTo(-r * 0.36, -r * 0.62);
      ctx.moveTo(r * 0.32, -r * 0.16);
      ctx.lineTo(r * 0.36, -r * 0.68);
      ctx.stroke();
    }
  } else if (type === 'nautilus') {
    // Golden-Ratio Chambered Nautilus / Ammonite Fossil with pearlescent ribbed septa
    const shellGrad = _safeRadGrad(ctx, -r * 0.18, -r * 0.18, r * 0.08, 0, 0, r * 0.88, [
      [0, '#fef3c7'], [0.55, '#e2b887'], [1, '#78350f'],
    ], '#e2b887');
    ctx.fillStyle = shellGrad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Logarithmic spiral & curved chamber ribs
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = Math.max(1.1, r * 0.065);
    ctx.beginPath();
    for (let s = 0; s <= 22; s++) {
      const a = s * 0.42;
      const sr = r * 0.06 + (s / 22) * r * 0.72;
      const px = Math.cos(a) * sr;
      const py = Math.sin(a) * sr;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 251, 235, 0.58)';
    ctx.lineWidth = Math.max(0.8, r * 0.045);
    for (let rib = 0; rib < 10; rib++) {
      const a = (rib / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34);
      ctx.lineTo(Math.cos(a + 0.2) * r * 0.76, Math.sin(a + 0.2) * r * 0.76);
      ctx.stroke();
    }
  } else if (type === 'pearl') {
    // Iridescent Pearl cradled in fluted bivalve shell (ivory, blue-ice, Tahitian black, or golden sulfur)
    const isBlack = /black|volcanic|obsidian/.test(nameLower);
    const isBlue = /blue|ice|sapphire|cathedral/.test(nameLower);
    const isGold = /sulfur|amber|gold/.test(nameLower);
    // Fluted oyster shell cradle
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.38, r * 0.86, r * 0.40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Luminous multi-stop radial pearl sphere
    const pGrad = isBlack
      ? _safeRadGrad(ctx, -r * 0.18, -r * 0.22, r * 0.06, 0, -r * 0.04, r * 0.58, [
          [0, '#e9d5ff'], [0.35, '#4c1d95'], [0.78, '#1e1b4b'], [1, '#020617'],
        ], '#312e81')
      : isBlue
        ? _safeRadGrad(ctx, -r * 0.18, -r * 0.22, r * 0.06, 0, -r * 0.04, r * 0.58, [
            [0, '#ffffff'], [0.42, '#bae6fd'], [0.85, '#0284c7'], [1, '#0c4a6e'],
          ], '#7dd3fc')
        : isGold
          ? _safeRadGrad(ctx, -r * 0.18, -r * 0.22, r * 0.06, 0, -r * 0.04, r * 0.58, [
              [0, '#ffffff'], [0.4, '#fef08a'], [0.85, '#d97706'], [1, '#78350f'],
            ], '#fde047')
          : _safeRadGrad(ctx, -r * 0.18, -r * 0.22, r * 0.06, 0, -r * 0.04, r * 0.58, [
              [0, '#ffffff'], [0.45, '#f8fafc'], [0.78, '#fbcfe8'], [1, '#94a3b8'],
            ], '#f8fafc');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, -r * 0.06, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    // Crisp specular pinpoint glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.24, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'geode') {
    // Cracked Volcanic/Limestone Geode revealing glittering crystalline interior
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.88, r * 0.76, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mineral.deep;
    ctx.strokeStyle = mineral.edge;
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.64, r * 0.52, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Sparkling micro-crystal teeth lining the hollow
    ctx.fillStyle = mineral.mid;
    for (let c = 0; c < 7; c++) {
      const a = (c / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.42);
      ctx.lineTo(Math.cos(a + 0.18) * r * 0.20, Math.sin(a + 0.18) * r * 0.16);
      ctx.lineTo(Math.cos(a - 0.18) * r * 0.24, Math.sin(a - 0.18) * r * 0.20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = mineral.hi;
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.08, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'pyrite') {
    // Interlocking Mirror-Gold Isometric Pyrite Cubes
    const drawCube = (ox, oy, sz) => {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(ox, oy - sz);
      ctx.lineTo(ox + sz * 0.86, oy - sz * 0.5);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox - sz * 0.86, oy - sz * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(ox - sz * 0.86, oy - sz * 0.5);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox, oy + sz);
      ctx.lineTo(ox - sz * 0.86, oy + sz * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(ox + sz * 0.86, oy - sz * 0.5);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox, oy + sz);
      ctx.lineTo(ox + sz * 0.86, oy + sz * 0.5);
      ctx.closePath();
      ctx.fill();
    };
    drawCube(-r * 0.30, r * 0.16, r * 0.42);
    drawCube(r * 0.32, r * 0.18, r * 0.38);
    drawCube(0, -r * 0.14, r * 0.52);
  } else if (type === 'crown' || type === 'crystal') {
    // Faceted Translucent Hexagonal Crystal Cluster / 5-Spire Crown colored by exact mineral
    const spires = type === 'crown'
      ? [[-0.52, 0.72], [-0.26, 0.96], [0, 1.18], [0.26, 0.94], [0.52, 0.70]]
      : [[-0.36, 0.84], [0, 1.16], [0.34, 0.80]];
    for (let i = 0; i < spires.length; i++) {
      const [ang, lenMul] = spires[i];
      ctx.save();
      ctx.rotate(ang);
      const pw = r * (i === Math.floor(spires.length / 2) ? 0.30 : 0.22);
      // Left lit facet
      ctx.fillStyle = _safeLinGrad(ctx, -pw, -r * lenMul, 0, r * 0.65, [[0, mineral.hi], [1, mineral.mid]], mineral.hi);
      ctx.beginPath();
      ctx.moveTo(0, -r * lenMul);
      ctx.lineTo(0, r * 0.62);
      ctx.lineTo(-pw * 0.85, r * 0.62);
      ctx.lineTo(-pw, -r * lenMul * 0.28);
      ctx.closePath();
      ctx.fill();
      // Right shadow facet
      ctx.fillStyle = _safeLinGrad(ctx, 0, -r * lenMul, pw, r * 0.65, [[0, mineral.mid], [1, mineral.deep]], mineral.deep);
      ctx.beginPath();
      ctx.moveTo(0, -r * lenMul);
      ctx.lineTo(pw, -r * lenMul * 0.28);
      ctx.lineTo(pw * 0.85, r * 0.62);
      ctx.lineTo(0, r * 0.62);
      ctx.closePath();
      ctx.fill();
      // Crisp prismatic highlight rim
      ctx.strokeStyle = mineral.edge;
      ctx.lineWidth = Math.max(0.9, r * 0.055);
      ctx.beginPath();
      ctx.moveTo(0, -r * lenMul);
      ctx.lineTo(pw, -r * lenMul * 0.28);
      ctx.lineTo(pw * 0.85, r * 0.62);
      ctx.lineTo(-pw * 0.85, r * 0.62);
      ctx.lineTo(-pw, -r * lenMul * 0.28);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  } else if (type === 'vial') {
    // Pressurized Scientific Borosilicate Core Vial with machined endcaps & glowing specimen
    ctx.save();
    ctx.rotate(-0.32);
    // Glass cylinder body
    ctx.fillStyle = 'rgba(186, 230, 253, 0.28)';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(-r * 0.34, -r * 0.68, r * 0.68, r * 1.36, r * 0.14);
    ctx.fill();
    ctx.stroke();
    // Glowing liquid / mineral core inside
    ctx.fillStyle = _safeLinGrad(ctx, 0, -r * 0.2, 0, r * 0.56, [[0, mineral.hi], [1, mineral.mid]], '#38bdf8');
    ctx.beginPath();
    ctx.roundRect(-r * 0.25, -r * 0.14, r * 0.50, r * 0.72, r * 0.08);
    ctx.fill();
    // Top & bottom machined titanium/brass caps
    ctx.fillStyle = silverGrad;
    ctx.beginPath();
    ctx.roundRect(-r * 0.40, -r * 0.86, r * 0.80, r * 0.24, r * 0.07);
    ctx.roundRect(-r * 0.40, r * 0.62, r * 0.80, r * 0.24, r * 0.07);
    ctx.fill();
    // Glass glint streak
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.0, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, -r * 0.52);
    ctx.lineTo(-r * 0.18, r * 0.48);
    ctx.stroke();
    ctx.restore();
  } else if (type === 'cookie') {
    // Technical Cave Line Arrow / Round Notched Line Cookie
    const isArrow = /arrow/.test(nameLower);
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    if (isArrow) {
      ctx.beginPath();
      ctx.moveTo(r * 0.88, 0);
      ctx.lineTo(-r * 0.68, -r * 0.56);
      ctx.lineTo(-r * 0.38, 0);
      ctx.lineTo(-r * 0.68, r * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'reel') {
    // Technical Cave Exploration Spool / Brass Reel with wound gold line drum
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.80, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Wound bright cave-line gold spool ring
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = Math.max(2.6, r * 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    // Center finger hole & machined perimeter lightening holes
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    for (let h = 0; h < 4; h++) {
      const a = (h / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, Math.max(1.0, r * 0.065), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'beacon') {
    // Subsea Acoustic Transponder / Telemetry Sensor with blinking cyan status LED
    // Top antenna prongs
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.2, r * 0.075);
    ctx.beginPath();
    ctx.moveTo(-r * 0.20, -r * 0.56);
    ctx.lineTo(-r * 0.36, -r * 0.94);
    ctx.moveTo(r * 0.20, -r * 0.56);
    ctx.lineTo(r * 0.36, -r * 0.94);
    ctx.stroke();
    // Anodized yellow/titanium pressure cylinder
    ctx.fillStyle = _safeLinGrad(ctx, -r * 0.5, 0, r * 0.5, 0, [[0, '#fef08a'], [0.5, '#eab308'], [1, '#854d0e']], '#eab308');
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(-r * 0.42, -r * 0.58, r * 0.84, r * 1.32, r * 0.20);
    ctx.fill();
    ctx.stroke();
    // Dark acoustic collar & blinking telemetry LED
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-r * 0.42, -r * 0.16, r * 0.84, r * 0.34);
    const blink = 0.45 + 0.55 * Math.max(0, Math.sin(timeSec * 4.5 + index));
    ctx.fillStyle = `rgba(56, 189, 248, ${blink.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.6, r * 0.14), 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'anchor') {
    // Sunken Admiralty Anchor
    ctx.strokeStyle = silverGrad;
    ctx.lineWidth = Math.max(2.0, r * 0.15);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -r * 0.72, r * 0.18, 0, Math.PI * 2);
    ctx.moveTo(0, -r * 0.54);
    ctx.lineTo(0, r * 0.76);
    ctx.moveTo(-r * 0.46, -r * 0.34);
    ctx.lineTo(r * 0.46, -r * 0.34);
    ctx.moveTo(-r * 0.68, r * 0.32);
    ctx.quadraticCurveTo(0, r * 0.96, r * 0.68, r * 0.32);
    ctx.stroke();
  } else if (type === 'hardware') {
    // Machined Titanium Bolt / Ore-Cart Coupling Pin
    ctx.save();
    ctx.rotate(-0.45);
    ctx.fillStyle = silverGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(-r * 0.72, -r * 0.24, r * 1.18, r * 0.48, r * 0.08);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = brassGrad;
    ctx.beginPath();
    ctx.roundRect(r * 0.34, -r * 0.44, r * 0.42, r * 0.88, r * 0.10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    // Engraved Expedition Brass Plaque / Builder's Plate / Embossed Seal
    const isSeal = /seal|emblem/.test(nameLower);
    ctx.fillStyle = brassGrad;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = lw;
    if (isSeal) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.80, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(1.0, r * 0.06);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(-r * 0.82, -r * 0.58, r * 1.64, r * 1.16, r * 0.14);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(0.9, r * 0.055);
      ctx.strokeRect(-r * 0.64, -r * 0.42, r * 1.28, r * 0.84);
      // 4 corner brass rivets + engraved inscription bars
      ctx.fillStyle = '#fef9c3';
      for (const [rx, ry] of [[-0.68, -0.44], [0.68, -0.44], [-0.68, 0.44], [0.68, 0.44]]) {
        ctx.beginPath();
        ctx.arc(rx * r, ry * r, Math.max(0.9, r * 0.055), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.12);
      ctx.lineTo(r * 0.42, -r * 0.12);
      ctx.moveTo(-r * 0.28, r * 0.16);
      ctx.lineTo(r * 0.28, r * 0.16);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Rare Abyssal Giant Oarfish (Regalecus glesne) — undulating silver-ribbon body
 * with radiant crimson dorsal crest fin & flowing crown plumes (v213).
 */
export function drawStyledOarfish(ctx, v, sx, sy, scale, timeSec) {
  const len = (v.size || 4.4) * scale;
  const dir = (v.dir || 1) >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(dir, 1);

  const segs = 14;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    const x = len * (0.45 - f);
    const y = Math.sin(timeSec * 3.4 - f * 5.2 + (v.phase || 0)) * (len * 0.065 * (0.35 + f * 0.85));
    pts.push([x, y]);
  }

  // Scarlet undulating dorsal crest fin ribbon
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.86)';
  ctx.lineWidth = Math.max(2.2, len * 0.048);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === 0) ctx.moveTo(x, y - len * 0.036);
    else ctx.lineTo(x, y - len * 0.036);
  }
  ctx.stroke();

  // Mirror-silver tapered ribbon body
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(3, len * 0.068);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Iridescent cyan lateral shimmer stripe
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
  ctx.lineWidth = Math.max(1.2, len * 0.022);
  ctx.stroke();

  // Regal crimson head crest plumes + luminous golden eye
  const [hx, hy] = pts[0];
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = Math.max(1.6, len * 0.024);
  for (let p = 0; p < 3; p++) {
    const sway = Math.sin(timeSec * 4.5 + p * 0.9) * len * 0.04;
    ctx.beginPath();
    ctx.moveTo(hx - len * 0.02, hy - len * 0.02);
    ctx.quadraticCurveTo(hx - len * 0.08, hy - len * (0.14 + p * 0.04) + sway, hx - len * (0.16 + p * 0.04), hy - len * (0.11 + p * 0.02) + sway);
    ctx.stroke();
  }
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(hx + len * 0.01, hy - len * 0.008, Math.max(2, len * 0.022), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(hx + len * 0.014, hy - len * 0.008, Math.max(1, len * 0.011), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Rare Abyssal Coelacanth (Latimeria chalumnae) — prehistoric cobalt-armored
 * lobe-finned living fossil with distinct white mottling & trilobate tail (v213).
 */
export function drawStyledCoelacanth(ctx, v, sx, sy, scale, timeSec) {
  const sz = (v.size || 1.65) * scale;
  const dir = (v.dir || 1) >= 0 ? 1 : -1;
  const sway = Math.sin(timeSec * 2.4 + (v.phase || 0)) * 0.16;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(dir, 1);

  // Iconic trilobate tail fin
  ctx.save();
  ctx.translate(-sz * 0.52, 0);
  ctx.rotate(sway);
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-sz * 0.34, -sz * 0.24);
  ctx.lineTo(-sz * 0.22, 0);
  ctx.lineTo(-sz * 0.38, 0);
  ctx.lineTo(-sz * 0.22, 0);
  ctx.lineTo(-sz * 0.34, sz * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Fleshy lobed pectoral & pelvic fins
  ctx.fillStyle = '#1d4ed8';
  const finBeat = Math.sin(timeSec * 3.1 + (v.phase || 0)) * 0.22;
  for (const [fx, fy, a] of [[0.14, 0.18, 0.55 + finBeat], [-0.18, 0.2, 0.65 - finBeat], [-0.12, -0.22, -0.65 + finBeat]]) {
    ctx.save();
    ctx.translate(sz * fx, sz * fy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.16, sz * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Deep indigo-cobalt armored body
  const bg = ctx.createLinearGradient(0, -sz * 0.26, 0, sz * 0.26);
  bg.addColorStop(0, '#1e40af');
  bg.addColorStop(0.55, '#1e3a8a');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, 0, sz * 0.56, sz * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Signature pale-blue / white coelacanth scale speckles
  ctx.fillStyle = 'rgba(224, 242, 254, 0.68)';
  for (const [dx, dy, r] of [[-0.25, -0.06, 0.032], [-0.08, 0.04, 0.036], [0.06, -0.08, 0.03], [0.18, 0.03, 0.028], [-0.16, 0.09, 0.025], [0.0, -0.01, 0.026]]) {
    ctx.beginPath();
    ctx.arc(sz * dx, sz * dy, Math.max(1.2, sz * r), 0, Math.PI * 2);
    ctx.fill();
  }

  // Large golden-green nocturnal eye
  ctx.fillStyle = '#a7f3d0';
  ctx.beginPath();
  ctx.arc(sz * 0.36, -sz * 0.04, Math.max(2, sz * 0.055), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(sz * 0.37, -sz * 0.04, Math.max(1.1, sz * 0.028), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
