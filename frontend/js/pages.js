// ============================================================
// SPA Router
// ============================================================

const Router = {
  routes: {},
  current: null,

  register(path, handler) { this.routes[path] = handler; },

  navigate(path, pushState = true) {
    if (pushState) history.pushState({}, '', path);
    this.current = path;

    // Update active nav
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === path);
    });

    // Find matching route
    const parts = path.split('/').filter(Boolean);
    const base = '/' + (parts[0] || '');

    const handler = this.routes[path] || this.routes[base] || this.routes['/404'];
    if (handler) handler(parts);
  },

  init() {
    window.addEventListener('popstate', () => this.navigate(location.pathname, false));
    this.navigate(location.pathname, false);
  }
};

// ============================================================
// Page: Home / Marketplace
// ============================================================

async function renderMarketplace(params) {
  const content = document.getElementById('main-content');
  const qs      = new URLSearchParams(location.search);
  const category     = qs.get('category')     || '';
  const sort         = qs.get('sort')         || 'newest';
  const search       = qs.get('search')       || '';
  const listing_type = qs.get('listing_type') || '';
  const system_name  = qs.get('system_name')  || '';
  const price_min    = qs.get('price_min')    || '';
  const price_max    = qs.get('price_max')    || '';
  const posted_within = qs.get('posted_within') || '';

  const hasAdvanced = price_min || price_max || posted_within;

  content.innerHTML = `
    <div class="hero">
      <p class="hero-eyebrow">// SERPENT'S HOLD NETWORK //</p>
      <h1>THE <span>UNDERGROUND</span><br>MARKET</h1>
      <p class="hero-sub">Trade goods, ships, and equipment across the 'verse. No questions asked.</p>
      <div class="hero-divider"></div>
      ${Auth.isLoggedIn
        ? `<button class="btn btn-primary" onclick="showCreateListing()">⊕ POST LISTING</button>
           <button class="btn btn-ghost" style="margin-left:0.75rem;font-size:0.78rem" onclick="showMissingItemModal()">? ITEM MISSING?</button>`
        : `<button class="btn btn-primary" onclick="showAuthModal('register')">JOIN THE EXCHANGE</button>
           <button class="btn btn-secondary" style="margin-left:0.75rem" onclick="showAuthModal('login')">SIGN IN</button>`
      }
    </div>

    <div class="filters-bar">
      <div class="search-wrapper">
        <span class="search-icon">⌕</span>
        <input type="text" class="form-input search-input" id="search-input" placeholder="SEARCH LISTINGS..." value="${escapeHtml(search)}">
      </div>

      <div class="filter-row">
        <div class="filter-group">
          <span class="filter-label">CAT:</span>
          <button class="filter-btn ${!category ? 'active' : ''}"              onclick="filterBy('category','')">ALL</button>
          <button class="filter-btn ${category==='commodities'?'active':''}"   onclick="filterBy('category','commodities')">COMMODITIES</button>
          <button class="filter-btn ${category==='ships'?'active':''}"         onclick="filterBy('category','ships')">SHIPS</button>
          <button class="filter-btn ${category==='fps-gear'?'active':''}"      onclick="filterBy('category','fps-gear')">FPS GEAR</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">TYPE:</span>
          <button class="filter-btn ${!listing_type?'active':''}"              onclick="filterBy('listing_type','')">ALL</button>
          <button class="filter-btn type-wts ${listing_type==='WTS'?'active':''}" onclick="filterBy('listing_type','WTS')">WTS</button>
          <button class="filter-btn type-wtb ${listing_type==='WTB'?'active':''}" onclick="filterBy('listing_type','WTB')">WTB</button>
          <button class="filter-btn type-wtt ${listing_type==='WTT'?'active':''}" onclick="filterBy('listing_type','WTT')">WTT</button>
          <button class="filter-btn type-wtr ${listing_type==='WTR'?'active':''}" onclick="filterBy('listing_type','WTR')">WTR</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">SYSTEM:</span>
          <button class="filter-btn ${!system_name?'active':''}"               onclick="filterBy('system_name','')">ALL</button>
          ${SYSTEMS.map(s => `<button class="filter-btn ${system_name===s?'active':''}" onclick="filterBy('system_name','${s}')">${s.toUpperCase()}</button>`).join('')}
        </div>

        <div class="filter-group">
          <span class="filter-label">SORT:</span>
          <select class="form-select filter-select" onchange="filterBy('sort',this.value)">
            <option value="newest"       ${sort==='newest'?'selected':''}>Newest</option>
            <option value="oldest"       ${sort==='oldest'?'selected':''}>Oldest</option>
            <option value="price_asc"    ${sort==='price_asc'?'selected':''}>Price: Low → High</option>
            <option value="price_desc"   ${sort==='price_desc'?'selected':''}>Price: High → Low</option>
            <option value="views"        ${sort==='views'?'selected':''}>Most Viewed</option>
            <option value="most_traded"  ${sort==='most_traded'?'selected':''}>Most Traded 🔥</option>
            <option value="least_traded" ${sort==='least_traded'?'selected':''}>Least Traded</option>
            <option value="top_rated"    ${sort==='top_rated'?'selected':''}>Top Rated ▲</option>
            <option value="lowest_rated" ${sort==='lowest_rated'?'selected':''}>Lowest Rated ▼</option>
          </select>
        </div>

        <button class="filter-btn ${hasAdvanced?'active':''}" id="advanced-toggle-btn"
          onclick="toggleAdvancedFilters()" style="font-size:0.68rem;letter-spacing:0.08em">
          ⊞ ADVANCED${hasAdvanced ? ' ●' : ''}
        </button>

        ${(category || listing_type || system_name || search || price_min || price_max || posted_within)
          ? `<button class="btn btn-ghost btn-sm" onclick="clearAllFilters()"
              style="color:var(--error);font-size:0.68rem;margin-left:auto;white-space:nowrap">✕ CLEAR ALL</button>`
          : ''}
      </div>

      <!-- Advanced filters (collapsible) -->
      <div id="advanced-filters" style="display:${hasAdvanced?'flex':'none'};flex-wrap:wrap;gap:0.75rem;align-items:flex-end;padding:0.75rem 0 0.25rem;border-top:1px solid var(--border);margin-top:0.5rem">
        <div class="filter-group" style="gap:0.4rem;align-items:center">
          <span class="filter-label">PRICE:</span>
          <input type="number" class="form-input" id="price-min-input" placeholder="Min aUEC"
            value="${price_min}" min="0" style="width:110px;padding:0.3rem 0.5rem;font-size:0.78rem"
            onchange="applyPriceFilter()">
          <span style="color:var(--text-dim);font-size:0.8rem">—</span>
          <input type="number" class="form-input" id="price-max-input" placeholder="Max aUEC"
            value="${price_max}" min="0" style="width:110px;padding:0.3rem 0.5rem;font-size:0.78rem"
            onchange="applyPriceFilter()">
          <button class="btn btn-ghost btn-sm" onclick="applyPriceFilter()">APPLY</button>
        </div>
        <div class="filter-group" style="gap:0.4rem;align-items:center">
          <span class="filter-label">POSTED:</span>
          <select class="form-select filter-select" id="posted-within-select" onchange="filterBy('posted_within',this.value)">
            <option value=""    ${posted_within===''?'selected':''}>Any time</option>
            <option value="1"   ${posted_within==='1'?'selected':''}>Last 24h</option>
            <option value="7"   ${posted_within==='7'?'selected':''}>Last 7 days</option>
            <option value="30"  ${posted_within==='30'?'selected':''}>Last 30 days</option>
          </select>
        </div>
        ${hasAdvanced ? `<button class="btn btn-ghost btn-sm" onclick="clearAdvancedFilters()" style="color:var(--error);font-size:0.68rem">✕ CLEAR</button>` : ''}
      </div>
    </div>

    <div class="section-header">
      <h2 class="section-title">${category ? categoryLabel(category) : 'All Listings'}</h2>
      <div class="section-line"></div>
      <span id="listing-count" class="text-dim text-sm mono"></span>
    </div>

    <div id="listings-container">
      <div class="loading-overlay"><div class="spinner"></div> LOADING...</div>
    </div>
  `;

  const searchInput = document.getElementById('search-input');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => filterBy('search', searchInput.value), 400);
  });

  const activeFilters = { category, sort, search, listing_type, system_name, price_min, price_max, posted_within };
  window._lastFilters = activeFilters;
  await loadListings(activeFilters, 1);
}

async function loadListings(filters = {}, page = 1) {
  const container = document.getElementById('listings-container');
  if (page === 1) {
    container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> LOADING...</div>`;
  }
  try {
    const params = new URLSearchParams({ sort: filters.sort || 'newest', page, limit: 20 });
    if (filters.category)      params.set('category',      filters.category);
    if (filters.search)        params.set('search',        filters.search);
    if (filters.listing_type)  params.set('listing_type',  filters.listing_type);
    if (filters.system_name)   params.set('system_name',   filters.system_name);
    if (filters.price_min)     params.set('price_min',     filters.price_min);
    if (filters.price_max)     params.set('price_max',     filters.price_max);
    if (filters.posted_within) params.set('posted_within', filters.posted_within);

    const data = await api.get(`/listings?${params}`);
    const countEl = document.getElementById('listing-count');
    if (countEl) countEl.textContent = `${data.total} RESULT${data.total !== 1 ? 'S' : ''}`;

    if (!data.listings.length && page === 1) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◈</div>
          <div class="empty-title">No listings found</div>
          <div class="empty-sub">Be the first to post in this category</div>
        </div>`;
      return;
    }

    const grid   = `<div class="listings-grid">${data.listings.map(listingCard).join('')}</div>`;
    const pager  = data.pages > 1 ? buildPagination(page, data.pages, filters) : '';
    container.innerHTML = grid + pager;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Failed to load listings</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

function buildPagination(currentPage, totalPages, filters, callbackFn) {
  if (totalPages <= 1) return '';
  // callbackFn: if provided, pagination buttons call that fn(page)
  // otherwise defaults to loadListings(filters, page) for the main marketplace
  const pageCall = (p) => callbackFn
    ? `${callbackFn}(${p})`
    : `loadListings(window._lastFilters||{}, ${p})`;

  const pages = [];

  // Always show first, last, current ±2
  const show = new Set([1, totalPages]);
  for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) show.add(p);
  const sorted = [...show].sort((a, b) => a - b);

  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push(`<span class="page-ellipsis">…</span>`);
    pages.push(
      p === currentPage
        ? `<span class="page-btn page-active">${p}</span>`
        : `<button class="page-btn" onclick="${pageCall(p)}">${p}</button>`
    );
  });

  const prevBtn = currentPage > 1
    ? `<button class="page-btn page-nav" onclick="${pageCall(currentPage - 1)}">← PREV</button>`
    : `<span class="page-btn page-nav page-disabled">← PREV</span>`;

  const nextBtn = currentPage < totalPages
    ? `<button class="page-btn page-nav" onclick="${pageCall(currentPage + 1)}">NEXT →</button>`
    : `<span class="page-btn page-nav page-disabled">NEXT →</span>`;

  return `
    <div class="pagination">
      ${prevBtn}
      ${pages.join('')}
      ${nextBtn}
      <span class="page-info">Page ${currentPage} of ${totalPages}</span>
    </div>`;
}

function listingCard(l) {
  const img = l.image_url
    ? `<img src="${escapeHtml(l.image_url)}" alt="${escapeHtml(l.title)}" class="listing-img" loading="lazy">`
    : `<div class="listing-img-placeholder">${CATEGORY_ICONS[l.category] || '◆'} NO IMAGE</div>`;

  const typeClass  = LISTING_TYPE_COLORS[l.listing_type] || 'badge-green';
  const typeBadge  = `<span class="badge ${typeClass} badge-type">${l.listing_type || 'WTS'}</span>`;
  const newBadge   = isNewListing(l.created_at) ? `<span class="badge badge-new">NEW</span>` : '';
  const fireBadge  = (l.deal_count >= TOP_TRADED_THRESHOLD) ? `<span class="badge badge-fire">🔥 TOP TRADED</span>` : '';
  const systemTag  = l.system_name ? `<span class="badge badge-system">${escapeHtml(l.system_name).toUpperCase()}</span>` : '';

  const priceLabel = (l.listing_type === 'WTB' || l.listing_type === 'WTT')
    ? (l.price > 0 ? `<span class="listing-price">${l.price.toLocaleString()} <span style="font-size:0.7rem;color:var(--text-dim)">${l.currency}</span></span>` : `<span class="listing-price negotiable">NEGOTIABLE</span>`)
    : `<span class="listing-price">${l.price.toLocaleString()} <span style="font-size:0.7rem;color:var(--text-dim)">${l.currency}</span></span>`;

  return `
    <div class="listing-card" onclick="Router.navigate('/listing/${l.id}')">
      <div class="listing-card-badges">
        ${typeBadge}${newBadge}${fireBadge}${systemTag}
      </div>
      ${img}
      <div class="listing-body">
        <div class="listing-category">${CATEGORY_ICONS[l.category] || ''} ${categoryLabel(l.category)}${l.subcategory ? ' / ' + escapeHtml(l.subcategory) : ''}</div>
        <div class="listing-title">${escapeHtml(l.title)}</div>
        <div class="listing-desc">${escapeHtml((l.description || 'No description provided.').substring(0, 100))}${(l.description||'').length > 100 ? '…' : ''}</div>
        <div class="listing-footer">
          ${priceLabel}
          <div style="text-align:right">
            <div class="listing-seller"><a onclick="event.stopPropagation();Router.navigate('/seller/${escapeHtml(l.seller_name)}')" style="cursor:pointer;color:var(--text-dim)">@${escapeHtml(l.seller_name)}${l.seller_verified ? ' ✓' : ''}</a>${l.seller_trust ? trustBadge(l.seller_trust, true) : ''}</div>
            ${l.seller_last_active ? `<div class="listing-last-active">● ${lastActiveLabel(l.seller_last_active)}</div>` : ''}
          </div>
        </div>
        ${l.deal_count > 0 ? `<div class="listing-deals">${l.deal_count} deal${l.deal_count !== 1 ? 's' : ''}</div>` : ''}
      </div>
    </div>`;
}

function filterBy(key, val) {
  const params = new URLSearchParams(location.search);
  if (val) params.set(key, val);
  else params.delete(key);
  history.pushState({}, '', '?' + params.toString());
  renderMarketplace();
}

function toggleAdvancedFilters() {
  const el  = document.getElementById('advanced-filters');
  const btn = document.getElementById('advanced-toggle-btn');
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'flex';
  if (btn) btn.classList.toggle('active', !visible);
}

function applyPriceFilter() {
  const min = document.getElementById('price-min-input')?.value || '';
  const max = document.getElementById('price-max-input')?.value || '';
  const params = new URLSearchParams(location.search);
  if (min) params.set('price_min', min); else params.delete('price_min');
  if (max) params.set('price_max', max); else params.delete('price_max');
  history.pushState({}, '', '?' + params.toString());
  renderMarketplace();
}

function clearAdvancedFilters() {
  const params = new URLSearchParams(location.search);
  ['price_min','price_max','posted_within'].forEach(k => params.delete(k));
  history.pushState({}, '', '?' + params.toString());
  renderMarketplace();
}

function clearAllFilters() {
  history.pushState({}, '', '/');
  renderMarketplace();
  showToast('Filters cleared', 'info');
}

// ============================================================
// Page: Listing Detail
// ============================================================

async function renderListingDetail(parts) {
  const id      = parts[1];
  const content = document.getElementById('main-content');
  content.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> FETCHING LISTING...</div>`;

  try {
    const l = await api.get(`/listings/${id}`);

    // Fetch vote state if logged in
    let myVote = 0;
    if (Auth.isLoggedIn) {
      try { myVote = (await api.get(`/votes/${id}/my-vote`)).vote; } catch {}
    }

    const img = l.image_url
      ? `<div class="detail-img-wrap"><img src="${escapeHtml(l.image_url)}" alt="${escapeHtml(l.title)}"></div>`
      : `<div class="detail-img-wrap detail-img-empty">${CATEGORY_ICONS[l.category] || '◆'} NO IMAGE PROVIDED</div>`;

    const isOwner    = Auth.user?.id === l.seller_id;
    const typeClass  = LISTING_TYPE_COLORS[l.listing_type] || 'badge-green';
    const typeBadge  = `<span class="badge ${typeClass} badge-type">${l.listing_type || 'WTS'}</span>`;
    const newBadge   = isNewListing(l.created_at) ? `<span class="badge badge-new">NEW</span>` : '';
    const fireBadge  = (l.deal_count >= TOP_TRADED_THRESHOLD) ? `<span class="badge badge-fire">🔥 TOP TRADED</span>` : '';

    const metaTags = [
      l.system_name  && `<span class="badge badge-system">◉ ${escapeHtml(l.system_name)}</span>`,
      l.availability && `<span class="badge badge-amber">${escapeHtml(l.availability)}</span>`,
      l.source       && `<span class="badge badge-dim">SRC: ${escapeHtml(l.source)}</span>`,
      l.game_version && `<span class="badge badge-dim">v${escapeHtml(l.game_version)}</span>`,
      l.language     && l.language !== 'English' && `<span class="badge badge-dim">🌐 ${escapeHtml(l.language)}</span>`,
    ].filter(Boolean).join('');

    const net = (l.upvotes || 0) - (l.downvotes || 0);

    content.innerHTML = `
      <div style="margin-bottom:1.5rem">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/')">← BACK TO MARKET</button>
      </div>
      <div class="detail-grid">
        <!-- LEFT COLUMN -->
        <div>
          ${img}
          <div style="margin-bottom:1rem">
            <div class="listing-card-badges" style="margin-bottom:0.75rem">
              ${typeBadge}${newBadge}${fireBadge}
            </div>
            <div class="listing-category" style="margin-bottom:0.5rem">${CATEGORY_ICONS[l.category] || ''} ${categoryLabel(l.category)}${l.subcategory ? ' / ' + escapeHtml(l.subcategory) : ''}</div>
            <h1 style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;margin-bottom:0.75rem;color:var(--text-primary)">${escapeHtml(l.title)}</h1>
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.75rem">
              <span class="badge badge-amber">QTY: ${l.quantity}</span>
              ${l.location ? `<span class="badge badge-amber">📍 ${escapeHtml(l.location)}</span>` : ''}
              ${metaTags}
              <span class="text-dim text-xs mono" style="display:flex;align-items:center">${l.views} VIEWS · ${timeAgo(l.created_at)}</span>
            </div>
            <div style="background:var(--bg-panel);border:1px solid var(--border);padding:1.25rem;margin-bottom:1rem">
              <div class="panel-title" style="margin-bottom:0.75rem">DESCRIPTION</div>
              <p style="color:var(--text-secondary);line-height:1.7;white-space:pre-wrap">${escapeHtml(l.description || 'No description provided.')}</p>
            </div>

            <!-- Deal + vote stats -->
            <div class="vote-row" style="margin-bottom:1rem">
              <div class="vote-stat">
                <span class="vote-label">DEALS COMPLETED</span>
                <span class="vote-count ${l.deal_count >= TOP_TRADED_THRESHOLD ? 'fire' : ''}">${l.deal_count || 0}${l.deal_count >= TOP_TRADED_THRESHOLD ? ' 🔥' : ''}</span>
              </div>
              <div class="vote-buttons">
                <button class="btn-vote ${myVote === 1 ? 'active-up' : ''}" id="vote-up-btn" onclick="castVote(${l.id}, 1)" title="Upvote">▲ <span id="vote-up-count">${l.upvotes || 0}</span></button>
                <span class="vote-net ${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}" id="vote-net">${net > 0 ? '+' : ''}${net}</span>
                <button class="btn-vote ${myVote === -1 ? 'active-down' : ''}" id="vote-down-btn" onclick="castVote(${l.id}, -1)" title="Downvote">▼ <span id="vote-down-count">${l.downvotes || 0}</span></button>
              </div>
            </div>
          </div>
          ${isOwner ? `
            <div style="display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" onclick="showEditListing(${l.id})">EDIT LISTING</button>
              <button class="btn btn-primary btn-sm" onclick="markSold(${l.id})">✓ MARK AS SOLD</button>
              <button class="btn btn-secondary btn-sm" onclick="renewListing(${l.id})">↺ RENEW</button>
              <button class="btn btn-danger btn-sm" onclick="deleteListing(${l.id})">DELETE</button>
            </div>` : ''}
        </div>

        <!-- RIGHT COLUMN -->
        <div>
          <div class="detail-price-box">
            <div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);letter-spacing:0.2em;margin-bottom:0.5rem">
              ${l.listing_type === 'WTB' ? 'OFFERING PRICE' : l.listing_type === 'WTT' ? 'TRADE VALUE' : l.listing_type === 'WTR' ? 'RENTAL PRICE' : 'ASKING PRICE'}
            </div>
            <div class="detail-price">
              ${l.price > 0 ? `${l.price.toLocaleString()}<span class="detail-currency">${l.currency}</span>` : '<span style="font-size:1.2rem;letter-spacing:0.05em">NEGOTIABLE</span>'}
            </div>
          </div>

          ${!isOwner ? `
          <div style="margin-bottom:1rem">
            ${Auth.isLoggedIn ? `
              <button class="btn btn-primary btn-full" style="margin-bottom:0.5rem;clip-path:none"
                onclick="showDealModal(${l.id}, '${escapeHtml(l.title)}', ${l.price}, '${l.currency}', '${l.listing_type}')">
                ⬡ ${l.listing_type === 'WTB' ? 'SELL TO THEM' : l.listing_type === 'WTT' ? 'PROPOSE TRADE' : l.listing_type === 'WTR' ? 'REQUEST RENTAL' : 'INITIATE DEAL'}
              </button>
              <button class="btn btn-secondary btn-full" style="margin-bottom:0.5rem;clip-path:none" onclick="showContactModal(${l.id}, '${escapeHtml(l.seller_name)}', 'inquiry')">? SEND INQUIRY</button>
            ` : `<button class="btn btn-primary btn-full" style="clip-path:none" onclick="showAuthModal('login')">SIGN IN TO CONTACT SELLER</button>`}
          </div>` : `<div class="badge badge-amber" style="width:100%;justify-content:center;padding:0.75rem;margin-bottom:1rem">YOUR LISTING</div>`}

          <div class="seller-box">
            <div class="panel-title" style="margin-bottom:1rem">SELLER INFO</div>
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem">
              <div class="avatar" style="width:48px;height:48px;font-size:1.2rem">
                ${l.seller_avatar ? `<img src="${escapeHtml(l.seller_avatar)}">` : escapeHtml((l.seller_name||'?')[0].toUpperCase())}
              </div>
              <div>
                <div style="font-family:var(--font-display);font-size:0.9rem;color:var(--text-primary)">
                  <a onclick="Router.navigate('/seller/${escapeHtml(l.seller_name)}')" style="cursor:pointer;color:var(--text-primary)">
                    @${escapeHtml(l.seller_name)}
                  </a>
                  ${l.seller_verified ? '<span style="color:var(--success-bright);font-size:0.75rem"> ✓ RSI</span>' : ''}
                </div>
                ${l.seller_rsi ? `<a href="https://robertsspaceindustries.com/citizens/${escapeHtml(l.seller_rsi)}" target="_blank" style="font-family:var(--font-mono);font-size:0.7rem;color:var(--amber-dim)">RSI: ${escapeHtml(l.seller_rsi)}</a>` : ''}
                <div class="seller-last-active-detail">
                  <span class="active-dot"></span> Last active: ${lastActiveLabel(l.seller_last_active)}
                </div>
              </div>
              ${l.seller_trust ? trustBadge(l.seller_trust) : ''}
            </div>
            ${l.seller_bio ? `<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem">${escapeHtml(l.seller_bio)}</p>` : ''}
          </div>

          ${!isOwner ? `
          <div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="reportListing(${l.id})" style="color:var(--text-muted);font-size:0.7rem">⚑ REPORT LISTING</button>
            ${l.item_type_id ? `<button class="btn btn-ghost btn-sm" onclick="showItemReportModal(${l.item_type_id})" style="color:var(--text-muted);font-size:0.7rem">⚑ REPORT ITEM DATA</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="copyShareCard(${l.id})" style="color:var(--text-muted);font-size:0.7rem">🔗 SHARE</button>
          </div>` : ''}

          ${Auth.isMod ? `
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">
            <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--success-bright);margin-bottom:0.5rem">⚑ MOD TOOLS</div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              ${l.status !== 'hidden'
                ? `<button class="btn btn-sm" style="border-color:var(--error);color:var(--error);font-size:0.72rem"
                     onclick="modHideListing(${l.id}, '${escapeHtml(l.title).replace(/'/g,"\\'")}')">HIDE LISTING</button>`
                : `<button class="btn btn-sm btn-success" style="font-size:0.72rem"
                     onclick="modShowListing(${l.id})">UNHIDE LISTING</button>`}
              <button class="btn btn-sm" style="border-color:var(--amber);color:var(--amber);font-size:0.72rem"
                onclick="modWarnSeller('${escapeHtml(l.seller_name)}')">WARN SELLER</button>
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- MORE FROM THIS SELLER -->
      <div id="more-from-seller" style="margin-top:2.5rem"></div>

      <!-- PRICE HISTORY -->
      <div id="price-history-section" style="margin-top:2.5rem"></div>
    `;

    // Load more from seller async so it doesn't block
    loadMoreFromSeller(l.seller_id, l.seller_name, l.id);
    loadPriceHistory(l.id, l.currency);

  } catch (e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Listing not found</div><button class="btn btn-secondary btn-sm" onclick="Router.navigate('/')">BACK TO MARKET</button></div>`;
  }
}

async function loadMoreFromSeller(sellerId, sellerName, excludeId) {
  const container = document.getElementById('more-from-seller');
  if (!container) return;
  try {
    const data = await api.get(`/listings?seller_id=${sellerId}&limit=6`);
    const others = data.listings.filter(l => l.id !== parseInt(excludeId));
    if (!others.length) return;
    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title" style="font-size:1rem">MORE FROM @${escapeHtml(sellerName)}</h2>
        <div class="section-line"></div>
      </div>
      <div class="listings-grid listings-grid-sm">${others.map(listingCard).join('')}</div>
    `;
  } catch {}
}

async function loadPriceHistory(listingId, currency) {
  const container = document.getElementById('price-history-section');
  if (!container) return;
  try {
    const history = await api.get(`/listings/${listingId}/price-history`);
    if (!history || history.length < 2) return; // not enough data to chart

    const W = 640, H = 160, PAD = { top: 16, right: 16, bottom: 36, left: 72 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top  - PAD.bottom;

    const prices = history.map(h => h.price);
    const dates  = history.map(h => new Date(h.recorded_at));
    const minP   = Math.min(...prices), maxP = Math.max(...prices);
    const minT   = dates[0].getTime(), maxT = dates[dates.length-1].getTime();
    const rangeP = maxP - minP || 1, rangeT = maxT - minT || 1;

    const xOf = d => PAD.left + ((d.getTime() - minT) / rangeT) * chartW;
    const yOf = p => PAD.top  + (1 - (p - minP) / rangeP) * chartH;

    // Build polyline points + area fill path
    const pts     = history.map((h, i) => `${xOf(dates[i])},${yOf(h.price)}`).join(' ');
    const areaD   = `M${xOf(dates[0])},${PAD.top + chartH} ` +
                    history.map((h, i) => `L${xOf(dates[i])},${yOf(h.price)}`).join(' ') +
                    ` L${xOf(dates[dates.length-1])},${PAD.top + chartH} Z`;

    // Y-axis labels (3 ticks)
    const yTicks  = [minP, minP + rangeP * 0.5, maxP].map(p => ({
      p, y: yOf(p), label: p.toLocaleString()
    }));

    // X-axis labels (up to 5 dates)
    const step    = Math.max(1, Math.floor(history.length / 4));
    const xLabels = history.filter((_, i) => i % step === 0 || i === history.length - 1).map((h, _, arr) => {
      const d = new Date(h.recorded_at);
      return { x: xOf(d), label: `${d.getMonth()+1}/${d.getDate()}` };
    });

    // Current vs first price delta
    const first  = prices[0], last = prices[prices.length - 1];
    const delta  = last - first;
    const deltaPct = first > 0 ? ((delta / first) * 100).toFixed(1) : 0;
    const deltaColor = delta >= 0 ? 'var(--success-bright)' : 'var(--error)';
    const deltaLabel = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct)}% from first price`;

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title" style="font-size:1rem">PRICE HISTORY</h2>
        <div class="section-line"></div>
        <span style="font-family:var(--font-mono);font-size:0.7rem;color:${deltaColor}">${deltaLabel}</span>
      </div>
      <div class="panel price-chart-panel">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" aria-label="Price history chart">
          <defs>
            <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="var(--amber)"       stop-opacity="0.3"/>
              <stop offset="100%" stop-color="var(--amber)"       stop-opacity="0"/>
            </linearGradient>
          </defs>

          <!-- Grid lines -->
          ${yTicks.map(t => `
            <line x1="${PAD.left}" y1="${t.y}" x2="${W - PAD.right}" y2="${t.y}"
                  stroke="var(--border)" stroke-width="1" stroke-dasharray="3,4"/>
          `).join('')}

          <!-- Area fill -->
          <path d="${areaD}" fill="url(#phGrad)"/>

          <!-- Line -->
          <polyline points="${pts}"
            fill="none" stroke="var(--amber-bright)" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"/>

          <!-- Data point dots -->
          ${history.map((h, i) => `
            <circle cx="${xOf(dates[i])}" cy="${yOf(h.price)}" r="3"
              fill="var(--bg-card)" stroke="var(--amber-bright)" stroke-width="1.5"/>
          `).join('')}

          <!-- Y-axis labels -->
          ${yTicks.map(t => `
            <text x="${PAD.left - 8}" y="${t.y + 4}"
              text-anchor="end" font-family="var(--font-mono)"
              font-size="10" fill="var(--text-dim)">${t.label}</text>
          `).join('')}

          <!-- X-axis labels -->
          ${xLabels.map(l => `
            <text x="${l.x}" y="${H - 8}"
              text-anchor="middle" font-family="var(--font-mono)"
              font-size="10" fill="var(--text-dim)">${l.label}</text>
          `).join('')}

          <!-- Axes -->
          <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}"
                stroke="var(--border)" stroke-width="1"/>
          <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${W - PAD.right}" y2="${PAD.top + chartH}"
                stroke="var(--border)" stroke-width="1"/>

          <!-- Currency label -->
          <text x="${PAD.left}" y="${PAD.top - 4}"
            font-family="var(--font-mono)" font-size="9" fill="var(--text-dim)">${currency}</text>
        </svg>

        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);margin-top:0.5rem">
          <span>LOW: <span style="color:var(--text-secondary)">${minP.toLocaleString()} ${currency}</span></span>
          <span>${history.length} data point${history.length !== 1 ? 's' : ''}</span>
          <span>HIGH: <span style="color:var(--text-secondary)">${maxP.toLocaleString()} ${currency}</span></span>
        </div>
      </div>
    `;
  } catch {}
}

async function castVote(listingId, vote) {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  try {
    const res = await api.post(`/votes/${listingId}`, { vote });
    // Update counts in-place without full re-render
    document.getElementById('vote-up-count').textContent   = res.upvotes;
    document.getElementById('vote-down-count').textContent = res.downvotes;
    const netEl = document.getElementById('vote-net');
    netEl.textContent = (res.net > 0 ? '+' : '') + res.net;
    netEl.className = `vote-net ${res.net > 0 ? 'positive' : res.net < 0 ? 'negative' : ''}`;
    // Toggle active styles
    document.getElementById('vote-up-btn').classList.toggle('active-up',   res.action === 'cast' && vote === 1);
    document.getElementById('vote-down-btn').classList.toggle('active-down', res.action === 'cast' && vote === -1);
    if (res.action === 'switched') {
      document.getElementById('vote-up-btn').classList.toggle('active-up',   vote === 1);
      document.getElementById('vote-down-btn').classList.toggle('active-down', vote === -1);
    }
    if (res.action === 'removed') {
      document.getElementById('vote-up-btn').classList.remove('active-up');
      document.getElementById('vote-down-btn').classList.remove('active-down');
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function markSold(listingId) {
  if (!confirm('Mark this listing as sold?')) return;
  try {
    await api.post(`/listings/${listingId}/sold`);
    showToast('Listing marked as sold', 'success');
    Router.navigate('/profile', true);
  } catch (e) { showToast(e.message, 'error'); }
}

async function renewListing(listingId) {
  try {
    await api.post(`/listings/${listingId}/renew`);
    showToast('Listing renewed for another 30 days', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================================
// Page: Profile
// ============================================================

async function renderProfile() {
  if (!Auth.isLoggedIn) { Router.navigate('/'); return; }
  const content = document.getElementById('main-content');
  content.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;

  await Auth.refreshUser();
  const user = Auth.user;

  content.innerHTML = `
    <div class="profile-header">
      <div class="avatar">
        ${user.avatar_url ? `<img src="${escapeHtml(user.avatar_url)}">` : escapeHtml(user.username[0].toUpperCase())}
      </div>
      <div style="flex:1">
        <h2 style="font-family:var(--font-display);font-size:1.2rem;color:var(--text-primary);margin-bottom:0.25rem">
          @${escapeHtml(user.username)}
          ${user.rsi_verified ? '<span class="badge badge-green" style="margin-left:0.5rem">✓ RSI VERIFIED</span>' : '<span class="badge badge-red" style="margin-left:0.5rem">UNVERIFIED</span>'}
          ${user.role === 'admin' ? '<span class="badge badge-amber" style="margin-left:0.5rem">ADMIN</span>' : ''}
        </h2>
        <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim)">${escapeHtml(user.email)} · JOINED ${new Date(user.created_at).toLocaleDateString()}</div>
        ${user.rsi_handle ? `<div style="margin-top:0.25rem"><a href="https://robertsspaceindustries.com/citizens/${escapeHtml(user.rsi_handle)}" target="_blank" style="font-family:var(--font-mono);font-size:0.78rem;color:var(--amber)">RSI: ${escapeHtml(user.rsi_handle)}</a></div>` : ''}
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" id="tab-listings" onclick="profileTab('listings')">MY LISTINGS</button>
      <button class="tab-btn" id="tab-deals" onclick="profileTab('deals')">🤝 DEALS</button>
      <button class="tab-btn" id="tab-messages" onclick="profileTab('messages')">MESSAGES</button>
      <button class="tab-btn" id="tab-notifications" onclick="profileTab('notifications')">
        🔔 NOTIFICATIONS
        <span class="nav-badge hidden" id="profile-notif-badge" style="position:relative;top:-2px;left:2px"></span>
      </button>
      <button class="tab-btn" id="tab-org" onclick="profileTab('org')">⬡ ORG</button>
      <button class="tab-btn" id="tab-settings" onclick="profileTab('settings')">SETTINGS</button>
      <button class="tab-btn" id="tab-rsi" onclick="profileTab('rsi')">RSI LINK</button>
    </div>

    <div id="profile-tab-content"></div>
  `;

  profileTab('listings');
}

async function profileTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabBtn = document.getElementById('tab-' + tab);
  if (tabBtn) tabBtn.classList.add('active');

  const container = document.getElementById('profile-tab-content');

  if (tab === 'listings') {
    container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
    try {
      const myPage = window._myListingsPage || 1;
      const data = await api.get(`/listings?seller_id=${Auth.user.id}&limit=20&page=${myPage}`);
      if (!data.listings.length && myPage === 1) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">◈</div>
            <div class="empty-title">No listings yet</div>
            <button class="btn btn-primary" style="margin-top:1rem" onclick="showCreateListing()">POST YOUR FIRST LISTING</button>
          </div>`;
        return;
      }

      container.innerHTML = `
        <!-- Toolbar -->
        <div class="bulk-toolbar">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim)">
              <input type="checkbox" id="bulk-select-all" onchange="bulkSelectAll(this.checked)"> ALL
            </label>
            <span id="bulk-count" class="text-dim mono" style="font-size:0.72rem">0 selected</span>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="bulkRenew()" id="bulk-renew-btn" disabled>↺ RENEW</button>
            <button class="btn btn-secondary btn-sm" onclick="showBulkPriceEdit()" id="bulk-price-btn" disabled>$ EDIT PRICE</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDelete()" id="bulk-delete-btn" disabled>✕ DELETE</button>
            <button class="btn btn-primary btn-sm" onclick="showCreateListing()">⊕ NEW</button>
          </div>
        </div>

        <!-- Listing rows -->
        <div id="bulk-listing-rows">
          ${data.listings.map(l => bulkListingRow(l)).join('')}
        </div>
        ${data.pages > 1 ? buildPagination(myPage, data.pages, {}, 'profileListingsPage') : ''}
      `;

      // Store listings data for later use
      window._myListings = data.listings;

    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading listings</div></div>`;
    }
  }

  else if (tab === 'messages') {
    container.innerHTML = `<div class="dm-layout">
      <div class="dm-sidebar" id="dm-sidebar">
        <div class="dm-sidebar-header">
          <span class="panel-title" style="font-size:0.8rem">CONVERSATIONS</span>
          <button class="btn btn-ghost btn-sm" style="font-size:0.65rem" onclick="showNewDmModal()">⊕ NEW</button>
        </div>
        <div id="dm-conversation-list"><div class="loading-overlay"><div class="spinner"></div></div></div>
      </div>
      <div class="dm-thread-pane" id="dm-thread-pane">
        <div class="empty-state" style="height:100%">
          <div class="empty-icon">✉</div>
          <div class="empty-title">Select a conversation</div>
        </div>
      </div>
    </div>`;
    loadDmConversations();
  }

  else if (tab === 'notifications') {
    await loadNotificationsTab(container);
  }

  else if (tab === 'deals') {
    await loadDealsTab(container);
  }

  else if (tab === 'org') {
    await loadOrgTab(container);
  }

  else if (tab === 'settings') {
    const user = Auth.user;
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header"><span class="panel-title">EDIT PROFILE</span></div>
        <div class="form-group">
          <label class="form-label">Bio</label>
          <textarea class="form-textarea" id="setting-bio" rows="3">${escapeHtml(user.bio || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Avatar URL</label>
          <input type="url" class="form-input" id="setting-avatar" value="${escapeHtml(user.avatar_url || '')}" placeholder="https://...">
        </div>
        <button class="btn btn-primary" onclick="saveProfile()">SAVE CHANGES</button>
        <hr style="border-color:var(--border);margin:1.5rem 0">
        <div class="panel-title" style="margin-bottom:0.75rem">LISTING TEMPLATES</div>
        <div id="template-list-settings"><span style="color:var(--text-dim);font-size:0.8rem">Loading...</span></div>
        <hr style="border-color:var(--border);margin:1.5rem 0">
        <button class="btn btn-danger btn-sm" onclick="logOut()">SIGN OUT</button>
      </div>`;
    loadTemplateList();
  }

  else if (tab === 'rsi') {
    const user = Auth.user;
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header"><span class="panel-title">RSI ACCOUNT LINK</span></div>
        <p style="color:var(--text-secondary);margin-bottom:1.5rem;font-size:0.9rem">
          Link your Roberts Space Industries account to get a verified badge on your listings.
        </p>
        <div class="form-group">
          <label class="form-label">RSI Handle (your RSI username)</label>
          <input type="text" class="form-input" id="rsi-handle-input" value="${escapeHtml(user.rsi_handle || '')}" placeholder="YourRSIHandle">
          <div class="form-hint">Must match exactly as shown on robertsspaceindustries.com/citizens/</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="generateRsiCode()">GENERATE VERIFICATION CODE</button>

        <div id="rsi-code-box" class="verify-box hidden">
          <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.5rem">
            Add this code anywhere in your RSI bio, then click Verify:
          </div>
          <div class="verify-code" id="rsi-code-display"></div>
          <div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1rem">
            Go to <a href="https://robertsspaceindustries.com/account/profile" target="_blank" style="color:var(--amber)">RSI Account Settings</a> → Biography → paste the code → Save.
          </div>
          <button class="btn btn-primary btn-sm" onclick="verifyRsi()">✓ VERIFY NOW</button>
        </div>
        <div id="rsi-verify-result" style="margin-top:1rem"></div>
      </div>`;

    if (user.rsi_verify_code) {
      document.getElementById('rsi-code-display').textContent = user.rsi_verify_code;
      document.getElementById('rsi-code-box').classList.remove('hidden');
    }
  }
}

// ── DM Threading ──────────────────────────────────────────────────────────────

async function loadDmConversations() {
  const list = document.getElementById('dm-conversation-list');
  if (!list) return;
  try {
    const convos = await api.get('/dm/conversations');
    if (!convos.length) {
      list.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-dim);font-size:0.8rem">No conversations yet</div>`;
      return;
    }
    list.innerHTML = convos.map(c => `
      <div class="dm-convo-item ${c.unread_count > 0 ? 'unread' : ''}"
           id="dm-convo-${c.other_id}"
           onclick="openDmThread(${c.other_id}, '${escapeHtml(c.other_username)}')">
        <div class="dm-convo-avatar">${escapeHtml(c.other_username[0].toUpperCase())}</div>
        <div class="dm-convo-meta">
          <div class="dm-convo-name">@${escapeHtml(c.other_username)}</div>
          <div class="dm-convo-preview">${escapeHtml((c.last_body || '').substring(0, 50))}${(c.last_body || '').length > 50 ? '…' : ''}</div>
        </div>
        <div class="dm-convo-right">
          <div class="dm-convo-time">${timeAgo(c.last_at)}</div>
          ${c.unread_count > 0 ? `<div class="dm-unread-dot">${c.unread_count}</div>` : ''}
        </div>
      </div>`).join('');
  } catch(e) {
    list.innerHTML = `<div style="padding:1rem;color:var(--error);font-size:0.8rem">Failed to load</div>`;
  }
}

async function openDmThread(otherId, otherUsername) {
  // Highlight selected conversation
  document.querySelectorAll('.dm-convo-item').forEach(el => el.classList.remove('active'));
  const convoEl = document.getElementById(`dm-convo-${otherId}`);
  if (convoEl) { convoEl.classList.add('active'); convoEl.classList.remove('unread'); }

  // Mobile: switch to thread view
  const layout = document.querySelector('.dm-layout');
  if (layout) layout.classList.add('thread-open');

  const pane = document.getElementById('dm-thread-pane');
  if (!pane) return;

  pane.innerHTML = `
    <div class="dm-thread-header">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <button class="btn btn-ghost btn-sm" id="dm-back-btn"
          style="display:none;padding:0.25rem 0.5rem;font-size:1rem;line-height:1"
          onclick="closeDmThread()">←</button>
        <span>@${escapeHtml(otherUsername)}</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/seller/${escapeHtml(otherUsername)}')">VIEW PROFILE ↗</button>
    </div>
    <div class="dm-thread-messages" id="dm-thread-messages">
      <div class="loading-overlay"><div class="spinner"></div></div>
    </div>
    <div class="dm-thread-compose">
      <textarea class="form-input" id="dm-reply-body" rows="2"
        placeholder="Write a message…" maxlength="1000"
        onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){sendDmReply(${otherId},'${escapeHtml(otherUsername)}')}"></textarea>
      <button class="btn btn-primary btn-sm" onclick="sendDmReply(${otherId},'${escapeHtml(otherUsername)}')">SEND</button>
    </div>`;

  // Show back button on mobile
  const backBtn = document.getElementById('dm-back-btn');
  if (backBtn && window.innerWidth <= 640) backBtn.style.display = 'inline-flex';

  // Load thread messages
  try {
    const msgs = await api.get(`/dm/thread/${otherId}`);
    const threadEl = document.getElementById('dm-thread-messages');
    if (!threadEl) return;
    if (!msgs.length) {
      threadEl.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.8rem">Start the conversation</div>`;
    } else {
      threadEl.innerHTML = msgs.map(m => {
        const mine = m.sender_id === Auth.user?.id;
        return `
          <div class="dm-msg ${mine ? 'mine' : 'theirs'}">
            <div class="dm-msg-bubble">${escapeHtml(m.body)}</div>
            <div class="dm-msg-time">${timeAgo(m.created_at)}</div>
          </div>`;
      }).join('');
      threadEl.scrollTop = threadEl.scrollHeight;
    }
  } catch(e) {
    const el = document.getElementById('dm-thread-messages');
    if (el) el.innerHTML = `<div style="padding:1rem;color:var(--error)">Failed to load thread</div>`;
  }

  // Update badge
  updateUnreadBadge();
}

function closeDmThread() {
  const layout = document.querySelector('.dm-layout');
  if (layout) layout.classList.remove('thread-open');
}

async function sendDmReply(recipientId, recipientUsername) {
  const el   = document.getElementById('dm-reply-body');
  const body = el?.value.trim();
  if (!body) return;
  try {
    await api.post('/dm', { recipient_id: recipientId, body });
    el.value = '';
    // Append message optimistically
    const threadEl = document.getElementById('dm-thread-messages');
    if (threadEl) {
      const div = document.createElement('div');
      div.className = 'dm-msg mine';
      div.innerHTML = `<div class="dm-msg-bubble">${escapeHtml(body)}</div><div class="dm-msg-time">just now</div>`;
      threadEl.appendChild(div);
      threadEl.scrollTop = threadEl.scrollHeight;
    }
    // Refresh conversation list to update preview
    loadDmConversations().then(() => {
      const convoEl = document.getElementById(`dm-convo-${recipientId}`);
      if (convoEl) { convoEl.classList.add('active'); convoEl.classList.remove('unread'); }
    });
  } catch(e) { showToast(e.message || 'Failed to send', 'error'); }
}

function showNewDmModal() {
  const modal = createModal('NEW MESSAGE', `
    <div class="form-group">
      <label class="form-label">Recipient username</label>
      <input class="form-input" id="new-dm-username" placeholder="@Username" maxlength="50">
    </div>
    <div class="form-group">
      <label class="form-label">Message</label>
      <textarea class="form-input" id="new-dm-body" rows="4" maxlength="1000" style="resize:vertical"></textarea>
    </div>
    <div id="new-dm-error" class="form-error hidden"></div>
  `, async () => {
    const username = document.getElementById('new-dm-username').value.trim().replace(/^@/,'');
    const body     = document.getElementById('new-dm-body').value.trim();
    const errEl    = document.getElementById('new-dm-error');
    if (!username) { errEl.textContent='Enter a username'; errEl.classList.remove('hidden'); throw new Error('v'); }
    if (!body)     { errEl.textContent='Message cannot be empty'; errEl.classList.remove('hidden'); throw new Error('v'); }
    // Look up user id
    try {
      const profile = await api.get(`/auth/public/${encodeURIComponent(username)}`);
      await api.post('/dm', { recipient_id: profile.id, body });
      showToast(`Message sent to @${username}`, 'success');
      closeModal();
      // Reload conversations and open thread
      await loadDmConversations();
      openDmThread(profile.id, username);
    } catch(e) {
      errEl.textContent = e.message || 'User not found';
      errEl.classList.remove('hidden');
      throw e;
    }
  }, 'SEND MESSAGE');
  document.body.appendChild(modal);
}



// ============================================================
// Page: Admin Panel
// ============================================================

async function renderAdmin() {
  if (!Auth.isAdmin) { Router.navigate('/'); return; }
  const content = document.getElementById('main-content');

  content.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">ADMIN PANEL</h2>
      <div class="section-line"></div>
      <span class="badge badge-amber">RESTRICTED</span>
    </div>
    <div class="tabs">
      <button class="tab-btn active" id="admin-tab-overview" onclick="adminTab('overview')">OVERVIEW</button>
      <button class="tab-btn" id="admin-tab-listings" onclick="adminTab('listings')">LISTINGS</button>
      <button class="tab-btn" id="admin-tab-users" onclick="adminTab('users')">USERS</button>
      <button class="tab-btn" id="admin-tab-reports" onclick="adminTab('reports')">REPORTS</button>
      <button class="tab-btn" id="admin-tab-items" onclick="adminTab('items')">⬡ ITEMS</button>
      <button class="tab-btn" id="admin-tab-item-reports" onclick="adminTab('item-reports')">⚑ ITEM REPORTS</button>
      <button class="tab-btn" id="admin-tab-missing-items" onclick="adminTab('missing-items')">✦ MISSING ITEMS</button>
      <button class="tab-btn" id="admin-tab-api-keys" onclick="adminTab('api-keys')">⌥ API KEYS</button>
      <button class="tab-btn" id="admin-tab-disputes" onclick="adminTab('disputes')">⚖ DISPUTES</button>
    </div>
    <div id="admin-content"></div>
  `;

  adminTab('overview');
}


let _adminUserSearchTimer = null;
function adminUserSearch(val) {
  clearTimeout(_adminUserSearchTimer);
  _adminUserSearchTimer = setTimeout(() => {
    window._adminUsersSearch = val;
    window._adminUsersPage   = 1;
    adminTab('users');
  }, 300);
}
function adminUsersPage(page) {
  window._adminUsersPage = page;
  adminTab('users');
}
async function adminTab(tab) {
  document.querySelectorAll('[id^="admin-tab-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('admin-tab-' + tab);
  if (btn) btn.classList.add('active');
  const container = document.getElementById('admin-content');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;

  if (tab === 'overview') {
    try {
      const stats = await api.get('/admin/stats');
      container.innerHTML = `
        <div class="stats-grid">
          ${Object.entries(stats).map(([k, v]) => `
            <div class="stat-card">
              <div class="stat-number">${v}</div>
              <div class="stat-label">${k.replace(/_/g, ' ')}</div>
            </div>`).join('')}
        </div>
        <div class="panel">
          <div class="panel-title" style="margin-bottom:1rem">QUICK ACTIONS</div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="adminTab('listings')">MANAGE LISTINGS</button>
            <button class="btn btn-secondary btn-sm" onclick="adminTab('users')">MANAGE USERS</button>
            <button class="btn btn-secondary btn-sm" onclick="adminTab('reports')">VIEW REPORTS</button>
            <button class="btn btn-secondary btn-sm" onclick="adminTab('disputes')">⚖ DISPUTE QUEUE</button>
            <button class="btn btn-secondary btn-sm" onclick="adminTab('items')">⬡ MANAGE ITEMS</button>
          </div>
        </div>`;
    } catch {}
  }

  else if (tab === 'listings') {
    try {
      const listings = await api.get('/admin/listings');
      container.innerHTML = `
        <div class="panel">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th><th>TITLE</th><th>SELLER</th><th>PRICE</th><th>STATUS</th><th>DATE</th><th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${listings.map(l => `
                <tr>
                  <td class="mono">#${l.id}</td>
                  <td>${escapeHtml(l.title)}</td>
                  <td>@${escapeHtml(l.seller_name)}</td>
                  <td class="mono">${l.price.toLocaleString()} ${l.currency}</td>
                  <td><span class="badge ${l.status === 'active' ? 'badge-green' : 'badge-red'}">${l.status}</span></td>
                  <td class="mono text-xs">${new Date(l.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style="display:flex;gap:0.4rem">
                      <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/listing/${l.id}')">VIEW</button>
                      ${l.status === 'active'
                        ? `<button class="btn btn-secondary btn-sm" onclick="adminUpdateListing(${l.id},'suspended')">SUSPEND</button>`
                        : `<button class="btn btn-secondary btn-sm" onclick="adminUpdateListing(${l.id},'active')">RESTORE</button>`}
                      <button class="btn btn-danger btn-sm" onclick="adminDeleteListing(${l.id})">DEL</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch {}
  }

  else if (tab === 'users') {
    try {
      const adminUsersPage  = window._adminUsersPage  || 1;
      const adminUsersSearch = window._adminUsersSearch || '';
      const usersData = await api.get(`/admin/users?page=${adminUsersPage}&limit=30${adminUsersSearch ? '&search=' + encodeURIComponent(adminUsersSearch) : ''}`);
      const users = Array.isArray(usersData) ? usersData : (usersData.users || usersData);
      container.innerHTML = `
        <div class="panel">
          <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
            <input class="form-input" id="admin-user-search" placeholder="Search users…"
              value="${escapeHtml(adminUsersSearch)}" oninput="adminUserSearch(this.value)"
              style="max-width:280px;font-size:0.8rem">
          </div>
          <table class="data-table">
            <thead>
              <tr><th>ID</th><th>USERNAME</th><th>EMAIL</th><th>ROLE</th><th>RSI</th><th>STATUS</th><th>ACTIONS</th></tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td class="mono">#${u.id}</td>
                  <td>@${escapeHtml(u.username)}</td>
                  <td class="text-xs">${escapeHtml(u.email)}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-amber' : 'badge-gold'}">${u.role}</span></td>
                  <td>${u.rsi_verified ? '<span class="badge badge-green">✓</span>' : '<span style="color:var(--text-dim)">—</span>'}</td>
                  <td>${u.banned ? '<span class="badge badge-red">BANNED</span>' : '<span class="badge badge-green">ACTIVE</span>'}</td>
                  <td>
                    <div style="display:flex;gap:0.4rem">
                      ${u.banned
                        ? `<button class="btn btn-secondary btn-sm" onclick="adminUpdateUser(${u.id},{banned:false})">UNBAN</button>`
                        : `<button class="btn btn-danger btn-sm" onclick="adminUpdateUser(${u.id},{banned:true})">BAN</button>`}
                      ${u.role !== 'admin'
                        ? `<button class="btn btn-secondary btn-sm" onclick="adminUpdateUser(${u.id},{role:'admin'})">MAKE ADMIN</button>`
                        : `<button class="btn btn-ghost btn-sm" onclick="adminUpdateUser(${u.id},{role:'user'})">DEMOTE</button>`}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch {}
  }

  else if (tab === 'reports') {
    try {
      const reports = await api.get('/admin/reports');
      container.innerHTML = `
        <div class="panel">
          ${!reports.length ? '<div class="empty-state"><div class="empty-title">No reports</div></div>' : `
          <table class="data-table">
            <thead><tr><th>ID</th><th>REPORTER</th><th>REASON</th><th>STATUS</th><th>DATE</th><th>ACTIONS</th></tr></thead>
            <tbody>
              ${reports.map(r => `
                <tr>
                  <td class="mono">#${r.id}</td>
                  <td class="mono">#${r.reporter_id}</td>
                  <td>${escapeHtml(r.reason)}</td>
                  <td>${r.status === 'resolved' ? '<span class="badge badge-green">RESOLVED</span>' : '<span class="badge badge-red">OPEN</span>'}</td>
                  <td class="text-xs mono">${new Date(r.created_at).toLocaleDateString()}</td>
                  <td>${r.status !== 'resolved' ? `<button class="btn btn-secondary btn-sm" onclick="adminResolveReport(${r.id})">RESOLVE</button>` : ''}</td>
                </tr>`).join('')}
            </tbody>
          </table>`}
        </div>`;
    } catch {}
  }

  else if (tab === 'items') {
    await renderAdminItems(container);
  }

  else if (tab === 'item-reports') {
    await renderAdminItemReports(container);
  }

  else if (tab === 'missing') {
    await renderAdminMissingItems(container);
  }

  else if (tab === 'missing-items') {
    await renderAdminMissingItems(container);
  }

  else if (tab === 'api-keys') {
    await renderAdminApiKeys(container);
  }

  else if (tab === 'disputes') {
    await renderAdminDisputes(container);
  }
}

async function renderAdminItems(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const [items, status] = await Promise.all([
      api.get('/item-types?active_only=false'),
      api.get('/uex/status'),
    ]);

    const countsByCategory = {};
    (status.counts || []).forEach(c => { countsByCategory[c.category] = c; });

    container.innerHTML = `
      <!-- UEX Import Panel -->
      <div class="panel" style="margin-bottom:1.5rem">
        <div class="panel-header">
          <span class="panel-title">⬡ UEX CORP AUTO-IMPORT</span>
          <span class="badge badge-dim" style="font-size:0.6rem">DATA FROM UEXCORP.SPACE</span>
        </div>
        <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1.25rem">
          Pull the latest Star Citizen item catalog from UEX Corp's community database.
          Fresh cache (under ${CACHE_TTL_HOURS}h) is used automatically — no network calls.
          Force a UEX re-fetch anytime with the refresh buttons below.
        </p>

        <!-- Cache status row -->
        <div style="margin-bottom:1.25rem">
          <div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);margin-bottom:0.5rem">CACHE STATUS</div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap" id="cache-status-row">
            ${(status.cache||[]).map(c => `
              <div style="background:var(--bg-dark);border:1px solid var(--border);padding:0.5rem 0.85rem;display:flex;flex-direction:column;gap:0.2rem;min-width:140px">
                <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-primary)">${c.key}</div>
                <div style="font-family:var(--font-mono);font-size:0.65rem;color:${c.fresh?'var(--success-bright)':'var(--error)'}">${c.fresh ? '● FRESH' : '● STALE'} — ${c.age_hours}h old</div>
                <div style="font-family:var(--font-mono);font-size:0.63rem;color:var(--text-dim)">${c.item_count} items cached</div>
              </div>`).join('') || `<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim)">No cache yet — import will fetch live from UEX</div>`}
          </div>
        </div>

        <!-- Current item counts -->
        <div class="stats-grid" style="margin-bottom:1.25rem">
          ${['ships','fps-gear','commodities'].map(cat => {
            const c = countsByCategory[cat] || { total: 0, active: 0 };
            return `<div class="stat-card">
              <div class="stat-number">${c.active || 0}</div>
              <div class="stat-label">${cat}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono)">${c.total || 0} total</div>
            </div>`;
          }).join('')}
        </div>

        <!-- Import buttons -->
        <div style="margin-bottom:0.5rem;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim)">IMPORT (uses cache if fresh)</div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
          <button class="btn btn-primary" id="uex-import-all-btn" onclick="uexImport('all')">
            ⬇ IMPORT ALL CATEGORIES
          </button>
          <button class="btn btn-secondary btn-sm" onclick="uexImport('ships')">Ships only</button>
          <button class="btn btn-secondary btn-sm" onclick="uexImport('fps-gear')">FPS Gear only</button>
          <button class="btn btn-secondary btn-sm" onclick="uexImport('commodities')">Commodities only</button>
        </div>

        <!-- Refresh (force live fetch) buttons -->
        <div style="margin-bottom:0.5rem;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim)">REFRESH CACHE (force fetch from UEX — no DB write)</div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
          <button class="btn btn-secondary btn-sm" onclick="uexRefreshCache('all')">↺ REFRESH ALL</button>
          <button class="btn btn-ghost btn-sm" onclick="uexRefreshCache('items')">↺ items</button>
          <button class="btn btn-ghost btn-sm" onclick="uexRefreshCache('vehicles')">↺ vehicles</button>
          <button class="btn btn-ghost btn-sm" onclick="uexRefreshCache('commodities')">↺ commodities</button>
          <button class="btn btn-danger btn-sm" onclick="uexPurgeCache()">🗑 PURGE CACHE</button>
        </div>

        <div id="uex-import-result"></div>
      </div>

      <!-- Manual Add -->
      <div class="panel" style="margin-bottom:1.5rem">
        <div class="panel-header">
          <span class="panel-title">+ ADD ITEM MANUALLY</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div class="form-group" style="margin:0">
            <label class="form-label">Name *</label>
            <input type="text" class="form-input" id="new-item-name" placeholder="e.g. Devastator Shotgun">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Category *</label>
            <select class="form-select" id="new-item-category" onchange="updateAdminSubcats()">
              <option value="">Select...</option>
              <option value="fps-gear">FPS Gear & Armor</option>
              <option value="ships">Ships & Components</option>
              <option value="commodities">Commodities</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Subcategory</label>
            <select class="form-select" id="new-item-subcat"></select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:1rem;margin-bottom:1rem">
          <div class="form-group" style="margin:0">
            <label class="form-label">Image URL</label>
            <input type="url" class="form-input" id="new-item-image" placeholder="https://...">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Description</label>
            <input type="text" class="form-input" id="new-item-desc" placeholder="Optional description">
          </div>
        </div>
        <div id="new-item-error" class="form-error hidden"></div>
        <button class="btn btn-primary btn-sm" onclick="adminAddItem()">+ ADD ITEM</button>
      </div>

      <!-- Item List -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">ALL ITEMS (${items.length})</span>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <input type="text" class="form-input" id="item-search" placeholder="Search..." style="width:180px;padding:0.3rem 0.6rem;font-size:0.8rem" oninput="filterItemTable(this.value)">
            <select class="filter-select" id="item-cat-filter" onchange="filterItemTable(document.getElementById('item-search').value)">
              <option value="">All Categories</option>
              <option value="ships">Ships</option>
              <option value="fps-gear">FPS Gear</option>
              <option value="commodities">Commodities</option>
            </select>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table" id="items-table">
            <thead>
              <tr><th>ID</th><th>NAME</th><th>CATEGORY</th><th>SUBCATEGORY</th><th>STATUS</th><th>ACTIONS</th></tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr data-name="${escapeHtml(it.name).toLowerCase()}" data-cat="${it.category}">
                  <td class="mono">#${it.id}</td>
                  <td style="font-weight:600;color:var(--text-primary)">${escapeHtml(it.name)}</td>
                  <td><span class="badge badge-dim">${it.category}</span></td>
                  <td class="text-xs" style="color:var(--text-secondary)">${escapeHtml(it.subcategory || '—')}</td>
                  <td>
                    <span class="badge ${it.active ? 'badge-green' : 'badge-red'}">${it.active ? 'ACTIVE' : 'HIDDEN'}</span>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.35rem">
                      <button class="btn btn-ghost btn-sm" onclick="adminEditItem(${it.id},'${escapeHtml(it.name)}','${it.category}','${escapeHtml(it.subcategory||'')}','${escapeHtml(it.description||'')}','${escapeHtml(it.image_url||'')}')">EDIT</button>
                      <button class="btn btn-secondary btn-sm" onclick="adminToggleItem(${it.id})">${it.active ? 'HIDE' : 'SHOW'}</button>
                      <button class="btn btn-danger btn-sm" onclick="adminDeleteItem(${it.id})">DEL</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    updateAdminSubcats();
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading items</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

// Admin actions
async function adminUpdateListing(id, status) {
  try {
    await api.put(`/admin/listings/${id}`, { status });
    showToast(`Listing ${status}`, 'success');
    adminTab('listings');
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminDeleteListing(id) {
  if (!confirm('Delete this listing permanently?')) return;
  try {
    await api.delete(`/admin/listings/${id}`);
    showToast('Listing deleted', 'success');
    adminTab('listings');
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminUpdateUser(id, data) {
  try {
    await api.put(`/admin/users/${id}`, data);
    showToast('User updated', 'success');
    adminTab('users');
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminResolveReport(id) {
  try {
    await api.put(`/admin/reports/${id}/resolve`);
    showToast('Report resolved', 'success');
    adminTab('reports');
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================================
// Admin: Item Management
// ============================================================

const ADMIN_SUBCATS = {
  'fps-gear':    ['Armor','Helmets','Weapons','Undersuits','Medical','Backpacks','Other'],
  'ships':       ['Hull & Structure','Weapons','Shields','Quantum Drive','Thrusters','Full Ships','Other'],
  'commodities': ['Minerals','Agricultural','Medical','Food & Drink','Contraband','Other'],
};

function updateAdminSubcats() {
  const cat   = document.getElementById('new-item-category')?.value;
  const subEl = document.getElementById('new-item-subcat');
  if (!subEl) return;
  const opts = ADMIN_SUBCATS[cat] || [];
  subEl.innerHTML = `<option value="">None</option>` + opts.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterItemTable(search) {
  const catFilter = document.getElementById('item-cat-filter')?.value || '';
  const q = (search || '').toLowerCase();
  document.querySelectorAll('#items-table tbody tr').forEach(row => {
    const nameMatch = row.dataset.name?.includes(q);
    const catMatch  = !catFilter || row.dataset.cat === catFilter;
    row.style.display = nameMatch && catMatch ? '' : 'none';
  });
}

async function adminAddItem() {
  const name    = document.getElementById('new-item-name').value.trim();
  const cat     = document.getElementById('new-item-category').value;
  const subcat  = document.getElementById('new-item-subcat').value;
  const desc    = document.getElementById('new-item-desc').value.trim();
  const img     = document.getElementById('new-item-image').value.trim();
  const errEl   = document.getElementById('new-item-error');
  errEl.classList.add('hidden');

  if (!name || !cat) {
    errEl.textContent = 'Name and category are required';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    await api.post('/item-types', { name, category: cat, subcategory: subcat, description: desc, image_url: img });
    showToast(`"${name}" added`, 'success');
    adminTab('items');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

function adminEditItem(id, name, category, subcategory, description, image_url) {
  const modal = createModal('EDIT ITEM', `
    <div class="form-group">
      <label class="form-label">Name *</label>
      <input type="text" class="form-input" id="edit-item-name" value="${escapeHtml(name)}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="edit-item-category">
          ${['fps-gear','ships','commodities'].map(c =>
            `<option value="${c}" ${category===c?'selected':''}>${c}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Subcategory</label>
        <input type="text" class="form-input" id="edit-item-subcat" value="${escapeHtml(subcategory)}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input type="text" class="form-input" id="edit-item-desc" value="${escapeHtml(description)}">
    </div>
    <div class="form-group">
      <label class="form-label">Image URL</label>
      <input type="url" class="form-input" id="edit-item-image" value="${escapeHtml(image_url)}">
    </div>
    <div id="edit-item-error" class="form-error hidden"></div>
  `, async () => {
    const body = {
      name:        document.getElementById('edit-item-name').value.trim(),
      category:    document.getElementById('edit-item-category').value,
      subcategory: document.getElementById('edit-item-subcat').value.trim(),
      description: document.getElementById('edit-item-desc').value.trim(),
      image_url:   document.getElementById('edit-item-image').value.trim(),
      active:      true,
    };
    if (!body.name || !body.category) {
      document.getElementById('edit-item-error').textContent = 'Name and category required';
      document.getElementById('edit-item-error').classList.remove('hidden');
      throw new Error('validation');
    }
    await api.put(`/item-types/${id}`, body);
    showToast('Item updated', 'success');
    closeModal();
    adminTab('items');
  }, 'SAVE CHANGES');
  document.body.appendChild(modal);
}

async function adminToggleItem(id) {
  try {
    await api.put(`/item-types/${id}/toggle`);  // PATCH not PUT but api.put works for toggle
    adminTab('items');
  } catch {
    // Try PATCH directly
    try {
      await apiFetch('PATCH', `/item-types/${id}/toggle`);
      adminTab('items');
    } catch (e) { showToast(e.message, 'error'); }
  }
}

async function adminDeleteItem(id) {
  if (!confirm('Delete this item type permanently? Listings using it will lose the association.')) return;
  try {
    await api.delete(`/item-types/${id}`);
    showToast('Item deleted', 'success');
    adminTab('items');
  } catch (e) { showToast(e.message, 'error'); }
}

const CACHE_TTL_HOURS = 24; // must match backend CACHE_TTL_HOURS

async function uexRefreshCache(key) {
  const resultEl = document.getElementById('uex-import-result');
  if (resultEl) resultEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--amber);padding:0.5rem 0">↺ Refreshing "${key}" from UEX Corp...</div>`;
  try {
    const data = await api.post(`/uex/refresh/${key}`);
    const counts = data.counts
      ? Object.entries(data.counts).map(([k,v]) => `${k}: ${v}`).join(' · ')
      : `${data.count} items`;
    showToast(`Cache refreshed — ${counts}`, 'success');
    if (resultEl) resultEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--success-bright);padding:0.5rem 0">✓ Cache refreshed: ${counts}</div>`;
    // Reload tab to update cache status display
    setTimeout(() => adminTab('items'), 800);
  } catch(e) {
    showToast('Refresh failed: ' + e.message, 'error');
    if (resultEl) resultEl.innerHTML = `<div class="form-error" style="padding:0.5rem">Refresh failed: ${e.message}</div>`;
  }
}

async function uexPurgeCache() {
  if (!confirm('Purge all UEX cache? Next import will fetch live from UEX Corp.')) return;
  try {
    await api.delete('/uex/cache');
    showToast('Cache purged', 'success');
    adminTab('items');
  } catch(e) { showToast(e.message, 'error'); }
}

async function uexImport(cat) {
  const btn    = document.getElementById('uex-import-all-btn');
  const result = document.getElementById('uex-import-result');
  if (!result) return;

  result.innerHTML = `<div class="loading-overlay" style="padding:1rem;justify-content:flex-start;gap:0.75rem"><div class="spinner"></div><span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim)">FETCHING FROM UEX CORP...</span></div>`;
  if (btn) { btn.disabled = true; btn.textContent = '⬇ IMPORTING...'; }

  try {
    const endpoint = cat === 'all' ? '/uex/import' : `/uex/import/${cat}`;
    const data = await api.post(endpoint);

    const rows = cat === 'all'
      ? [
          { label: 'Ships',       ...data.ships },
          { label: 'FPS + Components', ...data.fps_and_components },
          { label: 'Commodities', ...data.commodities },
        ]
      : [{ label: cat, inserted: data.inserted, updated: data.updated, skipped: data.skipped }];

    result.innerHTML = `
      <div class="uex-result">
        <div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--success-bright);margin-bottom:0.75rem">
          ✓ IMPORT COMPLETE — ${data.timestamp ? new Date(data.timestamp).toLocaleString() : ''}
          ${(data.cache_used || (cat !== 'all' && data.from_cache))
            ? `<span class="badge badge-dim" style="margin-left:0.5rem">⚡ FROM CACHE</span>`
            : `<span class="badge badge-amber" style="margin-left:0.5rem">↺ FETCHED FROM UEX</span>`}
        </div>
        ${rows.map(r => `
          <div class="uex-result-row">
            <span style="color:var(--text-secondary);min-width:140px">${r.label}</span>
            <span class="badge badge-green">+${r.inserted || 0} new</span>
            <span class="badge badge-amber">↺ ${r.updated || 0} updated</span>
            ${r.skipped ? `<span class="badge badge-dim">${r.skipped} skipped</span>` : ''}
          </div>`).join('')}
        ${cat === 'all' ? `<div style="margin-top:0.75rem;font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim)">
          TOTAL: +${data.total_inserted} inserted · ↺ ${data.total_updated} updated
        </div>` : ''}
      </div>`;

    // Refresh the table after a short delay
    setTimeout(() => adminTab('items'), 1200);
  } catch (e) {
    result.innerHTML = `<div class="form-error" style="padding:0.5rem">Import failed: ${e.message}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ IMPORT ALL CATEGORIES'; }
  }
}

// ============================================================
// Missing Items — Public Request Widget
// ============================================================

async function renderMissingItemsWidget(container) {
  try {
    const [requests, items] = await Promise.all([
      api.get('/missing-items?status=open'),
      api.get('/item-types'),
    ]);

    const cats = ['fps-gear','ships','commodities'];
    const catLabels = { 'fps-gear': 'FPS Gear & Armor', ships: 'Ships & Components', commodities: 'Commodities' };
    const subMap = {
      'fps-gear':    ['Armor','Helmets','Weapons','Undersuits','Medical','Backpacks','Other'],
      ships:         ['Full Ships','Weapons','Shields','Quantum Drive','Thrusters','Hull & Structure','Other'],
      commodities:   ['Minerals','Agricultural','Medical','Food & Drink','Contraband','Other'],
    };

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">REQUEST MISSING ITEM</h2>
        <div class="section-line"></div>
      </div>

      <!-- Submit form -->
      ${Auth.token ? `
      <div class="panel" style="margin-bottom:1.5rem">
        <div class="panel-title" style="margin-bottom:1rem">CAN'T FIND AN ITEM IN THE CATALOG?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div class="form-group" style="margin:0">
            <label class="form-label">Item Name *</label>
            <input type="text" class="form-input" id="mir-name" placeholder="e.g. Devastator-12">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Category *</label>
            <select class="form-select" id="mir-category" onchange="mirUpdateSubcats()">
              <option value="">Select...</option>
              ${cats.map(c => `<option value="${c}">${catLabels[c]}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Subcategory</label>
            <select class="form-select" id="mir-subcat"><option value="">—</option></select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:1rem">
          <label class="form-label">Description / Why it should be added</label>
          <input type="text" class="form-input" id="mir-desc" placeholder="Optional context..." maxlength="500">
        </div>
        <div id="mir-error" class="form-error hidden"></div>
        <button class="btn btn-primary btn-sm" onclick="submitMissingItemRequest()">⊕ SUBMIT REQUEST</button>
      </div>` : `
      <div class="panel" style="margin-bottom:1.5rem;text-align:center;padding:1.5rem">
        <div style="color:var(--text-secondary);margin-bottom:0.75rem">Sign in to request missing items</div>
        <button class="btn btn-primary btn-sm" onclick="showAuth()">SIGN IN</button>
      </div>`}

      <!-- Open requests list -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">COMMUNITY REQUESTS (${requests.length})</span>
          <div style="display:flex;gap:0.5rem">
            ${cats.map(c => `<button class="btn btn-ghost btn-sm" onclick="filterMissingItems('${c}',this)">${c}</button>`).join('')}
            <button class="btn btn-secondary btn-sm" onclick="filterMissingItems('',this)">ALL</button>
          </div>
        </div>
        <div id="mir-list">
          ${!requests.length
            ? `<div class="empty-state"><div class="empty-title">No open requests</div></div>`
            : requests.map(r => mirCard(r)).join('')}
        </div>
      </div>
    `;

    // Store sub-map for dynamic update
    window._mirSubMap = subMap;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading requests</div></div>`;
  }
}

function mirCard(r) {
  const voted = false; // optimistic — full vote tracking would need a /my endpoint
  const catColor = { 'fps-gear': '#e07b39', ships: '#a855f7', commodities: '#22c55e' };
  return `
    <div class="mir-card" data-cat="${r.category}" id="mir-card-${r.id}">
      <div class="mir-vote">
        <button class="btn btn-ghost btn-sm mir-vote-btn" onclick="voteMissingItem(${r.id})" title="Upvote">▲</button>
        <span class="mir-vote-count" id="mir-votes-${r.id}">${r.votes}</span>
      </div>
      <div class="mir-body">
        <div class="mir-name">${escapeHtml(r.name)}</div>
        <div class="mir-meta">
          <span class="badge" style="background:${catColor[r.category]||'var(--bg-card)'}20;color:${catColor[r.category]||'var(--text-dim)'};">${r.category}</span>
          ${r.subcategory ? `<span class="badge badge-dim">${escapeHtml(r.subcategory)}</span>` : ''}
          <span style="font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono)">by ${escapeHtml(r.requester_name)} · ${new Date(r.created_at).toLocaleDateString()}</span>
        </div>
        ${r.description ? `<div class="mir-desc">${escapeHtml(r.description)}</div>` : ''}
      </div>
    </div>`;
}

function mirUpdateSubcats() {
  const cat   = document.getElementById('mir-category')?.value;
  const subEl = document.getElementById('mir-subcat');
  if (!subEl) return;
  const opts = (window._mirSubMap || {})[cat] || [];
  subEl.innerHTML = `<option value="">—</option>` + opts.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterMissingItems(cat, btn) {
  document.querySelectorAll('.mir-card').forEach(card => {
    card.style.display = (!cat || card.dataset.cat === cat) ? '' : 'none';
  });
  if (btn) {
    document.querySelectorAll('#mir-list ~ * .btn-ghost, .panel-header .btn-ghost, .panel-header .btn-secondary').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

async function submitMissingItemRequest() {
  const name    = document.getElementById('mir-name')?.value.trim();
  const cat     = document.getElementById('mir-category')?.value;
  const subcat  = document.getElementById('mir-subcat')?.value;
  const desc    = document.getElementById('mir-desc')?.value.trim();
  const errEl   = document.getElementById('mir-error');
  if (errEl) errEl.classList.add('hidden');

  if (!name || !cat) {
    if (errEl) { errEl.textContent = 'Name and category are required'; errEl.classList.remove('hidden'); }
    return;
  }
  try {
    await api.post('/missing-items', { name, category: cat, subcategory: subcat, description: desc });
    showToast(`Request for "${name}" submitted!`, 'success');
    Router.navigate('/missing-items');
  } catch(e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  }
}



function adminViewItem(itemId) {
  adminTab('items');
  // Highlight row — runs after tab re-renders
  setTimeout(() => {
    const row = document.querySelector(`#items-table tr[data-item-id="${itemId}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 600);
}

// ============================================================
// Admin: Missing Item Requests Tab
// ============================================================

async function renderAdminMissingItems(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const [open, resolved] = await Promise.all([
      api.get('/missing-items?status=open'),
      api.get('/missing-items?status=resolved'),
    ]);

    const renderRow = (r, isOpen) => `
      <tr>
        <td class="mono">#${r.id}</td>
        <td style="font-weight:600;color:var(--text-primary)">${escapeHtml(r.name)}</td>
        <td><span class="badge badge-dim">${r.category}</span></td>
        <td class="text-xs" style="color:var(--text-secondary)">${escapeHtml(r.subcategory||'—')}</td>
        <td class="text-xs" style="max-width:180px;color:var(--text-secondary)">${escapeHtml(r.description||'—')}</td>
        <td><span class="badge badge-amber" style="font-size:0.75rem">▲ ${r.votes}</span></td>
        <td class="mono text-xs">${escapeHtml(r.requester_name)}</td>
        <td class="mono text-xs">${new Date(r.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap">
            ${isOpen ? `
              <button class="btn btn-primary btn-sm" onclick="adminResolveMissingItem(${r.id})">RESOLVE</button>
              <button class="btn btn-secondary btn-sm" onclick="adminRejectMissingItem(${r.id})">REJECT</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="adminDeleteMissingItem(${r.id})">DEL</button>
          </div>
        </td>
      </tr>`;

    container.innerHTML = `
      <div class="panel" style="margin-bottom:1.5rem">
        <div class="panel-header">
          <span class="panel-title">OPEN REQUESTS <span class="badge badge-amber" style="margin-left:0.5rem">${open.length}</span></span>
          <span style="font-size:0.72rem;color:var(--text-secondary);font-family:var(--font-mono)">Sorted by votes</span>
        </div>
        ${!open.length
          ? `<div class="empty-state"><div class="empty-title">No open requests</div></div>`
          : `<div style="overflow-x:auto"><table class="data-table">
              <thead><tr><th>ID</th><th>NAME</th><th>CAT</th><th>SUBCAT</th><th>DESCRIPTION</th><th>VOTES</th><th>BY</th><th>DATE</th><th>ACTIONS</th></tr></thead>
              <tbody>${open.map(r => renderRow(r, true)).join('')}</tbody>
            </table></div>`}
      </div>
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">RESOLVED / REJECTED (${resolved.length})</span>
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.panel').querySelector('.resolved-table').classList.toggle('hidden')">TOGGLE</button>
        </div>
        <div class="resolved-table hidden">
          ${!resolved.length
            ? `<div class="empty-state" style="padding:1rem"><div class="empty-title">None yet</div></div>`
            : `<div style="overflow-x:auto"><table class="data-table">
                <thead><tr><th>ID</th><th>NAME</th><th>CAT</th><th>SUBCAT</th><th>DESCRIPTION</th><th>VOTES</th><th>BY</th><th>DATE</th><th>ACTIONS</th></tr></thead>
                <tbody>${resolved.map(r => renderRow(r, false)).join('')}</tbody>
              </table></div>`}
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error: ${e.message}</div></div>`;
  }
}

async function adminResolveMissingItem(id) {
  try {
    await api.put(`/missing-items/${id}/resolve`, {});
    showToast('Marked as resolved', 'success');
    adminTab('missing-items');
  } catch(e) { showToast(e.message, 'error'); }
}

async function adminRejectMissingItem(id) {
  if (!confirm('Reject this request?')) return;
  try {
    await api.put(`/missing-items/${id}/reject`, {});
    showToast('Marked as rejected', 'success');
    adminTab('missing-items');
  } catch(e) { showToast(e.message, 'error'); }
}

async function adminDeleteMissingItem(id) {
  if (!confirm('Delete this request permanently?')) return;
  try {
    await api.delete(`/missing-items/${id}`);
    showToast('Deleted', 'success');
    adminTab('missing-items');
  } catch(e) { showToast(e.message, 'error'); }
}


// ============================================================
// Item Reports — user-facing modal
// ============================================================

const ITEM_REPORT_REASONS = [
  'Wrong name',
  'Wrong category',
  'Duplicate entry',
  'Item removed from game',
  'Incorrect image',
  'Other',
];

function showItemReportModal(itemTypeId) {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'item-report-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <span class="modal-title">⚑ REPORT ITEM DATA</span>
        <button class="modal-close" onclick="document.getElementById('item-report-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem">
          Found a problem with this item's information? Let us know and an admin will review it.
        </p>
        <div class="form-group">
          <label class="form-label">Reason *</label>
          <select class="form-select" id="ir-reason">
            <option value="">Select a reason...</option>
            ${ITEM_REPORT_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Additional Detail</label>
          <textarea class="form-input" id="ir-detail" rows="3" placeholder="Optional — describe the issue in more detail" style="resize:vertical"></textarea>
        </div>
        <div id="ir-error" class="form-error hidden"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.5rem">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('item-report-modal').remove()">CANCEL</button>
          <button class="btn btn-primary btn-sm" onclick="submitItemReport(${itemTypeId})">SUBMIT REPORT</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitItemReport(itemTypeId) {
  const reason = document.getElementById('ir-reason').value;
  const detail = document.getElementById('ir-detail').value.trim();
  const errEl  = document.getElementById('ir-error');
  errEl.classList.add('hidden');
  if (!reason) { errEl.textContent = 'Please select a reason'; errEl.classList.remove('hidden'); return; }
  try {
    await api.post('/item-reports', { item_type_id: itemTypeId, reason, detail });
    document.getElementById('item-report-modal').remove();
    showToast('Report submitted — thank you!', 'success');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

// ============================================================
// Missing Item Request — user-facing modal
// ============================================================

function showMissingItemModal() {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'missing-item-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <span class="modal-title">? REQUEST MISSING ITEM</span>
        <button class="modal-close" onclick="document.getElementById('missing-item-modal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem">
          Can't find an item in the catalog when posting a listing? Request it here.
          Other users can upvote to help prioritize which items get added first.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group">
            <label class="form-label">Item Name *</label>
            <input type="text" class="form-input" id="mi-name" placeholder="e.g. Aves Light Helmet">
          </div>
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="form-select" id="mi-category">
              <option value="">Select...</option>
              <option value="fps-gear">FPS Gear & Armor</option>
              <option value="ships">Ships & Components</option>
              <option value="commodities">Commodities</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Subcategory (optional)</label>
          <input type="text" class="form-input" id="mi-subcat" placeholder="e.g. Helmets, Weapons, Full Ships...">
        </div>
        <div class="form-group">
          <label class="form-label">Notes (optional)</label>
          <textarea class="form-input" id="mi-desc" rows="2" placeholder="Any extra context — where it drops, patch it was added, etc." style="resize:vertical"></textarea>
        </div>
        <div id="mi-error" class="form-error hidden"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.5rem">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('missing-item-modal').remove()">CANCEL</button>
          <button class="btn btn-secondary btn-sm" onclick="showMissingItemList()">SEE ALL REQUESTS</button>
          <button class="btn btn-primary btn-sm" onclick="submitMissingItem()">SUBMIT REQUEST</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitMissingItem() {
  const name    = document.getElementById('mi-name').value.trim();
  const cat     = document.getElementById('mi-category').value;
  const subcat  = document.getElementById('mi-subcat').value.trim();
  const desc    = document.getElementById('mi-desc').value.trim();
  const errEl   = document.getElementById('mi-error');
  errEl.classList.add('hidden');
  if (!name || !cat) { errEl.textContent = 'Name and category are required'; errEl.classList.remove('hidden'); return; }
  try {
    await api.post('/missing-items', { name, category: cat, subcategory: subcat, description: desc });
    document.getElementById('missing-item-modal').remove();
    showToast('Request submitted! Others can upvote it to raise priority.', 'success');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

async function showMissingItemList() {
  document.getElementById('missing-item-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'missing-list-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <span class="modal-title">? MISSING ITEM REQUESTS</span>
        <button class="modal-close" onclick="document.getElementById('missing-list-modal').remove()">✕</button>
      </div>
      <div class="modal-body" id="missing-list-body">
        <div class="loading-overlay"><div class="spinner"></div></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  try {
    const items = await api.get('/missing-items?status=open');
    const body  = document.getElementById('missing-list-body');
    if (!items.length) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-title">No open requests</div>
        <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="document.getElementById('missing-list-modal').remove();showMissingItemModal()">+ REQUEST ITEM</button></div>`;
      return;
    }
    body.innerHTML = `
      <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem">
        Upvote items you also need — higher-voted requests get prioritized.
      </p>
      <div style="display:flex;flex-direction:column;gap:0.5rem;max-height:420px;overflow-y:auto">
        ${items.map(it => `
          <div class="missing-item-row" id="mir-${it.id}">
            <div class="mir-votes">
              <button class="btn-vote" onclick="voteMissingItem(${it.id})">▲</button>
              <span class="mir-vote-count">${it.votes}</span>
            </div>
            <div class="mir-info">
              <div class="mir-name">${escapeHtml(it.name)}</div>
              <div class="mir-meta">
                <span class="badge badge-dim">${it.category}</span>
                ${it.subcategory ? `<span class="badge badge-dim">${escapeHtml(it.subcategory)}</span>` : ''}
                <span style="color:var(--text-muted);font-size:0.68rem">by ${escapeHtml(it.requester)} · ${new Date(it.created_at).toLocaleDateString()}</span>
              </div>
              ${it.description ? `<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.25rem">${escapeHtml(it.description)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:1.25rem;text-align:right">
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('missing-list-modal').remove();showMissingItemModal()">+ REQUEST ANOTHER</button>
      </div>`;
  } catch (e) {
    document.getElementById('missing-list-body').innerHTML = `<div class="empty-state"><div class="empty-title">${e.message}</div></div>`;
  }
}

async function voteMissingItem(reqId) {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  try {
    await api.post(`/missing-items/${reqId}/vote`);
    const el = document.querySelector(`#mir-${reqId} .mir-vote-count`);
    if (el) el.textContent = parseInt(el.textContent) + 1;
    showToast('Vote recorded!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================================
// Admin: Item Reports tab
// ============================================================

async function renderAdminItemReports(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const reports = await api.get('/item-reports?resolved=0');
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">⚑ OPEN ITEM REPORTS (${reports.length})</span>
          <button class="btn btn-ghost btn-sm" onclick="adminLoadResolvedItemReports()">SHOW RESOLVED</button>
        </div>
        ${!reports.length
          ? `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-title">No open reports</div></div>`
          : `<div style="overflow-x:auto">
              <table class="data-table" id="item-reports-table">
                <thead><tr><th>ID</th><th>ITEM</th><th>CATEGORY</th><th>REASON</th><th>DETAIL</th><th>REPORTER</th><th>DATE</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  ${reports.map(r => `
                    <tr>
                      <td class="mono">#${r.id}</td>
                      <td style="font-weight:600;color:var(--text-primary)">${escapeHtml(r.item_name)}</td>
                      <td><span class="badge badge-dim">${r.category}</span></td>
                      <td><span class="badge badge-amber" style="font-size:0.65rem">${escapeHtml(r.reason)}</span></td>
                      <td style="font-size:0.78rem;color:var(--text-secondary);max-width:200px">${escapeHtml(r.detail || '—')}</td>
                      <td class="mono" style="font-size:0.75rem">${escapeHtml(r.reporter)}</td>
                      <td class="mono" style="font-size:0.7rem">${new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style="display:flex;gap:0.35rem">
                          <button class="btn btn-secondary btn-sm" onclick="adminResolveItemReport(${r.id})">RESOLVE</button>
                          <button class="btn btn-ghost btn-sm" onclick="adminEditItem(${r.item_type_id},'','','','','')">EDIT ITEM</button>
                          <button class="btn btn-danger btn-sm" onclick="adminDeleteItemReport(${r.id})">DEL</button>
                        </div>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
             </div>`}
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">${e.message}</div></div>`;
  }
}

async function adminLoadResolvedItemReports() {
  const container = document.getElementById('admin-content');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const reports = await api.get('/item-reports?resolved=1');
    const tbody = reports.map(r => `
      <tr>
        <td class="mono">#${r.id}</td>
        <td>${escapeHtml(r.item_name)}</td>
        <td><span class="badge badge-dim">${r.category}</span></td>
        <td><span class="badge badge-amber" style="font-size:0.65rem">${escapeHtml(r.reason)}</span></td>
        <td style="font-size:0.78rem;color:var(--text-secondary)">${escapeHtml(r.detail||'—')}</td>
        <td class="mono">${escapeHtml(r.reporter)}</td>
        <td class="mono">${new Date(r.created_at).toLocaleDateString()}</td>
        <td><span class="badge badge-green">RESOLVED</span></td>
      </tr>`).join('');
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">RESOLVED ITEM REPORTS (${reports.length})</span>
          <button class="btn btn-ghost btn-sm" onclick="adminTab('item-reports')">SHOW OPEN</button>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table"><thead><tr><th>ID</th><th>ITEM</th><th>CAT</th><th>REASON</th><th>DETAIL</th><th>REPORTER</th><th>DATE</th><th>STATUS</th></tr></thead>
          <tbody>${tbody}</tbody></table>
        </div>
      </div>`;
  } catch {}
}

async function adminResolveItemReport(id) {
  try {
    await api.put(`/item-reports/${id}/resolve`);
    showToast('Report resolved', 'success');
    adminTab('item-reports');
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminDeleteItemReport(id) {
  if (!confirm('Delete this report?')) return;
  try {
    await api.delete(`/item-reports/${id}`);
    showToast('Deleted', 'success');
    adminTab('item-reports');
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================================
// Admin: Missing Items tab
// ============================================================

async function renderAdminMissing(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const requests = await api.get('/missing-items?status=open');
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">? OPEN MISSING ITEM REQUESTS (${requests.length})</span>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-ghost btn-sm" onclick="adminLoadMissingStatus('resolved')">RESOLVED</button>
            <button class="btn btn-ghost btn-sm" onclick="adminLoadMissingStatus('closed')">CLOSED</button>
          </div>
        </div>
        ${!requests.length
          ? `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-title">No open requests</div></div>`
          : `<div style="display:flex;flex-direction:column;gap:0.75rem">
              ${requests.map(r => `
                <div class="missing-admin-row">
                  <div class="missing-admin-votes">
                    <span style="font-family:var(--font-display);font-size:1.4rem;color:var(--amber)">${r.votes}</span>
                    <span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted)">VOTES</span>
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${escapeHtml(r.name)}</div>
                    <div style="display:flex;gap:0.4rem;margin:0.3rem 0;flex-wrap:wrap">
                      <span class="badge badge-dim">${r.category}</span>
                      ${r.subcategory ? `<span class="badge badge-dim">${escapeHtml(r.subcategory)}</span>` : ''}
                      <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted)">by ${escapeHtml(r.requester)} · ${new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    ${r.description ? `<div style="font-size:0.8rem;color:var(--text-secondary)">${escapeHtml(r.description)}</div>` : ''}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:0.4rem;min-width:100px">
                    <button class="btn btn-secondary btn-sm" onclick="adminResolveMissing(${r.id})">✓ RESOLVE</button>
                    <button class="btn btn-ghost btn-sm" onclick="adminCloseMissing(${r.id})">✕ CLOSE</button>
                    <button class="btn btn-primary btn-sm" onclick="adminAddItemFromRequest('${escapeHtml(r.name)}','${r.category}','${escapeHtml(r.subcategory||'')}',${r.id})">+ ADD ITEM</button>
                  </div>
                </div>`).join('')}
            </div>`}
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">${e.message}</div></div>`;
  }
}

async function adminLoadMissingStatus(status) {
  const container = document.getElementById('admin-content');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const requests = await api.get(`/missing-items?status=${status}`);
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">${status.toUpperCase()} REQUESTS (${requests.length})</span>
          <button class="btn btn-ghost btn-sm" onclick="adminTab('missing')">BACK TO OPEN</button>
        </div>
        ${!requests.length
          ? `<div class="empty-state"><div class="empty-title">None</div></div>`
          : `<div style="display:flex;flex-direction:column;gap:0.5rem">
              ${requests.map(r => `
                <div class="missing-admin-row" style="opacity:0.7">
                  <div class="missing-admin-votes">
                    <span style="font-family:var(--font-display);font-size:1.2rem;color:var(--text-secondary)">${r.votes}</span>
                  </div>
                  <div style="flex:1">
                    <div style="font-weight:600">${escapeHtml(r.name)}</div>
                    <div style="display:flex;gap:0.4rem;margin-top:0.2rem">
                      <span class="badge badge-dim">${r.category}</span>
                      <span class="badge ${status==='resolved'?'badge-green':'badge-red'}">${status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>`).join('')}
            </div>`}
      </div>`;
  } catch {}
}

async function adminResolveMissing(id) {
  try {
    await api.put(`/missing-items/${id}/resolve`, {});
    showToast('Marked as resolved', 'success');
    adminTab('missing');
  } catch (e) { showToast(e.message, 'error'); }
}

async function adminCloseMissing(id) {
  if (!confirm('Close/reject this request?')) return;
  try {
    await api.put(`/missing-items/${id}/close`);
    showToast('Request closed', 'success');
    adminTab('missing');
  } catch (e) { showToast(e.message, 'error'); }
}

function adminAddItemFromRequest(name, category, subcategory, reqId) {
  // Pre-fill the manual add form in the Items tab, then switch to it
  adminTab('items');
  // After the tab renders, fill the fields
  setTimeout(() => {
    const nameEl   = document.getElementById('new-item-name');
    const catEl    = document.getElementById('new-item-category');
    const subcatEl = document.getElementById('new-item-subcat');
    if (nameEl)   nameEl.value = name;
    if (catEl)  { catEl.value = category; updateAdminSubcats(); }
    if (subcatEl && subcategory) {
      // Try to select matching option, otherwise leave as-is
      const opt = [...subcatEl.options].find(o => o.value === subcategory || o.text === subcategory);
      if (opt) subcatEl.value = opt.value;
    }
    nameEl?.scrollIntoView({ behavior: 'smooth' });
    nameEl?.focus();
    showToast('Form pre-filled from request — review and click ADD ITEM', 'success');
  }, 400);
}

// ============================================================
// Notifications Tab
// ============================================================

const NOTIF_ICONS = {
  message:         '💬',
  expiring:        '⏱',
  item_added:      '✦',
  report_resolved: '✓',
  deal:            '🤝',
  system:          '📢',
};

async function loadNotificationsTab(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const data = await api.get('/notifications?limit=50');
    const notifs = data.notifications || [];

    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">🔔 NOTIFICATIONS (${data.unread} unread)</span>
          ${data.unread > 0
            ? `<button class="btn btn-ghost btn-sm" onclick="markAllNotifsRead()">MARK ALL READ</button>`
            : ''}
        </div>
        ${!notifs.length
          ? `<div class="empty-state"><div class="empty-title">No notifications yet</div></div>`
          : `<div class="notif-list">
              ${notifs.map(n => `
                <div class="notif-item ${n.read ? '' : 'notif-unread'}" id="notif-${n.id}">
                  <div class="notif-icon">${NOTIF_ICONS[n.type] || '●'}</div>
                  <div class="notif-body">
                    <div class="notif-title">${escapeHtml(n.title)}</div>
                    ${n.body ? `<div class="notif-msg">${escapeHtml(n.body)}</div>` : ''}
                    <div class="notif-time">${timeAgo(n.created_at)}</div>
                  </div>
                  <div class="notif-actions">
                    ${n.link ? `<button class="btn btn-ghost btn-sm" onclick="goNotif(${n.id},'${n.link}')">VIEW</button>` : ''}
                    ${!n.read ? `<button class="btn btn-ghost btn-sm" onclick="markNotifRead(${n.id})">✓</button>` : ''}
                    <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="deleteNotif(${n.id})">×</button>
                  </div>
                </div>`).join('')}
            </div>`}
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading notifications</div></div>`;
  }
}

async function markNotifRead(id) {
  try {
    await api.put(`/notifications/${id}/read`);
    const el = document.getElementById(`notif-${id}`);
    if (el) el.classList.remove('notif-unread');
    updateUnreadBadge();
  } catch {}
}

async function markAllNotifsRead() {
  try {
    await api.put('/notifications/read-all');
    document.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
    updateUnreadBadge();
    showToast('All notifications marked read', 'success');
  } catch {}
}

async function deleteNotif(id) {
  try {
    await api.delete(`/notifications/${id}`);
    document.getElementById(`notif-${id}`)?.remove();
  } catch {}
}

function goNotif(id, link) {
  markNotifRead(id);
  Router.navigate(link);
}

// ============================================================
// Deal Flow
// ============================================================

const DEAL_STATUS_LABELS = {
  pending_seller: { label: 'AWAITING SELLER',  color: 'var(--amber)',         icon: '⏳' },
  in_progress:    { label: 'IN PROGRESS',       color: 'var(--amber-bright)',  icon: '🔄' },
  pending_buyer:  { label: 'CONFIRM RECEIPT',   color: 'var(--success-bright)', icon: '📦' },
  completed:      { label: 'COMPLETED',          color: 'var(--success-bright)', icon: '✓' },
  declined:       { label: 'DECLINED',           color: 'var(--error)',          icon: '✕' },
  disputed:       { label: 'DISPUTED',           color: 'var(--error)',          icon: '⚑' },
};

async function loadDealsTab(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const deals = await api.get('/deals');
    const buying  = deals.filter(d => d.buyer_id  === Auth.user.id);
    const selling = deals.filter(d => d.seller_id === Auth.user.id);

    const renderDeal = (d) => {
      const st  = DEAL_STATUS_LABELS[d.status] || { label: d.status, color: 'var(--text-dim)', icon: '?' };
      const isBuyer = d.buyer_id === Auth.user.id;
      const actions = dealActions(d, isBuyer);
      return `
        <div class="deal-card" id="deal-${d.id}">
          <div class="deal-img">
            ${d.listing_image
              ? `<img src="${escapeHtml(d.listing_image)}" style="width:100%;height:100%;object-fit:cover">`
              : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim)">◆</div>`}
          </div>
          <div class="deal-body">
            <div style="font-weight:700;color:var(--text-primary);margin-bottom:0.2rem">
              <a onclick="Router.navigate('/listing/${d.listing_id}')" style="cursor:pointer;color:var(--text-primary)">${escapeHtml(d.listing_title)}</a>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.4rem">
              ${isBuyer ? `Seller: <b>${escapeHtml(d.seller_name)}</b>` : `Buyer: <b>${escapeHtml(d.buyer_name)}</b>`}
              · Qty: ${d.quantity}
              · ${timeAgo(d.created_at)}
            </div>
            ${d.buyer_message ? `<div style="font-size:0.78rem;color:var(--text-dim);font-style:italic;margin-bottom:0.4rem">"${escapeHtml(d.buyer_message)}"</div>` : ''}
          </div>
          <div class="deal-status">
            <span style="font-family:var(--font-mono);font-size:0.68rem;color:${st.color}">${st.icon} ${st.label}</span>
            <div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.5rem">${actions}</div>
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="panel" style="margin-bottom:1.25rem">
        <div class="panel-title" style="margin-bottom:1rem">AS BUYER (${buying.length})</div>
        ${!buying.length
          ? `<div class="empty-state" style="padding:1rem"><div class="empty-title">No deals as buyer</div></div>`
          : buying.map(renderDeal).join('')}
      </div>
      <div class="panel">
        <div class="panel-title" style="margin-bottom:1rem">AS SELLER (${selling.length})</div>
        ${!selling.length
          ? `<div class="empty-state" style="padding:1rem"><div class="empty-title">No deals as seller</div></div>`
          : selling.map(renderDeal).join('')}
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading deals: ${e.message}</div></div>`;
  }
}

function dealActions(d, isBuyer) {
  const btns = [];
  // Always show a full deal flow button
  btns.push(`<button class="btn btn-ghost btn-sm" onclick="showDealStatusModal(${d.id})" style="font-size:0.68rem">⬡ VIEW DEAL</button>`);

  if (!isBuyer && d.status === 'pending_seller') {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="dealAction(${d.id},'accept')">ACCEPT</button>`);
    btns.push(`<button class="btn btn-danger btn-sm" onclick="dealAction(${d.id},'decline')">DECLINE</button>`);
  }
  if (!isBuyer && d.status === 'in_progress') {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="dealAction(${d.id},'delivered')">MARK DELIVERED</button>`);
  }
  if (isBuyer && d.status === 'pending_buyer') {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="dealAction(${d.id},'confirm')">✓ CONFIRM RECEIPT</button>`);
    btns.push(`<button class="btn btn-danger btn-sm" onclick="dealAction(${d.id},'dispute')">⚑ DISPUTE</button>`);
  }
  if (d.status === 'completed') {
    btns.push(`<button class="btn btn-ghost btn-sm" onclick="checkAndRate(${d.id},${isBuyer?d.seller_id:d.buyer_id},'${isBuyer?d.seller_name:d.buyer_name}',${d.listing_id})">★ RATE</button>`);
  }
  return btns.join('');
}

async function dealAction(dealId, action) {
  const labels = { accept:'Accept deal?', decline:'Decline deal?', delivered:'Mark as delivered?',
                   confirm:'Confirm receipt? This will complete the deal.', dispute:'Open a dispute?' };
  if (!confirm(labels[action] || 'Are you sure?')) return;
  try {
    const data = await api.put(`/deals/${dealId}/${action}`);
    showToast(`Deal ${data.status.replace('_',' ')}`, 'success');
    profileTab('deals');
  } catch(e) { showToast(e.message, 'error'); }
}

async function checkAndRate(dealId, targetId, targetName, listingId) {
  try {
    const data = await api.get(`/deals/${dealId}/can-rate`);
    if (!data.can_rate) { showToast(data.reason || 'Cannot rate this deal', 'error'); return; }
    showRatingModal(targetId, targetName, listingId);
  } catch(e) { showToast(e.message, 'error'); }
}

function showRatingModal(sellerId, sellerName, listingId) {
  let selected = 0;
  const modal = createModal(`RATE @${escapeHtml(sellerName)}`, `
    <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem">
      Rate this trader based on your completed deal.
      Verified ratings help build trust in the community.
    </p>
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem;justify-content:center" id="star-row">
      ${[1,2,3,4,5].map(n => `
        <button onclick="selectStar(${n})" id="star-${n}"
          style="font-size:1.8rem;background:none;border:none;cursor:pointer;color:var(--text-dim);transition:color 0.1s">☆</button>
      `).join('')}
    </div>
    <div class="form-group">
      <label class="form-label">Comment (optional)</label>
      <textarea class="form-input" id="rating-comment" rows="3" placeholder="Describe your experience..." maxlength="500" style="resize:vertical"></textarea>
    </div>
    <div id="rating-error" class="form-error hidden"></div>
  `, async () => {
    const score   = parseInt(document.querySelector('[data-star-selected]')?.dataset.starSelected || '0');
    const comment = document.getElementById('rating-comment').value.trim();
    const errEl   = document.getElementById('rating-error');
    if (!score) {
      errEl.textContent = 'Please select a star rating';
      errEl.classList.remove('hidden');
      throw new Error('validation');
    }
    await api.post('/ratings', { seller_id: sellerId, listing_id: listingId, score, comment });
    showToast('Rating submitted!', 'success');
    closeModal();
  }, 'SUBMIT RATING');
  document.body.appendChild(modal);
}

function selectStar(n) {
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`star-${i}`);
    if (btn) {
      btn.textContent = i <= n ? '★' : '☆';
      btn.style.color = i <= n ? 'var(--amber-bright)' : 'var(--text-dim)';
      if (i === n) btn.dataset.starSelected = n;
      else delete btn.dataset;
    }
  }
  // Store on last selected
  const last = document.getElementById(`star-${n}`);
  if (last) last.dataset.starSelected = n;
}

// ============================================================
// Deal Flow Modal — multi-step (Initiate → Pending → Delivered → Complete)
// ============================================================

function showDealModal(listingId, title, price, currency, listingType) {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  _renderDealStep('initiate', { listingId, title, price, currency, listingType });
}

async function showDealStatusModal(dealId) {
  try {
    const deal = await api.get(`/deals/${dealId}`);
    _renderDealStep(deal.status, { deal });
  } catch(e) { showToast(e.message || 'Failed to load deal', 'error'); }
}

function _dealStepBar(step) {
  const STEPS = [
    { key: 'initiate',       label: 'INITIATE' },
    { key: 'pending_seller', label: 'PENDING'  },
    { key: 'in_progress',    label: 'ACCEPTED' },
    { key: 'pending_buyer',  label: 'DELIVERED'},
    { key: 'completed',      label: 'COMPLETE' },
  ];
  const ORDER = STEPS.map(s => s.key);
  const cur   = ORDER.indexOf(step);
  return `
    <div style="display:flex;align-items:center;margin-bottom:1.25rem;gap:0">
      ${STEPS.map((s, i) => {
        const done    = i < cur;
        const active  = i === cur;
        const color   = done ? 'var(--success-bright)' : active ? 'var(--amber-bright)' : 'var(--text-dim)';
        const bdr     = done ? 'var(--success-bright)' : active ? 'var(--amber-bright)' : 'var(--border)';
        const bg      = done ? 'rgba(74,222,128,.12)' : active ? 'rgba(168,85,247,.15)' : 'transparent';
        const dot     = `<div style="width:28px;height:28px;border-radius:50%;border:1.5px solid ${bdr};background:${bg};display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:.65rem;color:${color};flex-shrink:0">${done ? '✓' : i+1}</div>`;
        const lbl     = `<div style="font-family:var(--font-mono);font-size:.52rem;color:${color};text-align:center;margin-top:3px;letter-spacing:.08em">${s.label}</div>`;
        const line    = i < STEPS.length - 1
          ? `<div style="flex:1;height:1px;background:${done ? 'var(--success-bright)' : 'var(--border)'};opacity:${done?1:.4}"></div>`
          : '';
        return `<div style="display:flex;flex-direction:column;align-items:center">${dot}${lbl}</div>${line}`;
      }).join('')}
    </div>`;
}

function _renderDealStep(step, ctx) {
  const { listingId, title, price, currency, listingType, deal } = ctx;
  const priceLabel = listingType === 'WTB' ? 'Your asking price'
    : listingType === 'WTT' ? 'Trade value' : 'Asking price';
  const priceDisp = (price > 0)
    ? `${(price||0).toLocaleString()} ${currency||'aUEC'}` : 'NEGOTIABLE';

  let body = _dealStepBar(step === 'initiate' ? 'initiate' : step);

  if (step === 'initiate') {
    body += `
      <div style="background:var(--bg-dark);border:1px solid var(--border);padding:.72rem 1rem;margin-bottom:1rem;font-family:var(--font-mono);font-size:.8rem">
        <span style="color:var(--text-dim)">${priceLabel}:</span>
        <span style="color:var(--gold);font-weight:700;margin-left:.5rem">${priceDisp}</span>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input type="number" class="form-input" id="deal-qty" value="1" min="1" style="width:100px">
      </div>
      <div class="form-group">
        <label class="form-label">Message to seller (optional)</label>
        <textarea class="form-textarea" id="deal-msg" rows="3" placeholder="Preferred meeting location, questions, etc." maxlength="500"></textarea>
      </div>
      <div id="deal-error" class="form-error hidden"></div>
      <p style="color:var(--text-dim);font-size:.74rem;margin-top:.5rem">
        The seller will receive a notification and can accept or decline.
      </p>`;

    const modal = createModal(`DEAL: ${escapeHtml(title || '')}`, body, async () => {
      const qty    = parseInt(document.getElementById('deal-qty')?.value) || 1;
      const msg    = document.getElementById('deal-msg')?.value.trim() || '';
      const errEl  = document.getElementById('deal-error');
      try {
        await api.post('/deals', { listing_id: listingId, quantity: qty, message: msg });
        showToast('Deal request sent! Track it in your Deals tab.', 'success');
        closeModal();
      } catch(e) {
        if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
        throw e;
      }
    }, 'SEND DEAL REQUEST');
    document.body.appendChild(modal);
    return;
  }

  // ── Active deal display ──────────────────────────────
  if (!deal) return;

  const isBuyer  = deal.buyer_id  === Auth.user?.id;
  const isSeller = deal.seller_id === Auth.user?.id;

  const STATUS_INFO = {
    pending_seller: { label: 'AWAITING SELLER',  color: 'var(--amber)',         desc: isSeller ? 'You have a new deal request. Accept or decline below.' : 'Waiting for the seller to accept your request.' },
    in_progress:    { label: 'IN PROGRESS',       color: 'var(--amber-bright)',  desc: isSeller ? 'Mark as delivered once you\'ve fulfilled the order.' : 'The seller has accepted. Awaiting delivery.' },
    pending_buyer:  { label: 'AWAITING CONFIRM',  color: 'var(--success-bright)', desc: isBuyer  ? 'Confirm receipt to complete the deal and release funds.' : 'Waiting for the buyer to confirm delivery.' },
    completed:      { label: 'COMPLETED',          color: 'var(--success-bright)', desc: 'Deal complete. Thank you for trading on Serpent\'s Hold!' },
    declined:       { label: 'DECLINED',           color: 'var(--red)',            desc: 'This deal was declined by the seller.' },
    disputed:       { label: 'DISPUTED',           color: 'var(--red)',            desc: 'This deal is under dispute review.' },
  };

  const info = STATUS_INFO[step] || { label: step.toUpperCase(), color: 'var(--text-dim)', desc: '' };

  body += `
    <div style="border:1px solid var(--border);background:var(--bg-dark);padding:.75rem 1rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
        <span style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-dim)">DEAL #${deal.id}</span>
        <span style="font-family:var(--font-mono);font-size:.7rem;color:${info.color};border:1px solid ${info.color};padding:2px 8px">${info.label}</span>
      </div>
      <div style="font-size:.88rem;color:var(--text-primary);margin-bottom:.25rem">${escapeHtml(deal.listing_title || 'Listing')}</div>
      <div style="font-family:var(--font-mono);font-size:.78rem;color:var(--gold)">${deal.price > 0 ? deal.price.toLocaleString()+' '+(deal.currency||'aUEC') : 'NEGOTIABLE'} × ${deal.quantity || 1}</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:1rem;font-size:.8rem">
      <div><span style="color:var(--text-dim);font-family:var(--font-mono);font-size:.6rem">BUYER</span><br>@${escapeHtml(deal.buyer_name||'')}</div>
      <div style="color:var(--text-dim)">⇌</div>
      <div style="text-align:right"><span style="color:var(--text-dim);font-family:var(--font-mono);font-size:.6rem">SELLER</span><br>@${escapeHtml(deal.seller_name||'')}</div>
    </div>
    <p style="color:var(--text-dim);font-size:.78rem;margin-bottom:1rem">${info.desc}</p>`;

  // Action buttons based on role + step
  const actions = [];
  if (step === 'pending_seller' && isSeller) {
    actions.push(`<button class="btn btn-primary" onclick="_dealAction(${deal.id},'accept')">✓ ACCEPT DEAL</button>`);
    actions.push(`<button class="btn btn-secondary" style="color:var(--red)" onclick="_dealAction(${deal.id},'decline')">✕ DECLINE</button>`);
  }
  if (step === 'in_progress' && isSeller) {
    actions.push(`<button class="btn btn-primary" onclick="_dealAction(${deal.id},'delivered')">⬡ MARK DELIVERED</button>`);
  }
  if (step === 'pending_buyer' && isBuyer) {
    actions.push(`<button class="btn btn-primary" onclick="_dealAction(${deal.id},'confirm')">✓ CONFIRM RECEIPT</button>`);
    actions.push(`<button class="btn btn-secondary" style="color:var(--red)" onclick="_dealAction(${deal.id},'dispute')">⚑ DISPUTE</button>`);
  }
  if (step === 'completed' && !deal.rating_given) {
    body += `
      <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:.5rem">
        <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text-dim);margin-bottom:.6rem">LEAVE A RATING</div>
        <div id="star-rating" style="display:flex;gap:.35rem;margin-bottom:.6rem">
          ${[1,2,3,4,5].map(n => `<button onclick="_setDealStar(${n})" id="star-${n}" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-dim);transition:color .15s">★</button>`).join('')}
        </div>
        <textarea class="form-textarea" id="deal-review" rows="2" placeholder="Optional comment…" maxlength="300"></textarea>
      </div>`;
    actions.push(`<button class="btn btn-primary" onclick="_submitDealRating(${deal.id}, ${isBuyer ? deal.seller_id : deal.buyer_id})">SUBMIT RATING</button>`);
  }

  if (actions.length) {
    body += `<div id="deal-action-error" class="form-error hidden"></div><div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-top:.75rem">${actions.join('')}</div>`;
  }

  const modal = createModal(`DEAL #${deal.id}`, body);
  document.body.appendChild(modal);
}

let _dealStarVal = 0;
function _setDealStar(n) {
  _dealStarVal = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`star-${i}`);
    if (el) el.style.color = i <= n ? 'var(--amber)' : 'var(--text-dim)';
  }
}

async function _dealAction(dealId, action) {
  const errEl = document.getElementById('deal-action-error');
  try {
    await api.put(`/deals/${dealId}/${action}`, {});
    const labels = { accept:'Deal accepted!', decline:'Deal declined.', delivered:'Marked as delivered!', confirm:'Deal complete!', dispute:'Dispute opened.' };
    showToast(labels[action] || 'Updated', action === 'decline' || action === 'dispute' ? 'warning' : 'success');
    closeModal();
    // refresh deal list if on profile page
    if (typeof profileTab === 'function' && document.getElementById('profile-deals-list')) {
      profileTab('deals');
    }
  } catch(e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
    else showToast(e.message || 'Action failed', 'error');
  }
}

async function _submitDealRating(dealId, rateeId) {
  if (!_dealStarVal) { showToast('Please select a star rating', 'warning'); return; }
  const comment = document.getElementById('deal-review')?.value.trim() || '';
  try {
    await api.post('/ratings', { deal_id: dealId, ratee_id: rateeId, score: _dealStarVal, comment });
    showToast('Rating submitted!', 'success');
    closeModal();
    _dealStarVal = 0;
  } catch(e) { showToast(e.message || 'Failed to submit rating', 'error'); }
}

// ============================================================
// Bulk Listing Management
// ============================================================

function bulkListingRow(l) {
  const statusColor = { active: 'var(--success-bright)', sold: 'var(--text-dim)', expired: 'var(--error)' }[l.status] || 'var(--text-dim)';
  const img = l.image_url
    ? `<img src="${escapeHtml(l.image_url)}" style="width:40px;height:40px;object-fit:cover;border:1px solid var(--border)">`
    : `<div style="width:40px;height:40px;background:var(--bg-void);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.8rem">◆</div>`;

  return `
    <div class="bulk-row" id="bulk-row-${l.id}">
      <input type="checkbox" class="bulk-checkbox" data-id="${l.id}" onchange="updateBulkCount()">
      ${img}
      <div class="bulk-row-info">
        <div class="bulk-row-title">
          <a onclick="Router.navigate('/listing/${l.id}')" style="cursor:pointer;color:var(--text-primary)">${escapeHtml(l.title)}</a>
        </div>
        <div style="font-size:0.72rem;color:var(--text-dim);font-family:var(--font-mono)">
          <span style="color:${statusColor}">${l.status.toUpperCase()}</span>
          · ${l.price > 0 ? l.price.toLocaleString() + ' ' + l.currency : 'NEGOTIABLE'}
          · QTY: ${l.quantity}
          · ${l.views} views
          · ${timeAgo(l.created_at)}
          ${l.expires_at ? ` · expires ${timeAgo(l.expires_at)}` : ''}
        </div>
      </div>
      <div class="bulk-row-actions">
        <button class="btn btn-ghost btn-sm" onclick="showEditListing(${l.id})" title="Edit">✎</button>
        <button class="btn btn-ghost btn-sm" onclick="singleRenew(${l.id})" title="Renew">↺</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="singleDelete(${l.id})" title="Delete">✕</button>
      </div>
    </div>`;
}

function getCheckedIds() {
  return [...document.querySelectorAll('.bulk-checkbox:checked')].map(el => parseInt(el.dataset.id));
}

function updateBulkCount() {
  const ids    = getCheckedIds();
  const count  = ids.length;
  const el     = document.getElementById('bulk-count');
  if (el) el.textContent = `${count} selected`;

  ['bulk-renew-btn','bulk-price-btn','bulk-delete-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = count === 0;
  });

  const allBox = document.getElementById('bulk-select-all');
  const total  = document.querySelectorAll('.bulk-checkbox').length;
  if (allBox) allBox.indeterminate = count > 0 && count < total;
  if (allBox) allBox.checked = count > 0 && count === total;
}

function bulkSelectAll(checked) {
  document.querySelectorAll('.bulk-checkbox').forEach(el => { el.checked = checked; });
  updateBulkCount();
}

async function bulkRenew() {
  const ids = getCheckedIds();
  if (!ids.length) return;
  if (!confirm(`Renew ${ids.length} listing${ids.length!==1?'s':''}?`)) return;
  let ok = 0, fail = 0;
  for (const id of ids) {
    try { await api.post(`/listings/${id}/renew`); ok++; }
    catch { fail++; }
  }
  showToast(`Renewed ${ok}${fail ? `, ${fail} failed` : ''} listing${ok!==1?'s':''}`, fail ? 'error' : 'success');
  profileTab('listings');
}

async function bulkDelete() {
  const ids = getCheckedIds();
  if (!ids.length) return;
  if (!confirm(`Permanently delete ${ids.length} listing${ids.length!==1?'s':''}? This cannot be undone.`)) return;
  let ok = 0, fail = 0;
  for (const id of ids) {
    try { await api.delete(`/listings/${id}`); ok++; }
    catch { fail++; }
  }
  showToast(`Deleted ${ok}${fail ? `, ${fail} failed` : ''} listing${ok!==1?'s':''}`, fail ? 'error' : 'success');
  profileTab('listings');
}

function showBulkPriceEdit() {
  const ids = getCheckedIds();
  if (!ids.length) return;
  const modal = createModal('BULK PRICE EDIT', `
    <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1rem">
      Set a new price for <b style="color:var(--text-primary)">${ids.length} listing${ids.length!==1?'s':''}</b>.
      Leave blank to keep existing prices.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">New Price</label>
        <input type="number" class="form-input" id="bulk-new-price" min="0" placeholder="0 = negotiable">
      </div>
      <div class="form-group">
        <label class="form-label">Currency</label>
        <select class="form-select" id="bulk-new-currency">
          <option value="aUEC">aUEC</option>
          <option value="USD">USD</option>
          <option value="Credits">Credits</option>
        </select>
      </div>
    </div>
    <div id="bulk-price-error" class="form-error hidden"></div>
  `, async () => {
    const price    = document.getElementById('bulk-new-price').value;
    const currency = document.getElementById('bulk-new-currency').value;
    const errEl    = document.getElementById('bulk-price-error');
    if (price === '') {
      errEl.textContent = 'Enter a price (or 0 for negotiable)';
      errEl.classList.remove('hidden');
      throw new Error('validation');
    }
    const fd = new FormData();
    fd.append('price', price);
    fd.append('currency', currency);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await api.put(`/listings/${id}`, fd, true); ok++; }
      catch { fail++; }
    }
    showToast(`Updated price on ${ok}${fail?`, ${fail} failed`:''} listing${ok!==1?'s':''}`, fail?'error':'success');
    closeModal();
    profileTab('listings');
  }, 'APPLY TO SELECTED');
  document.body.appendChild(modal);
}

async function singleRenew(id) {
  try {
    await api.post(`/listings/${id}/renew`);
    showToast('Listing renewed', 'success');
    profileTab('listings');
  } catch(e) { showToast(e.message, 'error'); }
}

async function singleDelete(id) {
  if (!confirm('Delete this listing?')) return;
  try {
    await api.delete(`/listings/${id}`);
    document.getElementById(`bulk-row-${id}`)?.remove();
    updateBulkCount();
    showToast('Listing deleted', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// ============================================================
// Seller Storefront  /seller/:username
// ============================================================



function profileListingsPage(page) {
  window._myListingsPage = page;
  profileTab('listings');
}
async function renderSellerStorefront(parts) {
  const username = parts[1];
  const content  = document.getElementById('main-content');

  if (!username) { Router.navigate('/'); return; }

  content.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> LOADING PROFILE...</div>`;

  try {
    const [profile, listingsData] = await Promise.all([
      api.get(`/auth/public/${encodeURIComponent(username)}`),
      api.get(`/listings?seller_id=0`), // placeholder — overwritten below
    ]);

    // Fetch actual listings by seller id now that we have it
    const ld = await api.get(`/listings?seller_id=${profile.id}&limit=20&sort=newest`);
    const listings = ld.listings || [];
    const listingsMeta = { total: ld.total, pages: ld.pages, sellerId: profile.id };

    const stars = (avg) => {
      if (!avg) return '<span style="color:var(--text-dim)">No ratings yet</span>';
      const full  = Math.floor(avg);
      const half  = avg - full >= 0.5 ? 1 : 0;
      const empty = 5 - full - half;
      return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
        + ` <span style="color:var(--text-dim)">(${avg} · ${profile.rating_count} review${profile.rating_count!==1?'s':''})</span>`;
    };

    // Group active/sold/other
    const active = listings.filter(l => l.status === 'active');
    const sold   = listings.filter(l => l.status === 'sold');

    content.innerHTML = `
      <div style="margin-bottom:1.5rem">
        <button class="btn btn-ghost btn-sm" onclick="history.back()">← BACK</button>
      </div>

      <!-- Profile Header -->
      <div class="storefront-header">
        <div class="storefront-avatar">
          ${profile.avatar_url
            ? `<img src="${escapeHtml(profile.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span style="font-size:2rem">${escapeHtml(profile.username[0].toUpperCase())}</span>`}
        </div>
        <div class="storefront-meta">
          <h1 class="storefront-name">
            @${escapeHtml(profile.username)}
            ${profile.rsi_verified ? '<span class="storefront-verified" title="RSI Verified">✓ RSI</span>' : ''}
            ${profile.role === 'admin' || profile.role === 'moderator'
              ? `<span class="badge badge-amber" style="font-size:0.65rem;vertical-align:middle">${profile.role.toUpperCase()}</span>`
              : ''}
          </h1>
          <div class="storefront-stars">${stars(profile.rating_avg)}</div>
          ${profile.trust ? trustBadge(profile.trust) : ''}
          <div class="storefront-stats">
            <span>📦 <b>${profile.active_listings}</b> active listing${profile.active_listings!==1?'s':''}</span>
            <span>🤝 <b>${profile.completed_deals}</b> completed deal${profile.completed_deals!==1?'s':''}</span>
            <span>⌚ Last active ${lastActiveLabel(profile.last_active_at)}</span>
            <span>📅 Member since ${new Date(profile.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
          </div>
          ${profile.bio ? `<p class="storefront-bio">${escapeHtml(profile.bio)}</p>` : ''}
          ${profile.rsi_handle ? `
            <a href="https://robertsspaceindustries.com/citizens/${encodeURIComponent(profile.rsi_handle)}"
               target="_blank" class="storefront-rsi-link">
              RSI: ${escapeHtml(profile.rsi_handle)} ↗
            </a>` : ''}
        </div>
        ${Auth.isLoggedIn && Auth.user?.username !== username ? `
          <div class="storefront-contact">
            <button class="btn btn-secondary btn-sm" onclick="showDmModal('${escapeHtml(profile.username)}',${profile.id})">✉ MESSAGE</button>
          </div>` : ''}
      </div>

      <!-- Tabs -->
      <div class="tabs" style="margin-bottom:1.5rem">
        <button class="tab-btn active" id="st-tab-listings" onclick="storefrontTab('listings',${profile.id},'${escapeHtml(profile.username)}')">
          LISTINGS (${active.length})
        </button>
        <button class="tab-btn" id="st-tab-reviews" onclick="storefrontTab('reviews',${profile.id},'${escapeHtml(profile.username)}')">
          REVIEWS (${profile.rating_count})
        </button>
        ${sold.length ? `
        <button class="tab-btn" id="st-tab-sold" onclick="storefrontTab('sold',${profile.id},'${escapeHtml(profile.username)}')">
          SOLD (${sold.length})
        </button>` : ''}
      </div>
      <div id="storefront-tab-content"></div>
    `;

    // Store for tab switching
    window._storefrontData = { profile, listings, reviews: profile.reviews || [], listingsMeta };
    storefrontTab('listings', profile.id, profile.username);

  } catch(e) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">User not found</div>
        <div class="empty-sub">@${escapeHtml(username)} doesn't exist or has been banned.</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:1rem" onclick="Router.navigate('/')">BACK TO MARKET</button>
      </div>`;
  }
}


async function storefrontPage(page) {
  const d = window._storefrontData;
  if (!d) return;
  const ld = await api.get(`/listings?seller_id=${d.listingsMeta.sellerId}&limit=20&page=${page}&sort=newest`);
  d.listings = ld.listings || [];
  d.listingsMeta = { ...d.listingsMeta, pages: ld.pages, total: ld.total };
  d._listingsPage = page;
  storefrontTab('listings', d.listingsMeta.sellerId, d.profile.username);
}
function storefrontTab(tab, sellerId, username) {
  ['listings','reviews','sold'].forEach(t => {
    const btn = document.getElementById(`st-tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });

  const container = document.getElementById('storefront-tab-content');
  if (!container) return;

  const { listings, reviews } = window._storefrontData || {};

  if (tab === 'listings') {
    const active = (listings || []).filter(l => l.status === 'active');
    const meta   = (window._storefrontData || {}).listingsMeta || {};
    const curPage = (window._storefrontData || {})._listingsPage || 1;
    container.innerHTML = !active.length
      ? `<div class="empty-state"><div class="empty-title">No active listings</div></div>`
      : `<div class="listings-grid">${active.map(listingCard).join('')}</div>`
        + (meta.pages > 1 ? buildPagination(curPage, meta.pages, {}, 'storefrontPage') : '');
  }

  else if (tab === 'sold') {
    const sold = (listings || []).filter(l => l.status === 'sold');
    container.innerHTML = !sold.length
      ? `<div class="empty-state"><div class="empty-title">No sold listings</div></div>`
      : `<div class="listings-grid listings-grid-sm">${sold.map(listingCard).join('')}</div>`;
  }

  else if (tab === 'reviews') {
    if (!reviews || !reviews.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-title">No reviews yet</div></div>`;
      return;
    }
    container.innerHTML = `
      <div class="reviews-list">
        ${reviews.map(r => `
          <div class="review-card">
            <div class="review-header">
              <span class="review-stars">${'★'.repeat(r.score)}${'☆'.repeat(5-r.score)}</span>
              <span class="review-author">@${escapeHtml(r.reviewer_name)}</span>
              <span class="review-listing">on <i>${escapeHtml(r.listing_title)}</i></span>
              <span class="review-time">${timeAgo(r.created_at)}</span>
            </div>
            ${r.comment ? `<p class="review-body">${escapeHtml(r.comment)}</p>` : ''}
          </div>`).join('')}
      </div>`;
  }
}

function showDmModal(username, userId) {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  const modal = createModal(`MESSAGE @${escapeHtml(username)}`, `
    <div class="form-group">
      <label class="form-label">Message</label>
      <textarea class="form-input" id="dm-body" rows="4" placeholder="Write your message..." maxlength="1000" style="resize:vertical"></textarea>
    </div>
    <div id="dm-error" class="form-error hidden"></div>
  `, async () => {
    const body  = document.getElementById('dm-body').value.trim();
    const errEl = document.getElementById('dm-error');
    if (!body) { errEl.textContent = 'Message cannot be empty'; errEl.classList.remove('hidden'); throw new Error('v'); }
    await api.post('/dm', { recipient_id: userId, body });
    showToast(`Message sent to @${username}`, 'success');
    closeModal();
  }, 'SEND MESSAGE');
  document.body.appendChild(modal);
}

// ============================================================
// Admin — API Keys Management
// ============================================================

async function renderAdminApiKeys(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const keys = await api.get('/v1/keys');

    container.innerHTML = `
      <div class="panel" style="margin-bottom:1.5rem">
        <div class="panel-header">
          <span class="panel-title">⌥ PUBLIC API KEYS</span>
        </div>
        <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:1.25rem">
          Issue API keys for Discord bots, external tools, or community integrations.
          Keys allow read-only access to <code style="color:var(--amber-bright)">/api/v1/*</code> endpoints.
          Keys are shown only once at creation — store them securely.
        </p>

        <!-- Docs snippet -->
        <div style="background:var(--bg-void);border:1px solid var(--border);padding:0.85rem 1rem;margin-bottom:1.25rem;font-family:var(--font-mono);font-size:0.72rem;color:var(--text-secondary)">
          <div style="color:var(--text-dim);margin-bottom:0.4rem"># Example usage</div>
          <div>curl -H "X-API-Key: YOUR_KEY" ${location.origin}/api/v1/listings?category=ships</div>
          <div style="margin-top:0.3rem">curl "${location.origin}/api/v1/status"  # no key needed</div>
        </div>

        <!-- Create new key form -->
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border)">
          <div class="form-group" style="margin:0;flex:1;min-width:160px">
            <label class="form-label">Key Name</label>
            <input type="text" class="form-input" id="new-key-name" placeholder="e.g. Discord Bot, Price Tracker">
          </div>
          <div class="form-group" style="margin:0;flex:2;min-width:200px">
            <label class="form-label">Notes (optional)</label>
            <input type="text" class="form-input" id="new-key-notes" placeholder="Who / what this key is for">
          </div>
          <button class="btn btn-primary btn-sm" onclick="createApiKey()">+ GENERATE KEY</button>
        </div>
        <div id="new-key-reveal" style="display:none"></div>

        <!-- Keys table -->
        ${!keys.length
          ? `<div class="empty-state" style="padding:1rem"><div class="empty-title">No API keys yet</div></div>`
          : `<table class="admin-table" style="width:100%">
              <thead><tr>
                <th>NAME</th><th>NOTES</th><th>USES</th><th>LAST USED</th><th>STATUS</th><th>CREATED</th><th></th>
              </tr></thead>
              <tbody>
                ${keys.map(k => `
                  <tr id="api-key-row-${k.id}" style="${k.active ? '' : 'opacity:0.4'}">
                    <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-primary)">${escapeHtml(k.name)}</td>
                    <td style="font-size:0.78rem;color:var(--text-secondary)">${escapeHtml(k.notes||'—')}</td>
                    <td style="font-family:var(--font-mono);font-size:0.78rem">${k.uses}</td>
                    <td style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim)">${k.last_used_at ? timeAgo(k.last_used_at) : 'Never'}</td>
                    <td><span style="font-family:var(--font-mono);font-size:0.68rem;color:${k.active?'var(--success-bright)':'var(--error)'}">${k.active?'● ACTIVE':'● REVOKED'}</span></td>
                    <td style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim)">${timeAgo(k.created_at)}</td>
                    <td>${k.active ? `<button class="btn btn-danger btn-sm" onclick="revokeApiKey(${k.id})">REVOKE</button>` : ''}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`}
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error: ${e.message}</div></div>`;
  }
}

async function createApiKey() {
  const name  = document.getElementById('new-key-name')?.value.trim();
  const notes = document.getElementById('new-key-notes')?.value.trim() || '';
  if (!name) { showToast('Enter a key name', 'error'); return; }
  try {
    const data = await api.post('/v1/keys', { name, notes });
    const reveal = document.getElementById('new-key-reveal');
    if (reveal) {
      reveal.style.display = 'block';
      reveal.innerHTML = `
        <div style="background:var(--bg-void);border:1px solid var(--amber);padding:1rem;margin-bottom:1.25rem">
          <div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--amber);margin-bottom:0.4rem">⚠ COPY NOW — THIS KEY WON'T BE SHOWN AGAIN</div>
          <div style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-primary);word-break:break-all;padding:0.5rem;background:var(--bg-dark);border:1px solid var(--border)">${escapeHtml(data.key)}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:0.5rem" onclick="navigator.clipboard.writeText('${data.key}');showToast('Copied!','success')">📋 COPY</button>
        </div>`;
    }
    showToast(`Key "${name}" created`, 'success');
    document.getElementById('new-key-name').value = '';
    document.getElementById('new-key-notes').value = '';
    // Refresh the table
    setTimeout(() => adminTab('api-keys'), 1000);
  } catch(e) { showToast(e.message, 'error'); }
}

async function revokeApiKey(id) {
  if (!confirm('Revoke this API key? All requests using it will fail immediately.')) return;
  try {
    await api.delete(`/v1/keys/${id}`);
    showToast('Key revoked', 'success');
    adminTab('api-keys');
  } catch(e) { showToast(e.message, 'error'); }
}

// ============================================================
// Page: Org Profile  /org/:tag
// ============================================================


async function orgListingsPage(page) {
  const d = window._orgData;
  if (!d) return;
  const container = document.getElementById('org-tab-content');
  if (!container) return;
  container.innerHTML = '<div class="loading-overlay" style="position:relative;height:120px"><div class="spinner"></div></div>';
  try {
    const ld = await api.get(`/listings?org_id=${d.org.id}&limit=20&page=${page}&sort=newest`);
    d.listings = ld.listings || [];
    d.ldMeta   = { pages: ld.pages || 1, total: ld.total || 0 };
    d._listingsPage = page;
    orgTab('listings');
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">${e.message}</div></div>`;
  }
}
async function renderOrgPage(parts) {
  const tag     = parts[1];
  const content = document.getElementById('main-content');
  if (!tag) { Router.navigate('/'); return; }

  content.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> LOADING ORG...</div>`;

  try {
    const [org, listingsData] = await Promise.all([
      api.get(`/orgs/${encodeURIComponent(tag.toUpperCase())}`),
      api.get(`/listings?limit=50&sort=newest`),
    ]);

    // Fetch org listings (need org_id filter — use seller lookup for now via member ids)
    // Backend supports org_id filter on listings (added via org_id column)
    const ld = await api.get(`/listings?org_id=${org.id}&limit=20&sort=newest`).catch(() => ({ listings: [], pages: 1 }));
    const listings = ld.listings || [];

    const isOfficer = org.my_role === 'owner' || org.my_role === 'officer';
    const isOwner   = org.my_role === 'owner';

    content.innerHTML = `
      <div style="margin-bottom:1.5rem">
        <button class="btn btn-ghost btn-sm" onclick="history.back()">← BACK</button>
      </div>

      ${org.banner_url ? `<div style="height:140px;background:url(${escapeHtml(org.banner_url)}) center/cover;border:1px solid var(--border);margin-bottom:-44px"></div>` : ''}

      <div class="org-header">
        <div class="org-avatar">
          ${org.avatar_url
            ? `<img src="${escapeHtml(org.avatar_url)}" style="width:100%;height:100%;object-fit:cover">`
            : `<span style="font-family:var(--font-display);font-size:1.3rem;font-weight:900;color:var(--amber-bright)">[${escapeHtml(org.tag)}]</span>`}
        </div>
        <div class="org-meta">
          <div class="org-tag">[${escapeHtml(org.tag)}]</div>
          <h1 class="org-name">${escapeHtml(org.name)}</h1>
          <div class="org-stats">
            <span>👥 <b>${org.member_count}</b> member${org.member_count!==1?'s':''}</span>
            <span>📦 <b>${org.listing_count}</b> active listing${org.listing_count!==1?'s':''}</span>
          </div>
          ${org.description ? `<p class="org-bio">${escapeHtml(org.description)}</p>` : ''}
        </div>
        ${isOfficer ? `
          <div style="display:flex;gap:0.5rem;align-items:flex-start">
            <button class="btn btn-secondary btn-sm" onclick="showEditOrgModal('${escapeHtml(org.tag)}')">✎ EDIT</button>
            ${isOwner ? `<button class="btn btn-danger btn-sm" onclick="deleteOrg('${escapeHtml(org.tag)}')">DELETE ORG</button>` : ''}
          </div>` : ''}
      </div>

      <!-- Tabs -->
      <div class="tabs" style="margin:1.5rem 0">
        <button class="tab-btn active" id="ot-listings" onclick="orgTab('listings')">LISTINGS (${listings.length})</button>
        <button class="tab-btn" id="ot-members"  onclick="orgTab('members')">MEMBERS (${org.member_count})</button>
      </div>
      <div id="org-tab-content"></div>
    `;

    window._orgData = { org, listings, ldMeta: { pages: ld.pages || 1, total: ld.total || listings.length } };
    orgTab('listings');

  } catch(e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Org not found</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:1rem" onclick="Router.navigate('/')">BACK</button></div>`;
  }
}

function orgTab(tab) {
  ['listings','members'].forEach(t => {
    const btn = document.getElementById(`ot-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  const container = document.getElementById('org-tab-content');
  if (!container) return;
  const { org, listings } = window._orgData || {};

  if (tab === 'listings') {
    const meta    = (window._orgData || {}).ldMeta || {};
    const curPage = (window._orgData || {})._listingsPage || 1;
    container.innerHTML = !listings.length
      ? `<div class="empty-state"><div class="empty-title">No listings from this org yet</div></div>`
      : `<div class="listings-grid">${listings.map(listingCard).join('')}</div>`
        + (meta.pages > 1 ? buildPagination(curPage, meta.pages, {}, 'orgListingsPage') : '');
  }
  else if (tab === 'members') {
    const isOfficer = org.my_role === 'owner' || org.my_role === 'officer';
    const isOwner   = org.my_role === 'owner';
    container.innerHTML = `
      ${isOfficer ? `
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
          <input class="form-input" id="invite-username" placeholder="Username to invite" style="max-width:220px">
          <button class="btn btn-primary btn-sm" onclick="inviteOrgMember('${escapeHtml(org.tag)}')">+ INVITE</button>
        </div>` : ''}
      <div class="org-members-grid">
        ${(org.members || []).map(m => `
          <div class="org-member-card">
            <div class="org-member-avatar">
              ${m.avatar_url ? `<img src="${escapeHtml(m.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : escapeHtml(m.username[0].toUpperCase())}
            </div>
            <div>
              <div class="org-member-name" onclick="Router.navigate('/seller/${escapeHtml(m.username)}')" style="cursor:pointer">
                @${escapeHtml(m.username)}
                ${m.rsi_verified ? '<span style="color:var(--success-bright);font-size:0.65rem"> ✓</span>' : ''}
              </div>
              <div class="org-member-role ${m.role}">${m.role.toUpperCase()}</div>
            </div>
            ${isOfficer && m.role !== 'owner' ? `
              <button class="btn btn-ghost btn-sm" style="margin-left:auto;color:var(--error);font-size:0.65rem"
                onclick="removeOrgMember('${escapeHtml(org.tag)}','${escapeHtml(m.username)}')">✕</button>` : ''}
          </div>`).join('')}
      </div>`;
  }
}

// ── Org Tab in Profile ────────────────────────────────────────────────────────

async function loadOrgTab(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const orgs = await api.get('/orgs/my');
    container.innerHTML = `
      <div class="panel" style="margin-bottom:1rem">
        <div class="panel-header">
          <span class="panel-title">⬡ YOUR ORGS</span>
          <button class="btn btn-primary btn-sm" onclick="showCreateOrgModal()">⊕ CREATE ORG</button>
        </div>
        ${!orgs.length
          ? `<div class="empty-state" style="padding:1.5rem"><div class="empty-title">Not in any orgs yet</div>
              <div class="empty-sub">Create an org or ask an officer to invite you.</div></div>`
          : `<div style="display:flex;flex-direction:column;gap:0.5rem">
              ${orgs.map(o => `
                <div class="bulk-row" style="cursor:pointer" onclick="Router.navigate('/org/${o.tag}')">
                  <div class="org-avatar" style="width:40px;height:40px;font-size:0.8rem">
                    ${o.avatar_url ? `<img src="${escapeHtml(o.avatar_url)}" style="width:100%;height:100%;object-fit:cover">` : `[${escapeHtml(o.tag)}]`}
                  </div>
                  <div class="bulk-row-info">
                    <div class="bulk-row-title">[${escapeHtml(o.tag)}] ${escapeHtml(o.name)}</div>
                    <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim)">
                      Role: <span style="color:var(--amber)">${o.my_role?.toUpperCase()}</span>
                    </div>
                  </div>
                  <div class="bulk-row-actions">
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Router.navigate('/org/${o.tag}')">VIEW</button>
                    ${o.my_role !== 'owner' ? `<button class="btn btn-ghost btn-sm" style="color:var(--error)"
                      onclick="event.stopPropagation();leaveOrg('${escapeHtml(o.tag)}')">LEAVE</button>` : ''}
                  </div>
                </div>`).join('')}
            </div>`}
      </div>`;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading orgs</div></div>`;
  }
}

function showCreateOrgModal() {
  const modal = createModal('CREATE ORG', `
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">Tag <span style="color:var(--text-dim)">(2–8 chars)</span></label>
        <input class="form-input" id="org-tag" placeholder="XPRT" maxlength="8" style="text-transform:uppercase">
      </div>
      <div class="form-group">
        <label class="form-label">Org Name</label>
        <input class="form-input" id="org-name" placeholder="Expert Traders" maxlength="80">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-input" id="org-desc" rows="3" maxlength="1000" style="resize:vertical"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">Avatar URL</label>
        <input class="form-input" id="org-avatar" placeholder="https://..." type="url">
      </div>
      <div class="form-group">
        <label class="form-label">Banner URL</label>
        <input class="form-input" id="org-banner" placeholder="https://..." type="url">
      </div>
    </div>
    <div id="org-create-error" class="form-error hidden"></div>
  `, async () => {
    const tag  = document.getElementById('org-tag').value.trim().toUpperCase();
    const name = document.getElementById('org-name').value.trim();
    const errEl = document.getElementById('org-create-error');
    if (!tag || tag.length < 2) { errEl.textContent = 'Tag must be 2–8 characters'; errEl.classList.remove('hidden'); throw new Error('v'); }
    if (!name)                  { errEl.textContent = 'Name is required';            errEl.classList.remove('hidden'); throw new Error('v'); }
    try {
      const data = await api.post('/orgs', {
        tag, name,
        description: document.getElementById('org-desc').value,
        avatar_url:  document.getElementById('org-avatar').value,
        banner_url:  document.getElementById('org-banner').value,
      });
      showToast(`Org [${tag}] created!`, 'success');
      closeModal();
      Router.navigate(`/org/${tag}`);
    } catch(e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      throw e;
    }
  }, 'CREATE ORG');
  document.body.appendChild(modal);
}

async function inviteOrgMember(tag) {
  const username = document.getElementById('invite-username')?.value.trim();
  if (!username) return;
  try {
    await api.post(`/orgs/${tag}/invite`, { username });
    showToast(`@${username} invited`, 'success');
    Router.navigate(`/org/${tag}`, true);
  } catch(e) { showToast(e.message, 'error'); }
}

async function removeOrgMember(tag, username) {
  if (!confirm(`Remove @${username} from [${tag}]?`)) return;
  try {
    await api.delete(`/orgs/${tag}/members/${username}`);
    showToast(`@${username} removed`, 'success');
    Router.navigate(`/org/${tag}`, true);
  } catch(e) { showToast(e.message, 'error'); }
}

async function leaveOrg(tag) {
  if (!confirm(`Leave [${tag}]?`)) return;
  try {
    await api.delete(`/orgs/${tag}/members/${Auth.user.username}`);
    showToast(`Left [${tag}]`, 'success');
    profileTab('org');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteOrg(tag) {
  if (!confirm(`Permanently delete org [${tag}]? This cannot be undone.`)) return;
  try {
    await api.delete(`/orgs/${tag}`);
    showToast(`Org [${tag}] deleted`, 'success');
    Router.navigate('/profile');
  } catch(e) { showToast(e.message, 'error'); }
}

// ============================================================
// Admin: Dispute Queue
// ============================================================

async function renderAdminDisputes(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
  try {
    const disputes = await api.get('/deals/admin/disputed');

    if (!disputes.length) {
      container.innerHTML = `
        <div class="panel">
          <div class="panel-header"><span class="panel-title">⚖ DISPUTE QUEUE</span></div>
          <div class="empty-state" style="padding:2rem">
            <div class="empty-icon">⚖</div>
            <div class="empty-title">No open disputes</div>
            <div class="empty-sub">All deals are dispute-free.</div>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">⚖ DISPUTE QUEUE</span>
          <span class="badge badge-error">${disputes.length} open</span>
        </div>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1.25rem">
          Review each dispute and resolve it in favour of the buyer or seller.
          Both parties receive a notification when resolved.
        </p>
        <div id="dispute-list">
          ${disputes.map(d => disputeCard(d)).join('')}
        </div>
      </div>`;
  } catch(e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading disputes</div></div>`;
  }
}

function disputeCard(d) {
  const age = timeAgo(d.updated_at);
  return `
    <div class="dispute-card" id="dispute-card-${d.id}">
      <div class="dispute-card-header">
        <div style="display:flex;align-items:center;gap:0.75rem">
          ${d.listing_image ? `<img src="${escapeHtml(d.listing_image)}" class="dispute-thumb">` : `<div class="dispute-thumb" style="background:var(--bg-void);display:flex;align-items:center;justify-content:center;color:var(--text-dim)">◆</div>`}
          <div>
            <div style="font-weight:600;color:var(--text-primary)">${escapeHtml(d.listing_title)}</div>
            <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim)">
              Buyer: <span style="color:var(--amber)">@${escapeHtml(d.buyer_name)}</span>
              · Seller: <span style="color:var(--amber)">@${escapeHtml(d.seller_name)}</span>
              · Qty: ${d.quantity}
              · Opened ${age}
            </div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/listing/${d.listing_id}')">VIEW LISTING ↗</button>
      </div>

      ${d.buyer_message ? `
        <div style="background:var(--bg-dark);border:1px solid var(--border);padding:0.6rem 0.85rem;margin:0.75rem 0;font-size:0.82rem;color:var(--text-secondary)">
          <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim)">BUYER'S NOTE:</span><br>
          ${escapeHtml(d.buyer_message)}
        </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem">
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.65rem">ADMIN NOTES</label>
          <textarea class="form-input" id="dispute-notes-${d.id}" rows="2"
            style="font-size:0.8rem;resize:vertical"
            placeholder="Describe your decision…"></textarea>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:0.65rem">RULING IN FAVOUR OF</label>
          <select class="form-select" id="dispute-favor-${d.id}" style="font-size:0.8rem">
            <option value="">— No ruling —</option>
            <option value="buyer">Buyer (@${escapeHtml(d.buyer_name)})</option>
            <option value="seller">Seller (@${escapeHtml(d.seller_name)})</option>
          </select>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end">
        <button class="btn btn-primary btn-sm" onclick="resolveDispute(${d.id})">✓ RESOLVE DISPUTE</button>
      </div>
    </div>`;
}

async function resolveDispute(dealId) {
  const notes = document.getElementById(`dispute-notes-${dealId}`)?.value.trim() || '';
  const favor = document.getElementById(`dispute-favor-${dealId}`)?.value || '';

  if (!confirm(`Resolve dispute #${dealId}?${favor ? ` Ruling in favour of ${favor}.` : ''}`)) return;

  try {
    await api.put(`/deals/${dealId}/resolve-dispute`, { notes, favor });
    showToast('Dispute resolved. Both parties notified.', 'success');
    const card = document.getElementById(`dispute-card-${dealId}`);
    if (card) {
      card.style.opacity = '0.4';
      card.style.pointerEvents = 'none';
      card.innerHTML = `<div style="padding:1rem;font-family:var(--font-mono);font-size:0.75rem;color:var(--success-bright)">✓ RESOLVED</div>`;
    }
    // Update badge
    const badge = document.querySelector('#admin-tab-disputes .badge-error');
    if (badge) {
      const remaining = document.querySelectorAll('.dispute-card:not([style*="opacity"])').length;
      if (remaining > 0) badge.textContent = remaining + ' open';
      else badge.remove();
    }
  } catch(e) { showToast(e.message || 'Failed to resolve', 'error'); }
}

// ============================================================
// MOD PANEL  (/mod)
// ============================================================

async function renderModPanel() {
  const el = document.getElementById('main-content');
  if (!Auth.isMod) {
    el.innerHTML = `<div class="panel" style="margin-top:2rem;text-align:center">
      <p style="color:var(--error)">Access denied — moderators only.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div class="section-header" style="margin-bottom:1.25rem">
        <h2 class="section-title" style="color:var(--success-bright)">⚑ MOD PANEL</h2>
        <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim)">
          Logged in as <strong style="color:var(--amber)">${escapeHtml(Auth.user.username)}</strong>
          · role: <strong style="color:var(--success-bright)">${Auth.user.role}</strong>
        </span>
      </div>

      <!-- Stats bar -->
      <div id="mod-stats" class="stats-grid" style="margin-bottom:1.5rem"></div>

      <!-- Tabs -->
      <div class="tabs" id="mod-tabs" style="margin-bottom:1rem">
        <button class="tab-btn active" onclick="modTab('queue',this)">📋 REPORT QUEUE</button>
        <button class="tab-btn" onclick="modTab('log',this)">📜 MOD LOG</button>
        ${Auth.isAdmin ? `<button class="tab-btn" onclick="modTab('roles',this)">👤 USER ROLES</button>` : ''}
      </div>

      <div id="mod-tab-content"></div>
    </div>`;

  // Load stats
  try {
    const s = await api.get('/mod/stats');
    document.getElementById('mod-stats').innerHTML = `
      <div class="stat-box"><div class="stat-value" style="color:var(--error)">${s.open_reports}</div><div class="stat-label">OPEN REPORTS</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--amber)">${s.hidden_listings}</div><div class="stat-label">HIDDEN LISTINGS</div></div>
      <div class="stat-box"><div class="stat-value">${s.warned_users}</div><div class="stat-label">USERS WARNED</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--error)">${s.banned_users}</div><div class="stat-label">BANNED USERS</div></div>`;
  } catch(e) {}

  modTab('queue', document.querySelector('#mod-tabs .tab-btn'));
}

async function modTab(tab, btn) {
  document.querySelectorAll('#mod-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const container = document.getElementById('mod-tab-content');
  if (tab === 'queue')  await renderModQueue(container);
  if (tab === 'log')    await renderModLog(container);
  if (tab === 'roles')  await renderModRoles(container);
}

async function renderModQueue(container) {
  container.innerHTML = `<div class="loading-overlay" style="position:relative;height:80px"><div class="spinner"></div></div>`;
  try {
    const data = await api.get('/mod/queue?limit=40');
    if (!data.items.length) {
      container.innerHTML = `<div class="panel" style="text-align:center;padding:2rem;color:var(--success-bright)">
        ✓ No open reports. Queue is clear.</div>`;
      return;
    }
    container.innerHTML = data.items.map(r => `
      <div class="panel" id="mod-queue-row-${r.id}" style="margin-bottom:0.75rem;border-left:3px solid var(--error);padding:0.85rem 1rem">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-display);font-size:0.9rem;font-weight:700;color:var(--text-primary)">
              <a href="#" onclick="Router.navigate('/listing/${r.id}');return false" style="color:var(--text-primary)">${escapeHtml(r.title)}</a>
            </div>
            <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim);margin-top:0.2rem">
              by ${escapeHtml(r.seller_name)} · status: <span style="color:${r.status==='hidden'?'var(--amber)':'var(--success-bright)'}">${r.status}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--error);margin-top:0.2rem">
              ${r.report_count} report${r.report_count!==1?'s':''} — reasons: ${escapeHtml(r.reasons||'—')}
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-shrink:0;flex-wrap:wrap">
            ${r.status !== 'hidden'
              ? `<button class="btn btn-sm" style="border-color:var(--error);color:var(--error)"
                   onclick="modHideListing(${r.id}, '${escapeHtml(r.title).replace(/'/g,"\\'")}')">HIDE</button>`
              : `<button class="btn btn-sm btn-success"
                   onclick="modShowListing(${r.id})">UNHIDE</button>`}
            <button class="btn btn-sm" style="border-color:var(--amber);color:var(--amber)"
              onclick="modWarnSeller('${escapeHtml(r.seller_name)}')">WARN SELLER</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = `<div class="panel" style="color:var(--error)">Failed to load queue: ${e.message}</div>`;
  }
}

async function modHideListing(id, title) {
  const reason = prompt(`Reason for hiding "${title}" (shown to seller):`);
  if (reason === null) return;
  try {
    await api.put(`/mod/listings/${id}/hide`, { reason });
    showToast('Listing hidden.', 'success');
    const row = document.getElementById(`mod-queue-row-${id}`);
    if (row) row.style.opacity = '0.5';
  } catch(e) { showToast(e.message||'Failed', 'error'); }
}

async function modShowListing(id) {
  if (!confirm('Unhide this listing?')) return;
  try {
    await api.put(`/mod/listings/${id}/show`, {});
    showToast('Listing restored.', 'success');
    const row = document.getElementById(`mod-queue-row-${id}`);
    if (row) row.style.opacity = '0.5';
  } catch(e) { showToast(e.message||'Failed', 'error'); }
}

async function modWarnSeller(username) {
  const data = await api.get(`/auth/public/${username}`).catch(()=>null);
  if (!data) { showToast('User not found', 'error'); return; }
  const reason = prompt(`Warning reason for @${username}:`);
  if (!reason) return;
  try {
    await api.post(`/mod/users/${data.id}/warn`, { reason });
    showToast(`Warning sent to @${username}`, 'success');
  } catch(e) { showToast(e.message||'Failed', 'error'); }
}

async function renderModLog(container) {
  container.innerHTML = `<div class="loading-overlay" style="position:relative;height:80px"><div class="spinner"></div></div>`;
  try {
    const modLogPage = window._modLogPage || 1;
    const data = await api.get(`/mod/log?limit=30&page=${modLogPage}`);
    if (!data.log.length) {
      container.innerHTML = `<div class="panel" style="text-align:center;padding:2rem;color:var(--text-dim)">No mod actions yet.</div>`;
      return;
    }
    container.innerHTML = `
      <div class="panel" style="overflow-x:auto;padding:0">
        <table class="data-table" style="min-width:600px">
          <thead><tr>
            <th>TIME</th><th>MOD</th><th>ACTION</th><th>TARGET</th><th>NOTES</th>
          </tr></thead>
          <tbody>
            ${data.log.map(r => `<tr>
              <td style="font-size:0.68rem;color:var(--text-dim)">${new Date(r.created_at).toLocaleDateString()}</td>
              <td><span style="color:var(--success-bright)">${escapeHtml(r.mod_name)}</span></td>
              <td><span style="font-family:var(--font-mono);font-size:0.72rem">${escapeHtml(r.action)}</span></td>
              <td style="font-size:0.72rem">${r.target_type} #${r.target_id}</td>
              <td style="font-size:0.72rem;color:var(--text-dim)">${escapeHtml(r.notes||'—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${data.pages > 1 ? buildPagination(modLogPage, data.pages, {}, 'modLogPage') : ''}
    `;
  } catch(e) {
    container.innerHTML = `<div class="panel" style="color:var(--error)">Failed to load log: ${e.message}</div>`;
  }
}

function modLogPage(page) {
  window._modLogPage = page;
  renderModPanel();
}

async function renderModRoles(container) {
  container.innerHTML = `
    <div class="panel">
      <h3 style="font-size:0.88rem;margin-bottom:1rem;color:var(--amber)">SET USER ROLE</h3>
      <p style="font-size:0.78rem;color:var(--text-dim);margin-bottom:1rem">
        Promote a user to moderator, or demote back to user. Only admins can access this.
      </p>
      <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
        <input class="form-input" id="mod-role-username" placeholder="Username" style="max-width:200px">
        <select class="form-input" id="mod-role-value" style="max-width:160px">
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="admin">admin</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="modSetRole()">SET ROLE</button>
      </div>
    </div>`;
}

async function modSetRole() {
  const username = document.getElementById('mod-role-username')?.value.trim();
  const role     = document.getElementById('mod-role-value')?.value;
  if (!username) { showToast('Enter a username', 'error'); return; }
  if (!confirm(`Set ${username}'s role to "${role}"?`)) return;
  try {
    const profile = await api.get(`/auth/public/${username}`);
    await api.put(`/mod/users/${profile.id}/set-role?role=${encodeURIComponent(role)}`, {});
    showToast(`${username} is now a ${role}`, 'success');
  } catch(e) { showToast(e.message||'Failed', 'error'); }
}

// ── Share card helper ──────────────────────────────────────────────────────
function copyShareCard(listingId) {
  const url = `${window.location.origin}/listing/${listingId}/card`;
  navigator.clipboard.writeText(url).then(
    () => showToast('Share link copied! Paste in Discord for a rich embed.', 'success'),
    () => {
      // Fallback: show the URL in a prompt for manual copy
      prompt('Copy this share link:', url);
    }
  );
}

// ============================================================
// USER SEARCH  (/search)
// ============================================================

async function renderUserSearch(parts) {
  const el = document.getElementById('main-content');

  // Support ?q= in path params e.g. /search/QuantumJack
  const initialQ = (parts && parts[1]) ? decodeURIComponent(parts[1]) : '';

  el.innerHTML = `
    <div style="max-width:900px;margin:0 auto">
      <div class="section-header" style="margin-bottom:1.5rem">
        <h2 class="section-title">PILOT SEARCH</h2>
      </div>

      <div style="display:flex;gap:0.75rem;margin-bottom:1.5rem;align-items:center">
        <input class="form-input" id="user-search-input" placeholder="Search by username…"
          value="${escapeHtml(initialQ)}"
          style="max-width:340px;flex:1"
          oninput="debounceUserSearch()"
          onkeydown="if(event.key==='Enter')doUserSearch()">
        <button class="btn btn-primary btn-sm" onclick="doUserSearch()">SEARCH</button>
      </div>

      <div id="user-search-results"></div>
    </div>`;

  if (initialQ) doUserSearch();
}

let _userSearchTimer = null;
function debounceUserSearch() {
  clearTimeout(_userSearchTimer);
  _userSearchTimer = setTimeout(doUserSearch, 320);
}

async function doUserSearch() {
  const q = document.getElementById('user-search-input')?.value.trim();
  const container = document.getElementById('user-search-results');
  if (!container) return;
  if (!q) { container.innerHTML = ''; return; }

  container.innerHTML = `<div class="loading-overlay" style="position:relative;height:80px"><div class="spinner"></div></div>`;

  try {
    const data = await api.get(`/auth/search/users?q=${encodeURIComponent(q)}&limit=24`);

    if (!data.users.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-title">No pilots found matching "${escapeHtml(q)}"</div></div>`;
      return;
    }

    container.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim);margin-bottom:0.85rem">
        ${data.total} result${data.total!==1?'s':''} for "${escapeHtml(q)}"
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0.75rem">
        ${data.users.map(u => userSearchCard(u)).join('')}
      </div>`;
  } catch(e) {
    container.innerHTML = `<div class="panel" style="color:var(--error)">Search failed: ${escapeHtml(e.message)}</div>`;
  }
}

function userSearchCard(u) {
  const stars = u.rating_avg
    ? '★'.repeat(Math.round(u.rating_avg)) + '☆'.repeat(5 - Math.round(u.rating_avg))
    : '☆☆☆☆☆';
  const initial = (u.username||'?')[0].toUpperCase();
  const lastActive = u.last_active_at ? lastActiveLabel(u.last_active_at) : 'unknown';

  return `
    <div class="panel" style="cursor:pointer;transition:border-color 0.15s"
      onclick="Router.navigate('/seller/${escapeHtml(u.username)}')"
      onmouseenter="this.style.borderColor='var(--amber-dim)'"
      onmouseleave="this.style.borderColor=''">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem">
        <div class="avatar" style="width:42px;height:42px;font-size:1.1rem;flex-shrink:0">
          ${u.avatar_url
            ? `<img src="${escapeHtml(u.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : initial}
        </div>
        <div style="min-width:0">
          <div style="font-family:var(--font-display);font-size:0.9rem;font-weight:700;
               color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            @${escapeHtml(u.username)}
            ${u.rsi_verified ? '<span style="color:var(--success-bright);font-size:0.7rem"> ✓</span>' : ''}
          </div>
          <div style="font-size:0.68rem;color:var(--amber);font-family:var(--font-mono)">
            ${stars}
            ${u.rating_count ? `<span style="color:var(--text-dim)">(${u.rating_count})</span>` : ''}
          </div>
        </div>
      </div>
      ${u.bio ? `<div style="font-size:0.78rem;color:var(--text-secondary);
           white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.5rem">
           ${escapeHtml(u.bio)}</div>` : ''}
      <div style="display:flex;gap:0.75rem;font-family:var(--font-mono);font-size:0.68rem;
           color:var(--text-dim);flex-wrap:wrap">
        <span title="Active listings">📦 ${u.active_listings||0}</span>
        <span title="Completed deals">✓ ${u.completed_deals||0}</span>
        <span>Last active: ${lastActive}</span>
      </div>
    </div>`;
}
