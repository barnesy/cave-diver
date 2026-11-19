import { evaluateCaveSDF, evaluateCaveNormal } from './collision.js';

function randHash(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Probes along a ray from an open tunnel point until hitting rock wall.
 */
function findWallAnchor(level, ox, oy, dx, dy, maxDist = 8) {
  for (let t = 0.2; t <= maxDist; t += 0.22) {
    const px = ox + dx * t;
    const py = oy + dy * t;
    if (evaluateCaveSDF(level, px, py) >= 0) {
      const n = evaluateCaveNormal(level, px, py);
      // Outward normal points from rock INTO open water
      return {
        x: px - dx * 0.1,
        y: py - dy * 0.1,
        nx: -n.nx,
        ny: -n.ny,
      };
    }
  }
  return null;
}

/**
 * Generates authentic Yucatan karst cenote & flooded cave flora/fauna stratified by light & halocline depth.
 */
export function createMarineEcosystem(level) {
  const anchored = []; // Roots / eelgrass, Chara stonewort, calcite soda straws, biofilms, calcite crystals
  const fish = []; // Sunlit fish, pale catfish, Dama Blanca blind cavefish
  const remipedes = []; // Cave crustaceans (remipedes, white prawns, Florida blind cave crayfish)
  const turtles = []; // Freshwater sliders / turtles in sunlit surface pools
  const themeId = level.theme?.id || 'yucatan-cenote';
  const isFlorida = themeId === 'florida-karst';
  const isNordic = themeId === 'nordic-marble';
  const isProvence = themeId === 'provence-gorge';
  const isKalahari = themeId === 'kalahari-dolomite';
  const isUral = themeId === 'ural-gypsum-karst';
  const isAurora =
    themeId === 'aurora-glacial' ||
    themeId === 'strytan-hydrothermal' ||
    themeId === 'kverkfjoll-glacier' ||
    themeId === 'grjotagja-lava' ||
    themeId === 'atlantida-volcanic' ||
    themeId === 'boybulok-alpine';

  // 1. Sunlit Surface Basins
  for (let bIdx = 0; bIdx < level.openBasins.length; bIdx++) {
    const basin = level.openBasins[bIdx];
    const cx = (basin.xMin + basin.xMax) * 0.5;
    const width = basin.xMax - basin.xMin;

    // Hanging surface aquatic roots / water-moss tendrils (omitted in crystal sub-glacial Aurora pool)
    if (!isAurora) {
      for (let i = 0; i < 9; i++) {
        const rx = basin.xMin + 1.2 + (i / 8) * Math.max(2, width - 2.4);
        anchored.push({
          kind: 'vine',
          x: rx,
          y: 0.05,
          nx: 0,
          ny: 1,
          size: isFlorida || isNordic || isKalahari || isUral ? 0.95 + randHash(rx * 2.7) * 1.3 : 1.3 + randHash(rx * 3.1) * 1.9,
          color: isFlorida
            ? (i % 2 === 0 ? '#78350f' : '#3f6212')
            : isNordic || isUral
              ? (i % 2 === 0 ? '#115e59' : '#0f766e')
              : isKalahari
                ? (i % 2 === 0 ? '#92400e' : '#65a30d')
                : isProvence
                  ? (i % 2 === 0 ? '#3f6212' : '#4d7c0f')
                  : (i % 3 === 0 ? '#15803d' : '#16a34a'),
          accent: isFlorida ? '#fde047' : isNordic || isUral ? '#a5f3fc' : isKalahari ? '#fdba74' : isProvence ? '#bef264' : (i % 3 === 0 ? '#fef9c3' : '#86efac'),
          phase: randHash(rx) * Math.PI * 2,
        });
      }
    }

    // Sunlit Basin Fish adapted by region
    const fishPalette = isFlorida
      ? ['#f59e0b', '#fb923c', '#84cc16', '#38bdf8']
      : isAurora
        ? ['#5eead4', '#38bdf8', '#cbd5e1', '#c084fc']
        : isNordic || isUral
          ? ['#7dd3fc', '#cbd5e1', '#38bdf8', '#fb7185']
          : isKalahari
            ? ['#fbbf24', '#fb7185', '#a78bfa', '#38bdf8']
            : isProvence
              ? ['#fde047', '#93c5fd', '#bef264', '#cbd5e1']
              : ['#5eead4', '#38bdf8', '#a3e635', '#fbbf24'];
    for (let i = 0; i < 14; i++) {
      const fx = cx + (randHash(i * 11 + cx) - 0.5) * Math.min(8.2, width * 0.82);
      const fy = 1.4 + randHash(i * 19 + cx) * 7.8;
      if (evaluateCaveSDF(level, fx, fy) < -0.5) {
        const isLarger = i % 3 === 0;
        fish.push({
          kind: isLarger ? 'cichlid' : 'molly',
          x: fx,
          y: fy,
          homeX: fx,
          homeY: fy,
          vx: (randHash(i * 7) - 0.5) * 0.9,
          vy: (randHash(i * 13) - 0.5) * 0.3,
          size: isLarger ? 0.24 + randHash(i * 5) * 0.08 : 0.14 + randHash(i * 5) * 0.09,
          color: isFlorida
            ? (isLarger ? '#b45309' : fishPalette[i % fishPalette.length])
            : isAurora
              ? (isLarger ? '#334155' : fishPalette[i % fishPalette.length])
              : isNordic
                ? (isLarger ? '#64748b' : fishPalette[i % fishPalette.length])
                : isKalahari
                  ? (isLarger ? '#d97706' : fishPalette[i % fishPalette.length])
                  : isProvence
                    ? (isLarger ? '#94a3b8' : fishPalette[i % fishPalette.length])
                    : (isLarger ? '#ca8a04' : fishPalette[i % fishPalette.length]),
          stripe: isFlorida ? '#fde68a' : isAurora ? '#67e8f9' : isNordic ? '#e0f2fe' : isKalahari ? '#fef08a' : isProvence ? '#fef3c7' : (isLarger ? '#0f766e' : '#fef08a'),
          phase: i * 0.7,
        });
      }
    }

    // Freshwater Slider Turtle in warm-water karst basins (omitted in sub-arctic Norway & Iceland)
    const tx = cx + (bIdx === 0 ? -0.6 : -1.5);
    const ty = bIdx === 0 ? 3.2 : 3.6;
    if (!isNordic && !isAurora && evaluateCaveSDF(level, tx, ty) < -0.9) {
      turtles.push({
        kind: 'slider',
        x: tx,
        y: ty,
        homeX: cx,
        homeY: ty,
        vx: 0.45,
        vy: 0,
        angle: bIdx === 0 ? 0 : Math.PI,
        phase: bIdx * 2.1,
      });
    }
  }

  // 2. Cavern Transition Pale Catfish (Rhamdia guatemalensis) along twilight shelves (10m–24m)
  const twilightSpots = [];
  for (let i = 0; i < level.segments.length; i++) {
    const s = level.segments[i];
    const mx = (s.ax + s.bx) * 0.5;
    const my = (s.ay + s.by) * 0.5;
    if (my >= 10 && my <= 24 && Math.min(s.ra, s.rb) >= 2.6) {
      twilightSpots.push({ x: mx, y: my });
    }
  }
  for (let i = 0; i < twilightSpots.length; i++) {
    const ts = twilightSpots[i];
    if (evaluateCaveSDF(level, ts.x, ts.y) < -0.5) {
      fish.push({
        kind: 'catfish',
        x: ts.x,
        y: ts.y,
        homeX: ts.x,
        homeY: ts.y,
        vx: i % 2 === 0 ? 0.45 : -0.45,
        vy: 0,
        size: 0.25 + (i % 2) * 0.04,
        color: '#cbd5e1',
        stripe: '#94a3b8',
        phase: i * 1.3,
      });
    }
  }

  // 3. Wall- & Ceiling-Anchored Authentic Cave Formations & Cenote Flora
  for (let sIdx = 0; sIdx < level.segments.length; sIdx++) {
    const seg = level.segments[sIdx];
    const segLen = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    const steps = Math.max(3, Math.floor(segLen / 1.8));

    for (let k = 0; k <= steps; k++) {
      const t = k / Math.max(1, steps);
      const cx = seg.ax + (seg.bx - seg.ax) * t;
      const cy = seg.ay + (seg.by - seg.ay) * t;
      const r = seg.ra + (seg.rb - seg.ra) * t;
      if (r < 2.2) continue;

      for (let p = 0; p < 3; p++) {
        const seed = sIdx * 97 + k * 23 + p * 7;
        const h = randHash(seed);
        if (h < 0.24) continue;

        const probeAng = h * Math.PI * 2;
        const anchor = findWallAnchor(level, cx, cy, Math.cos(probeAng), Math.sin(probeAng), r + 2.5);
        if (!anchor || anchor.y < 1.2) continue;

        if (anchor.y < 14 && anchor.ny < -0.2) {
          // Sunlit freshwater Chara stonewort / cenote emerald algae tufts
          anchored.push({
            kind: 'chara',
            x: anchor.x,
            y: anchor.y,
            nx: anchor.nx,
            ny: anchor.ny,
            size: 0.42 + randHash(seed + 1) * 0.55,
            color: h > 0.55 ? '#15803d' : '#0d9488',
            accent: '#86efac',
            phase: h * 6.28,
          });
        } else if (anchor.ny > 0.28 && anchor.y >= 11) {
          // Delicate submerged calcite soda-straw stalactites & cave flowstone curtains on ceilings
          anchored.push({
            kind: 'sodastraw',
            x: anchor.x,
            y: anchor.y,
            nx: 0,
            ny: 1,
            size: 0.36 + randHash(seed + 2) * 0.5,
            color: '#d6cfc2',
            accent: '#fef3c7',
            phase: h * 6.28,
          });
        } else if (anchor.y >= 21 && anchor.y <= 38 && h > 0.52) {
          // Halocline sulfur / iron-oxidizing microbial biofilm filaments
          anchored.push({
            kind: 'biofilm',
            x: anchor.x,
            y: anchor.y,
            nx: anchor.nx,
            ny: anchor.ny,
            size: 0.34 + randHash(seed + 3) * 0.36,
            color: '#d97706',
            accent: '#fef3c7',
            phase: h * 6.28,
          });
        } else if (anchor.y >= 26) {
          // Phreatic dogtooth calcite / aragonite or volcanic silica quartz crystal clusters
          anchored.push({
            kind: 'crystal',
            x: anchor.x,
            y: anchor.y,
            nx: anchor.nx,
            ny: anchor.ny,
            size: 0.32 + randHash(seed + 4) * 0.36,
            color: isAurora ? '#99f6e4' : '#e2e8f0',
            accent: isAurora ? '#c4b5fd' : '#bae6fd',
            phase: h * 6.28,
          });
        }
      }
    }
  }

  // 4. Halocline & Deep Phreatic Cave Crustaceans: Blind Remipedes (Xibalbanus) & White Cave Prawns
  const critterSpots = [];
  for (let i = 0; i < level.segments.length; i++) {
    const s = level.segments[i];
    const mx = (s.ax + s.bx) * 0.5;
    const my = (s.ay + s.by) * 0.5;
    if (my >= 22 && my <= 60) {
      critterSpots.push({ x: mx, y: my - 0.3, kind: i % 2 === 0 ? 'remipede' : 'prawn' });
    }
  }
  for (let i = 0; i < critterSpots.length; i++) {
    const cs = critterSpots[i];
    if (evaluateCaveSDF(level, cs.x, cs.y) < -0.5) {
      remipedes.push({
        kind: cs.kind,
        x: cs.x,
        y: cs.y,
        homeX: cs.x,
        homeY: cs.y,
        angle: i % 2 === 0 ? 0.1 : Math.PI - 0.1,
        color: cs.kind === 'remipede' ? '#fde68a' : '#f1f5f9',
        size: cs.kind === 'remipede' ? 0.34 : 0.24,
        phase: i * 1.4,
      });
    }
  }

  // 5. Dama Blanca Blind Cavefish (Typhliasina pearsei) in deep dark galleries (>= 32m)
  const deepSpots = [];
  for (let i = 0; i < level.segments.length; i++) {
    const s = level.segments[i];
    const mx = (s.ax + s.bx) * 0.5;
    const my = (s.ay + s.by) * 0.5;
    if (my >= 32 && Math.min(s.ra, s.rb) >= 2.2) {
      deepSpots.push({ x: mx, y: my });
    }
  }
  for (let i = 0; i < deepSpots.length; i++) {
    const ds = deepSpots[i];
    for (let j = 0; j < 3; j++) {
      const fx = ds.x + (j - 1) * 1.4;
      const fy = ds.y + (j % 2 === 0 ? -0.55 : 0.55);
      if (evaluateCaveSDF(level, fx, fy) < -0.4) {
        fish.push({
          kind: 'cavefish',
          x: fx,
          y: fy,
          homeX: fx,
          homeY: fy,
          vx: j % 2 === 0 ? 0.5 : -0.5,
          vy: 0,
          size: 0.18,
          color: '#fce7f3',
          stripe: '#fda4af',
          phase: i + j,
        });
      }
    }
  }

  return { anchored, fish, remipedes, turtles };
}

/**
 * Advances authentic Yucatan fish schools, cave remipedes/prawns, and cenote slider turtles.
 */
export function stepMarineEcosystem(eco, diver, dt, timeSec, level) {
  if (!eco) return;
  const lerp = Math.min(1, dt * 2.2);
  const cullDistSq = 42 * 42;
  const hasDiver = Boolean(diver);
  const divX = hasDiver ? diver.x : 0;
  const divY = hasDiver ? diver.y : 0;

  // Fish schooling + gentle swim-away near diver (distance-culled for distant chambers)
  for (let i = 0; i < eco.fish.length; i++) {
    const f = eco.fish[i];
    if (hasDiver) {
      const cdx = f.x - divX;
      const cdy = f.y - divY;
      if (cdx * cdx + cdy * cdy > cullDistSq) continue;
    }
    const targetVx = Math.cos(timeSec * 0.7 + f.phase) * 0.8 + (f.homeX - f.x) * 0.34;
    const targetVy = Math.sin(timeSec * 1.2 + f.phase) * 0.24 + (f.homeY - f.y) * 0.45;
    f.vx += (targetVx - f.vx) * lerp;
    f.vy += (targetVy - f.vy) * lerp;

    if (hasDiver) {
      const dx = f.x - divX;
      const dy = f.y - divY;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0.0025 && distSq < 9.0) {
        const dist = Math.sqrt(distSq);
        const push = ((3.0 - dist) / 3.0) * 4.2;
        f.vx += (dx / dist) * push * dt;
        f.vy += (dy / dist) * push * dt;
      }
    }

    const nx = f.x + f.vx * dt;
    const ny = Math.max(0.6, f.y + f.vy * dt);
    if (evaluateCaveSDF(level, nx, ny) < -0.25) {
      f.x = nx;
      f.y = ny;
    } else {
      f.vx *= -0.7;
      f.vy *= -0.7;
    }
  }

  // Sinuous Blind Cave Remipedes & Cave Prawns
  for (let i = 0; i < eco.remipedes.length; i++) {
    const r = eco.remipedes[i];
    if (hasDiver) {
      const cdx = r.homeX - divX;
      const cdy = r.homeY - divY;
      if (cdx * cdx + cdy * cdy > cullDistSq) continue;
    }
    const prevX = r.x;
    const prevY = r.y;
    const nx = r.homeX + Math.sin(timeSec * 0.5 + r.phase) * 1.15;
    const ny = r.homeY + Math.cos(timeSec * 0.75 + r.phase) * 0.55;
    if (evaluateCaveSDF(level, nx, ny) < -0.25) {
      r.x = nx;
      r.y = ny;
      r.angle = Math.atan2(r.y - prevY, r.x - prevX || 0.001);
    }
  }

  // Freshwater Cenote Slider Turtles patrolling sunlit surface pools
  for (let i = 0; i < eco.turtles.length; i++) {
    const t = eco.turtles[i];
    if (hasDiver) {
      const cdx = t.homeX - divX;
      const cdy = t.homeY - divY;
      if (cdx * cdx + cdy * cdy > cullDistSq) continue;
    }
    t.phase += dt * 0.44;
    const tx = t.homeX + Math.cos(t.phase) * 3.1;
    const ty = t.homeY + Math.sin(t.phase * 2) * 0.7;
    if (evaluateCaveSDF(level, tx, ty) < -0.4) {
      t.vx = (tx - t.x) / Math.max(0.01, dt);
      t.vy = (ty - t.y) / Math.max(0.01, dt);
      t.angle = Math.atan2(ty - t.y, tx - t.x);
      t.x = tx;
      t.y = ty;
    }
  }
}
