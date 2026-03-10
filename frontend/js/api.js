// ============================================================
// API Layer
// ============================================================

const API_BASE = '/api';

let _authToken = localStorage.getItem('sc_token') || null;
let _currentUser = JSON.parse(localStorage.getItem('sc_user') || 'null');

const Auth = {
  get token() { return _authToken; },
  get user() { return _currentUser; },
  get isLoggedIn() { return !!_authToken; },
  get isAdmin() { return _currentUser?.role === 'admin'; },
  get isMod()   { return _currentUser?.role === 'admin' || _currentUser?.role === 'moderator'; },

  setSession(token, user) {
    _authToken = token;
    _currentUser = user;
    localStorage.setItem('sc_token', token);
    localStorage.setItem('sc_user', JSON.stringify(user));
    updateNavForAuth();
    startPolling();
  },

  clearSession() {
    _authToken = null;
    _currentUser = null;
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    updateNavForAuth();
    stopPolling();
  },

  async refreshUser() {
    if (!_authToken) return;
    try {
      const user = await api.get('/auth/me');
      _currentUser = user;
      localStorage.setItem('sc_user', JSON.stringify(user));
      updateNavForAuth();
    } catch (e) {
      if (e.status === 401) this.clearSession();
    }
  }
};

async function apiFetch(method, path, data = null, isFormData = false) {
  const opts = {
    method,
    headers: {}
  };
  if (Auth.token) opts.headers['Authorization'] = `Bearer ${Auth.token}`;

  if (data) {
    if (isFormData) {
      opts.body = data; // FormData
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
  }

  const res = await fetch(API_BASE + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 429
      ? `Rate limit hit — ${json.detail || 'please wait a moment and try again.'}`
      : (json.detail || json.error || `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

const api = {
  get: (path) => apiFetch('GET', path),
  post: (path, data, isForm) => apiFetch('POST', path, data, isForm),
  put: (path, data, isForm) => apiFetch('PUT', path, data, isForm),
  delete: (path) => apiFetch('DELETE', path),
};

// ============================================================
// Toast Notifications
// ============================================================

const TOAST_ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    '◎',
};

function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icon  = TOAST_ICONS[type] || '◎';
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // animate progress bar
  const bar = toast.querySelector('.toast-progress');
  if (bar) {
    bar.style.transition = `width ${duration}ms linear`;
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '0%'; }));
  }

  const fadeOut = () => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(110%)';
    setTimeout(() => toast.remove(), 320);
  };

  toast.addEventListener('click', fadeOut);
  setTimeout(fadeOut, duration);
  return toast;
}

// ============================================================
// Nav / Auth State
// ============================================================

function updateNavForAuth() {
  const navAuth  = document.getElementById('nav-auth');
  const navUser  = document.getElementById('nav-user');
  const navAdmin = document.getElementById('nav-admin');
  const navMod   = document.getElementById('nav-mod');

  if (Auth.isLoggedIn) {
    if (navAuth) navAuth.classList.add('hidden');
    if (navUser) {
      navUser.classList.remove('hidden');
      navUser.textContent = Auth.user?.username || 'PILOT';
    }
    if (navAdmin) {
      if (Auth.isAdmin) navAdmin.classList.remove('hidden');
      else navAdmin.classList.add('hidden');
    }
    if (navMod) {
      if (Auth.isMod) navMod.classList.remove('hidden');
      else navMod.classList.add('hidden');
    }
  } else {
    if (navAuth)  navAuth.classList.remove('hidden');
    if (navUser)  navUser.classList.add('hidden');
    if (navAdmin) navAdmin.classList.add('hidden');
    if (navMod)   navMod.classList.add('hidden');
  }
  updateUnreadBadge();
}

async function updateUnreadBadge() {
  if (!Auth.isLoggedIn) return;
  try {
    const [msgData, notifData] = await Promise.all([
      api.get('/messages/unread-count'),
      api.get('/notifications/unread-count'),
    ]);

    const msgBadge = document.getElementById('unread-badge');
    if (msgBadge) {
      msgBadge.textContent = msgData.count;
      msgBadge.classList.toggle('hidden', msgData.count === 0);
    }

    const notifBadge   = document.getElementById('notif-badge');
    const navNotif     = document.getElementById('nav-notifications');
    const profileBadge = document.getElementById('profile-notif-badge');
    const count = notifData.count || 0;

    if (navNotif) navNotif.classList.toggle('hidden', !Auth.isLoggedIn);
    if (notifBadge) {
      notifBadge.textContent = count;
      notifBadge.classList.toggle('hidden', count === 0);
    }
    if (profileBadge) {
      profileBadge.textContent = count;
      profileBadge.classList.toggle('hidden', count === 0);
    }
  } catch {}

  // Mod badge — only fetched for moderators/admins
  if (Auth.isMod) {
    try {
      const stats     = await api.get('/mod/stats');
      const modBadge  = document.getElementById('mod-report-badge');
      const count     = stats.open_reports || 0;
      if (modBadge) {
        modBadge.textContent = count;
        modBadge.classList.toggle('hidden', count === 0);
      }
    } catch {}
  }
}

// Poll unread counts every 30s while logged in
let _pollInterval = null;
function startPolling() {
  if (_pollInterval) clearInterval(_pollInterval);
  updateUnreadBadge();
  _pollInterval = setInterval(updateUnreadBadge, 30_000);
}
function stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

// ============================================================
// Utility helpers
// ============================================================

function formatPrice(price, currency = 'aUEC') {
  return `${price.toLocaleString()} ${currency}`;
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const CATEGORY_LABELS = {
  'commodities': 'Commodities',
  'ships': 'Ships & Components',
  'fps-gear': 'FPS Gear & Armor'
};

const CATEGORY_ICONS = {
  'commodities': '⬡',
  'ships': '◈',
  'fps-gear': '◆'
};

const LISTING_TYPE_LABELS = { WTS: 'WTS', WTB: 'WTB', WTT: 'WTT', WTR: 'WTR' };
const LISTING_TYPE_COLORS = { WTS: 'badge-green', WTB: 'badge-blue', WTT: 'badge-purple', WTR: 'badge-orange' };

const SOURCES       = ['Looted', 'Pledged', 'Purchased In-Game', 'Pirated', 'Gifted'];
const AVAILABILITY  = ['Immediate', 'Ready for Pickup', 'On-Demand', 'Pre-order', 'Work Order', 'Reserve Only', 'Scheduled', 'In Progress', 'Negotiable'];
const SYSTEMS       = ['Stanton', 'Pyro', 'Nyx'];
const LANGUAGES     = ['English', 'German', 'Spanish', 'French', 'Italian', 'Portuguese', 'Russian', 'Chinese'];

const TOP_TRADED_THRESHOLD = 5; // deal_count >= this → 🔥 badge
const NEW_LISTING_HOURS    = 48; // created within this many hours → NEW badge

function categoryLabel(cat) { return CATEGORY_LABELS[cat] || cat; }

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function isNewListing(createdAt) {
  return (Date.now() - new Date(createdAt)) < NEW_LISTING_HOURS * 3600 * 1000;
}

function lastActiveLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 120)    return 'Just now';
  if (seconds < 3600)   return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Trust Score UI helpers ────────────────────────────────────────────────────

function trustBadge(trust, compact = false) {
  if (!trust) return '';
  const { score, band, color, breakdown } = trust;

  const tooltip = [
    `Score: ${score}/100`,
    breakdown.rsi_verified    ? `✓ RSI Verified +${breakdown.rsi_verified}` : '',
    breakdown.deals           ? `Deals +${breakdown.deals}` : '',
    breakdown.rating_quality  ? `Rating quality +${breakdown.rating_quality}` : '',
    breakdown.rating_volume   ? `Rating volume +${breakdown.rating_volume}` : '',
    breakdown.account_age     ? `Account age +${breakdown.account_age}` : '',
    breakdown.dispute_penalty ? `Disputes ${breakdown.dispute_penalty}` : '',
  ].filter(Boolean).join(' · ');

  if (compact) {
    return `
      <span class="trust-badge-compact" style="color:${color};border-color:${color}" title="${tooltip}">
        ${score}
      </span>`;
  }

  const barPct = Math.max(2, score);
  return `
    <div class="trust-widget" title="${tooltip}">
      <div class="trust-score" style="color:${color}">${score}</div>
      <div class="trust-bar-track">
        <div class="trust-bar-fill" style="width:${barPct}%;background:${color}"></div>
      </div>
      <div class="trust-band" style="color:${color}">${band}</div>
    </div>`;
}
