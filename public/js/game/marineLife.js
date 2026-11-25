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
  const anchored = []; // Roots / eelgrass, Chara stonewort, calcite soda straws, biofilms, calcite crystals (or wreck rusticles & sea fans)
  const fish = []; // Sunlit fish, pale catfish, Dama Blanca blind cavefish (or pelagic baitballs & barracuda)
  const remipedes = []; // Cave crustaceans (remipedes, white prawns, Florida blind cave crayfish)
  const turtles = []; // Freshwater sliders / turtles in sunlit surface pools
  const jellies = []; // Pelagic drifting moon jellyfish along shipwreck shot lines
  const megafauna = []; // Goliath groupers, cruising reef sharks, giant manta rays & arctic belugas
  const denizens = []; // Interactive crevice denizens: chromatophore Giant Octopuses & Emerald Moray Eels (v162)
  const themeId = level.theme?.id || 'yucatan-cenote';

  // Dedicated Artificial-Reef & Pelagic Shipwreck Ecosystem (no cenote vines, turtles, or blind cavefish!)
  if (level.isWreck) {
    const isFreshwater = themeId === 'superior-memorial-wreck';
    const isWarmReef =
      themeId === 'gulf-carrier-wreck' ||
      themeId === 'aegean-britannic-wreck' ||
      themeId === 'red-sea-coral-wreck';
    const shotX = level.shotLine?.x ?? level.spawn?.x ?? 10;
    const deckY = level.wreckDeckY ?? 42;
    const hMin = level.wreckHullXMin ?? -24;
    const hMax = level.wreckHullXMax ?? 96;

    // 1. Pelagic Baitball Schools along the shot line & above the wreck superstructure
    const schoolDepths = [];
    const span = Math.max(16, deckY - 10);
    const schoolCount = Math.min(5, Math.max(3, Math.floor(span / 16) + 1));
    for (let sc = 0; sc < schoolCount; sc++) {
      const sy = 7 + ((sc + 0.5) / schoolCount) * Math.max(12, deckY - 9);
      const sx = shotX + (sc % 2 === 0 ? -4.5 : 5.5) + (randHash(sc * 17 + shotX) - 0.5) * 4;
      schoolDepths.push({ x: sx, y: sy });
    }
    // Additional schools cruising over deck landmarks
    schoolDepths.push({ x: (hMin + hMax) * 0.5, y: Math.max(10, deckY - 4.5) });
    schoolDepths.push({ x: hMax - 12, y: Math.max(12, deckY - 6.0) });

    for (let sc = 0; sc < schoolDepths.length; sc++) {
      const center = schoolDepths[sc];
      const count = isFreshwater ? 5 : 9;
      for (let i = 0; i < count; i++) {
        const fx = center.x + (randHash(sc * 31 + i * 7) - 0.5) * 7.5;
        const fy = center.y + (randHash(sc * 43 + i * 13) - 0.5) * 3.8;
        if (evaluateCaveSDF(level, fx, fy) < -0.6) {
          fish.push({
            kind: isFreshwater ? 'catfish' : (i % 4 === 0 ? 'barracuda' : 'molly'),
            x: fx,
            y: fy,
            homeX: center.x + (randHash(sc * 19 + i) - 0.5) * 3.5,
            homeY: center.y + (randHash(sc * 23 + i) - 0.5) * 2.0,
            vx: (sc % 2 === 0 ? 1 : -1) * (0.65 + randHash(i * 5) * 0.55),
            vy: 0,
            size: isFreshwater ? 0.24 : (i % 4 === 0 ? 0.36 : 0.17 + randHash(i * 9) * 0.07),
            color: isFreshwater ? '#94a3b8' : (i % 4 === 0 ? '#cbd5e1' : (isWarmReef ? '#7dd3fc' : '#93c5fd')),
            stripe: isFreshwater ? '#64748b' : (isWarmReef ? '#fde047' : '#e0f2fe'),
            phase: sc * 1.7 + i * 0.35,
          });
        }
      }
    }

    // 2. Translucent Drifting Pelagic Moon Jellyfish along open-water shot line (ocean wrecks only)
    if (!isFreshwater) {
      const jellyCount = Math.min(10, Math.max(5, Math.floor(deckY / 11)));
      for (let j = 0; j < jellyCount; j++) {
        const jy = 6 + ((j + 0.4) / jellyCount) * Math.max(10, deckY - 8);
        const jx = shotX + (randHash(j * 29 + deckY) - 0.5) * 22;
        if (evaluateCaveSDF(level, jx, jy) < -1.0) {
          jellies.push({
            x: jx,
            y: jy,
            homeX: jx,
            homeY: jy,
            size: 0.38 + randHash(j * 11) * 0.34,
            hue: isWarmReef ? (j % 2 === 0 ? '#f472b6' : '#38bdf8') : '#a5b4fc',
            phase: randHash(j * 41) * Math.PI * 2,
          });
        }
      }
    }

    // 3. Iconic Wreck Megafauna: Cruising Reef Sharks, Giant Manta Rays & Giant Goliath Groupers
    if (!isFreshwater) {
      const sharkY1 = Math.max(14, deckY * 0.58);
      const sharkX1 = (hMin + hMax) * 0.45;
      if (evaluateCaveSDF(level, sharkX1, sharkY1) < -2.0) {
        megafauna.push({
          id: `mega_shark_1_${level.id || 'w'}`,
          kind: 'shark',
          label: 'Gray Reef Shark',
          x: sharkX1,
          y: sharkY1,
          homeX: sharkX1,
          homeY: sharkY1,
          patrolRx: Math.min(28, Math.max(14, (hMax - hMin) * 0.28)),
          patrolRy: 3.2,
          vx: 1.6,
          vy: 0,
          size: 1.85,
          phase: 0.4,
          facing: 1,
          pitch: 0,
          swimPhase: 0.4,
          behavior: 'patrol',
          escortTimeSec: 0,
          escortAwarded: false,
          nearTriggered: false,
          spookTimer: 0,
          trail: [],
          bubbleRings: [],
        });
      }
      // Graceful Giant Manta Ray gliding across the blue above the superstructure (v165 monumental scale)
      const mantaY = Math.max(10, Math.min(deckY - 6, deckY * 0.42));
      const mantaX = shotX + 12;
      if (evaluateCaveSDF(level, mantaX, mantaY) < -2.2) {
        megafauna.push({
          id: `mega_manta_1_${level.id || 'w'}`,
          kind: 'manta',
          label: 'Giant Oceanic Manta Ray',
          x: mantaX,
          y: mantaY,
          homeX: mantaX,
          homeY: mantaY,
          patrolRx: 24,
          patrolRy: 2.8,
          vx: -1.3,
          vy: 0,
          size: 2.35,
          phase: 2.1,
          facing: -1,
          pitch: 0,
          swimPhase: 2.1,
          behavior: 'patrol',
          escortTimeSec: 0,
          escortAwarded: false,
          nearTriggered: false,
          spookTimer: 0,
          trail: [],
          bubbleRings: [],
        });
      }
      if (isWarmReef && deckY > 36) {
        const sharkY2 = Math.max(18, deckY - 8);
        const sharkX2 = shotX + 18;
        if (evaluateCaveSDF(level, sharkX2, sharkY2) < -2.0) {
          megafauna.push({
            id: `mega_shark_2_${level.id || 'w'}`,
            kind: 'shark',
            label: 'Oceanic Whitetip Shark',
            x: sharkX2,
            y: sharkY2,
            homeX: sharkX2,
            homeY: sharkY2,
            patrolRx: 22,
            patrolRy: 2.6,
            vx: -1.4,
            vy: 0,
            size: 1.65,
            phase: 3.2,
            facing: -1,
            pitch: 0,
            swimPhase: 3.2,
            behavior: 'patrol',
            escortTimeSec: 0,
            escortAwarded: false,
            nearTriggered: false,
            spookTimer: 0,
            trail: [],
            bubbleRings: [],
          });
        }
      }
    }

    // Lurking Goliath Groupers (or giant Lake Trout on Fitzgerald) inside large dark interior holds
    let grouperCount = 0;
    for (let sIdx = 0; sIdx < level.segments.length && grouperCount < 3; sIdx++) {
      const seg = level.segments[sIdx];
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      if (my > deckY + 4 && Math.min(seg.ra, seg.rb) >= 3.1 && evaluateCaveSDF(level, mx, my) < -1.4) {
        megafauna.push({
          kind: isFreshwater ? 'laketrout' : 'grouper',
          x: mx,
          y: my + 0.5,
          homeX: mx,
          homeY: my + 0.5,
          patrolRx: 2.8,
          patrolRy: 0.7,
          vx: grouperCount % 2 === 0 ? 0.35 : -0.35,
          vy: 0,
          facing: grouperCount % 2 === 0 ? 1 : -1,
          pitch: 0,
          swimPhase: grouperCount * 2.1,
          size: isFreshwater ? 0.92 : 1.35 + grouperCount * 0.14,
          phase: grouperCount * 2.1,
        });
        grouperCount++;
      }
    }

    // 4. Rusticles hanging from interior steel ceilings & vibrant sea fans on upper hull walls
    for (let sIdx = 0; sIdx < level.segments.length; sIdx++) {
      const seg = level.segments[sIdx];
      const segLen = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
      const steps = Math.max(3, Math.floor(segLen / 2.2));
      for (let k = 0; k <= steps; k++) {
        const t = k / Math.max(1, steps);
        const cx = seg.ax + (seg.bx - seg.ax) * t;
        const cy = seg.ay + (seg.by - seg.ay) * t;
        const r = seg.ra + (seg.rb - seg.ra) * t;
        for (let p = 0; p < 2; p++) {
          const seed = sIdx * 83 + k * 19 + p * 11;
          const h = randHash(seed);
          if (h < 0.28) continue;
          const probeAng = p === 0 ? -Math.PI * 0.5 + (h - 0.5) * 0.9 : (h * Math.PI * 2);
          const anchor = findWallAnchor(level, cx, cy, Math.cos(probeAng), Math.sin(probeAng), r + 2.2);
          if (!anchor || anchor.y < deckY - 3) continue;
          if (anchor.ny > 0.35) {
            // Iconic icicle-like iron-oxide rusticles dripping from rusted steel ceilings!
            anchored.push({
              kind: 'rusticle',
              x: anchor.x,
              y: anchor.y,
              nx: 0,
              ny: 1,
              size: 0.45 + randHash(seed + 2) * 0.65,
              color: h > 0.5 ? '#9a3412' : '#7c2d12',
              accent: '#ea580c',
              phase: h * 6.28,
            });
          } else if (!isFreshwater && anchor.y < deckY + 18 && h > 0.55) {
            // Gorgonian sea fan corals & red encrusting sponges on sunlit/upper steelwork
            anchored.push({
              kind: 'seafan',
              x: anchor.x,
              y: anchor.y,
              nx: anchor.nx,
              ny: anchor.ny,
              size: 0.48 + randHash(seed + 3) * 0.52,
              color: isWarmReef ? (h > 0.76 ? '#f97316' : '#e11d48') : '#d97706',
              accent: '#fde68a',
              phase: h * 6.28,
            });
          }
        }
      }
    }

    // 5. Interactive Wreck Denizens: Chromatophore Giant Octopuses & Peeking Emerald Moray Eels (v162)
    if (!isFreshwater) {
      for (let sIdx = 0; sIdx < level.segments.length && denizens.length < 3; sIdx++) {
        const seg = level.segments[sIdx];
        const mx = (seg.ax + seg.bx) * 0.5;
        const my = (seg.ay + seg.by) * 0.5;
        if (my < deckY - 2) continue;
        const probeAng = denizens.length % 2 === 0 ? 0.35 : Math.PI - 0.35;
        const anchor = findWallAnchor(level, mx, my, Math.cos(probeAng), Math.sin(probeAng), Math.max(seg.ra, seg.rb) + 2.5);
        if (!anchor) continue;
        if (denizens.some((d) => Math.hypot(d.x - anchor.x, d.y - anchor.y) < 12)) continue;
        const isOcto = denizens.length % 2 === 0;
        denizens.push({
          id: `denizen_${denizens.length}_${level.id || 'w'}`,
          kind: isOcto ? 'octopus' : 'moray',
          label: isOcto ? 'Giant Pacific Octopus' : 'Emerald Moray Eel',
          x: anchor.x,
          y: anchor.y,
          nx: anchor.nx,
          ny: anchor.ny,
          size: isOcto ? 1.26 : 1.12,
          phase: denizens.length * 2.3 + 0.6,
          state: 'peeking', // 'peeking' | 'curious' | 'startled'
          emergence: 0.42, // [0.12..1.0]
          chromaBlend: 0, // [0..1] color shift intensity
          emergeNotified: false,
          inkCooldown: 0,
          inkPuffs: [],
        });
      }
    }

    return { anchored, fish, remipedes, turtles, jellies, megafauna, denizens };
  }
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
    themeId === 'boybulok-alpine' ||
    themeId === 'nordic-mine' ||
    themeId === 'greenland-iceberg';

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

  // 6. Cave & Polar Megafauna + Interactive Crevice Denizens (v162)
  // Keep saltwater rays, octopuses & morays strictly in marine/coastal caves & blue holes (never inland freshwater cenotes!)
  const idLower = `${level.id || ''} ${themeId}`.toLowerCase();
  const isPolar = /arctic|ice|scoresby|silfra|strytan|kverkfjoll|aurora|glacier/.test(idLower);
  const isWarmCoastal = /blue-hole|bahamas|abaco|bimini|bermuda|lanzarote|dahab|dean|atlantida/.test(idLower);
  if ((isPolar || isWarmCoastal) && Array.isArray(level.segments)) {
    for (let sIdx = 0; sIdx < level.segments.length && megafauna.length < 1; sIdx++) {
      const seg = level.segments[sIdx];
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      if (my >= 6 && my <= 36 && Math.min(seg.ra, seg.rb) >= 3.4 && evaluateCaveSDF(level, mx, my) < -2.2) {
        megafauna.push({
          id: `mega_cave_${level.id || 'c'}`,
          kind: isPolar ? 'beluga' : 'manta',
          label: isPolar ? 'Arctic Beluga Whale' : 'Spotted Eagle Ray',
          x: mx,
          y: my,
          homeX: mx,
          homeY: my,
          patrolRx: Math.min(12, Math.max(5.5, Math.min(seg.ra, seg.rb) * 1.6)),
          patrolRy: 1.8,
          vx: 0.9,
          vy: 0,
          facing: 1,
          pitch: 0,
          swimPhase: 1.1,
          size: isPolar ? 2.15 : 1.85,
          phase: 1.1,
          behavior: 'patrol',
          escortTimeSec: 0,
          escortAwarded: false,
          nearTriggered: false,
          spookTimer: 0,
          trail: [],
          bubbleRings: [],
        });
      }
    }
  }
  if (isWarmCoastal && Array.isArray(level.segments)) {
    for (let sIdx = 1; sIdx < level.segments.length && denizens.length < 2; sIdx++) {
      const seg = level.segments[sIdx];
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      if (my < 10) continue;
      const probeAng = denizens.length % 2 === 0 ? 0.45 : Math.PI - 0.45;
      const anchor = findWallAnchor(level, mx, my, Math.cos(probeAng), Math.sin(probeAng), Math.max(seg.ra, seg.rb) + 2.4);
      if (!anchor) continue;
      if (denizens.some((d) => Math.hypot(d.x - anchor.x, d.y - anchor.y) < 14)) continue;
      const isOcto = denizens.length % 2 === 0;
      denizens.push({
        id: `denizen_cave_${denizens.length}_${level.id || 'c'}`,
        kind: isOcto ? 'octopus' : 'moray',
        label: isOcto ? 'Reef Octopus' : 'Emerald Moray Eel',
        x: anchor.x,
        y: anchor.y,
        nx: anchor.nx,
        ny: anchor.ny,
        size: isOcto ? 0.82 : 0.78,
        phase: denizens.length * 2.7 + 0.9,
        state: 'peeking',
        emergence: 0.4,
        chromaBlend: 0,
        emergeNotified: false,
        inkCooldown: 0,
        inkPuffs: [],
      });
    }
  }

  return { anchored, fish, remipedes, turtles, jellies, megafauna, denizens };
}

/**
 * Compute smooth [0..1] exposure of a world point to the diver's active torch beam (v151).
 * Used for natural torch-reactive wildlife banking and subtle deep-water eyeshine glints.
 */
export function computeTorchBeamExposure(diver, wx, wy, maxRange = 14.5) {
  if (!diver || diver.torchOn === false) return 0;
  const dx = wx - diver.x;
  const dy = wy - diver.y;
  const distSq = dx * dx + dy * dy;
  if (distSq < 0.04 || distSq > maxRange * maxRange) return 0;
  const dist = Math.sqrt(distSq);
  const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
  let diff = Math.atan2(dy, dx) - beamAng;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const absDiff = Math.abs(diff);
  const halfCone = 0.54; // ~31 deg outer cone
  if (absDiff >= halfCone) return 0;
  const angFalloff = 1 - absDiff / halfCone;
  const distFalloff = 1 - dist / maxRange;
  return Math.max(0, Math.min(1, angFalloff * (0.45 + 0.55 * distFalloff)));
}

/**
 * Advances authentic Yucatan fish schools, cave remipedes/prawns, and cenote slider turtles.
 */
export function stepMarineEcosystem(eco, diver, dt, timeSec, level, opts = {}) {
  if (!eco) return;
  const lerp = Math.min(1, dt * 2.2);
  const cullDistSq = 42 * 42;
  const hasDiver = Boolean(diver);
  const divX = hasDiver ? diver.x : 0;
  const divY = hasDiver ? diver.y : 0;
  const diverSpeed = hasDiver ? Math.hypot(diver.vx || 0, diver.vy || 0) : 0;
  const siltDens = Math.max(0, Number(opts?.localSiltDensity) || 0);
  const ccrSilent = Boolean(opts?.ccrSilent);
  const isCalmDiver = hasDiver && diverSpeed <= (ccrSilent ? 2.05 : 1.35) && !diver.dpvThrusting && siltDens < 0.3;
  const isLoudDiver = hasDiver && (diverSpeed > (ccrSilent ? 3.2 : 2.35) || Boolean(diver.dpvThrusting) || siltDens >= 0.42);
  const lightLerp = Math.min(1, dt * 5.0);

  // Fish schooling + gentle swim-away near diver & torch-beam avoidance (distance-culled for distant chambers)
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
      const wakeActive = Boolean(diver.dpvThrusting) || diverSpeed > 2.6;
      const partRadius = wakeActive ? 5.8 : 3.0;
      if (distSq > 0.0025 && distSq < partRadius * partRadius) {
        const dist = Math.sqrt(distSq);
        const siltScatter = siltDens > 0.35 ? 1.85 : 1.0;
        const wakeMult = wakeActive ? 1.75 : 1.0;
        const push = ((partRadius - dist) / partRadius) * 4.4 * siltScatter * wakeMult;
        // Graceful lateral bow-wave parting when DPV/dash cuts through a baitball school (v195)
        if (wakeActive) {
          const swimAng = diverSpeed > 0.3 ? Math.atan2(diver.vy || 0, diver.vx || 0) : (diver.angle || 0);
          const fwdX = Math.cos(swimAng);
          const fwdY = Math.sin(swimAng);
          const sideSign = (dx * (-fwdY) + dy * fwdX) >= 0 ? 1 : -1;
          f.vx += ((dx / dist) * 0.45 + (-fwdY) * sideSign * 0.95) * push * dt;
          f.vy += ((dy / dist) * 0.45 + fwdX * sideSign * 0.95) * push * dt;
        } else {
          f.vx += (dx / dist) * push * dt;
          f.vy += (dy / dist) * push * dt;
        }
      }
      // Torch-reactive schooling: sighted fish gently dart/bank out of bright close beams (blind cavefish unaffected)
      const lit = computeTorchBeamExposure(diver, f.x, f.y, 13.5);
      f.litIntensity = (f.litIntensity || 0) + (lit - (f.litIntensity || 0)) * lightLerp;
      if (f.kind !== 'cavefish' && lit > 0.32 && distSq > 0.25 && distSq < 64) {
        const dist = Math.sqrt(distSq);
        const beamAng = Number.isFinite(diver.torchAngle) ? diver.torchAngle : (diver.angle || 0);
        const perpSign = ((f.phase * 10) % 2 >= 1) ? 1 : -1;
        const evade = (lit - 0.3) * 3.4;
        f.vx += ((dx / dist) * 0.55 - Math.sin(beamAng) * perpSign * 0.85) * evade * dt;
        f.vy += ((dy / dist) * 0.55 + Math.cos(beamAng) * perpSign * 0.85) * evade * dt;
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
      const lit = computeTorchBeamExposure(diver, r.x, r.y, 13.5);
      r.litIntensity = (r.litIntensity || 0) + (lit - (r.litIntensity || 0)) * lightLerp;
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

  // Freshwater Cenote Slider Turtles patrolling sunlit surface pools (curious near calm divers, wake-reactive to DPV! v195)
  for (let i = 0; i < eco.turtles.length; i++) {
    const t = eco.turtles[i];
    if (hasDiver) {
      const cdx = t.homeX - divX;
      const cdy = t.homeY - divY;
      if (cdx * cdx + cdy * cdy > cullDistSq) continue;
      const lit = computeTorchBeamExposure(diver, t.x, t.y, 12.0);
      t.litIntensity = (t.litIntensity || 0) + (lit - (t.litIntensity || 0)) * lightLerp;
    }
    t.phase += dt * 0.44;
    let tx = t.homeX + Math.cos(t.phase) * 3.1;
    let ty = t.homeY + Math.sin(t.phase * 2) * 0.7;
    if (hasDiver) {
      const dx = t.x - divX;
      const dy = t.y - divY;
      const d = Math.hypot(dx, dy);
      if (d < 4.5 && isLoudDiver && d > 0.05) {
        tx = t.x + (dx / d) * 2.2;
        ty = Math.max(0.8, t.y + (dy / d) * 1.1);
      } else if (d < 7.8 && d > 2.2 && isCalmDiver) {
        // Gentle curious turn toward a calm gliding diver
        tx = tx * 0.65 + (divX + (dx / d) * 2.6) * 0.35;
        ty = ty * 0.65 + Math.max(0.9, divY - 0.5) * 0.35;
      }
    }
    const nx = t.x + (tx - t.x) * Math.min(1, dt * 1.9);
    const ny = Math.max(0.7, t.y + (ty - t.y) * Math.min(1, dt * 1.9));
    if (evaluateCaveSDF(level, nx, ny) < -0.4) {
      t.vx = (nx - t.x) / Math.max(0.01, dt);
      t.vy = (ny - t.y) / Math.max(0.01, dt);
      if (Math.hypot(t.vx, t.vy) > 0.04) {
        t.angle = Math.atan2(t.vy, t.vx);
      }
      t.x = nx;
      t.y = ny;
    }
  }

  // Pelagic Drifting Jellyfish (gentle pulsing climb & wake sway along shipwreck shot lines)
  if (Array.isArray(eco.jellies)) {
    for (let i = 0; i < eco.jellies.length; i++) {
      const j = eco.jellies[i];
      if (hasDiver) {
        const cdx = j.homeX - divX;
        const cdy = j.homeY - divY;
        if (cdx * cdx + cdy * cdy > cullDistSq) continue;
        const d = Math.hypot(j.x - divX, j.y - divY);
        if (d < 4.5 && (Boolean(diver.dpvThrusting) || diverSpeed > 2.2) && d > 0.05) {
          j._wakeOffX = Math.max(-2.5, Math.min(2.5, (j._wakeOffX || 0) + ((j.x - divX) / d) * 2.6 * dt));
          j._wakeOffY = Math.max(-1.6, Math.min(1.6, (j._wakeOffY || 0) + ((j.y - divY) / d) * 1.8 * dt));
        } else {
          j._wakeOffX = (j._wakeOffX || 0) * Math.max(0, 1 - dt * 1.1);
          j._wakeOffY = (j._wakeOffY || 0) * Math.max(0, 1 - dt * 1.1);
        }
      }
      j.x = j.homeX + Math.sin(timeSec * 0.28 + j.phase) * 2.2 + (j._wakeOffX || 0);
      j.y = j.homeY + Math.cos(timeSec * 0.65 + j.phase) * 1.1 + (j._wakeOffY || 0);
    }
  }

  // Reactive Megafauna: Cruising Reef Sharks, Giant Manta Rays, Arctic Belugas & Goliath Groupers (v162)
  if (Array.isArray(eco.megafauna)) {
    for (let i = 0; i < eco.megafauna.length; i++) {
      const m = eco.megafauna[i];
      if (!m.behavior) m.behavior = 'patrol';
      if (m.spookTimer > 0) m.spookTimer = Math.max(0, m.spookTimer - dt);
      const canEscort = m.kind === 'shark' || m.kind === 'manta' || m.kind === 'beluga';
      let distToDiver = 999;
      if (hasDiver) {
        const cdx = m.x - divX;
        const cdy = m.y - divY;
        distToDiver = Math.hypot(cdx, cdy);
        if (Math.hypot(m.homeX - divX, m.homeY - divY) > 65 && distToDiver > 65) continue;
        const lit = computeTorchBeamExposure(diver, m.x, m.y, 17.5);
        m.litIntensity = (m.litIntensity || 0) + (lit - (m.litIntensity || 0)) * lightLerp;
      }

      const megaRange = ccrSilent ? 22.0 : 16.5;
      if (hasDiver && canEscort && distToDiver <= megaRange) {
        if (!m.nearTriggered && distToDiver <= (ccrSilent ? 16.5 : 13.5) && (m.kind === 'manta' || m.kind === 'beluga')) {
          m.nearTriggered = true;
          opts?.onMegafaunaNear?.(m);
        }
        if (isLoudDiver) {
          m.behavior = 'spooked';
          m.spookTimer = 6.5;
          m.escortTimeSec = 0;
        } else if (m.spookTimer <= 0 && isCalmDiver) {
          m.escortTimeSec = (m.escortTimeSec || 0) + dt * (ccrSilent ? 2.0 : 1.0);
          if (m.escortTimeSec >= 1.4 && distToDiver <= (ccrSilent ? 16.0 : 12.5)) {
            m.behavior = 'escort';
            if (!m.escortAwarded) {
              m.escortAwarded = true;
              opts?.onWildlifeEscort?.(m);
            }
          } else {
            m.behavior = 'curious';
          }
        } else if (m.spookTimer <= 0) {
          m.behavior = 'patrol';
        }
      } else if (m.spookTimer <= 0) {
        m.behavior = 'patrol';
        m.escortTimeSec = Math.max(0, (m.escortTimeSec || 0) - dt * 0.5);
      }

      let tx = m.homeX;
      let ty = m.homeY;
      let maxSpeed = m.kind === 'shark' ? 2.4 : m.kind === 'manta' ? 2.1 : m.kind === 'beluga' ? 1.85 : 0.95;
      let accel = 1.65;
      if (m.behavior === 'spooked' && hasDiver) {
        const awayX = m.x - divX;
        const awayY = m.y - divY;
        const awayD = Math.hypot(awayX, awayY) || 1;
        tx = m.x + (awayX / awayD) * 16;
        ty = Math.max(3.5, m.y + (awayY / awayD) * 6);
        maxSpeed *= 1.95;
        accel = 3.2;
      } else if ((m.behavior === 'curious' || m.behavior === 'escort') && hasDiver) {
        // Wide, slow majestic wing-glide orbit alongside the calm diver (closer on silent CCR!)
        const orbitAng = timeSec * 0.32 + (m.phase || 0);
        const wingDist = m.behavior === 'escort' ? (ccrSilent ? 4.2 : 5.2) : (ccrSilent ? 6.0 : 7.4);
        tx = divX + Math.cos(orbitAng) * wingDist;
        ty = Math.max(3.4, divY - 1.3 + Math.sin(orbitAng * 1.15) * 1.5);
        maxSpeed *= 0.85;
        accel = 1.25;
      } else {
        const speed = m.kind === 'shark' ? 0.14 : m.kind === 'manta' ? 0.11 : m.kind === 'beluga' ? 0.1 : 0.18;
        m.phase += dt * speed;
        tx = m.homeX + Math.cos(m.phase) * (m.patrolRx || 6);
        ty = m.homeY + Math.sin(m.phase * 2) * (m.patrolRy || 1.2);
      }

      // Weighted inertial steering for graceful heavy aquatic momentum (v165)
      const dxT = tx - m.x;
      const dyT = ty - m.y;
      const dT = Math.hypot(dxT, dyT) || 0.001;
      const desiredSpeed = Math.min(maxSpeed, dT * 0.85);
      const desVx = (dxT / dT) * desiredSpeed;
      const desVy = (dyT / dT) * desiredSpeed;
      const blend = Math.min(1, dt * accel);
      const nextVx = (m.vx || 0) + (desVx - (m.vx || 0)) * blend;
      const nextVy = (m.vy || 0) + (desVy - (m.vy || 0)) * blend;
      const nx = m.x + nextVx * dt;
      const ny = m.y + nextVy * dt;
      if (evaluateCaveSDF(level, nx, ny) < -0.95) {
        m.vx = nextVx;
        m.vy = nextVy;
        m.x = nx;
        m.y = ny;
      } else {
        m.vx *= 0.65;
        m.vy *= 0.65;
      }

      // Smooth facing hysteresis + natural pitch inclination + speed-coupled swim wave (v165)
      const spd = Math.hypot(m.vx || 0, m.vy || 0);
      if (m.facing === undefined) m.facing = (m.vx || 1) >= 0 ? 1 : -1;
      if (m.vx > 0.22) m.facing = 1;
      else if (m.vx < -0.22) m.facing = -1;
      const targetPitch = Math.max(-0.34, Math.min(0.34, Math.atan2(m.vy || 0, Math.max(0.55, Math.abs(m.vx || 0)))));
      m.pitch = (m.pitch || 0) + (targetPitch - (m.pitch || 0)) * Math.min(1, dt * 3.5);
      const baseCadence = m.kind === 'manta' ? 1.55 : m.kind === 'beluga' ? 1.75 : m.kind === 'shark' ? 2.55 : 2.1;
      m.swimPhase = (m.swimPhase ?? m.phase ?? 0) + dt * (baseCadence + spd * 0.72);

      // Delicate plankton / wingtip vortex trail motes (especially luminous when peacefully escorting!)
      if (!Array.isArray(m.trail)) m.trail = [];
      for (let k = m.trail.length - 1; k >= 0; k--) {
        const pt = m.trail[k];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) m.trail.splice(k, 1);
      }
      if (canEscort && (m.behavior === 'escort' || m.behavior === 'curious' || spd > 0.7) && m.trail.length < 18) {
        m._trailAccum = (m._trailAccum || 0) + dt * (m.behavior === 'escort' ? 7.5 : 3.0);
        if (m._trailAccum >= 1) {
          m._trailAccum = 0;
          const tailOff = -(m.facing || 1) * (m.size || 1.8) * 0.65;
          const yJitter = (Math.sin(timeSec * 3.7 + i * 2.1) * 0.45) * (m.size || 1.5);
          m.trail.push({
            x: m.x + tailOff,
            y: m.y + yJitter,
            vx: -(m.vx || 0) * 0.12,
            vy: -0.14 - Math.random() * 0.12,
            r: m.behavior === 'escort' ? 0.08 + Math.random() * 0.07 : 0.05 + Math.random() * 0.05,
            life: m.behavior === 'escort' ? 2.4 : 1.5,
            maxLife: m.behavior === 'escort' ? 2.4 : 1.5,
            golden: m.behavior === 'escort',
          });
        }
      }

      // Playful Arctic Beluga silver air bubble rings when curious or escorting! (v165)
      if (m.kind === 'beluga') {
        if (!Array.isArray(m.bubbleRings)) m.bubbleRings = [];
        for (let k = m.bubbleRings.length - 1; k >= 0; k--) {
          const br = m.bubbleRings[k];
          br.y -= 0.72 * dt;
          br.x += Math.sin(timeSec * 2.1 + k) * 0.14 * dt;
          br.r = Math.min(br.maxR, br.r + 0.22 * dt);
          br.life -= dt;
          if (br.life <= 0) m.bubbleRings.splice(k, 1);
        }
        if ((m.behavior === 'curious' || m.behavior === 'escort') && m.bubbleRings.length < 4) {
          m._ringTimer = (m._ringTimer || 1.4) - dt;
          if (m._ringTimer <= 0) {
            m._ringTimer = 2.6 + Math.random() * 1.6;
            m.bubbleRings.push({
              x: m.x + (m.facing || 1) * (m.size || 2.0) * 0.78,
              y: m.y - 0.12,
              r: 0.14,
              maxR: 0.62,
              life: 3.8,
              maxLife: 3.8,
            });
          }
        }
      }
    }
  }

  // Interactive Wreck & Karst Crevice Denizens: Chromatophore Giant Octopuses & Emerald Moray Eels (v162)
  if (Array.isArray(eco.denizens)) {
    for (let i = 0; i < eco.denizens.length; i++) {
      const d = eco.denizens[i];
      if (d.inkCooldown > 0) d.inkCooldown = Math.max(0, d.inkCooldown - dt);
      // Step any lingering black octopus ink puffs
      if (Array.isArray(d.inkPuffs) && d.inkPuffs.length > 0) {
        for (let k = d.inkPuffs.length - 1; k >= 0; k--) {
          const p = d.inkPuffs[k];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.r = Math.min(p.maxR, p.r + dt * 0.55);
          p.life -= dt;
          if (p.life <= 0) d.inkPuffs.splice(k, 1);
        }
      }
      if (!hasDiver) continue;
      const dist = Math.hypot(d.x - divX, d.y - divY);
      if (dist > 36) continue;
      const lit = computeTorchBeamExposure(diver, d.x, d.y, 13.0);
      d.litIntensity = (d.litIntensity || 0) + (lit - (d.litIntensity || 0)) * lightLerp;

      if (lit > 0.52 && dist < 6.8) {
        // Direct bright torch blast startles the denizen back into its crevice!
        d.state = 'startled';
        d.emergence += (0.12 - d.emergence) * Math.min(1, dt * 4.2);
        d.chromaBlend += (1.0 - d.chromaBlend) * Math.min(1, dt * 5.0);
        if (d.kind === 'octopus' && d.inkCooldown <= 0) {
          d.inkCooldown = 14;
          for (let p = 0; p < 4; p++) {
            d.inkPuffs.push({
              x: d.x + (d.nx || 0) * 0.55 + (Math.random() - 0.5) * 0.3,
              y: d.y + (d.ny || 0) * 0.55 + (Math.random() - 0.5) * 0.3,
              vx: (d.nx || 0) * (0.45 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.25,
              vy: (d.ny || 0) * 0.35 - 0.12,
              r: 0.35,
              maxR: 1.55 + Math.random() * 0.45,
              life: 4.8,
              maxLife: 4.8,
            });
          }
          opts?.onDenizenInk?.(d);
        }
      } else if (dist < (ccrSilent ? 13.0 : 10.5) && (ccrSilent || diver.torchOn === false || lit < 0.28) && diverSpeed <= (ccrSilent ? 2.0 : 1.45)) {
        // Stealth / low-beam or silent CCR approach coaxes the denizen curiously out of its den!
        d.state = 'curious';
        d.emergence += (1.0 - d.emergence) * Math.min(1, dt * (ccrSilent ? 2.4 : 1.45));
        d.chromaBlend += (0.55 - d.chromaBlend) * Math.min(1, dt * 2.2);
        if (d.emergence >= 0.78 && !d.emergeNotified) {
          d.emergeNotified = true;
          opts?.onDenizenEmerge?.(d);
        }
      } else {
        d.state = 'peeking';
        d.emergence += (0.42 - d.emergence) * Math.min(1, dt * 1.2);
        d.chromaBlend += (0 - d.chromaBlend) * Math.min(1, dt * 1.8);
      }
    }
  }
}
