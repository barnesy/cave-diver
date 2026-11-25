import { escapeHtml } from '../util/common.js';
import { resolveBountyBoardState } from '../game/bossBounties.js';
import { bossAndLairMethods } from '../game/renderers/bossAndLairRenderer.js';
import { drawStyledArtifact } from '../game/artSprites.js';

const PORTRAIT_W = 360;
const PORTRAIT_H = 152;

const bossPreviewHost = {
  ...bossAndLairMethods,
  _cachedDpr: 1,
  glowStamps: {},
};

/**
 * Draw a single animated deep-sea portrait frame of one of the 10 Abyssal Guardians (v200).
 */
export function renderAnimatedBossPortrait(ctx, bounty, timeSec = 0, idx = 0) {
  if (!ctx || !bounty) return false;
  const w = ctx.canvas?.width || PORTRAIT_W;
  const h = ctx.canvas?.height || PORTRAIT_H;
  const t = timeSec + idx * 1.17;
  const accent = bounty.accentColor || '#38bdf8';

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // 1. Deep-sea ROV camera backdrop with biome-tinted radial glow
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.62);
  bg.addColorStop(0, bounty.claimed ? 'rgba(16, 185, 129, 0.24)' : 'rgba(14, 34, 58, 0.92)');
  bg.addColorStop(0.55, 'rgba(6, 16, 30, 0.96)');
  bg.addColorStop(1, 'rgba(2, 7, 15, 0.99)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle biome color wash
  ctx.save();
  ctx.globalAlpha = bounty.claimed ? 0.16 : 0.19;
  const tint = ctx.createRadialGradient(w * 0.5, h * 0.46, 4, w * 0.5, h * 0.46, w * 0.46);
  tint.addColorStop(0, accent);
  tint.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. Pulsing acoustic hydrophone sweep ring behind the guardian
  const pulse = (t * 0.34) % 1;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = (1 - pulse) * 0.22;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 16 + pulse * (w * 0.42), 0, Math.PI * 2);
  ctx.stroke();

  // Subtle reticle ticks
  ctx.globalAlpha = 0.13;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(14, h * 0.5);
  ctx.lineTo(w - 14, h * 0.5);
  ctx.moveTo(w * 0.5, 10);
  ctx.lineTo(w * 0.5, h - 10);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 3. Gently drifting deep-water bioluminescent marine snow
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const px = ((i * 53.7 + t * (9 + (i % 3) * 4)) % (w + 20)) - 10;
    const py = ((i * 31.3 + Math.sin(t * 0.9 + i * 1.4) * 14 + h) % h);
    const pr = 1.1 + (i % 3) * 0.55;
    ctx.fillStyle = i % 2 === 0 ? accent : '#bae6fd';
    ctx.globalAlpha = 0.22 + 0.18 * Math.sin(t * 2.1 + i);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Live fully animated Boss Guardian rendered by the game's real Boss Renderer!
  const scale = bounty.previewScale || 8.6;
  const cx = w * 0.5 + Math.sin(t * 0.85) * 9;
  const cy = h * 0.5 + (bounty.previewOffsetY || 0) + Math.cos(t * 1.25) * 4.5;
  const blinkCycle = (t * 0.28) % 1;
  const blink = blinkCycle > 0.95 ? Math.sin(((blinkCycle - 0.95) / 0.05) * Math.PI) : 0;
  const facing = bounty.bossKind === 'cave-kraken' || bounty.bossKind === 'abyssal-empress' || bounty.bossKind === 'orichalcum-colossus'
    ? (Math.sin(t * 0.45) >= 0 ? 1 : -1)
    : -1;

  const previewBoss = {
    id: bounty.id,
    kind: bounty.bossKind || 'cave-kraken',
    name: bounty.displayName,
    x: 0,
    y: 0,
    vx: Math.cos(t * 0.85) * 0.6,
    vy: Math.sin(t * 1.25) * 0.3,
    angle: facing < 0 ? Math.PI + Math.sin(t * 0.9) * 0.08 : Math.sin(t * 0.9) * 0.08,
    radius: 4.5,
    hp: 4000,
    maxHp: 4000,
    phase: 1,
    active: true,
    defeated: false,
    hitFlash: 0,
    aiState: 'idle',
    stateTimer: 2.0,
    anim: {
      facing,
      blink,
      squashX: 1 + Math.sin(t * 2.2) * 0.03,
      squashY: 1 - Math.sin(t * 2.2) * 0.03,
      hurtSec: 0,
      lookX: facing * 0.55,
      lookY: Math.sin(t * 1.1) * 0.22,
      roarProgress: 0,
      slamProgress: 0,
      tailPhase: t * 2.6,
    },
  };

  bossPreviewHost._drawSecretLairBoss(
    ctx,
    previewBoss,
    (wx) => cx + wx * scale,
    (wy) => cy + wy * scale,
    scale,
    t
  );

  // 5. Atmospheric lens vignette around frame edges
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.35, w * 0.5, h * 0.5, w * 0.65);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(2, 6, 15, 0.58)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // 6. On CLAIMED posters, float the recovered glowing Trophy Relic badge in the bottom-left corner!
  if (bounty.claimed && bounty.trophyRelicId) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 24, 24, 0.82)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(30, h - 26, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawStyledArtifact(ctx, { id: bounty.trophyRelicId, name: bounty.trophyName }, 30, h - 26, 13, t, {
      index: idx,
      isGrand: true,
    });
    ctx.restore();
  }

  ctx.restore();
  return true;
}

/**
 * Abyssal Wanted Bounty Board Modal Controller (v199 / v200 Live Animated Boss Portraits).
 * Displays weathered deep-sea Wanted Posters with live animated boss previews and general
 * regional rumors & folklore clues for the 10-Guardian Pantheon.
 */
export function createBountiesController({ loadCareerLogbook, setHomeMenuOpen, els = {} } = {}) {
  const { btnOpenBounties, bountiesModal, btnBountiesClose, bountiesGrid, bountiesSubEl } = els;

  let animRafId = 0;
  let activeCanvases = [];

  function stopBountyAnimation() {
    if (animRafId) {
      cancelAnimationFrame(animRafId);
      animRafId = 0;
    }
  }

  function stepBountyAnimation(nowMs) {
    if (!bountiesModal || bountiesModal.hidden) {
      animRafId = 0;
      return;
    }
    const timeSec = (nowMs || performance.now()) * 0.001;
    const modalRect = bountiesModal.getBoundingClientRect?.() || null;

    for (let i = 0; i < activeCanvases.length; i++) {
      const entry = activeCanvases[i];
      if (!entry.ctx || !entry.canvas.isConnected) continue;
      // Viewport-cull off-screen cards inside the scrollable modal for effortless 60fps
      if (modalRect && modalRect.height > 0) {
        const r = entry.canvas.getBoundingClientRect();
        if (r.bottom < modalRect.top - 40 || r.top > modalRect.bottom + 40) continue;
      }
      renderAnimatedBossPortrait(entry.ctx, entry.bounty, timeSec, i);
    }

    animRafId = requestAnimationFrame(stepBountyAnimation);
  }

  function renderBountiesModal() {
    if (!bountiesGrid) return;
    stopBountyAnimation();

    const book = loadCareerLogbook?.() || {};
    const { bounties, claimedCount, totalCount } = resolveBountyBoardState(book);

    if (bountiesSubEl) {
      bountiesSubEl.textContent = `${claimedCount}/${totalCount} Abyssal Bounties Claimed · Live ROV sightings & dockside folklore — exact lairs uncharted`;
    }

    bountiesGrid.innerHTML = bounties
      .map((b) => {
        const rewardHtml = b.claimed
          ? `<div class="bounty-reward-bar claimed">
              <span class="bounty-reward-relic">🏆 ${escapeHtml(b.trophyName)}</span>
              ${b.unlockedRewards.length > 0 ? `<span class="bounty-reward-gear">🎨 ${escapeHtml(b.unlockedRewards.join(' · '))}</span>` : ''}
            </div>`
          : `<div class="bounty-reward-bar">
              <span class="bounty-reward-pts">💰 ${b.bountyPts.toLocaleString()} PTS</span>
              <span class="bounty-reward-classified">??? CLASSIFIED RELIC &amp; GEAR</span>
            </div>`;

        const stampHtml = b.claimed
          ? `<span class="bounty-stamp claimed">✓ CLAIMED</span>`
          : `<span class="bounty-stamp wanted">WANTED</span>`;

        return `
        <article class="bounty-card${b.claimed ? ' claimed' : ''}" style="--bounty-accent:${b.accentColor};" data-bounty-id="${escapeHtml(b.id)}">
          <div class="bounty-poster-head">
            <span class="bounty-code">${escapeHtml(b.contractCode)}</span>
            <span class="bounty-threat">${escapeHtml(b.threatClass)}</span>
          </div>
          <div class="bounty-portrait${b.claimed ? ' claimed' : ''}">
            <canvas class="bounty-boss-canvas" width="${PORTRAIT_W}" height="${PORTRAIT_H}" data-bounty-idx="${escapeHtml(b.id)}" aria-label="${escapeHtml(b.displayName)} animated preview"></canvas>
            <span class="bounty-live-pill">● LIVE ROV</span>
            ${stampHtml}
          </div>
          <div class="bounty-name-block">
            <h3 class="bounty-name">${escapeHtml(b.displayName)}</h3>
            <div class="bounty-subtitle">${escapeHtml(b.displaySubtitle)}</div>
          </div>
          <div class="bounty-waters">🧭 <span>Rumored Waters:</span> <strong>${escapeHtml(b.watersRumor)}</strong></div>
          <blockquote class="bounty-tale">“${escapeHtml(b.tale)}”</blockquote>
          ${rewardHtml}
        </article>`;
      })
      .join('');

    activeCanvases = [];
    const byId = new Map(bounties.map((b) => [b.id, b]));
    bountiesGrid.querySelectorAll('canvas[data-bounty-idx]').forEach((canvas, idx) => {
      const bounty = byId.get(canvas.getAttribute('data-bounty-idx'));
      const ctx = canvas.getContext?.('2d') || null;
      if (bounty && ctx) {
        activeCanvases.push({ canvas, ctx, bounty });
        // Render first frame synchronously so cards are immediately vivid on open
        renderAnimatedBossPortrait(ctx, bounty, performance.now() * 0.001, idx);
      }
    });
  }

  function openBountiesModal() {
    if (!bountiesModal) return;
    setHomeMenuOpen?.(false);
    renderBountiesModal();
    bountiesModal.hidden = false;
    stopBountyAnimation();
    animRafId = requestAnimationFrame(stepBountyAnimation);
  }

  function closeBountiesModal() {
    stopBountyAnimation();
    if (bountiesModal) bountiesModal.hidden = true;
  }

  btnOpenBounties?.addEventListener('click', openBountiesModal);
  btnBountiesClose?.addEventListener('click', closeBountiesModal);
  bountiesModal?.addEventListener('click', (e) => {
    if (e.target === bountiesModal) closeBountiesModal();
  });

  return {
    openBountiesModal,
    closeBountiesModal,
    renderBountiesModal,
  };
}
