import { escapeHtml } from '../util/common.js';
import { resolveBountyBoardState, getBossSilhouetteSvg } from '../game/bossBounties.js';
import { drawStyledArtifact } from '../game/artSprites.js';

/**
 * Abyssal Wanted Bounty Board Modal Controller (v199).
 * Displays weathered deep-sea Wanted Posters with general regional rumors & folklore
 * clues for the 10-Guardian Pantheon, keeping specifics redacted until vanquished.
 */
export function createBountiesController({ loadCareerLogbook, setHomeMenuOpen, els = {} } = {}) {
  const { btnOpenBounties, bountiesModal, btnBountiesClose, bountiesGrid, bountiesSubEl } = els;

  function renderBountiesModal() {
    if (!bountiesGrid) return;
    const book = loadCareerLogbook?.() || {};
    const { bounties, claimedCount, totalCount } = resolveBountyBoardState(book);

    if (bountiesSubEl) {
      bountiesSubEl.textContent = `${claimedCount}/${totalCount} Abyssal Bounties Claimed · Dockside rumors & acoustic legends — exact lairs uncharted`;
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

        const portraitHtml = b.claimed
          ? `<div class="bounty-portrait claimed">
              <canvas class="bounty-relic-canvas" width="96" height="72" data-bounty-relic="${escapeHtml(b.trophyRelicId)}" data-bounty-name="${escapeHtml(b.trophyName)}" aria-hidden="true"></canvas>
              <span class="bounty-stamp claimed">✓ CLAIMED</span>
            </div>`
          : `<div class="bounty-portrait">
              ${getBossSilhouetteSvg(b.silhouetteKind, b.accentColor)}
              <span class="bounty-stamp wanted">WANTED</span>
            </div>`;

        return `
        <article class="bounty-card${b.claimed ? ' claimed' : ''}" style="--bounty-accent:${b.accentColor};" data-bounty-id="${escapeHtml(b.id)}">
          <div class="bounty-poster-head">
            <span class="bounty-code">${escapeHtml(b.contractCode)}</span>
            <span class="bounty-threat">${escapeHtml(b.threatClass)}</span>
          </div>
          ${portraitHtml}
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

    // Paint live bespoke trophy relics on any claimed posters
    bountiesGrid.querySelectorAll('canvas[data-bounty-relic]').forEach((cv, idx) => {
      const ctx = cv.getContext?.('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const relicId = cv.getAttribute('data-bounty-relic') || '';
      const relicName = cv.getAttribute('data-bounty-name') || '';
      drawStyledArtifact(ctx, { id: relicId, name: relicName }, cv.width * 0.5, cv.height * 0.52, 24, 1.4 + idx * 0.5, {
        index: idx,
        isGrand: true,
      });
    });
  }

  function openBountiesModal() {
    if (!bountiesModal) return;
    setHomeMenuOpen?.(false);
    renderBountiesModal();
    bountiesModal.hidden = false;
  }

  function closeBountiesModal() {
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
