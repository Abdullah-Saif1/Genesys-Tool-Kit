// ---- theme (dark mode) -------------------------------------------------

const THEME_STORAGE_KEY = 'gct-theme';

function getEffectiveTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function renderThemeToggle() {
  const isDark = getEffectiveTheme() === 'dark';
  const btn = document.getElementById('themeToggleBtn');
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage can be unavailable (private browsing, storage quota) — the toggle still
    // works for the current page load, it just won't persist across visits.
  }
  renderThemeToggle();
}

document.getElementById('themeToggleBtn').addEventListener('click', () => {
  applyTheme(getEffectiveTheme() === 'dark' ? 'light' : 'dark');
});

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // Only the icon needs a JS refresh here — the actual color swap is handled by CSS. If the
    // user has an explicit override saved, that override still wins (see getEffectiveTheme).
    renderThemeToggle();
  });
}

renderThemeToggle();

// ---- layout (mobile view) -----------------------------------------------

const LAYOUT_STORAGE_KEY = 'gct-layout';
const MOBILE_LAYOUT_QUERY = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;

function getEffectiveLayout() {
  let explicit = null;
  try {
    explicit = localStorage.getItem(LAYOUT_STORAGE_KEY);
  } catch {
    // localStorage unavailable — fall through to viewport detection below.
  }
  if (explicit === 'mobile' || explicit === 'desktop') return explicit;
  return MOBILE_LAYOUT_QUERY && MOBILE_LAYOUT_QUERY.matches ? 'mobile' : 'desktop';
}

function renderLayoutToggle() {
  const isMobile = getEffectiveLayout() === 'mobile';
  const btn = document.getElementById('layoutToggleBtn');
  btn.textContent = isMobile ? '🖥️' : '📱';
  btn.title = isMobile ? 'Switch to desktop layout' : 'Switch to mobile layout';
}

function closeSidebarDrawer() {
  document.getElementById('sidebarNav').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}

function applyLayout(layout) {
  document.documentElement.classList.toggle('is-mobile', layout === 'mobile');
  if (layout !== 'mobile') closeSidebarDrawer();
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Same private-browsing/quota caveat as the theme toggle — works for this load only.
  }
  renderLayoutToggle();
}

document.getElementById('layoutToggleBtn').addEventListener('click', () => {
  applyLayout(getEffectiveLayout() === 'mobile' ? 'desktop' : 'mobile');
});

document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('sidebarNav').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
});
document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebarDrawer);

if (MOBILE_LAYOUT_QUERY) {
  MOBILE_LAYOUT_QUERY.addEventListener('change', () => {
    // No explicit saved choice means the layout should keep following the actual viewport —
    // recompute and re-apply on resize, same "explicit override always wins" rule as the theme.
    let explicit = null;
    try {
      explicit = localStorage.getItem(LAYOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (explicit !== 'mobile' && explicit !== 'desktop') applyLayout(getEffectiveLayout());
  });
}

renderLayoutToggle();

// ---- generic helpers -------------------------------------------------

async function proxy(method, apiPath, { query, body } = {}) {
  const resp = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path: apiPath, query, body }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || `Request failed (${resp.status})`);
  }
  return data;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.appendChild(child));
  return node;
}

function gridRow(columns, cells) {
  const row = el('div', { class: 'grid-row', style: `grid-template-columns:${columns}` });
  cells.forEach((cell) => row.appendChild(cell));
  return row;
}

function cellText(text, extraClass) {
  return el('span', { class: extraClass || '', text: text ?? '' });
}

function showError(elementId, message) {
  const node = document.getElementById(elementId);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('hidden', !message);
}

let toastTimer;
function showToast(message, isError) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.toggle('error', !!isError);
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

async function withBusy(button, busyLabel, fn) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function parseLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderBulkResults(containerId, results) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const okCount = results.filter((r) => r.ok).length;
  container.appendChild(el('div', { class: 'result-summary', text: `${okCount} of ${results.length} succeeded` }));
  results.forEach((r) => {
    container.appendChild(
      el('div', { class: `result-row ${r.ok ? 'ok' : 'fail'}` }, [
        el('span', { text: r.ok ? '✓' : '✗' }),
        el('span', { text: ` ${r.label}` }),
        el('span', { text: r.ok ? '' : ` - ${r.message}` }),
      ])
    );
  });
}

// ---- confirm modal (replaces native confirm()) ----------------------------

// Resolves true only when the user clicks the explicit confirm button. Escape and clicking the
// overlay both cancel — there is no path that lets the destructive action fire by accident.
function confirmModal({ title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, usageNote = '' }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModalOverlay');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const usageEl = document.getElementById('confirmModalUsage');

    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    confirmBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;
    confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-accent'}`;
    usageEl.textContent = usageNote;
    usageEl.classList.toggle('hidden', !usageNote);

    function cleanup(result) {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onConfirm() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }
    function onKey(e) { if (e.key === 'Escape') cleanup(false); }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
    overlay.classList.remove('hidden');
    confirmBtn.focus();
  });
}

// ---- undo-able delete ------------------------------------------------------

// Genesys Cloud has no "restore" API for most of these resources, so a real undo has to happen
// before the DELETE call is ever sent: remove the item from the UI immediately, wait a few
// seconds (cancellable), then actually call the API. Cancelling just puts the item back.
let undoTimerInterval = null;
let undoTimeoutHandle = null;

function cancelPendingUndo() {
  clearInterval(undoTimerInterval);
  clearTimeout(undoTimeoutHandle);
  document.getElementById('undoToast').classList.add('hidden');
}

function showUndoableDelete({ itemName, remove, restore, commit, seconds = 5 }) {
  cancelPendingUndo(); // only one undoable delete pending at a time, to keep this simple and clear
  remove();

  let remaining = seconds;
  const toast = document.getElementById('undoToast');
  const msgEl = document.getElementById('undoToastMessage');
  const btn = document.getElementById('undoToastBtn');

  function render() {
    msgEl.textContent = `Deleting "${itemName}" in ${remaining}s…`;
  }
  render();
  toast.classList.remove('hidden');

  function onUndo() {
    cancelPendingUndo();
    btn.removeEventListener('click', onUndo);
    restore();
    showToast(`Cancelled — "${itemName}" was not deleted.`);
  }
  btn.addEventListener('click', onUndo);

  undoTimerInterval = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) render();
  }, 1000);

  undoTimeoutHandle = setTimeout(async () => {
    clearInterval(undoTimerInterval);
    toast.classList.add('hidden');
    btn.removeEventListener('click', onUndo);
    try {
      await commit();
      showToast(`Deleted "${itemName}".`);
    } catch (err) {
      restore();
      showToast(`Could not delete "${itemName}": ${err.message}`, true);
    }
  }, seconds * 1000);
}

// ---- HTML sanitizer (allowlist-based) for the canned-response preview -----

const SANITIZE_ALLOWED_TAGS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'DIV', 'A', 'UL', 'OL', 'LI', 'SMALL', 'SUB', 'SUP']);
const SANITIZE_ALLOWED_ATTRS = { A: ['href'], SPAN: ['style'], DIV: ['style'] };

// Only these CSS properties survive sanitization — keeps the rich-text formatting (font family/size,
// color, bold/italic/underline) that the canned-response editor produces, while blocking style-based
// injection vectors like background: url(javascript:...) or CSS expression().
const SANITIZE_ALLOWED_STYLE_PROPS = new Set(['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration']);

function sanitizeStyleValue(styleText) {
  const out = [];
  styleText.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!value || !SANITIZE_ALLOWED_STYLE_PROPS.has(prop)) return;
    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return;
    out.push(`${prop}: ${value}`);
  });
  return out.join('; ');
}

function sanitizeHtmlToFragment(html) {
  const template = document.createElement('template');
  template.innerHTML = html; // parsed as inert content, not executed (no document.write / innerHTML-on-live-node)
  const fragment = document.createDocumentFragment();

  function cloneSafe(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const tag = node.tagName;
    if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
      // Unwrap disallowed elements (e.g. <script>, <style>, <img>) but keep their safe text/children
      // for tags where that makes sense; script/style content is skipped entirely.
      if (tag === 'SCRIPT' || tag === 'STYLE') return null;
      const wrapper = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        const cloned = cloneSafe(child);
        if (cloned) wrapper.appendChild(cloned);
      });
      return wrapper;
    }

    const el = document.createElement(tag.toLowerCase());
    const allowedAttrs = SANITIZE_ALLOWED_ATTRS[tag] || [];
    allowedAttrs.forEach((attr) => {
      const value = node.getAttribute(attr);
      if (!value) return;
      if (attr === 'href' && !/^https?:\/\//i.test(value.trim())) return; // no javascript:/data: URLs
      if (attr === 'style') {
        const safeStyle = sanitizeStyleValue(value);
        if (safeStyle) el.setAttribute('style', safeStyle);
        return;
      }
      el.setAttribute(attr, value);
      if (attr === 'href') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });
    node.childNodes.forEach((child) => {
      const cloned = cloneSafe(child);
      if (cloned) el.appendChild(cloned);
    });
    return el;
  }

  template.content.childNodes.forEach((node) => {
    const cloned = cloneSafe(node);
    if (cloned) fragment.appendChild(cloned);
  });
  return fragment;
}

// A paged, filterable, deletable list bound to one Genesys Cloud list endpoint.
function createListResource({ path, query, pageSize = 50, containerId, filterId, loadMoreId, emptyId, errorId, buildRow, onLoaded, onRender, matches, extraFilter }) {
  const defaultMatches = (item, filterText) => (item.name || '').toLowerCase().includes(filterText);
  const matchesFilter = matches || defaultMatches;
  const passesExtraFilter = extraFilter || (() => true);
  const state = { items: [], pageNumber: 0, total: 0 };

  function render() {
    const filterEl = filterId && document.getElementById(filterId);
    const filterText = filterEl ? filterEl.value.trim().toLowerCase() : '';
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const filtered = state.items.filter((item) => (!filterText || matchesFilter(item, filterText)) && passesExtraFilter(item));
    filtered.forEach((item) => container.appendChild(buildRow(item)));

    if (emptyId) document.getElementById(emptyId).classList.toggle('hidden', filtered.length > 0);
    if (loadMoreId) document.getElementById(loadMoreId).classList.toggle('hidden', state.items.length >= state.total);
    if (onRender) onRender(filtered, state);
  }

  async function fetchPage(pageNumber) {
    const extraQuery = typeof query === 'function' ? query() : query;
    const data = await proxy('GET', path, { query: Object.assign({}, extraQuery, { pageNumber, pageSize }) });
    state.total = data.total || 0;
    state.pageNumber = data.pageNumber || pageNumber;
    state.items = state.items.concat(data.entities || []);
    render();
    if (onLoaded) onLoaded(data);
  }

  async function reset() {
    showError(errorId, '');
    state.items = [];
    state.pageNumber = 0;
    state.total = 0;
    await fetchPage(1);
  }

  async function loadMore() {
    await fetchPage(state.pageNumber + 1);
  }

  function prepend(item) {
    state.items.unshift(item);
    state.total += 1;
    render();
  }

  function remove(id) {
    state.items = state.items.filter((item) => item.id !== id);
    state.total = Math.max(0, state.total - 1);
    render();
  }

  if (filterId) document.getElementById(filterId).addEventListener('input', render);
  if (loadMoreId) {
    document.getElementById(loadMoreId).addEventListener('click', () => {
      loadMore().catch((err) => showError(errorId, err.message));
    });
  }

  return { state, reset, loadMore, prepend, remove, render };
}

// ---- view / tab navigation ----------------------------------------------

const lazyLoaded = new Set();
const tabLoaders = {
  canned: loadCannedTab,
  wrapup: () => wrapupResource.reset(),
  queues: loadQueuesTab,
  users: loadUsersAndDivisions,
  skills: () => skillsResource.reset(),
  architect: loadArchitectTab,
  schedules: () => schedulesResource.reset(),
  audit: loadAuditTab,
  explorer: () => {},
};

const tabMeta = {
  canned: { title: 'Canned Responses', sub: 'Reusable agent replies, organised by library', create: 'New response', bulk: true },
  wrapup: { title: 'Wrap-up Codes', sub: 'Disposition codes agents apply after an interaction', create: 'New code', bulk: true },
  queues: { title: 'Queues', sub: 'Select one or more queues to manage members, codes & libraries', create: 'New queue', bulk: false },
  users: { title: 'Users & Divisions', sub: 'Your organisation directory', create: null, bulk: false },
  skills: { title: 'Skills & Routing', sub: 'ACD skills used for skills-based routing', create: 'New skill', bulk: false },
  architect: { title: 'Architect', sub: 'Flows & prompts, and AI-assisted flow generation', create: null, bulk: false },
  schedules: { title: 'Schedules', sub: 'Time periods used by schedule groups and Architect flows', create: 'New schedule', bulk: false },
  audit: { title: 'Audit Log', sub: 'Who changed what, and when', create: null, bulk: false },
  explorer: { title: 'API Explorer', sub: 'Direct access to any Genesys Cloud API v2 endpoint', create: null, bulk: false },
};

function setActiveTab(tab) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== `tab-${tab}`));

  const meta = tabMeta[tab];
  document.getElementById('mainTitle').textContent = meta.title;
  document.getElementById('mainSubtitle').textContent = meta.sub;

  const createBtn = document.getElementById('createBtn');
  createBtn.classList.toggle('hidden', !meta.create);
  if (meta.create) {
    createBtn.textContent = `+ ${meta.create}`;
    createBtn.onclick = () => openCreateModal(tab === 'skills' ? 'skill' : tab === 'queues' ? 'queue' : tab === 'schedules' ? 'schedule' : tab);
  }

  const bulkBtn = document.getElementById('bulkAddBtn');
  bulkBtn.classList.toggle('hidden', !meta.bulk);
  if (meta.bulk) bulkBtn.onclick = () => openBulkModal(tab);

  if (tabLoaders[tab] && !lazyLoaded.has(tab)) {
    lazyLoaded.add(tab);
    // Wrap in Promise.resolve() since not every loader returns a promise (e.g. explorer's is a
    // no-op) — calling .catch() directly on a non-promise return value throws.
    Promise.resolve(tabLoaders[tab]()).catch((err) => showToast(err.message, true));
  }
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    setActiveTab(item.dataset.tab);
    closeSidebarDrawer(); // no-op when the drawer isn't open (desktop layout)
  });
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  setAuthenticated(false);
});

function setAuthenticated(isAuthenticated, region) {
  document.getElementById('view-login').classList.toggle('hidden', isAuthenticated);
  document.getElementById('view-shell').classList.toggle('hidden', !isAuthenticated);

  if (isAuthenticated) {
    document.getElementById('statusRegionLabel').textContent = region;
    setActiveTab('canned');
  } else {
    lazyLoaded.clear();
    allUsersCache = [];
    allWrapupCodesCache = [];
    allLibrariesCache = [];
    currentQueueAssignedWrapupIds = [];
    currentQueueLibraryIds = [];
    document.getElementById('membersUserCount').textContent = '';
    document.getElementById('connectingView').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('clientSecret').value = '';
  }
}

// ---- login / connect-step animation --------------------------------------

async function loadRegions() {
  const resp = await fetch('/api/regions');
  const regions = await resp.json();
  const select = document.getElementById('region');
  regions.forEach(({ id, label, code }) => {
    select.appendChild(el('option', { value: id, text: code ? `${label} (${code})` : label }));
  });
}

document.getElementById('secretToggle').addEventListener('click', () => {
  const input = document.getElementById('clientSecret');
  const toggle = document.getElementById('secretToggle');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  toggle.textContent = showing ? 'Show' : 'Hide';
});

const CONNECT_STEPS = ['Credentials validated', 'Access token issued', 'Loading your org & queues…', 'Ready'];

function renderConnectSteps(doneCount) {
  const container = document.getElementById('connectSteps');
  container.innerHTML = '';
  CONNECT_STEPS.forEach((label, i) => {
    const complete = doneCount > i;
    const current = doneCount === i;
    const mark = el('span', {
      class: 'mark',
      text: complete ? '✓' : '',
      style: `background:${complete ? '#2f7d55' : 'transparent'};border:${complete ? 'none' : current ? '2px solid #e8551e' : '2px solid #d3dae0'}`,
    });
    container.appendChild(
      el('div', { class: 'connect-step', style: `color:${complete || current ? '#152935' : '#b3bcc3'}` }, [mark, cellText(label)])
    );
  });
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('loginError', '');
  const clientId = document.getElementById('clientId').value.trim();
  const clientSecret = document.getElementById('clientSecret').value;
  const region = document.getElementById('region').value;
  const regionLabel = document.getElementById('region').selectedOptions[0].textContent;

  if (!clientId || !clientSecret) {
    showError('loginError', 'Client ID and Client Secret are both required.');
    return;
  }

  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('connectingView').classList.remove('hidden');
  document.getElementById('connectingRegionLabel').textContent = regionLabel;
  renderConnectSteps(0);

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, region }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Login failed');

    renderConnectSteps(1);
    await new Promise((r) => setTimeout(r, 260));
    renderConnectSteps(2);
    await new Promise((r) => setTimeout(r, 320));
    renderConnectSteps(4);
    await new Promise((r) => setTimeout(r, 200));

    setAuthenticated(true, data.region);
  } catch (err) {
    document.getElementById('connectingView').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    showError('loginError', err.message);
  }
});

async function checkStatus() {
  const resp = await fetch('/api/auth/status');
  const data = await resp.json();
  if (data.authenticated) setAuthenticated(true, data.region);
}

// ---- Command palette ------------------------------------------------------

function paletteActions() {
  const nav = [
    ['canned', 'Canned Responses'], ['wrapup', 'Wrap-up Codes'], ['queues', 'Queues'],
    ['skills', 'Skills & Routing'], ['users', 'Users & Divisions'], ['schedules', 'Schedules'], ['explorer', 'API Explorer'],
  ];
  const items = nav.map(([k, l]) => ({ label: `Go to ${l}`, tag: 'Navigate', icon: '→', iconBg: '#4b5b68', run: () => setActiveTab(k) }));
  items.unshift(
    { label: 'New canned response', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('canned'); openCreateModal('canned'); } },
    { label: 'New wrap-up code', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('wrapup'); openCreateModal('wrapup'); } },
    { label: 'New skill', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('skills'); openCreateModal('skill'); } },
    { label: 'New queue', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('queues'); openCreateModal('queue'); } },
    { label: 'New schedule', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('schedules'); openCreateModal('schedule'); } },
    { label: 'New division', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('users'); openCreateModal('division'); } }
  );
  items.push({ label: 'Log out', tag: 'Session', icon: '↩', iconBg: '#8a949c', run: () => document.getElementById('logoutBtn').click() });
  return items;
}

function renderPalette() {
  const query = document.getElementById('paletteInput').value.trim().toLowerCase();
  const list = document.getElementById('paletteList');
  list.innerHTML = '';
  const items = paletteActions().filter((it) => !query || it.label.toLowerCase().includes(query));
  document.getElementById('paletteEmpty').classList.toggle('hidden', items.length > 0);
  items.forEach((it) => {
    const icon = el('span', { class: 'palette-icon', style: `background:${it.iconBg}`, text: it.icon });
    const row = el('div', { class: 'palette-item' }, [icon, el('span', { style: 'flex:1;min-width:0', text: it.label }), el('span', { class: 'palette-tag', text: it.tag })]);
    row.addEventListener('click', () => { closeOverlays(); it.run(); });
    list.appendChild(row);
  });
}

function openPalette() {
  if (document.getElementById('view-shell').classList.contains('hidden')) return;
  document.getElementById('paletteInput').value = '';
  renderPalette();
  document.getElementById('paletteOverlay').classList.remove('hidden');
  document.getElementById('paletteInput').focus();
}

function closeOverlays() {
  document.getElementById('paletteOverlay').classList.add('hidden');
  document.getElementById('createModalOverlay').classList.add('hidden');
  document.getElementById('pickModalOverlay').classList.add('hidden');
  document.getElementById('userModalOverlay').classList.add('hidden');
  document.getElementById('promptModalOverlay').classList.add('hidden');
}

document.getElementById('paletteInput').addEventListener('input', renderPalette);
document.getElementById('paletteOverlay').addEventListener('click', (e) => { if (e.target.id === 'paletteOverlay') closeOverlays(); });

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  if (e.key === 'Escape') closeOverlays();
});

// ---- Rich text toolbar (canned response editor) ----------------------------

// The standard cross-platform "web-safe" font stack — each entry falls back through equivalents
// available on Windows/macOS/Linux so a response still looks reasonable if the named face is
// missing on whoever's viewing it. Shared by both the individual editor and the bulk toolbar so
// the two font lists can't drift out of sync.
const FONT_FAMILY_OPTIONS = [
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['"Arial Black", Gadget, sans-serif', 'Arial Black'],
  ['"Arial Narrow", Arial, sans-serif', 'Arial Narrow'],
  ['"Book Antiqua", "Palatino Linotype", Palatino, serif', 'Book Antiqua'],
  ['Calibri, Candara, Segoe, "Segoe UI", Optima, sans-serif', 'Calibri'],
  ['Cambria, Georgia, serif', 'Cambria'],
  ['Candara, Calibri, Segoe, "Segoe UI", Optima, sans-serif', 'Candara'],
  ['"Century Gothic", CenturyGothic, AppleGothic, sans-serif', 'Century Gothic'],
  ['"Comic Sans MS", "Comic Sans", cursive', 'Comic Sans MS'],
  ['Consolas, Monaco, monospace', 'Consolas'],
  ['Constantia, Georgia, serif', 'Constantia'],
  ['Corbel, "Lucida Grande", "Lucida Sans Unicode", sans-serif', 'Corbel'],
  ['"Courier New", Courier, monospace', 'Courier New'],
  ['"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif', 'Franklin Gothic Medium'],
  ['Garamond, Baskerville, "Baskerville Old Face", "Hoefler Text", "Times New Roman", serif', 'Garamond'],
  ['Georgia, "Times New Roman", Times, serif', 'Georgia'],
  ['Helvetica, Arial, sans-serif', 'Helvetica'],
  ['Impact, Charcoal, sans-serif', 'Impact'],
  ['"Lucida Console", Monaco, monospace', 'Lucida Console'],
  ['"Lucida Sans Unicode", "Lucida Grande", sans-serif', 'Lucida Sans Unicode'],
  ['"Segoe UI", Frutiger, "Frutiger Linotype", "Dejavu Sans", sans-serif', 'Segoe UI'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif', 'Trebuchet MS'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
];

function populateFontFamilySelect(selectId) {
  const select = document.getElementById(selectId);
  FONT_FAMILY_OPTIONS.forEach(([stack, label]) => {
    select.appendChild(el('option', { value: stack, text: label }));
  });
}
populateFontFamilySelect('rtFontFamily');
populateFontFamilySelect('bulkRtFontFamily');

// document.execCommand is deprecated but remains the only zero-dependency way to drive a
// contenteditable region — there's no build step / npm frontend deps in this app to pull in a
// real editor library for what's otherwise a small set of formatting options.
(function initRichTextToolbar() {
  const editor = document.getElementById('createTextInput');
  try {
    document.execCommand('styleWithCSS', false, true); // makes bold/color/font produce inline style= instead of legacy <font>/<b>-only markup
  } catch {
    // Unsupported in some browsers — formatting still works, just via legacy tags.
  }

  function withPreservedSelection(handler) {
    return (e) => {
      e.preventDefault(); // keep the editor's text selection instead of losing it to the toolbar button
      handler();
    };
  }

  document.querySelectorAll('#richtextToolbar .rt-btn[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', withPreservedSelection(() => {
      editor.focus();
      document.execCommand(btn.dataset.cmd);
      syncToolbarState();
    }));
  });

  document.getElementById('rtClear').addEventListener('mousedown', withPreservedSelection(() => {
    editor.focus();
    document.execCommand('removeFormat');
    syncToolbarState();
  }));

  document.getElementById('rtFontFamily').addEventListener('change', (e) => {
    const family = e.target.value;
    editor.focus();
    if (family) document.execCommand('fontName', false, family);
    e.target.value = '';
  });

  document.getElementById('rtFontSize').addEventListener('change', (e) => {
    const px = e.target.value;
    if (px) applyFontSizePx(editor, px);
    e.target.value = '';
  });

  document.getElementById('rtColor').addEventListener('input', (e) => {
    editor.focus();
    document.execCommand('foreColor', false, e.target.value);
  });

  // Paste as plain text only — accepting pasted HTML would let arbitrary markup/attributes into
  // the editor, bypassing the toolbar as the only source of formatting.
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  editor.addEventListener('keyup', syncToolbarState);
  editor.addEventListener('mouseup', syncToolbarState);
  editor.addEventListener('focus', syncToolbarState);
})();

// execCommand('fontSize') only accepts the legacy 1-7 scale, not pixel values — the standard
// workaround is to apply a throwaway size (7), then swap the <font size="7"> it creates for a
// span with the real pixel size.
function applyFontSizePx(editor, px) {
  editor.focus();
  // styleWithCSS (enabled at init, for bold/color/font-name) makes Chrome's 'fontSize' command
  // emit a keyword size (style="font-size: xxx-large") instead of the legacy <font size="7">
  // this workaround depends on — switch it off just for this command, then restore it.
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  document.execCommand('styleWithCSS', false, true);
  editor.querySelectorAll('font[size="7"]').forEach((f) => {
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
    // Replacing the node invalidates the current Selection/Range — restore it over the new span
    // so a formatting command applied right after (e.g. picking a color next) still has something
    // to act on, instead of silently no-op'ing on a stale range.
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

function syncToolbarState() {
  ['bold', 'italic', 'underline'].forEach((cmd) => {
    const btn = document.getElementById(`rt${cmd[0].toUpperCase()}${cmd.slice(1)}`);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}

// ---- Create / Bulk modal ---------------------------------------------------

const CREATE_CONFIG = {
  canned: { title: 'New canned response', needsText: true, placeholder: 'e.g. Greeting', submitLabel: 'Add response' },
  wrapup: { title: 'New wrap-up code', needsText: false, placeholder: 'e.g. Callback requested', submitLabel: 'Add code' },
  skill: { title: 'New skill', needsText: false, placeholder: 'e.g. Spanish', submitLabel: 'Add skill' },
  library: { title: 'New library', needsText: false, placeholder: 'e.g. Support', submitLabel: 'Add library' },
  queue: { title: 'New queue', needsText: false, placeholder: 'e.g. Tier 2 Support', submitLabel: 'Add queue' },
  schedule: { title: 'New schedule', needsText: false, placeholder: 'e.g. Holiday Hours', submitLabel: 'Add schedule' },
  division: { title: 'New division', needsText: false, placeholder: 'e.g. West Region', submitLabel: 'Add division' },
};
const BULK_CONFIG = {
  canned: { title: 'Bulk add responses', label: 'One response per line, formatted as Name | Response text', placeholder: 'Greeting | Hello, thanks for reaching out!\nClosing | Is there anything else I can help with?', submitLabel: 'Bulk create' },
  wrapup: { title: 'Bulk add wrap-up codes', label: 'One code name per line', placeholder: 'Sales\nSupport\nBilling', submitLabel: 'Bulk create' },
};

let activeCreateKind = null;
let activeCreateMode = null; // 'single' | 'bulk'
let activeEditItem = null; // set when editing an existing item; null when creating

const EDIT_TITLES = { canned: 'canned response', wrapup: 'wrap-up code', skill: 'skill', queue: 'queue', schedule: 'schedule', division: 'division' };

function clearInlineErrors() {
  ['createNameError', 'createTextError', 'createScheduleStartError', 'createScheduleEndError'].forEach((id) => {
    const node = document.getElementById(id);
    node.textContent = '';
    node.classList.add('hidden');
  });
}

function showInlineError(id, message) {
  const node = document.getElementById(id);
  node.textContent = message;
  node.classList.remove('hidden');
}

function resourceForKind(kind) {
  return { canned: cannedResource, wrapup: wrapupResource, skill: skillsResource, queue: queuesResource, schedule: schedulesResource }[kind];
}

// Genesys schedules use a "local date-time" with no timezone, e.g. "2026-08-03T09:00:00.000" —
// datetime-local inputs give "2026-08-03T09:00", so pad seconds/millis on the way out and trim
// them on the way back in.
function toGenesysLocalDateTime(value) {
  if (!value) return value;
  return value.length === 16 ? `${value}:00.000` : value;
}

function fromGenesysLocalDateTime(value) {
  return value ? value.slice(0, 16) : '';
}

function formatScheduleDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function isDuplicateName(kind, name, excludeId) {
  const target = name.trim().toLowerCase();
  if (kind === 'division') {
    return divisionsCacheForUsers.some((d) => d.id !== excludeId && (d.name || '').trim().toLowerCase() === target);
  }
  const resource = resourceForKind(kind);
  if (!resource) return false;
  return resource.state.items.some((item) => item.id !== excludeId && (item.name || '').trim().toLowerCase() === target);
}

async function ensureDivisionsCache() {
  if (allDivisionsCache.length === 0) await loadAllDivisionsCache();
}

function populateDivisionSelect(selectedId) {
  const select = document.getElementById('createDivisionInput');
  select.innerHTML = '';
  select.appendChild(el('option', { value: '', text: 'All divisions (default)' }));
  allDivisionsCache.forEach((d) => {
    const opt = el('option', { value: d.id, text: d.name });
    if (d.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

function resetScheduleFields() {
  document.getElementById('createScheduleStart').value = '';
  document.getElementById('createScheduleEnd').value = '';
  document.getElementById('createScheduleRrule').value = '';
  document.getElementById('createScheduleDescription').value = '';
}

async function openCreateModal(kind) {
  const cfg = CREATE_CONFIG[kind];
  if (!cfg) return;
  activeCreateKind = kind;
  activeCreateMode = 'single';
  activeEditItem = null;
  clearInlineErrors();
  document.getElementById('createModalTitle').textContent = cfg.title;
  document.getElementById('createNameField').classList.remove('hidden');
  document.getElementById('createTextField').classList.toggle('hidden', !cfg.needsText);
  document.getElementById('createDivisionField').classList.toggle('hidden', kind !== 'wrapup' && kind !== 'schedule');
  document.getElementById('createScheduleFields').classList.toggle('hidden', kind !== 'schedule');
  document.getElementById('createDivisionDescField').classList.toggle('hidden', kind !== 'division');
  document.getElementById('createBulkField').classList.add('hidden');
  document.getElementById('createNameInput').value = '';
  document.getElementById('createNameInput').placeholder = cfg.placeholder;
  document.getElementById('createTextInput').innerHTML = '';
  document.getElementById('createDivisionDescInput').value = '';
  resetScheduleFields();
  document.getElementById('createBulkResults').innerHTML = '';
  document.getElementById('createModalSubmitBtn').textContent = cfg.submitLabel;
  document.getElementById('createModalOverlay').classList.remove('hidden');
  document.getElementById('createNameInput').focus();
  if (kind === 'wrapup' || kind === 'schedule') {
    await ensureDivisionsCache();
    populateDivisionSelect('');
  }
}

async function openEditModal(kind, item) {
  const cfg = CREATE_CONFIG[kind];
  if (!cfg) return;
  activeCreateKind = kind;
  activeCreateMode = 'single';
  activeEditItem = item;
  clearInlineErrors();
  document.getElementById('createModalTitle').textContent = `Edit ${EDIT_TITLES[kind] || kind}`;
  document.getElementById('createNameField').classList.remove('hidden');
  document.getElementById('createTextField').classList.toggle('hidden', !cfg.needsText);
  document.getElementById('createDivisionField').classList.toggle('hidden', kind !== 'wrapup' && kind !== 'schedule');
  document.getElementById('createScheduleFields').classList.toggle('hidden', kind !== 'schedule');
  document.getElementById('createDivisionDescField').classList.toggle('hidden', kind !== 'division');
  document.getElementById('createBulkField').classList.add('hidden');
  document.getElementById('createNameInput').value = item.name || '';
  document.getElementById('createNameInput').placeholder = cfg.placeholder;
  if (cfg.needsText) {
    document.getElementById('createTextInput').innerHTML = (item.texts && item.texts[0] && item.texts[0].content) || '';
  }
  document.getElementById('createDivisionDescInput').value = kind === 'division' ? item.description || '' : '';
  resetScheduleFields();
  if (kind === 'schedule') {
    document.getElementById('createScheduleStart').value = fromGenesysLocalDateTime(item.start);
    document.getElementById('createScheduleEnd').value = fromGenesysLocalDateTime(item.end);
    document.getElementById('createScheduleRrule').value = item.rrule || '';
    document.getElementById('createScheduleDescription').value = item.description || '';
  }
  document.getElementById('createBulkResults').innerHTML = '';
  document.getElementById('createModalSubmitBtn').textContent = 'Save changes';
  document.getElementById('createModalOverlay').classList.remove('hidden');
  document.getElementById('createNameInput').focus();
  if (kind === 'wrapup' || kind === 'schedule') {
    await ensureDivisionsCache();
    const currentDivisionId = item.division && item.division.id !== '*' ? item.division.id : '';
    populateDivisionSelect(currentDivisionId);
  }
}

function resetBulkRichToolbar() {
  document.getElementById('bulkRtFontFamily').value = '';
  document.getElementById('bulkRtFontSize').value = '';
  document.getElementById('bulkRtColor').value = '#152935';
  ['bulkRtBold', 'bulkRtItalic', 'bulkRtUnderline'].forEach((id) => document.getElementById(id).classList.remove('active'));
}

function openBulkModal(kind) {
  const cfg = BULK_CONFIG[kind];
  if (!cfg) return;
  activeCreateKind = kind;
  activeCreateMode = 'bulk';
  activeEditItem = null;
  document.getElementById('createModalTitle').textContent = cfg.title;
  document.getElementById('createNameField').classList.add('hidden');
  document.getElementById('createTextField').classList.add('hidden');
  document.getElementById('createDivisionField').classList.add('hidden');
  document.getElementById('createBulkField').classList.remove('hidden');
  document.getElementById('createBulkLabel').textContent = cfg.label;
  document.getElementById('createBulkRichToolbar').classList.toggle('hidden', kind !== 'canned');
  resetBulkRichToolbar();
  document.getElementById('createBulkInput').value = '';
  document.getElementById('createBulkInput').placeholder = cfg.placeholder;
  document.getElementById('createBulkResults').innerHTML = '';
  document.getElementById('createModalSubmitBtn').textContent = cfg.submitLabel;
  document.getElementById('createModalOverlay').classList.remove('hidden');
}

// Bold/italic/underline in the bulk toolbar are simple on/off toggles (not execCommand) — the
// chosen formatting is applied uniformly to every line's text when the batch is submitted, since
// there's no per-character selection to format in a bulk textarea.
document.querySelectorAll('#createBulkRichToolbar .rt-btn').forEach((btn) => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});

function currentBulkFormat() {
  return {
    fontFamily: document.getElementById('bulkRtFontFamily').value,
    fontSize: document.getElementById('bulkRtFontSize').value,
    color: document.getElementById('bulkRtColor').value,
    bold: document.getElementById('bulkRtBold').classList.contains('active'),
    italic: document.getElementById('bulkRtItalic').classList.contains('active'),
    underline: document.getElementById('bulkRtUnderline').classList.contains('active'),
  };
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Applies the bulk toolbar's chosen formatting to one line of plain text, producing the same kind
// of markup the individual rich-text editor would (span with inline style, wrapped in b/i/u).
function applyBulkFormat(plainText, fmt) {
  let html = escapeHtml(plainText);
  if (fmt.bold) html = `<b>${html}</b>`;
  if (fmt.italic) html = `<i>${html}</i>`;
  if (fmt.underline) html = `<u>${html}</u>`;
  const styleParts = [];
  if (fmt.fontFamily) styleParts.push(`font-family: ${fmt.fontFamily}`);
  if (fmt.fontSize) styleParts.push(`font-size: ${fmt.fontSize}px`);
  if (fmt.color) styleParts.push(`color: ${fmt.color}`);
  if (styleParts.length) html = `<span style="${styleParts.join('; ')}">${html}</span>`;
  return html;
}

document.getElementById('createModalCancelBtn').addEventListener('click', closeOverlays);
document.getElementById('createModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'createModalOverlay') closeOverlays(); });

document.getElementById('createModalSubmitBtn').addEventListener('click', async () => {
  const btn = document.getElementById('createModalSubmitBtn');
  if (activeCreateMode === 'single') {
    clearInlineErrors();
    const name = document.getElementById('createNameInput').value.trim();
    const cfg = CREATE_CONFIG[activeCreateKind];
    const textEditor = document.getElementById('createTextInput');
    const text = textEditor.innerHTML.trim(); // saved as-is (HTML) — textContent below is only for the "is it empty" check
    const divisionId = document.getElementById('createDivisionInput').value;
    const scheduleExtra = activeCreateKind === 'schedule' ? {
      start: document.getElementById('createScheduleStart').value,
      end: document.getElementById('createScheduleEnd').value,
      rrule: document.getElementById('createScheduleRrule').value.trim(),
      description: document.getElementById('createScheduleDescription').value.trim(),
    } : null;
    const divisionExtra = activeCreateKind === 'division' ? {
      description: document.getElementById('createDivisionDescInput').value.trim(),
    } : null;

    let hasError = false;
    if (!name) {
      showInlineError('createNameError', 'Name is required.');
      hasError = true;
    } else if (isDuplicateName(activeCreateKind, name, activeEditItem ? activeEditItem.id : null)) {
      showInlineError('createNameError', `An item named "${name}" already exists.`);
      hasError = true;
    }
    if (cfg && cfg.needsText && !textEditor.textContent.trim()) {
      showInlineError('createTextError', 'Response text cannot be empty.');
      hasError = true;
    }
    if (scheduleExtra) {
      if (!scheduleExtra.start) {
        showInlineError('createScheduleStartError', 'Start is required.');
        hasError = true;
      }
      if (!scheduleExtra.end) {
        showInlineError('createScheduleEndError', 'End is required.');
        hasError = true;
      } else if (scheduleExtra.start && scheduleExtra.end <= scheduleExtra.start) {
        showInlineError('createScheduleEndError', 'End must be after start.');
        hasError = true;
      }
    }
    if (hasError) return;

    await withBusy(btn, activeEditItem ? 'Saving…' : 'Adding…', async () => {
      try {
        if (activeEditItem) {
          await submitSingleEdit(activeCreateKind, activeEditItem, name, text, divisionId, scheduleExtra, divisionExtra);
          showToast(`Saved "${name}".`);
        } else {
          await submitSingleCreate(activeCreateKind, name, text, divisionId, scheduleExtra, divisionExtra);
          showToast(`Created "${name}"`);
        }
        closeOverlays();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  } else {
    const lines = parseLines(document.getElementById('createBulkInput').value);
    if (!lines.length) return;
    await withBusy(btn, `Creating ${lines.length}…`, async () => {
      const results = await submitBulkCreate(activeCreateKind, lines);
      renderBulkResults('createBulkResults', results);
      document.getElementById('createBulkInput').value = '';
    });
  }
});

async function submitSingleCreate(kind, name, text, divisionId, scheduleExtra, divisionExtra) {
  if (kind === 'canned') {
    const libraryId = document.getElementById('cannedLibrarySelect').value;
    if (!libraryId) throw new Error('Create or select a library first.');
    const created = await proxy('POST', '/api/v2/responsemanagement/responses', {
      body: { name, libraries: [{ id: libraryId }], texts: [{ content: text, contentType: 'text/html' }] },
    });
    cannedResource.prepend(created);
  } else if (kind === 'wrapup') {
    const body = { name };
    if (divisionId) body.division = { id: divisionId };
    const created = await proxy('POST', '/api/v2/routing/wrapupcodes', { body });
    wrapupResource.prepend(created);
    registerNewWrapupCode(created);
  } else if (kind === 'skill') {
    const created = await proxy('POST', '/api/v2/routing/skills', { body: { name } });
    skillsResource.prepend(created);
  } else if (kind === 'library') {
    const created = await proxy('POST', '/api/v2/responsemanagement/libraries', { body: { name } });
    await loadCannedLibraries();
    document.getElementById('cannedLibrarySelect').value = created.id;
    await cannedResource.reset();
    registerNewLibrary(created);
  } else if (kind === 'queue') {
    const created = await proxy('POST', '/api/v2/routing/queues', { body: { name } });
    queuesResource.prepend(created);
  } else if (kind === 'schedule') {
    const body = {
      name,
      start: toGenesysLocalDateTime(scheduleExtra.start),
      end: toGenesysLocalDateTime(scheduleExtra.end),
    };
    if (scheduleExtra.rrule) body.rrule = scheduleExtra.rrule;
    if (scheduleExtra.description) body.description = scheduleExtra.description;
    if (divisionId) body.division = { id: divisionId };
    const created = await proxy('POST', '/api/v2/architect/schedules', { body });
    schedulesResource.prepend(created);
  } else if (kind === 'division') {
    await proxy('POST', '/api/v2/authorization/divisions', {
      body: { name, description: divisionExtra.description || name },
    });
    await loadDivisions();
  }
}

async function submitBulkCreate(kind, lines) {
  const results = [];
  if (kind === 'canned') {
    const libraryId = document.getElementById('cannedLibrarySelect').value;
    if (!libraryId) { showToast('Create or select a library first.', true); return []; }
    const fmt = currentBulkFormat();
    for (const line of lines) {
      const sep = line.indexOf('|');
      if (sep === -1) { results.push({ label: line, ok: false, message: 'expected "Name | Response text"' }); continue; }
      const name = line.slice(0, sep).trim();
      const plainText = line.slice(sep + 1).trim();
      if (!name || !plainText) { results.push({ label: line, ok: false, message: 'name and text are both required' }); continue; }
      try {
        const content = applyBulkFormat(plainText, fmt);
        const created = await proxy('POST', '/api/v2/responsemanagement/responses', {
          body: { name, libraries: [{ id: libraryId }], texts: [{ content, contentType: 'text/html' }] },
        });
        cannedResource.prepend(created);
        results.push({ label: name, ok: true });
      } catch (err) {
        results.push({ label: name, ok: false, message: err.message });
      }
    }
  } else if (kind === 'wrapup') {
    for (const name of lines) {
      try {
        const created = await proxy('POST', '/api/v2/routing/wrapupcodes', { body: { name } });
        wrapupResource.prepend(created);
        registerNewWrapupCode(created);
        results.push({ label: name, ok: true });
      } catch (err) {
        results.push({ label: name, ok: false, message: err.message });
      }
    }
  }
  return results;
}

async function submitSingleEdit(kind, item, name, text, divisionId, scheduleExtra, divisionExtra) {
  if (kind === 'canned') {
    const libraries = (item.libraries || []).map((l) => ({ id: l.id }));
    const updated = await proxy('PUT', `/api/v2/responsemanagement/responses/${item.id}`, {
      body: { name, libraries, texts: [{ content: text, contentType: 'text/html' }] },
    });
    cannedResource.remove(item.id);
    cannedResource.prepend(updated);
  } else if (kind === 'wrapup') {
    const body = { name };
    if (divisionId) body.division = { id: divisionId };
    const updated = await proxy('PUT', `/api/v2/routing/wrapupcodes/${item.id}`, { body });
    wrapupResource.remove(item.id);
    wrapupResource.prepend(updated);
  } else if (kind === 'skill') {
    const updated = await proxy('PATCH', `/api/v2/routing/skills/${item.id}`, { body: { name } });
    skillsResource.remove(item.id);
    skillsResource.prepend(updated);
  } else if (kind === 'queue') {
    const updated = await proxy('PATCH', `/api/v2/routing/queues/${item.id}`, { body: { name } });
    queuesResource.remove(item.id);
    queuesResource.prepend(updated);
  } else if (kind === 'schedule') {
    const body = {
      name,
      start: toGenesysLocalDateTime(scheduleExtra.start),
      end: toGenesysLocalDateTime(scheduleExtra.end),
    };
    if (scheduleExtra.rrule) body.rrule = scheduleExtra.rrule;
    if (scheduleExtra.description) body.description = scheduleExtra.description;
    if (divisionId) body.division = { id: divisionId };
    const updated = await proxy('PUT', `/api/v2/architect/schedules/${item.id}`, { body });
    schedulesResource.remove(item.id);
    schedulesResource.prepend(updated);
  } else if (kind === 'division') {
    await proxy('PUT', `/api/v2/authorization/divisions/${item.id}`, {
      body: { name, description: divisionExtra.description || item.description || name },
    });
    await loadDivisions();
  }
}

// ---- Pick modal (members / wrap-up codes / libraries) ---------------------

let activePickKind = null; // 'members' | 'wrapupAssign' | 'libraryChoose' | 'divisionUsers'
let pickSelection = new Set();
let pickPool = []; // [{id, label}]
let activePickDivisionId = null;
let activePickDivisionName = '';

function renderPickList() {
  const filterText = document.getElementById('pickModalFilter').value.trim().toLowerCase();
  const list = document.getElementById('pickModalList');
  list.innerHTML = '';
  const filtered = pickPool.filter(
    (p) => !filterText || p.label.toLowerCase().includes(filterText) || (p.sub || '').toLowerCase().includes(filterText)
  );
  document.getElementById('pickModalEmpty').classList.toggle('hidden', filtered.length > 0);
  filtered.forEach((p) => {
    const selected = pickSelection.has(p.id);
    const box = el('span', { class: 'pick-box', text: selected ? '✓' : '' });
    const mainCol = p.sub
      ? el('div', { class: 'pick-row-main' }, [cellText(p.label), el('div', { class: 'pick-row-skills', text: p.sub })])
      : cellText(p.label);
    const row = el('div', { class: `pick-row${selected ? ' selected' : ''}` }, [box, mainCol]);
    row.addEventListener('click', () => {
      if (pickSelection.has(p.id)) pickSelection.delete(p.id); else pickSelection.add(p.id);
      renderPickList();
      updatePickCount();
    });
    list.appendChild(row);
  });
}

function updatePickCount() {
  document.getElementById('pickModalCount').textContent = pickSelection.size ? `${pickSelection.size} selected` : '';
}

function openPickModal(kind) {
  activePickKind = kind;
  pickSelection = new Set();
  const queueIds = getSelectedQueueIds();

  if (kind === 'members') {
    document.getElementById('pickModalTitle').textContent = 'Add members';
    document.getElementById('pickModalApplyBtn').textContent = 'Add to queue(s)';
    const excluded = queueIds.length === 1 ? new Set(currentQueueMemberIds) : new Set();
    pickPool = allUsersCache
      .filter((u) => !excluded.has(u.id))
      .map((u) => ({
        id: u.id,
        label: u.email ? `${u.name} (${u.email})` : u.name,
        sub: u.skills && u.skills.length ? `Skills: ${u.skills.join(', ')}` : '',
      }));
  } else if (kind === 'wrapupAssign') {
    document.getElementById('pickModalTitle').textContent = 'Assign wrap-up codes';
    document.getElementById('pickModalApplyBtn').textContent = 'Assign';
    const excluded = queueIds.length === 1 ? new Set(currentQueueAssignedWrapupIds) : new Set();
    pickPool = allWrapupCodesCache.filter((c) => !excluded.has(c.id)).map((c) => ({ id: c.id, label: c.name }));
  } else if (kind === 'libraryChoose') {
    document.getElementById('pickModalTitle').textContent = 'Choose libraries';
    document.getElementById('pickModalApplyBtn').textContent = 'Save';
    pickPool = allLibrariesCache.map((l) => ({ id: l.id, label: l.name }));
    if (queueIds.length === 1) currentQueueLibraryIds.forEach((id) => pickSelection.add(id));
  } else if (kind === 'divisionUsers') {
    document.getElementById('pickModalTitle').textContent = 'Manage division users';
    document.getElementById('pickModalApplyBtn').textContent = 'Save';
    pickPool = allUsersCache.map((u) => ({ id: u.id, label: u.email ? `${u.name} (${u.email})` : u.name }));
    allUsersCache.forEach((u) => {
      if (u.division && u.division.id === activePickDivisionId) pickSelection.add(u.id);
    });
  }

  if (kind === 'divisionUsers') {
    document.getElementById('pickModalSubtitle').textContent = `To ${activePickDivisionName}`;
  } else {
    const queueNames = getSelectedQueueNames();
    document.getElementById('pickModalSubtitle').textContent =
      queueNames.length === 1 ? `To ${queueNames[0]}` : queueNames.length ? `To ${queueNames.length} queues` : '';
  }

  document.getElementById('pickModalFilter').value = '';
  renderPickList();
  updatePickCount();
  document.getElementById('pickModalOverlay').classList.remove('hidden');
}

document.getElementById('pickModalFilter').addEventListener('input', renderPickList);
document.getElementById('pickModalCancelBtn').addEventListener('click', closeOverlays);
document.getElementById('pickModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'pickModalOverlay') closeOverlays(); });

document.getElementById('pickModalApplyBtn').addEventListener('click', async () => {
  const btn = document.getElementById('pickModalApplyBtn');
  const ids = [...pickSelection];

  if (activePickKind === 'divisionUsers') {
    await withBusy(btn, 'Saving…', async () => {
      try {
        await saveDivisionUsers(activePickDivisionId, ids);
        showToast('Division membership updated.');
        closeOverlays();
      } catch (err) {
        showToast(err.message, true);
      }
    });
    return;
  }

  const queueIds = getSelectedQueueIds();
  if (!queueIds.length) { showToast('Select at least one queue first.', true); return; }

  await withBusy(btn, 'Saving…', async () => {
    try {
      if (activePickKind === 'members') {
        if (!ids.length) { closeOverlays(); return; }
        if (allUsersCache.length === 0) throw new Error('Load the user directory first.');
        await bulkAddMembers(queueIds, ids);
        showToast(`Added ${ids.length} user(s) to ${queueIds.length === 1 ? 'the queue' : queueIds.length + ' queues'}.`);
      } else if (activePickKind === 'wrapupAssign') {
        if (!ids.length) { closeOverlays(); return; }
        await bulkAssignWrapupCodes(queueIds, ids);
        showToast(`Assigned ${ids.length} code(s) to ${queueIds.length === 1 ? 'the queue' : queueIds.length + ' queues'}.`);
      } else if (activePickKind === 'libraryChoose') {
        await saveLibraryMode(queueIds, 'Selected', ids);
        showToast('Libraries saved.');
      }
      closeOverlays();
      await refreshManagedQueuePanels();
    } catch (err) {
      showToast(err.message, true);
    }
  });
});

// ---- Canned Responses ----------------------------------------------------

const cannedResource = createListResource({
  path: '/api/v2/responsemanagement/responses',
  query: () => ({ libraryId: document.getElementById('cannedLibrarySelect').value }),
  pageSize: 50,
  containerId: 'cannedTableBody',
  filterId: 'cannedFilter',
  loadMoreId: 'cannedLoadMoreBtn',
  emptyId: 'cannedEmpty',
  errorId: 'cannedError',
  buildRow: (response) => {
    const text = (response.texts && response.texts[0] && response.texts[0].content) || '';

    const previewEl = el('div', { class: 'response-preview' });
    previewEl.appendChild(sanitizeHtmlToFragment(text));
    const sourceEl = el('div', { class: 'response-source hidden', text });
    const toggle = el('span', { class: 'response-toggle', text: 'View source' });
    let showingSource = false;
    toggle.addEventListener('click', () => {
      showingSource = !showingSource;
      previewEl.classList.toggle('hidden', showingSource);
      sourceEl.classList.toggle('hidden', !showingSource);
      toggle.textContent = showingSource ? 'View rendered' : 'View source';
    });
    const textCell = el('div', {}, [previewEl, sourceEl, toggle]);

    const editBtn = el('span', { class: 'row-edit', text: 'Edit' });
    editBtn.addEventListener('click', () => openEditModal('canned', response));

    const del = el('span', { class: 'row-delete', text: 'Delete' });
    del.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Delete canned response',
        message: `Delete "${response.name}"? You'll have a few seconds to undo before it's actually removed.`,
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: response.name,
        remove: () => cannedResource.remove(response.id),
        restore: () => cannedResource.prepend(response),
        commit: () => proxy('DELETE', `/api/v2/responsemanagement/responses/${response.id}`),
      });
    });

    return gridRow('1.1fr 2.2fr auto', [cellText(response.name, 'name'), textCell, el('div', { class: 'row-actions' }, [editBtn, del])]);
  },
});

async function loadCannedLibraries() {
  const data = await proxy('GET', '/api/v2/responsemanagement/libraries', { query: { pageSize: 100 } });
  const select = document.getElementById('cannedLibrarySelect');
  const previous = select.value;
  select.innerHTML = '';
  (data.entities || []).forEach((lib) => select.appendChild(el('option', { value: lib.id, text: lib.name })));
  if (previous && [...select.options].some((o) => o.value === previous)) select.value = previous;
}

async function loadCannedTab() {
  await loadCannedLibraries();
  if (document.getElementById('cannedLibrarySelect').value) await cannedResource.reset();
}

document.getElementById('cannedLibrarySelect').addEventListener('change', () => {
  cannedResource.reset().catch((err) => showToast(err.message, true));
});

document.getElementById('cannedNewLibraryBtn').addEventListener('click', () => openCreateModal('library'));

// ---- Wrap-up Codes ----------------------------------------------------

const wrapupResource = createListResource({
  path: '/api/v2/routing/wrapupcodes',
  pageSize: 50,
  containerId: 'wrapupTableBody',
  filterId: 'wrapupFilter',
  loadMoreId: 'wrapupLoadMoreBtn',
  emptyId: 'wrapupEmpty',
  errorId: 'wrapupError',
  buildRow: (code) => {
    // Genesys uses the wildcard division id "*" to mean "all divisions" and omits a name for it.
    const divisionName = code.division && code.division.id === '*' ? 'All divisions' : (code.division && code.division.name) || '—';

    const editBtn = el('span', { class: 'row-edit', text: 'Edit' });
    editBtn.addEventListener('click', () => openEditModal('wrapup', code));

    const del = el('span', { class: 'row-delete', text: 'Delete' });
    del.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Delete wrap-up code',
        message: `Delete "${code.name}"? You'll have a few seconds to undo before it's actually removed.`,
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: code.name,
        remove: () => wrapupResource.remove(code.id),
        restore: () => wrapupResource.prepend(code),
        commit: () => proxy('DELETE', `/api/v2/routing/wrapupcodes/${code.id}`),
      });
    });
    return gridRow('2fr 1.4fr auto', [cellText(code.name, 'name'), cellText(divisionName, 'muted'), el('div', { class: 'row-actions' }, [editBtn, del])]);
  },
});

let allDivisionsCache = [];

async function loadAllDivisionsCache() {
  const data = await proxy('GET', '/api/v2/authorization/divisions', { query: { pageSize: 100 } });
  allDivisionsCache = data.entities || [];
}

// ---- Schedules ----------------------------------------------------

const schedulesResource = createListResource({
  path: '/api/v2/architect/schedules',
  pageSize: 50,
  containerId: 'schedulesTableBody',
  filterId: 'schedulesFilter',
  loadMoreId: 'schedulesLoadMoreBtn',
  emptyId: 'schedulesEmpty',
  errorId: 'schedulesError',
  buildRow: (schedule) => {
    const divisionName = schedule.division && schedule.division.id === '*' ? 'All divisions' : (schedule.division && schedule.division.name) || '—';
    const period = `${formatScheduleDate(schedule.start)} → ${formatScheduleDate(schedule.end)}`;
    const recurrence = schedule.rrule || 'One-time';

    const editBtn = el('span', { class: 'row-edit', text: 'Edit' });
    editBtn.addEventListener('click', () => openEditModal('schedule', schedule));

    const del = el('span', { class: 'row-delete', text: 'Delete' });
    del.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Delete schedule',
        message: `Delete "${schedule.name}"? You'll have a few seconds to undo before it's actually removed.`,
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: schedule.name,
        remove: () => schedulesResource.remove(schedule.id),
        restore: () => schedulesResource.prepend(schedule),
        commit: () => proxy('DELETE', `/api/v2/architect/schedules/${schedule.id}`),
      });
    });

    return gridRow('1.3fr 1.6fr 1.1fr 1fr auto', [
      cellText(schedule.name, 'name'),
      cellText(period, 'muted'),
      el('span', { class: 'muted', text: recurrence, title: schedule.rrule || '' }),
      cellText(divisionName, 'muted'),
      el('div', { class: 'row-actions' }, [editBtn, del]),
    ]);
  },
});

// ---- Queues ----------------------------------------------------

const queuesResource = createListResource({
  path: '/api/v2/routing/queues',
  pageSize: 50,
  containerId: 'queuesTableBody',
  filterId: 'queuesFilter',
  loadMoreId: 'queuesLoadMoreBtn',
  buildRow: (queue) => {
    const selected = getSelectedQueueIds().includes(queue.id);

    const editBtn = el('span', { class: 'row-edit', style: 'float:right;margin-right:10px', text: 'Edit' });
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal('queue', queue);
    });

    const del = el('span', { class: 'row-delete', text: 'Delete', style: 'float:right' });
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmModal({
        title: 'Delete queue',
        message: `Delete "${queue.name}"? You'll have a few seconds to undo before it's actually removed.`,
      });
      if (!ok) return;
      const wasSelected = selectedQueueIds.has(queue.id);
      showUndoableDelete({
        itemName: queue.name,
        remove: () => {
          queuesResource.remove(queue.id);
          selectedQueueIds.delete(queue.id);
          refreshManagedQueuePanels();
        },
        restore: () => {
          queuesResource.prepend(queue);
          if (wasSelected) selectedQueueIds.add(queue.id);
          refreshManagedQueuePanels();
        },
        commit: () => proxy('DELETE', `/api/v2/routing/queues/${queue.id}`),
      });
    });
    const row = el('div', { class: `queue-list-item${selected ? ' selected' : ''}` }, [
      el('div', { class: 'name' }, [cellText(queue.name), del, editBtn]),
      el('div', { class: 'meta', text: `${(queue.division && queue.division.name) || ''} · ${queue.memberCount || 0} members` }),
    ]);
    row.addEventListener('click', () => toggleQueueSelection(queue.id));
    return row;
  },
  onLoaded: () => queuesResource.render(),
});

const selectedQueueIds = new Set();

function toggleQueueSelection(queueId) {
  if (selectedQueueIds.has(queueId)) selectedQueueIds.delete(queueId); else selectedQueueIds.add(queueId);
  queuesResource.render();
  refreshManagedQueuePanels();
}

function getSelectedQueueIds() { return [...selectedQueueIds]; }
function getSelectedQueueNames() {
  return queuesResource.state.items.filter((q) => selectedQueueIds.has(q.id)).map((q) => q.name);
}

let userDirectoryLoadStarted = false;

async function loadQueuesTab() {
  await queuesResource.reset();
  await Promise.all([loadAllWrapupCodesCache(), loadAllLibrariesCache()]);
  await refreshManagedQueuePanels();
  // Lazily kick off the user directory load in the background the first time the Queues tab is
  // opened, instead of requiring a manual click — it can be slow for large orgs, so it isn't awaited.
  if (!userDirectoryLoadStarted) {
    userDirectoryLoadStarted = true;
    withBusy(document.getElementById('membersLoadUsersBtn'), 'Loading…', loadUserDirectory).catch((err) =>
      showError('membersError', err.message)
    );
  }
}

async function refreshManagedQueuePanels() {
  const queueIds = getSelectedQueueIds();
  const names = getSelectedQueueNames();
  const summary = document.getElementById('queueSelectionSummary');
  const meta = document.getElementById('queueSelectionMeta');
  const multiWrap = document.getElementById('queueMultiHintWrapper');
  const membersCard = document.getElementById('queueMembersCard');
  const settingsGrid = document.getElementById('queueSettingsGrid');

  const deleteSelectedBtn = document.getElementById('queuesDeleteSelectedBtn');
  deleteSelectedBtn.classList.toggle('hidden', queueIds.length === 0);
  deleteSelectedBtn.textContent = `Delete selected (${queueIds.length})`;

  if (queueIds.length === 0) {
    summary.textContent = 'Select a queue';
    meta.textContent = 'Click a queue on the left to manage it (select several to bulk-assign).';
    settingsGrid.classList.add('hidden');
    multiWrap.classList.add('hidden');
    membersCard.classList.remove('hidden');
    document.getElementById('queueMembersChips').innerHTML = '';
    currentQueueMembersList = [];
    currentQueueMemberIds = [];
    currentQueueWrapupList = [];
    currentQueueAssignedWrapupIds = [];
    currentQueueLibraryIds = [];
    document.getElementById('queueWrapupChips').innerHTML = '';
    renderLibrarySegment('All');
    document.getElementById('queueLibraryChooseWrap').classList.add('hidden');
    return;
  }

  if (queueIds.length === 1) {
    const q = queuesResource.state.items.find((x) => x.id === queueIds[0]);
    summary.textContent = q ? q.name : 'Queue';
    meta.textContent = q ? `${(q.division && q.division.name) || ''} · ${q.memberCount || 0} members` : '';
    multiWrap.classList.add('hidden');
    membersCard.classList.remove('hidden');
    await Promise.all([
      loadQueueMembers(queueIds[0]).catch((err) => showError('membersError', err.message)),
      loadQueueWrapupCodes(queueIds[0]).catch((err) => showError('queueWrapupError', err.message)),
      loadQueueLibraryConfig(queueIds[0]).catch((err) => showError('queueLibraryError', err.message)),
    ]);
    return;
  }

  summary.textContent = `${queueIds.length} queues selected`;
  meta.textContent = names.join(', ');
  settingsGrid.classList.add('hidden');
  multiWrap.classList.remove('hidden');
  document.getElementById('queueMultiHint').textContent =
    `${queueIds.length} queues selected — members, wrap-up codes and library settings picked below will be applied to all of them.`;
  currentQueueMembersList = [];
  currentQueueMemberIds = [];
  currentQueueWrapupList = [];
  currentQueueAssignedWrapupIds = [];
  currentQueueLibraryIds = [];
  document.getElementById('queueMembersChips').innerHTML = '';
  document.getElementById('queueWrapupChips').innerHTML = '';
  renderLibrarySegment('All');
  document.getElementById('queueLibraryChooseWrap').classList.add('hidden');
}

document.getElementById('queuesRefreshBtn') && document.getElementById('queuesRefreshBtn').addEventListener('click', () => {
  loadQueuesTab().catch((err) => showToast(err.message, true));
});

document.getElementById('queuesDeleteSelectedBtn').addEventListener('click', async () => {
  const ids = getSelectedQueueIds();
  if (!ids.length) return;
  const names = getSelectedQueueNames();
  const count = ids.length;
  const listLabel = names.length <= 5 ? names.join(', ') : `${count} queues`;

  const ok = await confirmModal({
    title: `Delete ${count} queue${count === 1 ? '' : 's'}`,
    message: `Delete ${listLabel}? You'll have a few seconds to undo before ${count === 1 ? 'it is' : 'they are'} actually removed.`,
  });
  if (!ok) return;

  const queuesToDelete = queuesResource.state.items.filter((q) => ids.includes(q.id));
  const wasSelected = new Set(ids);

  showUndoableDelete({
    itemName: count === 1 ? names[0] : `${count} queues`,
    remove: () => {
      ids.forEach((id) => {
        queuesResource.remove(id);
        selectedQueueIds.delete(id);
      });
      refreshManagedQueuePanels();
    },
    restore: () => {
      queuesToDelete.forEach((q) => {
        queuesResource.prepend(q);
        if (wasSelected.has(q.id)) selectedQueueIds.add(q.id);
      });
      refreshManagedQueuePanels();
    },
    commit: async () => {
      const results = await Promise.allSettled(ids.map((id) => proxy('DELETE', `/api/v2/routing/queues/${id}`)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw new Error(`${failed.length} of ${count} could not be deleted`);
    },
  });
});

// ---- Queue members (real GET/POST/DELETE against Genesys) -----------------

let currentQueueMemberIds = [];

let currentQueueMembersList = []; // [{id, name}] — kept locally so remove/undo doesn't need a refetch

function renderMemberChips(queueId) {
  const chips = document.getElementById('queueMembersChips');
  chips.innerHTML = '';
  currentQueueMemberIds = currentQueueMembersList.map((m) => m.id);
  currentQueueMembersList.forEach((m) => {
    const chip = el('span', { class: 'chip', text: `${m.name}  ×` });
    chip.style.cursor = 'pointer';
    chip.title = 'Click to remove';
    chip.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Remove member',
        message: `Remove "${m.name}" from this queue? You'll have a few seconds to undo.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: m.name,
        remove: () => {
          currentQueueMembersList = currentQueueMembersList.filter((x) => x.id !== m.id);
          renderMemberChips(queueId);
        },
        restore: () => {
          currentQueueMembersList.push(m);
          renderMemberChips(queueId);
        },
        commit: () => proxy('DELETE', `/api/v2/routing/queues/${queueId}/members/${m.id}`),
      });
    });
    chips.appendChild(chip);
  });
}

async function loadQueueMembers(queueId) {
  showError('membersError', '');
  const data = await proxy('GET', `/api/v2/routing/queues/${queueId}/members`, { query: { pageSize: 200 } });
  const members = data.entities || [];
  // QueueMember's "id" is documented as the member's user id; "user" may also be present when expanded.
  const memberId = (m) => (m.user && m.user.id) || m.id;
  const memberName = (m) => (m.user && m.user.name) || m.name || memberId(m);
  currentQueueMembersList = members.map((m) => ({ id: memberId(m), name: memberName(m) })).filter((m) => m.id);
  renderMemberChips(queueId);
}

async function bulkAddMembers(queueIds, userIds) {
  const batchSize = 100;
  for (const queueId of queueIds) {
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize).map((id) => ({ id }));
      await proxy('POST', `/api/v2/routing/queues/${queueId}/members`, { body: batch });
    }
  }
}

document.getElementById('membersAddBtn').addEventListener('click', () => {
  if (!getSelectedQueueIds().length) { showToast('Select at least one queue first.', true); return; }
  openPickModal('members');
});

// ---- User directory ----------------------------------------------

let allUsersCache = []; // {id, name, email, division}

async function loadUserDirectory() {
  allUsersCache = [];
  let pageNumber = 1;
  const pageSize = 200;
  const maxPages = 25;
  let total = Infinity;

  while ((pageNumber - 1) * pageSize < total && pageNumber <= maxPages) {
    const data = await proxy('GET', '/api/v2/users', { query: { pageNumber, pageSize, expand: 'skills' } });
    total = data.total || 0;
    allUsersCache = allUsersCache.concat(
      (data.entities || []).map((u) => ({ id: u.id, name: u.name, email: u.email, skills: (u.skills || []).map((s) => s.name), division: u.division }))
    );
    pageNumber += 1;
  }
  document.getElementById('membersUserCount').textContent = `${allUsersCache.length} users loaded`;
}

document.getElementById('membersLoadUsersBtn').addEventListener('click', async (e) => {
  showError('membersError', '');
  await withBusy(e.target, 'Loading…', async () => {
    try {
      await loadUserDirectory();
    } catch (err) {
      showError('membersError', err.message);
    }
  });
});

// ---- Wrap-up codes on a queue --------------------------------------------

let allWrapupCodesCache = [];
let currentQueueAssignedWrapupIds = [];

async function loadAllWrapupCodesCache() {
  allWrapupCodesCache = [];
  let pageNumber = 1;
  const pageSize = 200;
  const maxPages = 10;
  let total = Infinity;
  while ((pageNumber - 1) * pageSize < total && pageNumber <= maxPages) {
    const data = await proxy('GET', '/api/v2/routing/wrapupcodes', { query: { pageNumber, pageSize } });
    total = data.total || 0;
    allWrapupCodesCache = allWrapupCodesCache.concat(data.entities || []);
    pageNumber += 1;
  }
}

function registerNewWrapupCode(code) {
  allWrapupCodesCache.push(code);
}

let currentQueueWrapupList = []; // [{id, name}] — kept locally so remove/undo doesn't need a refetch

function renderQueueWrapupChips(queueId) {
  const chips = document.getElementById('queueWrapupChips');
  chips.innerHTML = '';
  currentQueueAssignedWrapupIds = currentQueueWrapupList.map((c) => c.id);
  currentQueueWrapupList.forEach((code) => {
    const chip = el('span', { class: 'chip-accent', text: `${code.name}  ×` });
    chip.style.cursor = 'pointer';
    chip.title = 'Click to remove';
    chip.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Remove wrap-up code',
        message: `Remove "${code.name}" from this queue? You'll have a few seconds to undo.`,
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: code.name,
        remove: () => {
          currentQueueWrapupList = currentQueueWrapupList.filter((x) => x.id !== code.id);
          renderQueueWrapupChips(queueId);
        },
        restore: () => {
          currentQueueWrapupList.push(code);
          renderQueueWrapupChips(queueId);
        },
        commit: () => proxy('DELETE', `/api/v2/routing/queues/${queueId}/wrapupcodes/${code.id}`),
      });
    });
    chips.appendChild(chip);
  });
}

async function loadQueueWrapupCodes(queueId) {
  showError('queueWrapupError', '');
  const data = await proxy('GET', `/api/v2/routing/queues/${queueId}/wrapupcodes`, { query: { pageSize: 200 } });
  currentQueueWrapupList = (data.entities || []).map((c) => ({ id: c.id, name: c.name }));
  renderQueueWrapupChips(queueId);
}

async function bulkAssignWrapupCodes(queueIds, codeIds) {
  const batchSize = 100;
  for (const queueId of queueIds) {
    for (let i = 0; i < codeIds.length; i += batchSize) {
      const batch = codeIds.slice(i, i + batchSize).map((id) => ({ id }));
      await proxy('POST', `/api/v2/routing/queues/${queueId}/wrapupcodes`, { body: batch });
    }
  }
}

document.getElementById('queueWrapupAddBtn').addEventListener('click', () => {
  if (!getSelectedQueueIds().length) { showToast('Select at least one queue first.', true); return; }
  openPickModal('wrapupAssign');
});

// ---- Canned response libraries on a queue --------------------------------

let allLibrariesCache = [];
let currentQueueLibraryIds = [];

async function loadAllLibrariesCache() {
  const data = await proxy('GET', '/api/v2/responsemanagement/libraries', { query: { pageSize: 100 } });
  allLibrariesCache = data.entities || [];
}

function registerNewLibrary(library) {
  allLibrariesCache.push(library);
}

function renderLibrarySegment(mode) {
  const container = document.getElementById('queueLibraryModeSegment');
  container.innerHTML = '';
  ['All', 'Selected', 'None'].forEach((m) => {
    const seg = el('div', { class: `segment${m === mode ? ' active' : ''}`, text: m === 'All' ? 'All libraries' : m === 'Selected' ? 'Selected only' : 'None' });
    seg.addEventListener('click', () => onLibraryModeClick(m));
    container.appendChild(seg);
  });
  document.getElementById('queueLibraryChooseWrap').classList.toggle('hidden', mode !== 'Selected');
}

function renderLibraryChips() {
  const chips = document.getElementById('queueLibraryChips');
  chips.innerHTML = '';
  currentQueueLibraryIds.forEach((id) => {
    const lib = allLibrariesCache.find((l) => l.id === id);
    if (lib) chips.appendChild(el('span', { class: 'chip', text: lib.name }));
  });
}

function renderQueueSettings(queue) {
  const grid = document.getElementById('queueSettingsGrid');
  grid.innerHTML = '';
  const mediaSettings = queue.mediaSettings || {};
  const mediaType = mediaSettings.call ? 'call' : Object.keys(mediaSettings)[0];
  const media = mediaType ? mediaSettings[mediaType] : null;
  const sla = media && media.serviceLevel;

  const tiles = [
    ['SLA target', sla ? `${Math.round(sla.percentage * 100)}%` : '—'],
    ['SLA window', sla ? `${Math.round(sla.durationMs / 1000)}s` : '—'],
    ['Skill evaluation', queue.skillEvaluationMethod || '—'],
    ['Alerting timeout', media && media.alertingTimeoutSeconds != null ? `${media.alertingTimeoutSeconds}s` : '—'],
  ];
  tiles.forEach(([label, value]) => {
    grid.appendChild(el('div', { class: 'setting-tile' }, [el('div', { class: 'label', text: label }), el('div', { class: 'value', text: value })]));
  });
  grid.classList.remove('hidden');
}

async function loadQueueLibraryConfig(queueId) {
  showError('queueLibraryError', '');
  const queue = await proxy('GET', `/api/v2/routing/queues/${queueId}`);
  const config = queue.cannedResponseLibraries || { mode: 'All', libraryIds: [] };
  currentQueueLibraryIds = config.libraryIds || [];
  renderLibrarySegment(config.mode || 'All');
  renderLibraryChips();
  renderQueueSettings(queue);
}

async function saveLibraryMode(queueIds, mode, libraryIds) {
  const body = { cannedResponseLibraries: Object.assign({ mode }, mode === 'Selected' ? { libraryIds } : {}) };
  for (const queueId of queueIds) {
    await proxy('PATCH', `/api/v2/routing/queues/${queueId}`, { body });
  }
  if (mode === 'Selected') currentQueueLibraryIds = libraryIds;
}

async function onLibraryModeClick(mode) {
  const queueIds = getSelectedQueueIds();
  if (!queueIds.length) { showToast('Select at least one queue first.', true); return; }
  showError('queueLibraryError', '');
  try {
    if (mode === 'Selected') {
      renderLibrarySegment('Selected');
      openPickModal('libraryChoose');
      return;
    }
    await saveLibraryMode(queueIds, mode, []);
    renderLibrarySegment(mode);
    renderLibraryChips();
    showToast(`Libraries set to "${mode}".`);
  } catch (err) {
    showError('queueLibraryError', err.message);
  }
}

document.getElementById('queueLibraryChooseBtn').addEventListener('click', () => {
  if (!getSelectedQueueIds().length) { showToast('Select at least one queue first.', true); return; }
  openPickModal('libraryChoose');
});

// ---- Users & Divisions ----------------------------------------------

let selectedDivisionFilter = ''; // division id, or '' for all

const usersResource = createListResource({
  path: '/api/v2/users',
  query: { expand: 'title' }, // "title" is omitted from the default list representation without this
  pageSize: 100,
  containerId: 'usersTableBody',
  filterId: 'usersFilter',
  loadMoreId: 'usersLoadMoreBtn',
  errorId: 'usersError',
  matches: (user, filterText) =>
    (user.name || '').toLowerCase().includes(filterText) || (user.email || '').toLowerCase().includes(filterText),
  extraFilter: (user) => {
    const stateFilter = document.getElementById('usersStateFilter').value;
    if (stateFilter && user.state !== stateFilter) return false;
    if (selectedDivisionFilter && (!user.division || user.division.id !== selectedDivisionFilter)) return false;
    return true;
  },
  onRender: (filtered, state) => {
    document.getElementById('usersTotal').textContent = `Showing ${filtered.length} of ${state.total} users loaded (${state.items.length} fetched so far)`;
  },
  buildRow: (user) => {
    const activeState = user.state === 'active';
    const badge = el('span', {
      class: 'state-badge',
      text: user.state || '',
      style: `background:${activeState ? '#eefaf1' : '#f0f2f4'};color:${activeState ? '#2f7d55' : '#8a949c'}`,
    });
    const nameLink = el('span', { class: 'user-drill-link', text: user.name });
    nameLink.addEventListener('click', () => openUserDetail(user));
    return gridRow('1.4fr 1.8fr 1.2fr .8fr', [
      el('div', {}, [nameLink]),
      cellText(user.email, 'muted'),
      cellText(user.title || '—', 'muted'),
      badge,
    ]);
  },
});

document.getElementById('usersStateFilter').addEventListener('change', () => usersResource.render());
document.getElementById('usersDivisionFilter').addEventListener('change', () => {
  selectedDivisionFilter = document.getElementById('usersDivisionFilter').value;
  renderDivisionTiles();
  usersResource.render();
});

let divisionsCacheForUsers = [];

function renderDivisionTiles() {
  const container = document.getElementById('divisionsTableBody');
  container.innerHTML = '';
  divisionsCacheForUsers.forEach((division) => {
    const manageBtn = el('span', { class: 'row-edit', text: 'Manage users' });
    manageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDivisionUsersPicker(division);
    });

    const editBtn = el('span', { class: 'row-edit', text: 'Edit' });
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal('division', division);
    });

    const actions = el('div', { class: 'row-actions', style: 'justify-content:flex-start;margin-top:8px' }, [manageBtn, editBtn]);
    if (!division.homeDivision) {
      const del = el('span', { class: 'row-delete', text: 'Delete' });
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmModal({
          title: 'Delete division',
          message: `Delete "${division.name}"? Divisions that still contain objects (users, queues, etc.) can't be deleted — you'll get an error instead. You'll have a few seconds to undo.`,
        });
        if (!ok) return;
        deleteDivision(division);
      });
      actions.appendChild(del);
    }

    const tile = el('div', { class: `tile division-tile${selectedDivisionFilter === division.id ? ' active' : ''}` }, [
      el('div', { class: 'title', text: division.name }),
      el('div', { class: 'sub', text: division.homeDivision ? 'Home division' : 'Division' }),
      actions,
    ]);
    tile.addEventListener('click', () => {
      selectedDivisionFilter = selectedDivisionFilter === division.id ? '' : division.id;
      document.getElementById('usersDivisionFilter').value = selectedDivisionFilter;
      renderDivisionTiles();
      usersResource.render();
    });
    container.appendChild(tile);
  });
}

function deleteDivision(division) {
  showUndoableDelete({
    itemName: division.name,
    remove: () => {
      divisionsCacheForUsers = divisionsCacheForUsers.filter((d) => d.id !== division.id);
      renderDivisionTiles();
    },
    restore: () => {
      divisionsCacheForUsers.push(division);
      renderDivisionTiles();
    },
    commit: async () => {
      await proxy('DELETE', `/api/v2/authorization/divisions/${division.id}`);
      await loadDivisions();
    },
  });
}

document.getElementById('divisionNewBtn').addEventListener('click', () => openCreateModal('division'));

// Genesys divisions are mutually exclusive containers — an object belongs to exactly one at a
// time, there's no separate "membership" concept. "Removing" a user from a division here means
// moving them to the org's Home division, which is why it's cached and required before any removal.
let homeDivisionId = null;
async function ensureHomeDivisionId() {
  if (!homeDivisionId) {
    const home = await proxy('GET', '/api/v2/authorization/divisions/home');
    homeDivisionId = home.id;
  }
  return homeDivisionId;
}

async function openDivisionUsersPicker(division) {
  activePickDivisionId = division.id;
  activePickDivisionName = division.name;
  if (allUsersCache.length === 0) {
    showToast('Loading user directory…');
    try {
      await loadUserDirectory();
    } catch (err) {
      showToast(err.message, true);
      return;
    }
  }
  openPickModal('divisionUsers');
}

async function saveDivisionUsers(divisionId, selectedUserIds) {
  const currentlyInIds = allUsersCache.filter((u) => u.division && u.division.id === divisionId).map((u) => u.id);
  const selectedSet = new Set(selectedUserIds);
  const toAdd = selectedUserIds.filter((id) => !currentlyInIds.includes(id));
  const toRemove = currentlyInIds.filter((id) => !selectedSet.has(id));
  if (!toAdd.length && !toRemove.length) return;

  if (toAdd.length) {
    await proxy('POST', `/api/v2/authorization/divisions/${divisionId}/objects/USER`, { body: toAdd });
  }
  if (toRemove.length) {
    const homeId = await ensureHomeDivisionId();
    if (homeId !== divisionId) {
      await proxy('POST', `/api/v2/authorization/divisions/${homeId}/objects/USER`, { body: toRemove });
    }
  }

  // Re-fetch rather than hand-patch the caches — simpler and guarantees the users list, division
  // tiles, and object counts all agree with what the server actually did.
  await loadUserDirectory();
  await usersResource.reset();
  await loadDivisions();
}

async function loadDivisions() {
  const data = await proxy('GET', '/api/v2/authorization/divisions', { query: { pageSize: 100 } });
  divisionsCacheForUsers = data.entities || [];

  const filterSelect = document.getElementById('usersDivisionFilter');
  const previous = filterSelect.value;
  filterSelect.innerHTML = '<option value="">All divisions</option>';
  divisionsCacheForUsers.forEach((d) => filterSelect.appendChild(el('option', { value: d.id, text: d.name })));
  if (previous && [...filterSelect.options].some((o) => o.value === previous)) filterSelect.value = previous;

  renderDivisionTiles();
}

async function loadUsersAndDivisions() {
  await Promise.all([usersResource.reset(), loadDivisions()]);
}

// Best-effort user detail drill-in: title/department/division/skills/roles come from one GET call.
// Queue membership has no reverse lookup in the API, so it's a manual scan of already-loaded
// queues only (capped) rather than checking every queue in the org, for performance.
async function openUserDetail(user) {
  document.getElementById('userModalTitle').textContent = user.name;
  document.getElementById('userModalSubtitle').textContent = user.email || '';
  const body = document.getElementById('userModalBody');
  body.innerHTML = '';
  body.appendChild(el('p', { class: 'usage-note', text: 'Loading…' }));
  document.getElementById('userModalOverlay').classList.remove('hidden');

  try {
    const detail = await proxy('GET', `/api/v2/users/${user.id}`, { query: { expand: 'skills,languages,authorization' } });
    body.innerHTML = '';
    const rows = [
      ['Title', detail.title || '—'],
      ['Department', detail.department || '—'],
      ['Division', (detail.division && detail.division.name) || '—'],
      ['Email', detail.email || '—'],
      ['State', detail.state || '—'],
      ['Skills', (detail.skills || []).map((s) => s.name).join(', ') || '—'],
      ['Languages', (detail.languages || []).map((l) => l.name).join(', ') || '—'],
      ['Roles', ((detail.authorization && detail.authorization.roles) || []).map((r) => r.name).join(', ') || '—'],
    ];
    rows.forEach(([k, v]) => body.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v })])));

    const queueCount = queuesResource.state.items.length;
    const scanBtn = el('button', { class: 'btn btn-subtle', style: 'margin-top:10px', text: `Check queue membership (scans ${queueCount} loaded queues)` });
    const scanResult = el('p', { class: 'usage-note' });
    scanBtn.addEventListener('click', async () => {
      await withBusy(scanBtn, 'Scanning…', async () => {
        const matches = [];
        for (const q of queuesResource.state.items) {
          try {
            const data = await proxy('GET', `/api/v2/routing/queues/${q.id}/members`, { query: { pageSize: 200 } });
            const ids = (data.entities || []).map((m) => (m.user && m.user.id) || m.id);
            if (ids.includes(user.id)) matches.push(q.name);
          } catch {
            // ignore individual queue failures; scan is already best-effort
          }
        }
        scanResult.textContent = matches.length ? `Member of: ${matches.join(', ')}` : 'Not a member of any loaded queue.';
      });
    });
    body.appendChild(scanBtn);
    body.appendChild(scanResult);
    body.appendChild(
      el('p', {
        class: 'usage-note',
        text: queueCount
          ? `Only checks the ${queueCount} queues already loaded on the Queues tab — visiting that tab first (and using Load more) widens the scan.`
          : 'Visit the Queues tab first to load queues, then this can check membership across them.',
      })
    );
  } catch (err) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'field-error', text: err.message }));
  }
}

document.getElementById('userModalCloseBtn').addEventListener('click', () => document.getElementById('userModalOverlay').classList.add('hidden'));
document.getElementById('userModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'userModalOverlay') document.getElementById('userModalOverlay').classList.add('hidden');
});

// ---- Skills & Routing ----------------------------------------------------

// Genesys has no direct "usage count" endpoint for a skill, so this scans the user directory
// (paged, capped for performance) counting how many users currently have it assigned. Queue-level
// skill-based routing rules aren't included — there's no simple per-queue field to check them.
async function getSkillUsageCount(skillId) {
  let count = 0;
  let pageNumber = 1;
  const pageSize = 200;
  const maxPages = 10;
  let total = Infinity;
  while ((pageNumber - 1) * pageSize < total && pageNumber <= maxPages) {
    const data = await proxy('GET', '/api/v2/users', { query: { pageNumber, pageSize, expand: 'skills' } });
    total = data.total || 0;
    (data.entities || []).forEach((u) => {
      if ((u.skills || []).some((s) => s.id === skillId)) count += 1;
    });
    pageNumber += 1;
  }
  return { count, scanned: Math.min(total, maxPages * pageSize), total };
}

const skillsResource = createListResource({
  path: '/api/v2/routing/skills',
  pageSize: 50,
  containerId: 'skillsTableBody',
  filterId: 'skillsFilter',
  loadMoreId: 'skillsLoadMoreBtn',
  errorId: 'skillsError',
  buildRow: (skill) => {
    const editBtn = el('span', { class: 'row-edit', text: 'Edit' });
    editBtn.addEventListener('click', () => openEditModal('skill', skill));

    const del = el('span', { class: 'delete', text: 'Delete' });
    del.addEventListener('click', async () => {
      const modalPromise = confirmModal({
        title: 'Delete skill',
        message: `Delete "${skill.name}"? You'll have a few seconds to undo before it's actually removed.`,
        usageNote: 'Checking how many users have this skill…',
      });
      getSkillUsageCount(skill.id)
        .then(({ count, scanned, total }) => {
          const usageEl = document.getElementById('confirmModalUsage');
          const scopeNote = scanned < total ? ` (checked the first ${scanned} of ${total} users)` : '';
          usageEl.textContent =
            count > 0
              ? `${count} user${count === 1 ? '' : 's'} currently ${count === 1 ? 'has' : 'have'} this skill assigned${scopeNote}. Deleting it will remove it from ${count === 1 ? 'them' : 'their profiles'}.`
              : `No users currently have this skill assigned${scopeNote}.`;
          usageEl.classList.remove('hidden');
        })
        .catch(() => document.getElementById('confirmModalUsage').classList.add('hidden'));

      const ok = await modalPromise;
      if (!ok) return;
      showUndoableDelete({
        itemName: skill.name,
        remove: () => skillsResource.remove(skill.id),
        restore: () => skillsResource.prepend(skill),
        commit: () => proxy('DELETE', `/api/v2/routing/skills/${skill.id}`),
      });
    });
    return el('div', { class: 'skill-pill' }, [el('span', { class: 'name', text: skill.name }), editBtn, del]);
  },
});

// ---- API Explorer ----------------------------------------------------

const EXPLORER_PRESETS = [
  { label: 'Org info', method: 'GET', path: '/api/v2/organizations/me' },
  { label: 'My user', method: 'GET', path: '/api/v2/users/me' },
  { label: 'Routing queues', method: 'GET', path: '/api/v2/routing/queues' },
  { label: 'Presence definitions', method: 'GET', path: '/api/v2/presencedefinitions' },
  { label: 'Create test skill', method: 'POST', path: '/api/v2/routing/skills', body: '{\n  "name": "Test Skill"\n}' },
];

function renderExplorerPresets() {
  const container = document.getElementById('explorerPresets');
  container.innerHTML = '';
  EXPLORER_PRESETS.forEach((p) => {
    const pill = el('div', { class: 'preset-pill', text: p.method !== 'GET' ? `${p.method} ${p.label}` : p.label });
    pill.addEventListener('click', () => {
      document.getElementById('explorerMethod').value = p.method;
      document.getElementById('explorerPath').value = p.path;
      document.getElementById('explorerBody').value = p.body || '';
      document.getElementById('explorerResult').textContent = '// Response will appear here';
      document.getElementById('explorerMeta').classList.add('hidden');
      renderExplorerStar();
    });
    container.appendChild(pill);
  });
}
renderExplorerPresets();

// ---- history / favorites (localStorage-backed) ----

const EXPLORER_HISTORY_KEY = 'gct_explorer_history';
const EXPLORER_FAV_KEY = 'gct_explorer_favorites';

function loadExplorerHistory() {
  try {
    return JSON.parse(localStorage.getItem(EXPLORER_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveExplorerHistory(list) {
  localStorage.setItem(EXPLORER_HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}
function loadExplorerFavorites() {
  try {
    return JSON.parse(localStorage.getItem(EXPLORER_FAV_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveExplorerFavorites(list) {
  localStorage.setItem(EXPLORER_FAV_KEY, JSON.stringify(list));
}
function explorerFavoriteKey(method, path) {
  return `${method} ${path}`;
}

function renderExplorerStar() {
  const method = document.getElementById('explorerMethod').value;
  const path = document.getElementById('explorerPath').value.trim();
  const key = explorerFavoriteKey(method, path);
  const isFav = !!path && loadExplorerFavorites().some((f) => explorerFavoriteKey(f.method, f.path) === key);
  document.getElementById('explorerStarBtn').classList.toggle('active', isFav);
}

function toggleExplorerFavorite() {
  const method = document.getElementById('explorerMethod').value;
  const path = document.getElementById('explorerPath').value.trim();
  if (!path) return;
  const query = document.getElementById('explorerQuery').value;
  const body = document.getElementById('explorerBody').value;
  const key = explorerFavoriteKey(method, path);
  let favs = loadExplorerFavorites();
  if (favs.some((f) => explorerFavoriteKey(f.method, f.path) === key)) {
    favs = favs.filter((f) => explorerFavoriteKey(f.method, f.path) !== key);
    showToast('Removed from favorites.');
  } else {
    favs.unshift({ method, path, query, body, savedAt: Date.now() });
    showToast('Saved to favorites.');
  }
  saveExplorerFavorites(favs);
  renderExplorerStar();
  renderExplorerFavorites();
}

function loadExplorerCall(entry) {
  document.getElementById('explorerMethod').value = entry.method;
  document.getElementById('explorerPath').value = entry.path;
  document.getElementById('explorerQuery').value = entry.query || '';
  document.getElementById('explorerBody').value = entry.body || '';
  renderExplorerStar();
  setExplorerTab('response');
}

function renderExplorerFavorites() {
  const list = document.getElementById('explorerFavList');
  const favs = loadExplorerFavorites();
  list.innerHTML = '';
  document.getElementById('explorerFavEmpty').classList.toggle('hidden', favs.length > 0);
  favs.forEach((f) => {
    const row = el('div', { class: 'explorer-fav-item' }, [el('span', { class: 'method', text: f.method }), el('span', { class: 'path', text: f.path })]);
    row.addEventListener('click', () => loadExplorerCall(f));
    list.appendChild(row);
  });
}

function renderExplorerHistory() {
  const list = document.getElementById('explorerHistoryList');
  const history = loadExplorerHistory();
  list.innerHTML = '';
  document.getElementById('explorerHistoryEmpty').classList.toggle('hidden', history.length > 0);
  history.forEach((h) => {
    const statusOk = h.status != null && h.status < 400;
    const row = el('div', { class: 'explorer-history-item' }, [
      el('span', { class: 'method', text: h.method }),
      el('span', { class: 'path', text: h.path }),
      el('span', { style: `font-weight:600;color:${h.status == null ? 'var(--danger)' : statusOk ? '#2f7d55' : 'var(--danger)'}`, text: h.status != null ? String(h.status) : 'err' }),
    ]);
    row.addEventListener('click', () => loadExplorerCall(h));
    list.appendChild(row);
  });
}

function setExplorerTab(tab) {
  document.querySelectorAll('.explorer-tab').forEach((t) => t.classList.toggle('active', t.dataset.explorerTab === tab));
  ['response', 'headers', 'history', 'favorites'].forEach((t) => {
    document.getElementById(`explorerPanel-${t}`).classList.toggle('hidden', t !== tab);
  });
  if (tab === 'history') renderExplorerHistory();
  if (tab === 'favorites') renderExplorerFavorites();
}

document.querySelectorAll('.explorer-tab').forEach((tabEl) => {
  tabEl.addEventListener('click', () => setExplorerTab(tabEl.dataset.explorerTab));
});
document.getElementById('explorerMethod').addEventListener('change', renderExplorerStar);
document.getElementById('explorerPath').addEventListener('input', renderExplorerStar);
document.getElementById('explorerStarBtn').addEventListener('click', toggleExplorerFavorite);

const EXPLORER_DESTRUCTIVE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

document.getElementById('explorerSendBtn').addEventListener('click', async () => {
  showError('explorerError', '');
  const method = document.getElementById('explorerMethod').value;
  const apiPath = document.getElementById('explorerPath').value.trim();
  if (!apiPath) { showToast('Enter an API path first', true); return; }
  const queryRaw = document.getElementById('explorerQuery').value.trim();
  const bodyRaw = document.getElementById('explorerBody').value.trim();

  let query;
  let body;
  try {
    query = queryRaw ? JSON.parse(queryRaw) : undefined;
    body = bodyRaw ? JSON.parse(bodyRaw) : undefined;
  } catch (err) {
    showError('explorerError', `Invalid JSON: ${err.message}`);
    return;
  }

  if (EXPLORER_DESTRUCTIVE_METHODS.includes(method)) {
    const ok = await confirmModal({
      title: 'Confirm API call',
      message: `Send ${method} ${apiPath}? This calls your live Genesys Cloud org directly and cannot be undone by this tool.`,
      confirmLabel: 'Send',
      danger: method === 'DELETE',
    });
    if (!ok) return;
  }

  const loading = document.getElementById('explorerLoading');
  const resultBox = document.getElementById('explorerResult');
  const metaBox = document.getElementById('explorerMeta');
  const headersBox = document.getElementById('explorerHeaders');
  loading.classList.remove('hidden');
  const startedAt = performance.now();

  try {
    const resp = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, path: apiPath, query, body }),
    });
    const elapsedMs = Math.round(performance.now() - startedAt);
    const text = await resp.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = text;
    }

    resultBox.textContent = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);

    const headerLines = [];
    resp.headers.forEach((value, key) => headerLines.push(`${key}: ${value}`));
    headersBox.textContent = headerLines.join('\n') || 'No headers.';

    metaBox.innerHTML = '';
    metaBox.appendChild(el('span', { class: `pill ${resp.ok ? 'status-ok' : 'status-err'}`, text: `${resp.status} ${resp.statusText || ''}`.trim() }));
    metaBox.appendChild(el('span', { class: 'pill', text: `${elapsedMs} ms` }));
    metaBox.classList.remove('hidden');

    if (!resp.ok) showError('explorerError', (parsed && parsed.error) || 'Request failed.');

    saveExplorerHistory([{ method, path: apiPath, query: queryRaw, body: bodyRaw, status: resp.status, timeMs: elapsedMs, at: Date.now() }, ...loadExplorerHistory()]);
  } catch (err) {
    showError('explorerError', err.message);
    metaBox.classList.add('hidden');
  } finally {
    loading.classList.add('hidden');
  }
});

// ---- Architect tab -----------------------------------------------------

async function architectApi(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(`/api/architect${path}`, opts);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
  return data;
}

function architectQueryString(query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}

function architectListRow({ title, sub, onDelete, extraActions, checkbox }) {
  const mainChildren = [el('div', { class: 'list-row-title', text: title })];
  if (sub) mainChildren.push(el('div', { class: 'list-row-sub', text: sub }));
  const actions = el('div', { class: 'list-row-actions' });
  (extraActions || []).forEach(({ label, onclick }) => actions.appendChild(el('button', { class: 'btn btn-subtle', text: label, onclick })));
  if (onDelete) actions.appendChild(el('button', { class: 'btn btn-subtle', text: 'Delete', onclick: onDelete }));
  const rowChildren = [];
  if (checkbox) {
    const box = el('input', { type: 'checkbox', class: 'list-row-checkbox' });
    box.checked = checkbox.checked;
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('change', () => checkbox.onChange(box.checked));
    rowChildren.push(box);
  }
  rowChildren.push(el('div', { class: 'list-row-main' }, mainChildren), actions);
  return el('div', { class: 'list-row' }, rowChildren);
}

// -- flows --

const architectFlowsState = { items: [], pageNumber: 0, total: 0 };

const selectedFlowIds = new Set();
let architectFlowsVisibleIds = [];

function getSelectedFlowIds() {
  return [...selectedFlowIds];
}
function getSelectedFlowNames() {
  return architectFlowsState.items.filter((f) => selectedFlowIds.has(f.id)).map((f) => f.name);
}
function toggleFlowSelection(id, checked) {
  if (checked) selectedFlowIds.add(id);
  else selectedFlowIds.delete(id);
  renderArchitectFlowsBulkBar();
}
function renderArchitectFlowsBulkBar() {
  const ids = getSelectedFlowIds();
  document.getElementById('architectFlowsBulkBar').classList.toggle('hidden', ids.length === 0);
  document.getElementById('architectFlowsBulkCount').textContent = `${ids.length} selected`;
  document.getElementById('architectFlowsSelectAll').checked =
    architectFlowsVisibleIds.length > 0 && architectFlowsVisibleIds.every((id) => selectedFlowIds.has(id));
}
function flowExportShape(flow) {
  return {
    id: flow.id,
    name: flow.name,
    type: flow.type,
    description: flow.description || '',
    division: (flow.division && flow.division.name) || '',
    active: !!flow.active,
    published: !!flow.publishedVersion,
  };
}

function renderArchitectFlows() {
  const filterText = document.getElementById('architectFlowsFilter').value.trim().toLowerCase();
  const container = document.getElementById('architectFlowsList');
  container.innerHTML = '';
  const filtered = architectFlowsState.items.filter((flow) => !filterText || (flow.name || '').toLowerCase().includes(filterText));
  architectFlowsVisibleIds = filtered.map((f) => f.id);
  filtered.forEach((flow) => {
    container.appendChild(
      architectListRow({
        title: flow.name,
        sub: `${flow.type || ''} · ${flow.publishedVersion ? 'published' : 'unpublished'}`,
        checkbox: { checked: selectedFlowIds.has(flow.id), onChange: (checked) => toggleFlowSelection(flow.id, checked) },
        onDelete: () => deleteArchitectFlow(flow),
      })
    );
  });
  document.getElementById('architectFlowsEmpty').classList.toggle('hidden', filtered.length > 0);
  document.getElementById('architectFlowsLoadMoreBtn').classList.toggle('hidden', architectFlowsState.items.length >= architectFlowsState.total);
  renderArchitectFlowsBulkBar();
}

async function fetchArchitectFlowsPage(pageNumber) {
  const data = await architectApi('GET', `/flows${architectQueryString({ pageNumber, pageSize: 25 })}`);
  architectFlowsState.total = data.total || 0;
  architectFlowsState.pageNumber = data.pageNumber || pageNumber;
  architectFlowsState.items = architectFlowsState.items.concat(data.entities || []);
  renderArchitectFlows();
}

async function resetArchitectFlows() {
  showError('architectFlowsError', '');
  architectFlowsState.items = [];
  architectFlowsState.pageNumber = 0;
  architectFlowsState.total = 0;
  await fetchArchitectFlowsPage(1);
}

function deleteArchitectFlow(flow) {
  const wasSelected = selectedFlowIds.has(flow.id);
  showUndoableDelete({
    itemName: flow.name,
    remove: () => {
      architectFlowsState.items = architectFlowsState.items.filter((f) => f.id !== flow.id);
      architectFlowsState.total = Math.max(0, architectFlowsState.total - 1);
      selectedFlowIds.delete(flow.id);
      renderArchitectFlows();
    },
    restore: () => {
      architectFlowsState.items.unshift(flow);
      architectFlowsState.total += 1;
      if (wasSelected) selectedFlowIds.add(flow.id);
      renderArchitectFlows();
    },
    commit: () => architectApi('DELETE', `/flows/${encodeURIComponent(flow.id)}`),
  });
}

document.getElementById('architectFlowsFilter').addEventListener('input', renderArchitectFlows);
document.getElementById('architectFlowsRefreshBtn').addEventListener('click', () => {
  resetArchitectFlows().catch((err) => showError('architectFlowsError', err.message));
});
document.getElementById('architectFlowsLoadMoreBtn').addEventListener('click', () => {
  fetchArchitectFlowsPage(architectFlowsState.pageNumber + 1).catch((err) => showError('architectFlowsError', err.message));
});

document.getElementById('architectFlowsSelectAll').addEventListener('change', (e) => {
  if (e.target.checked) architectFlowsVisibleIds.forEach((id) => selectedFlowIds.add(id));
  else architectFlowsVisibleIds.forEach((id) => selectedFlowIds.delete(id));
  renderArchitectFlows();
});

document.getElementById('architectFlowsClearSelectedBtn').addEventListener('click', () => {
  selectedFlowIds.clear();
  renderArchitectFlows();
});

document.getElementById('architectFlowsExportSelectedBtn').addEventListener('click', () => {
  const ids = getSelectedFlowIds();
  if (!ids.length) return;
  const flows = architectFlowsState.items.filter((f) => ids.includes(f.id));
  downloadJson('flows-export.json', flows.map(flowExportShape));
  showToast(`Exported ${flows.length} flow${flows.length === 1 ? '' : 's'}.`);
});

document.getElementById('architectFlowsDeleteSelectedBtn').addEventListener('click', async () => {
  const ids = getSelectedFlowIds();
  if (!ids.length) return;
  const names = getSelectedFlowNames();
  const count = ids.length;
  const listLabel = names.length <= 5 ? names.join(', ') : `${count} flows`;

  const ok = await confirmModal({
    title: `Delete ${count} flow${count === 1 ? '' : 's'}`,
    message: `Delete ${listLabel}? You'll have a few seconds to undo before ${count === 1 ? 'it is' : 'they are'} actually removed.`,
  });
  if (!ok) return;

  const flowsToDelete = architectFlowsState.items.filter((f) => ids.includes(f.id));
  showUndoableDelete({
    itemName: count === 1 ? names[0] : `${count} flows`,
    remove: () => {
      architectFlowsState.items = architectFlowsState.items.filter((f) => !ids.includes(f.id));
      architectFlowsState.total = Math.max(0, architectFlowsState.total - ids.length);
      ids.forEach((id) => selectedFlowIds.delete(id));
      renderArchitectFlows();
    },
    restore: () => {
      flowsToDelete.forEach((f) => architectFlowsState.items.unshift(f));
      architectFlowsState.total += flowsToDelete.length;
      ids.forEach((id) => selectedFlowIds.add(id));
      renderArchitectFlows();
    },
    commit: async () => {
      const results = await Promise.allSettled(ids.map((id) => architectApi('DELETE', `/flows/${encodeURIComponent(id)}`)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw new Error(`${failed.length} of ${count} could not be deleted`);
    },
  });
});

// -- prompts --

const architectPromptsState = { items: [], pageNumber: 0, total: 0 };

const selectedPromptIds = new Set();
let architectPromptsVisibleIds = [];

function getSelectedPromptIds() {
  return [...selectedPromptIds];
}
function getSelectedPromptNames() {
  return architectPromptsState.items.filter((p) => selectedPromptIds.has(p.id)).map((p) => p.name);
}
function togglePromptSelection(id, checked) {
  if (checked) selectedPromptIds.add(id);
  else selectedPromptIds.delete(id);
  renderArchitectPromptsBulkBar();
}
function renderArchitectPromptsBulkBar() {
  const ids = getSelectedPromptIds();
  document.getElementById('architectPromptsBulkBar').classList.toggle('hidden', ids.length === 0);
  document.getElementById('architectPromptsBulkCount').textContent = `${ids.length} selected`;
  document.getElementById('architectPromptsSelectAll').checked =
    architectPromptsVisibleIds.length > 0 && architectPromptsVisibleIds.every((id) => selectedPromptIds.has(id));
}

function renderArchitectPrompts() {
  const container = document.getElementById('architectPromptsList');
  container.innerHTML = '';
  architectPromptsVisibleIds = architectPromptsState.items.map((p) => p.id);
  architectPromptsState.items.forEach((prompt) => {
    const langCount = Array.isArray(prompt.resources) ? prompt.resources.length : null;
    const sub = [prompt.description, langCount !== null ? `${langCount} language${langCount === 1 ? '' : 's'}` : null]
      .filter(Boolean)
      .join(' · ');
    container.appendChild(
      architectListRow({
        title: prompt.name,
        sub,
        checkbox: { checked: selectedPromptIds.has(prompt.id), onChange: (checked) => togglePromptSelection(prompt.id, checked) },
        extraActions: [
          { label: 'Languages', onclick: () => openPromptLanguagesModal(prompt) },
          { label: 'Export', onclick: () => exportPrompt(prompt) },
        ],
        onDelete: () => deleteArchitectPrompt(prompt),
      })
    );
  });
  document.getElementById('architectPromptsEmpty').classList.toggle('hidden', architectPromptsState.items.length > 0);
  document.getElementById('architectPromptsLoadMoreBtn').classList.toggle('hidden', architectPromptsState.items.length >= architectPromptsState.total);
  renderArchitectPromptsBulkBar();
}

async function fetchArchitectPromptsPage(pageNumber) {
  const language = document.getElementById('architectPromptsLanguageFilter').value;
  const data = await architectApi('GET', `/prompts${architectQueryString({ pageNumber, pageSize: 25, language })}`);
  architectPromptsState.total = data.total || 0;
  architectPromptsState.pageNumber = data.pageNumber || pageNumber;
  architectPromptsState.items = architectPromptsState.items.concat(data.entities || []);
  renderArchitectPrompts();
}

async function resetArchitectPrompts() {
  showError('architectPromptsError', '');
  architectPromptsState.items = [];
  architectPromptsState.pageNumber = 0;
  architectPromptsState.total = 0;
  await fetchArchitectPromptsPage(1);
}

function deleteArchitectPrompt(prompt) {
  const wasSelected = selectedPromptIds.has(prompt.id);
  showUndoableDelete({
    itemName: prompt.name,
    remove: () => {
      architectPromptsState.items = architectPromptsState.items.filter((p) => p.id !== prompt.id);
      architectPromptsState.total = Math.max(0, architectPromptsState.total - 1);
      selectedPromptIds.delete(prompt.id);
      renderArchitectPrompts();
    },
    restore: () => {
      architectPromptsState.items.unshift(prompt);
      architectPromptsState.total += 1;
      if (wasSelected) selectedPromptIds.add(prompt.id);
      renderArchitectPrompts();
    },
    commit: () => architectApi('DELETE', `/prompts/${encodeURIComponent(prompt.id)}`),
  });
}

document.getElementById('architectPromptsLoadMoreBtn').addEventListener('click', () => {
  fetchArchitectPromptsPage(architectPromptsState.pageNumber + 1).catch((err) => showError('architectPromptsError', err.message));
});

document.getElementById('architectPromptsSelectAll').addEventListener('change', (e) => {
  if (e.target.checked) architectPromptsVisibleIds.forEach((id) => selectedPromptIds.add(id));
  else architectPromptsVisibleIds.forEach((id) => selectedPromptIds.delete(id));
  renderArchitectPrompts();
});

document.getElementById('architectPromptsClearSelectedBtn').addEventListener('click', () => {
  selectedPromptIds.clear();
  renderArchitectPrompts();
});

document.getElementById('architectPromptsExportSelectedBtn').addEventListener('click', async () => {
  const ids = getSelectedPromptIds();
  if (!ids.length) return;
  const btn = document.getElementById('architectPromptsExportSelectedBtn');
  await withBusy(btn, 'Exporting…', async () => {
    const results = await Promise.allSettled(ids.map((id) => fetchPromptWithResources(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => promptExportShape(r.value));
    const failedCount = results.length - ok.length;
    if (ok.length) downloadJson('prompts-export-selected.json', ok);
    showToast(
      failedCount ? `Exported ${ok.length} of ${results.length} prompts (${failedCount} failed).` : `Exported ${ok.length} prompt${ok.length === 1 ? '' : 's'}.`,
      !!failedCount
    );
  });
});

document.getElementById('architectPromptsDeleteSelectedBtn').addEventListener('click', async () => {
  const ids = getSelectedPromptIds();
  if (!ids.length) return;
  const names = getSelectedPromptNames();
  const count = ids.length;
  const listLabel = names.length <= 5 ? names.join(', ') : `${count} prompts`;

  const ok = await confirmModal({
    title: `Delete ${count} prompt${count === 1 ? '' : 's'}`,
    message: `Delete ${listLabel}? You'll have a few seconds to undo before ${count === 1 ? 'it is' : 'they are'} actually removed.`,
  });
  if (!ok) return;

  const promptsToDelete = architectPromptsState.items.filter((p) => ids.includes(p.id));
  showUndoableDelete({
    itemName: count === 1 ? names[0] : `${count} prompts`,
    remove: () => {
      architectPromptsState.items = architectPromptsState.items.filter((p) => !ids.includes(p.id));
      architectPromptsState.total = Math.max(0, architectPromptsState.total - ids.length);
      ids.forEach((id) => selectedPromptIds.delete(id));
      renderArchitectPrompts();
    },
    restore: () => {
      promptsToDelete.forEach((p) => architectPromptsState.items.unshift(p));
      architectPromptsState.total += promptsToDelete.length;
      ids.forEach((id) => selectedPromptIds.add(id));
      renderArchitectPrompts();
    },
    commit: async () => {
      const results = await Promise.allSettled(ids.map((id) => architectApi('DELETE', `/prompts/${encodeURIComponent(id)}`)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw new Error(`${failed.length} of ${count} could not be deleted`);
    },
  });
});

document.getElementById('architectPromptAddBtn').addEventListener('click', async () => {
  const name = document.getElementById('architectPromptName').value.trim();
  const description = document.getElementById('architectPromptDescription').value.trim();
  showError('architectPromptsError', '');
  if (!name) return showError('architectPromptsError', 'Name is required.');
  try {
    const prompt = await architectApi('POST', '/prompts', { name, description });
    architectPromptsState.items.unshift(prompt);
    architectPromptsState.total += 1;
    renderArchitectPrompts();
    document.getElementById('architectPromptName').value = '';
    document.getElementById('architectPromptDescription').value = '';
    showToast(`Prompt "${name}" created.`);
  } catch (err) {
    showError('architectPromptsError', err.message);
  }
});

// -- prompt languages (per-prompt TTS text, one entry per language) --
// No Genesys endpoint lists "available prompt languages" (the closest, GET /api/v2/languages, is
// deprecated and returns org routing languages instead) — this is the standard set of locale
// codes Architect prompts accept, curated from Genesys Cloud's own language picker.
const PROMPT_LANGUAGES = [
  ['ar-ae', 'Arabic (United Arab Emirates)'],
  ['ar-bh', 'Arabic (Bahrain)'],
  ['ar-eg', 'Arabic (Egypt)'],
  ['ar-sa', 'Arabic (Saudi Arabia)'],
  ['ar-tn', 'Arabic (Tunisia)'],
  ['ca-es', 'Catalan (Spain)'],
  ['cs-cz', 'Czech (Czech Republic)'],
  ['cy-gb', 'Welsh (UK)'],
  ['da-dk', 'Danish (Denmark)'],
  ['de-de', 'German (Germany)'],
  ['el-gr', 'Greek (Greece)'],
  ['en-au', 'English (Australia)'],
  ['en-ca', 'English (Canada)'],
  ['en-gb', 'English (UK)'],
  ['en-in', 'English (India)'],
  ['en-us', 'English (US)'],
  ['en-za', 'English (South Africa)'],
  ['es-es', 'Spanish (Spain)'],
  ['es-mx', 'Spanish (Mexico)'],
  ['es-us', 'Spanish (US)'],
  ['et-ee', 'Estonian (Estonia)'],
  ['fi-fi', 'Finnish (Finland)'],
  ['fr-ca', 'French (Canada)'],
  ['fr-fr', 'French (France)'],
  ['he-il', 'Hebrew (Israel)'],
  ['hi-in', 'Hindi (India)'],
  ['hr-hr', 'Croatian (Croatia)'],
  ['hu-hu', 'Hungarian (Hungary)'],
  ['id-id', 'Indonesian (Indonesia)'],
  ['it-it', 'Italian (Italy)'],
  ['ja-jp', 'Japanese (Japan)'],
  ['ko-kr', 'Korean (Korea)'],
  ['lt-lt', 'Lithuanian (Lithuania)'],
  ['lv-lv', 'Latvian (Latvia)'],
  ['ms-my', 'Malay (Malaysia)'],
  ['nb-no', 'Norwegian Bokmål (Norway)'],
  ['nl-nl', 'Dutch (Netherlands)'],
  ['pl-pl', 'Polish (Poland)'],
  ['pt-br', 'Portuguese (Brazil)'],
  ['pt-pt', 'Portuguese (Portugal)'],
  ['ro-ro', 'Romanian (Romania)'],
  ['ru-ru', 'Russian (Russia)'],
  ['sk-sk', 'Slovak (Slovakia)'],
  ['sl-si', 'Slovenian (Slovenia)'],
  ['sv-se', 'Swedish (Sweden)'],
  ['th-th', 'Thai (Thailand)'],
  ['tr-tr', 'Turkish (Turkey)'],
  ['uk-ua', 'Ukrainian (Ukraine)'],
  ['vi-vn', 'Vietnamese (Vietnam)'],
  ['zh-cn', 'Chinese, Simplified (China)'],
  ['zh-hk', 'Chinese, Traditional (Hong Kong)'],
  ['zh-tw', 'Chinese, Traditional (Taiwan)'],
];
const PROMPT_LANGUAGE_LABELS = Object.fromEntries(PROMPT_LANGUAGES);

// Genesys filters prompts server-side by language (a prompt matches if it has a resource in that
// language), so this reuses the /prompts?language= query param rather than filtering client-side.
PROMPT_LANGUAGES.forEach(([code, label]) => {
  document.getElementById('architectPromptsLanguageFilter').appendChild(el('option', { value: code, text: label }));
});
document.getElementById('architectPromptsLanguageFilter').addEventListener('change', () => {
  resetArchitectPrompts().catch((err) => showError('architectPromptsError', err.message));
});

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function promptExportShape(prompt) {
  return {
    name: prompt.name,
    description: prompt.description || '',
    resources: (prompt.resources || [])
      .filter((r) => r.ttsString)
      .map((r) => ({ language: r.language, ttsString: r.ttsString })),
  };
}

async function fetchPromptWithResources(promptId) {
  return architectApi('GET', `/prompts/${encodeURIComponent(promptId)}${architectQueryString({ includeResources: true })}`);
}

async function exportPrompt(prompt) {
  try {
    const full = await fetchPromptWithResources(prompt.id);
    downloadJson(`prompt-${full.name.replace(/[^a-z0-9-]+/gi, '_')}.json`, promptExportShape(full));
    showToast(`Exported "${full.name}".`);
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById('architectPromptsExportAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('architectPromptsExportAllBtn');
  await withBusy(btn, 'Exporting…', async () => {
    try {
      // Walks every page independent of whatever the on-screen list has loaded so far, so
      // "export all" really means all prompts in the org, not just the ones scrolled into view.
      const all = [];
      let pageNumber = 1;
      let total = Infinity;
      while (all.length < total) {
        const data = await architectApi(
          'GET',
          `/prompts${architectQueryString({ pageNumber, pageSize: 50, includeResources: true })}`
        );
        total = data.total || 0;
        all.push(...(data.entities || []));
        if (!data.entities || !data.entities.length) break;
        pageNumber += 1;
      }
      downloadJson('prompts-export.json', all.map(promptExportShape));
      showToast(`Exported ${all.length} prompt${all.length === 1 ? '' : 's'}.`);
    } catch (err) {
      showToast(err.message, true);
    }
  });
});

document.getElementById('architectPromptsImportBtn').addEventListener('click', () => {
  document.getElementById('architectPromptsImportFile').click();
});

document.getElementById('architectPromptsImportFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const summaryEl = document.getElementById('architectPromptsImportSummary');
  summaryEl.classList.add('hidden');
  showError('architectPromptsError', '');

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    return showError('architectPromptsError', `Not valid JSON: ${err.message}`);
  }
  const prompts = Array.isArray(parsed) ? parsed : [parsed];
  if (!prompts.length) return showError('architectPromptsError', 'File has no prompts to import.');

  const btn = document.getElementById('architectPromptsImportBtn');
  await withBusy(btn, 'Importing…', async () => {
    const results = [];
    for (const item of prompts) {
      const name = item && item.name && String(item.name).trim();
      if (!name) {
        results.push({ ok: false, label: '(unnamed)', message: 'missing "name"' });
        continue;
      }
      try {
        // Reuse an existing prompt with the same name (case-insensitive) instead of duplicating it.
        let target = architectPromptsState.items.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (!target) {
          const found = await architectApi('GET', `/prompts${architectQueryString({ name, pageSize: 1 })}`);
          target = (found.entities || [])[0];
        }
        if (target) {
          target = await architectApi('PUT', `/prompts/${encodeURIComponent(target.id)}`, {
            name,
            description: item.description || '',
          });
        } else {
          target = await architectApi('POST', '/prompts', { name, description: item.description || '' });
          architectPromptsState.items.unshift(target);
          architectPromptsState.total += 1;
        }

        const resources = Array.isArray(item.resources) ? item.resources : [];
        let langOk = 0;
        for (const res of resources) {
          const language = res && res.language && String(res.language).trim().toLowerCase();
          if (!language) continue;
          try {
            const exists = await architectApi('GET', `/prompts/${encodeURIComponent(target.id)}/resources/${encodeURIComponent(language)}`).catch(() => null);
            if (exists) {
              await architectApi('PUT', `/prompts/${encodeURIComponent(target.id)}/resources/${encodeURIComponent(language)}`, {
                ttsString: res.ttsString || '',
              });
            } else {
              await architectApi('POST', `/prompts/${encodeURIComponent(target.id)}/resources`, {
                language,
                ttsString: res.ttsString || '',
              });
            }
            langOk += 1;
          } catch {
            // one bad language shouldn't sink the whole prompt import; reflected in the langOk count
          }
        }
        // renderBulkResults only shows `message` on failed rows, so fold the language count into
        // the label itself to keep it visible on success too.
        const langNote = resources.length ? ` (${langOk}/${resources.length} language${resources.length === 1 ? '' : 's'})` : '';
        results.push({ ok: langOk === resources.length, label: `${name}${langNote}`, message: langOk === resources.length ? '' : 'one or more languages failed to import' });
      } catch (err) {
        results.push({ ok: false, label: name, message: err.message });
      }
    }
    renderArchitectPrompts();
    summaryEl.classList.remove('hidden');
    renderBulkResults('architectPromptsImportSummary', results);
    const okCount = results.filter((r) => r.ok).length;
    showToast(`Imported ${okCount} of ${results.length} prompt${results.length === 1 ? '' : 's'}.`, okCount < results.length);
  });
});

async function openPromptLanguagesModal(prompt) {
  document.getElementById('promptModalTitle').textContent = prompt.name;
  document.getElementById('promptModalSubtitle').textContent = prompt.description || '';
  const body = document.getElementById('promptModalBody');
  body.innerHTML = '';
  body.appendChild(el('p', { class: 'usage-note', text: 'Loading…' }));
  document.getElementById('promptModalOverlay').classList.remove('hidden');
  document.getElementById('promptModalOverlay').dataset.promptId = prompt.id;

  await reloadPromptLanguagesModal(prompt.id);
}

async function reloadPromptLanguagesModal(promptId) {
  const body = document.getElementById('promptModalBody');
  try {
    const full = await fetchPromptWithResources(promptId);
    document.getElementById('promptModalSubtitle').textContent = full.description || '';

    // Keep the background list's language count in sync with what the modal just loaded.
    const cached = architectPromptsState.items.find((p) => p.id === promptId);
    if (cached) {
      cached.resources = full.resources || [];
      cached.description = full.description;
      renderArchitectPrompts();
    }

    body.innerHTML = '';

    const existing = (full.resources || []).slice().sort((a, b) => a.language.localeCompare(b.language));
    if (!existing.length) {
      body.appendChild(el('p', { class: 'empty-note', text: 'No languages added yet.' }));
    }
    existing.forEach((res) => {
      const textarea = el('textarea', {
        class: 'text-input',
        rows: '2',
        style: 'font-size:12.5px',
        text: res.ttsString || '',
      });
      const errorEl = el('p', { class: 'field-inline-error hidden' });
      const saveBtn = el('button', {
        class: 'btn btn-subtle',
        text: 'Save',
        onclick: async () => {
          errorEl.classList.add('hidden');
          try {
            await withBusy(saveBtn, 'Saving…', () =>
              architectApi('PUT', `/prompts/${encodeURIComponent(promptId)}/resources/${encodeURIComponent(res.language)}`, {
                ttsString: textarea.value,
              })
            );
            showToast(`Saved ${PROMPT_LANGUAGE_LABELS[res.language] || res.language}.`);
          } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
          }
        },
      });
      const deleteBtn = el('button', {
        class: 'btn btn-subtle',
        text: 'Delete',
        onclick: async () => {
          try {
            await withBusy(deleteBtn, 'Deleting…', () =>
              architectApi('DELETE', `/prompts/${encodeURIComponent(promptId)}/resources/${encodeURIComponent(res.language)}`)
            );
            await reloadPromptLanguagesModal(promptId);
          } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
          }
        },
      });
      body.appendChild(
        el('div', { class: 'detail-row', style: 'align-items:flex-start;flex-direction:column;gap:6px' }, [
          el('div', { style: 'display:flex;width:100%;justify-content:space-between;align-items:center' }, [
            el('span', { class: 'k', text: PROMPT_LANGUAGE_LABELS[res.language] || res.language }),
            el('div', { style: 'display:flex;gap:6px' }, [saveBtn, deleteBtn]),
          ]),
          textarea,
          errorEl,
        ])
      );
    });

    // -- add a new language --
    const usedCodes = new Set(existing.map((r) => r.language));
    const available = PROMPT_LANGUAGES.filter(([code]) => !usedCodes.has(code));
    if (available.length) {
      const select = el('select', { class: 'text-input', style: 'padding:9px 12px;font-size:12.5px' });
      available.forEach(([code, label]) => select.appendChild(el('option', { value: code, text: label })));
      const newTextarea = el('textarea', {
        class: 'text-input',
        rows: '2',
        style: 'font-size:12.5px',
        placeholder: 'TTS text for this language…',
      });
      const addErrorEl = el('p', { class: 'field-inline-error hidden' });
      const addBtn = el('button', {
        class: 'btn btn-accent',
        text: '+ Add language',
        onclick: async () => {
          addErrorEl.classList.add('hidden');
          try {
            await withBusy(addBtn, 'Adding…', () =>
              architectApi('POST', `/prompts/${encodeURIComponent(promptId)}/resources`, {
                language: select.value,
                ttsString: newTextarea.value,
              })
            );
            showToast(`Added ${PROMPT_LANGUAGE_LABELS[select.value] || select.value}.`);
            await reloadPromptLanguagesModal(promptId);
          } catch (err) {
            addErrorEl.textContent = err.message;
            addErrorEl.classList.remove('hidden');
          }
        },
      });
      body.appendChild(
        el('div', { class: 'detail-row', style: 'align-items:flex-start;flex-direction:column;gap:6px;margin-top:12px;border-top:1px solid var(--border);padding-top:12px' }, [
          el('span', { class: 'k', text: 'Add a language' }),
          select,
          newTextarea,
          addBtn,
          addErrorEl,
        ])
      );
    }
  } catch (err) {
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'field-error', text: err.message }));
  }
}

document.getElementById('promptModalCloseBtn').addEventListener('click', () => document.getElementById('promptModalOverlay').classList.add('hidden'));
document.getElementById('promptModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'promptModalOverlay') document.getElementById('promptModalOverlay').classList.add('hidden');
});
document.getElementById('promptModalExportBtn').addEventListener('click', async () => {
  const promptId = document.getElementById('promptModalOverlay').dataset.promptId;
  const target = architectPromptsState.items.find((p) => p.id === promptId);
  if (target) exportPrompt(target);
});

// -- flow generation (AI extracts params, user reviews, then deploy) --

let architectPendingFlowType = null;

async function loadArchitectFlowTypes() {
  const select = document.getElementById('architectFlowType');
  if (select.options.length) return;
  const types = await architectApi('GET', '/flow-types');
  types.forEach(({ id, label }) => select.appendChild(el('option', { value: id, text: label })));
}

document.getElementById('architectGenerateBtn').addEventListener('click', async () => {
  const flowType = document.getElementById('architectFlowType').value;
  const prompt = document.getElementById('architectPrompt').value.trim();
  showError('architectGenerateError', '');
  if (!prompt) return showError('architectGenerateError', 'Describe what the flow should do first.');

  const btn = document.getElementById('architectGenerateBtn');
  try {
    await withBusy(btn, 'Generating…', async () => {
      const data = await architectApi('POST', '/generate', { flowType, prompt });
      architectPendingFlowType = data.flowType;
      document.getElementById('architectReviewJson').value = JSON.stringify(data.params, null, 2);
      document.getElementById('architectReview').classList.remove('hidden');
      showError('architectReviewError', '');
    });
  } catch (err) {
    showError('architectGenerateError', err.message);
  }
});

document.getElementById('architectDiscardBtn').addEventListener('click', () => {
  document.getElementById('architectReview').classList.add('hidden');
  architectPendingFlowType = null;
});

document.getElementById('architectDeployBtn').addEventListener('click', async () => {
  showError('architectReviewError', '');
  let params;
  try {
    params = JSON.parse(document.getElementById('architectReviewJson').value);
  } catch {
    return showError('architectReviewError', 'That is not valid JSON.');
  }
  if (!params || !params.name) return showError('architectReviewError', 'params.name is required.');

  const btn = document.getElementById('architectDeployBtn');
  try {
    await withBusy(btn, 'Deploying…', async () => {
      const result = await architectApi('POST', '/deploy', { flowType: architectPendingFlowType, params });
      showToast(`Flow "${(result.flow && result.flow.name) || params.name}" deployed.`);
      document.getElementById('architectReview').classList.add('hidden');
      document.getElementById('architectPrompt').value = '';
      architectPendingFlowType = null;
      resetArchitectFlows().catch(() => {});
    });
  } catch (err) {
    showError('architectReviewError', err.message);
  }
});

// -- AI provider API key settings (session-scoped, works with any supported provider) --

let architectProvidersById = {};

async function loadArchitectProviders() {
  const select = document.getElementById('architectProviderSelect');
  if (select.options.length) return;
  const providers = await architectApi('GET', '/providers');
  providers.forEach((provider) => {
    architectProvidersById[provider.id] = provider;
    select.appendChild(el('option', { value: provider.id, text: provider.label }));
  });
}

document.getElementById('architectProviderSelect').addEventListener('change', () => {
  const provider = architectProvidersById[document.getElementById('architectProviderSelect').value];
  document.getElementById('architectModelInput').placeholder = provider
    ? `Uses "${provider.defaultModel}" if left blank`
    : "Uses the provider's default if left blank";
});

async function refreshArchitectKeyStatus() {
  const data = await architectApi('GET', '/settings/api-key');
  const providerLabel = data.provider && architectProvidersById[data.provider] ? architectProvidersById[data.provider].label : data.provider;
  document.getElementById('architectKeyStatus').textContent = data.configured
    ? `Configured for ${providerLabel} (${data.source === 'env' ? 'server environment variable' : 'saved in this session'})${data.model ? ` — model override: ${data.model}` : ''}`
    : 'Not configured yet.';
  if (data.provider) document.getElementById('architectProviderSelect').value = data.provider;
}

document.getElementById('architectKeyToggle').addEventListener('click', () => {
  const input = document.getElementById('architectApiKeyInput');
  const toggle = document.getElementById('architectKeyToggle');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  toggle.textContent = showing ? 'Show' : 'Hide';
});

document.getElementById('architectKeySaveBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('architectApiKeyInput').value.trim();
  const provider = document.getElementById('architectProviderSelect').value;
  const model = document.getElementById('architectModelInput').value.trim();
  showError('architectKeyError', '');
  if (!apiKey) return showError('architectKeyError', 'Enter an API key first.');
  try {
    await architectApi('POST', '/settings/api-key', { apiKey, provider, model: model || undefined });
    document.getElementById('architectApiKeyInput').value = '';
    await refreshArchitectKeyStatus();
    showToast(`API key saved for ${(architectProvidersById[provider] || {}).label || provider}.`);
  } catch (err) {
    showError('architectKeyError', err.message);
  }
});

document.getElementById('architectKeyTestBtn').addEventListener('click', async () => {
  showError('architectKeyError', '');
  const btn = document.getElementById('architectKeyTestBtn');
  try {
    await withBusy(btn, 'Testing…', () => architectApi('POST', '/settings/api-key/test'));
    showToast('API key works.');
  } catch (err) {
    showError('architectKeyError', err.message);
  }
});

document.getElementById('architectKeyClearBtn').addEventListener('click', async () => {
  showError('architectKeyError', '');
  try {
    await architectApi('DELETE', '/settings/api-key');
    await refreshArchitectKeyStatus();
    showToast('API key cleared.');
  } catch (err) {
    showError('architectKeyError', err.message);
  }
});

async function loadArchitectTab() {
  await loadArchitectFlowTypes();
  await loadArchitectProviders();
  await refreshArchitectKeyStatus();
  await Promise.all([resetArchitectFlows(), resetArchitectPrompts()]);
}

// ---- Audit Log ---------------------------------------------------------

// The Audit API is an async job: submit a query, poll its status, then page through results
// with a cursor. It is not a simple paged list, so it doesn't reuse createListResource.

const AUDIT_FILTER_PROPERTIES = [
  { inputId: 'auditActionFilter', property: 'Action' },
  { inputId: 'auditEntityTypeFilter', property: 'EntityType' },
  { inputId: 'auditUserIdFilter', property: 'UserId' },
];

const auditState = { transactionId: null, cursor: null, items: [] };
let auditServicesLoaded = false;

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function loadAuditServiceOptions() {
  if (auditServicesLoaded) return;
  auditServicesLoaded = true;
  try {
    const data = await proxy('GET', '/api/v2/audits/query/servicemapping');
    const select = document.getElementById('auditServiceSelect');
    (data.services || [])
      .map((s) => s.name)
      .filter(Boolean)
      .sort()
      .forEach((name) => select.appendChild(el('option', { value: name, text: name })));
  } catch (err) {
    // Non-fatal — the service filter just stays as "Any service" if this fails.
    console.warn('Could not load audit service list:', err.message);
  }
}

function auditIntervalFromInputs() {
  const fromVal = document.getElementById('auditFrom').value;
  const toVal = document.getElementById('auditTo').value;
  if (!fromVal || !toVal) throw new Error('Both From and To dates are required.');
  const from = new Date(fromVal);
  const to = new Date(toVal);
  if (from >= to) throw new Error('The From date must be before the To date.');
  return `${from.toISOString()}/${to.toISOString()}`;
}

function auditFiltersFromInputs() {
  return AUDIT_FILTER_PROPERTIES.map(({ inputId, property }) => {
    const value = document.getElementById(inputId).value.trim();
    return value ? { property, value } : null;
  }).filter(Boolean);
}

function renderAuditRow(entry) {
  const time = entry.eventDate ? new Date(entry.eventDate).toLocaleString() : '—';
  const userName = (entry.user && entry.user.name) || '—';
  const entityName = (entry.entity && (entry.entity.name || entry.entity.id)) || entry.entityType || '—';
  const row = gridRow('1.1fr 1fr 1fr 1fr 1.3fr .8fr', [
    cellText(time),
    cellText(userName),
    cellText(entry.serviceName || '—', 'muted'),
    cellText(entry.action || '—'),
    cellText(entityName),
    el('span', { class: `audit-status-${entry.status || ''}`, text: entry.status || '—' }),
  ]);
  row.classList.add('audit-row-clickable');
  row.addEventListener('click', () => openAuditDetail(entry));
  return row;
}

function renderAuditResults() {
  const container = document.getElementById('auditTableBody');
  container.innerHTML = '';
  auditState.items.forEach((entry) => container.appendChild(renderAuditRow(entry)));
  document.getElementById('auditEmpty').classList.toggle('hidden', auditState.items.length > 0);
  document.getElementById('auditLoadMoreBtn').classList.toggle('hidden', !auditState.cursor);
}

function renderAuditChangeRow(label, change) {
  const oldVals = (change.oldValues || []).join(', ') || '—';
  const newVals = (change.newValues || []).join(', ') || '—';
  return el('div', { class: 'audit-change-row' }, [
    el('span', { class: 'audit-change-prop', text: label }),
    el('span', { class: 'audit-change-values' }, [
      el('span', { class: 'audit-change-old', text: oldVals }),
      el('span', { text: '  →  ' }),
      el('span', { class: 'audit-change-new', text: newVals }),
    ]),
  ]);
}

function openAuditDetail(entry) {
  document.getElementById('userModalTitle').textContent = `${entry.action || 'Event'} — ${entry.entityType || ''}`.trim();
  document.getElementById('userModalSubtitle').textContent = entry.eventDate ? new Date(entry.eventDate).toLocaleString() : '';

  const body = document.getElementById('userModalBody');
  body.innerHTML = '';

  const rows = [
    ['User', (entry.user && entry.user.name) || '—'],
    ['Service', entry.serviceName || '—'],
    ['Level', entry.level || '—'],
    ['Status', entry.status || '—'],
    ['Application', entry.application || '—'],
    ['Entity', (entry.entity && (entry.entity.name || entry.entity.id)) || '—'],
    ['Message', (entry.message && (entry.message.message || entry.message.messageWithParams)) || '—'],
  ];
  rows.forEach(([k, v]) => body.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v })])));

  if ((entry.propertyChanges || []).length) {
    body.appendChild(el('div', { class: 'detail-card-title', style: 'margin-top:14px' }, [document.createTextNode('Property changes')]));
    entry.propertyChanges.forEach((change) => body.appendChild(renderAuditChangeRow(change.property || '—', change)));
  }
  if ((entry.entityChanges || []).length) {
    body.appendChild(el('div', { class: 'detail-card-title', style: 'margin-top:14px' }, [document.createTextNode('Entity changes')]));
    entry.entityChanges.forEach((change) => body.appendChild(renderAuditChangeRow(change.entityName || change.entityType || '—', change)));
  }

  document.getElementById('userModalOverlay').classList.remove('hidden');
}

async function pollAuditTransaction(transactionId) {
  const statusEl = document.getElementById('auditSearchStatus');
  const maxAttempts = 30; // ~45s at 1.5s intervals — long enough for large-org date ranges
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await proxy('GET', `/api/v2/audits/query/${transactionId}`);
    if (status.state === 'Succeeded') return;
    if (status.state === 'Failed' || status.state === 'Cancelled') {
      throw new Error(`Audit query ${status.state.toLowerCase()}.`);
    }
    statusEl.textContent = `Searching… (${status.state || 'Running'})`;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('Audit query is taking longer than expected — try narrowing the date range.');
}

async function fetchAuditResultsPage(transactionId, cursor) {
  const data = await proxy('GET', `/api/v2/audits/query/${transactionId}/results`, {
    query: { pageSize: 25, expand: 'user', cursor: cursor || undefined },
  });
  auditState.cursor = data.cursor || null;
  auditState.items = auditState.items.concat(data.entities || []);
  renderAuditResults();
}

async function runAuditSearch() {
  showError('auditError', '');
  const statusEl = document.getElementById('auditSearchStatus');
  const btn = document.getElementById('auditSearchBtn');

  let interval;
  try {
    interval = auditIntervalFromInputs();
  } catch (err) {
    return showError('auditError', err.message);
  }

  const body = { interval, filters: auditFiltersFromInputs(), sort: [{ name: 'Timestamp', sortOrder: 'descending' }] };
  const serviceName = document.getElementById('auditServiceSelect').value;
  if (serviceName) body.serviceName = serviceName;

  await withBusy(btn, 'Searching…', async () => {
    try {
      statusEl.textContent = 'Submitting query…';
      const submitted = await proxy('POST', '/api/v2/audits/query', { body });
      auditState.transactionId = submitted.id;
      auditState.cursor = null;
      auditState.items = [];

      if (submitted.state !== 'Succeeded') await pollAuditTransaction(submitted.id);

      statusEl.textContent = '';
      await fetchAuditResultsPage(submitted.id, null);
    } catch (err) {
      statusEl.textContent = '';
      showError('auditError', err.message);
    }
  });
}

document.getElementById('auditSearchBtn').addEventListener('click', runAuditSearch);
document.getElementById('auditLoadMoreBtn').addEventListener('click', () => {
  if (!auditState.transactionId || !auditState.cursor) return;
  fetchAuditResultsPage(auditState.transactionId, auditState.cursor).catch((err) => showError('auditError', err.message));
});

async function loadAuditTab() {
  await loadAuditServiceOptions();
  if (!document.getElementById('auditFrom').value) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    document.getElementById('auditFrom').value = toDatetimeLocalValue(yesterday);
    document.getElementById('auditTo').value = toDatetimeLocalValue(now);
    await runAuditSearch();
  }
}

// ---- init ----------------------------------------------------

loadRegions();
checkStatus();
