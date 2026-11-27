/**
 * Daily Generated Sump Challenge Card & Archive Calendar Modal Controller (v263).
 * Extracted from main.js to keep main.js modular and cleanly below the 8,000-line ceiling.
 */
import { getLevelById, getLevelMaxDepthM } from '../levels/index.js';
import { getDailyGeneratedConfig } from '../levels/proceduralLevel.js';
import {
  getUtcDateKey,
  getDailyMutatorForDate,
  getDailyStatus,
  buildDailyCalendarMonth,
} from '../game/logbookModel.js';

export function createDailyChallengeController({
  loadCareerLogbook,
  formatRunClock,
  setHomeMenuOpen,
  launchDailyChallenge,
}) {
  const dailyChallengeCardEl = document.getElementById('daily-challenge-card');
  const dailyDateLabelEl = document.getElementById('daily-date-label');
  const dailyStreakPillEl = document.getElementById('daily-streak-pill');
  const dailySiteTitleEl = document.getElementById('daily-site-title');
  const dailyMutatorBadgeEl = document.getElementById('daily-mutator-badge');
  const dailyMutatorDescEl = document.getElementById('daily-mutator-desc');
  const btnPlayDaily = document.getElementById('btn-play-daily');
  const homeDailyStreakBadgeEl = document.getElementById('home-daily-streak-badge');

  const dailyCalModalEl = document.getElementById('daily-calendar-modal');
  const btnOpenDailyCalendar = document.getElementById('btn-open-daily-calendar');
  const btnDailyCalClose = document.getElementById('btn-daily-cal-close');
  const btnDailyCalPrev = document.getElementById('btn-daily-cal-prev');
  const btnDailyCalNext = document.getElementById('btn-daily-cal-next');
  const dailyCalMonthLabelEl = document.getElementById('daily-cal-month-label');
  const dailyCalStatsEl = document.getElementById('daily-cal-stats');
  const dailyCalGridEl = document.getElementById('daily-cal-grid');
  const dailyCalSelTitleEl = document.getElementById('daily-cal-sel-title');
  const dailyCalSelBadgeEl = document.getElementById('daily-cal-sel-badge');
  const dailyCalSelMetaEl = document.getElementById('daily-cal-sel-meta');
  const dailyCalSelRecordEl = document.getElementById('daily-cal-sel-record');
  const btnDailyCalLaunch = document.getElementById('btn-daily-cal-launch');

  let dailyCalYear = new Date().getUTCFullYear();
  let dailyCalMonth0 = new Date().getUTCMonth();
  let dailyCalSelectedKey = getUtcDateKey();

  function getDailyGeneratedExpedition(dateOrKey = new Date()) {
    const cfg = getDailyGeneratedConfig(dateOrKey);
    const level = getLevelById(cfg.levelId);
    const mutator = getDailyMutatorForDate(cfg.dateKey);
    return {
      dateKey: cfg.dateKey,
      seed: cfg.seed,
      tier: cfg.tier,
      biome: cfg.biome,
      biomeSpec: cfg.biomeSpec,
      tierSpec: cfg.tierSpec,
      unlined: cfg.unlined,
      level,
      levelId: level.id,
      mutator,
      mutatorId: mutator.id,
    };
  }

  function renderDailyChallengeCard() {
    if (!dailyChallengeCardEl) return;
    const daily = getDailyGeneratedExpedition();
    const book = loadCareerLogbook();
    const status = getDailyStatus(book, daily.dateKey);
    dailyChallengeCardEl.classList.toggle('cleared', status.clearedToday);
    if (dailyDateLabelEl) {
      dailyDateLabelEl.textContent = daily.dateKey;
    }
    if (dailyStreakPillEl) {
      const streakLabel = `🔥 ${status.activeStreak}d Streak`;
      dailyStreakPillEl.textContent = status.clearedToday ? `✓ Cleared · ${streakLabel}` : streakLabel;
      dailyStreakPillEl.title =
        status.bestStreak > 0
          ? `Best Streak: ${status.bestStreak}d · Total Daily Clears: ${status.totalClears}`
          : 'Clear today’s daily generated sump to start your streak!';
    }
    if (dailySiteTitleEl && daily.level) {
      const lineTag = daily.unlined ? ' · 🧵 Unlined' : '';
      dailySiteTitleEl.textContent = `∞ ${daily.level.name} · ${daily.level.proceduralMeta?.targetDepthM || getLevelMaxDepthM(daily.level)}m${lineTag}`;
    }
    if (dailyMutatorBadgeEl && daily.mutator) {
      dailyMutatorBadgeEl.textContent = `${daily.mutator.icon} ${daily.mutator.name}`;
    }
    if (dailyMutatorDescEl && daily.mutator) {
      dailyMutatorDescEl.textContent = daily.mutator.shortDesc || daily.mutator.summary || '';
    }
    if (btnPlayDaily) {
      btnPlayDaily.textContent = status.clearedToday ? '↻ REPLAY DAILY' : '▶ PLAY DAILY';
    }
    if (homeDailyStreakBadgeEl) {
      homeDailyStreakBadgeEl.textContent = status.clearedToday
        ? `✓ 🔥 ${status.activeStreak}d`
        : `🔥 ${status.activeStreak}d`;
    }
    if (btnOpenDailyCalendar) {
      btnOpenDailyCalendar.classList.toggle('cleared', status.clearedToday);
      btnOpenDailyCalendar.title = status.clearedToday
        ? `Daily Dive cleared today (${status.activeStreak}d streak) — open archive calendar or replay`
        : `Open Today’s Daily Dive (${daily.dateKey}) & Archive Calendar`;
    }
  }

  function renderDailyCalendarModal() {
    if (!dailyCalModalEl || !dailyCalGridEl) return;
    const book = loadCareerLogbook();
    const todayKey = getUtcDateKey();
    const cal = buildDailyCalendarMonth(book, dailyCalYear, dailyCalMonth0, todayKey);
    const status = getDailyStatus(book, todayKey);

    if (dailyCalMonthLabelEl) dailyCalMonthLabelEl.textContent = cal.monthLabel;
    if (dailyCalStatsEl) {
      dailyCalStatsEl.textContent =
        `🔥 ${status.activeStreak}d Streak · 🏆 Best ${status.bestStreak}d · ✅ ${cal.clearedInMonth}/${cal.availableInMonth} this month (${status.totalClears} total)`;
    }
    if (btnDailyCalNext) {
      const todayY = Number(todayKey.slice(0, 4));
      const todayM0 = Number(todayKey.slice(5, 7)) - 1;
      btnDailyCalNext.disabled = cal.year > todayY || (cal.year === todayY && cal.month0 >= todayM0);
    }

    let html = '';
    for (let s = 0; s < cal.firstWeekday; s++) {
      html += '<div class="daily-cal-spacer" aria-hidden="true"></div>';
    }
    for (const cell of cal.days) {
      const classes = ['daily-cal-cell'];
      if (cell.cleared) classes.push('cleared');
      if (cell.isToday) classes.push('today');
      if (cell.isFuture) classes.push('future');
      if (cell.dateKey === dailyCalSelectedKey) classes.push('selected');
      const sub = cell.isFuture ? '🔒' : cell.cleared ? (cell.grade || '✓') : cell.isToday ? 'NOW' : '·';
      html +=
        `<button type="button" class="${classes.join(' ')}" data-cal-date="${cell.dateKey}"` +
        (cell.isFuture ? ' disabled' : '') +
        ` aria-label="${cell.dateKey}${cell.cleared ? ' cleared' : ''}">` +
        `<span>${cell.day}</span><span class="daily-cal-cell-sub">${sub}</span></button>`;
    }
    dailyCalGridEl.innerHTML = html;

    const selKey = dailyCalSelectedKey <= todayKey ? dailyCalSelectedKey : todayKey;
    dailyCalSelectedKey = selKey;
    const daily = getDailyGeneratedExpedition(selKey);
    const rec = book.daily?.records?.[selKey] || null;
    const depthM = daily.level?.proceduralMeta?.targetDepthM || getLevelMaxDepthM(daily.level);
    const isTodaySel = selKey === todayKey;
    if (dailyCalSelTitleEl) {
      dailyCalSelTitleEl.textContent = `${isTodaySel ? 'Today · ' : ''}${selKey} · ${daily.level.name}`;
    }
    if (dailyCalSelBadgeEl && daily.mutator) {
      dailyCalSelBadgeEl.textContent = `${daily.mutator.icon} ${daily.mutator.name}`;
    }
    if (dailyCalSelMetaEl) {
      const gasName = daily.level.gasOverrides?.TMX1455?.name || 'TMX 14/55';
      dailyCalSelMetaEl.textContent =
        `Seed #${daily.seed} · ${daily.biomeSpec.label} · ${depthM}m (${gasName})${daily.unlined ? ' · 🧵 Unlined Reel' : ' · Fixed Line'} — ${daily.mutator.summary || ''}`;
    }
    if (dailyCalSelRecordEl) {
      dailyCalSelRecordEl.textContent = rec
        ? `✅ Cleared · Grade ${rec.grade} · Best Score ${rec.score.toLocaleString()} · Time ${formatRunClock(rec.timeSec || 0)}`
        : isTodaySel
          ? 'Not cleared yet — clear today to grow your streak!'
          : 'Archive Expedition — dive anytime to earn its calendar checkmark!';
    }
    if (btnDailyCalLaunch) {
      btnDailyCalLaunch.textContent = rec
        ? `↻ Replay ${selKey}`
        : isTodaySel
          ? '▶ Dive Today’s Daily Sump'
          : `▶ Dive Archive (${selKey})`;
    }
  }

  function openDailyCalendarModal() {
    if (!dailyCalModalEl) return;
    setHomeMenuOpen(false);
    const todayKey = getUtcDateKey();
    dailyCalYear = Number(todayKey.slice(0, 4));
    dailyCalMonth0 = Number(todayKey.slice(5, 7)) - 1;
    dailyCalSelectedKey = todayKey;
    renderDailyChallengeCard();
    renderDailyCalendarModal();
    dailyCalModalEl.hidden = false;
  }

  function closeDailyCalendarModal() {
    if (dailyCalModalEl) dailyCalModalEl.hidden = true;
  }

  btnOpenDailyCalendar?.addEventListener('click', openDailyCalendarModal);
  btnDailyCalClose?.addEventListener('click', closeDailyCalendarModal);
  dailyCalModalEl?.addEventListener('click', (e) => {
    if (e.target === dailyCalModalEl) closeDailyCalendarModal();
  });
  btnDailyCalPrev?.addEventListener('click', () => {
    dailyCalMonth0 -= 1;
    if (dailyCalMonth0 < 0) {
      dailyCalMonth0 = 11;
      dailyCalYear -= 1;
    }
    renderDailyCalendarModal();
  });
  btnDailyCalNext?.addEventListener('click', () => {
    dailyCalMonth0 += 1;
    if (dailyCalMonth0 > 11) {
      dailyCalMonth0 = 0;
      dailyCalYear += 1;
    }
    renderDailyCalendarModal();
  });
  dailyCalGridEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cal-date]');
    if (!btn || btn.disabled) return;
    dailyCalSelectedKey = btn.dataset.calDate;
    renderDailyCalendarModal();
  });
  btnDailyCalLaunch?.addEventListener('click', () => {
    const daily = getDailyGeneratedExpedition(dailyCalSelectedKey);
    closeDailyCalendarModal();
    launchDailyChallenge(daily);
  });

  return {
    dailyCalModalEl,
    btnPlayDaily,
    getDailyGeneratedExpedition,
    renderDailyChallengeCard,
    renderDailyCalendarModal,
    openDailyCalendarModal,
    closeDailyCalendarModal,
  };
}
