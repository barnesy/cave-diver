import { escapeHtml } from '../util/common.js';
import {
  drawGearShowcasePreview,
  getGearTierMeta,
  getSetsForGearItem,
  evaluateGearSetSynergy,
} from '../game/rigLivery.js';
import { getGearItemStats, SET_TIER_BONUSES, evaluateLootUpgradeImpact } from '../game/gearStats.js';

const EQUIP_ANIM_DURATION_MS = 2400;

/**
 * Celebratory Gear Unlock Showcase Card Modal (v211).
 * Reveals newly unlocked gear one-by-one in a rarity-staged collector card with
 * a live animated diver preview, animated property callout, and 1-tap Equip Now
 * that physically animates the new piece onto the diver avatar.
 */
export function createGearUnlockShowcase({
  getActiveRigLivery,
  getEffectiveGearLoadout,
  equipEntryFromShowcase,
  openWorkshopAtTab,
  markEntrySeen,
  playGearUnlock,
  playGearEquip,
  spawnConfetti,
}) {
  const modalEl = document.getElementById('gear-unlock-modal');
  const cardEl = document.getElementById('gear-unlock-card');
  const tierEl = document.getElementById('gear-unlock-tier');
  const countEl = document.getElementById('gear-unlock-count');
  const canvasEl = document.getElementById('gear-unlock-canvas');
  const ctx = canvasEl?.getContext?.('2d') || null;
  const slotEl = document.getElementById('gear-unlock-slot');
  const nameEl = document.getElementById('gear-unlock-name');
  const reasonEl = document.getElementById('gear-unlock-reason');
  const statsBoxEl = document.getElementById('gear-unlock-stats-box');
  const fxBoxEl = document.getElementById('gear-unlock-fx-box');
  const setBoxEl = document.getElementById('gear-unlock-set-box');
  const dotsEl = document.getElementById('gear-unlock-dots');
  const btnEquipEl = document.getElementById('btn-gear-unlock-equip');
  const btnWorkshopEl = document.getElementById('btn-gear-unlock-workshop');
  const btnNextEl = document.getElementById('btn-gear-unlock-next');
  const btnCloseEl = document.getElementById('btn-gear-unlock-close');

  let queue = [];
  let activeIndex = 0;
  let rafId = 0;
  let equipAnim = null;
  let equippedKeys = new Set();

  function getCurrentEntry() {
    return queue[activeIndex] || null;
  }

  function buildPreviewLivery(entry) {
    const base = { ...(getActiveRigLivery?.() || {}) };
    if (entry?.field && entry?.item?.id) {
      base[entry.field] = entry.item.id;
    }
    return base;
  }

  function triggerCanvasEquipSnap(entry, labelOverride = null) {
    if (!entry) return;
    const tierMeta = getGearTierMeta(entry.item?.tier);
    equipAnim = {
      slot: entry.slot || 'all',
      startedAtMs: performance.now(),
      color: tierMeta.color,
      tier: tierMeta.id,
      itemName: labelOverride || entry.item?.name || '',
    };
  }

  function renderCardMeta() {
    const entry = getCurrentEntry();
    if (!entry || !modalEl) return;
    const item = entry.item;
    const tierMeta = getGearTierMeta(item.tier);
    const activeRig = getActiveRigLivery?.() || {};
    const alreadyEquipped =
      equippedKeys.has(entry.key) ||
      (entry.field && (activeRig[entry.field] || '') === item.id);

    if (cardEl) {
      cardEl.dataset.tier = tierMeta.id;
      cardEl.classList.remove('reveal-pop');
      void cardEl.offsetWidth;
      cardEl.classList.add('reveal-pop');
    }
    if (tierEl) {
      tierEl.textContent = `${tierMeta.icon} ${tierMeta.title.toUpperCase()}`;
      tierEl.style.color = tierMeta.color;
      tierEl.style.borderColor = tierMeta.glow;
      tierEl.style.background = tierMeta.bg;
    }
    if (countEl) {
      countEl.hidden = queue.length <= 1;
      countEl.textContent = `${activeIndex + 1} / ${queue.length} UNLOCKED`;
    }
    if (slotEl) {
      slotEl.textContent = `${entry.categoryLabel.toUpperCase()} · ${tierMeta.badge}`;
      slotEl.style.color = tierMeta.color;
    }
    if (nameEl) {
      nameEl.textContent = item.name;
    }
    if (reasonEl) {
      const detail = item.specText ? `${item.specText} · ` : '';
      const info = getGearItemStats(entry.slot, item);
      const srcVerb = info.source === 'world' ? '🗺️ Found in World' : '🏆 Earned';
      reasonEl.textContent = `${detail}${srcVerb}: ${item.unlockHint || 'Expedition Milestone'}`;
    }
    if (statsBoxEl) {
      const info = getGearItemStats(entry.slot, item);
      const impact = evaluateLootUpgradeImpact(activeRig, entry.slot, item.id);
      if (info.pills.length > 0 || info.power || impact) {
        statsBoxEl.hidden = false;
        const pills = info.pills.map((p) => `<span class="livery-stat-pill">${escapeHtml(p)}</span>`).join('');
        const pwr = info.power
          ? `<div class="gear-unlock-power">⚡ <strong>${escapeHtml(info.power.name)}</strong> — ${escapeHtml(info.power.desc)}</div>`
          : '';
        const impChips = [];
        for (const sc of impact.setChanges || []) {
          impChips.push(`<span class="loot-impact-chip ${sc.positive ? 'pos' : 'neg'} is-set">${sc.positive ? '▲' : '▼'} ${escapeHtml(sc.text)}</span>`);
        }
        for (const gp of impact.gainedPowers || []) {
          impChips.push(`<span class="loot-impact-chip pos is-pwr">▲ +⚡ ${escapeHtml(gp.name)}</span>`);
        }
        for (const lp of impact.lostPowers || []) {
          impChips.push(`<span class="loot-impact-chip neg is-pwr">▼ -⚡ ${escapeHtml(lp.name)}</span>`);
        }
        for (const d of (impact.deltas || []).slice(0, 6)) {
          impChips.push(`<span class="loot-impact-chip ${d.positive ? 'pos' : 'neg'}">${d.positive ? '▲' : '▼'} ${escapeHtml(d.text)}</span>`);
        }
        const impactBlock = alreadyEquipped || impact.verdict === 'same'
          ? `<div class="loot-impact-box verdict-same"><div class="loot-impact-head"><span class="loot-verdict-pill verdict-same">✓ EQUIPPED ON YOUR RIG</span></div></div>`
          : `<div class="loot-impact-box verdict-${impact.verdict}">
              <div class="loot-impact-head">
                <span class="loot-verdict-pill verdict-${impact.verdict}">${impact.verdictIcon} ${escapeHtml(impact.verdictLabel)}</span>
                <span class="loot-impact-vs">vs. <strong>${escapeHtml(impact.replacedItemName)}</strong></span>
              </div>
              ${impChips.length > 0 ? `<div class="loot-impact-deltas">${impChips.join('')}</div>` : ''}
            </div>`;
        statsBoxEl.innerHTML = `<div class="gear-unlock-stat-pills">${pills}</div>${pwr}${impactBlock}`;
      } else {
        statsBoxEl.hidden = true;
        statsBoxEl.innerHTML = '';
      }
    }
    if (fxBoxEl) {
      if (item.fx) {
        fxBoxEl.hidden = false;
        fxBoxEl.innerHTML = `<span class="gear-unlock-fx-tag">✦ ANIMATED PROPERTY</span> <strong>${escapeHtml(item.fx.name)}</strong> — ${escapeHtml(item.fx.desc)}`;
      } else {
        fxBoxEl.hidden = true;
        fxBoxEl.innerHTML = '';
      }
    }
    if (setBoxEl) {
      const sets = getSetsForGearItem(entry.slot, item.id);
      if (sets.length > 0) {
        const set = sets[0];
        const previewSyn = evaluateGearSetSynergy(buildPreviewLivery(entry));
        const st = previewSyn.sets.find((x) => x.set.id === set.id);
        const tierDef = SET_TIER_BONUSES[set.id];
        const bonusSummary = tierDef
          ? ` · (2): ${tierDef.tier2.label} · (${tierDef.capstoneReq || set.required}): ${tierDef.tierFull.label}`
          : ` — ${set.auraName}`;
        setBoxEl.hidden = false;
        setBoxEl.innerHTML = `<span class="gear-unlock-set-tag" style="color:${set.color}">${set.icon} SET BONUS</span> <strong>${escapeHtml(set.name)}</strong> (${st ? `${st.matched}/${st.required}` : `1/${set.required}`}${st?.active ? ' · ✦ CAPSTONE!' : ''})${escapeHtml(bonusSummary)}`;
      } else {
        setBoxEl.hidden = true;
        setBoxEl.innerHTML = '';
      }
    }
    if (dotsEl) {
      if (queue.length > 1) {
        dotsEl.hidden = false;
        dotsEl.innerHTML = queue
          .map((q, idx) => {
            const tm = getGearTierMeta(q.item?.tier);
            return `<button type="button" class="gear-unlock-dot${idx === activeIndex ? ' active' : ''}" data-unlock-idx="${idx}" style="--dot-color:${tm.color}" aria-label="View unlocked item ${idx + 1}: ${escapeHtml(q.item?.name || '')}"></button>`;
          })
          .join('');
        dotsEl.querySelectorAll('button[data-unlock-idx]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const nextIdx = Number(btn.getAttribute('data-unlock-idx'));
            if (Number.isInteger(nextIdx) && nextIdx >= 0 && nextIdx < queue.length) {
              showIndex(nextIdx);
            }
          });
        });
      } else {
        dotsEl.hidden = true;
        dotsEl.innerHTML = '';
      }
    }
    if (btnEquipEl) {
      btnEquipEl.disabled = false;
      btnEquipEl.classList.toggle('equipped', alreadyEquipped);
      btnEquipEl.textContent = alreadyEquipped ? '✓ Equipped on Rig' : '⚡ Equip Now';
    }
    if (btnNextEl) {
      const hasMore = activeIndex < queue.length - 1;
      btnNextEl.textContent = hasMore ? `Next Unlock (${activeIndex + 2}/${queue.length}) →` : 'Continue';
    }
  }

  function drawFrame(nowMs) {
    if (!modalEl || modalEl.hidden) {
      rafId = 0;
      return;
    }
    const entry = getCurrentEntry();
    if (ctx && canvasEl && entry) {
      let hasCcr = false;
      let hasDpv = false;
      try {
        const eq = getEffectiveGearLoadout?.();
        hasCcr = Boolean(eq?.ccr);
        hasDpv = Boolean(eq?.dpv);
      } catch {}
      let fxArg = null;
      if (equipAnim) {
        const p = (nowMs - equipAnim.startedAtMs) / EQUIP_ANIM_DURATION_MS;
        if (p < 1) {
          fxArg = { ...equipAnim, progress: Math.max(0, p) };
        } else {
          equipAnim = null;
        }
      }
      const tierMeta = getGearTierMeta(entry.item?.tier || 'uncommon');
      drawGearShowcasePreview(ctx, canvasEl.width, canvasEl.height, buildPreviewLivery(entry), {
        tier: entry.item?.tier || 'uncommon',
        hasCcr,
        hasDpv,
        timeSec: nowMs * 0.001,
        equipFx: fxArg,
        focusHighlight: !fxArg && entry.slot
          ? { slot: entry.slot, color: tierMeta.color, label: entry.item?.name || '' }
          : null,
      });
    }
    rafId = requestAnimationFrame(drawFrame);
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(drawFrame);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function showIndex(idx, { silent = false } = {}) {
    activeIndex = Math.max(0, Math.min(queue.length - 1, idx));
    const entry = getCurrentEntry();
    if (!entry) return;
    markEntrySeen?.(entry.key);
    renderCardMeta();
    triggerCanvasEquipSnap(entry);
    if (!silent) {
      const tierId = entry.item?.tier || 'uncommon';
      playGearUnlock?.(tierId);
      if (tierId === 'epic' || tierId === 'mythic') {
        spawnConfetti?.();
      }
    }
  }

  function openShowcase(entries = []) {
    if (!modalEl || !Array.isArray(entries) || entries.length === 0) return false;
    queue = entries.slice();
    equippedKeys = new Set();
    modalEl.hidden = false;
    showIndex(0);
    startLoop();
    return true;
  }

  function closeShowcase() {
    if (!modalEl) return;
    modalEl.hidden = true;
    stopLoop();
  }

  btnEquipEl?.addEventListener('click', () => {
    const entry = getCurrentEntry();
    if (!entry) return;
    equipEntryFromShowcase?.(entry);
    equippedKeys.add(entry.key);
    triggerCanvasEquipSnap(entry, entry.item?.name);
    playGearEquip?.(entry.slot, entry.item?.tier || 'common');
    renderCardMeta();
  });

  btnWorkshopEl?.addEventListener('click', () => {
    const entry = getCurrentEntry();
    closeShowcase();
    openWorkshopAtTab?.(entry?.tabId || 'suit');
  });

  btnNextEl?.addEventListener('click', () => {
    if (activeIndex < queue.length - 1) {
      showIndex(activeIndex + 1);
    } else {
      closeShowcase();
    }
  });

  btnCloseEl?.addEventListener('click', closeShowcase);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) closeShowcase();
  });

  return {
    modalEl,
    openShowcase,
    closeShowcase,
    isOpen: () => Boolean(modalEl && !modalEl.hidden),
  };
}
