import { escapeHtml } from '../util/common.js';
import { getGearTierMeta } from '../game/rigLivery.js';

let _svgUid = 0;
function _uid(prefix) {
  _svgUid = (_svgUid + 1) % 1000000;
  return `${prefix}${_svgUid}`;
}

/**
 * Renders crisp, image-focused inline SVG hardware illustrations for every gear slot,
 * color coating, and treasure map lead (v232).
 *
 * Pure string generator with unique gradient IDs per call so multiple cards never collide.
 */
export function renderGearArtworkSvg(slot, item, { suitFallback = null, size = 72 } = {}) {
  const tierMeta = getGearTierMeta(item?.tier);
  const glowCol = tierMeta.color || '#38bdf8';
  const isHighTier = tierMeta.rank >= 4;
  const isLegendary = tierMeta.id === 'legendary';
  const isMythic = tierMeta.id === 'mythic';
  const bgId = _uid('gbg');
  const rimAlpha = isLegendary ? 0.5 : isMythic ? 0.42 : isHighTier ? 0.3 : 0.16;

  let body = '';

  if (slot === 'suit') {
    const top = item?.suitTop || '#1e293b';
    const mid = item?.suitMid || '#0f172a';
    const bot = item?.suitBot || '#020617';
    const acc = item?.accent || '#38bdf8';
    const trim = item?.trim || '#7dd3fc';
    const gSuit = _uid('gsu');
    const isArmored = item?.id === 'legendary-aegis-exosuit' || item?.id === 'chest-bulwark-shell';
    const hasVeins = Boolean(item?.fx);
    body = `
      <defs>
        <linearGradient id="${gSuit}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${escapeHtml(top)}"/>
          <stop offset="55%" stop-color="${escapeHtml(mid)}"/>
          <stop offset="100%" stop-color="${escapeHtml(bot)}"/>
        </linearGradient>
      </defs>
      ${isArmored ? `<ellipse cx="40" cy="40" rx="28" ry="26" fill="none" stroke="${escapeHtml(trim)}" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.72"/>` : ''}
      <!-- Collar neck seal -->
      <rect x="33" y="10" width="14" height="6" rx="2.5" fill="#090d16" stroke="${escapeHtml(trim)}" stroke-width="1.1"/>
      <!-- Drysuit torso & sleeves -->
      <path d="M27 16 L53 16 L65 25 L60 35 L52 31 L50 54 L53 69 L42 69 L40 56 L38 69 L27 69 L30 54 L28 31 L20 35 L15 25 Z"
        fill="url(#${gSuit})" stroke="rgba(226,232,240,0.34)" stroke-width="1.2" stroke-linejoin="round"/>
      <!-- Heavy shoulder armor / technical panels -->
      <path d="M27 16 L34 18 L30 27 L19 28 L16 24 Z" fill="${escapeHtml(acc)}" opacity="0.9"/>
      <path d="M53 16 L46 18 L50 27 L61 28 L64 24 Z" fill="${escapeHtml(acc)}" opacity="0.9"/>
      <!-- Diagonal drysuit zipper & inflator valve -->
      <line x1="29" y1="22" x2="51" y2="30" stroke="${escapeHtml(trim)}" stroke-width="1.6" stroke-linecap="round" opacity="0.88"/>
      <circle cx="40" cy="31" r="3.4" fill="#0f172a" stroke="${escapeHtml(trim)}" stroke-width="1.4"/>
      <circle cx="40" cy="31" r="1.3" fill="${escapeHtml(acc)}"/>
      <!-- Technical harness straps & waist belt -->
      <path d="M33 17 L34 46 M47 17 L46 46" stroke="#090d16" stroke-width="2.2" opacity="0.72"/>
      <rect x="29" y="45" width="22" height="3.6" rx="1.2" fill="#0b1220" stroke="${escapeHtml(acc)}" stroke-width="0.9"/>
      <rect x="37.5" y="44.5" width="5" height="4.6" rx="1" fill="${escapeHtml(trim)}"/>
      <!-- Leg accent stripes -->
      <line x1="30" y1="57" x2="36" y2="57" stroke="${escapeHtml(trim)}" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="44" y1="57" x2="50" y2="57" stroke="${escapeHtml(trim)}" stroke-width="1.8" stroke-linecap="round"/>
      ${hasVeins ? `<path d="M32 37 L40 41 L48 37" fill="none" stroke="${escapeHtml(trim)}" stroke-width="1.3" opacity="0.9"/>` : ''}
    `;
  } else if (slot === 'trim') {
    const useSuit = item?.id === 'suit-default' && suitFallback;
    const cA = useSuit ? suitFallback.accent || '#38bdf8' : item?.swatchA || item?.accent || '#38bdf8';
    const cB = useSuit ? suitFallback.trim || '#7dd3fc' : item?.swatchB || item?.finTip || '#67e8f9';
    const gFin = _uid('gfn');
    const isSplit = /hydro|manta|slipstream/.test(item?.id || '');
    body = `
      <defs>
        <linearGradient id="${gFin}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${escapeHtml(cA)}"/>
          <stop offset="100%" stop-color="${escapeHtml(cB)}"/>
        </linearGradient>
      </defs>
      <!-- Rear technical dive fin -->
      <g transform="translate(27,40) rotate(-18) translate(-27,-40)">
        <path d="M21 58 L20 20 Q27 12 35 20 L33 58 Z" fill="#1e293b" stroke="${escapeHtml(cA)}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M23 23 L32 23 L30 44 L24 44 Z" fill="url(#${gFin})" opacity="0.65"/>
        <rect x="21" y="48" width="12" height="11" rx="4" fill="#0b1220" stroke="rgba(226,232,240,0.3)" stroke-width="1"/>
      </g>
      <!-- Foreground hero technical fin -->
      <g transform="translate(50,41) rotate(14) translate(-50,-41)">
        <path d="M41 62 L39 18 ${isSplit ? 'L47 13 L49 33 L51 13 L59 18' : 'Q50 10 61 18'} L58 62 Z"
          fill="#0f172a" stroke="${escapeHtml(cB)}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M43 22 ${isSplit ? 'L47 18 L48 39 L43 43 Z M52 39 L53 18 L57 22 L57 43 Z' : 'L57 22 L55 44 L45 44 Z'}"
          fill="url(#${gFin})" opacity="0.92"/>
        <!-- Jet vents -->
        <line x1="45" y1="45" x2="55" y2="45" stroke="#020617" stroke-width="2" stroke-linecap="round"/>
        <line x1="46" y1="49" x2="54" y2="49" stroke="#020617" stroke-width="2" stroke-linecap="round"/>
        <!-- Foot pocket + spring strap -->
        <rect x="42" y="51" width="16" height="12" rx="4.5" fill="#1e293b" stroke="${escapeHtml(cA)}" stroke-width="1.2"/>
        <path d="M43 63 Q50 68 57 63" fill="none" stroke="${escapeHtml(cB)}" stroke-width="1.6" stroke-linecap="round"/>
      </g>
    `;
  } else if (slot === 'headgear') {
    const id = item?.id || 'zissou-cap';
    const gHg = _uid('ghg');
    if (id === 'zissou-cap') {
      body = `
        <defs>
          <linearGradient id="${gHg}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f87171"/>
            <stop offset="60%" stop-color="#dc2626"/>
            <stop offset="100%" stop-color="#7f1d1d"/>
          </linearGradient>
        </defs>
        <path d="M18 46 C18 24 28 16 40 16 C52 16 62 24 62 46 Z" fill="url(#${gHg})" stroke="#fca5a5" stroke-width="1.2"/>
        <path d="M27 20 C27 32 27 40 27 45 M34 17 L34 45 M46 17 L46 45 M53 20 L53 45" stroke="#7f1d1d" stroke-width="1.3" opacity="0.5"/>
        <rect x="15" y="43" width="50" height="14" rx="6" fill="#b91c1c" stroke="#fca5a5" stroke-width="1.3"/>
        <path d="M23 44 L23 56 M31 44 L31 56 M40 44 L40 56 M49 44 L49 56 M57 44 L57 56" stroke="#7f1d1d" stroke-width="1.4" opacity="0.55"/>
        <circle cx="40" cy="15" r="4.5" fill="#ef4444" stroke="#fecaca" stroke-width="1.1"/>
      `;
    } else if (id === 'brass-hardhat' || id === 'secret-dreadnought-helm') {
      const isDread = id === 'secret-dreadnought-helm';
      body = `
        <defs>
          <linearGradient id="${gHg}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="48%" stop-color="#d97706"/>
            <stop offset="100%" stop-color="#78350f"/>
          </linearGradient>
        </defs>
        <!-- Breastplate collar -->
        <path d="M16 58 Q40 67 64 58 L60 50 L20 50 Z" fill="#92400e" stroke="#fde68a" stroke-width="1.2"/>
        <!-- Dome -->
        <path d="M20 50 C20 22 27 14 40 14 C53 14 60 22 60 50 Z" fill="url(#${gHg})" stroke="#fef08a" stroke-width="1.4"/>
        <!-- Front barred porthole -->
        <circle cx="40" cy="36" r="11.5" fill="${isDread ? '#f59e0b' : '#0c4a6e'}" stroke="#fef08a" stroke-width="2.2"/>
        <circle cx="40" cy="36" r="8.5" fill="${isDread ? '#fde047' : '#38bdf8'}" opacity="${isDread ? '0.88' : '0.55'}"/>
        <line x1="29" y1="36" x2="51" y2="36" stroke="#78350f" stroke-width="2"/>
        <line x1="40" y1="25" x2="40" y2="47" stroke="#78350f" stroke-width="2"/>
        <!-- Side rivets -->
        <circle cx="24" cy="54" r="1.5" fill="#fef08a"/>
        <circle cx="40" cy="57" r="1.5" fill="#fef08a"/>
        <circle cx="56" cy="54" r="1.5" fill="#fef08a"/>
      `;
    } else if (id === 'exo-mask' || id === 'world-halocline-mask') {
      const isHalo = id === 'world-halocline-mask';
      const lensCol = isHalo ? '#34d399' : '#38bdf8';
      body = `
        <defs>
          <linearGradient id="${gHg}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <path d="M20 34 C20 18 29 12 40 12 C51 12 60 18 60 34 L57 57 Q40 66 23 57 Z" fill="url(#${gHg})" stroke="${lensCol}" stroke-width="1.5"/>
        <!-- Panoramic visor -->
        <path d="M25 26 Q40 21 55 26 L53 45 Q40 49 27 45 Z" fill="#082f49" stroke="${lensCol}" stroke-width="1.6"/>
        <path d="M28 33 L52 33" stroke="${lensCol}" stroke-width="1.8" stroke-linecap="round" opacity="0.88"/>
        <path d="M29 29 L38 27" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>
        <!-- Regulator chin pod / filter canisters -->
        <rect x="33" y="49" width="14" height="10" rx="4" fill="#020617" stroke="${lensCol}" stroke-width="1.2"/>
        ${isHalo ? `<circle cx="22" cy="51" r="5" fill="#064e3b" stroke="#34d399" stroke-width="1.3"/><circle cx="58" cy="51" r="5" fill="#064e3b" stroke="#34d399" stroke-width="1.3"/>` : ''}
      `;
    } else if (id === 'cave-helmet' || id === 'abyss-halo-helm') {
      const isHalo = id === 'abyss-halo-helm';
      const acc = isHalo ? '#22d3ee' : '#facc15';
      body = `
        <defs>
          <linearGradient id="${gHg}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${isHalo ? '#475569' : '#334155'}"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        ${isHalo ? `<ellipse cx="40" cy="18" rx="26" ry="6" fill="none" stroke="#38bdf8" stroke-width="1.8" opacity="0.9"/>` : ''}
        <!-- Helmet shell -->
        <path d="M17 44 C17 22 27 14 40 14 C53 14 63 22 63 44 L59 50 L21 50 Z" fill="url(#${gHg})" stroke="${acc}" stroke-width="1.5"/>
        <!-- Twin side backup pods -->
        <rect x="11" y="34" width="8" height="10" rx="3" fill="#0f172a" stroke="${acc}" stroke-width="1.2"/>
        <circle cx="15" cy="39" r="2.2" fill="${acc}"/>
        <rect x="61" y="34" width="8" height="10" rx="3" fill="#0f172a" stroke="${acc}" stroke-width="1.2"/>
        <circle cx="65" cy="39" r="2.2" fill="${acc}"/>
        <!-- Front brow lamp & chin strap -->
        <rect x="33" y="23" width="14" height="6" rx="2.5" fill="#020617" stroke="${acc}" stroke-width="1.3"/>
        <line x1="36" y1="26" x2="44" y2="26" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M24 50 L32 63 L48 63 L56 50" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      `;
    } else {
      // Neoprene cave hood / thermal hood / stealth acoustic shroud
      const isThermal = id === 'world-thermal-hood';
      const isPhantom = id === 'legendary-phantom-shroud' || id === 'chest-ghost-hood';
      const accent = id === 'legendary-phantom-shroud' ? '#ff9524' : isPhantom ? '#a855f7' : isThermal ? '#67e8f9' : '#38bdf8';
      const fillTop = isThermal ? '#0e7490' : isPhantom ? '#18181b' : '#1e293b';
      const fillBot = isPhantom ? '#09090b' : '#020617';
      body = `
        <defs>
          <linearGradient id="${gHg}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fillTop}"/>
            <stop offset="100%" stop-color="${fillBot}"/>
          </linearGradient>
        </defs>
        ${isPhantom ? `<circle cx="40" cy="40" r="28" fill="none" stroke="${accent}" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.65"/>` : ''}
        <path d="M22 65 L20 40 C20 20 29 12 40 12 C51 12 60 20 60 40 L58 65 Q40 70 22 65 Z"
          fill="url(#${gHg})" stroke="${accent}" stroke-width="1.5"/>
        <!-- Face opening seal -->
        <ellipse cx="40" cy="37" rx="12" ry="13.5" fill="#070d19" stroke="${accent}" stroke-width="1.6"/>
        ${isPhantom ? `<path d="M32 34 L38 36 M48 34 L42 36" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>` : ''}
        <path d="M40 13 L40 23" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
      `;
    }
  } else if (slot === 'visor') {
    const top = item?.top || '#e0f2fe';
    const mid = item?.mid || '#38bdf8';
    const bot = item?.bot || '#0369a1';
    const frame = item?.frame || '#0f172a';
    const hud = item?.hudGlow || '#38bdf8';
    const gVis = _uid('gvs');
    const isSonar = /omniscient|sonar|cartographer|spectral|stalker/.test(item?.id || '');
    body = `
      <defs>
        <linearGradient id="${gVis}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${escapeHtml(top)}"/>
          <stop offset="48%" stop-color="${escapeHtml(mid)}"/>
          <stop offset="100%" stop-color="${escapeHtml(bot)}"/>
        </linearGradient>
      </defs>
      <!-- Strap ears -->
      <path d="M10 35 L16 32 L16 44 L10 41 Z M70 35 L64 32 L64 44 L70 41 Z" fill="#1e293b" stroke="${escapeHtml(hud)}" stroke-width="1"/>
      <!-- Low-volume mask frame -->
      <path d="M14 31 Q14 22 25 22 L55 22 Q66 22 66 31 L64 46 Q62 55 52 55 L46 55 Q42 55 40 48 Q38 55 34 55 L28 55 Q18 55 16 46 Z"
        fill="${escapeHtml(frame)}" stroke="${escapeHtml(hud)}" stroke-width="1.8" stroke-linejoin="round"/>
      <!-- Tinted tempered glass lens -->
      <path d="M19 32 Q19 26 26 26 L54 26 Q61 26 61 32 L59 44 Q58 50 51 50 L46 50 Q42 50 40 43 Q38 50 34 50 L29 50 Q22 50 21 44 Z"
        fill="url(#${gVis})"/>
      <!-- Glass reflection glint -->
      <path d="M23 30 L34 28 L27 45 L22 43 Z" fill="#ffffff" opacity="0.34"/>
      <path d="M47 28 L53 28 L49 38 L45 38 Z" fill="#ffffff" opacity="0.22"/>
      <!-- Nose pocket -->
      <path d="M36 45 Q40 40 44 45 L43 56 Q40 59 37 56 Z" fill="#090d16" stroke="rgba(226,232,240,0.28)" stroke-width="1"/>
      ${isSonar ? `<circle cx="51" cy="38" r="6" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.85"/><circle cx="51" cy="38" r="2" fill="#ffffff" opacity="0.9"/>` : ''}
    `;
  } else if (slot === 'tank') {
    const top = item?.top || '#f8fafc';
    const mid = item?.mid || '#cbd5e1';
    const bot = item?.bot || '#64748b';
    const stroke = item?.stroke || '#475569';
    const gTk = _uid('gtk');
    const hasCore = Boolean(item?.fx);
    body = `
      <defs>
        <linearGradient id="${gTk}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${escapeHtml(bot)}"/>
          <stop offset="35%" stop-color="${escapeHtml(top)}"/>
          <stop offset="70%" stop-color="${escapeHtml(mid)}"/>
          <stop offset="100%" stop-color="${escapeHtml(bot)}"/>
        </linearGradient>
      </defs>
      <!-- DIN Isolator manifold crossbar -->
      <rect x="26" y="13" width="28" height="4" rx="2" fill="#cbd5e1" stroke="#334155" stroke-width="1"/>
      <rect x="37" y="10" width="6" height="9" rx="2" fill="#0f172a" stroke="${escapeHtml(stroke)}" stroke-width="1.2"/>
      <!-- Left & Right valve necks -->
      <rect x="26" y="16" width="6" height="6" rx="1.5" fill="#94a3b8"/>
      <rect x="48" y="16" width="6" height="6" rx="1.5" fill="#94a3b8"/>
      <!-- Twin cylinders -->
      <rect x="19" y="21" width="19" height="46" rx="8.5" fill="url(#${gTk})" stroke="${escapeHtml(stroke)}" stroke-width="1.4"/>
      <rect x="42" y="21" width="19" height="46" rx="8.5" fill="url(#${gTk})" stroke="${escapeHtml(stroke)}" stroke-width="1.4"/>
      <!-- Stainless twinset bands -->
      <rect x="18" y="31" width="44" height="4" rx="1.5" fill="#0f172a" stroke="rgba(226,232,240,0.45)" stroke-width="0.9"/>
      <rect x="18" y="52" width="44" height="4" rx="1.5" fill="#0f172a" stroke="rgba(226,232,240,0.45)" stroke-width="0.9"/>
      ${hasCore ? `<circle cx="28.5" cy="43" r="3" fill="${escapeHtml(top)}" stroke="${escapeHtml(stroke)}" stroke-width="1.2"/><circle cx="51.5" cy="43" r="3" fill="${escapeHtml(top)}" stroke="${escapeHtml(stroke)}" stroke-width="1.2"/>` : ''}
    `;
  } else if (slot === 'torch') {
    const sw = item?.swatch || '#bae6fd';
    const gBeam = _uid('gbm');
    const gBody = _uid('gbd');
    const isLance = item?.id === 'legendary-photon-lance';
    body = `
      <defs>
        <linearGradient id="${gBeam}" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
          <stop offset="30%" stop-color="${escapeHtml(sw)}" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="${escapeHtml(sw)}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${gBody}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#475569"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#090d16"/>
        </linearGradient>
      </defs>
      <g transform="translate(40,40) rotate(-26) translate(-40,-40)">
        <!-- Volumetric light cone -->
        <polygon points="41,34 78,16 78,64 41,46" fill="url(#${gBeam})"/>
        ${isLance ? `<line x1="41" y1="40" x2="77" y2="40" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" opacity="0.95"/>` : ''}
        <!-- Anodized canister torch body -->
        <rect x="8" y="34" width="26" height="12" rx="3" fill="url(#${gBody})" stroke="rgba(226,232,240,0.35)" stroke-width="1.2"/>
        <!-- Knurling grooves -->
        <line x1="14" y1="35" x2="14" y2="45" stroke="#020617" stroke-width="1.4"/>
        <line x1="18" y1="35" x2="18" y2="45" stroke="#020617" stroke-width="1.4"/>
        <line x1="22" y1="35" x2="22" y2="45" stroke="#020617" stroke-width="1.4"/>
        <!-- Flared bezel head -->
        <path d="M33 33 L42 30 L42 50 L33 47 Z" fill="#334155" stroke="${escapeHtml(sw)}" stroke-width="1.4" stroke-linejoin="round"/>
        <!-- Glowing emitter lens -->
        <ellipse cx="42" cy="40" rx="2.5" ry="9" fill="#ffffff" stroke="${escapeHtml(sw)}" stroke-width="1.5"/>
      </g>
    `;
  } else if (slot === 'patch') {
    const icon = escapeHtml(item?.icon || '🎖️');
    const gHex = _uid('ghx');
    body = `
      <defs>
        <linearGradient id="${gHex}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(30,41,59,0.95)"/>
          <stop offset="100%" stop-color="rgba(7,12,24,0.98)"/>
        </linearGradient>
      </defs>
      <polygon points="40,10 64,23 64,53 40,68 16,53 16,23"
        fill="url(#${gHex})" stroke="${escapeHtml(glowCol)}" stroke-width="2.2" stroke-linejoin="round"/>
      <polygon points="40,15 59,26 59,50 40,62 21,50 21,26"
        fill="none" stroke="${escapeHtml(glowCol)}" stroke-width="1" opacity="0.45"/>
      <text x="40" y="47" text-anchor="middle" font-size="24" fill="#f8fafc">${icon}</text>
    `;
  } else if (slot === 'scooter') {
    const isNone = !item || item.id === 'none';
    const hull = item?.hull || '#facc15';
    const shroud = item?.shroud || '#1e293b';
    const acc = item?.accent || '#38bdf8';
    const gSc = _uid('gsc');
    const isLeg = item?.tier === 'legendary';
    if (isNone) {
      body = `
        <g transform="translate(40,41) rotate(-20) translate(-40,-41)" opacity="0.42">
          <rect x="14" y="29" width="16" height="22" rx="4" fill="none" stroke="#64748b" stroke-width="1.6" stroke-dasharray="3 3"/>
          <path d="M30 32 L54 32 Q69 40 54 48 L30 48 Z" fill="none" stroke="#64748b" stroke-width="1.6" stroke-dasharray="3 3"/>
          <line x1="20" y1="22" x2="60" y2="58" stroke="#64748b" stroke-width="1.6" stroke-linecap="round"/>
        </g>
      `;
    } else {
      body = `
        <defs>
          <linearGradient id="${gSc}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.35"/>
            <stop offset="30%" stop-color="${escapeHtml(hull)}"/>
            <stop offset="100%" stop-color="#090d16"/>
          </linearGradient>
        </defs>
        <g transform="translate(40,41) rotate(-20) translate(-40,-41)">
          <!-- Prop wake rings -->
          <path d="M8 33 Q4 40 8 47" fill="none" stroke="${escapeHtml(acc)}" stroke-width="1.5" stroke-linecap="round" opacity="0.72"/>
          <!-- Twin steering handles -->
          <path d="M19 29 L13 24 M19 51 L13 56" stroke="#cbd5e1" stroke-width="2.4" stroke-linecap="round"/>
          <!-- Shrouded ducted propeller housing -->
          <rect x="15" y="27" width="16" height="26" rx="5" fill="${escapeHtml(shroud)}" stroke="${escapeHtml(acc)}" stroke-width="1.6"/>
          <line x1="22" y1="31" x2="22" y2="49" stroke="${escapeHtml(acc)}" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
          <!-- Torpedo hull & nosecone -->
          <path d="M30 31 L53 31 Q70 40 53 49 L30 49 Z" fill="${escapeHtml(hull)}" stroke="#0f172a" stroke-width="1.4"/>
          <path d="M30 31 L53 31 Q70 40 53 49 L30 49 Z" fill="url(#${gSc})" opacity="0.55"/>
          <!-- Racing stripe & nose headlamp -->
          <line x1="33" y1="40" x2="54" y2="40" stroke="${escapeHtml(acc)}" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="56" cy="40" r="3" fill="#ffffff" stroke="${escapeHtml(acc)}" stroke-width="1.4"/>
          ${isLeg ? `<path d="M58 26 Q76 40 58 54" fill="none" stroke="#67e8f9" stroke-width="2" stroke-linecap="round" opacity="0.9"/>` : ''}
        </g>
      `;
    }
  } else if (slot === 'harpoon') {
    const barrel = item?.barrel || '#cbd5e1';
    const rail = item?.rail || '#38bdf8';
    const band = item?.band || '#f59e0b';
    const tip = item?.tip || '#bae6fd';
    const isTrident = item?.id === 'legendary-poseidon-trident';
    body = `
      <g transform="translate(40,42) rotate(-28) translate(-40,-42)">
        <!-- Ergonomic pistol grip & trigger guard -->
        <path d="M16 44 L11 58 L20 59 L24 46 Z" fill="#1e293b" stroke="${escapeHtml(rail)}" stroke-width="1.2" stroke-linejoin="round"/>
        <rect x="8" y="38" width="11" height="8" rx="2.5" fill="#0f172a" stroke="#64748b" stroke-width="1.1"/>
        <!-- Underslung line reel -->
        <circle cx="31" cy="49" r="5" fill="#0f172a" stroke="${escapeHtml(band)}" stroke-width="1.4"/>
        <!-- Pneumatic barrel -->
        <rect x="17" y="36" width="38" height="9" rx="3" fill="${escapeHtml(barrel)}" stroke="#0f172a" stroke-width="1.2"/>
        <!-- Glowing pressure rail -->
        <rect x="22" y="38.5" width="30" height="3" rx="1.2" fill="${escapeHtml(rail)}"/>
        <!-- Tensioned power band -->
        <line x1="25" y1="35" x2="52" y2="35" stroke="${escapeHtml(band)}" stroke-width="2.2" stroke-linecap="round"/>
        <!-- Muzzle head -->
        <rect x="51" y="34" width="6" height="12" rx="1.8" fill="#1e293b" stroke="${escapeHtml(rail)}" stroke-width="1.2"/>
        <!-- Spear shaft & barbed tip -->
        <line x1="56" y1="39.5" x2="71" y2="39.5" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>
        ${isTrident
          ? `<path d="M64 33 L73 33 M64 46 L73 46 M65 39.5 L77 39.5 M64 33 L64 46" fill="none" stroke="${escapeHtml(tip)}" stroke-width="2.2" stroke-linecap="round"/><polygon points="78,39.5 71,35.5 73,39.5 71,43.5" fill="${escapeHtml(tip)}"/>`
          : `<polygon points="77,39.5 66,34.5 69,39.5 66,44.5" fill="${escapeHtml(tip)}" stroke="${escapeHtml(rail)}" stroke-width="1"/>`
        }
      </g>
    `;
  } else if (slot === 'chroma') {
    const [c0, c1, c2] = Array.isArray(item?.swatch) ? item.swatch : ['#1e293b', '#0f172a', '#38bdf8'];
    const gOrb = _uid('gob');
    body = `
      <defs>
        <linearGradient id="${gOrb}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${escapeHtml(c0)}"/>
          <stop offset="52%" stop-color="${escapeHtml(c1)}"/>
          <stop offset="100%" stop-color="${escapeHtml(c2)}"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="22" fill="url(#${gOrb})" stroke="rgba(248,250,252,0.45)" stroke-width="1.6"/>
      <path d="M26 30 Q36 20 50 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/>
      ${item?.animated ? `<circle cx="58" cy="22" r="2.6" fill="#fef08a"/><circle cx="22" cy="56" r="2" fill="#67e8f9"/>` : ''}
    `;
  } else if (slot === 'treasure-map') {
    const col = item?.color || '#facc15';
    const icon = escapeHtml(item?.skillIcon || '🗺️');
    body = `
      <circle cx="40" cy="40" r="26" fill="none" stroke="${escapeHtml(col)}" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.55"/>
      <circle cx="40" cy="40" r="18" fill="rgba(15,23,42,0.85)" stroke="${escapeHtml(col)}" stroke-width="2"/>
      <line x1="40" y1="10" x2="40" y2="18" stroke="${escapeHtml(col)}" stroke-width="2" stroke-linecap="round"/>
      <line x1="40" y1="62" x2="40" y2="70" stroke="${escapeHtml(col)}" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="40" x2="18" y2="40" stroke="${escapeHtml(col)}" stroke-width="2" stroke-linecap="round"/>
      <line x1="62" y1="40" x2="70" y2="40" stroke="${escapeHtml(col)}" stroke-width="2" stroke-linecap="round"/>
      <text x="40" y="47" text-anchor="middle" font-size="20">${icon}</text>
    `;
  }

  return `<svg class="gear-art-svg" viewBox="0 0 80 80" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <radialGradient id="${bgId}" cx="50%" cy="46%" r="54%">
        <stop offset="0%" stop-color="${escapeHtml(glowCol)}" stop-opacity="${rimAlpha}"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="40" cy="40" r="36" fill="url(#${bgId})"/>
    ${body}
  </svg>`;
}
