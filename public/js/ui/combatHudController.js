/**
 * Combat Mode HUD Controller (extracted from main.js in v195).
 * Manages Pure Combat Mode visibility, segmented HP pips, DPV scooter battery badge,
 * Hydro-Dash radial SVG cooldown ring, and stackable Speargun upgrade badges
 * with dirty-checking so the DOM is only touched when values actually change.
 */

import {
  BOSS_WEAPON_UPGRADES,
  BOSS_WEAPON_UPGRADE_ORDER,
  SCOOTER_DASH_COST_PCT,
  SCOOTER_DASH_COOLDOWN_SEC,
} from '../game/secretLairs.js';

export function createCombatHudController({
  elements = {},
  getMode = () => 'title',
  getInput = () => null,
  onEnterCombatMode = null,
} = {}) {
  const {
    screenHud,
    hudCombatBarEl,
    btnCombatPauseEl,
    btnCombatDashEl,
    combatHpValEl,
    combatHpSegsEl,
    btnCombatScooterEl,
    combatBattFillEl,
    combatScooterPctEl,
    combatDashRingEl,
    combatDashLabelEl,
    combatUpgradesRowEl,
    combatHintPillEl,
  } = elements;

  let lastMode = false;
  let lastArmed = false;
  let lastHp = -1;
  let lastScooterKey = '';
  let lastDashKey = '';
  let lastUpgradesKey = '';
  let lastHintFaded = false;

  function reset() {
    lastMode = false;
    lastArmed = false;
    lastHp = -1;
    lastScooterKey = '';
    lastDashKey = '';
    lastUpgradesKey = '';
    lastHintFaded = false;
  }

  function sync(sess) {
    const lair = sess?.secretLair;
    const active = Boolean(getMode() === 'diving' && lair?.combatMode && !sess?.endedState);
    const armed = Boolean(active && lair?.weaponEquipped && !lair?.bossDefeated);

    if (active !== lastMode) {
      lastMode = active;
      lastDashKey = '';
      const input = getInput();
      if (input) input.combatModeActive = active;
      screenHud?.classList.toggle('combat-mode', active);
      if (hudCombatBarEl) hudCombatBarEl.hidden = !active;
      if (btnCombatPauseEl) btnCombatPauseEl.hidden = !active;
      if (btnCombatDashEl && !active) btnCombatDashEl.hidden = true;
      if (active) {
        onEnterCombatMode?.();
      }
    }

    if (armed !== lastArmed) {
      lastArmed = armed;
      screenHud?.classList.toggle('combat-armed', armed);
    }
    if (!active) return { active, armed };

    const hp = Math.max(0, Math.min(100, Math.round(lair.playerHp ?? 100)));
    if (hp !== lastHp) {
      lastHp = hp;
      if (combatHpValEl) combatHpValEl.textContent = String(hp);
      if (combatHpSegsEl) {
        const segs = combatHpSegsEl.children;
        const litCount = Math.ceil((hp / 100) * segs.length);
        const isLow = hp <= 35;
        for (let i = 0; i < segs.length; i++) {
          segs[i].classList.toggle('filled', i < litCount);
          segs[i].classList.toggle('low', isLow);
        }
      }
    }

    // Live Combat DPV Scooter toggle & battery meter
    const dpvEquipped = Boolean(sess?.dpv?.equipped);
    const dpvOn = Boolean(sess?.dpv?.active);
    const dpvPct = Math.max(0, Math.min(100, Math.round(sess?.dpv?.batteryPct ?? 0)));
    const scooterKey = `${dpvEquipped}:${dpvOn}:${dpvPct}`;
    if (scooterKey !== lastScooterKey) {
      lastScooterKey = scooterKey;
      if (btnCombatScooterEl) {
        btnCombatScooterEl.hidden = !dpvEquipped;
        btnCombatScooterEl.classList.toggle('active', dpvOn && dpvPct > 0);
        btnCombatScooterEl.classList.toggle('low', dpvPct > 0 && dpvPct <= 25);
        btnCombatScooterEl.classList.toggle('empty', dpvPct <= 0);
        btnCombatScooterEl.setAttribute('aria-pressed', dpvOn ? 'true' : 'false');
      }
      if (combatBattFillEl) combatBattFillEl.style.width = `${dpvPct}%`;
      if (combatScooterPctEl) combatScooterPctEl.textContent = dpvPct <= 0 ? '0%' : dpvOn ? `${dpvPct}%` : 'OFF';
    }

    // Live Combat Hydro-Dash Button Status + Radial SVG Cooldown Ring
    const dashCd = Math.max(0, lair.dashCooldownSec || 0);
    const dashLow = !dpvEquipped || dpvPct < SCOOTER_DASH_COST_PCT;
    const dashReady = dashCd <= 0.02 && !dashLow;
    const ringFrac = dashLow ? 0 : Math.max(0, Math.min(1, 1 - dashCd / Math.max(0.1, SCOOTER_DASH_COOLDOWN_SEC)));
    const dashKey = `${dashReady}:${dashLow}:${Math.round(ringFrac * 40)}`;
    if (dashKey !== lastDashKey) {
      lastDashKey = dashKey;
      if (btnCombatDashEl) {
        btnCombatDashEl.hidden = !dpvEquipped;
        btnCombatDashEl.classList.toggle('ready', dashReady);
        btnCombatDashEl.classList.toggle('cooling', !dashReady && !dashLow);
        btnCombatDashEl.classList.toggle('low-batt', dashLow);
      }
      if (combatDashRingEl) {
        const circ = 169.65;
        combatDashRingEl.setAttribute('stroke-dashoffset', (circ * (1 - ringFrac)).toFixed(2));
      }
      if (combatDashLabelEl) {
        combatDashLabelEl.textContent = dashLow ? 'LOW' : dashCd > 0.05 ? `${dashCd.toFixed(1)}s` : 'DASH';
      }
    }

    // Live Speargun Weapon Upgrade Badges
    const mods = lair.weaponMods || {};
    const upgKey = BOSS_WEAPON_UPGRADE_ORDER.map((k) => mods[k] || 0).join(',');
    if (upgKey !== lastUpgradesKey) {
      lastUpgradesKey = upgKey;
      if (combatUpgradesRowEl) {
        const pills = [];
        for (const k of BOSS_WEAPON_UPGRADE_ORDER) {
          const lv = mods[k] || 0;
          if (lv <= 0) continue;
          const meta = BOSS_WEAPON_UPGRADES[k];
          if (!meta) continue;
          const lbl = lv >= 2 ? meta.lv2Label : meta.shortLabel;
          pills.push(
            `<span class="combat-upg-badge${lv >= 2 ? ' lv2' : ''}" style="--upg-col:${meta.color}">${meta.icon} ${lbl}${lv >= 2 ? ' ★' : ''}</span>`
          );
        }
        combatUpgradesRowEl.innerHTML = pills.join('');
        combatUpgradesRowEl.hidden = pills.length === 0;
      }
    }

    const hintFaded = (lair.combatHintTimer || 0) <= 0;
    if (hintFaded !== lastHintFaded) {
      lastHintFaded = hintFaded;
      combatHintPillEl?.classList.toggle('faded', hintFaded);
    }

    return { active, armed };
  }

  return {
    sync,
    reset,
    isActive: () => lastMode,
    isArmed: () => lastArmed,
  };
}
