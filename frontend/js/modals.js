// ============================================================
// Auth Modal
// ============================================================

function showAuthModal(mode = 'login') {
  const modal = createModal('AUTH', `
    <div class="tabs" style="margin-bottom:1.25rem">
      <button class="tab-btn ${mode==='login'?'active':''}" id="auth-tab-login" onclick="switchAuthTab('login')">SIGN IN</button>
      <button class="tab-btn ${mode==='register'?'active':''}" id="auth-tab-register" onclick="switchAuthTab('register')">REGISTER</button>
    </div>
    <div id="auth-form-container"></div>
  `);
  document.body.appendChild(modal);
  renderAuthForm(mode);
}

function switchAuthTab(mode) {
  document.querySelectorAll('[id^="auth-tab-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('auth-tab-' + mode);
  if (btn) btn.classList.add('active');
  renderAuthForm(mode);
}

function renderAuthForm(mode) {
  const container = document.getElementById('auth-form-container');
  if (mode === 'login') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Username or Email</label>
        <input type="text" class="form-input" id="auth-username" autocomplete="username">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-input" id="auth-password" autocomplete="current-password">
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
        <input type="checkbox" id="auth-remember" checked style="cursor:pointer;accent-color:var(--amber)">
        <label for="auth-remember" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-secondary);cursor:pointer;margin:0">Remember me</label>
      </div>
      <div id="auth-error" class="form-error hidden"></div>
      <button class="btn btn-primary btn-full" style="margin-top:0.5rem;clip-path:none" onclick="submitLogin()">SIGN IN</button>
      <div class="auth-divider"><span>OR</span></div>
      <button class="btn btn-discord btn-full" onclick="loginWithDiscord()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px;vertical-align:middle">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
        CONTINUE WITH DISCORD
      </button>
    `;
    document.getElementById('auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') submitLogin(); });
  } else {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" class="form-input" id="reg-username" autocomplete="username">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="reg-email" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-input" id="reg-password" autocomplete="new-password">
      </div>
      <div id="auth-error" class="form-error hidden"></div>
      <button class="btn btn-primary btn-full" style="margin-top:0.5rem;clip-path:none" onclick="submitRegister()">CREATE ACCOUNT</button>
      <div class="auth-divider"><span>OR</span></div>
      <button class="btn btn-discord btn-full" onclick="loginWithDiscord()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px;vertical-align:middle">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
        SIGN UP WITH DISCORD
      </button>
    `;
  }
}

async function submitLogin() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const remember = document.getElementById('auth-remember')?.checked ?? true;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  if (!username || !password) { errEl.textContent = 'Fill in all fields'; errEl.classList.remove('hidden'); return; }

  try {
    const data = await api.post('/auth/login', { username, password });
    Auth.setSession(data.token, data.user, remember);
    closeModal();
    showToast(`Welcome back, @${data.user.username}`, 'success');
    Router.navigate(location.pathname, false);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

async function submitRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  if (!username || !email || !password) { errEl.textContent = 'Fill in all fields'; errEl.classList.remove('hidden'); return; }

  try {
    const data = await api.post('/auth/register', { username, email, password });
    Auth.setSession(data.token, data.user);
    closeModal();
    showToast(`Welcome to the Exchange, @${data.user.username}!`, 'success');
    Router.navigate('/profile', true);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

function loginWithDiscord() {
  // Redirect to the backend which will forward to Discord consent screen
  window.location.href = '/api/auth/discord/redirect';
}

// Handle the JWT (or error) that Discord's callback drops into the URL hash
function handleDiscordHashFragment() {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.slice(1)); // strip leading #

  const token = params.get('discord-token');
  const error = params.get('discord-error');

  // Clean hash out of the URL immediately regardless of outcome
  history.replaceState(null, '', window.location.pathname);

  if (token) {
    // Decode the JWT payload (no verification needed client-side, server already validated)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const user = { id: parseInt(payload.sub), username: payload.username, role: payload.role };
      Auth.setSession(token, user);
      showToast(`Welcome, @${user.username}!`, 'success');
      Router.navigate('/', false);
    } catch {
      showToast('Discord login failed — bad token', 'error');
    }
    return;
  }

  if (error) {
    const messages = {
      access_denied:           'Discord sign-in was cancelled.',
      token_exchange_failed:   'Discord auth failed — could not get token.',
      no_access_token:         'Discord auth failed — no access token returned.',
      user_fetch_failed:       'Discord auth failed — could not fetch your profile.',
      account_creation_failed: 'Could not create account. Username may be taken.',
      banned:                  'Your account has been banned.',
      not_configured:          'Discord login is not set up on this server.',
    };
    showToast(messages[error] || `Discord error: ${error}`, 'error');
  }
}

// Run on every page load
document.addEventListener('DOMContentLoaded', handleDiscordHashFragment);

// ============================================================
// Create / Edit Listing Modal
// ============================================================

async function showCreateListing() {
  if (!Auth.isLoggedIn) { showAuthModal('login'); return; }
  showListingFormModal(null);
}

async function showEditListing(id) {
  try {
    const listing = await api.get(`/listings/${id}`);
    showListingFormModal(listing);
  } catch (e) { showToast('Failed to load listing', 'error'); }
}

async function showListingFormModal(listing = null) {
  const isEdit = !!listing;

  const sel = (id, val) => val ? `selected` : '';
  const opt = (val, label, cur) => `<option value="${val}" ${cur===val?'selected':''}>${label}</option>`;

  const modal = createModal(isEdit ? 'EDIT LISTING' : 'NEW LISTING', `

    ${!isEdit ? `
    <!-- Template bar -->
    <div style="display:flex;gap:0.5rem;align-items:center;padding:0.6rem 0.75rem;background:var(--bg-dark);border:1px solid var(--border);margin-bottom:1rem">
      <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim)">TEMPLATE:</span>
      <select class="form-select" id="lf-template-select" style="flex:1;font-size:0.75rem" onchange="loadListingTemplate(this.value)">
        <option value="">— Load template —</option>
      </select>
      <button class="btn btn-ghost btn-sm" style="font-size:0.68rem;white-space:nowrap" onclick="saveListingTemplate()">⊕ SAVE AS TEMPLATE</button>
    </div>` : ''}

    <!-- TYPE + CATEGORY row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">Listing Type *</label>
        <select class="form-select" id="lf-listing-type" onchange="updatePriceLabel()">
          ${['WTS','WTB','WTT','WTR'].map(t => `<option value="${t}" ${listing?.listing_type===t?'selected':''}>${t} — ${{WTS:'Selling',WTB:'Buying',WTT:'Trading',WTR:'Renting'}[t]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-select" id="lf-category" onchange="updateSubcats()">
          <option value="">Select...</option>
          <option value="commodities" ${listing?.category==='commodities'?'selected':''}>Commodities</option>
          <option value="ships" ${listing?.category==='ships'?'selected':''}>Ships & Components</option>
          <option value="fps-gear" ${listing?.category==='fps-gear'?'selected':''}>FPS Gear & Armor</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Subcategory</label>
      <select class="form-select" id="lf-subcategory"></select>
    </div>

    <div class="form-group">
      <label class="form-label">Title *</label>
      <input type="text" class="form-input" id="lf-title" value="${listing ? escapeHtml(listing.title) : ''}">
    </div>

    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="lf-desc" rows="3">${listing ? escapeHtml(listing.description || '') : ''}</textarea>
    </div>

    <!-- PRICE row -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label" id="lf-price-label">Price</label>
        <input type="number" class="form-input" id="lf-price" value="${listing?.price || ''}" min="0" step="0.01" placeholder="0 = negotiable">
        <div id="price-suggestion" style="margin-top:0.35rem;font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);min-height:1rem"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Currency</label>
        <select class="form-select" id="lf-currency">
          ${['aUEC','USD','Credits'].map(c => opt(c,c,listing?.currency)).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input type="number" class="form-input" id="lf-quantity" value="${listing?.quantity || 1}" min="1">
      </div>
    </div>

    <!-- LOCATION row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">System</label>
        <select class="form-select" id="lf-system">
          <option value="">Any / Unknown</option>
          ${SYSTEMS.map(s => `<option value="${s}" ${listing?.system_name===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Location / Station</label>
        <input type="text" class="form-input" id="lf-location" value="${listing ? escapeHtml(listing.location || '') : ''}" placeholder="e.g. Hurston, Area18">
      </div>
    </div>

    <!-- DETAILS row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">Availability</label>
        <select class="form-select" id="lf-availability">
          <option value="">Unspecified</option>
          ${AVAILABILITY.map(a => `<option value="${a}" ${listing?.availability===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Item Source</label>
        <select class="form-select" id="lf-source">
          <option value="">Unspecified</option>
          ${SOURCES.map(s => `<option value="${s}" ${listing?.source===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- META row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="form-group">
        <label class="form-label">Preferred Language</label>
        <select class="form-select" id="lf-language">
          ${LANGUAGES.map(l => `<option value="${l}" ${(listing?.language||'English')===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Game Version</label>
        <input type="text" class="form-input" id="lf-gameversion" value="${listing ? escapeHtml(listing.game_version || '') : ''}" placeholder="e.g. 4.1.0">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Org Affiliation <span style="color:var(--text-dim)">(optional)</span></label>
      <select class="form-select" id="lf-org-id">
        <option value="">None — personal listing</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Item Image</label>
      <div class="file-drop-zone" id="lf-drop">
        <input type="file" id="lf-image" accept="image/*" onchange="previewImage(this)">
        <div class="file-drop-text">⊕ CLICK OR DRAG IMAGE (max 5MB)</div>
        ${listing?.image_url ? `<img src="${escapeHtml(listing.image_url)}" class="file-preview" style="display:block">` : '<img class="file-preview" id="lf-preview">'}
      </div>
    </div>

    <div id="lf-error" class="form-error hidden"></div>
  `, async () => {
    await submitListingForm(listing?.id || null);
  }, isEdit ? 'SAVE CHANGES' : 'POST LISTING');

  modal.querySelector('.modal').style.maxWidth = '680px';
  document.body.appendChild(modal);

  // Wire drag-and-drop on the image drop zone
  const dropZone = document.getElementById('lf-drop');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--amber)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const input = document.getElementById('lf-image');
      // Assign dragged file to the input via DataTransfer
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      previewImage(input);
    });
  }

  if (listing) updateSubcats(listing.subcategory);
  else updateSubcats();

  updatePriceLabel();

  // Wire up price suggestion — triggers when title loses focus or category changes
  const titleEl = document.getElementById('lf-title');
  const catEl   = document.getElementById('lf-category');
  let suggestTimer;
  const triggerSuggest = () => {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(fetchPriceSuggestion, 500);
  };
  if (titleEl) titleEl.addEventListener('blur', triggerSuggest);
  if (catEl)   catEl.addEventListener('change', triggerSuggest);

  // Populate org dropdown
  try {
    const myOrgs = await api.get('/orgs/my');
    const orgSel = document.getElementById('lf-org-id');
    if (orgSel && myOrgs.length) {
      myOrgs.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = `[${o.tag}] ${o.name}`;
        if (listing?.org_id === o.id) opt.selected = true;
        orgSel.appendChild(opt);
      });
    }
  } catch {}

  // Populate template dropdown
  try {
    const tmplSel = document.getElementById('lf-template-select');
    if (tmplSel) {
      const tmpls = await api.get('/templates');
      tmpls.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        tmplSel.appendChild(opt);
      });
    }
  } catch {}
}

function updatePriceLabel() {
  const type = document.getElementById('lf-listing-type')?.value || 'WTS';
  const label = document.getElementById('lf-price-label');
  if (!label) return;
  label.textContent = { WTS: 'Asking Price', WTB: 'Offering Price', WTT: 'Trade Value', WTR: 'Rental Price' }[type] || 'Price';
}

async function submitListingForm(editId = null) {
  const errEl = document.getElementById('lf-error');
  errEl.classList.add('hidden');

  const title    = document.getElementById('lf-title').value.trim();
  const category = document.getElementById('lf-category').value;
  const price    = document.getElementById('lf-price').value || '0';

  if (!title || !category) {
    errEl.textContent = 'Title and category are required';
    errEl.classList.remove('hidden');
    return;
  }

  // Disable submit button for the entire duration to prevent double-submit
  const btn = document.querySelector('.modal-footer .btn-primary');
  const originalLabel = editId ? 'SAVE CHANGES' : 'POST LISTING';
  const setBtn = (text, disabled) => {
    if (!btn) return;
    btn.textContent = text;
    btn.disabled    = disabled;
  };
  setBtn(originalLabel, true);

  const fd = new FormData();
  fd.append('title',        title);
  fd.append('category',     category);
  fd.append('subcategory',  document.getElementById('lf-subcategory').value);
  fd.append('description',  document.getElementById('lf-desc').value);
  fd.append('price',        price);
  fd.append('currency',     document.getElementById('lf-currency').value);
  fd.append('quantity',     document.getElementById('lf-quantity').value);
  fd.append('location',     document.getElementById('lf-location').value);
  fd.append('listing_type', document.getElementById('lf-listing-type').value);
  fd.append('system_name',  document.getElementById('lf-system').value);
  fd.append('availability', document.getElementById('lf-availability').value);
  fd.append('source',       document.getElementById('lf-source').value);
  fd.append('language',     document.getElementById('lf-language').value);
  fd.append('game_version', document.getElementById('lf-gameversion').value);
  const orgId = document.getElementById('lf-org-id')?.value;
  if (orgId) fd.append('org_id', orgId);

  const imgFile = document.getElementById('lf-image').files[0];

  // Upload image first if a new file was selected
  if (imgFile) {
    const uploadFd = new FormData();
    uploadFd.append('file', imgFile);
    try {
      setBtn('UPLOADING IMAGE…', true);
      const uploadRes = await fetch('/api/upload/listing-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Auth.token}` },
        body: uploadFd,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Image upload failed');
      }
      const { url } = await uploadRes.json();
      fd.append('image_url', url);
      setBtn('POSTING…', true);
    } catch(e) {
      setBtn(originalLabel, false);
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      return;
    }
  } else {
    setBtn('POSTING…', true);
  }

  try {
    if (editId) {
      await api.put(`/listings/${editId}`, fd, true);
      showToast('Listing updated!', 'success');
    } else {
      const listing = await api.post('/listings', fd, true);
      showToast('Listing posted!', 'success');
      closeModal();
      // If we're on the marketplace, prepend the new card to the grid live
      const grid = document.querySelector('.listings-grid');
      if (grid) {
        const card = document.createElement('div');
        card.innerHTML = listingCard(listing);
        grid.insertBefore(card.firstElementChild, grid.firstChild);
        // update count
        const countEl = document.getElementById('listing-count');
        if (countEl) {
          const cur = parseInt(countEl.textContent) || 0;
          countEl.textContent = `${cur + 1} RESULT${cur + 1 !== 1 ? 'S' : ''}`;
        }
        showToast('Your listing is now live on the market!', 'info');
      } else {
        Router.navigate(`/listing/${listing.id}`);
      }
      return;
    }
    closeModal();
    Router.navigate(location.pathname, false);
  } catch (e) {
    setBtn(originalLabel, false);
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
    throw e;
  }
}

const SUBCATS = {
  commodities: ['Minerals','Agricultural','Medical','Food & Drink','Contraband','Other'],
  ships: ['Hull & Structure','Weapons','Shields','Quantum Drive','Thrusters','Full Ships','Other'],
  'fps-gear': ['Armor','Helmets','Weapons','Undersuits','Medical','Backpacks','Other']
};

function updateSubcats(selected = '') {
  const cat = document.getElementById('lf-category')?.value;
  const subEl = document.getElementById('lf-subcategory');
  if (!subEl) return;
  const opts = SUBCATS[cat] || [];
  subEl.innerHTML = `<option value="">None</option>` + opts.map(s => `<option value="${s}" ${s===selected?'selected':''}>${s}</option>`).join('');
}

function previewImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('lf-preview') || input.closest('.file-drop-zone').querySelector('.file-preview');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}

// ============================================================
// Contact Seller Modal
// ============================================================

function showContactModal(listingId, sellerName, type = 'inquiry') {
  const typeLabels = { buy: 'BUY REQUEST', barter: 'BARTER OFFER', inquiry: 'INQUIRY' };
  const modal = createModal(`CONTACT @${sellerName}`, `
    <div style="margin-bottom:1rem">
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
        <button class="filter-btn ${type==='buy'?'active':''}" onclick="setMsgType('buy')">⬡ BUY</button>
        <button class="filter-btn ${type==='barter'?'active':''}" onclick="setMsgType('barter')">⇌ BARTER</button>
        <button class="filter-btn ${type==='inquiry'?'active':''}" onclick="setMsgType('inquiry')">? INQUIRY</button>
      </div>
      <div id="msg-type-display" class="msg-type-badge msg-type-${type}" style="display:inline-block;margin-bottom:1rem">${typeLabels[type]}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Message</label>
      <textarea class="form-textarea" id="msg-body" rows="5" placeholder="${
        type === 'buy' ? 'I would like to purchase this item...' :
        type === 'barter' ? 'I offer to trade...' :
        'I have a question about...'
      }"></textarea>
    </div>
    <div id="msg-error" class="form-error hidden"></div>
  `, async () => {
    await sendMessage(listingId);
  }, 'SEND MESSAGE');

  document.body.appendChild(modal);
  modal._msgType = type;
}

function setMsgType(type) {
  const typeLabels = { buy: 'BUY REQUEST', barter: 'BARTER OFFER', inquiry: 'INQUIRY' };
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const display = document.getElementById('msg-type-display');
  if (display) {
    display.className = `msg-type-badge msg-type-${type}`;
    display.textContent = typeLabels[type];
  }
  document.querySelector('.modal')._msgType = type;
}

async function sendMessage(listingId) {
  const body = document.getElementById('msg-body').value.trim();
  const type = document.querySelector('.modal')._msgType || 'inquiry';
  const errEl = document.getElementById('msg-error');
  errEl.classList.add('hidden');

  if (!body) { errEl.textContent = 'Message cannot be empty'; errEl.classList.remove('hidden'); return; }

  try {
    await api.post('/messages', { listing_id: listingId, body, type });
    showToast('Message sent!', 'success');
    closeModal();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
    throw e;
  }
}

// ============================================================
// Message Detail Modal
// ============================================================

function showMessageDetail(msg, boxType) {
  const modal = createModal('MESSAGE', `
    <div style="margin-bottom:1.25rem">
      <span class="msg-type-badge msg-type-${msg.type}">${msg.type.toUpperCase()}</span>
      <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);margin-left:0.75rem">
        ${boxType === 'inbox' ? 'From @' + escapeHtml(msg.sender_name) : 'To @' + escapeHtml(msg.recipient_name)}
      </span>
      <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);margin-left:0.5rem">${timeAgo(msg.created_at)}</span>
    </div>
    <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim);margin-bottom:0.5rem">RE: ${escapeHtml(msg.listing_title)}</div>
    <div style="background:var(--bg-dark);border:1px solid var(--border);padding:1rem;margin-bottom:1.25rem;white-space:pre-wrap;color:var(--text-secondary);font-size:0.9rem">${escapeHtml(msg.body)}</div>
    ${boxType === 'inbox' ? `
      <div class="form-group">
        <label class="form-label">Reply</label>
        <textarea class="form-textarea" id="reply-body" rows="4" placeholder="Your reply..."></textarea>
      </div>
      <div id="reply-error" class="form-error hidden"></div>
    ` : ''}
  `, boxType === 'inbox' ? async () => {
    const body = document.getElementById('reply-body').value.trim();
    if (!body) { document.getElementById('reply-error').textContent = 'Reply cannot be empty'; document.getElementById('reply-error').classList.remove('hidden'); return; }
    try {
      await api.post(`/messages/${msg.id}/reply`, { body });
      showToast('Reply sent!', 'success');
      closeModal();
    } catch (e) { document.getElementById('reply-error').textContent = e.message; document.getElementById('reply-error').classList.remove('hidden'); throw e; }
  } : null, boxType === 'inbox' ? 'SEND REPLY' : null);

  document.body.appendChild(modal);

  // Mark as read
  if (boxType === 'inbox' && !msg.read) {
    api.put(`/messages/${msg.id}/read`).catch(() => {});
    updateUnreadBadge();
  }
}

// ============================================================
// Report Listing
// ============================================================

async function reportListing(id) {
  const reason = prompt('Reason for reporting this listing:');
  if (!reason) return;
  try {
    await api.post('/listings/' + id + '/report', { reason }).catch(() =>
      fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Auth.token}` }, body: JSON.stringify({ listing_id: id, reason }) })
    );
    showToast('Report submitted', 'success');
  } catch { showToast('Failed to submit report', 'error'); }
}

// ============================================================
// Profile Actions
// ============================================================

async function saveProfile() {
  const bio = document.getElementById('setting-bio').value;
  const avatar_url = document.getElementById('setting-avatar').value;
  try {
    const user = await api.put('/auth/profile', { bio, avatar_url });
    Auth.setSession(Auth.token, user);
    showToast('Profile saved!', 'success');
    loadTemplateList();
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadTemplateList() {
  const el = document.getElementById('template-list-settings');
  if (!el) return;
  try {
    const tmpls = await api.get('/templates');
    if (!tmpls.length) {
      el.innerHTML = `<span style="color:var(--text-dim);font-size:0.8rem">No templates saved yet. Create a listing and click ⊕ SAVE AS TEMPLATE.</span>`;
      return;
    }
    el.innerHTML = tmpls.map(t => `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.4rem 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:0.85rem;color:var(--text-primary)">${escapeHtml(t.name)}</span>
        <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-dim)">${t.category?.toUpperCase() || ''} · ${t.listing_type || 'WTS'}</span>
        <button class="btn btn-ghost btn-sm" style="color:var(--error);font-size:0.68rem" onclick="deleteTemplate(${t.id},'${escapeHtml(t.name)}')">✕</button>
      </div>`).join('');
  } catch {
    el.innerHTML = `<span style="color:var(--text-dim);font-size:0.8rem">Could not load templates.</span>`;
  }
}

async function deleteTemplate(id, name) {
  if (!confirm(`Delete template "${name}"?`)) return;
  try {
    await api.delete(`/templates/${id}`);
    showToast('Template deleted', 'success');
    loadTemplateList();
  } catch(e) { showToast(e.message, 'error'); }
}

async function generateRsiCode() {
  const handle = document.getElementById('rsi-handle-input').value.trim();
  if (!handle) { showToast('Enter your RSI handle first', 'error'); return; }
  try {
    const data = await api.post('/auth/rsi/generate-code', { rsi_handle: handle });
    document.getElementById('rsi-code-display').textContent = data.code;
    document.getElementById('rsi-code-box').classList.remove('hidden');
    document.getElementById('rsi-verify-result').innerHTML = '';
    await Auth.refreshUser();
    showToast('Code generated!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function verifyRsi() {
  const resultEl = document.getElementById('rsi-verify-result');
  resultEl.innerHTML = '<div class="loading-overlay" style="padding:1rem"><div class="spinner"></div> CHECKING RSI BIO...</div>';
  try {
    const data = await api.post('/auth/rsi/verify');
    if (data.verified) {
      resultEl.innerHTML = `<span class="badge badge-green" style="padding:0.5rem 1rem">✓ ${data.message}</span>`;
      await Auth.refreshUser();
      renderProfile();
    } else {
      resultEl.innerHTML = `<span class="badge badge-red" style="padding:0.5rem 1rem">✗ ${data.message}</span>`;
    }
  } catch (e) {
    resultEl.innerHTML = `<span class="badge badge-red">${e.message}</span>`;
  }
}

async function deleteListing(id) {
  if (!confirm('Delete this listing permanently?')) return;
  try {
    await api.delete(`/listings/${id}`);
    showToast('Listing deleted', 'success');
    Router.navigate('/');
  } catch (e) { showToast(e.message, 'error'); }
}

function logOut() {
  Auth.clearSession();
  showToast('Signed out', 'info');
  Router.navigate('/');
}

// ============================================================
// Modal Utility
// ============================================================

function createModal(title, bodyHtml, onConfirm = null, confirmLabel = 'CONFIRM') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal" id="modal-inner">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${onConfirm ? `
        <div class="modal-footer">
          <button class="btn btn-ghost btn-sm" onclick="closeModal()">CANCEL</button>
          <button class="btn btn-primary btn-sm" id="modal-confirm-btn">${confirmLabel}</button>
        </div>` : ''}
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  if (onConfirm) {
    setTimeout(() => {
      const btn = document.getElementById('modal-confirm-btn');
      if (btn) btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '...';
        try { await onConfirm(); } catch { btn.disabled = false; btn.textContent = confirmLabel; }
      });
    }, 0);
  }

  return overlay;
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
}

// ── Price Suggestion ─────────────────────────────────────────────────────────

async function fetchPriceSuggestion() {
  const sugEl = document.getElementById('price-suggestion');
  if (!sugEl) return;

  const title = (document.getElementById('lf-title')?.value || '').trim();
  const cat   = document.getElementById('lf-category')?.value || '';
  const type  = document.getElementById('lf-listing-type')?.value || 'WTS';

  // Only suggest for WTS listings where price makes sense
  if (!title || !cat || type !== 'WTS') { sugEl.textContent = ''; return; }

  sugEl.textContent = '…';

  try {
    // Find matching item_type by name + category
    const items = await api.get(`/item-types?category=${encodeURIComponent(cat)}`);
    const match = (items || []).find(it =>
      it.name.toLowerCase() === title.toLowerCase() ||
      title.toLowerCase().includes(it.name.toLowerCase()) ||
      it.name.toLowerCase().includes(title.toLowerCase())
    );
    if (!match) { sugEl.textContent = ''; return; }

    const data = await api.get(`/listings/suggest-price/${match.id}`);
    if (!data || data.count === 0) {
      sugEl.innerHTML = `<span style="color:var(--text-dim)">No similar listings — set your own price</span>`;
      return;
    }

    sugEl.innerHTML = `
      <span style="color:var(--amber)">💡 Similar listings avg:</span>
      <span style="color:var(--text-primary);font-weight:700"> ${data.avg_price.toLocaleString()} ${data.currency}</span>
      <span style="color:var(--text-dim)"> (${data.count} listing${data.count!==1?'s':''},
        ${data.min_price.toLocaleString()}–${data.max_price.toLocaleString()})</span>
      <button onclick="document.getElementById('lf-price').value='${data.suggestion}';document.getElementById('price-suggestion').innerHTML='<span style=color:var(--success-bright)>✓ Price applied</span>'"
        style="margin-left:0.5rem;background:none;border:1px solid var(--amber);color:var(--amber);
               font-family:var(--font-mono);font-size:0.62rem;padding:0.1rem 0.4rem;cursor:pointer">
        USE ${data.suggestion.toLocaleString()}
      </button>
    `;
  } catch {
    sugEl.textContent = '';
  }
}

// ── Listing Templates ─────────────────────────────────────────────────────────

async function loadListingTemplate(tmplId) {
  if (!tmplId) return;
  try {
    const t = await api.get(`/templates/${tmplId}`);
    const f = t.fields;

    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    set('lf-title',        f.title);
    set('lf-desc',         f.description);
    set('lf-price',        f.price);
    set('lf-quantity',     f.quantity);
    set('lf-location',     f.location);
    set('lf-gameversion',  f.game_version);

    const catEl = document.getElementById('lf-category');
    if (catEl && f.category) { catEl.value = f.category; updateSubcats(f.subcategory); }

    const typeEl = document.getElementById('lf-listing-type');
    if (typeEl && f.listing_type) { typeEl.value = f.listing_type; updatePriceLabel(); }

    const currEl = document.getElementById('lf-currency');
    if (currEl && f.currency) currEl.value = f.currency;

    const sysEl = document.getElementById('lf-system');
    if (sysEl && f.system_name) sysEl.value = f.system_name;

    const availEl = document.getElementById('lf-availability');
    if (availEl && f.availability) availEl.value = f.availability;

    const srcEl = document.getElementById('lf-source');
    if (srcEl && f.source) srcEl.value = f.source;

    const langEl = document.getElementById('lf-language');
    if (langEl && f.language) langEl.value = f.language;

    showToast(`Template "${t.name}" loaded`, 'success');
  } catch(e) { showToast('Failed to load template', 'error'); }
}

async function saveListingTemplate() {
  const title = document.getElementById('lf-title')?.value.trim();
  const defaultName = title || 'My Template';

  const name = window.prompt('Save template as:', defaultName);
  if (!name) return;

  try {
    const fields = {
      title:        document.getElementById('lf-title')?.value || '',
      description:  document.getElementById('lf-desc')?.value || '',
      category:     document.getElementById('lf-category')?.value || '',
      subcategory:  document.getElementById('lf-subcategory')?.value || '',
      listing_type: document.getElementById('lf-listing-type')?.value || 'WTS',
      price:        parseFloat(document.getElementById('lf-price')?.value) || 0,
      currency:     document.getElementById('lf-currency')?.value || 'aUEC',
      quantity:     parseInt(document.getElementById('lf-quantity')?.value) || 1,
      location:     document.getElementById('lf-location')?.value || '',
      system_name:  document.getElementById('lf-system')?.value || '',
      availability: document.getElementById('lf-availability')?.value || '',
      source:       document.getElementById('lf-source')?.value || '',
      language:     document.getElementById('lf-language')?.value || 'English',
      game_version: document.getElementById('lf-gameversion')?.value || '',
    };

    const t = await api.post('/templates', { name, ...fields });

    // Add to dropdown immediately
    const sel = document.getElementById('lf-template-select');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = name;
      opt.selected = true;
      sel.appendChild(opt);
    }
    showToast(`Template "${name}" saved`, 'success');
  } catch(e) { showToast(e.message || 'Failed to save template', 'error'); }
}
