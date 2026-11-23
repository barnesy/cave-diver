import { escapeHtml } from '../util/common.js';
import { RESCUE_DRILLS, getRescueDrillById } from '../game/rescueDrills.js';
import { getLevelById } from '../levels/index.js';

/**
 * Technical Rescue Drills Mode Modal & Launcher Controller (v174).
 */
export function createRescueDrillsController({
  loadCareerLogbook,
  setHomeMenuOpen,
  closeDiveSetupModal,
  launchRescueDrill,
}) {
  const drillsModal = document.getElementById('drills-modal');
  const btnOpenDrills = document.getElementById('btn-open-drills');
  const btnSetupDrillsRack = document.getElementById('btn-setup-open-drills');
  const btnDrillsClose = document.getElementById('btn-drills-close');
  const drillsGridEl = document.getElementById('drills-grid');
  const drillsSubEl = document.getElementById('drills-modal-sub');

  function renderDrillsModal() {
    if (!drillsGridEl) return;
    const book = loadCareerLogbook();
    const mastery = book.drillMastery || {};
    const clearedCount = RESCUE_DRILLS.filter((d) => Boolean(mastery[d.id])).length;
    if (drillsSubEl) {
      drillsSubEl.textContent = `${clearedCount}/${RESCUE_DRILLS.length} Technical Rescue Drills Mastered · Timed 65–95s emergency procedures`;
    }
    drillsGridEl.innerHTML = RESCUE_DRILLS.map((d) => {
      const rec = mastery[d.id] || null;
      const lvl = getLevelById(d.levelId);
      const badgeHtml = rec
        ? `<span class="campaign-patch-badge">🏅 ${escapeHtml(rec.bestGrade)} · ${rec.bestTimeSec.toFixed(0)}s</span>`
        : `<span class="campaign-patch-badge" style="opacity:0.7">⏱ Par ${d.parTimeSec}s</span>`;
      const objHtml = d.objectives.map((o) => `<div>• ${escapeHtml(o)}</div>`).join('');
      return `
        <div class="campaign-arc-card drill-card${rec ? ' cleared' : ''}" style="--drill-accent:${d.accent}">
          <div class="campaign-arc-head">
            <span class="campaign-arc-title">${d.icon} ${escapeHtml(d.name)}</span>
            ${badgeHtml}
          </div>
          <p class="campaign-arc-desc">${escapeHtml(d.summary)}</p>
          <div class="campaign-legs-list">
            <div style="color:#7dd3fc;font-weight:700;">Site: ${escapeHtml(lvl?.name || d.levelId)} · Par ${d.parTimeSec}s${d.needsAiBuddy ? ' · 🤖 AI Squad Active' : ''}</div>
            ${objHtml}
          </div>
          <button class="btn primary tiny" type="button" data-start-drill="${d.id}">${rec ? '↺ REPLAY DRILL' : '⚡ LAUNCH DRILL'}</button>
        </div>
      `;
    }).join('');
  }

  function openDrillsModal() {
    if (!drillsModal) return;
    setHomeMenuOpen(false);
    closeDiveSetupModal();
    renderDrillsModal();
    drillsModal.hidden = false;
  }

  function closeDrillsModal() {
    if (drillsModal) drillsModal.hidden = true;
  }

  btnOpenDrills?.addEventListener('click', openDrillsModal);
  btnSetupDrillsRack?.addEventListener('click', openDrillsModal);
  btnDrillsClose?.addEventListener('click', closeDrillsModal);
  drillsModal?.addEventListener('click', (e) => {
    if (e.target === drillsModal) closeDrillsModal();
  });
  drillsGridEl?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-start-drill]');
    if (!btn) return;
    const did = btn.getAttribute('data-start-drill');
    const drill = getRescueDrillById(did);
    if (!drill) return;
    closeDrillsModal();
    launchRescueDrill(drill);
  });

  return {
    drillsModal,
    renderDrillsModal,
    openDrillsModal,
    closeDrillsModal,
  };
}
