import { escapeHtml } from '../util/common.js';
import { LEVELS, getLevelById, getLevelMaxDepthM, getLevelMeta } from '../levels/index.js';
import {
  formatLogbookSummary,
  computeCertifications,
  getDailyChallenge,
  getDailyMutatorById,
} from '../game/logbookModel.js';

export function formatLbDate(ts) {
  if (!Number.isFinite(Number(ts)) || Number(ts) <= 0) return 'Recorded Dive';
  try {
    return new Date(Number(ts)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recorded Dive';
  }
}

export function getRecentUtcDateKeys(count = 7) {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/**
 * Leaderboard rendering, stats detail modal, site/date filters & career summary bar (modularized v172).
 */
export function createLeaderboardController({
  github,
  leaderboard,
  loadCareerLogbook,
  getActiveLevel,
  getDifficultyMeta,
  renderModeBadgeHtml,
  formatRunClock,
  getLbMode,
  getLbFilterLevelId,
  setLbFilterLevelId,
  els,
}) {
  const {
    lbStatsModalEl,
    lbStatsBodyEl,
    lbStatsKickerEl,
    lbStatsTitleEl,
    lbStatsSubEl,
    lbCareerSummaryEl,
    selectLbSite,
    leaderboardRowsEl,
    leaderboardSubEl,
  } = els;

  let lastMenuLbEntries = [];
  let lastDebriefLbEntries = [];
  let lbStatsCloseTimer = 0;

  function closeLeaderboardStatsModal() {
    if (!lbStatsModalEl || lbStatsModalEl.hidden) return;
    clearTimeout(lbStatsCloseTimer);
    lbStatsModalEl.classList.add('is-closing');
    lbStatsCloseTimer = setTimeout(() => {
      lbStatsCloseTimer = 0;
      lbStatsModalEl.classList.remove('is-closing');
      lbStatsModalEl.hidden = true;
    }, 190);
  }

  function openLeaderboardStatsModal(entry, rankNum = 1) {
    if (!entry || !lbStatsModalEl || !lbStatsBodyEl) return;
    clearTimeout(lbStatsCloseTimer);
    lbStatsCloseTimer = 0;
    lbStatsModalEl.classList.remove('is-closing');
    const isOverall = entry.levelId === 'overall';
    const isDaily = entry.mode === 'daily';
    const lvl = !isOverall ? getLevelById(entry.levelId) : null;
    const lvlIdx = lvl ? LEVELS.findIndex((l) => l.id === lvl.id) + 1 : 0;
    const meta = lvl ? getLevelMeta(lvl, Math.max(0, lvlIdx - 1)) : null;
    const modeLabel = entry.mode === 'team' ? 'CO-OP TEAM' : isDaily ? 'DAILY EXPEDITION' : 'SOLO DIVER';
    const dailyMut = entry.mutatorId ? getDailyMutatorById(entry.mutatorId) : null;
    const siteTitle = isOverall
      ? isDaily
        ? `All-Time Daily Champions (${entry.sitesCompleted || 0} Daily Clears)`
        : `Overall Campaign (${entry.sitesCompleted || 0}/${entry.totalSites || LEVELS.length} Sites)`
      : isDaily && entry.dailyDateKey
        ? `Daily ${entry.dailyDateKey} · L${lvlIdx}: ${lvl?.name || entry.levelId}`
        : `L${lvlIdx}: ${lvl?.name || entry.levelId}`;

    if (lbStatsKickerEl) {
      lbStatsKickerEl.textContent = `${modeLabel} · RANK #${rankNum}`;
    }
    if (lbStatsTitleEl) {
      lbStatsTitleEl.textContent = entry.displayName || 'Diver';
    }
    if (lbStatsSubEl) {
      const regionPart = meta?.region ? ` · ${meta.region}` : '';
      const mutPart = dailyMut ? ` · ${dailyMut.icon} ${dailyMut.shortName}` : '';
      lbStatsSubEl.textContent = `${siteTitle}${regionPart}${mutPart} · ${formatLbDate(entry.createdAt)}`;
    }

    const st = entry.stats || null;
    const entryDiff = entry.difficulty || st?.difficulty || '';
    const entryDiffMeta = getDifficultyMeta(entryDiff);
    const collectMax = entry.collectiblesTotal ?? (lvl?.collectibles?.length || 0);
    const cells = [
      ['Dive Time', formatRunClock(entry.timeSec || 0)],
      ['Cave Explored', `${entry.exploredPct ?? 0}%`],
      ['Collectables', `${entry.collectiblesFound ?? 0} / ${collectMax}`],
      [
        isOverall ? 'Sites Cleared' : 'Max Depth',
        isOverall
          ? `${entry.sitesCompleted || 0} / ${entry.totalSites || LEVELS.length}`
          : `${(st?.maxDepthM ?? meta?.maxDepthM ?? getLevelMaxDepthM(lvl)).toFixed?.(1) ?? (st?.maxDepthM ?? meta?.maxDepthM)} m`,
      ],
    ];
    if (entryDiffMeta) cells.unshift(['Dive Mode', entryDiffMeta.fullBadge]);
    if (st?.avgHealthPct !== undefined) cells.push(['Avg Health', `${st.avgHealthPct}%`]);
    if (st?.avgSpeedPct !== undefined) cells.push(['Speed Rating', `${st.avgSpeedPct}%`]);
    if (st?.avgGasRemainingPct !== undefined) cells.push(['Gas Reserve', `${st.avgGasRemainingPct}%`]);
    if (st?.peakHeartRateBpm !== undefined) cells.push(['Peak Heart Rate', `${st.peakHeartRateBpm} BPM`]);
    if (st?.checkpointsHit !== undefined) {
      cells.push(['Checkpoints', `${st.checkpointsHit} / ${st.totalCheckpoints ?? (lvl?.checkpoints?.length || 0)}`]);
    }
    if (st?.eanBar !== undefined || st?.tmxBar !== undefined) {
      cells.push(['Tanks Left', `${st.eanBar ?? '-'} / ${st.tmxBar ?? '-'} / ${st.o2Bar ?? '-'}b`]);
    }

    let breakdownHtml = '';
    if (st && (st.healthScore !== undefined || st.speedScore !== undefined)) {
      const barRows = [
        { label: 'Survival & Health', pts: st.healthScore || 0, pct: Math.round(((st.healthScore || 0) / 1000) * 100), cls: 'green' },
        { label: `Speed (${formatRunClock(entry.timeSec || 0)})`, pts: st.speedScore || 0, pct: Math.round(((st.speedScore || 0) / 800) * 100), cls: '' },
        { label: `Collectables (${entry.collectiblesFound ?? 0}/${collectMax})`, pts: st.collectiblesScore || 0, pct: Math.round(((entry.collectiblesFound ?? 0) / Math.max(1, collectMax)) * 100), cls: 'gold' },
        { label: `Exploration (${entry.exploredPct ?? 0}%)`, pts: st.explorationScore || 0, pct: entry.exploredPct ?? 0, cls: 'purple' },
      ];
      if (st.rescueBonus > 0) {
        barRows.push({ label: 'Buddy Rescue', pts: st.rescueBonus, pct: 100, cls: 'gold' });
      }
      if (entry.mode === 'team' && st.teamSurvivalBonus !== undefined) {
        barRows.push({ label: 'Team Extraction', pts: st.teamSurvivalBonus, pct: st.teamSurvivalBonus > 0 ? 100 : 0, cls: 'green' });
      }
      breakdownHtml = `
      <div class="lb-stats-section">
        <div class="lb-stats-section-title">Score Breakdown</div>
        ${barRows
          .map(
            (r, idx) => `
          <div class="score-bar-row">
            <span class="score-bar-lbl">${escapeHtml(r.label)}</span>
            <div class="score-bar-track"><div class="score-bar-fill ${r.cls}" data-target-w="${Math.max(0, Math.min(100, r.pct))}%" style="width:0%;transition-delay:${idx * 70}ms"></div></div>
            <span class="score-bar-pts">+${r.pts}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
    }

    let crewHtml = '';
    if (Array.isArray(entry.crew) && entry.crew.length > 0 && (entry.teamSize > 1 || entry.crew[0]?.healthPct !== undefined)) {
      crewHtml = `
      <div class="lb-stats-section">
        <div class="lb-stats-section-title">${entry.teamSize > 1 ? `Dive Crew (${entry.teamSize} Divers)` : 'Diver Telemetry'}</div>
        ${entry.crew
          .map((m) => {
            const parts = [];
            if (m.healthPct !== undefined) parts.push(`${m.healthPct}% HP`);
            if (m.diveTimeSec !== undefined) parts.push(formatRunClock(m.diveTimeSec));
            if (m.gasRemainingPct !== undefined) parts.push(`${m.gasRemainingPct}% Gas`);
            const detail = m.alive === false ? (m.rescued ? '🛟 RESCUED' : 'DOWN') : parts.join(' · ') || 'Surfaced';
            return `
              <div class="team-roster-row">
                <strong>${escapeHtml(m.name)}</strong>
                <span>${escapeHtml(detail)}</span>
                <strong>${Number(m.score || 0).toLocaleString()} pts</strong>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
    }

    let siteRunsHtml = '';
    if (isOverall && Array.isArray(entry.siteRuns) && entry.siteRuns.length > 0) {
      siteRunsHtml = `
      <div class="lb-stats-section">
        <div class="lb-stats-section-title">Cleared Expedition Sites (${entry.siteRuns.length})</div>
        <div class="lb-stats-sitelist">
          ${entry.siteRuns
            .map((sr) => {
              const idx = LEVELS.findIndex((l) => l.id === sr.levelId) + 1;
              const name = getLevelById(sr.levelId)?.name || sr.levelId;
              const srModeBadge = renderModeBadgeHtml(sr.difficulty || sr.stats?.difficulty, { compact: true });
              return `
                <div class="lb-stats-siterow">
                  <span class="lb-name">L${Math.max(1, idx)}: ${escapeHtml(name)}</span>
                  <span class="lb-meta">${srModeBadge} ${formatRunClock(sr.timeSec)} · ${sr.exploredPct}%</span>
                  <span class="lb-grade">${escapeHtml(sr.grade)}</span>
                  <span class="lb-score">${Number(sr.score || 0).toLocaleString()}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
    }

    const legacyNote = !st && !isOverall ? '<div class="lb-stats-note">Detailed physiology & score breakdown is recorded on new dives completed in v81+.</div>' : '';

    const ghProfileBanner =
      entry.githubVerified && entry.githubLogin
        ? `
        <div class="lb-profile-banner">
          <div class="lb-profile-left">
            ${entry.githubAvatar ? `<img class="lb-profile-avatar" src="${escapeHtml(entry.githubAvatar)}" alt="" />` : ''}
            <div class="lb-profile-copy">
              <strong>✓ @${escapeHtml(entry.githubLogin)} · GitHub Verified Diver</strong>
              <span>Authenticated expedition record synced via GitHub</span>
            </div>
          </div>
          <a class="btn tiny secondary" href="https://github.com/${encodeURIComponent(entry.githubLogin)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </div>
      `
        : '';

    lbStatsBodyEl.innerHTML = `
    ${ghProfileBanner}
    <div class="lb-stats-hero">
      <div>
        <div class="lb-stats-score-lbl">Total Score</div>
        <div class="lb-stats-score-val">${Number(entry.score || 0).toLocaleString()}</div>
      </div>
      <div class="lb-stats-grade-pill">${escapeHtml(entry.grade || 'B')}</div>
    </div>
    <div class="lb-stats-grid">
      ${cells.map(([k, v]) => `<div class="lb-stats-cell"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}
    </div>
    ${breakdownHtml}
    ${crewHtml}
    ${siteRunsHtml}
    ${legacyNote}
  `;

    lbStatsModalEl.hidden = false;
    requestAnimationFrame(() => {
      for (const fill of lbStatsBodyEl.querySelectorAll('.score-bar-fill[data-target-w]')) {
        fill.style.width = fill.dataset.targetW || '0%';
      }
    });
  }

  function renderLeaderboardRowsHtml(entries, { highlightKey = '' } = {}) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return '<div class="lb-empty">No completed expeditions recorded here yet. Finish a dive to claim #1!</div>';
    }
    const myGhLogin = github.authenticated && github.user?.login ? github.user.login.toLowerCase() : '';
    return entries
      .map((e, i) => {
        const isMe =
          (highlightKey && e.entryKey === highlightKey) ||
          (e.playerId && e.playerId === leaderboard.playerId) ||
          (myGhLogin && e.githubVerified && String(e.githubLogin || '').toLowerCase() === myGhLogin);
        const teamTag = e.teamSize > 1 ? ` · ${e.teamSize}P` : '';
        const rowModeBadge = renderModeBadgeHtml(e.difficulty || e.stats?.difficulty, { compact: true });
        const ghAvatarHtml =
          e.githubVerified && e.githubAvatar
            ? `<img class="lb-gh-avatar" src="${escapeHtml(e.githubAvatar)}" alt="" />`
            : '';
        const ghBadgeHtml =
          e.githubVerified && e.githubLogin
            ? `<span class="lb-gh-badge" title="GitHub Verified Diver">✓ @${escapeHtml(e.githubLogin)}</span>`
            : '';
        const mutMeta = e.mode === 'daily' && e.mutatorId ? getDailyMutatorById(e.mutatorId) : null;
        const mutPillHtml = mutMeta
          ? `<span class="lb-mutator-pill">${mutMeta.icon} ${escapeHtml(mutMeta.shortName)}</span>`
          : '';
        return `
        <button type="button" class="lb-row ${isMe ? 'me' : ''}" style="--row-i:${i}" data-lb-idx="${i}" title="View diver profile &amp; full dive stats">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name"><span class="lb-name-wrap">${ghAvatarHtml}<span>${escapeHtml(e.displayName)}</span><small class="lb-meta">${teamTag}</small>${ghBadgeHtml}${mutPillHtml}${rowModeBadge}</span></span>
          <span class="lb-meta">${formatRunClock(e.timeSec)} · ${e.exploredPct}%</span>
          <span class="lb-grade">${escapeHtml(e.grade)}</span>
          <span class="lb-score">${Number(e.score || 0).toLocaleString()}</span>
          <span class="lb-chevron" aria-hidden="true">›</span>
        </button>
      `;
      })
      .join('');
  }

  function renderCareerSummary() {
    if (!lbCareerSummaryEl) return;
    const book = loadCareerLogbook();
    const s = formatLogbookSummary(book, LEVELS.length);
    const certInfo = computeCertifications(book, LEVELS);
    const certLabel = certInfo.highest ? `${certInfo.highest.icon} ${certInfo.highest.title}` : s.campaignMedal;
    lbCareerSummaryEl.hidden = false;
    lbCareerSummaryEl.innerHTML = `
    <div class="lb-career-cell"><span>Sites</span><strong>${s.clearedCount}/${s.totalSites}</strong></div>
    <div class="lb-career-cell"><span>Dives</span><strong>${s.totalDives}</strong></div>
    <div class="lb-career-cell"><span>Deepest</span><strong>${s.deepestM.toFixed(0)}m</strong></div>
    <div class="lb-career-cell"><span>Cert</span><strong>${escapeHtml(certLabel)}</strong></div>
  `;
  }

  function populateLbSiteSelect() {
    if (!selectLbSite) return;
    const lbMode = getLbMode();
    let lbFilterLevelId = getLbFilterLevelId();
    const activeLevel = getActiveLevel();
    if (lbMode === 'daily') {
      const recentDates = getRecentUtcDateKeys(7);
      const dateOpts = recentDates.map((dk, idx) => {
        const ch = getDailyChallenge(LEVELS, dk);
        const dayTag = idx === 0 ? 'Today' : idx === 1 ? 'Yesterday' : dk;
        return `<option value="${dk}">📅 ${dayTag} (${dk}) · ${ch.level.name} · ${ch.mutator.icon} ${ch.mutator.shortName}</option>`;
      });
      selectLbSite.innerHTML = [
        ...dateOpts,
        `<option value="overall">🏆 All-Time Daily Champions</option>`,
      ].join('');
      if (!lbFilterLevelId || (lbFilterLevelId !== 'overall' && !/^\d{4}-\d{2}-\d{2}$/.test(lbFilterLevelId))) {
        lbFilterLevelId = recentDates[0];
        setLbFilterLevelId(lbFilterLevelId);
      }
      selectLbSite.value = lbFilterLevelId;
      return;
    }
    const opts = [
      `<option value="overall">🌐 All ${LEVELS.length} Sites (Overall)</option>`,
      ...LEVELS.map((lvl, idx) => `<option value="${lvl.id}">L${idx + 1}: ${lvl.name} (${getLevelMaxDepthM(lvl)}m)</option>`),
    ];
    selectLbSite.innerHTML = opts.join('');
    if (!lbFilterLevelId || /^\d{4}-\d{2}-\d{2}$/.test(lbFilterLevelId)) {
      lbFilterLevelId = activeLevel.id;
      setLbFilterLevelId(lbFilterLevelId);
    }
    selectLbSite.value = lbFilterLevelId || activeLevel.id;
  }

  async function refreshMenuLeaderboard() {
    renderCareerSummary();
    if (!leaderboardRowsEl || !leaderboardSubEl) return;
    populateLbSiteSelect();
    const lbMode = getLbMode();
    const activeLevel = getActiveLevel();
    const targetLevel = getLbFilterLevelId() || (lbMode === 'daily' ? getRecentUtcDateKeys(1)[0] : activeLevel.id);
    if (selectLbSite) selectLbSite.value = targetLevel;
    leaderboardSubEl.textContent = 'Syncing rankings...';
    const board = await leaderboard.fetchBoard({ mode: lbMode, levelId: targetLevel, limit: 20 });
    const modeLabel = lbMode === 'team' ? 'Co-op Teams' : lbMode === 'daily' ? 'Daily Expedition' : 'Individual Divers';
    let scopeLabel = '';
    if (lbMode === 'daily') {
      if (targetLevel === 'overall') {
        scopeLabel = 'All-Time Daily Champions';
      } else {
        const ch = getDailyChallenge(LEVELS, targetLevel);
        scopeLabel = `${targetLevel} · ${ch.level.name} (${ch.mutator.icon} ${ch.mutator.shortName})`;
      }
    } else {
      const lvlIdx = LEVELS.findIndex((l) => l.id === targetLevel);
      scopeLabel =
        targetLevel === 'overall'
          ? `Overall Campaign (All ${LEVELS.length} Sites)`
          : `L${Math.max(1, lvlIdx + 1)}: ${getLevelById(targetLevel).name}`;
    }
    const originNote =
      board.source === 'global'
        ? (board.pendingSync > 0 ? `Global Rankings (${board.pendingSync} pending sync)` : 'Global Rankings')
        : 'Local Device Records (auto-syncs when online)';
    leaderboardSubEl.textContent = `${modeLabel} · ${scopeLabel} · ${originNote}`;
    lastMenuLbEntries = board.entries || [];
    leaderboardRowsEl.innerHTML = renderLeaderboardRowsHtml(lastMenuLbEntries);
  }

  return {
    closeLeaderboardStatsModal,
    openLeaderboardStatsModal,
    renderLeaderboardRowsHtml,
    renderCareerSummary,
    populateLbSiteSelect,
    refreshMenuLeaderboard,
    getLastMenuEntries: () => lastMenuLbEntries,
    getLastDebriefEntries: () => lastDebriefLbEntries,
    setLastDebriefEntries(entries) {
      lastDebriefLbEntries = entries || [];
    },
  };
}
