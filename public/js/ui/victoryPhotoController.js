/**
 * Post-Dive Topside Victory Photo & Emote Dance Floor Controller (v284).
 * Renders a live 60 FPS biome-matched celebratory topside snapshot featuring
 * your diver + AI/Co-op squad in their actual equipped liveries/swimsuits,
 * cheering bouncy topside crowds, boss trophy / treasure pedestal,
 * interactive 8-move dance pose picker, and one-click PNG Polaroid export.
 */

import { drawTopsidePerson, drawFestiveStringLights, POPULAR_DANCE_MOVES } from '../game/renderers/topsidePeopleRenderer.js';
import {
  classifyTopsideBiome,
  drawBiomeSurfaceHangout,
  drawPartyDiveBoatEnhancements,
} from '../game/renderers/topsidePropsRenderer.js';
import { resolveDiverLiveryPalette } from '../game/rigLivery.js';

export const VICTORY_DANCE_MOVES = Object.freeze([
  { id: 'twerk', icon: '🍑', label: 'Twerk' },
  { id: 'floss', icon: '⚡', label: 'Floss' },
  { id: 'disco', icon: '🕺', label: 'Disco' },
  { id: 'salsa', icon: '💃', label: 'Salsa' },
  { id: 'dab', icon: '😎', label: 'Dab' },
  { id: 'running-man', icon: '👟', label: 'Run Man' },
  { id: 'body-roll', icon: '🌊', label: 'Body Roll' },
  { id: 'ymca', icon: '🙌', label: 'YMCA' },
  { id: 'moonwalk', icon: '🌙', label: 'Moonwalk' },
  { id: 'shuffle', icon: '🔥', label: 'Shuffle' },
  { id: 'robot', icon: '🤖', label: 'Robot' },
  { id: 'hula', icon: '🌺', label: 'Hula' },
  { id: 'macarena', icon: '🎵', label: 'Macarena' },
  { id: 'air-guitar', icon: '🎸', label: 'Air Guitar' },
]);

const BIOME_SKY = Object.freeze({
  cenote: ['#0ea5e9', '#38bdf8', '#fde68a', '#0891b2'],
  wreck: ['#0369a1', '#0ea5e9', '#bae6fd', '#0c4a6e'],
  polar: ['#0f172a', '#1e3a5f', '#67e8f9', '#0e7490'],
  volcanic: ['#1e1b4b', '#7c2d12', '#fb923c', '#134e4a'],
  quarry: ['#1e293b', '#334155', '#93c5fd', '#0f4c5c'],
});

const CONFETTI_COLS = Object.freeze(['#f43f5e', '#facc15', '#38bdf8', '#4ade80', '#c084fc', '#fb923c', '#f472b6']);

function _liveryToTopsideSpec(livery, fallbackSeed = 0) {
  const pal = resolveDiverLiveryPalette(livery || null);
  return {
    role: 'party-dance',
    customSwim: {
      primary: pal.accent || '#fb7185',
      accent: pal.trim || '#fef08a',
      style: fallbackSeed % 2 === 0 ? 'bikini' : 'onepiece',
    },
    customWet: {
      suit: pal.suitMid || '#1e293b',
      trim: pal.trim || '#38bdf8',
      tank: pal.tankFinish?.mid || '#eab308',
      fin: pal.finColor || '#38bdf8',
    },
    seed: fallbackSeed,
  };
}

/**
 * Pure 2D Canvas renderer for the live Topside Victory Photo scene.
 */
export function renderVictoryPhotoFrame(ctx, w, h, state, timeSec = 0) {
  if (!ctx || !w || !h) return;
  const biome = classifyTopsideBiome(state?.level);
  const sky = BIOME_SKY[biome] || BIOME_SKY.cenote;
  const waterY = Math.round(h * 0.62);
  const pierY = Math.round(h * 0.84);
  const scale = Math.max(24, Math.min(44, h * 0.165));
  const danceMove = POPULAR_DANCE_MOVES.includes(state?.danceMove) ? state.danceMove : 'twerk';
  const burstAge = Math.max(0, timeSec - (state?.burstAt || 0));
  const hypeEnergy = Math.max(0.38, Math.min(1, 0.45 + Math.max(0, 1 - burstAge / 3.2) * 0.55));

  ctx.save();

  // 1. Biome Sky Gradient
  const skyGrad = ctx.createLinearGradient?.(0, 0, 0, waterY);
  if (skyGrad && typeof skyGrad.addColorStop === 'function') {
    skyGrad.addColorStop(0, sky[0]);
    skyGrad.addColorStop(0.58, sky[1]);
    skyGrad.addColorStop(1, sky[2]);
    ctx.fillStyle = skyGrad;
  } else {
    ctx.fillStyle = sky[1];
  }
  ctx.fillRect(0, 0, w, waterY);

  // Sun halo or Polar Aurora ribbon
  if (biome === 'polar') {
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.34)';
    ctx.lineWidth = Math.max(8, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.18);
    ctx.bezierCurveTo(w * 0.3, h * 0.06 + Math.sin(timeSec) * 8, w * 0.65, h * 0.28, w, h * 0.12);
    ctx.stroke();
  } else {
    const sunX = w * 0.78;
    const sunY = h * 0.24;
    ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, h * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Shimmering Horizon Water
  const watGrad = ctx.createLinearGradient?.(0, waterY, 0, h);
  if (watGrad && typeof watGrad.addColorStop === 'function') {
    watGrad.addColorStop(0, sky[3]);
    watGrad.addColorStop(1, '#042033');
    ctx.fillStyle = watGrad;
  } else {
    ctx.fillStyle = sky[3];
  }
  ctx.fillRect(0, waterY, w, h - waterY);

  // Water shimmer lines
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.28)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const wy = waterY + 8 + i * ((h - waterY) * 0.12);
    const shift = Math.sin(timeSec * 1.8 + i * 1.3) * 18;
    ctx.beginPath();
    ctx.moveTo(w * (0.1 + i * 0.13) + shift, wy);
    ctx.lineTo(w * (0.24 + i * 0.13) + shift, wy);
    ctx.stroke();
  }

  // 3. Biome Surface Hangout / Party Boat Backdrop
  if (biome === 'wreck') {
    // Party boat hull silhouette behind victory deck
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, waterY + 8);
    ctx.lineTo(w * 0.92, waterY + 8);
    ctx.lineTo(w * 0.86, waterY - h * 0.14);
    ctx.lineTo(w * 0.14, waterY - h * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(w * 0.14, waterY - h * 0.06, w * 0.72, h * 0.045);
    drawPartyDiveBoatEnhancements(ctx, w * 0.5, waterY + 4, w * 0.76, h * 0.3, scale * 0.65, timeSec, hypeEnergy);
  } else {
    drawBiomeSurfaceHangout(ctx, state?.level, w * 0.2, waterY + 2, scale * 0.78, timeSec, { facing: 1 });
  }

  // Festive overhead party string lights
  drawFestiveStringLights(ctx, w * 0.04, h * 0.1, w * 0.96, h * 0.12, scale * 0.65, timeSec, 0.36);

  // 4. Sunlit Wooden Victory Pier / Deck Stage
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, pierY - 6, w, h - pierY + 6);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(0, pierY - 6, w, 9);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, pierY - 6, w, 3);
  // Deck planks
  ctx.strokeStyle = 'rgba(41, 18, 5, 0.45)';
  ctx.lineWidth = 1.2;
  for (let px = 24; px < w; px += 38) {
    ctx.beginPath();
    ctx.moveTo(px, pierY - 6);
    ctx.lineTo(px - 10, h);
    ctx.stroke();
  }

  // 5. Flanking Cheering Co-Ed Topside Party Crowd (varied front, back & side profiles + depth stagger!)
  const crowdSlots = [
    { x: w * 0.1, yOff: -4, move: danceMove, gender: 'female', view: danceMove === 'twerk' ? 'back' : 'front', seed: 2, facing: 1 },
    { x: w * 0.2, yOff: 3, move: 'shuffle', gender: 'male', view: 'side', seed: 5, facing: 1 },
    { x: w * 0.8, yOff: -3, move: 'hula', gender: 'female', view: 'front', seed: 3, facing: -1 },
    { x: w * 0.9, yOff: 4, move: danceMove, gender: 'male', view: danceMove === 'twerk' || danceMove === 'moonwalk' ? 'side' : 'front', seed: 1, facing: -1 },
  ];
  for (let i = 0; i < crowdSlots.length; i++) {
    const cs = crowdSlots[i];
    drawTopsidePerson(ctx, cs.x, pierY - 2 + cs.yOff, scale * (0.86 + (cs.yOff > 0 ? 0.04 : 0)), timeSec, {
      id: 9000 + i,
      role: 'party-dance',
      danceMove: cs.move,
      gender: cs.gender,
      view: cs.view,
      seed: cs.seed,
      facing: cs.facing,
      hypeEnergy,
    });
  }

  // 6. Hero Diver + Squad / Co-op Buddies Center-Stage (varied natural views by move!)
  const squad = Array.isArray(state?.squad) ? state.squad.slice(0, 3) : [];
  const heroRoster = [
    { name: state?.diverName || 'You', livery: state?.livery || null, isHero: true, seed: 0 },
    ...squad.map((s, idx) => ({
      name: s?.name || `Buddy ${idx + 1}`,
      livery: s?.livery || null,
      isHero: false,
      seed: idx + 4,
    })),
  ];
  const spacing = Math.min(scale * 2.1, (w * 0.46) / Math.max(1, heroRoster.length));
  const startX = w * 0.5 - ((heroRoster.length - 1) * spacing) * 0.5;
  for (let i = 0; i < heroRoster.length; i++) {
    const member = heroRoster[i];
    const mx = startX + i * spacing;
    const spec = _liveryToTopsideSpec(member.livery, member.seed);
    const memberView =
      danceMove === 'twerk'
        ? (i % 2 === 0 ? 'back' : 'side')
        : danceMove === 'running-man' || danceMove === 'body-roll' || danceMove === 'moonwalk'
          ? 'side'
          : danceMove === 'macarena'
            ? 'front'
            : (i === 0 ? 'front' : i === 1 ? 'side' : 'front');
    const yStagger = i === 1 ? -4 : i === 2 ? 3 : 2;
    drawTopsidePerson(ctx, mx, pierY + yStagger, scale * (member.isHero ? 1.12 : 0.98), timeSec, {
      id: 9200 + i,
      role: 'party-dance',
      danceMove,
      view: memberView,
      seed: member.seed,
      facing: i % 2 === 0 ? 1 : -1,
      hypeEnergy,
      customSwim: spec.customSwim,
      customWet: spec.customWet,
    });
    // Crisp nameplate under hero/squad member
    ctx.font = '800 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = member.isHero ? '#fef08a' : '#e2e8f0';
    ctx.fillText(String(member.name || '').slice(0, 12), mx, Math.min(h - 6, pierY + 18));
  }

  // 7. Boss Trophy / Treasure Haul Pedestal right beside hero!
  const hasBoss = Boolean(state?.boss?.name);
  const lootCount = Math.max(0, Number(state?.lootCount) || 0);
  if (hasBoss || lootCount > 0) {
    const pedX = Math.min(w * 0.71, startX + (heroRoster.length - 0.1) * spacing + scale * 0.55);
    const pedY = pierY + 1;
    const pulse = 0.55 + 0.45 * Math.sin(timeSec * 4.5);
    ctx.fillStyle = hasBoss ? `rgba(250, 204, 21, ${(0.24 + pulse * 0.22).toFixed(2)})` : 'rgba(56, 189, 248, 0.28)';
    ctx.beginPath();
    ctx.arc(pedX, pedY - scale * 0.62, scale * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = hasBoss ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(pedX - scale * 0.42, pedY - scale * 0.44, scale * 0.84, scale * 0.44, 5);
    ctx.fill();
    ctx.stroke();
    ctx.font = `700 ${Math.round(scale * 0.62)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hasBoss ? (state.boss.icon || '🏆') : '💎', pedX, pedY - scale * 0.72);
    ctx.font = '800 9px ui-monospace, monospace';
    ctx.fillStyle = hasBoss ? '#fef08a' : '#bae6fd';
    ctx.fillText(hasBoss ? 'TROPHY' : `×${lootCount} LOOT`, pedX, pedY - scale * 0.2);
    ctx.textBaseline = 'alphabetic';
  }

  // 8. Live Falling Festive Confetti Ribbons
  for (let i = 0; i < 26; i++) {
    const ph = ((timeSec * (0.28 + (i % 5) * 0.06) + i * 0.137) % 1);
    const cx = ((i * 53 + Math.sin(timeSec * 2.2 + i) * 18) % w + w) % w;
    const cy = ph * (h * 0.92);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(timeSec * (2.5 + (i % 4)) + i);
    ctx.fillStyle = CONFETTI_COLS[i % CONFETTI_COLS.length];
    ctx.globalAlpha = ph > 0.85 ? (1 - ph) / 0.15 : 0.92;
    ctx.fillRect(-3.5, -1.8, 7, 3.6);
    ctx.restore();
  }

  // 9. Expedition Polaroid Stamp Pill
  const siteTitle = String(state?.level?.name || 'Expedition Site').slice(0, 32);
  const stampText = `${siteTitle} · GRADE ${state?.grade || 'S'} · ${Math.round(Number(state?.score) || 0).toLocaleString()} PTS`;
  ctx.font = '800 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  const tw = ctx.measureText(stampText).width;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.68)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(10, 10, tw + 18, 22, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.fillText(stampText, 19, 24.5);

  ctx.restore();
}

/**
 * Interactive DOM controller for the Post-Dive Topside Victory Photo & Emote Dance Floor.
 */
export function createVictoryPhotoController({ showToast } = {}) {
  const wrapEl = document.getElementById('debrief-victory-wrap');
  const canvasEl = document.getElementById('debrief-victory-canvas');
  const dancesEl = document.getElementById('debrief-victory-dances');
  const snapBtnEl = document.getElementById('btn-debrief-victory-snap');
  const ctx = canvasEl?.getContext?.('2d') || null;

  let rafId = 0;
  let startMs = 0;
  let activeState = null;

  function renderDanceButtons() {
    if (!dancesEl || !activeState) return;
    dancesEl.innerHTML = VICTORY_DANCE_MOVES.map((m) => {
      const act = activeState.danceMove === m.id ? ' active' : '';
      return `<button type="button" class="victory-dance-pill${act}" data-victory-dance="${m.id}" aria-pressed="${act ? 'true' : 'false'}">${m.icon} ${m.label}</button>`;
    }).join('');
  }

  dancesEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-victory-dance]');
    if (!btn || !activeState) return;
    const move = btn.getAttribute('data-victory-dance');
    if (!move || !POPULAR_DANCE_MOVES.includes(move)) return;
    activeState.danceMove = move;
    activeState.burstAt = (performance.now() - startMs) * 0.001;
    renderDanceButtons();
  });

  snapBtnEl?.addEventListener('click', () => {
    if (!canvasEl || !activeState) return;
    try {
      const link = document.createElement('a');
      const slug = String(activeState.level?.id || 'expedition').replace(/[^a-z0-9-_]/gi, '-');
      link.download = `techno-dive-victory-${slug}.png`;
      link.href = canvasEl.toDataURL('image/png');
      link.click();
      showToast?.('📸 Topside Victory Photo saved!', 2.2);
    } catch {
      showToast?.('📸 Victory snapshot ready!', 1.8);
    }
  });

  function tick(nowMs) {
    if (!activeState || !wrapEl || wrapEl.hidden) {
      rafId = 0;
      return;
    }
    const t = (nowMs - startMs) * 0.001;
    if (ctx && canvasEl) {
      renderVictoryPhotoFrame(ctx, canvasEl.width, canvasEl.height, activeState, t);
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopVictoryPhoto() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    activeState = null;
    if (wrapEl) wrapEl.hidden = true;
  }

  function showVictoryPhoto(opts = {}) {
    if (!wrapEl || !canvasEl || !ctx) return;
    if (!opts.success) {
      stopVictoryPhoto();
      return;
    }
    stopVictoryPhoto();
    activeState = {
      level: opts.level || null,
      score: opts.score || 0,
      grade: opts.grade || 'S',
      diverName: opts.diverName || 'You',
      livery: opts.livery || null,
      squad: Array.isArray(opts.squad) ? opts.squad : [],
      boss: opts.boss || null,
      lootCount: opts.lootCount || 0,
      danceMove: opts.danceMove || 'twerk',
      burstAt: 0,
    };
    wrapEl.hidden = false;
    startMs = performance.now();
    renderDanceButtons();
    renderVictoryPhotoFrame(ctx, canvasEl.width, canvasEl.height, activeState, 0.05);
    rafId = requestAnimationFrame(tick);
  }

  return { showVictoryPhoto, stopVictoryPhoto };
}
