/**
 * Submerged Storytelling & Atmospheric Set-Pieces Engine (v155).
 *
 * Deterministically populates every shipwreck and cave site (all 33 campaign sites +
 * procedural sumps) with biome-authentic architectural/geological storytelling landmarks:
 *  - Shipwrecks: Flickering red emergency bulkhead lamps, Chadburn engine-room brass
 *    telegraphs, corroded ship helm wheels, bolted bronze porthole light shafts, and
 *    cracked steam-boiler gauge panels.
 *  - Caves: Ice-Age speleothem stalagmite/stalactite cathedrals, shimmering halocline
 *    fresh/saltwater refraction lenses, Mayan cenote offering vessels, historic Nordic
 *    mine shoring/ore carts, glacial ice arches, ammonite fossil beds, and vintage brass
 *    cave survey stations.
 *
 * Pure zero-DOM ES module with SDF-validated placement and torch-illumination lore discovery.
 */

import { evaluateCaveSDF, evaluateCaveNormal } from './collision.js';
import { computeTorchBeamExposure } from './marineLife.js';

function hash01(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function probeWall(level, ox, oy, dx, dy, maxDist = 9) {
  for (let t = 0.25; t <= maxDist; t += 0.22) {
    const px = ox + dx * t;
    const py = oy + dy * t;
    if (evaluateCaveSDF(level, px, py) >= 0) {
      const n = evaluateCaveNormal(level, px, py);
      return { x: px - dx * 0.14, y: py - dy * 0.14, nx: -n.nx, ny: -n.ny, dist: t };
    }
  }
  return null;
}

const WRECK_LORE_BY_KIND = Object.freeze({
  'emergency-lamp': [
    'Caged Bulkhead Lamp — corroded battery cell still pulsing faint crimson in the flooded corridor.',
    'Watertight Alleyway Sconce — emergency backup filament flickering behind salt-frosted glass.',
    'Engine-Room Hazard Beacon — last dim pulse from the ship’s auxiliary DC circuit.',
  ],
  'brass-telegraph': [
    'Chadburn Engine Telegraph — brass pointer still locked on "ALL STOP" from the final watch.',
    'Bridge-to-Boiler Telegraph — patina-crusted dial frozen mid-maneuver on the tilted deck.',
  ],
  'ship-wheel': [
    'Corroded Ship’s Helm — teak spokes wrapped in hydroids, wedged hard to port.',
    'Auxiliary Steering Wheel — bronze hub gleaming faintly beneath decades of marine growth.',
  ],
  'porthole-shaft': [
    'Bolted Bronze Porthole — cobalt light shaft cutting across suspended hull silt.',
    'Upper-Deck Scuttle Glass — refracting surface swell through thick armored quartz.',
  ],
  'boiler-panel': [
    'Steam Boiler Manifold — shattered Bourdon gauges frozen at zero atmosphere.',
    'Auxiliary Pipework Header — copper pressure lines encrusted in orange iron-oxide rusticles.',
  ],
  'air-dome': [
    'Trapped Overhead Air Dome — silver mercury ceiling pocket holding decades of compressed exhaust.',
    'Flooded Deckhouse Air Bell — mirror-like meniscus rippling with every bubble you exhale.',
  ],
  'cargo-vehicle': [
    'Submerged WWII Bedford QL Cargo Truck — rusted canvas hoops and rubber tires intact inside the flooded hold.',
    'Hold #2 Supply Transport — BSA motorcycle crating and chassis rails encrusted in soft coral.',
  ],
  'carrier-aircraft': [
    'Hangar Bay Naval Airframe — swept aluminum wings draped in sea fans beneath the darkened flight deck.',
    'Carrier Deck Fighter Silhouette — riveted fuselage resting silently beside the hydraulic catapult tracks.',
  ],
  'grand-staircase': [
    'First-Class Grand Staircase — gilded bronze balustrade and scrolled ironwork sweeping down into the gloom.',
    'Ocean-Liner Promenade Landing — ornate oak-and-brass newel post colonized by translucent gorgonians.',
  ],
  'gorgonian-fan': [
    'Deep-Water Gorgonian Sea Fan — delicate scarlet coral lattice filtering plankton from the wreck surge.',
  ],
});

const CAVE_LORE_BY_KIND = Object.freeze({
  'speleothem-cathedral': [
    'Submerged Stalagmite Cathedral — calcite columns grown in dry air 14,000 years ago before the seas rose.',
    'Fluted Dripstone Gallery — ancient limestone curtains drowned at the close of the last Ice Age.',
    'Phreatic Pillar Hall — twin stalactite & stalagmite fused over millennia of slow mineral drip.',
  ],
  'halocline-lens': [
    'Halocline Density Interface — crystal rainwater floating cleanly over dense marine saltwater.',
    'Refractive Chemocline Lens — turbulent mixing boundary shimmering like liquid glass in torchlight.',
  ],
  'mayan-vessel': [
    'Submerged Offering Vessel — ancient ceramic jar resting undisturbed on the cenote silt shelf.',
    'Ceremonial Karst Relic — hand-burnished pottery preserved for centuries in oxygen-poor water.',
  ],
  'mine-timber': [
    'Flooded Ore-Haul Shoring — hand-hewn pine beams and rusted iron rail spikes from the 19th century.',
    'Submerged Drift Timbering — crisp axe marks preserved indefinitely in frigid anoxic mine water.',
  ],
  'ice-arch': [
    'Subglacial Blue-Ice Arch — compressed millennia-old firn refracting deep sapphire light.',
    'Meltwater Cathedral Rib — scalloped glacial conduit carved by sub-zero hydraulic flow.',
  ],
  'fossil-bed': [
    'Limestone Ammonite Wall — spiral marine shells exposed by 100 million years of karst dissolution.',
    'Paleo-Karst Fossil Shelf — prehistoric mineral veins and embedded reef fossils in the bedrock.',
  ],
  'survey-station': [
    'Explorer Survey Piton — weathered brass station tag left by the first cartography team.',
    'Historic Cave-Line Tie-Off — tarnished aluminum survey cookie marking an old exploration lead.',
  ],
  'air-dome': [
    'Subterranean Air Bell — mirror-bright trapped air pocket beneath the vaulted limestone ceiling.',
    'Ceiling Percolation Dome — shimmering silver meniscus where diver exhaust gathers into a calm pocket.',
  ],
});

function probeWallFine(level, ox, oy, dx, dy, maxDist = 9, step = 0.12) {
  for (let t = step; t <= maxDist; t += step) {
    const px = ox + dx * t;
    const py = oy + dy * t;
    if (evaluateCaveSDF(level, px, py) >= 0) {
      return { x: px - dx * (step * 0.5), y: py - dy * (step * 0.5), dist: t };
    }
  }
  return null;
}

/**
 * Physically scan a level's SDF ceiling geometry for a true sealed overhead Air Pocket:
 *  - Priority 1: Natural concave ceiling vault where rock curves down to seal BOTH left and right ends.
 *  - Priority 2: Flat overhead ceiling bay (wreck deck beams / flat karst roof) verified 100% under
 *    solid overhead rock/hull across the entire width, with zero bleed into open water or diagonal walls.
 * Never spawns inside open sunlit surface basins or right next to spawn/exit shafts (v167).
 */
function findBestAirDomeVault(level, isWreck, isTooClose) {
  const openBasins = Array.isArray(level.openBasins) ? level.openBasins : [];
  const spawnX = level.spawn?.x ?? 0;
  const spawnY = level.spawn?.y ?? 2;
  const exitX = level.exitZone?.x ?? spawnX;
  const exitY = level.exitZone?.y ?? spawnY;
  const deckY = level.wreckDeckY ?? 36;
  const minCeilingY = isWreck ? Math.max(8, deckY + 1.5) : 7.0;

  const isInOrNearOpenBasin = (x, y) => {
    for (let i = 0; i < openBasins.length; i++) {
      const ob = openBasins[i];
      if (x >= ob.xMin - 4.5 && x <= ob.xMax + 4.5 && y <= (ob.yMax ?? 16) + 4.0) return true;
    }
    return false;
  };

  // Gather candidate probe points from all interior segments (including vertices/crests) + caverns
  const probes = [];
  for (let i = 0; i < level.segments.length; i++) {
    const seg = level.segments[i];
    const r = Math.min(seg.ra || 2.2, seg.rb || 2.2);
    if (r < 1.65) continue;
    for (const t of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const px = seg.ax + (seg.bx - seg.ax) * t;
      const py = seg.ay + (seg.by - seg.ay) * t;
      probes.push({ x: px, y: py, r, segIdx: i });
    }
  }
  if (Array.isArray(level.caverns)) {
    for (let i = 0; i < level.caverns.length; i++) {
      const cv = level.caverns[i];
      if ((cv.r || 0) >= 2.2) probes.push({ x: cv.x, y: cv.y, r: cv.r, segIdx: 1000 + i });
    }
  }

  let bestVault = null;
  let bestScore = -Infinity;

  for (let p = 0; p < probes.length; p++) {
    const { x: cx, y: openY, r } = probes[p];
    if (openY < minCeilingY + 1.0) continue;
    if (evaluateCaveSDF(level, cx, openY) >= -0.75) continue;
    if (isInOrNearOpenBasin(cx, openY)) continue;
    if (Math.hypot(cx - spawnX, openY - spawnY) < 13.0) continue;

    const topHit = probeWallFine(level, cx, openY, 0, -1, r + 4.5, 0.12);
    if (!topHit || topHit.y < minCeilingY) continue;
    const topY = topHit.y;
    // Must have thick solid overhead rock/hull directly above
    if (evaluateCaveSDF(level, cx, topY - 0.55) <= 0.12) continue;
    if (evaluateCaveSDF(level, cx, topY - 1.25) <= 0.08) continue;
    if (isInOrNearOpenBasin(cx, topY)) continue;
    if (isTooClose(cx, topY + 0.45, 5.0)) continue;

    // 1. Try natural sealed concave ceiling vault across realistic pocket depths
    let foundNatural = false;
    for (const domeDepth of [0.46, 0.68, 0.92, 1.18]) {
      const waterY = topY + domeDepth;
      if (evaluateCaveSDF(level, cx, waterY + 0.85) >= -0.4) continue;

      let leftX = cx;
      let leftSealed = false;
      let leftLeaky = false;
      for (let dx = 0.16; dx <= 3.6; dx += 0.16) {
        const lx = cx - dx;
        if (evaluateCaveSDF(level, lx, waterY) >= -0.04) {
          leftX = lx + 0.08;
          leftSealed = true;
          break;
        }
        const up = probeWallFine(level, lx, waterY, 0, -1, domeDepth + 0.65, 0.12);
        if (!up || up.y < topY - 0.16) {
          leftLeaky = true;
          break;
        }
      }
      if (!leftSealed || leftLeaky) continue;

      let rightX = cx;
      let rightSealed = false;
      let rightLeaky = false;
      for (let dx = 0.16; dx <= 3.6; dx += 0.16) {
        const rx = cx + dx;
        if (evaluateCaveSDF(level, rx, waterY) >= -0.04) {
          rightX = rx - 0.08;
          rightSealed = true;
          break;
        }
        const up = probeWallFine(level, rx, waterY, 0, -1, domeDepth + 0.65, 0.12);
        if (!up || up.y < topY - 0.16) {
          rightLeaky = true;
          break;
        }
      }
      if (!rightSealed || rightLeaky) continue;

      const span = rightX - leftX;
      if (span < 1.35 || span > 6.0) continue;

      // Sample exact SDF ceiling profile across [leftX, rightX]
      const steps = 10;
      const profile = [];
      let allSealedAbove = true;
      let maxPocketH = 0;
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const sx = leftX + span * u;
        if (k === 0 || k === steps) {
          profile.push({ x: sx, ceilY: waterY });
          continue;
        }
        const up = probeWallFine(level, sx, waterY, 0, -1, domeDepth + 0.45, 0.1);
        if (!up || evaluateCaveSDF(level, sx, up.y - 0.35) <= 0.04) {
          allSealedAbove = false;
          break;
        }
        const cY = Math.min(waterY - 0.04, up.y);
        maxPocketH = Math.max(maxPocketH, waterY - cY);
        profile.push({ x: sx, ceilY: cY });
      }
      if (!allSealedAbove || maxPocketH < 0.30) continue;

      const midX = (leftX + rightX) * 0.5;
      const distExit = Math.hypot(midX - exitX, waterY - exitY);
      const depthSweetSpot = Math.max(0, 1 - Math.abs(waterY - 26) / 38);
      const spanSweetSpot = Math.max(0, 1 - Math.abs(span - 3.0) / 2.6);
      const score = 140 + depthSweetSpot * 24 + spanSweetSpot * 18 + Math.min(1.0, maxPocketH) * 16 + (distExit > 10 ? 8 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestVault = {
          x: midX,
          y: waterY,
          topY: waterY - maxPocketH,
          leftX,
          rightX,
          halfWidth: span * 0.5,
          ceilingProfile: profile,
          isNaturalVault: true,
          bayCoaming: false,
        };
      }
      foundNatural = true;
      break;
    }

    if (foundNatural || bestScore >= 130) continue;

    // 2. Fallback: Flat overhead deck-beam bay (wrecks) or flat karst ceiling bay verified 100% sealed above
    for (const bayHalf of isWreck ? [1.55, 1.15] : [1.35, 0.95]) {
      const bayDepth = 0.48;
      const leftX = cx - bayHalf;
      const rightX = cx + bayHalf;
      const steps = 8;
      const profile = [];
      let flatOk = true;
      let lowestCeil = -Infinity;
      let highestCeil = Infinity;
      for (let k = 0; k <= steps; k++) {
        const sx = leftX + (bayHalf * 2) * (k / steps);
        if (isInOrNearOpenBasin(sx, topY)) { flatOk = false; break; }
        const up = probeWallFine(level, sx, openY, 0, -1, r + 4.0, 0.12);
        if (!up || up.y < minCeilingY) { flatOk = false; break; }
        if (evaluateCaveSDF(level, sx, up.y - 0.4) <= 0.08) { flatOk = false; break; }
        if (evaluateCaveSDF(level, sx, up.y + bayDepth + 0.55) >= -0.3) { flatOk = false; break; }
        if (Math.abs(up.y - topY) > 0.36) { flatOk = false; break; }
        lowestCeil = Math.max(lowestCeil, up.y);
        highestCeil = Math.min(highestCeil, up.y);
        profile.push({ x: sx, ceilY: up.y });
      }
      if (!flatOk) continue;

      const waterY = lowestCeil + bayDepth;
      const depthSweetSpot = Math.max(0, 1 - Math.abs(waterY - (isWreck ? deckY + 8 : 26)) / 36);
      const flatnessBonus = Math.max(0, 1 - (lowestCeil - highestCeil) / 0.36) * 14;
      const widthBonus = bayHalf >= 1.3 ? 8 : 0;
      const score = 60 + depthSweetSpot * 20 + flatnessBonus + widthBonus;
      if (score > bestScore) {
        bestScore = score;
        bestVault = {
          x: cx,
          y: waterY,
          topY: highestCeil,
          leftX,
          rightX,
          halfWidth: bayHalf,
          ceilingProfile: profile,
          isNaturalVault: false,
          bayCoaming: true,
        };
      }
      break;
    }
  }

  return bestVault;
}

function pickLore(table, kind, idx) {
  const list = table[kind];
  if (!Array.isArray(list) || list.length === 0) return 'Uncharted submerged landmark.';
  return list[idx % list.length];
}

/**
 * Deterministically generate SDF-validated storytelling set-pieces for any level.
 */
export function createSubmergedStories(level) {
  const setPieces = [];
  if (!level || !Array.isArray(level.segments) || level.segments.length === 0) {
    return { setPieces, discoveredIds: new Set(), discoveredCount: 0, totalDiscoverable: 0 };
  }

  const themeId = level.theme?.id || 'yucatan-cenote';
  const isWreck = Boolean(level.isWreck);
  const deckY = level.wreckDeckY ?? 36;
  let idCounter = 0;

  const isTooClose = (x, y, minDist = 7.5) => {
    const minSq = minDist * minDist;
    for (let i = 0; i < setPieces.length; i++) {
      const dx = setPieces[i].x - x;
      const dy = setPieces[i].y - y;
      if (dx * dx + dy * dy < minSq) return true;
    }
    return false;
  };

  if (isWreck) {
    const segs = level.segments;
    for (let i = 0; i < segs.length && setPieces.length < 14; i++) {
      const seg = segs[i];
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      const r = Math.min(seg.ra || 2.5, seg.rb || 2.5);
      if (my < deckY - 1 || r < 1.8) continue;
      if (evaluateCaveSDF(level, mx, my) >= -0.8) continue;

      const h = hash01(i * 41.7 + mx * 3.1 + my * 1.9);
      const ceil = probeWall(level, mx, my, 0, -1, r + 3.2);
      const floor = probeWall(level, mx, my, 0, 1, r + 3.2);

      // 1. Flickering Red Emergency Bulkhead Lamp on interior steel ceilings
      if (ceil && my > deckY + 2.5 && (i % 3 === 0 || h > 0.62) && !isTooClose(ceil.x, ceil.y, 8.5)) {
        const idx = idCounter++;
        setPieces.push({
          id: `story-lamp-${idx}`,
          kind: 'emergency-lamp',
          title: 'Emergency Bulkhead Lamp',
          lore: pickLore(WRECK_LORE_BY_KIND, 'emergency-lamp', idx),
          x: ceil.x,
          y: ceil.y + 0.12,
          size: 0.55 + h * 0.2,
          phase: h * Math.PI * 2,
          emissive: true,
          discovered: false,
        });
        continue;
      }

      // 2. Upper-deck Bolted Bronze Porthole Light Shaft
      if (my >= deckY && my <= deckY + 18 && i % 4 === 1 && !isTooClose(mx, my - r * 0.35, 10)) {
        const idx = idCounter++;
        setPieces.push({
          id: `story-port-${idx}`,
          kind: 'porthole-shaft',
          title: 'Flooded Bronze Porthole',
          lore: pickLore(WRECK_LORE_BY_KIND, 'porthole-shaft', idx),
          x: mx,
          y: my - Math.min(1.2, r * 0.32),
          size: 0.72 + h * 0.25,
          shaftLen: Math.min(6.2, r * 1.65),
          shaftAngle: 0.42 + (h - 0.5) * 0.25,
          phase: h * Math.PI * 2,
          emissive: true,
          discovered: false,
        });
        continue;
      }

      // 3. Floor-mounted Wreck Set-Pieces: Site-Signature Landmarks (WWII Trucks, Carrier Airframe, Grand Staircase),
      //    Chadburn Telegraph, Ship's Helm Wheel, Steam Boiler Panel & Deep Gorgonian Fans (v168)
      if (floor && !isTooClose(floor.x, floor.y, 8.2)) {
        const idx = idCounter++;
        const lid = String(level.id || '');
        const hasSignatureTruck = lid.includes('thistlegorm') || lid.includes('zenobia');
        const hasSignatureJet = lid.includes('oriskany');
        const hasSignatureStair = lid.includes('britannic') || lid.includes('andrea-doria');
        const alreadyPlacedSig = setPieces.some(
          (sp) => sp.kind === 'cargo-vehicle' || sp.kind === 'carrier-aircraft' || sp.kind === 'grand-staircase'
        );

        let kind;
        let title;
        let size = 0.92 + h * 0.28;
        if (hasSignatureTruck && !alreadyPlacedSig && r >= 2.1) {
          kind = 'cargo-vehicle';
          title = lid.includes('zenobia') ? 'Submerged Cargo Lorry' : 'Hold #2 WWII Bedford Truck';
          size = 1.45;
        } else if (hasSignatureJet && !alreadyPlacedSig && r >= 2.2) {
          kind = 'carrier-aircraft';
          title = 'Hangar Bay Carrier Airframe';
          size = 1.55;
        } else if (hasSignatureStair && !alreadyPlacedSig && r >= 2.1) {
          kind = 'grand-staircase';
          title = 'First-Class Grand Staircase';
          size = 1.48;
        } else {
          const roll = idx % 4;
          kind =
            roll === 0
              ? 'brass-telegraph'
              : roll === 1
                ? 'ship-wheel'
                : roll === 2
                  ? 'boiler-panel'
                  : 'gorgonian-fan';
          title =
            kind === 'brass-telegraph'
              ? 'Engine-Room Telegraph'
              : kind === 'ship-wheel'
                ? 'Corroded Ship’s Helm'
                : kind === 'boiler-panel'
                  ? 'Boiler Gauge Manifold'
                  : 'Deep Gorgonian Sea Fan';
          if (kind === 'gorgonian-fan') size = 0.85 + h * 0.4;
        }
        setPieces.push({
          id: `story-wprop-${idx}`,
          kind,
          title,
          lore: pickLore(WRECK_LORE_BY_KIND, kind, idx),
          x: floor.x,
          y: floor.y - 0.05,
          tilt: (h - 0.5) * (kind === 'cargo-vehicle' || kind === 'carrier-aircraft' || kind === 'grand-staircase' ? 0.14 : 0.38),
          size,
          phase: h * Math.PI * 2,
          emissive: false,
          discovered: false,
        });
      }
    }
  } else {
    // Cave & Environmental Biomes (25 handcrafted caves + procedural sumps)
    const isCenote =
      themeId === 'yucatan-cenote' ||
      themeId === 'mexico-halocline' ||
      themeId === 'bahamas-bluehole' ||
      themeId === 'bermuda-sargasso';
    const isMine = themeId === 'nordic-mine';
    const isGlacier =
      themeId === 'aurora-glacial' ||
      themeId === 'kverkfjoll-glacier' ||
      themeId === 'greenland-iceberg';
    const hasHalocline = Boolean(level.haloclineDepthM) || isCenote;
    const haloDepth = Number(level.haloclineDepthM) || (isCenote ? 15.5 : 0);

    const segs = level.segments;
    for (let i = 0; i < segs.length && setPieces.length < 15; i++) {
      const seg = segs[i];
      const mx = (seg.ax + seg.bx) * 0.5;
      const my = (seg.ay + seg.by) * 0.5;
      const r = Math.min(seg.ra || 2.4, seg.rb || 2.4);
      if (my < 4.5 || r < 1.65) continue;
      if (evaluateCaveSDF(level, mx, my) >= -0.75) continue;

      const h = hash01(i * 53.3 + mx * 2.7 + my * 4.1);
      const ceil = probeWall(level, mx, my, 0, -1, r + 3.6);
      const floor = probeWall(level, mx, my, 0, 1, r + 3.6);

      // 1. Shimmering Halocline Refraction Lens near halocline depth
      if (hasHalocline && haloDepth > 4 && Math.abs(my - haloDepth) < 4.8 && !isTooClose(mx, haloDepth, 13)) {
        const idx = idCounter++;
        const lensY = evaluateCaveSDF(level, mx, haloDepth) < -0.5 ? haloDepth : my;
        setPieces.push({
          id: `story-halo-${idx}`,
          kind: 'halocline-lens',
          title: 'Halocline Interface',
          lore: pickLore(CAVE_LORE_BY_KIND, 'halocline-lens', idx),
          x: mx,
          y: lensY,
          halfWidth: Math.min(5.2, Math.max(2.4, r * 1.15)),
          size: 1.0,
          phase: h * Math.PI * 2,
          emissive: true,
          discovered: false,
        });
        continue;
      }

      // 2. Monumental Speleothem Cathedral Columns (or Subglacial Ice Arch / Flooded Mine Timbering)
      if (ceil && floor && floor.y - ceil.y >= 3.0 && floor.y - ceil.y <= 14.5 && i % 2 === 0 && !isTooClose(mx, my, 10.5)) {
        const idx = idCounter++;
        const kind = isMine ? 'mine-timber' : isGlacier ? 'ice-arch' : 'speleothem-cathedral';
        const title =
          kind === 'mine-timber'
            ? 'Historic Mine Shoring'
            : kind === 'ice-arch'
              ? 'Subglacial Ice Arch'
              : 'Speleothem Cathedral';
        setPieces.push({
          id: `story-arch-${idx}`,
          kind,
          title,
          lore: pickLore(CAVE_LORE_BY_KIND, kind, idx),
          x: mx,
          y: my,
          ceilY: ceil.y,
          floorY: floor.y,
          size: 0.85 + h * 0.45,
          phase: h * Math.PI * 2,
          emissive: kind === 'ice-arch',
          discovered: false,
        });
        continue;
      }

      // 3. Floor & Wall Lore Artifacts: Mayan Offering Vessel, Ammonite Fossil Bed, or Vintage Explorer Survey Station
      if (floor && !isTooClose(floor.x, floor.y, 9.5)) {
        const idx = idCounter++;
        let kind = 'fossil-bed';
        if (isCenote && idx % 2 === 0 && my < 34) kind = 'mayan-vessel';
        else if (idx % 3 === 1) kind = 'survey-station';
        const title =
          kind === 'mayan-vessel'
            ? 'Mayan Offering Vessel'
            : kind === 'survey-station'
              ? 'Explorer Survey Station'
              : 'Paleo-Karst Fossil Bed';
        setPieces.push({
          id: `story-relic-${idx}`,
          kind,
          title,
          lore: pickLore(CAVE_LORE_BY_KIND, kind, idx),
          x: floor.x,
          y: floor.y - 0.06,
          tilt: (h - 0.5) * 0.28,
          size: 0.78 + h * 0.25,
          phase: h * Math.PI * 2,
          emissive: kind === 'survey-station',
          discovered: false,
        });
      }
    }
  }

  // Place an authentic, SDF-sealed Trapped Overhead Air Pocket in a genuine concave ceiling vault
  // or flat steel deck-beam bay (never floating in open water or protruding out of diagonal walls — v167).
  const vault = findBestAirDomeVault(level, isWreck, isTooClose);
  if (vault) {
    const idx = idCounter++;
    setPieces.push({
      id: `story-dome-${idx}`,
      kind: 'air-dome',
      title: isWreck ? 'Trapped Deckhouse Air Pocket' : 'Subterranean Air Bell',
      lore: pickLore(isWreck ? WRECK_LORE_BY_KIND : CAVE_LORE_BY_KIND, 'air-dome', idx),
      x: vault.x,
      y: vault.y,
      topY: vault.topY,
      leftX: vault.leftX,
      rightX: vault.rightX,
      halfWidth: vault.halfWidth,
      ceilingProfile: vault.ceilingProfile,
      isNaturalVault: vault.isNaturalVault,
      bayCoaming: vault.bayCoaming,
      isWreckBay: isWreck,
      size: 1.0,
      phase: hash01(idx * 19.7) * Math.PI * 2,
      emissive: true,
      discovered: false,
    });
  }

  // Overhead Pelagic Shadow Crossing ONLY for open-water ocean wrecks & wide marine blue holes (never inland freshwater cenotes!)
  const allowPelagicShadow =
    (isWreck && themeId !== 'superior-memorial-wreck') ||
    themeId === 'bahamas-bluehole' ||
    themeId === 'bermuda-sargasso';
  const b = level.bounds || { xMin: -20, xMax: 120, yMin: 0, yMax: 60 };
  const openBasin = Array.isArray(level.openBasins) && level.openBasins.length > 0 ? level.openBasins[0] : null;
  let pelagicShadow = null;
  if (allowPelagicShadow) {
    const pXMin = isWreck
      ? openBasin
        ? openBasin.xMin - 8
        : Number.isFinite(level.wreckHullXMin)
          ? level.wreckHullXMin - 24
          : (b.xMin ?? -20) - 8
      : openBasin
        ? openBasin.xMin + 2.5
        : (level.spawn?.x ?? 0) - 10;
    const pXMax = isWreck
      ? openBasin
        ? openBasin.xMax + 8
        : Number.isFinite(level.wreckHullXMax)
          ? level.wreckHullXMax + 24
          : (b.xMax ?? 120) + 8
      : openBasin
        ? openBasin.xMax - 2.5
        : (level.spawn?.x ?? 0) + 10;
    const span = Math.max(12, pXMax - pXMin);
    const glideSpeed = isWreck ? 2.1 : 1.45; // Graceful, realistic pelagic glide speed (m/s)
    const crossingDurationSec = Math.max(14, Math.min(96, span / glideSpeed));
    const periodSec = Math.round(crossingDurationSec + (isWreck ? 24 : 20));
    if (span >= 14 || isWreck) {
      pelagicShadow = {
        kind: isWreck ? 'whaleshark' : 'manta',
        xMin: pXMin,
        xMax: pXMax,
        y: isWreck ? Math.min(12, Math.max(5.5, deckY * 0.24)) : 4.2,
        crossingDurationSec,
        periodSec,
        size: isWreck ? 6.2 : 3.6,
      };
    }
  }

  return {
    setPieces,
    pelagicShadow,
    discoveredIds: new Set(),
    discoveredCount: 0,
    totalDiscoverable: setPieces.length,
    lastToastAt: -99,
    inAirDome: false,
    chatterSent: { plunge: false, decoClear: false, recovery: false },
  };
}

/**
 * Authentic 1-line topside support boat / dive-deck radio chatter callouts (v156).
 */
export function getTopsideRadioChatter(phase, level) {
  const site = level?.name || 'the site';
  if (phase === 'plunge') {
    return level?.isWreck
      ? `📻 Topside Boat: Copy you submerging on the shot line at ${site} — light swell, comms locked.`
      : `📻 Surface Support: Copy you dropping into ${site} — telemetry green, watch your Rule of Thirds.`;
  }
  if (phase === 'decoClear') {
    return level?.isWreck
      ? '📻 Topside Boat: Copy you clear of 6m O₂ deco — stern ladder is down, surface when ready.'
      : '📻 Surface Support: Copy deco ceiling clear — basin entry is clear, easy ascent to surface.';
  }
  if (phase === 'recovery') {
    return '📻 Topside Boat: Deck winch standing by for your recovery lift — keep a steady ascent pace!';
  }
  return '';
}

/**
 * Check whether the diver has illuminated or approached any undiscovered storytelling landmark.
 * Triggers a concise expedition lore toast & gentle chime (throttled so it never spams).
 */
export function stepSubmergedStories(stories, diver, simTimeSec, callbacks = {}, diveState = null, dt = 1 / 60) {
  if (!stories || !Array.isArray(stories.setPieces) || !diver) return null;
  const safeDt = Math.max(0.001, Math.min(0.25, Number(dt) || 1 / 60));

  // Check if diver is resting calmly beneath a Trapped Overhead Air Pocket (v156 / v167 / v171 dt-scaled)
  let insideDome = false;
  let activeDome = null;
  for (let i = 0; i < stories.setPieces.length; i++) {
    const sp = stories.setPieces[i];
    if (sp?.kind !== 'air-dome') continue;
    const lx = Number.isFinite(sp.leftX) ? sp.leftX : sp.x - (sp.halfWidth || 2.0);
    const rx = Number.isFinite(sp.rightX) ? sp.rightX : sp.x + (sp.halfWidth || 2.0);
    const topBound = Number.isFinite(sp.topY) ? sp.topY - 0.15 : sp.y - 0.85;
    if (diver.x >= lx - 0.25 && diver.x <= rx + 0.25 && diver.y >= topBound && diver.y <= sp.y + 1.55) {
      insideDome = true;
      activeDome = sp;
      if (diveState) {
        diveState.panicLevel = Math.max(0, (diveState.panicLevel || 0) - 1.55 * safeDt);
        diveState.heartRateBpm = Math.max(64, (diveState.heartRateBpm || 76) - 21.0 * safeDt);
      }
      break;
    }
  }
  stories.inAirDome = insideDome;
  stories.activeAirDome = activeDome;

  if (simTimeSec - (stories.lastToastAt ?? -99) < 4.5) return null;

  for (let i = 0; i < stories.setPieces.length; i++) {
    const sp = stories.setPieces[i];
    if (!sp || sp.discovered) continue;
    const dx = sp.x - diver.x;
    const dy = sp.y - diver.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > 7.2 * 7.2) continue;

    const closeProximity = dSq <= 3.1 * 3.1;
    const beamLit = computeTorchBeamExposure(diver, sp.x, sp.y, 8.0) >= 0.26;
    if (closeProximity || beamLit) {
      sp.discovered = true;
      sp.discoveredAt = simTimeSec;
      stories.discoveredIds.add(sp.id);
      stories.discoveredCount = stories.discoveredIds.size;
      stories.lastToastAt = simTimeSec;
      callbacks.onStoryDiscovered?.(sp);
      return sp;
    }
  }
  return null;
}

/**
 * Curated 1-line expedition lore note for collectibles when picked up, matched by artifact keywords.
 */
export function getCollectibleLoreNote(item, level) {
  const name = String(item?.name || '').toLowerCase();
  if (name.includes('compass') || name.includes('sextant') || name.includes('chronometer')) {
    return 'Brass navigation instrument still holding a faint trace of luminous radium paint.';
  }
  if (name.includes('telegraph') || name.includes('bell') || name.includes('plate') || name.includes('china')) {
    return 'Shipboard relic preserved beneath decades of encrusting coralline algae.';
  }
  if (name.includes('enigma') || name.includes('cipher') || name.includes('log') || name.includes('valve')) {
    return 'Watertight naval hardware recovered intact from the pressure hull.';
  }
  if (name.includes('crystal') || name.includes('gypsum') || name.includes('selenite') || name.includes('quartz')) {
    return 'Pristine mineral cluster precipitated slowly in undisturbed phreatic groundwater.';
  }
  if (name.includes('fossil') || name.includes('skull') || name.includes('jade') || name.includes('obsidian') || name.includes('mayan')) {
    return 'Ancient cenote deposit preserved in cool, dark karst equilibrium.';
  }
  if (name.includes('core') || name.includes('sensor') || name.includes('beacon') || name.includes('black box')) {
    return 'Sealed expedition telemetry module with intact titanium pressure housing.';
  }
  return level?.isWreck
    ? 'Historic shipwreck artifact logged for surface maritime conservation.'
    : 'Rare subterranean specimen logged into your expedition field notes.';
}
