import { escapeHtml } from '../util/common.js';
import { LEVELS } from '../levels/index.js';
import {
  mergeCareerLogbooks,
  normalizeGhostTrack,
  formatLogbookSummary,
  computeUnlockedGear,
  sanitizeGearLoadout,
} from '../game/logbookModel.js';
import { computeUnlockedLiveries, sanitizeRigLivery } from '../game/rigLivery.js';
import { buildPrefilledIssueUrl } from '../net/githubClient.js';
import { WRECK_LEVEL_ID_SET, LIVERY_SLOTS_KEY, SQUAD_UNIFORM_KEY } from './liveryWorkshopController.js';

function getCurrentAppVersionLabel() {
  const ver = document.querySelector('meta[name="app-version"]')?.getAttribute('content');
  return ver ? `v${ver}` : 'v172';
}

function formatSyncTimeLabel(isoStr) {
  if (!isoStr) return 'Private Gist ready';
  try {
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return 'Private Gist synced';
    return `Synced ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return 'Private Gist synced';
  }
}

/**
 * GitHub OAuth account UI, Private Gist career/ghost cloud sync & Direct Issue Reporter (v115–v116 / modularized v172).
 */
export function createGitHubSyncController({
  github,
  urlParams,
  prefKeys,
  loadCareerLogbook,
  saveCareerLogbook,
  loadGhostTrack,
  saveGhostTrack,
  refreshActiveGhostTrack,
  liveryWorkshop,
  getEnteredCallsign,
  sanitizeCallsignInput,
  syncCallsignCount,
  playerNameInput,
  getActiveLevel,
  getSession,
  getMode,
  getIsMultiplayer,
  getActiveDifficulty,
  setActiveDifficulty,
  getGhostEnabled,
  setGhostEnabled,
  getTorchStickEnabled,
  setTorchStickEnabled,
  getSavedGearLoadout,
  setSavedGearLoadout,
  saveGearLoadout,
  syncPreferenceMenuButtons,
  syncLiveryUi,
  renderCareerSummary,
  renderTechGearDock,
  renderDailyChallengeCard,
  renderLevelCards,
  modalLogbook,
  openLogbookModal,
  closeLogbookModal,
  setHomeMenuOpen,
  setHudMenuOpen,
  setDivePaused,
  showToast,
}) {
  const btnGithubAccount = document.getElementById('btn-github-account');
  const ghAccountAvatarEl = document.getElementById('gh-account-avatar');
  const ghAccountLabelEl = document.getElementById('gh-account-label');
  const ghSyncDotEl = document.getElementById('gh-sync-dot');
  const logbookGithubBarEl = document.getElementById('logbook-github-bar');
  const btnOpenIssue = document.getElementById('btn-open-issue');
  const btnHudIssue = document.getElementById('btn-hud-issue');
  const modalIssue = document.getElementById('issue-modal');
  const btnIssueClose = document.getElementById('btn-issue-close');
  const issueModalSubEl = document.getElementById('issue-modal-sub');
  const issueKindTabsEl = document.getElementById('issue-kind-tabs');
  const issueTitleInput = document.getElementById('issue-title-input');
  const issueDescInput = document.getElementById('issue-desc-input');
  const issueAttachDiagInput = document.getElementById('issue-attach-diag');
  const issueDiagPreviewEl = document.getElementById('issue-diag-preview');
  const issueResultEl = document.getElementById('issue-result');
  const btnIssueSubmit = document.getElementById('btn-issue-submit');
  const btnIssueOpenGh = document.getElementById('btn-issue-open-gh');

  let activeIssueKind = 'bug';
  let ghSyncDebounceTimer = 0;

  function buildCurrentPrefsForSync() {
    const prefs = {
      difficulty: getActiveDifficulty(),
      gear: { ...getSavedGearLoadout() },
      ghostEnabled: Boolean(getGhostEnabled()),
      torchStickEnabled: Boolean(getTorchStickEnabled()),
      livery: { ...liveryWorkshop.getActiveRigLivery() },
      liverySlots: liveryWorkshop.getSavedLiverySlots().map((s) => (s ? { ...s } : null)),
      aiSquadTeamUniform: Boolean(liveryWorkshop.getAiSquadTeamUniform()),
    };
    const callsign = getEnteredCallsign();
    if (callsign) prefs.playerName = callsign;
    return prefs;
  }

  function collectLocalGhostTracks() {
    const out = {};
    for (const lvl of LEVELS) {
      const raw = loadGhostTrack(lvl.id);
      if (!raw) continue;
      const compact = normalizeGhostTrack(raw, 360);
      if (compact) out[lvl.id] = compact;
    }
    return out;
  }

  function applyMergedGhostTracks(mergedGhosts) {
    if (!mergedGhosts || typeof mergedGhosts !== 'object') return 0;
    let updated = 0;
    for (const [lid, track] of Object.entries(mergedGhosts)) {
      const clean = normalizeGhostTrack(track, 360);
      if (!clean) continue;
      const local = loadGhostTrack(lid);
      const localDur = local && local.length >= 2 ? local[local.length - 1][0] : Infinity;
      const cloudDur = clean[clean.length - 1][0];
      if (!local || (cloudDur > 0 && cloudDur < localDur)) {
        saveGhostTrack(lid, clean);
        updated += 1;
      }
    }
    if (updated > 0) {
      refreshActiveGhostTrack(getSession()?.level || getActiveLevel());
    }
    return updated;
  }

  function renderGitHubAccountUi() {
    const st = github.getStatus();
    if (btnGithubAccount) {
      btnGithubAccount.classList.toggle('connected', st.authenticated);
      const markSvg = btnGithubAccount.querySelector('.gh-mark-svg');
      if (st.authenticated && st.user) {
        if (markSvg) markSvg.hidden = Boolean(st.user.avatarUrl);
        if (ghAccountAvatarEl) {
          if (st.user.avatarUrl) {
            ghAccountAvatarEl.src = st.user.avatarUrl;
            ghAccountAvatarEl.hidden = false;
          } else {
            ghAccountAvatarEl.hidden = true;
          }
        }
        if (ghAccountLabelEl) ghAccountLabelEl.textContent = `@${st.user.login}`;
        if (ghSyncDotEl) {
          ghSyncDotEl.hidden = false;
          ghSyncDotEl.classList.toggle('syncing', st.syncing);
          ghSyncDotEl.title = st.syncing ? 'Syncing Private Gist...' : formatSyncTimeLabel(st.lastSyncedAt);
        }
        btnGithubAccount.title = `Signed in as @${st.user.login} · ${formatSyncTimeLabel(st.lastSyncedAt)} (Open Logbook)`;
      } else {
        if (markSvg) markSvg.hidden = false;
        if (ghAccountAvatarEl) ghAccountAvatarEl.hidden = true;
        if (ghAccountLabelEl) ghAccountLabelEl.textContent = st.configured ? 'Sign in' : 'GitHub';
        if (ghSyncDotEl) ghSyncDotEl.hidden = true;
        btnGithubAccount.title = st.configured
          ? 'Sign in with GitHub to cloud-save stats via Private Gist & submit issues'
          : 'Open GitHub Cloud Save & Issue Reporter';
      }
    }

    if (logbookGithubBarEl) {
      logbookGithubBarEl.classList.toggle('connected', st.authenticated);
      if (st.authenticated && st.user) {
        const syncMeta = st.syncing ? 'Syncing private Gist...' : formatSyncTimeLabel(st.lastSyncedAt);
        const ghostMeta = st.ghostCount > 0 ? ` · ${st.ghostCount} PB ghost${st.ghostCount === 1 ? '' : 's'}` : '';
        const gistLink = st.gistUrl
          ? `<a class="btn tiny ghost" href="${escapeHtml(st.gistUrl)}" target="_blank" rel="noopener noreferrer">Gist ↗</a>`
          : '';
        logbookGithubBarEl.innerHTML = `
        <div class="logbook-gh-left">
          ${st.user.avatarUrl ? `<img class="logbook-gh-avatar" src="${escapeHtml(st.user.avatarUrl)}" alt="" />` : ''}
          <div class="logbook-gh-copy">
            <strong>🐙 @${escapeHtml(st.user.login)} · Cloud Save Active</strong>
            <span>${escapeHtml(syncMeta)}${escapeHtml(ghostMeta)} · Private Gist sync across devices</span>
          </div>
        </div>
        <div class="logbook-gh-actions">
          <button type="button" class="btn tiny secondary" data-gh-action="sync" ${st.syncing ? 'disabled' : ''}>${st.syncing ? 'Syncing...' : '☁ Sync Now'}</button>
          ${gistLink}
          <button type="button" class="btn tiny ghost" data-gh-action="issue">🐛 Issue</button>
          <button type="button" class="btn tiny ghost" data-gh-action="logout">Sign Out</button>
        </div>
      `;
      } else if (st.configured) {
        logbookGithubBarEl.innerHTML = `
        <div class="logbook-gh-left">
          <div class="logbook-gh-copy">
            <strong>☁ Sync Your Dive Career with GitHub</strong>
            <span>Save clears, Field Guide &amp; streaks in your own Private Gist + submit issues directly.</span>
          </div>
        </div>
        <div class="logbook-gh-actions">
          <button type="button" class="btn tiny primary" data-gh-action="login">Sign in with GitHub</button>
          <button type="button" class="btn tiny ghost" data-gh-action="issue">🐛 Report Issue</button>
        </div>
      `;
      } else {
        logbookGithubBarEl.innerHTML = `
        <div class="logbook-gh-left">
          <div class="logbook-gh-copy">
            <strong>🐙 GitHub Cloud Save &amp; Issues</strong>
            <span>Add GITHUB_CLIENT_ID &amp; GITHUB_CLIENT_SECRET in Vercel to enable 1-click OAuth Gist sync.</span>
          </div>
        </div>
        <div class="logbook-gh-actions">
          <button type="button" class="btn tiny secondary" data-gh-action="issue">🐛 Report Issue</button>
        </div>
      `;
      }
    }

    if (btnIssueSubmit) {
      if (st.authenticated && st.user) {
        btnIssueSubmit.textContent = `Submit as @${st.user.login}`;
        btnIssueSubmit.hidden = false;
      } else if (st.configured) {
        btnIssueSubmit.textContent = 'Sign in with GitHub to Submit';
        btnIssueSubmit.hidden = false;
      } else {
        btnIssueSubmit.hidden = true;
      }
    }
    if (issueModalSubEl) {
      issueModalSubEl.textContent =
        st.authenticated && st.user
          ? `Signed in as @${st.user.login} — submits directly to ${st.repo}`
          : `Sign in with GitHub to submit directly, or open a pre-filled issue on ${st.repo}`;
    }
  }

  async function syncCareerStatsWithGitHub({ quiet = true } = {}) {
    if (!github.authenticated) return { ok: false };
    renderGitHubAccountUi();
    const localBook = loadCareerLogbook();
    const localGhosts = collectLocalGhostTracks();
    const res = await github.syncStats(localBook, buildCurrentPrefsForSync(), localGhosts);
    if (res.ok && res.logbook) {
      const merged = mergeCareerLogbooks(localBook, res.logbook);
      saveCareerLogbook(merged, { skipCloudSync: true });
      applyMergedGhostTracks(res.ghosts);

      const prefs = res.prefs || {};
      if (!getEnteredCallsign() && (prefs.playerName || github.user?.login)) {
        const nextName = sanitizeCallsignInput(prefs.playerName || github.user?.login || '');
        if (nextName && playerNameInput) {
          playerNameInput.value = nextName;
          syncCallsignCount();
          try {
            localStorage.setItem('caveDiverCallsign', nextName);
          } catch {}
        }
      }
      try {
        if (prefs.gear && !localStorage.getItem(prefKeys.gear)) {
          const { unlockedIds } = computeUnlockedGear(merged, LEVELS);
          setSavedGearLoadout(sanitizeGearLoadout(prefs.gear, unlockedIds));
          saveGearLoadout({ skipCloudSync: true });
        }
        if (
          (prefs.difficulty === 'guided' || prefs.difficulty === 'standard' || prefs.difficulty === 'hardcore') &&
          !localStorage.getItem(prefKeys.difficulty)
        ) {
          setActiveDifficulty(prefs.difficulty);
          localStorage.setItem(prefKeys.difficulty, prefs.difficulty);
        }
        if (typeof prefs.ghostEnabled === 'boolean' && localStorage.getItem(prefKeys.ghost) === null) {
          setGhostEnabled(prefs.ghostEnabled);
          localStorage.setItem(prefKeys.ghost, prefs.ghostEnabled ? '1' : '0');
        }
        if (typeof prefs.torchStickEnabled === 'boolean' && localStorage.getItem(prefKeys.torchStick) === null) {
          setTorchStickEnabled(prefs.torchStickEnabled);
          localStorage.setItem(prefKeys.torchStick, prefs.torchStickEnabled ? '1' : '0');
        }
        if (prefs.livery && typeof prefs.livery === 'object' && !localStorage.getItem(prefKeys.livery)) {
          liveryWorkshop.setActiveRigLivery(
            sanitizeRigLivery(prefs.livery, computeUnlockedLiveries(merged, WRECK_LEVEL_ID_SET)),
            { skipCloudSync: true }
          );
        } else {
          liveryWorkshop.reconcileActiveRigLiveryFromStorage();
        }
        if (Array.isArray(prefs.liverySlots) && !localStorage.getItem(LIVERY_SLOTS_KEY)) {
          liveryWorkshop.setSavedLiverySlots(
            [0, 1, 2].map((i) =>
              prefs.liverySlots[i] && typeof prefs.liverySlots[i] === 'object' ? { ...prefs.liverySlots[i] } : null
            ),
            { skipCloudSync: true }
          );
        }
        if (typeof prefs.aiSquadTeamUniform === 'boolean' && localStorage.getItem(SQUAD_UNIFORM_KEY) === null) {
          liveryWorkshop.setAiSquadTeamUniform(prefs.aiSquadTeamUniform);
        }
      } catch {}

      syncPreferenceMenuButtons();
      syncLiveryUi();
      renderCareerSummary();
      renderTechGearDock();
      renderDailyChallengeCard();
      renderLevelCards();
      if (modalLogbook && !modalLogbook.hidden) {
        openLogbookModal();
      }
      if (!quiet) {
        const gCount = Object.keys(res.ghosts || {}).length;
        const gTxt = gCount > 0 ? ` + ${gCount} PB ghost${gCount === 1 ? '' : 's'}` : '';
        showToast(`☁ Synced career stats${gTxt} to @${github.user?.login}'s Private Gist!`, 2.8);
      }
    } else if (!quiet && res.error) {
      showToast(res.error, 3.0);
    }
    renderGitHubAccountUi();
    return res;
  }

  function scheduleGitHubStatsSync() {
    if (!github.authenticated) return;
    if (ghSyncDebounceTimer) clearTimeout(ghSyncDebounceTimer);
    ghSyncDebounceTimer = setTimeout(() => {
      ghSyncDebounceTimer = 0;
      syncCareerStatsWithGitHub({ quiet: true });
    }, 900);
  }

  function triggerGitHubLogin() {
    if (!github.configured) {
      openLogbookModal();
      showToast('Set GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in Vercel to activate GitHub Sign-In.', 3.8);
      return;
    }
    window.location.href = github.getLoginUrl();
  }

  function collectIssueDiagnostics() {
    const book = loadCareerLogbook();
    const sum = formatLogbookSummary(book, LEVELS.length);
    const session = getSession();
    const lvl = session?.level || getActiveLevel();
    const diff = session?.difficulty || getActiveDifficulty();
    const vp = typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight} @${(window.devicePixelRatio || 1).toFixed(1)}x` : '';
    return {
      appVersion: getCurrentAppVersionLabel(),
      levelId: lvl?.id || '',
      levelName: lvl?.name || '',
      difficulty: diff,
      multiplayer: Boolean(getIsMultiplayer()),
      careerSummary: `${sum.clearedCount}/${sum.totalSites} cleared · ${sum.totalDives} dives · ${sum.deepestM.toFixed(0)}m max`,
      viewport: vp,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
  }

  function setIssueKind(kind) {
    activeIssueKind = kind === 'feature' || kind === 'feedback' ? kind : 'bug';
    if (issueKindTabsEl) {
      for (const btn of issueKindTabsEl.querySelectorAll('.issue-kind-btn')) {
        const active = btn.dataset.issueKind === activeIssueKind;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
      }
    }
    if (issueTitleInput) {
      issueTitleInput.placeholder =
        activeIssueKind === 'feature'
          ? 'Short feature title (e.g. Add dive log export)'
          : activeIssueKind === 'feedback'
            ? 'Short feedback summary'
            : 'Short bug summary (e.g. Co-op banner overlap on mobile)';
    }
  }

  function openIssueModal(defaultKind = 'bug') {
    if (!modalIssue) return;
    setHomeMenuOpen(false);
    setHudMenuOpen(false);
    setIssueKind(defaultKind);
    if (issueResultEl) {
      issueResultEl.hidden = true;
      issueResultEl.className = 'issue-result';
      issueResultEl.innerHTML = '';
    }
    const diag = collectIssueDiagnostics();
    if (issueDiagPreviewEl) {
      issueDiagPreviewEl.textContent = `${diag.appVersion} · ${diag.levelName || 'Menu'} · ${diag.multiplayer ? 'Co-op' : 'Solo'}`;
    }
    renderGitHubAccountUi();
    modalIssue.hidden = false;
    issueTitleInput?.focus();
  }

  function closeIssueModal() {
    if (modalIssue) modalIssue.hidden = true;
  }

  btnGithubAccount?.addEventListener('click', () => {
    setHomeMenuOpen(false);
    if (github.authenticated) {
      openLogbookModal();
    } else if (github.configured) {
      triggerGitHubLogin();
    } else {
      openLogbookModal();
    }
  });

  logbookGithubBarEl?.addEventListener('click', async (e) => {
    const actBtn = e.target.closest('button[data-gh-action]');
    if (!actBtn) return;
    const action = actBtn.dataset.ghAction;
    if (action === 'login') {
      triggerGitHubLogin();
    } else if (action === 'sync') {
      await syncCareerStatsWithGitHub({ quiet: false });
    } else if (action === 'logout') {
      await github.logout();
      renderGitHubAccountUi();
      showToast('Signed out of GitHub (local logbook preserved).', 2.4);
    } else if (action === 'issue') {
      closeLogbookModal();
      openIssueModal();
    }
  });

  btnOpenIssue?.addEventListener('click', () => openIssueModal('bug'));
  btnHudIssue?.addEventListener('click', () => {
    const session = getSession();
    if (getMode() === 'diving' && !getIsMultiplayer() && session && !session.endedState) {
      setDivePaused(true);
    }
    openIssueModal('bug');
  });
  btnIssueClose?.addEventListener('click', closeIssueModal);
  modalIssue?.addEventListener('click', (e) => {
    if (e.target === modalIssue) closeIssueModal();
  });
  issueKindTabsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.issue-kind-btn');
    if (btn?.dataset?.issueKind) setIssueKind(btn.dataset.issueKind);
  });

  btnIssueOpenGh?.addEventListener('click', () => {
    const title = issueTitleInput?.value.trim() || '';
    const description = issueDescInput?.value.trim() || '';
    const context = issueAttachDiagInput?.checked ? collectIssueDiagnostics() : {};
    const url = buildPrefilledIssueUrl({
      kind: activeIssueKind,
      title,
      description,
      context,
      repo: github.repo,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  btnIssueSubmit?.addEventListener('click', async () => {
    if (!github.authenticated) {
      triggerGitHubLogin();
      return;
    }
    const title = issueTitleInput?.value.trim() || '';
    const description = issueDescInput?.value.trim() || '';
    if (title.length < 3 || description.length < 5) {
      if (issueResultEl) {
        issueResultEl.hidden = false;
        issueResultEl.className = 'issue-result err';
        issueResultEl.textContent = 'Please enter a short title (3+ chars) and details (5+ chars).';
      }
      return;
    }
    btnIssueSubmit.disabled = true;
    btnIssueSubmit.textContent = 'Submitting...';
    const context = issueAttachDiagInput?.checked ? collectIssueDiagnostics() : {};
    const res = await github.submitIssue({
      kind: activeIssueKind,
      title,
      description,
      context,
    });
    btnIssueSubmit.disabled = false;
    renderGitHubAccountUi();

    if (res.ok && res.issue) {
      if (issueTitleInput) issueTitleInput.value = '';
      if (issueDescInput) issueDescInput.value = '';
      if (issueResultEl) {
        issueResultEl.hidden = false;
        issueResultEl.className = 'issue-result ok';
        issueResultEl.innerHTML = `✓ Issue <strong>#${escapeHtml(String(res.issue.number))}</strong> created! <a href="${escapeHtml(res.issue.url)}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>`;
      }
      showToast(`🐙 GitHub Issue #${res.issue.number} submitted!`, 3.2);
    } else {
      if (issueResultEl) {
        issueResultEl.hidden = false;
        issueResultEl.className = 'issue-result err';
        const fallback = res.fallbackUrl
          ? ` <a href="${escapeHtml(res.fallbackUrl)}" target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>`
          : '';
        issueResultEl.innerHTML = `${escapeHtml(res.error || 'Could not submit issue.')}${fallback}`;
      }
    }
  });

  async function initGitHubAuth() {
    const ghFlag = urlParams.get('gh');
    if (ghFlag && typeof history !== 'undefined' && typeof history.replaceState === 'function') {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('gh');
      history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    }
    await github.fetchSession();
    renderGitHubAccountUi();
    if (github.authenticated) {
      if (!getEnteredCallsign() && github.user?.login && playerNameInput) {
        const cleanName = sanitizeCallsignInput(github.user.name || github.user.login);
        if (cleanName) {
          playerNameInput.value = cleanName;
          syncCallsignCount();
          try {
            localStorage.setItem('caveDiverCallsign', cleanName);
          } catch {}
        }
      }
      await syncCareerStatsWithGitHub({ quiet: ghFlag !== 'connected' });
    } else if (ghFlag === 'not_configured') {
      showToast('GitHub OAuth not configured yet — add GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in Vercel.', 4.2);
    } else if (ghFlag && ghFlag !== 'connected') {
      showToast(`GitHub sign-in canceled or failed (${ghFlag}).`, 3.2);
    }
  }

  return {
    modalIssue,
    renderGitHubAccountUi,
    syncCareerStatsWithGitHub,
    scheduleGitHubStatsSync,
    triggerGitHubLogin,
    openIssueModal,
    closeIssueModal,
    initGitHubAuth,
  };
}
