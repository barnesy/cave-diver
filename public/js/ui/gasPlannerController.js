import { GAS_MIXES, buildCustomGasBlend } from '../physics/diveModel.js';
import { LEVELS, getLevelMaxDepthM } from '../levels/index.js';
import { drawDivePlanSlate } from '../game/diveCard.js';

const CUSTOM_GAS_PREF_KEY = 'caveDiverCustomGas_v1';

/**
 * Pre-Dive Technical Trimix / Nitrox Gas Blender controller (v120 / modularized v172).
 */
export function createGasPlannerController({
  getActiveLevel,
  setHomeMenuOpen,
  closeDiveSetupModal,
  syncSetupDrawerSummary,
  showToast,
}) {
  const gasPlannerModal = document.getElementById('gas-planner-modal');
  const btnOpenGasPlanner = document.getElementById('btn-open-gas-planner');
  const menuGasPillEl = document.getElementById('menu-gas-pill');
  const homeMenuGasLabelEl = document.getElementById('home-menu-gas-label');
  const btnGasPlannerClose = document.getElementById('btn-gas-planner-close');
  const gasPlannerSubEl = document.getElementById('gas-planner-sub');
  const gasPresetRowEl = document.getElementById('gas-preset-row');
  const gasO2Slider = document.getElementById('gas-o2-slider');
  const gasHeSlider = document.getElementById('gas-he-slider');
  const gasO2ValEl = document.getElementById('gas-o2-val');
  const gasHeValEl = document.getElementById('gas-he-val');
  const gasBarO2El = document.getElementById('gas-bar-o2');
  const gasBarHeEl = document.getElementById('gas-bar-he');
  const gasBarN2El = document.getElementById('gas-bar-n2');
  const gasLegO2El = document.getElementById('gas-leg-o2');
  const gasLegHeEl = document.getElementById('gas-leg-he');
  const gasLegN2El = document.getElementById('gas-leg-n2');
  const gasOutNameEl = document.getElementById('gas-out-name');
  const gasOutMod14El = document.getElementById('gas-out-mod14');
  const gasOutMod16El = document.getElementById('gas-out-mod16');
  const gasOutMinEl = document.getElementById('gas-out-min');
  const gasOutDepthLblEl = document.getElementById('gas-out-depth-lbl');
  const gasOutPpo2El = document.getElementById('gas-out-ppo2');
  const gasOutEndEl = document.getElementById('gas-out-end');
  const gasSafetyPillEl = document.getElementById('gas-safety-pill');
  const btnGasApply = document.getElementById('btn-gas-apply');
  const btnGasReset = document.getElementById('btn-gas-reset');

  let customGasPlan = { enabled: false, o2Pct: 18, hePct: 45 };
  let draftGasPlan = { o2Pct: 18, hePct: 45, useDefault: true };
  try {
    const rawGas = localStorage.getItem(CUSTOM_GAS_PREF_KEY);
    if (rawGas) {
      const parsed = JSON.parse(rawGas);
      if (parsed && typeof parsed === 'object') {
        customGasPlan = {
          enabled: Boolean(parsed.enabled),
          o2Pct: Math.max(8, Math.min(40, Math.round(Number(parsed.o2Pct) || 18))),
          hePct: Math.max(0, Math.min(75, Math.round(Number(parsed.hePct) || 45))),
        };
      }
    }
  } catch {}

  function saveCustomGasPlan() {
    try {
      localStorage.setItem(CUSTOM_GAS_PREF_KEY, JSON.stringify(customGasPlan));
    } catch {}
  }

  function getSiteDefaultBottomMix(lvl) {
    const ov = lvl?.gasOverrides?.TMX1455;
    return ov ? { ...GAS_MIXES.TMX1455, ...ov } : GAS_MIXES.TMX1455;
  }

  function getActiveCustomMixOverrides(lvl = getActiveLevel()) {
    if (!customGasPlan.enabled) return null;
    const targetDepthM = getLevelMaxDepthM(lvl) || 50;
    const baseGas = getSiteDefaultBottomMix(lvl);
    const blend = buildCustomGasBlend({
      o2Pct: customGasPlan.o2Pct,
      hePct: customGasPlan.hePct,
      targetDepthM,
      baseGas,
    });
    return { TMX1455: blend.override };
  }

  function syncGasPlanBadges() {
    const activeLevel = getActiveLevel();
    const targetDepthM = getLevelMaxDepthM(activeLevel) || 50;
    if (customGasPlan.enabled) {
      const blend = buildCustomGasBlend({
        o2Pct: customGasPlan.o2Pct,
        hePct: customGasPlan.hePct,
        targetDepthM,
        baseGas: getSiteDefaultBottomMix(activeLevel),
      });
      if (menuGasPillEl) {
        menuGasPillEl.textContent = `🧪 ${blend.name}`;
        menuGasPillEl.classList.add('custom');
      }
      if (homeMenuGasLabelEl) {
        homeMenuGasLabelEl.textContent = `🧪 Gas Blender (${blend.shortLabel})`;
      }
    } else {
      if (menuGasPillEl) {
        menuGasPillEl.textContent = '🧪 Default Mix';
        menuGasPillEl.classList.remove('custom');
      }
      if (homeMenuGasLabelEl) {
        homeMenuGasLabelEl.textContent = '🧪 Gas Blender';
      }
    }
    syncSetupDrawerSummary();
  }

  function renderGasPlannerModal() {
    if (!gasPlannerModal) return;
    const lvl = getActiveLevel() || LEVELS[0];
    const targetDepthM = Math.round(getLevelMaxDepthM(lvl) || 50);
    const siteBase = getSiteDefaultBottomMix(lvl);
    const maxAllowedHe = Math.min(75, Math.max(0, 95 - draftGasPlan.o2Pct));
    if (draftGasPlan.hePct > maxAllowedHe) draftGasPlan.hePct = maxAllowedHe;

    const blend = buildCustomGasBlend({
      o2Pct: draftGasPlan.o2Pct,
      hePct: draftGasPlan.hePct,
      targetDepthM,
      baseGas: siteBase,
    });

    if (gasPlannerSubEl) {
      gasPlannerSubEl.textContent = `${lvl.name} · Target Max Depth ${targetDepthM}m (Site Default: ${siteBase.name})`;
    }
    if (gasO2Slider) gasO2Slider.value = String(blend.o2Pct);
    if (gasHeSlider) {
      gasHeSlider.max = String(Math.min(75, Math.max(0, 95 - blend.o2Pct)));
      gasHeSlider.value = String(blend.hePct);
    }
    if (gasO2ValEl) gasO2ValEl.textContent = `${blend.o2Pct}%`;
    if (gasHeValEl) gasHeValEl.textContent = `${blend.hePct}%`;
    if (gasBarO2El) gasBarO2El.style.width = `${blend.o2Pct}%`;
    if (gasBarHeEl) gasBarHeEl.style.width = `${blend.hePct}%`;
    if (gasBarN2El) gasBarN2El.style.width = `${blend.n2Pct}%`;
    if (gasLegO2El) gasLegO2El.textContent = `${blend.o2Pct}%`;
    if (gasLegHeEl) gasLegHeEl.textContent = `${blend.hePct}%`;
    if (gasLegN2El) gasLegN2El.textContent = `${blend.n2Pct}%`;

    if (gasOutNameEl) gasOutNameEl.textContent = draftGasPlan.useDefault ? `${siteBase.name} (Default)` : blend.name;
    if (gasOutMod14El) gasOutMod14El.textContent = `${blend.mod14M.toFixed(1)}m`;
    if (gasOutMod16El) gasOutMod16El.textContent = `${blend.mod16M.toFixed(1)}m`;
    if (gasOutMinEl) gasOutMinEl.textContent = blend.minM > 0 ? `${blend.minM}m (Hypoxic)` : '0m (Normoxic)';
    if (gasOutDepthLblEl) gasOutDepthLblEl.textContent = `PPO₂ @ ${targetDepthM}m`;
    if (gasOutPpo2El) gasOutPpo2El.textContent = `${blend.ppo2AtTarget.toFixed(2)} bar`;
    if (gasOutEndEl) gasOutEndEl.textContent = `${blend.endAtTargetM.toFixed(1)}m`;
    if (gasSafetyPillEl) {
      gasSafetyPillEl.textContent = blend.statusText;
      gasSafetyPillEl.className = `gas-safety-pill ${blend.status}`;
    }

    if (gasPresetRowEl) {
      gasPresetRowEl.querySelectorAll('.gas-preset-btn').forEach((btn) => {
        const isDefBtn = btn.dataset.preset === 'default';
        const match = isDefBtn
          ? draftGasPlan.useDefault
          : !draftGasPlan.useDefault && Number(btn.dataset.o2) === blend.o2Pct && Number(btn.dataset.he) === blend.hePct;
        btn.classList.toggle('active', match);
      });
    }
    const slateCanvas = document.getElementById('gas-slate-canvas');
    if (slateCanvas) {
      const sctx = slateCanvas.getContext('2d');
      if (sctx) {
        drawDivePlanSlate(sctx, slateCanvas.width, slateCanvas.height, {
          level: lvl,
          mixes: lvl.gasMixes,
          customGasPlan: draftGasPlan.useDefault ? null : { enabled: true, o2Pct: blend.o2Pct, hePct: blend.hePct },
        });
      }
    }
  }

  function openGasPlannerModal() {
    if (!gasPlannerModal) return;
    setHomeMenuOpen(false);
    const siteBase = getSiteDefaultBottomMix(getActiveLevel());
    if (customGasPlan.enabled) {
      draftGasPlan = { o2Pct: customGasPlan.o2Pct, hePct: customGasPlan.hePct, useDefault: false };
    } else {
      draftGasPlan = {
        o2Pct: Math.round((siteBase.fO2 || 0.14) * 100),
        hePct: Math.round((siteBase.fHe || 0.55) * 100),
        useDefault: true,
      };
    }
    renderGasPlannerModal();
    gasPlannerModal.hidden = false;
  }

  function closeGasPlannerModal() {
    if (gasPlannerModal) gasPlannerModal.hidden = true;
  }

  btnOpenGasPlanner?.addEventListener('click', openGasPlannerModal);
  menuGasPillEl?.addEventListener('click', () => {
    closeDiveSetupModal();
    openGasPlannerModal();
  });
  btnGasPlannerClose?.addEventListener('click', closeGasPlannerModal);
  gasPlannerModal?.addEventListener('click', (e) => {
    if (e.target === gasPlannerModal) closeGasPlannerModal();
  });
  gasO2Slider?.addEventListener('input', () => {
    draftGasPlan.o2Pct = Number(gasO2Slider.value) || 18;
    draftGasPlan.useDefault = false;
    renderGasPlannerModal();
  });
  gasHeSlider?.addEventListener('input', () => {
    draftGasPlan.hePct = Number(gasHeSlider.value) || 0;
    draftGasPlan.useDefault = false;
    renderGasPlannerModal();
  });
  gasPresetRowEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.gas-preset-btn');
    if (!btn) return;
    if (btn.dataset.preset === 'default') {
      const siteBase = getSiteDefaultBottomMix(getActiveLevel());
      draftGasPlan = {
        o2Pct: Math.round((siteBase.fO2 || 0.14) * 100),
        hePct: Math.round((siteBase.fHe || 0.55) * 100),
        useDefault: true,
      };
    } else {
      draftGasPlan = {
        o2Pct: Number(btn.dataset.o2) || 18,
        hePct: Number(btn.dataset.he) || 45,
        useDefault: false,
      };
    }
    renderGasPlannerModal();
  });
  btnGasApply?.addEventListener('click', () => {
    if (draftGasPlan.useDefault) {
      customGasPlan.enabled = false;
      saveCustomGasPlan();
      syncGasPlanBadges();
      closeGasPlannerModal();
      showToast('🧪 Using expedition site default bottom gas.', 2.2);
      return;
    }
    customGasPlan = {
      enabled: true,
      o2Pct: draftGasPlan.o2Pct,
      hePct: draftGasPlan.hePct,
    };
    saveCustomGasPlan();
    syncGasPlanBadges();
    closeGasPlannerModal();
    const blend = buildCustomGasBlend({
      o2Pct: customGasPlan.o2Pct,
      hePct: customGasPlan.hePct,
      targetDepthM: getLevelMaxDepthM(getActiveLevel()) || 50,
    });
    showToast(`🧪 Custom bottom gas locked: ${blend.name} (MOD ${blend.mod14M.toFixed(0)}m)`, 2.8);
  });
  btnGasReset?.addEventListener('click', () => {
    customGasPlan.enabled = false;
    saveCustomGasPlan();
    syncGasPlanBadges();
    closeGasPlannerModal();
    showToast('🧪 Reset to expedition site default gas mix.', 2.2);
  });

  return {
    gasPlannerModal,
    getPlan: () => customGasPlan,
    setPlan(nextPlan) {
      customGasPlan = {
        enabled: Boolean(nextPlan?.enabled),
        o2Pct: Math.max(8, Math.min(40, Math.round(Number(nextPlan?.o2Pct ?? customGasPlan.o2Pct) || 18))),
        hePct: Math.max(0, Math.min(75, Math.round(Number(nextPlan?.hePct ?? customGasPlan.hePct) || 45))),
      };
      saveCustomGasPlan();
      syncGasPlanBadges();
    },
    saveCustomGasPlan,
    getSiteDefaultBottomMix,
    getActiveCustomMixOverrides,
    syncGasPlanBadges,
    renderGasPlannerModal,
    openGasPlannerModal,
    closeGasPlannerModal,
    isOpen: () => Boolean(gasPlannerModal && !gasPlannerModal.hidden),
  };
}
