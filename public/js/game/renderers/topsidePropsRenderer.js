/**
 * Biome-Specific Surface Hangouts, Live Crowd Hype Reactions & Cannonballers (v284).
 * Pure canvas rendering & lightweight bounded state — zero per-frame allocations
 * on hot paths so the Mobile 4x CPU < 15.0 ms performance guard stays rock-solid.
 */

const CONFETTI_COLORS = Object.freeze([
  '#f43f5e',
  '#facc15',
  '#38bdf8',
  '#4ade80',
  '#c084fc',
  '#fb923c',
  '#f472b6',
]);

const HYPE_CALLOUTS = Object.freeze({
  splashdown: ['SPLASH! 🌊', 'DIVE IN! 🤿', 'WOO! 🎉', 'GO TEAM!'],
  sonar: ['SONAR GROOVE! 🔊', 'PING PARTY! ✨', 'HEARD YOU! 🎵'],
  loot: ['TREASURE! 💎', 'BIG HAUL! ✨', 'LEGEND! 🔥'],
  boss: ['BOSS SLAYER! 🏆', 'UNSTOPPABLE! 🔥', 'CROWD GOES WILD! 🎉'],
  surface: ['WELCOME BACK! 🎉', 'NAILED IT! ✨', 'PARTY TIME! 🥂'],
  cannonball: ['CANNONBALL! 💦', '10 / 10! 🌟'],
});

const CANNONBALL_SKINS = Object.freeze(['#f4cca4', '#e0a878', '#c58250', '#f0bf95']);
const CANNONBALL_SUITS = Object.freeze(['#ec4899', '#06b6d4', '#facc15', '#fb7185', '#a855f7']);

/**
 * Classify any expedition site into one of 5 living topside hangout biomes.
 */
export function classifyTopsideBiome(level) {
  if (!level) return 'cenote';
  const id = String(level.id || '').toLowerCase();
  const style = String(level.theme?.surfaceStyle || '').toLowerCase();
  const name = String(level.name || '').toLowerCase();
  if (level.isWreck || style === 'open-ocean-wreck' || id.includes('wreck') || id.includes('thistlegorm') || id.includes('oriskany') || id.includes('zenobia') || id.includes('britannic') || id.includes('victoria') || id.includes('fitzgerald') || id.includes('u1206') || id.includes('fujikawa') || id.includes('markgraf') || id.includes('andrea-doria')) {
    return 'wreck';
  }
  if (
    style.includes('ice') ||
    style.includes('arctic') ||
    style.includes('polar') ||
    style.includes('glac') ||
    id.includes('scoresby') ||
    id.includes('silfra') ||
    id.includes('plura') ||
    id.includes('orda') ||
    id.includes('kverk') ||
    name.includes('iceberg') ||
    name.includes('glacier')
  ) {
    return 'polar';
  }
  if (
    style.includes('volcan') ||
    style.includes('lava') ||
    style.includes('geotherm') ||
    id.includes('strytan') ||
    id.includes('grjotagja') ||
    id.includes('lanzarote') ||
    id.includes('katla')
  ) {
    return 'volcanic';
  }
  if (
    style.includes('mine') ||
    style.includes('quarry') ||
    style.includes('alpine') ||
    id.includes('ojamo') ||
    id.includes('vaucluse') ||
    id.includes('krubera') ||
    id.includes('boy-bulok') ||
    name.includes('mine')
  ) {
    return 'quarry';
  }
  return 'cenote';
}

/**
 * Ensure bounded topside hype state exists on a renderer or host object.
 */
export function ensureTopsideHypeState(host) {
  if (!host) return null;
  if (!host._topsideHype) {
    host._topsideHype = {
      energy: 0,
      eventType: 'idle',
      startedAt: -99,
      duration: 4.0,
      originX: 0,
      confetti: [],
      callouts: [],
      lastSplashTracked: false,
      lastSonarCount: 0,
      lastLootCount: 0,
      lastBossDefeated: false,
      lastLevelId: '',
      pendingCheerSound: 0,
    };
  }
  return host._topsideHype;
}

/**
 * Trigger a live topside crowd reaction burst (cheers, jump impulses, confetti, comic callouts).
 */
export function triggerTopsideHype(host, eventType = 'splashdown', worldX = 0, timeSec = 0, customCallout = '') {
  const st = ensureTopsideHypeState(host);
  if (!st) return null;
  const t = Number.isFinite(timeSec) ? timeSec : 0;
  const strength =
    eventType === 'boss' ? 1.0 :
    eventType === 'loot' ? 0.94 :
    eventType === 'surface' ? 0.9 :
    eventType === 'splashdown' ? 0.85 :
    eventType === 'sonar' ? 0.78 : 0.7;

  st.energy = Math.max(st.energy, strength);
  st.eventType = eventType;
  st.startedAt = t;
  st.duration = eventType === 'boss' ? 6.5 : eventType === 'loot' || eventType === 'surface' ? 5.2 : 3.8;
  st.originX = Number.isFinite(worldX) ? worldX : 0;
  st.pendingCheerSound = Math.max(st.pendingCheerSound, strength);

  const pool = HYPE_CALLOUTS[eventType] || HYPE_CALLOUTS.splashdown;
  const text = customCallout || pool[Math.abs(Math.floor(t * 7 + st.callouts.length)) % pool.length];
  if (st.callouts.length >= 4) st.callouts.shift();
  st.callouts.push({
    text,
    wx: st.originX + ((st.callouts.length % 2 === 0 ? -1 : 1) * (1.2 + (st.callouts.length % 3) * 0.85)),
    wy: -3.2 - (st.callouts.length % 2) * 0.7,
    bornAt: t,
    life: 2.8,
  });

  // Spawn bounded festive confetti pieces (max 34 total)
  const count = eventType === 'boss' ? 22 : eventType === 'loot' || eventType === 'surface' ? 16 : 10;
  for (let i = 0; i < count; i++) {
    if (st.confetti.length >= 34) st.confetti.shift();
    const ang = -Math.PI * 0.18 - ((i / Math.max(1, count - 1)) * Math.PI * 0.64);
    const spd = 2.6 + ((i * 37) % 10) * 0.34;
    st.confetti.push({
      wx: st.originX + (((i % 7) - 3) * 0.9),
      wy: -1.6 - (i % 3) * 0.55,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 1.2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      bornAt: t,
      life: 2.2 + (i % 4) * 0.45,
      spin: ((i % 2 === 0 ? 1 : -1) * (3.5 + (i % 5))),
    });
  }
  return st;
}

/**
 * Consume pending cheer audio intensity (returns 0 if none pending).
 */
export function consumeTopsideCheerSound(host) {
  const st = host?._topsideHype;
  if (!st || !st.pendingCheerSound) return 0;
  const v = st.pendingCheerSound;
  st.pendingCheerSound = 0;
  return v;
}

/**
 * Smoothly evaluate current topside hype energy [0..1] at timeSec.
 */
export function getTopsideHypeEnergy(host, timeSec = 0) {
  const st = host?._topsideHype;
  if (!st || st.energy <= 0.001) return 0;
  const elapsed = Math.max(0, (Number.isFinite(timeSec) ? timeSec : 0) - st.startedAt);
  if (elapsed >= st.duration) {
    st.energy = 0;
    return 0;
  }
  const remain = 1 - elapsed / Math.max(0.5, st.duration);
  // Smooth ease-out curve so initial burst stays high then tapers naturally
  return Math.max(0, Math.min(1, st.energy * Math.pow(remain, 0.72)));
}

/**
 * Observe live dive telemetry each frame and trigger crowd reactions cleanly
 * on splashdown, shallow sonar pings, boss victory surfacing, and treasure returns.
 */
export function syncTopsideHypeFromDive(host, level, diver, diveState, session, timeSec = 0) {
  const st = ensureTopsideHypeState(host);
  if (!st || !level || !diver) return 0;

  const lid = level.id || '';
  if (st.lastLevelId !== lid) {
    st.lastLevelId = lid;
    st.energy = 0;
    st.confetti.length = 0;
    st.callouts.length = 0;
    st.lastSplashTracked = diver.y > 0.9;
    st.lastSonarCount = Array.isArray(session?.sonarPings) ? session.sonarPings.length : 0;
    st.lastLootCount = diveState?.collectiblesFound || 0;
    st.lastBossDefeated = Boolean(session?.secretLair?.bossDefeated);
  }

  const depth = Number(diver.y) || 0;
  const sonarCount = Array.isArray(session?.sonarPings) ? session.sonarPings.length : 0;
  const lootCount = Number(diveState?.collectiblesFound) || 0;
  const bossDefeated = Boolean(session?.secretLair?.bossDefeated);
  const simT = Number(session?.simTimeSec) || 0;

  // 1. Splashdown reaction when entering water
  if (!st.lastSplashTracked && depth > 0.95 && simT > 0.25 && simT < 12) {
    st.lastSplashTracked = true;
    triggerTopsideHype(host, 'splashdown', diver.x, timeSec);
  }

  // 2. Shallow sonar ping makes the dock & rim crowd bounce to the ping!
  if (sonarCount > st.lastSonarCount && depth < 16) {
    triggerTopsideHype(host, 'sonar', diver.x, timeSec);
  }
  st.lastSonarCount = sonarCount;

  // 3. Surfacing after grabbing loot or slaying a boss -> big celebration!
  if (depth < 3.4 && simT > 4.0) {
    const cooledDown = timeSec - st.startedAt > 5.0;
    if (bossDefeated && (!st.lastBossDefeated || cooledDown)) {
      st.lastBossDefeated = true;
      triggerTopsideHype(host, 'boss', diver.x, timeSec);
    } else if (lootCount > 0 && (lootCount > st.lastLootCount || cooledDown)) {
      triggerTopsideHype(host, 'loot', diver.x, timeSec);
    } else if (st.lastSplashTracked && depth < 1.35 && cooledDown && simT > 14) {
      triggerTopsideHype(host, 'surface', diver.x, timeSec);
    }
  }
  st.lastLootCount = lootCount;
  if (bossDefeated) st.lastBossDefeated = true;

  return getTopsideHypeEnergy(host, timeSec);
}

/**
 * Render active confetti bursts & comic crowd callout bubbles above the waterline.
 */
export function drawTopsideHypeOverlay(host, ctx, toScreenX, toScreenY, scale, timeSec = 0) {
  const st = host?._topsideHype;
  if (!st) return;
  if (st.confetti.length === 0 && st.callouts.length === 0) return;

  ctx.save();
  // 1. Confetti ribbons with gentle gravity & flutter
  let writeIdx = 0;
  for (let i = 0; i < st.confetti.length; i++) {
    const c = st.confetti[i];
    const age = timeSec - c.bornAt;
    if (age < 0 || age > c.life) continue;
    st.confetti[writeIdx++] = c;
    const alpha = age > c.life * 0.7 ? Math.max(0, 1 - (age - c.life * 0.7) / (c.life * 0.3)) : 1;
    const wx = c.wx + c.vx * age + Math.sin(age * 4.5 + i) * 0.25;
    const wy = c.wy + c.vy * age + 1.45 * age * age;
    const sx = toScreenX(wx);
    const sy = toScreenY(wy);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(age * c.spin);
    ctx.globalAlpha = alpha * 0.94;
    ctx.fillStyle = c.color;
    const cw = Math.max(2.6, scale * 0.14);
    const ch = Math.max(1.4, scale * 0.065);
    ctx.fillRect(-cw * 0.5, -ch * 0.5, cw, ch);
    ctx.restore();
  }
  st.confetti.length = writeIdx;

  // 2. Comic hype callout pills floating above cheering crowd
  let cWrite = 0;
  for (let i = 0; i < st.callouts.length; i++) {
    const b = st.callouts[i];
    const age = timeSec - b.bornAt;
    if (age < 0 || age > b.life) continue;
    st.callouts[cWrite++] = b;
    const t = age / b.life;
    const pop = age < 0.18 ? 0.65 + (age / 0.18) * 0.35 : 1;
    const alpha = t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
    const sx = toScreenX(b.wx);
    const sy = toScreenY(b.wy - t * 1.15);
    if (scale < 12) continue;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(pop, pop);
    ctx.globalAlpha = alpha;
    const fontPx = Math.max(9, Math.min(13, Math.round(scale * 0.34)));
    ctx.font = `800 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
    const tw = ctx.measureText(b.text).width;
    const pw = tw + 14;
    const ph = fontPx + 9;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-pw * 0.5, -ph * 0.5, pw, ph, ph * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef9c3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, 0, 0.5);
    ctx.restore();
  }
  st.callouts.length = cWrite;
  ctx.restore();
}

/**
 * Draw an animated curvy swimmer running off a dock/ledge/boat stern,
 * tucking into a cannonball, splashing into the surface water, and bobbing back up!
 */
export function drawTopsideCannonballer(ctx, launchX, launchY, surfY, dir, scale, timeSec, seed = 0, hypeEnergy = 0) {
  if (!Number.isFinite(launchX) || !Number.isFinite(launchY) || !Number.isFinite(surfY) || scale < 10) return;
  const period = hypeEnergy > 0.35 ? 6.8 : 10.5;
  const phase = ((timeSec + seed * 2.17) % period + period) % period;
  const jumpDur = 1.35;
  const splashDur = 1.15;
  const bobDur = 1.4;
  if (phase > jumpDur + splashDur + bobDur) return;

  const skin = CANNONBALL_SKINS[Math.abs(seed) % CANNONBALL_SKINS.length];
  const suit = CANNONBALL_SUITS[Math.abs(seed * 3 + 1) % CANNONBALL_SUITS.length];
  const reachX = dir * scale * 2.35;
  const peakLift = scale * 1.45;
  const splashX = launchX + reachX;

  ctx.save();
  if (phase < jumpDur) {
    // Parabolic leap + mid-air cannonball tuck
    const t = phase / jumpDur;
    const px = launchX + reachX * t;
    const baseY = launchY + (surfY - launchY) * (t * t);
    const arcY = baseY - Math.sin(t * Math.PI) * peakLift;
    const rot = dir * (t * Math.PI * 1.65);

    ctx.translate(px, arcY);
    ctx.rotate(rot);
    const r = scale * 0.24;

    // Tucked curvy cannonball body (hips, bust, knees hugged to chest!)
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(-r * 0.15 * dir, r * 0.1, r * 0.92, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    // Swimsuit wrap (bikini top & bottoms)
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.ellipse(-r * 0.32 * dir, r * 0.28, r * 0.52, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.28 * dir, -r * 0.12, r * 0.36, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head + flying hair streak
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(r * 0.45 * dir, -r * 0.78, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2414';
    ctx.beginPath();
    ctx.arc(r * 0.34 * dir, -r * 0.88, r * 0.42, Math.PI * 0.85, Math.PI * 2.05);
    ctx.fill();
    // Hugged legs/knees
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(2, r * 0.42);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.quadraticCurveTo(r * 0.9 * dir, r * 0.2, r * 0.52 * dir, -r * 0.25);
    ctx.stroke();
  } else if (phase < jumpDur + splashDur) {
    // Big joyful water splash plume + expanding foam rings!
    const t = (phase - jumpDur) / splashDur;
    const alpha = Math.max(0, 1 - t);
    const plumeH = Math.sin(t * Math.PI) * scale * 1.55;
    const plumeW = (0.35 + t * 1.25) * scale;

    // Expanding surface foam ring
    ctx.strokeStyle = `rgba(224, 242, 254, ${(alpha * 0.85).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, scale * 0.08 * (1 - t * 0.5));
    ctx.beginPath();
    ctx.ellipse(splashX, surfY + scale * 0.04, plumeW * 0.95, scale * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Central spray crown
    ctx.fillStyle = `rgba(240, 249, 255, ${(alpha * 0.78).toFixed(3)})`;
    for (let i = -3; i <= 3; i++) {
      const ang = -Math.PI * 0.5 + i * 0.28;
      const dist = plumeH * (0.68 + (1 - Math.abs(i) * 0.16) * 0.42);
      const dx = splashX + Math.cos(ang) * dist * 0.85;
      const dy = surfY + Math.sin(ang) * dist;
      const dr = Math.max(1.6, scale * (0.14 - Math.abs(i) * 0.018) * (1 - t * 0.35));
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Popping back up grinning & waving!
    const t = (phase - jumpDur - splashDur) / bobDur;
    const emerge = Math.sin(t * Math.PI);
    const by = surfY - emerge * scale * 0.34;
    const r = scale * 0.14;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(splashX, by - r * 0.7, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    // Raised cheering hand
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(1.6, scale * 0.065);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(splashX + r * 0.6 * dir, by);
    ctx.lineTo(splashX + r * 1.45 * dir, by - r * (1.8 + Math.sin(timeSec * 14) * 0.35));
    ctx.stroke();
    // Foam ripple collar
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.lineWidth = Math.max(1.2, scale * 0.05);
    ctx.beginPath();
    ctx.ellipse(splashX, surfY + scale * 0.03, scale * 0.42, scale * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * BIOME HANGOUT 1: Cenote / Tropical Palapa Tiki Cabana + Swaying Rope Swing
 */
export function drawCenotePalapaAndSwing(ctx, sx, sy, scale, timeSec = 0, opts = {}) {
  const s = scale;
  const compact = Boolean(opts.compact);
  const facing = opts.facing || 1;
  ctx.save();
  ctx.translate(sx, sy);

  // Wooden deck floor
  const deckW = s * 3.1;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-deckW * 0.5, -s * 0.14, deckW, s * 0.18);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-deckW * 0.5, -s * 0.14, deckW, s * 0.06);

  // Bamboo support posts
  ctx.fillStyle = '#a16207';
  ctx.fillRect(-s * 1.18, -s * 2.05, s * 0.14, s * 1.95);
  ctx.fillRect(s * 1.04, -s * 2.05, s * 0.14, s * 1.95);

  // Crossbar & hanging tiki bar counter
  ctx.fillStyle = '#713f12';
  ctx.fillRect(-s * 0.95, -s * 0.82, s * 1.9, s * 0.12);
  ctx.fillStyle = '#854d0e';
  ctx.fillRect(-s * 0.85, -s * 0.7, s * 1.7, s * 0.56);

  // Thatched palm-leaf palapa roof
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.moveTo(-s * 1.75, -s * 1.92);
  ctx.quadraticCurveTo(0, -s * 3.15, s * 1.75, -s * 1.92);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(-s * 1.52, -s * 2.02);
  ctx.quadraticCurveTo(0, -s * 2.95, s * 1.52, -s * 2.02);
  ctx.closePath();
  ctx.fill();

  // Warm Edison string bulbs under eaves
  if (!compact) {
    const bulbColors = ['#fef08a', '#fb7185', '#38bdf8', '#fde047', '#4ade80'];
    for (let i = 0; i < 5; i++) {
      const bx = -s * 1.1 + i * s * 0.55;
      const by = -s * 1.88 + Math.sin((i / 4) * Math.PI) * s * 0.14;
      const glow = 0.65 + 0.35 * Math.sin(timeSec * 3.8 + i * 1.2);
      ctx.fillStyle = bulbColors[i];
      ctx.globalAlpha = glow;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1.8, s * 0.085), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Glowing tiki torch beside palapa
    const tx = -facing * s * 1.55;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(tx - s * 0.04, -s * 1.45, s * 0.08, s * 1.45);
    const fl = Math.sin(timeSec * 12) * s * 0.05;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(tx + fl * 0.5, -s * 1.62, s * 0.14, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(tx, -s * 1.58, s * 0.07, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Swaying overhanging branch + rope swing toward the basin water
    const swingAng = Math.sin(timeSec * 1.65) * 0.24;
    const branchX = facing * s * 1.65;
    const branchY = -s * 2.55;
    ctx.strokeStyle = '#573619';
    ctx.lineWidth = Math.max(2.2, s * 0.11);
    ctx.beginPath();
    ctx.moveTo(facing * s * 0.9, -s * 2.2);
    ctx.quadraticCurveTo(facing * s * 1.35, -s * 2.65, branchX, branchY);
    ctx.stroke();

    const ropeLen = s * 1.45;
    const rx = branchX + Math.sin(swingAng) * ropeLen;
    const ry = branchY + Math.cos(swingAng) * ropeLen;
    ctx.strokeStyle = '#d6b67c';
    ctx.lineWidth = Math.max(1.2, s * 0.045);
    ctx.beginPath();
    ctx.moveTo(branchX, branchY);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    // Wooden swing handle knot
    ctx.fillStyle = '#92400e';
    ctx.fillRect(rx - s * 0.18, ry - s * 0.04, s * 0.36, s * 0.08);
  }
  ctx.restore();
}

/**
 * BIOME HANGOUT 2: Polar / Glacial Arctic Research Dome, Snowcat & Steaming Warming Barrel
 */
export function drawPolarResearchBase(ctx, sx, sy, scale, timeSec = 0, opts = {}) {
  const s = scale;
  const compact = Boolean(opts.compact);
  ctx.save();
  ctx.translate(sx, sy);

  // Geodesic orange expedition dome tent
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.38, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Geodesic strut lines
  ctx.strokeStyle = 'rgba(255, 237, 213, 0.52)';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(-s * 1.25, -s * 0.45);
  ctx.lineTo(s * 1.25, -s * 0.45);
  ctx.moveTo(-s * 0.65, -s * 1.2);
  ctx.lineTo(0, 0);
  ctx.lineTo(s * 0.65, -s * 1.2);
  ctx.stroke();

  // Warm cozy amber expedition window glow
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.roundRect(-s * 0.42, -s * 0.78, s * 0.84, s * 0.46, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.stroke();

  if (!compact) {
    // Radio/weather mast with blinking safety beacon
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.2, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(s * 0.95, -s * 0.95);
    ctx.lineTo(s * 0.95, -s * 2.15);
    ctx.stroke();
    const blink = 0.45 + 0.55 * Math.sin(timeSec * 5.2);
    ctx.fillStyle = `rgba(56, 189, 248, ${blink.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s * 0.95, -s * 2.18, Math.max(2, s * 0.1), 0, Math.PI * 2);
    ctx.fill();

    // Compact tracked polar snowcat to the left
    const cx = -s * 2.35;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cx - s * 0.72, -s * 0.32, s * 1.44, s * 0.34, s * 0.14);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.roundRect(cx - s * 0.62, -s * 0.94, s * 1.18, s * 0.66, s * 0.12);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(cx + s * 0.08, -s * 0.84, s * 0.38, s * 0.3);

    // Steaming cedar hot-tub warming barrel to the right!
    const bx = s * 2.1;
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.roundRect(bx - s * 0.52, -s * 0.68, s * 1.04, s * 0.68, s * 0.1);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.52, -s * 0.22);
    ctx.lineTo(bx + s * 0.52, -s * 0.22);
    ctx.moveTo(bx - s * 0.52, -s * 0.48);
    ctx.lineTo(bx + s * 0.52, -s * 0.48);
    ctx.stroke();
    // Rising thermal steam wisps
    for (let i = 0; i < 3; i++) {
      const ph = ((timeSec * 0.65 + i * 0.33) % 1);
      const wx = bx + (i - 1) * s * 0.24 + Math.sin(timeSec * 2.2 + i) * s * 0.12;
      const wy = -s * 0.78 - ph * s * 0.95;
      ctx.fillStyle = `rgba(241, 245, 249, ${(0.42 * (1 - ph)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(wx, wy, s * (0.14 + ph * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * BIOME HANGOUT 3: Volcanic / Geothermal Dive Outpost (Shade Awning, Lanterns & Steam)
 */
export function drawGeothermalOutpost(ctx, sx, sy, scale, timeSec = 0, opts = {}) {
  const s = scale;
  const compact = Boolean(opts.compact);
  ctx.save();
  ctx.translate(sx, sy);

  // Basalt stone pad & awning frame
  ctx.fillStyle = '#334155';
  ctx.fillRect(-s * 1.55, -s * 0.14, s * 3.1, s * 0.16);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1.5, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(-s * 1.2, -s * 0.12);
  ctx.lineTo(-s * 1.2, -s * 1.95);
  ctx.moveTo(s * 1.2, -s * 0.12);
  ctx.lineTo(s * 1.2, -s * 1.72);
  ctx.stroke();

  // Slanted expedition tarpaulin
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.moveTo(-s * 1.55, -s * 2.02);
  ctx.lineTo(s * 1.55, -s * 1.75);
  ctx.lineTo(s * 1.55, -s * 1.55);
  ctx.lineTo(-s * 1.55, -s * 1.82);
  ctx.closePath();
  ctx.fill();

  if (!compact) {
    // Glowing amber lanterns
    for (let i = 0; i < 3; i++) {
      const lx = -s * 0.8 + i * s * 0.8;
      const ly = -s * 1.62 + i * s * 0.08;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(2, s * 0.11), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.1, s * 0.055), 0, Math.PI * 2);
      ctx.fill();
    }
    // Gentle volcanic steam wisp beside outcrop
    const ph = (timeSec * 0.55) % 1;
    ctx.fillStyle = `rgba(226, 232, 240, ${(0.34 * (1 - ph)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(s * 1.75 + Math.sin(timeSec * 2) * s * 0.15, -s * 0.4 - ph * s * 1.2, s * (0.2 + ph * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * BIOME HANGOUT 4: Mine / Quarry / Karst Surf-Dive Van & Festive Pennant Bunting
 */
export function drawQuarryExpeditionRig(ctx, sx, sy, scale, timeSec = 0, opts = {}) {
  const s = scale;
  const compact = Boolean(opts.compact);
  ctx.save();
  ctx.translate(sx, sy);

  // Retro coastal dive van silhouette
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(-s * 1.48, -s * 1.24, s * 2.96, s * 0.98, s * 0.22);
  ctx.fill();
  // Cream upper roof half
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.roundRect(-s * 1.42, -s * 1.3, s * 2.84, s * 0.56, [s * 0.2, s * 0.2, 0, 0]);
  ctx.fill();
  // Panoramic surf-van windows
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-s * 1.15, -s * 1.18, s * 0.65, s * 0.36);
  ctx.fillRect(-s * 0.36, -s * 1.18, s * 0.72, s * 0.36);
  ctx.fillRect(s * 0.5, -s * 1.18, s * 0.68, s * 0.36);

  // Roof surfboard + strapped scuba cylinder
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.ellipse(0, -s * 1.44, s * 1.12, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-s * 0.85, -s * 0.24, s * 0.28, 0, Math.PI * 2);
  ctx.arc(s * 0.85, -s * 0.24, s * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(-s * 0.85, -s * 0.24, s * 0.12, 0, Math.PI * 2);
  ctx.arc(s * 0.85, -s * 0.24, s * 0.12, 0, Math.PI * 2);
  ctx.fill();

  if (!compact) {
    // Festive pennant bunting mast
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1.1, s * 0.045);
    ctx.beginPath();
    ctx.moveTo(s * 1.65, 0);
    ctx.lineTo(s * 1.65, -s * 2.05);
    ctx.moveTo(-s * 1.65, 0);
    ctx.lineTo(-s * 1.65, -s * 2.05);
    ctx.stroke();

    const flagCols = ['#f43f5e', '#facc15', '#38bdf8', '#4ade80', '#c084fc'];
    for (let i = 0; i < 5; i++) {
      const fx = -s * 1.32 + i * s * 0.66;
      const sag = Math.sin(((i + 0.5) / 5) * Math.PI) * s * 0.28;
      const flutter = Math.sin(timeSec * 5 + i) * s * 0.04;
      ctx.fillStyle = flagCols[i];
      ctx.beginPath();
      ctx.moveTo(fx - s * 0.16, -s * 1.98 + sag);
      ctx.lineTo(fx + s * 0.16, -s * 1.98 + sag);
      ctx.lineTo(fx + flutter, -s * 1.66 + sag);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * BIOME HANGOUT 5: Shipwreck / Open-Ocean Party Dive Boat Enhancements
 * Adds warm deck string lights, beat-pulsing twin speakers, and red/white diver-down flag.
 */
export function drawPartyDiveBoatEnhancements(ctx, cx, surfY, bw, bh, scale, timeSec = 0, hypeEnergy = 0) {
  if (!Number.isFinite(cx) || !Number.isFinite(surfY)) return;
  const deckY = surfY - bh * 0.66;
  const s = scale;
  const beat = Math.pow(0.5 + 0.5 * Math.sin(timeSec * (116 / 60) * Math.PI * 2), 2);
  ctx.save();

  // 1. Warm party deck string lights arching from bow rail to cabin canopy to stern!
  const bulbCols = ['#fef08a', '#fb7185', '#38bdf8', '#4ade80', '#facc15', '#f472b6'];
  const x0 = cx - bw * 0.44;
  const x1 = cx + bw * 0.44;
  const yTop = deckY - bh * 0.92;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.52)';
  ctx.lineWidth = Math.max(1, s * 0.032);
  ctx.beginPath();
  ctx.moveTo(x0, deckY - bh * 0.35);
  ctx.quadraticCurveTo(cx, yTop - bh * 0.18, x1, deckY - bh * 0.35);
  ctx.stroke();

  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const bx = x0 + (x1 - x0) * t;
    const by = (1 - t) * (1 - t) * (deckY - bh * 0.35) + 2 * (1 - t) * t * (yTop - bh * 0.18) + t * t * (deckY - bh * 0.35);
    const glow = 0.68 + 0.32 * Math.sin(timeSec * 5 + i * 1.1);
    ctx.fillStyle = bulbCols[i % bulbCols.length];
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.arc(bx, by + s * 0.04, Math.max(1.8, s * (0.075 + hypeEnergy * 0.025)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 2. Beat-pulsing deck speaker stack on stern rail
  const spx = cx + bw * 0.27;
  const spy = deckY - s * 0.52;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(spx - s * 0.22, spy, s * 0.44, s * 0.52, s * 0.06);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(spx, spy + s * 0.16, s * (0.09 + beat * 0.025), 0, Math.PI * 2);
  ctx.arc(spx, spy + s * 0.38, s * (0.12 + beat * 0.032), 0, Math.PI * 2);
  ctx.fill();

  // Pulsing soundwave arc when beat hits
  if (beat > 0.55 || hypeEnergy > 0.2) {
    ctx.strokeStyle = `rgba(56, 189, 248, ${(0.25 + beat * 0.45).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.1, s * 0.04);
    ctx.beginPath();
    ctx.arc(spx, spy + s * 0.24, s * (0.34 + beat * 0.22), -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
  }

  // 3. Red-and-white Diver-Down flag flying at stern mast
  const fx = cx - bw * 0.42;
  const fy = deckY - bh * 1.18;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(1.2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(fx, deckY);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  const fw = s * 0.62;
  const fh = s * 0.38;
  const wave = Math.sin(timeSec * 5.2) * s * 0.05;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx - fw, fy + wave);
  ctx.lineTo(fx - fw, fy + fh + wave);
  ctx.lineTo(fx, fy + fh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.4, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(fx, fy + s * 0.03);
  ctx.lineTo(fx - fw, fy + fh + wave - s * 0.03);
  ctx.stroke();

  ctx.restore();
}

/**
 * Dispatch the matching biome hangout setpiece for any site (in-game topside & Victory Photo).
 */
export function drawBiomeSurfaceHangout(ctx, level, sx, sy, scale, timeSec = 0, opts = {}) {
  const biome = classifyTopsideBiome(level);
  if (biome === 'polar') {
    drawPolarResearchBase(ctx, sx, sy, scale, timeSec, opts);
  } else if (biome === 'volcanic') {
    drawGeothermalOutpost(ctx, sx, sy, scale, timeSec, opts);
  } else if (biome === 'quarry') {
    drawQuarryExpeditionRig(ctx, sx, sy, scale, timeSec, opts);
  } else {
    drawCenotePalapaAndSwing(ctx, sx, sy, scale, timeSec, opts);
  }
  return biome;
}
