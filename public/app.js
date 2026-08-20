// ---- icon set (inline SVG, replaces the emoji glyphs previously used on these buttons) --------

const ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const ICON_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
const ICON_DESKTOP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
const ICON_MOBILE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>';

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
  btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.title = label;
  btn.setAttribute('aria-label', label);
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
  btn.innerHTML = isMobile ? ICON_DESKTOP : ICON_MOBILE;
  const label = isMobile ? 'Switch to desktop layout' : 'Switch to mobile layout';
  btn.title = label;
  btn.setAttribute('aria-label', label);
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
    // `.error` is set only when our own /api/proxy route fails before ever reaching Genesys (bad
    // path, auth, etc). A real Genesys API error is forwarded through as-is and uses `.message`
    // (sometimes with `.code`) instead — without this fallback, every Genesys-side error surfaced
    // as a generic "Request failed (4xx)" with the actual reason silently dropped.
    throw new Error(data.error || data.message || `Request failed (${resp.status})`);
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

// Same show/hide/toggle contract as showError, but for the boxed .alert-danger elements (icon +
// message) used where a plain inline error line isn't prominent enough — sets text on the child
// <span id="{elementId}Text"> rather than the alert div itself, so the icon markup stays intact.
function showAlertError(elementId, message) {
  const node = document.getElementById(elementId);
  const textNode = document.getElementById(`${elementId}Text`);
  if (!node || !textNode) return;
  textNode.textContent = message;
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
    showAlertError(errorId, '');
    state.items = [];
    state.pageNumber = 0;
    state.total = 0;
    try {
      await fetchPage(1);
    } catch (err) {
      // Previously only surfaced via the tab loader's toast (which fades in ~3s) — an inline,
      // persistent error is more useful here since the list is left empty until the user retries.
      showAlertError(errorId, err.message);
      throw err;
    }
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
      loadMore().catch((err) => showAlertError(errorId, err.message));
    });
  }

  return { state, reset, loadMore, prepend, remove, render };
}

// ---- Overview ----------------------------------------------------------

// Lightweight counts only (pageSize:1 — the list endpoints return `.total` regardless of how many
// entities are actually returned, so there's no need to pull full pages just for a number here).
// Each call is independent so one failing endpoint (e.g. a missing scope) doesn't blank the rest.
async function loadOverviewTab() {
  showAlertError('overviewStatsError', '');
  const stats = [
    ['overviewStatQueues', '/api/v2/routing/queues'],
    ['overviewStatWrapup', '/api/v2/routing/wrapupcodes'],
    ['overviewStatEvalforms', '/api/v2/quality/forms/evaluations'],
    ['overviewStatSchedules', '/api/v2/architect/schedules'],
  ];
  const failures = [];
  await Promise.all(
    stats.map(async ([elementId, path]) => {
      const statEl = document.getElementById(elementId);
      try {
        const data = await proxy('GET', path, { query: { pageSize: 1, pageNumber: 1 } });
        statEl.textContent = data.total != null ? data.total : '—';
      } catch (err) {
        statEl.textContent = '—';
        failures.push(err.message);
      } finally {
        statEl.classList.remove('skeleton-text');
      }
    })
  );
  if (failures.length) showAlertError('overviewStatsError', `Some counts couldn't load: ${failures[0]}`);
}

document.getElementById('overviewActionDisconnect').addEventListener('click', () => setActiveTab('interactions'));
document.getElementById('overviewActionCanned').addEventListener('click', () => { setActiveTab('canned'); openCreateModal('canned'); });
document.getElementById('overviewActionQueues').addEventListener('click', () => setActiveTab('queues'));
document.getElementById('overviewActionAudit').addEventListener('click', () => setActiveTab('audit'));
document.querySelectorAll('.overview-action').forEach((card) => {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
  });
});

document.getElementById('paletteTriggerBtn').addEventListener('click', () => openPalette());

// ---- view / tab navigation ----------------------------------------------

const lazyLoaded = new Set();
const tabLoaders = {
  overview: loadOverviewTab,
  canned: loadCannedTab,
  wrapup: () => wrapupResource.reset(),
  queues: loadQueuesTab,
  interactions: () => {
    if (!document.getElementById('interactionsFrom').value) {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
      document.getElementById('interactionsFrom').value = toDatetimeLocalValue(dayAgo);
      document.getElementById('interactionsTo').value = toDatetimeLocalValue(now);
    }
    return interactionQueuesResource.reset();
  },
  users: loadUsersAndDivisions,
  skills: () => skillsResource.reset(),
  architect: loadArchitectTab,
  schedules: () => schedulesResource.reset(),
  dataactions: loadDataActionsTab,
  evalforms: () => evalFormsResource.reset(),
  audit: loadAuditTab,
  explorer: () => {},
  releasenotes: () => renderReleaseNotes(),
};

const tabMeta = {
  overview: { title: 'Overview', sub: 'A quick look at your org, and shortcuts to common actions', create: null, bulk: false },
  canned: { title: 'Canned Responses', sub: 'Reusable agent replies, organised by library', create: 'New response', bulk: true },
  wrapup: { title: 'Wrap-up Codes', sub: 'Disposition codes agents apply after an interaction', create: 'New code', bulk: true },
  queues: { title: 'Queues', sub: 'Select one or more queues to manage members, codes & libraries', create: 'New queue', bulk: false },
  interactions: { title: 'Disconnect Interaction', sub: 'Disconnect a specific live interaction, or every interaction on selected queue(s)', create: null, bulk: false },
  users: { title: 'Users & Divisions', sub: 'Your organisation directory', create: null, bulk: false },
  skills: { title: 'Skills & Routing', sub: 'ACD skills used for skills-based routing', create: 'New skill', bulk: false },
  architect: { title: 'Architect', sub: 'Flows & prompts, and AI-assisted flow generation', create: null, bulk: false },
  schedules: { title: 'Schedules', sub: 'Time periods used by schedule groups and Architect flows', create: 'New schedule', bulk: false },
  dataactions: { title: 'Data Actions', sub: 'Reusable custom REST/function calls invoked from Architect flows', create: null, bulk: false },
  evalforms: { title: 'Evaluation Forms', sub: 'QA scorecards used to evaluate recorded interactions', create: null, bulk: false },
  audit: { title: 'Audit Log', sub: 'Who changed what, and when', create: null, bulk: false },
  explorer: { title: 'API Explorer', sub: 'Direct access to any Genesys Cloud API v2 endpoint', create: null, bulk: false },
  releasenotes: { title: 'Release Notes', sub: "What's shipped in this toolkit, newest first", create: null, bulk: false },
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
// role="button" + tabindex makes this focusable, but a div still needs Enter/Space wired up
// manually to behave like a real button for keyboard users.
document.getElementById('logoutBtn').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.target.click();
  }
});

function setAuthenticated(isAuthenticated, region) {
  document.getElementById('view-login').classList.toggle('hidden', isAuthenticated);
  document.getElementById('view-shell').classList.toggle('hidden', !isAuthenticated);

  if (isAuthenticated) {
    document.getElementById('statusRegionLabel').textContent = region;
    setActiveTab('overview');
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
    ['overview', 'Overview'],
    ['canned', 'Canned Responses'], ['wrapup', 'Wrap-up Codes'], ['queues', 'Queues'], ['interactions', 'Disconnect Interaction'],
    ['skills', 'Skills & Routing'], ['users', 'Users & Divisions'], ['schedules', 'Schedules'], ['dataactions', 'Data Actions'],
    ['evalforms', 'Evaluation Forms'], ['audit', 'Audit Log'], ['explorer', 'API Explorer'], ['releasenotes', 'Release Notes'],
  ];
  const items = nav.map(([k, l]) => ({ label: `Go to ${l}`, tag: 'Navigate', icon: '→', iconBg: '#4b5b68', run: () => setActiveTab(k) }));
  items.unshift(
    { label: 'New canned response', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('canned'); openCreateModal('canned'); } },
    { label: 'New wrap-up code', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('wrapup'); openCreateModal('wrapup'); } },
    { label: 'New skill', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('skills'); openCreateModal('skill'); } },
    { label: 'New queue', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('queues'); openCreateModal('queue'); } },
    { label: 'New schedule', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('schedules'); openCreateModal('schedule'); } },
    { label: 'New division', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('users'); openCreateModal('division'); } },
    { label: 'New evaluation form', tag: 'Action', icon: '+', iconBg: '#e8551e', run: () => { setActiveTab('evalforms'); openEvalFormBuilder(); } }
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
  document.getElementById('evalFormModalOverlay').classList.add('hidden');
  document.getElementById('queueSlaModalOverlay').classList.add('hidden');
  document.getElementById('queueScriptsModalOverlay').classList.add('hidden');
  document.getElementById('usersEmailModalOverlay').classList.add('hidden');
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
      showAlertError('membersError', err.message)
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

  const slaEditBtn = document.getElementById('queueSlaEditBtn');
  slaEditBtn.classList.toggle('hidden', queueIds.length === 0);
  slaEditBtn.textContent = queueIds.length === 1 ? 'Edit SLA / Service Level…' : `Edit SLA / Service Level (${queueIds.length})…`;

  const scriptsEditBtn = document.getElementById('queueScriptsEditBtn');
  scriptsEditBtn.classList.toggle('hidden', queueIds.length === 0);
  scriptsEditBtn.textContent = queueIds.length === 1 ? 'Edit Default Scripts…' : `Edit Default Scripts (${queueIds.length})…`;

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
      loadQueueMembers(queueIds[0]).catch((err) => showAlertError('membersError', err.message)),
      loadQueueWrapupCodes(queueIds[0]).catch((err) => showAlertError('queueWrapupError', err.message)),
      loadQueueLibraryConfig(queueIds[0]).catch((err) => showAlertError('queueLibraryError', err.message)),
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
  showAlertError('membersError', '');
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
  showAlertError('membersError', '');
  await withBusy(e.target, 'Loading…', async () => {
    try {
      await loadUserDirectory();
    } catch (err) {
      showAlertError('membersError', err.message);
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
  showAlertError('queueWrapupError', '');
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

// Genesys media-type keys as they appear in queue.mediaSettings, in the order they're always
// shown — shared between the read-only summary tiles below and the SLA bulk-edit modal further
// down so the two views never drift out of sync on labels or ordering.
const MEDIA_TYPE_LABELS = {
  call: 'Voice (Call)',
  callback: 'Callback',
  chat: 'Web Chat',
  email: 'Email',
  message: 'Message',
  socialExpression: 'Social Expression',
  video: 'Video',
};
const MEDIA_TYPE_ORDER = ['call', 'callback', 'chat', 'email', 'message', 'socialExpression', 'video'];

function mediaTypeLabel(key) {
  return MEDIA_TYPE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

function orderMediaTypeKeys(keys) {
  const set = new Set(keys);
  return [...MEDIA_TYPE_ORDER.filter((k) => set.has(k)), ...[...set].filter((k) => !MEDIA_TYPE_ORDER.includes(k)).sort()];
}

function settingTile(label, value) {
  return el('div', { class: 'setting-tile' }, [el('div', { class: 'label', text: label }), el('div', { class: 'value', text: value })]);
}

function renderQueueSettings(queue) {
  const grid = document.getElementById('queueSettingsGrid');
  grid.innerHTML = '';
  grid.appendChild(settingTile('Skill evaluation', queue.skillEvaluationMethod || '—'));

  const mediaSettings = queue.mediaSettings || {};
  const keys = orderMediaTypeKeys(Object.keys(mediaSettings));
  if (!keys.length) {
    grid.appendChild(settingTile('Service Level', 'No media types configured'));
  } else {
    // One SLA tile + one alerting-timeout tile per media type, not just the first one found —
    // a queue with Call, Email and Chat all configured differently now shows all three.
    keys.forEach((key) => {
      const media = mediaSettings[key];
      const sla = media && media.serviceLevel;
      const label = mediaTypeLabel(key);
      grid.appendChild(settingTile(`${label} SLA`, sla ? `${Math.round(sla.percentage * 100)}% / ${Math.round(sla.durationMs / 1000)}s` : '—'));
      grid.appendChild(settingTile(`${label} alerting`, media && media.alertingTimeoutSeconds != null ? `${media.alertingTimeoutSeconds}s` : '—'));
    });
  }
  grid.classList.remove('hidden');
}

async function loadQueueLibraryConfig(queueId) {
  showAlertError('queueLibraryError', '');
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
  showAlertError('queueLibraryError', '');
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
    showAlertError('queueLibraryError', err.message);
  }
}

document.getElementById('queueLibraryChooseBtn').addEventListener('click', () => {
  if (!getSelectedQueueIds().length) { showToast('Select at least one queue first.', true); return; }
  openPickModal('libraryChoose');
});

// ---- Queue Service Level (SLA) bulk edit -----------------------------------
// A queue's "Service Level" is set per media type (call, email, chat, ...): a target percentage
// of interactions that must be handled within a duration window, plus an alerting timeout — that
// trio IS what Genesys (and this UI) calls the SLA. Genesys's queue list endpoint only returns
// summary rows, so — same safety pattern as everywhere else in this app — the modal re-fetches
// each selected queue's full mediaSettings before showing anything. A checked row only ever
// touches the serviceLevel (and, if filled in, alertingTimeoutSeconds) of that one media type,
// leaving every other field and every other media type exactly as it was — unless the user
// explicitly opts a row into creating that media type on queues that don't have it yet.

let queueSlaFullQueues = []; // full-detail queues fetched when the modal opened
let queueSlaRowState = []; // [{ key, label, checkbox, percentInput, secondsInput, alertingInput, createToggle, queuesWithType: [id,...] }]
let queueSlaViewMode = 'edit'; // 'edit' | 'review'
let queueSlaPendingChanges = null; // computed once on "Review changes", reused by "Confirm & apply"

function setQueueSlaView(mode) {
  queueSlaViewMode = mode;
  document.getElementById('queueSlaEditView').classList.toggle('hidden', mode !== 'edit');
  document.getElementById('queueSlaReviewView').classList.toggle('hidden', mode !== 'review');
  document.getElementById('queueSlaApplyBtn').classList.toggle('hidden', mode !== 'edit');
  document.getElementById('queueSlaBackBtn').classList.toggle('hidden', mode !== 'review');
  document.getElementById('queueSlaConfirmBtn').classList.toggle('hidden', mode !== 'review');
}

async function openQueueSlaModal() {
  const queueIds = getSelectedQueueIds();
  if (!queueIds.length) { showToast('Select at least one queue first.', true); return; }

  showError('queueSlaModalError', '');
  document.getElementById('queueSlaResults').innerHTML = '';
  document.getElementById('queueSlaReviewBody').innerHTML = '';
  queueSlaPendingChanges = null;
  setQueueSlaView('edit');

  const names = getSelectedQueueNames();
  document.getElementById('queueSlaModalTitle').textContent =
    queueIds.length === 1 ? `Service Level (SLA) — ${names[0]}` : `Service Level (SLA) — ${queueIds.length} queues`;
  document.getElementById('queueSlaModalSub').textContent = names.join(', ');

  const body = document.getElementById('queueSlaModalBody');
  body.innerHTML = '';
  body.appendChild(el('div', { class: 'sub', text: 'Loading current settings…' }));
  document.getElementById('queueSlaModalOverlay').classList.remove('hidden');

  try {
    queueSlaFullQueues = await Promise.all(queueIds.map((id) => proxy('GET', `/api/v2/routing/queues/${id}`)));
    renderQueueSlaPresetOptions();
    renderQueueSlaModalBody();
  } catch (err) {
    body.innerHTML = '';
    showError('queueSlaModalError', err.message);
  }
}

function renderQueueSlaModalBody() {
  const body = document.getElementById('queueSlaModalBody');
  body.innerHTML = '';
  queueSlaRowState = [];

  // Every known media type is offered, not just ones already configured — that's what lets a
  // row be used to *add* SLA to a media type none of the selected queues have yet (enhancement:
  // "enable SLA on new media types"). Rows already configured everywhere still come first.
  const presentKeys = new Set();
  queueSlaFullQueues.forEach((q) => Object.keys(q.mediaSettings || {}).forEach((k) => presentKeys.add(k)));
  const orderedKeys = orderMediaTypeKeys([...new Set([...MEDIA_TYPE_ORDER, ...presentKeys])]);

  orderedKeys.forEach((key) => {
    const queuesWithType = queueSlaFullQueues.filter((q) => q.mediaSettings && q.mediaSettings[key]);
    const missingCount = queueSlaFullQueues.length - queuesWithType.length;
    const fullyCovered = missingCount === 0;
    const noneCovered = queuesWithType.length === 0;

    const slas = queuesWithType.map((q) => q.mediaSettings[key].serviceLevel).filter(Boolean);
    const alertings = queuesWithType.map((q) => q.mediaSettings[key].alertingTimeoutSeconds).filter((v) => v != null);
    const percents = new Set(slas.map((s) => Math.round(s.percentage * 100)));
    const seconds = new Set(slas.map((s) => Math.round(s.durationMs / 1000)));
    const alertSet = new Set(alertings);
    const uniformPercent = percents.size === 1 ? [...percents][0] : '';
    const uniformSeconds = seconds.size === 1 ? [...seconds][0] : '';
    const uniformAlerting = alertSet.size === 1 ? [...alertSet][0] : '';

    const checkbox = el('input', { type: 'checkbox' });
    const percentInput = el('input', {
      type: 'number', min: '0', max: '100', step: '1', disabled: 'disabled',
      placeholder: percents.size > 1 ? 'Mixed' : '—',
    });
    if (uniformPercent !== '') percentInput.value = uniformPercent;
    const secondsInput = el('input', {
      type: 'number', min: '1', step: '1', disabled: 'disabled',
      placeholder: seconds.size > 1 ? 'Mixed' : '—',
    });
    if (uniformSeconds !== '') secondsInput.value = uniformSeconds;
    const alertingInput = el('input', {
      type: 'number', min: '1', step: '1', disabled: 'disabled',
      placeholder: alertSet.size > 1 ? 'Mixed' : noneCovered ? 'required to add' : 'unchanged',
    });
    if (uniformAlerting !== '') alertingInput.value = uniformAlerting;

    const createToggle = fullyCovered ? null : el('input', { type: 'checkbox', disabled: 'disabled' });

    checkbox.addEventListener('change', () => {
      percentInput.disabled = !checkbox.checked;
      secondsInput.disabled = !checkbox.checked;
      alertingInput.disabled = !checkbox.checked;
      if (createToggle) createToggle.disabled = !checkbox.checked;
    });

    let badge = null;
    if (noneCovered) {
      badge = el('span', { class: 'sla-badge new', text: 'Not configured on any selected queue' });
    } else if (!fullyCovered) {
      badge = el('span', { class: 'sla-badge', text: `${queuesWithType.length}/${queueSlaFullQueues.length} configured` });
    }

    const labelChildren = [checkbox, el('span', {}, [document.createTextNode(mediaTypeLabel(key))])];
    if (badge) labelChildren.push(badge);

    const rowChildren = [
      el('label', { class: 'sla-media-label' }, labelChildren),
      el('div', { class: 'sla-field' }, [el('span', { text: 'Target %' }), percentInput]),
      el('div', { class: 'sla-field' }, [el('span', { text: 'Within (sec)' }), secondsInput]),
      el('div', { class: 'sla-field' }, [el('span', { text: 'Alerting (sec)' }), alertingInput]),
    ];
    if (createToggle) {
      const toggleLabel = noneCovered
        ? `Add this media type to all ${queueSlaFullQueues.length} selected queue(s) (requires Alerting sec)`
        : `Also add to the ${missingCount} queue(s) that don't have it yet (requires Alerting sec)`;
      rowChildren.push(el('label', { class: 'sla-new-toggle' }, [createToggle, el('span', { text: toggleLabel })]));
    }

    body.appendChild(el('div', { class: 'sla-media-row' }, rowChildren));

    queueSlaRowState.push({
      key,
      label: mediaTypeLabel(key),
      checkbox,
      percentInput,
      secondsInput,
      alertingInput,
      createToggle,
      queuesWithType: queuesWithType.map((q) => q.id),
    });
  });
}

// Reads the checked rows, validates them, and resolves which queues each change actually
// targets (existing-only, or existing+newly-created when the row's create-toggle is on).
// Returns { ok:false, error } on the first problem found, or { ok:true, changes }.
function collectQueueSlaChanges() {
  const changes = [];
  for (const row of queueSlaRowState) {
    if (!row.checkbox.checked) continue;
    const pctRaw = row.percentInput.value.trim();
    const secRaw = row.secondsInput.value.trim();
    const alertRaw = row.alertingInput.value.trim();
    if (!pctRaw || !secRaw) return { ok: false, error: `Enter both Target % and Within (sec) for ${row.label}, or uncheck it.` };
    const pct = Number(pctRaw);
    const sec = Number(secRaw);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, error: `${row.label}: Target % must be between 0 and 100.` };
    if (!Number.isFinite(sec) || sec <= 0) return { ok: false, error: `${row.label}: Within (sec) must be a positive number.` };

    let alertingSeconds = null;
    if (alertRaw) {
      const a = Number(alertRaw);
      if (!Number.isFinite(a) || a <= 0) return { ok: false, error: `${row.label}: Alerting (sec) must be a positive number.` };
      alertingSeconds = a;
    }

    const createForMissing = row.createToggle ? row.createToggle.checked : false;
    const queueIds = createForMissing ? queueSlaFullQueues.map((q) => q.id) : row.queuesWithType;
    if (!queueIds.length) {
      return {
        ok: false,
        error: `${row.label}: none of the selected queues have this media type. Check "Also add to queues that don't have it yet", or uncheck this row.`,
      };
    }
    if (createForMissing && alertingSeconds == null) {
      return { ok: false, error: `${row.label}: Alerting (sec) is required to add this media type to queues that don't have it yet.` };
    }

    changes.push({
      key: row.key,
      label: row.label,
      percentage: pct / 100,
      percentDisplay: pct,
      durationMs: Math.round(sec * 1000),
      secondsDisplay: sec,
      alertingSeconds,
      queueIds,
    });
  }
  if (!changes.length) return { ok: false, error: 'Check at least one media type to apply changes to.' };
  return { ok: true, changes };
}

function renderQueueSlaReview(changes) {
  const container = document.getElementById('queueSlaReviewBody');
  container.innerHTML = '';

  const table = el('table', { class: 'sla-review-table' });
  const thead = el('thead', {}, [
    el('tr', {}, ['Queue', 'Media type', 'Target %', 'Within (sec)', 'Alerting (sec)'].map((h) => el('th', { text: h }))),
  ]);
  const tbody = el('tbody');

  changes.forEach((c) => {
    c.queueIds.forEach((qid) => {
      const q = queueSlaFullQueues.find((x) => x.id === qid);
      if (!q) return;
      const existing = q.mediaSettings && q.mediaSettings[c.key];
      const isNew = !existing;
      const oldPct = existing && existing.serviceLevel ? `${Math.round(existing.serviceLevel.percentage * 100)}%` : '—';
      const oldSec = existing && existing.serviceLevel ? `${Math.round(existing.serviceLevel.durationMs / 1000)}s` : '—';
      const oldAlert = existing && existing.alertingTimeoutSeconds != null ? `${existing.alertingTimeoutSeconds}s` : '—';
      const newAlert = c.alertingSeconds != null ? `${c.alertingSeconds}s` : isNew ? '—' : 'unchanged';

      tbody.appendChild(
        el('tr', {}, [
          el('td', { text: q.name }),
          el('td', {}, [document.createTextNode(c.label), isNew ? el('span', { class: 'new-tag', text: 'NEW' }) : document.createTextNode('')]),
          el('td', { text: `${oldPct} → ${c.percentDisplay}%` }),
          el('td', { text: `${oldSec} → ${c.secondsDisplay}s` }),
          el('td', { text: `${oldAlert} → ${newAlert}` }),
        ])
      );
    });
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

async function confirmQueueSlaApply() {
  if (!queueSlaPendingChanges || !queueSlaPendingChanges.length) return;
  const btn = document.getElementById('queueSlaConfirmBtn');
  await withBusy(btn, 'Applying…', async () => {
    const results = [];
    for (const q of queueSlaFullQueues) {
      const relevant = queueSlaPendingChanges.filter((c) => c.queueIds.includes(q.id));
      if (!relevant.length) continue; // not part of this batch — not a failure, just untouched
      try {
        const mediaSettings = Object.assign({}, q.mediaSettings);
        relevant.forEach((c) => {
          mediaSettings[c.key] = Object.assign(
            {},
            mediaSettings[c.key],
            { serviceLevel: { percentage: c.percentage, durationMs: c.durationMs } },
            c.alertingSeconds != null ? { alertingTimeoutSeconds: c.alertingSeconds } : {}
          );
        });
        await proxy('PATCH', `/api/v2/routing/queues/${q.id}`, { body: { mediaSettings } });
        results.push({ ok: true, label: q.name });
      } catch (err) {
        results.push({ ok: false, label: q.name, message: err.message });
      }
    }
    renderBulkResults('queueSlaResults', results);
    const okCount = results.filter((r) => r.ok).length;
    showToast(`${okCount} of ${results.length} queue(s) updated.`, okCount < results.length);
    if (okCount) await refreshManagedQueuePanels();
  });
}

// ---- SLA presets (saved locally in this browser — not synced across users/devices) ---------

const QUEUE_SLA_PRESETS_KEY = 'gct.queueSlaPresets';

function loadQueueSlaPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_SLA_PRESETS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueueSlaPresetsList(list) {
  try {
    localStorage.setItem(QUEUE_SLA_PRESETS_KEY, JSON.stringify(list));
  } catch {
    showToast('Could not save preset — browser storage is unavailable or full.', true);
  }
}

function renderQueueSlaPresetOptions() {
  const select = document.getElementById('queueSlaPresetSelect');
  const presets = loadQueueSlaPresets();
  select.innerHTML = '';
  select.appendChild(el('option', { value: '', text: 'Load a preset…' }));
  presets.forEach((p) => {
    select.appendChild(el('option', { value: p.id, text: `${p.name} (${p.rows.length} media type${p.rows.length === 1 ? '' : 's'})` }));
  });
}

function applyQueueSlaPreset(preset) {
  let matched = 0;
  preset.rows.forEach((entry) => {
    const row = queueSlaRowState.find((r) => r.key === entry.key);
    if (!row) return;
    matched += 1;
    row.checkbox.checked = true;
    row.percentInput.disabled = false;
    row.secondsInput.disabled = false;
    row.alertingInput.disabled = false;
    if (row.createToggle) row.createToggle.disabled = false;
    row.percentInput.value = entry.percent;
    row.secondsInput.value = entry.seconds;
    row.alertingInput.value = entry.alertingSeconds != null ? entry.alertingSeconds : '';
  });
  showToast(matched ? `Applied preset "${preset.name}" to ${matched} row(s).` : `"${preset.name}" has no media types in common with this selection.`, !matched);
}

document.getElementById('queueSlaPresetApplyBtn').addEventListener('click', () => {
  const id = document.getElementById('queueSlaPresetSelect').value;
  if (!id) { showToast('Choose a preset to apply first.', true); return; }
  const preset = loadQueueSlaPresets().find((p) => p.id === id);
  if (preset) applyQueueSlaPreset(preset);
});

document.getElementById('queueSlaPresetDeleteBtn').addEventListener('click', async () => {
  const select = document.getElementById('queueSlaPresetSelect');
  const id = select.value;
  if (!id) { showToast('Choose a preset to delete first.', true); return; }
  const presets = loadQueueSlaPresets();
  const preset = presets.find((p) => p.id === id);
  if (!preset) return;
  const ok = await confirmModal({ title: 'Delete preset', message: `Delete the "${preset.name}" preset? This only affects this browser.` });
  if (!ok) return;
  saveQueueSlaPresetsList(presets.filter((p) => p.id !== id));
  renderQueueSlaPresetOptions();
  showToast(`Deleted preset "${preset.name}".`);
});

document.getElementById('queueSlaPresetSaveBtn').addEventListener('click', () => {
  showError('queueSlaPresetError', '');
  const nameInput = document.getElementById('queueSlaPresetNameInput');
  const name = nameInput.value.trim();
  if (!name) return showError('queueSlaPresetError', 'Enter a name for the preset.');

  const rows = [];
  for (const row of queueSlaRowState) {
    if (!row.checkbox.checked) continue;
    const percent = row.percentInput.value.trim();
    const seconds = row.secondsInput.value.trim();
    if (!percent || !seconds) return showError('queueSlaPresetError', `${row.label} is checked but missing Target % or Within (sec).`);
    const alertRaw = row.alertingInput.value.trim();
    rows.push({ key: row.key, percent: Number(percent), seconds: Number(seconds), alertingSeconds: alertRaw ? Number(alertRaw) : null });
  }
  if (!rows.length) return showError('queueSlaPresetError', 'Check at least one media type with values before saving a preset.');

  const presets = loadQueueSlaPresets();
  presets.push({ id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, rows });
  saveQueueSlaPresetsList(presets);
  renderQueueSlaPresetOptions();
  nameInput.value = '';
  showToast(`Saved preset "${name}".`);
});

document.getElementById('queueSlaEditBtn').addEventListener('click', openQueueSlaModal);
document.getElementById('queueSlaCancelBtn').addEventListener('click', () => document.getElementById('queueSlaModalOverlay').classList.add('hidden'));
document.getElementById('queueSlaApplyBtn').addEventListener('click', () => {
  const result = collectQueueSlaChanges();
  if (!result.ok) { showError('queueSlaModalError', result.error); return; }
  showError('queueSlaModalError', '');
  document.getElementById('queueSlaResults').innerHTML = '';
  queueSlaPendingChanges = result.changes;
  renderQueueSlaReview(queueSlaPendingChanges);
  setQueueSlaView('review');
});
document.getElementById('queueSlaBackBtn').addEventListener('click', () => {
  queueSlaPendingChanges = null;
  setQueueSlaView('edit');
});
document.getElementById('queueSlaConfirmBtn').addEventListener('click', confirmQueueSlaApply);
document.getElementById('queueSlaModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'queueSlaModalOverlay') document.getElementById('queueSlaModalOverlay').classList.add('hidden');
});

// ---- Queue Default Scripts bulk edit ---------------------------------------
// Each queue can have a default Script per media type (the script an agent's UI loads for an
// interaction on that queue) -- Genesys models this as `defaultScripts`, a media-type-keyed map
// living directly on the Queue resource, the same shape as `mediaSettings`. Unlike SLA, a script
// assignment doesn't require the media type to already exist in `mediaSettings` first, so there's
// no "opt in to create" step here -- a checked row just applies to every selected queue.
// NOTE: the PATCH shape below (`{ defaultScripts: { <mediaType>: { id } | null } }`) is the
// best-informed guess from the Queue resource schema, not verified live -- same caveat as the
// Analytics query in the Interactions module before it was corrected against a real org.

let allScriptsCache = []; // {id, name}

async function loadAllScriptsCache() {
  allScriptsCache = [];
  let pageNumber = 1;
  const pageSize = 200;
  const maxPages = 10;
  let total = Infinity;
  while ((pageNumber - 1) * pageSize < total && pageNumber <= maxPages) {
    const data = await proxy('GET', '/api/v2/scripts', { query: { pageNumber, pageSize } });
    total = data.total || 0;
    allScriptsCache = allScriptsCache.concat(data.entities || []);
    pageNumber += 1;
  }
  allScriptsCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

let queueScriptsFullQueues = [];
let queueScriptsRowState = []; // [{ key, label, checkbox, select }]
let queueScriptsPendingChanges = null;

function setQueueScriptsView(mode) {
  document.getElementById('queueScriptsEditView').classList.toggle('hidden', mode !== 'edit');
  document.getElementById('queueScriptsReviewView').classList.toggle('hidden', mode !== 'review');
  document.getElementById('queueScriptsApplyBtn').classList.toggle('hidden', mode !== 'edit');
  document.getElementById('queueScriptsBackBtn').classList.toggle('hidden', mode !== 'review');
  document.getElementById('queueScriptsConfirmBtn').classList.toggle('hidden', mode !== 'review');
}

async function openQueueScriptsModal() {
  const queueIds = getSelectedQueueIds();
  if (!queueIds.length) { showToast('Select at least one queue first.', true); return; }

  showError('queueScriptsModalError', '');
  document.getElementById('queueScriptsResults').innerHTML = '';
  document.getElementById('queueScriptsReviewBody').innerHTML = '';
  queueScriptsPendingChanges = null;
  setQueueScriptsView('edit');

  const names = getSelectedQueueNames();
  document.getElementById('queueScriptsModalTitle').textContent =
    queueIds.length === 1 ? `Default Scripts — ${names[0]}` : `Default Scripts — ${queueIds.length} queues`;
  document.getElementById('queueScriptsModalSub').textContent = names.join(', ');

  const body = document.getElementById('queueScriptsModalBody');
  body.innerHTML = '';
  body.appendChild(el('div', { class: 'sub', text: 'Loading current settings…' }));
  document.getElementById('queueScriptsModalOverlay').classList.remove('hidden');

  try {
    const [fullQueues] = await Promise.all([
      Promise.all(queueIds.map((id) => proxy('GET', `/api/v2/routing/queues/${id}`))),
      allScriptsCache.length ? Promise.resolve() : loadAllScriptsCache(),
    ]);
    queueScriptsFullQueues = fullQueues;
    renderQueueScriptsModalBody();
  } catch (err) {
    body.innerHTML = '';
    showError('queueScriptsModalError', err.message);
  }
}

function scriptNameFor(ref) {
  if (!ref) return null;
  if (ref.name) return ref.name;
  const found = allScriptsCache.find((s) => s.id === ref.id);
  return found ? found.name : ref.id;
}

function renderQueueScriptsModalBody() {
  const body = document.getElementById('queueScriptsModalBody');
  body.innerHTML = '';
  queueScriptsRowState = [];

  const keysSet = new Set();
  queueScriptsFullQueues.forEach((q) => {
    Object.keys(q.mediaSettings || {}).forEach((k) => keysSet.add(k));
    Object.keys(q.defaultScripts || {}).forEach((k) => keysSet.add(k));
  });
  const orderedKeys = orderMediaTypeKeys([...keysSet]);

  if (!orderedKeys.length) {
    body.appendChild(
      el('div', { class: 'sla-media-row empty-state', text: 'None of the selected queues have any media types configured yet.' })
    );
    return;
  }

  orderedKeys.forEach((key) => {
    const configuredCount = queueScriptsFullQueues.filter((q) => q.mediaSettings && q.mediaSettings[key]).length;
    const scriptIds = new Set(queueScriptsFullQueues.map((q) => (q.defaultScripts && q.defaultScripts[key] && q.defaultScripts[key].id) || ''));
    const mixed = scriptIds.size > 1;
    const uniformId = mixed ? '' : [...scriptIds][0];

    const checkbox = el('input', { type: 'checkbox' });
    const select = el('select', { class: 'text-input', disabled: 'disabled' });
    if (mixed) select.appendChild(el('option', { value: '__mixed__', text: 'Mixed across selected queues — choose to overwrite' }));
    select.appendChild(el('option', { value: '__none__', text: 'No default script' }));
    allScriptsCache.forEach((s) => select.appendChild(el('option', { value: s.id, text: s.name })));
    select.value = mixed ? '__mixed__' : uniformId || '__none__';

    checkbox.addEventListener('change', () => { select.disabled = !checkbox.checked; });

    const badge =
      configuredCount > 0 && configuredCount < queueScriptsFullQueues.length
        ? el('span', { class: 'sla-badge', text: `${configuredCount}/${queueScriptsFullQueues.length} configured` })
        : null;
    const labelChildren = [checkbox, el('span', {}, [document.createTextNode(mediaTypeLabel(key))])];
    if (badge) labelChildren.push(badge);

    body.appendChild(
      el('div', { class: 'sla-media-row' }, [
        el('label', { class: 'sla-media-label' }, labelChildren),
        el('div', { class: 'sla-field sla-field-wide' }, [el('span', { text: 'Default script' }), select]),
      ])
    );

    queueScriptsRowState.push({ key, label: mediaTypeLabel(key), checkbox, select });
  });
}

function collectQueueScriptsChanges() {
  const changes = [];
  for (const row of queueScriptsRowState) {
    if (!row.checkbox.checked) continue;
    if (row.select.value === '__mixed__') {
      return { ok: false, error: `${row.label}: choose a script (or "No default script") — it currently varies across the selected queues.` };
    }
    changes.push({ key: row.key, label: row.label, scriptId: row.select.value === '__none__' ? null : row.select.value, scriptName: row.select.value === '__none__' ? null : row.select.options[row.select.selectedIndex].text });
  }
  if (!changes.length) return { ok: false, error: 'Check at least one media type to apply changes to.' };
  return { ok: true, changes };
}

function renderQueueScriptsReview(changes) {
  const container = document.getElementById('queueScriptsReviewBody');
  container.innerHTML = '';

  const table = el('table', { class: 'sla-review-table' });
  const thead = el('thead', {}, [el('tr', {}, ['Queue', 'Media type', 'Default script'].map((h) => el('th', { text: h })))]);
  const tbody = el('tbody');

  changes.forEach((c) => {
    queueScriptsFullQueues.forEach((q) => {
      const oldName = scriptNameFor(q.defaultScripts && q.defaultScripts[c.key]) || 'No default script';
      const newName = c.scriptName || 'No default script';
      tbody.appendChild(
        el('tr', {}, [
          el('td', { text: q.name }),
          el('td', { text: c.label }),
          el('td', { text: oldName === newName ? `${newName} (unchanged)` : `${oldName} → ${newName}` }),
        ])
      );
    });
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

async function confirmQueueScriptsApply() {
  if (!queueScriptsPendingChanges || !queueScriptsPendingChanges.length) return;
  const btn = document.getElementById('queueScriptsConfirmBtn');
  await withBusy(btn, 'Applying…', async () => {
    const results = [];
    for (const q of queueScriptsFullQueues) {
      try {
        const defaultScripts = Object.assign({}, q.defaultScripts);
        queueScriptsPendingChanges.forEach((c) => {
          defaultScripts[c.key] = c.scriptId ? { id: c.scriptId } : null;
        });
        await proxy('PATCH', `/api/v2/routing/queues/${q.id}`, { body: { defaultScripts } });
        results.push({ ok: true, label: q.name });
      } catch (err) {
        results.push({ ok: false, label: q.name, message: err.message });
      }
    }
    renderBulkResults('queueScriptsResults', results);
    const okCount = results.filter((r) => r.ok).length;
    showToast(`${okCount} of ${results.length} queue(s) updated.`, okCount < results.length);
    if (okCount) await refreshManagedQueuePanels();
  });
}

document.getElementById('queueScriptsEditBtn').addEventListener('click', openQueueScriptsModal);
document.getElementById('queueScriptsCancelBtn').addEventListener('click', () => document.getElementById('queueScriptsModalOverlay').classList.add('hidden'));
document.getElementById('queueScriptsApplyBtn').addEventListener('click', () => {
  const result = collectQueueScriptsChanges();
  if (!result.ok) { showError('queueScriptsModalError', result.error); return; }
  showError('queueScriptsModalError', '');
  document.getElementById('queueScriptsResults').innerHTML = '';
  queueScriptsPendingChanges = result.changes;
  renderQueueScriptsReview(queueScriptsPendingChanges);
  setQueueScriptsView('review');
});
document.getElementById('queueScriptsBackBtn').addEventListener('click', () => {
  queueScriptsPendingChanges = null;
  setQueueScriptsView('edit');
});
document.getElementById('queueScriptsConfirmBtn').addEventListener('click', confirmQueueScriptsApply);
document.getElementById('queueScriptsModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'queueScriptsModalOverlay') document.getElementById('queueScriptsModalOverlay').classList.add('hidden');
});

// ---- Interactions (disconnect live interactions) ---------------------------
// Genesys has no "list active conversations by queue" endpoint in the core Conversations API, so
// discovery goes through an Analytics conversation-details query instead (the same mechanism
// supervisor "live" views use), filtered client-side to conversations that haven't ended yet.
// Disconnecting a conversation means disconnecting every one of its participants via the generic
// per-participant PATCH endpoint — media-type-agnostic, so it works the same for calls, chats,
// emails, messages, and callbacks without branching per media type.

let currentInteractions = []; // [{ conversationId, queueId, queueName, mediaTypes, participantIds, participantSummary, startedAt }]
const selectedInteractionIds = new Set(); // conversationIds checked in the results table

const interactionQueuesResource = createListResource({
  path: '/api/v2/routing/queues',
  pageSize: 50,
  containerId: 'interactionQueuesTableBody',
  filterId: 'interactionQueuesFilter',
  loadMoreId: 'interactionQueuesLoadMoreBtn',
  buildRow: (queue) => {
    const selected = selectedInteractionQueueIds.has(queue.id);
    const divisionName = (queue.division && queue.division.name) || '';
    // Shows every media type actually configured on the queue (Call, Email, Chat, ...) so it's
    // clear up front what "Load active interactions" could surface for it, before spending a
    // call on it. Only shown when the list response actually included mediaSettings — never
    // guessed — same defensive rule used for the Evaluation Forms Groups-count fix.
    const mediaKeys = queue.mediaSettings ? orderMediaTypeKeys(Object.keys(queue.mediaSettings)) : null;
    const mediaText = mediaKeys && mediaKeys.length ? mediaKeys.map((k) => mediaTypeLabel(k)).join(', ') : null;

    const row = el('div', { class: `queue-list-item${selected ? ' selected' : ''}` }, [
      el('div', { class: 'name' }, [cellText(queue.name)]),
      el('div', { class: 'meta', text: divisionName }),
      el('div', { class: 'meta', text: mediaText || 'Media types unavailable' }),
    ]);
    row.addEventListener('click', () => toggleInteractionQueueSelection(queue.id));
    return row;
  },
  onLoaded: () => interactionQueuesResource.render(),
});

const selectedInteractionQueueIds = new Set();

function toggleInteractionQueueSelection(queueId) {
  if (selectedInteractionQueueIds.has(queueId)) selectedInteractionQueueIds.delete(queueId); else selectedInteractionQueueIds.add(queueId);
  interactionQueuesResource.render();
  refreshInteractionQueueSelectionSummary();
}

function getSelectedInteractionQueueIds() { return [...selectedInteractionQueueIds]; }
function getSelectedInteractionQueueNames() {
  return interactionQueuesResource.state.items.filter((q) => selectedInteractionQueueIds.has(q.id)).map((q) => q.name);
}

function refreshInteractionQueueSelectionSummary() {
  const ids = getSelectedInteractionQueueIds();
  const names = getSelectedInteractionQueueNames();
  const selectedQueues = interactionQueuesResource.state.items.filter((q) => selectedInteractionQueueIds.has(q.id));

  document.getElementById('interactionQueuesSelectionSummary').textContent =
    ids.length ? `${ids.length} queue${ids.length === 1 ? '' : 's'} selected` : 'No queues selected';
  document.getElementById('interactionQueuesSelectionMeta').textContent = names.join(', ');

  // Union of every media type configured across the selected queue(s) — what "Load active
  // interactions" could possibly surface, shown before you even click it.
  const mediaKeySet = new Set();
  let anyMediaKnown = false;
  selectedQueues.forEach((q) => {
    if (!q.mediaSettings) return;
    anyMediaKnown = true;
    Object.keys(q.mediaSettings).forEach((k) => mediaKeySet.add(k));
  });
  const mediaEl = document.getElementById('interactionQueuesSelectionMedia');
  if (!ids.length) {
    mediaEl.textContent = '';
  } else if (!anyMediaKnown) {
    mediaEl.textContent = 'Media types: unavailable';
  } else if (!mediaKeySet.size) {
    mediaEl.textContent = 'Media types: none configured';
  } else {
    mediaEl.textContent = `Media types: ${orderMediaTypeKeys([...mediaKeySet]).map((k) => mediaTypeLabel(k)).join(', ')}`;
  }
}

function relativeTimeFrom(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function interactionMediaText(mediaTypes) {
  return mediaTypes.length ? mediaTypes.map((t) => mediaTypeLabel(t)).join(', ') : '—';
}

// Best-effort extraction from an Analytics conversation-details record — the schema here is the
// one part of this module not exercised against a live org, so this stays defensive: every field
// falls back to something sane rather than throwing if the response shape differs from expected.
function extractInteractionFromAnalyticsConversation(conv, selectedQueueIds, queueNameById) {
  const participants = conv.participants || [];
  const mediaTypes = new Set();
  const queueIds = new Set();

  participants.forEach((p) => {
    (p.sessions || []).forEach((s) => {
      if (s.mediaType) mediaTypes.add(s.mediaType);
      (s.segments || []).forEach((seg) => { if (seg.queueId) queueIds.add(seg.queueId); });
    });
  });

  // A transferred conversation may have touched more than one queue — prefer whichever queue the
  // user actually selected over whatever else shows up in the segment history.
  const matchedQueueId = [...queueIds].find((id) => selectedQueueIds.includes(id)) || [...queueIds][0] || null;
  const queueName = matchedQueueId ? queueNameById[matchedQueueId] || matchedQueueId : '—';

  const participantSummary = participants
    .map((p) => {
      if (p.purpose === 'agent' || p.purpose === 'user') {
        const user = allUsersCache.find((u) => u.id === p.userId);
        return user ? user.name : 'Agent';
      }
      if (p.purpose === 'customer' || p.purpose === 'external') return 'Customer';
      return p.purpose || 'Participant';
    })
    .join(', ');

  return {
    conversationId: conv.conversationId,
    queueId: matchedQueueId,
    queueName,
    mediaTypes: [...mediaTypes],
    participantIds: participants.map((p) => p.participantId).filter(Boolean),
    participantSummary: participantSummary || '—',
    startedAt: conv.conversationStart,
  };
}

// Quick-fill presets for the From/To fields, adapted from the standard date-range-picker preset
// set but trimmed to what actually fits Genesys's 31-day cap: "Previous 3 months" is dropped (way
// over it), and the "by week" grouping options aren't included since those bucket a report into
// weekly rows -- not meaningful for a plain from/to range. Week starts Monday.
function computeInteractionsRangePreset(key) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d) => {
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1) - day;
    return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
  };

  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: now };
    case 'yesterday': {
      const start = startOfDay(now);
      return { from: new Date(start.getTime() - 24 * 3600 * 1000), to: start };
    }
    case 'thisWeek':
      return { from: startOfWeek(now), to: now };
    case 'lastWeek': {
      const start = startOfWeek(now);
      return { from: new Date(start.getTime() - 7 * 24 * 3600 * 1000), to: start };
    }
    case 'previous7Days':
      return { from: new Date(now.getTime() - 7 * 24 * 3600 * 1000), to: now };
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'lastMonth':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'previous30Days':
      return { from: new Date(now.getTime() - 30 * 24 * 3600 * 1000), to: now };
    default:
      return null;
  }
}

document.getElementById('interactionsRangePreset').addEventListener('change', (e) => {
  const range = computeInteractionsRangePreset(e.target.value);
  if (!range) return;
  document.getElementById('interactionsFrom').value = toDatetimeLocalValue(range.from);
  document.getElementById('interactionsTo').value = toDatetimeLocalValue(range.to);
  showAlertError('interactionsRangeError', '');
});
// Editing either field by hand after picking a preset makes the preset label stale, so drop back
// to "Custom range" rather than keep showing a preset name that no longer matches the values.
['interactionsFrom', 'interactionsTo'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById('interactionsRangePreset').value = '';
  });
});

// Genesys rejects this query outright if the interval exceeds 31 days ("You must specify a
// search interval as part of your query that does not exceed 31 days") -- confirmed live, so the
// From/To inputs are validated against that cap client-side before the request is even sent,
// rather than always relying on the server round-trip to catch it.
function interactionsIntervalFromInputs() {
  const fromVal = document.getElementById('interactionsFrom').value;
  const toVal = document.getElementById('interactionsTo').value;
  if (!fromVal || !toVal) return { ok: false, error: 'Both From and To dates are required.' };
  const from = new Date(fromVal);
  const to = new Date(toVal);
  if (from >= to) return { ok: false, error: 'The From date must be before the To date.' };
  const spanDays = (to - from) / (24 * 3600 * 1000);
  if (spanDays > 31) return { ok: false, error: `That range spans ${Math.ceil(spanDays)} days — Genesys caps this query at 31 days.` };
  return { ok: true, interval: `${from.toISOString()}/${to.toISOString()}` };
}

async function loadActiveInteractions() {
  const queueIds = getSelectedInteractionQueueIds();
  if (!queueIds.length) { showToast('Select at least one queue first.', true); return; }

  showAlertError('interactionsError', '');
  showAlertError('interactionsRangeError', '');
  const rangeResult = interactionsIntervalFromInputs();
  if (!rangeResult.ok) { showAlertError('interactionsRangeError', rangeResult.error); return; }

  document.getElementById('interactionsResults').innerHTML = '';
  selectedInteractionIds.clear();
  currentInteractions = [];
  renderInteractionsTable();

  const btn = document.getElementById('interactionsLoadBtn');
  await withBusy(btn, 'Loading…', async () => {
    const body = {
      interval: rangeResult.interval,
      order: 'desc',
      orderBy: 'conversationStart',
      paging: { pageSize: 100, pageNumber: 1 },
      // queueId is a segment-level dimension, not a conversation-level one (a conversation can
      // touch more than one queue across transfers) -- confirmed live: the API rejects it under
      // conversationFilters with "not valid for field type [ConversationDetailDimension]".
      segmentFilters: [
        {
          type: 'or',
          predicates: queueIds.map((id) => ({ type: 'dimension', dimension: 'queueId', operator: 'matches', value: id })),
        },
      ],
    };
    try {
      const data = await proxy('POST', '/api/v2/analytics/conversations/details/query', { body });
      const queueNameById = {};
      interactionQueuesResource.state.items.forEach((q) => { queueNameById[q.id] = q.name; });
      currentInteractions = (data.conversations || [])
        .filter((c) => !c.conversationEnd) // still in progress — the query also returns recently-ended ones
        .map((c) => extractInteractionFromAnalyticsConversation(c, queueIds, queueNameById));
      renderInteractionsTable();
    } catch (err) {
      showAlertError('interactionsError', err.message);
    }
  });
}

function renderInteractionsTable() {
  const body = document.getElementById('interactionsTableBody');
  body.innerHTML = '';
  document.getElementById('interactionsEmpty').classList.toggle('hidden', currentInteractions.length > 0);

  const liveBadge = document.getElementById('interactionsLiveBadge');
  liveBadge.classList.toggle('hidden', currentInteractions.length === 0);
  document.getElementById('interactionsLiveCount').textContent = `${currentInteractions.length} live`;

  currentInteractions.forEach((it) => {
    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = selectedInteractionIds.has(it.conversationId);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedInteractionIds.add(it.conversationId); else selectedInteractionIds.delete(it.conversationId);
      updateInteractionsBulkButtons();
    });

    const disconnectBtn = el('span', { class: 'row-delete', text: 'Disconnect' });
    disconnectBtn.addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Disconnect interaction',
        message: `Disconnect this ${interactionMediaText(it.mediaTypes)} interaction on "${it.queueName}" right now? This immediately drops the live interaction and cannot be undone.`,
        confirmLabel: 'Disconnect',
      });
      if (!ok) return;
      await runInteractionDisconnect([it], disconnectBtn, 'Disconnecting…');
    });

    body.appendChild(
      gridRow('auto 1.5fr .9fr 1.7fr 1fr auto', [
        checkbox,
        cellText(it.queueName, 'name'),
        cellText(interactionMediaText(it.mediaTypes), 'muted'),
        cellText(it.participantSummary, 'muted'),
        cellText(relativeTimeFrom(it.startedAt), 'muted'),
        disconnectBtn,
      ])
    );
  });

  updateInteractionsBulkButtons();
}

function updateInteractionsBulkButtons() {
  const selBtn = document.getElementById('interactionsDisconnectSelectedBtn');
  const allBtn = document.getElementById('interactionsDisconnectAllBtn');
  selBtn.classList.toggle('hidden', selectedInteractionIds.size === 0);
  selBtn.textContent = `Disconnect selected (${selectedInteractionIds.size})`;
  allBtn.classList.toggle('hidden', currentInteractions.length === 0);
  allBtn.textContent = `Disconnect ALL on selected queue(s) (${currentInteractions.length})`;
}

// Disconnects every participant of each given interaction. Media-agnostic: the same participant
// PATCH endpoint handles calls, chats, emails, messages and callbacks alike.
async function disconnectInteractions(list) {
  const results = [];
  for (const item of list) {
    try {
      if (!item.participantIds.length) throw new Error('no participants found for this interaction');
      for (const participantId of item.participantIds) {
        await proxy('PATCH', `/api/v2/conversations/${item.conversationId}/participants/${participantId}`, { body: { state: 'disconnected' } });
      }
      results.push({ ok: true, label: item.label, conversationId: item.conversationId });
    } catch (err) {
      results.push({ ok: false, label: item.label, message: err.message, conversationId: item.conversationId });
    }
  }
  return results;
}

async function runInteractionDisconnect(items, busyEl, busyLabel) {
  await withBusy(busyEl, busyLabel, async () => {
    const results = await disconnectInteractions(
      items.map((it) => ({ conversationId: it.conversationId, participantIds: it.participantIds, label: `${it.queueName} (${interactionMediaText(it.mediaTypes)})` }))
    );
    renderBulkResults('interactionsResults', results);
    const succeededIds = new Set(results.filter((r) => r.ok).map((r) => r.conversationId));
    currentInteractions = currentInteractions.filter((it) => !succeededIds.has(it.conversationId));
    succeededIds.forEach((id) => selectedInteractionIds.delete(id));
    renderInteractionsTable();
    const okCount = results.filter((r) => r.ok).length;
    showToast(`${okCount} of ${results.length} interaction(s) disconnected.`, okCount < results.length);
  });
}

document.getElementById('interactionQueuesRefreshBtn').addEventListener('click', () => {
  interactionQueuesResource.reset().catch((err) => showToast(err.message, true));
});

document.getElementById('interactionsLoadBtn').addEventListener('click', () => {
  loadActiveInteractions();
});

document.getElementById('interactionsDisconnectSelectedBtn').addEventListener('click', async () => {
  const items = currentInteractions.filter((it) => selectedInteractionIds.has(it.conversationId));
  if (!items.length) return;
  const ok = await confirmModal({
    title: `Disconnect ${items.length} interaction${items.length === 1 ? '' : 's'}`,
    message: `Disconnect ${items.length} selected interaction(s) right now? This immediately drops live interactions and cannot be undone.`,
    confirmLabel: 'Disconnect',
  });
  if (!ok) return;
  await runInteractionDisconnect(items, document.getElementById('interactionsDisconnectSelectedBtn'), 'Disconnecting…');
});

document.getElementById('interactionsDisconnectAllBtn').addEventListener('click', async () => {
  if (!currentInteractions.length) return;
  const queueNames = getSelectedInteractionQueueNames().join(', ') || 'the selected queue(s)';
  const items = currentInteractions.slice();
  const ok = await confirmModal({
    title: `Disconnect ALL ${items.length} interactions`,
    message: `Disconnect ALL ${items.length} currently active interaction(s) on ${queueNames}? This immediately drops every one of them and cannot be undone.`,
    confirmLabel: `Disconnect all ${items.length}`,
  });
  if (!ok) return;
  await runInteractionDisconnect(items, document.getElementById('interactionsDisconnectAllBtn'), 'Disconnecting…');
});

// ---- Users & Divisions ----------------------------------------------

let selectedDivisionFilter = ''; // division id, or '' for all

const selectedUserIds = new Set();
let usersVisibleIds = [];

function renderUsersBulkBar() {
  const ids = [...selectedUserIds];
  document.getElementById('usersBulkBar').classList.toggle('hidden', ids.length === 0);
  document.getElementById('usersBulkCount').textContent = `${ids.length} selected`;
  document.getElementById('usersSelectAll').checked =
    usersVisibleIds.length > 0 && usersVisibleIds.every((id) => selectedUserIds.has(id));
}

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
    usersVisibleIds = filtered.map((u) => u.id);
    renderUsersBulkBar();
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

    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = selectedUserIds.has(user.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedUserIds.add(user.id);
      else selectedUserIds.delete(user.id);
      renderUsersBulkBar();
    });

    return gridRow('auto 1.4fr 1.8fr 1.2fr .8fr', [
      checkbox,
      el('div', {}, [nameLink]),
      cellText(user.email, 'muted'),
      cellText(user.title || '—', 'muted'),
      badge,
    ]);
  },
});

document.getElementById('usersSelectAll').addEventListener('change', (e) => {
  if (e.target.checked) usersVisibleIds.forEach((id) => selectedUserIds.add(id));
  else usersVisibleIds.forEach((id) => selectedUserIds.delete(id));
  usersResource.render();
});
document.getElementById('usersClearSelectedBtn').addEventListener('click', () => {
  selectedUserIds.clear();
  usersResource.render();
});

// ---- Bulk edit user emails -------------------------------------------------
// Two independent modes, since every user needs a distinct email so there's no single "target
// value" to apply to a whole selection the way the Queue SLA/Default Scripts editors do:
//  - Domain: applies to whatever's currently checked in the list, swapping the domain half of
//    each user's current email. Users whose current email doesn't end in the given old domain
//    are left out and called out in the preview, never guessed at.
//  - Mapping list: fully independent of the checkbox selection -- each line names its own old
//    email, which is resolved against the *entire* user directory (fetched fresh, not just
//    whatever's paginated in on screen) rather than only the checked rows.
// Both modes funnel into the same validated {user, newEmail} list and the same Apply/PATCH loop,
// and both require an explicit Preview before Apply is even enabled, so nothing is ever sent to
// Genesys without being reviewed first. Updates the profile `email` field on the Genesys User
// resource; the login `username` is a separate, untouched field.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let usersEmailMode = 'domain'; // 'domain' | 'mapping'
let usersEmailPendingChanges = null; // [{ user, newEmail }] set by Preview, consumed by Apply

function setUsersEmailMode(mode) {
  usersEmailMode = mode;
  document.getElementById('usersEmailDomainView').classList.toggle('hidden', mode !== 'domain');
  document.getElementById('usersEmailMappingView').classList.toggle('hidden', mode !== 'mapping');
  document.querySelectorAll('#usersEmailModeSegment .segment').forEach((seg) => seg.classList.toggle('active', seg.dataset.mode === mode));
  showError('usersEmailModalError', '');
  usersEmailPendingChanges = null;
}

function openUsersEmailModal() {
  document.getElementById('usersEmailResults').innerHTML = '';
  document.getElementById('usersEmailDomainPreview').innerHTML = '';
  document.getElementById('usersEmailMappingPreview').innerHTML = '';
  document.getElementById('usersEmailOldDomain').value = '';
  document.getElementById('usersEmailNewDomain').value = '';
  document.getElementById('usersEmailMappingText').value = '';
  usersEmailPendingChanges = null;
  showError('usersEmailModalError', '');

  const selectedCount = selectedUserIds.size;
  document.getElementById('usersEmailDomainSelectionNote').textContent = selectedCount
    ? `Applies to the ${selectedCount} user${selectedCount === 1 ? '' : 's'} currently selected in the list below.`
    : 'Select one or more users in the list below first, then reopen this to change their domain — or switch to Mapping list, which doesn\'t need a selection.';

  setUsersEmailMode(selectedCount ? 'domain' : 'mapping');
  document.getElementById('usersEmailModalOverlay').classList.remove('hidden');
}

// Shared by both modes: validates every {user, newEmail} pair, drops any that are unchanged from
// the user's current email (silently -- not an error, just nothing to do), and catches two
// entries landing on the same new email before it ever reaches Genesys.
function finalizeEmailChanges(rawChanges) {
  const changes = [];
  const seen = new Map(); // lowercased new email -> user name
  for (const { user, newEmail } of rawChanges) {
    const value = (newEmail || '').trim();
    if (!value) continue;
    if (!EMAIL_PATTERN.test(value)) return { ok: false, error: `${user.name}: "${value}" doesn't look like a valid email.` };
    if (value.toLowerCase() === (user.email || '').toLowerCase()) continue; // unchanged, skip
    const key = value.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `"${value}" would be set for both ${seen.get(key)} and ${user.name} — each user needs a distinct email.` };
    seen.set(key, user.name);
    changes.push({ user, newEmail: value });
  }
  return { ok: true, changes };
}

function renderUsersEmailPreviewTable(container, headers, rows) {
  container.innerHTML = '';
  const table = el('table', { class: 'sla-review-table' });
  table.appendChild(el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]));
  const tbody = el('tbody');
  rows.forEach((cells) => tbody.appendChild(el('tr', {}, cells.map((c) => el('td', { text: c })))));
  table.appendChild(tbody);
  container.appendChild(table);
}

// ---- Domain mode ----

function previewUsersEmailDomainChange() {
  showError('usersEmailModalError', '');
  usersEmailPendingChanges = null;
  const ids = [...selectedUserIds];
  const users = usersResource.state.items.filter((u) => ids.includes(u.id));
  const oldDomain = document.getElementById('usersEmailOldDomain').value.trim().replace(/^@/, '').toLowerCase();
  const newDomain = document.getElementById('usersEmailNewDomain').value.trim().replace(/^@/, '').toLowerCase();

  if (!users.length) return showError('usersEmailModalError', 'Select one or more users in the list first.');
  if (!oldDomain || !newDomain) return showError('usersEmailModalError', 'Enter both the old and new domain.');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(newDomain)) return showError('usersEmailModalError', `"${newDomain}" doesn't look like a valid domain.`);

  const rawChanges = [];
  const rows = [];
  users.forEach((user) => {
    const email = user.email || '';
    const at = email.lastIndexOf('@');
    const domain = at === -1 ? '' : email.slice(at + 1).toLowerCase();
    if (domain !== oldDomain) {
      rows.push([user.name, email || '—', 'doesn\'t match — skipped']);
      return;
    }
    const newEmail = `${email.slice(0, at)}@${newDomain}`;
    rows.push([user.name, email, newEmail]);
    rawChanges.push({ user, newEmail });
  });

  renderUsersEmailPreviewTable(document.getElementById('usersEmailDomainPreview'), ['Name', 'Current email', 'New email'], rows);

  const result = finalizeEmailChanges(rawChanges);
  if (!result.ok) return showError('usersEmailModalError', result.error);
  if (!result.changes.length) return showError('usersEmailModalError', 'No users match that domain, or all matches are already up to date.');
  usersEmailPendingChanges = result.changes;
}

// ---- Mapping list mode ----

function parseEmailMappingLine(line) {
  const normalized = line.replace(/=>|->/g, ',').replace(/\s*,\s*/g, ',');
  const parts = normalized.split(/[,\s]+/).filter(Boolean);
  return { oldEmail: parts[0] || '', newEmail: parts[1] || '' };
}

function parseEmailMappingText(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => Object.assign({ raw: line }, parseEmailMappingLine(line)));
}

// Fetches the full user directory (every page, not just what's already loaded on screen) so a
// mapping line can resolve against any user in the org regardless of what's been paginated in.
async function fetchAllUsersForLookup() {
  const all = [];
  let pageNumber = 1;
  const pageSize = 200;
  const maxPages = 50;
  let total = Infinity;
  while ((pageNumber - 1) * pageSize < total && pageNumber <= maxPages) {
    const data = await proxy('GET', '/api/v2/users', { query: { pageNumber, pageSize } });
    total = data.total || 0;
    all.push(...(data.entities || []));
    if (!data.entities || !data.entities.length) break;
    pageNumber += 1;
  }
  return all;
}

async function previewUsersEmailMapping() {
  showError('usersEmailModalError', '');
  usersEmailPendingChanges = null;
  const entries = parseEmailMappingText(document.getElementById('usersEmailMappingText').value);
  const previewEl = document.getElementById('usersEmailMappingPreview');
  previewEl.innerHTML = '';
  if (!entries.length) return showError('usersEmailModalError', 'Paste or upload at least one mapping.');

  const btn = document.getElementById('usersEmailMappingPreviewBtn');
  await withBusy(btn, 'Matching…', async () => {
    let allUsers;
    try {
      allUsers = await fetchAllUsersForLookup();
    } catch (err) {
      showError('usersEmailModalError', `Could not load the user directory: ${err.message}`);
      return;
    }
    const byEmail = new Map(allUsers.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));

    const rawChanges = [];
    const rows = [];
    entries.forEach(({ raw, oldEmail, newEmail }) => {
      if (!oldEmail || !newEmail) {
        rows.push([raw, 'could not parse this line', '—']);
        return;
      }
      const user = byEmail.get(oldEmail.toLowerCase());
      if (!user) {
        rows.push([oldEmail, 'no user found with this email', '—']);
        return;
      }
      rows.push([oldEmail, user.name, newEmail]);
      rawChanges.push({ user, newEmail });
    });

    renderUsersEmailPreviewTable(previewEl, ['Old email', 'Matched user', 'New email'], rows);

    const result = finalizeEmailChanges(rawChanges);
    if (!result.ok) return showError('usersEmailModalError', result.error);
    if (!result.changes.length) return showError('usersEmailModalError', 'Nothing to apply — no lines matched a user with a different email.');
    usersEmailPendingChanges = result.changes;
  });
}

// ---- Shared wiring ----

document.getElementById('usersBulkEditEmailsBtn').addEventListener('click', openUsersEmailModal);
document.querySelectorAll('#usersEmailModeSegment .segment').forEach((seg) => {
  seg.addEventListener('click', () => setUsersEmailMode(seg.dataset.mode));
});
document.getElementById('usersEmailDomainPreviewBtn').addEventListener('click', previewUsersEmailDomainChange);
document.getElementById('usersEmailMappingPreviewBtn').addEventListener('click', previewUsersEmailMapping);
document.getElementById('usersEmailMappingUploadBtn').addEventListener('click', () => document.getElementById('usersEmailMappingFile').click());
document.getElementById('usersEmailMappingFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  document.getElementById('usersEmailMappingText').value = await file.text();
});
document.getElementById('usersEmailModalCancelBtn').addEventListener('click', () => document.getElementById('usersEmailModalOverlay').classList.add('hidden'));
document.getElementById('usersEmailModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'usersEmailModalOverlay') document.getElementById('usersEmailModalOverlay').classList.add('hidden');
});

document.getElementById('usersEmailModalApplyBtn').addEventListener('click', async () => {
  if (!usersEmailPendingChanges || !usersEmailPendingChanges.length) {
    showError('usersEmailModalError', 'Nothing to apply yet — run Preview first.');
    return;
  }
  const count = usersEmailPendingChanges.length;
  const ok = await confirmModal({
    title: `Update ${count} user email${count === 1 ? '' : 's'}`,
    message: `Change the profile email for ${count} user(s)? This does not affect their login username.`,
    confirmLabel: 'Update',
    danger: false,
  });
  if (!ok) return;

  const btn = document.getElementById('usersEmailModalApplyBtn');
  await withBusy(btn, 'Saving…', async () => {
    const results = [];
    for (const change of usersEmailPendingChanges) {
      try {
        await proxy('PATCH', `/api/v2/users/${change.user.id}`, { body: { email: change.newEmail } });
        const idx = usersResource.state.items.findIndex((u) => u.id === change.user.id);
        if (idx !== -1) usersResource.state.items[idx] = Object.assign({}, usersResource.state.items[idx], { email: change.newEmail });
        results.push({ ok: true, label: `${change.user.name} → ${change.newEmail}` });
      } catch (err) {
        results.push({ ok: false, label: change.user.name, message: err.message });
      }
    }
    renderBulkResults('usersEmailResults', results);
    const okCount = results.filter((r) => r.ok).length;
    showToast(`${okCount} of ${results.length} email(s) updated.`, okCount < results.length);
    if (okCount) {
      usersResource.render();
      usersEmailPendingChanges = null;
    }
  });
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
  showAlertError('explorerError', '');
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
    showAlertError('explorerError', `Invalid JSON: ${err.message}`);
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

    if (!resp.ok) showAlertError('explorerError', (parsed && parsed.error) || 'Request failed.');

    saveExplorerHistory([{ method, path: apiPath, query: queryRaw, body: bodyRaw, status: resp.status, timeMs: elapsedMs, at: Date.now() }, ...loadExplorerHistory()]);
  } catch (err) {
    showAlertError('explorerError', err.message);
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

function architectListRow({ title, sub, badges, onDelete, extraActions, checkbox }) {
  const mainChildren = [el('div', { class: 'list-row-title', text: title })];
  if (sub) mainChildren.push(el('div', { class: 'list-row-sub', text: sub }));
  if (badges && badges.length) {
    mainChildren.push(el('div', { class: 'prompt-lang-badges' }, badges.map((b) => el('span', { class: 'prompt-lang-badge', text: b }))));
  }
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

// Type filter is a plain dropdown rather than hardcoding Genesys's flow-type enum here: the
// options are derived from whatever's actually been loaded, so the list can never go stale as
// Genesys adds new flow types over time. Runs client-side over already-loaded flows, same as the
// name filter — only types seen so far are offered (see the hint text next to it in the markup).
function renderArchitectFlowTypeOptions() {
  const select = document.getElementById('architectFlowsTypeFilter');
  const current = select.value;
  const types = [...new Set(architectFlowsState.items.map((f) => f.type).filter(Boolean))].sort();
  select.innerHTML = '';
  select.appendChild(el('option', { value: '', text: 'All types' }));
  types.forEach((type) => select.appendChild(el('option', { value: type, text: type })));
  select.value = types.includes(current) ? current : '';
}

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
  const activeType = document.getElementById('architectFlowsTypeFilter').value;
  const filtered = architectFlowsState.items.filter((flow) => {
    if (filterText && !(flow.name || '').toLowerCase().includes(filterText)) return false;
    if (activeType && flow.type !== activeType) return false;
    return true;
  });
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
  renderArchitectFlowTypeOptions(); // newly-loaded flows may introduce types not seen before
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
document.getElementById('architectFlowsTypeFilter').addEventListener('change', renderArchitectFlows);

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
const selectedPromptLanguageFilters = new Set();
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

  // Language filter runs client-side over whatever's already loaded (resources come bundled with
  // the list fetch via includeResources=true) — a prompt matches if it has ANY selected language.
  const activeLangs = selectedPromptLanguageFilters;
  const filtered = architectPromptsState.items.filter((prompt) => {
    if (!activeLangs.size) return true;
    return (prompt.resources || []).some((r) => activeLangs.has(r.language));
  });
  architectPromptsVisibleIds = filtered.map((p) => p.id);

  filtered.forEach((prompt) => {
    const langCodes = (prompt.resources || []).map((r) => PROMPT_LANGUAGE_LABELS[r.language] || r.language);
    container.appendChild(
      architectListRow({
        title: prompt.name,
        sub: prompt.description || '',
        badges: langCodes,
        checkbox: { checked: selectedPromptIds.has(prompt.id), onChange: (checked) => togglePromptSelection(prompt.id, checked) },
        extraActions: [
          { label: 'Languages', onclick: () => openPromptLanguagesModal(prompt) },
          { label: 'Export', onclick: () => exportPrompt(prompt) },
        ],
        onDelete: () => deleteArchitectPrompt(prompt),
      })
    );
  });
  document.getElementById('architectPromptsEmpty').classList.toggle('hidden', filtered.length > 0);
  document.getElementById('architectPromptsLoadMoreBtn').classList.toggle('hidden', architectPromptsState.items.length >= architectPromptsState.total);
  renderArchitectPromptsBulkBar();
}

async function fetchArchitectPromptsPage(pageNumber) {
  // includeResources so the list can show each prompt's languages and filter by them client-side
  // without a extra round trip per prompt.
  const data = await architectApi('GET', `/prompts${architectQueryString({ pageNumber, pageSize: 25, includeResources: true })}`);
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
    const fetched = await Promise.allSettled(ids.map((id) => fetchPromptWithResources(id)));
    const prompts = fetched.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const fetchFailedCount = fetched.length - prompts.length;
    const results = await downloadPromptsAsAudio(prompts, 'prompts-selected');
    const { message, isError } = summarizeAudioExport(results, 'prompt');
    showToast(fetchFailedCount ? `${message} (${fetchFailedCount} prompt(s) couldn't be loaded.)` : message, isError || !!fetchFailedCount);
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

// Language filter is a set of toggle chips (multi-select) rather than a native <select multiple> —
// no modifier-key discovery problem, and it runs client-side over already-loaded prompts (their
// resources come bundled in via includeResources=true) rather than round-tripping per change.
function renderPromptLanguageChips() {
  const container = document.getElementById('architectPromptsLanguageChips');
  container.innerHTML = '';
  PROMPT_LANGUAGES.forEach(([code, label]) => {
    const chip = el('button', {
      type: 'button',
      class: `lang-chip${selectedPromptLanguageFilters.has(code) ? ' active' : ''}`,
      text: label,
    });
    chip.addEventListener('click', () => {
      if (selectedPromptLanguageFilters.has(code)) selectedPromptLanguageFilters.delete(code);
      else selectedPromptLanguageFilters.add(code);
      renderPromptLanguageChips();
      updatePromptLanguageFilterToggleLabel();
      renderArchitectPrompts();
    });
    container.appendChild(chip);
  });
}

function updatePromptLanguageFilterToggleLabel() {
  const count = selectedPromptLanguageFilters.size;
  document.getElementById('architectPromptsLanguageFilterToggle').textContent = count ? `Filter by language (${count})` : 'Filter by language';
  document.getElementById('architectPromptsLanguageFilterClearBtn').classList.toggle('hidden', count === 0);
}

renderPromptLanguageChips();

document.getElementById('architectPromptsLanguageFilterToggle').addEventListener('click', () => {
  const chips = document.getElementById('architectPromptsLanguageChips');
  const hint = document.getElementById('architectPromptsLanguageFilterHint');
  const nowHidden = chips.classList.toggle('hidden');
  hint.classList.toggle('hidden', nowHidden);
});

document.getElementById('architectPromptsLanguageFilterClearBtn').addEventListener('click', () => {
  selectedPromptLanguageFilters.clear();
  renderPromptLanguageChips();
  updatePromptLanguageFilterToggleLabel();
  renderArchitectPrompts();
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

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// One item downloads directly as its own .json, unmodified; two or more stay as separate files
// but are bundled into a single .zip via the generic /api/zip endpoint (built server-side with
// archiver — the browser has no built-in way to zip several files together), so selecting many
// items produces one download instead of one per file.
async function downloadJsonAsZipOrSingle(items, zipFilename) {
  if (!items.length) return;
  if (items.length === 1) {
    downloadJson(items[0].filename, items[0].data);
    return;
  }
  const resp = await fetch('/api/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zipFilename,
      files: items.map((it) => ({ name: it.filename, content: JSON.stringify(it.data, null, 2) })),
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${resp.status})`);
  }
  const blob = await resp.blob();
  downloadBlob(`${(zipFilename || 'export').replace(/[^a-z0-9-]+/gi, '_')}.zip`, blob);
}


async function fetchPromptWithResources(promptId) {
  return architectApi('GET', `/prompts/${encodeURIComponent(promptId)}${architectQueryString({ includeResources: true })}`);
}

// Downloads the actual audio file Genesys Cloud has for one prompt/language — the same file its
// own "download" action gives you, not a JSON re-export. Throws with the server's real reason
// (e.g. "no audio available yet") rather than silently producing an empty/corrupt file.
async function downloadPromptLanguageAudio(promptId, language, filenameBase) {
  const resp = await fetch(`/api/architect/prompts/${encodeURIComponent(promptId)}/resources/${encodeURIComponent(language)}/audio`);
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${resp.status})`);
  }
  const blob = await resp.blob();
  downloadBlob(`${filenameBase}_${language}.wav`, blob);
}

// Headers can only hold ASCII, so the server base64-encodes the UTF-8 bytes of the results JSON
// (X-Export-Results) — plain atob() would mangle any non-ASCII prompt name (Arabic, etc.) since
// it treats each decoded byte as one character rather than reassembling UTF-8 sequences.
function decodeBase64Utf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Shared by single/bulk/export-all. One file downloads directly; two or more are bundled into a
// single .zip built server-side, so selecting many prompts produces one download instead of one
// per file — both for practicality and because back-to-back programmatic downloads trigger the
// browser's own "this site is trying to download multiple files" prompt.
async function downloadPromptsAsAudio(prompts, zipFilename) {
  const results = [];
  const items = [];
  prompts.forEach((prompt) => {
    const languages = (prompt.resources || []).map((r) => r.language).filter(Boolean);
    if (!languages.length) {
      results.push({ ok: false, label: prompt.name, message: 'no language resources on this prompt' });
      return;
    }
    languages.forEach((language) => items.push({ promptId: prompt.id, promptName: prompt.name, language }));
  });
  if (!items.length) return results;

  if (items.length === 1) {
    const only = items[0];
    try {
      await downloadPromptLanguageAudio(only.promptId, only.language, only.promptName.replace(/[^a-z0-9-]+/gi, '_'));
      results.push({ ok: true, label: `${only.promptName} (${only.language})` });
    } catch (err) {
      results.push({ ok: false, label: `${only.promptName} (${only.language})`, message: err.message });
    }
    return results;
  }

  const resp = await fetch('/api/architect/prompts/audio-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, zipFilename: zipFilename || 'prompts-audio' }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    if (Array.isArray(data.results)) return results.concat(data.results);
    results.push({ ok: false, label: `${items.length} file(s)`, message: data.error || `Request failed (${resp.status})` });
    return results;
  }

  const resultsHeader = resp.headers.get('X-Export-Results');
  if (resultsHeader) {
    try {
      results.push(...JSON.parse(decodeBase64Utf8(resultsHeader)));
    } catch {
      // The zip itself still downloads below even if the per-file summary can't be read.
    }
  }
  const blob = await resp.blob();
  downloadBlob(`${(zipFilename || 'prompts-audio').replace(/[^a-z0-9-]+/gi, '_')}.zip`, blob);
  return results;
}

function summarizeAudioExport(results, singularNoun) {
  const okCount = results.filter((r) => r.ok).length;
  if (!results.length) return { message: `No ${singularNoun}s to export.`, isError: true };
  if (!okCount) return { message: `No audio files could be downloaded — none of the selected ${singularNoun}s have rendered audio yet.`, isError: true };
  const failed = results.length - okCount;
  return {
    message: failed
      ? `Downloaded ${okCount} of ${results.length} audio file(s) (${failed} language(s) had no audio available).`
      : `Downloaded ${okCount} audio file${okCount === 1 ? '' : 's'}.`,
    isError: !!failed,
  };
}

async function exportPrompt(prompt) {
  try {
    const full = await fetchPromptWithResources(prompt.id);
    const results = await downloadPromptsAsAudio([full], full.name);
    const { message, isError } = summarizeAudioExport(results, 'language');
    showToast(message, isError);
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
      const results = await downloadPromptsAsAudio(all, 'prompts-all');
      const { message, isError } = summarizeAudioExport(results, 'prompt');
      showToast(message, isError);
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

// ---- Data Actions ----------------------------------------------------------
// Integrations -> Data Actions: reusable custom REST/function calls invoked from Architect flows.
// A data action belongs to a specific integration in this org, so its integrationId carries no
// meaning across orgs -- export includes the source integration's *name* purely for reference,
// and import always creates new actions attached to an integration picked in THIS org first. It
// never guesses a match or overwrites an existing action by name, same "always create" default as
// Evaluation Forms import, since a data action can be live in production flows right now.
// contract/config are round-tripped as opaque blobs (whatever GET returns is exactly what POST
// gets sent back) rather than reconstructed field-by-field, since their nested shape (JSON
// schemas, request/response templates) isn't something this app has verified in detail.

let allIntegrationsCache = []; // {id, name}

async function loadAllIntegrationsCache() {
  allIntegrationsCache = [];
  let pageNumber = 1;
  const pageSize = 100;
  const maxPages = 10;
  let total = Infinity;
  while ((pageNumber - 1) * pageSize < total && pageNumber <= maxPages) {
    const data = await proxy('GET', '/api/v2/integrations', { query: { pageNumber, pageSize } });
    total = data.total || 0;
    allIntegrationsCache = allIntegrationsCache.concat((data.entities || []).map((i) => ({ id: i.id, name: i.name || i.id })));
    pageNumber += 1;
  }
  allIntegrationsCache.sort((a, b) => a.name.localeCompare(b.name));
}

function renderDataActionsIntegrationOptions() {
  const select = document.getElementById('dataActionsIntegrationSelect');
  select.innerHTML = '';
  select.appendChild(el('option', { value: '', text: allIntegrationsCache.length ? 'Choose an integration…' : 'No integrations found in this org' }));
  allIntegrationsCache.forEach((i) => select.appendChild(el('option', { value: i.id, text: i.name })));
}

function integrationNameFor(id) {
  const found = allIntegrationsCache.find((i) => i.id === id);
  return found ? found.name : id || '—';
}

const selectedDataActionIds = new Set();
let dataActionsVisibleIds = [];

async function fetchFullDataAction(id) {
  return proxy('GET', `/api/v2/integrations/actions/${id}`, { query: { expand: 'contract,config.request,config.response' } });
}


function renderDataActionsBulkBar() {
  const ids = [...selectedDataActionIds];
  document.getElementById('dataActionsBulkBar').classList.toggle('hidden', ids.length === 0);
  document.getElementById('dataActionsBulkCount').textContent = `${ids.length} selected`;
  document.getElementById('dataActionsSelectAll').checked =
    dataActionsVisibleIds.length > 0 && dataActionsVisibleIds.every((id) => selectedDataActionIds.has(id));
}

const dataActionsResource = createListResource({
  path: '/api/v2/integrations/actions',
  pageSize: 50,
  containerId: 'dataActionsTableBody',
  filterId: 'dataActionsFilter',
  loadMoreId: 'dataActionsLoadMoreBtn',
  emptyId: 'dataActionsEmpty',
  errorId: 'dataActionsError',
  buildRow: (action) => {
    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = selectedDataActionIds.has(action.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedDataActionIds.add(action.id);
      else selectedDataActionIds.delete(action.id);
      renderDataActionsBulkBar();
    });

    const exportBtn = el('span', { class: 'row-edit', text: 'Export' });
    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        // Exported exactly as Genesys returns it (with expand=contract,config.request,config.response
        // so it's the full definition, not the list summary) -- no reshaping, same as Genesys's own
        // export of a data action.
        const full = await withBusy(exportBtn, 'Loading…', () => fetchFullDataAction(action.id));
        downloadJson(`data-action-${(full.name || 'action').replace(/[^a-z0-9-]+/gi, '_')}.json`, full);
        showToast(`Exported "${full.name}".`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    const del = el('span', { class: 'row-delete', text: 'Delete' });
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmModal({
        title: 'Delete data action',
        message: `Delete "${action.name}"? Any flow that calls it will start failing at that step. You'll have a few seconds to undo.`,
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: action.name,
        remove: () => {
          dataActionsResource.remove(action.id);
          selectedDataActionIds.delete(action.id);
          renderDataActionsBulkBar();
        },
        restore: () => {
          dataActionsResource.prepend(action);
          renderDataActionsBulkBar();
        },
        commit: () => proxy('DELETE', `/api/v2/integrations/actions/${action.id}`),
      });
    });

    return gridRow('auto 1.6fr 1fr 1.4fr .7fr auto', [
      checkbox,
      cellText(action.name, 'name'),
      cellText(action.category || '—', 'muted'),
      cellText(integrationNameFor(action.integrationId), 'muted'),
      cellText(action.secure ? 'Yes' : 'No', 'muted'),
      el('div', { class: 'row-actions' }, [exportBtn, del]),
    ]);
  },
  onRender: (filtered) => {
    dataActionsVisibleIds = filtered.map((a) => a.id);
    renderDataActionsBulkBar();
  },
});

async function loadDataActionsTab() {
  await Promise.all([dataActionsResource.reset(), loadAllIntegrationsCache()]);
  renderDataActionsIntegrationOptions();
}

document.getElementById('dataActionsRefreshBtn').addEventListener('click', () => {
  loadDataActionsTab().catch((err) => showToast(err.message, true));
});

document.getElementById('dataActionsSelectAll').addEventListener('change', (e) => {
  if (e.target.checked) dataActionsVisibleIds.forEach((id) => selectedDataActionIds.add(id));
  else dataActionsVisibleIds.forEach((id) => selectedDataActionIds.delete(id));
  dataActionsResource.render();
});

document.getElementById('dataActionsClearSelectedBtn').addEventListener('click', () => {
  selectedDataActionIds.clear();
  dataActionsResource.render();
});

// Each action stays its own file, exactly as Genesys returns it (no reshaping) -- one item
// downloads directly, several are zipped together so it's still one download, not one per file.
function dataActionExportItem(action) {
  return { filename: `data-action-${(action.name || 'action').replace(/[^a-z0-9-]+/gi, '_')}.json`, data: action };
}

document.getElementById('dataActionsExportSelectedBtn').addEventListener('click', async () => {
  const ids = [...selectedDataActionIds];
  if (!ids.length) return;
  const btn = document.getElementById('dataActionsExportSelectedBtn');
  await withBusy(btn, 'Exporting…', async () => {
    const results = await Promise.allSettled(ids.map((id) => fetchFullDataAction(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failedCount = results.length - ok.length;
    if (ok.length) await downloadJsonAsZipOrSingle(ok.map(dataActionExportItem), 'data-actions-selected');
    showToast(
      failedCount
        ? `Exported ${ok.length} of ${results.length} data action(s) (${failedCount} failed).`
        : `Exported ${ok.length} data action${ok.length === 1 ? '' : 's'}.`,
      !!failedCount
    );
  });
});

document.getElementById('dataActionsExportAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('dataActionsExportAllBtn');
  await withBusy(btn, 'Exporting…', async () => {
    try {
      // Walks every page independent of what's already loaded on screen, so "export all" really
      // means every data action in the org.
      const all = [];
      let pageNumber = 1;
      let total = Infinity;
      while (all.length < total) {
        const data = await proxy('GET', '/api/v2/integrations/actions', { query: { pageNumber, pageSize: 50 } });
        total = data.total || 0;
        all.push(...(data.entities || []));
        if (!data.entities || !data.entities.length) break;
        pageNumber += 1;
      }
      const results = await Promise.allSettled(all.map((a) => fetchFullDataAction(a.id)));
      const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      const failedCount = results.length - ok.length;
      if (ok.length) await downloadJsonAsZipOrSingle(ok.map(dataActionExportItem), 'data-actions-all');
      showToast(
        failedCount
          ? `Exported ${ok.length} of ${results.length} data action(s) (${failedCount} failed).`
          : `Exported ${ok.length} data action${ok.length === 1 ? '' : 's'}.`,
        !!failedCount
      );
    } catch (err) {
      showToast(err.message, true);
    }
  });
});

document.getElementById('dataActionsDeleteSelectedBtn').addEventListener('click', async () => {
  const ids = [...selectedDataActionIds];
  if (!ids.length) return;
  const names = dataActionsResource.state.items.filter((a) => ids.includes(a.id)).map((a) => a.name);
  const count = ids.length;
  const listLabel = names.length <= 5 ? names.join(', ') : `${count} data actions`;

  const ok = await confirmModal({
    title: `Delete ${count} data action${count === 1 ? '' : 's'}`,
    message: `Delete ${listLabel}? Any flow that calls one of them will start failing at that step. You'll have a few seconds to undo before ${count === 1 ? 'it is' : 'they are'} actually removed.`,
  });
  if (!ok) return;

  const toDelete = dataActionsResource.state.items.filter((a) => ids.includes(a.id));
  showUndoableDelete({
    itemName: count === 1 ? names[0] : `${count} data actions`,
    remove: () => {
      ids.forEach((id) => {
        dataActionsResource.remove(id);
        selectedDataActionIds.delete(id);
      });
    },
    restore: () => {
      toDelete.forEach((a) => dataActionsResource.prepend(a));
    },
    commit: async () => {
      const results = await Promise.allSettled(ids.map((id) => proxy('DELETE', `/api/v2/integrations/actions/${id}`)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw new Error(`${failed.length} of ${count} could not be deleted`);
    },
  });
});

document.getElementById('dataActionsImportBtn').addEventListener('click', () => {
  const integrationId = document.getElementById('dataActionsIntegrationSelect').value;
  if (!integrationId) { showToast('Choose a target integration first.', true); return; }
  document.getElementById('dataActionsImportFile').click();
});

document.getElementById('dataActionsImportFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const integrationId = document.getElementById('dataActionsIntegrationSelect').value;
  if (!integrationId) { showToast('Choose a target integration first.', true); return; }

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showToast('That file is not valid JSON.', true);
    return;
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.length) { showToast('Nothing to import.', true); return; }

  const btn = document.getElementById('dataActionsImportBtn');
  await withBusy(btn, 'Importing…', async () => {
    const results = [];
    for (const item of items) {
      const label = (item && item.name) || '(unnamed)';
      if (!item || !item.name || !item.contract || !item.config) {
        results.push({ ok: false, label, message: 'missing "name", "contract", or "config"' });
        continue;
      }
      try {
        const created = await proxy('POST', '/api/v2/integrations/actions', {
          body: {
            name: item.name,
            category: item.category || 'Custom',
            secure: !!item.secure,
            integrationId,
            contract: item.contract,
            config: item.config,
          },
        });
        dataActionsResource.prepend(created);
        results.push({ ok: true, label: item.name });
      } catch (err) {
        results.push({ ok: false, label, message: err.message });
      }
    }
    renderBulkResults('dataActionsResults', results);
    const okCount = results.filter((r) => r.ok).length;
    showToast(`Imported ${okCount} of ${results.length} data action(s) into "${integrationNameFor(integrationId)}".`, okCount < results.length);
  });
});

// ---- Evaluation Forms ----------------------------------------------------
// Genesys Cloud Quality Management "evaluation form" = a scorecard of question groups, each
// holding multiple-choice questions with weighted answer options. Editing always re-fetches the
// full form by id first (never trusts the list row's own fields) so a stale/summary list response
// can never silently wipe a form's questions on save.

const evalFormsResource = createListResource({
  path: '/api/v2/quality/forms/evaluations',
  pageSize: 50,
  containerId: 'evalFormsTableBody',
  filterId: 'evalFormsFilter',
  loadMoreId: 'evalFormsLoadMoreBtn',
  emptyId: 'evalFormsEmpty',
  errorId: 'evalFormsError',
  buildRow: (form) => {
    // Genesys's list endpoint returns form summaries without `questionGroups` — only the
    // single-form GET (used by Edit/Export above) includes it. Showing "0" here would read as
    // "this form has no questions" when it's really just "the list didn't tell us"; show a
    // neutral placeholder instead and only print a count when we actually have one.
    const groupCount = Array.isArray(form.questionGroups) ? String(form.questionGroups.length) : '—';

    const editBtn = el('span', { class: 'row-edit', text: 'Edit' });
    editBtn.addEventListener('click', async () => {
      try {
        const full = await withBusy(editBtn, 'Loading…', () => proxy('GET', `/api/v2/quality/forms/evaluations/${form.id}`));
        openEvalFormBuilder(full);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    const exportBtn = el('span', { class: 'row-edit', text: 'Export' });
    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const full = await proxy('GET', `/api/v2/quality/forms/evaluations/${form.id}`);
        downloadJson(`eval-form-${(full.name || 'form').replace(/[^a-z0-9-]+/gi, '_')}.json`, evalFormExportShape(full));
        showToast(`Exported "${full.name}".`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    const del = el('span', { class: 'row-delete', text: 'Delete' });
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmModal({
        title: 'Delete evaluation form',
        message: `Delete "${form.name}"? You'll have a few seconds to undo before it's actually removed.`,
      });
      if (!ok) return;
      showUndoableDelete({
        itemName: form.name,
        remove: () => evalFormsResource.remove(form.id),
        restore: () => evalFormsResource.prepend(form),
        commit: () => proxy('DELETE', `/api/v2/quality/forms/evaluations/${form.id}`),
      });
    });

    return gridRow('1.6fr .8fr .8fr auto', [
      cellText(form.name, 'name'),
      cellText(form.published ? 'Published' : 'Draft', 'muted'),
      cellText(groupCount, 'muted'),
      el('div', { class: 'row-actions' }, [editBtn, exportBtn, del]),
    ]);
  },
});

function evalFormExportShape(form) {
  return {
    name: form.name,
    published: !!form.published,
    questionGroups: (form.questionGroups || []).map((g) => ({
      name: g.name || '',
      weight: g.weight != null ? g.weight : 1,
      naEnabled: !!g.naEnabled,
      questions: (g.questions || []).map((q) => ({
        text: q.text || '',
        helpText: q.helpText || '',
        naEnabled: !!q.naEnabled,
        commentsRequired: !!q.commentsRequired,
        isCritical: !!q.isCritical,
        isKill: !!q.isKill,
        answerOptions: (q.answerOptions || []).map((a) => ({ text: a.text || '', value: a.value != null ? a.value : 0 })),
      })),
    })),
  };
}

function newEvalQuestion() {
  return {
    text: '',
    helpText: '',
    naEnabled: false,
    commentsRequired: false,
    isCritical: false,
    isKill: false,
    answerOptions: [
      { text: 'No', value: 0 },
      { text: 'Yes', value: 1 },
    ],
  };
}

function newEvalGroup() {
  return { name: '', weight: 1, naEnabled: false, questions: [newEvalQuestion()] };
}

// Normalizes a Genesys EvaluationForm (or an imported/generated plain object with the same shape)
// into fresh builder-owned objects — never keeps a reference into data owned by evalFormsResource.
function normalizeEvalFormForBuilder(source) {
  return {
    id: (source && source.id) || null,
    name: (source && source.name) || '',
    published: !!(source && source.published),
    questionGroups: ((source && source.questionGroups) || []).map((g) => ({
      name: g.name || '',
      weight: g.weight != null ? g.weight : 1,
      naEnabled: !!g.naEnabled,
      questions: (g.questions || []).map((q) => ({
        text: q.text || '',
        helpText: q.helpText || '',
        naEnabled: !!q.naEnabled,
        commentsRequired: !!q.commentsRequired,
        isCritical: !!q.isCritical,
        isKill: !!q.isKill,
        answerOptions: (q.answerOptions && q.answerOptions.length ? q.answerOptions : [{ text: 'No', value: 0 }, { text: 'Yes', value: 1 }]).map((a) => ({
          text: a.text || '',
          value: a.value != null ? a.value : 0,
        })),
      })),
    })),
  };
}

function evalFormSavePayload(state) {
  return {
    name: state.name.trim(),
    published: state.published,
    questionGroups: state.questionGroups.map((g) => ({
      name: g.name.trim(),
      weight: g.weight,
      naEnabled: g.naEnabled,
      questions: g.questions.map((q) => ({
        text: q.text.trim(),
        helpText: q.helpText || '',
        type: 'multipleChoiceQuestion',
        naEnabled: q.naEnabled,
        commentsRequired: q.commentsRequired,
        isCritical: q.isCritical,
        isKill: q.isKill,
        answerOptions: q.answerOptions.map((a) => ({ text: a.text.trim(), value: a.value })),
      })),
    })),
  };
}

function validateEvalForm(state) {
  if (!state.name.trim()) return 'Form name is required.';
  if (!state.questionGroups.length) return 'Add at least one question group.';
  for (const g of state.questionGroups) {
    if (!g.name.trim()) return 'Every question group needs a name.';
    if (!g.questions.length) return `Group "${g.name}" needs at least one question.`;
    for (const q of g.questions) {
      if (!q.text.trim()) return `Every question in "${g.name}" needs text.`;
      if (!q.answerOptions.length || q.answerOptions.some((a) => !a.text.trim())) {
        return `Question "${q.text || '(untitled)'}" needs at least one labeled answer option.`;
      }
    }
  }
  return null;
}

let evalFormBuilderState = null;

function openEvalFormBuilder(existingForm) {
  evalFormBuilderState = normalizeEvalFormForBuilder(existingForm);
  document.getElementById('evalFormModalTitle').textContent = existingForm ? `Edit "${existingForm.name}"` : 'New evaluation form';
  document.getElementById('evalFormModalError').classList.add('hidden');
  renderEvalFormModal();
  document.getElementById('evalFormModalOverlay').classList.remove('hidden');
}

function renderEvalFormModal() {
  const body = document.getElementById('evalFormModalBody');
  body.innerHTML = '';

  body.appendChild(el('div', { class: 'field-label', text: 'Name' }));
  const nameInput = el('input', { type: 'text', class: 'text-input', placeholder: 'Form name', style: 'margin-bottom:10px' });
  nameInput.value = evalFormBuilderState.name;
  nameInput.addEventListener('input', () => {
    evalFormBuilderState.name = nameInput.value;
  });
  body.appendChild(nameInput);

  const publishedLabel = el('label', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:18px;font-size:12.5px;cursor:pointer' });
  const publishedCheckbox = el('input', { type: 'checkbox' });
  publishedCheckbox.checked = evalFormBuilderState.published;
  publishedCheckbox.addEventListener('change', () => {
    evalFormBuilderState.published = publishedCheckbox.checked;
  });
  publishedLabel.appendChild(publishedCheckbox);
  publishedLabel.appendChild(document.createTextNode('Published (evaluators can use it immediately; otherwise it stays a draft)'));
  body.appendChild(publishedLabel);

  // -- AI generate from criteria --
  const genCard = el('div', { class: 'card card-pad', style: 'margin-bottom:18px' });
  genCard.appendChild(el('div', { class: 'field-label', text: 'Generate from criteria (optional)' }));
  const criteriaInput = el('textarea', {
    class: 'text-input',
    rows: '3',
    style: 'margin-bottom:10px',
    placeholder:
      'e.g. Evaluate the greeting, active listening, whether the issue was resolved, and whether the required compliance disclosure was read.',
  });
  const genBtn = el('button', { class: 'btn btn-accent', text: 'Generate' });
  const genError = el('p', { class: 'field-inline-error hidden', style: 'margin-top:8px' });
  genBtn.addEventListener('click', async () => {
    genError.classList.add('hidden');
    const criteria = criteriaInput.value.trim();
    if (!criteria) {
      genError.textContent = 'Describe what should be evaluated first.';
      genError.classList.remove('hidden');
      return;
    }
    if (evalFormBuilderState.questionGroups.length) {
      const ok = await confirmModal({
        title: 'Replace existing questions?',
        message: 'This form already has question groups — generating from criteria replaces all of them. Continue?',
        confirmLabel: 'Replace',
        danger: false,
      });
      if (!ok) return;
    }
    try {
      await withBusy(genBtn, 'Generating…', async () => {
        const data = await architectApi('POST', '/generate-eval-form', { criteria });
        if (!evalFormBuilderState.name.trim() && data.form.name) {
          evalFormBuilderState.name = data.form.name;
          nameInput.value = data.form.name;
        }
        evalFormBuilderState.questionGroups = normalizeEvalFormForBuilder(data.form).questionGroups;
        renderEvalFormGroups();
        showToast(`Generated ${evalFormBuilderState.questionGroups.length} question group(s) — review before saving.`);
      });
    } catch (err) {
      genError.textContent = err.message;
      genError.classList.remove('hidden');
    }
  });
  genCard.appendChild(criteriaInput);
  genCard.appendChild(genBtn);
  genCard.appendChild(genError);
  body.appendChild(genCard);

  // -- question groups --
  body.appendChild(el('div', { class: 'field-label', text: 'Question groups' }));
  body.appendChild(el('div', { id: 'evalFormGroupsContainer' }));

  const addGroupBtn = el('button', { class: 'btn btn-subtle', text: '+ Add group', style: 'margin-top:6px' });
  addGroupBtn.addEventListener('click', () => {
    evalFormBuilderState.questionGroups.push(newEvalGroup());
    renderEvalFormGroups();
  });
  body.appendChild(addGroupBtn);

  renderEvalFormGroups();
}

// Rebuilds only the groups subtree — called after structural edits (add/remove group, question,
// or answer option) so text-field edits elsewhere in the modal never lose focus/cursor position.
function renderEvalFormGroups() {
  const container = document.getElementById('evalFormGroupsContainer');
  if (!container) return;
  container.innerHTML = '';
  evalFormBuilderState.questionGroups.forEach((group, gi) => {
    container.appendChild(buildEvalGroupCard(group, gi));
  });
}

function buildEvalGroupCard(group, gi) {
  const card = el('div', { class: 'eval-group-card' });

  const head = el('div', { class: 'eval-group-head' });
  const nameInput = el('input', { type: 'text', placeholder: `Group ${gi + 1} name` });
  nameInput.value = group.name;
  nameInput.addEventListener('input', () => {
    group.name = nameInput.value;
  });
  const weightWrap = el('label', { style: 'display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-faint);flex:none' });
  weightWrap.appendChild(document.createTextNode('Weight'));
  const weightInput = el('input', { type: 'number', step: '0.1', min: '0' });
  weightInput.value = group.weight;
  weightInput.addEventListener('input', () => {
    group.weight = parseFloat(weightInput.value) || 0;
  });
  weightWrap.appendChild(weightInput);
  const removeGroupBtn = el('button', { class: 'btn btn-subtle', text: 'Remove group' });
  removeGroupBtn.addEventListener('click', () => {
    evalFormBuilderState.questionGroups.splice(gi, 1);
    renderEvalFormGroups();
  });
  head.appendChild(nameInput);
  head.appendChild(weightWrap);
  head.appendChild(removeGroupBtn);
  card.appendChild(head);

  group.questions.forEach((question, qi) => {
    card.appendChild(buildEvalQuestionCard(group, question, qi));
  });

  const addQBtn = el('button', { class: 'btn btn-subtle', text: '+ Add question' });
  addQBtn.addEventListener('click', () => {
    group.questions.push(newEvalQuestion());
    renderEvalFormGroups();
  });
  card.appendChild(addQBtn);

  return card;
}

function buildEvalQuestionCard(group, question, qi) {
  const card = el('div', { class: 'eval-question-card' });

  const head = el('div', { class: 'eval-question-head' });
  const textArea = el('textarea', { rows: '2', class: 'text-input', placeholder: `Question ${qi + 1} text` });
  textArea.value = question.text;
  textArea.addEventListener('input', () => {
    question.text = textArea.value;
  });
  const removeQBtn = el('button', { class: 'btn btn-subtle', text: 'Remove' });
  removeQBtn.addEventListener('click', () => {
    group.questions.splice(qi, 1);
    renderEvalFormGroups();
  });
  head.appendChild(textArea);
  head.appendChild(removeQBtn);
  card.appendChild(head);

  const helpInput = el('input', { type: 'text', class: 'text-input', placeholder: 'Help text for evaluators (optional)', style: 'margin-bottom:2px' });
  helpInput.value = question.helpText;
  helpInput.addEventListener('input', () => {
    question.helpText = helpInput.value;
  });
  card.appendChild(helpInput);

  const flags = el('div', { class: 'eval-question-flags' });
  [
    ['naEnabled', 'N/A allowed'],
    ['commentsRequired', 'Comment required'],
    ['isCritical', 'Critical'],
    ['isKill', 'Auto-fail (kill question)'],
  ].forEach(([key, flagLabel]) => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !!question[key];
    cb.addEventListener('change', () => {
      question[key] = cb.checked;
    });
    const lbl = el('label', {}, [cb, document.createTextNode(flagLabel)]);
    flags.appendChild(lbl);
  });
  card.appendChild(flags);

  card.appendChild(el('div', { class: 'field-label', style: 'font-size:10.5px;margin:2px 0 4px', text: 'Answer options (worst → best)' }));
  question.answerOptions.forEach((option, oi) => {
    const row = el('div', { class: 'eval-answer-row' });
    const optText = el('input', { type: 'text', placeholder: 'Label' });
    optText.value = option.text;
    optText.addEventListener('input', () => {
      option.text = optText.value;
    });
    const optValue = el('input', { type: 'number' });
    optValue.value = option.value;
    optValue.addEventListener('input', () => {
      option.value = parseInt(optValue.value, 10) || 0;
    });
    const removeOptBtn = el('button', { class: 'btn btn-subtle', text: '×' });
    removeOptBtn.addEventListener('click', () => {
      question.answerOptions.splice(oi, 1);
      renderEvalFormGroups();
    });
    row.appendChild(optText);
    row.appendChild(optValue);
    row.appendChild(removeOptBtn);
    card.appendChild(row);
  });
  const addOptBtn = el('button', { class: 'btn btn-subtle', text: '+ Add option', style: 'margin-top:2px' });
  addOptBtn.addEventListener('click', () => {
    question.answerOptions.push({ text: '', value: 0 });
    renderEvalFormGroups();
  });
  card.appendChild(addOptBtn);

  return card;
}

document.getElementById('evalFormNewBtn').addEventListener('click', () => openEvalFormBuilder());

document.getElementById('evalFormModalCancelBtn').addEventListener('click', () => {
  document.getElementById('evalFormModalOverlay').classList.add('hidden');
});
document.getElementById('evalFormModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'evalFormModalOverlay') document.getElementById('evalFormModalOverlay').classList.add('hidden');
});

document.getElementById('evalFormExportBtn').addEventListener('click', () => {
  if (!evalFormBuilderState) return;
  const fname = (evalFormBuilderState.name || 'draft').replace(/[^a-z0-9-]+/gi, '_') || 'draft';
  downloadJson(`eval-form-${fname}.json`, evalFormSavePayload(evalFormBuilderState));
});

document.getElementById('evalFormModalSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('evalFormModalError');
  errEl.classList.add('hidden');
  const validationError = validateEvalForm(evalFormBuilderState);
  if (validationError) {
    errEl.textContent = validationError;
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('evalFormModalSaveBtn');
  const payload = evalFormSavePayload(evalFormBuilderState);
  try {
    await withBusy(btn, 'Saving…', async () => {
      let saved;
      if (evalFormBuilderState.id) {
        saved = await proxy('PUT', `/api/v2/quality/forms/evaluations/${evalFormBuilderState.id}`, { body: payload });
        evalFormsResource.remove(evalFormBuilderState.id);
      } else {
        saved = await proxy('POST', '/api/v2/quality/forms/evaluations', { body: payload });
      }
      evalFormsResource.prepend(saved);
      document.getElementById('evalFormModalOverlay').classList.add('hidden');
      showToast(`Saved "${saved.name}".`);
    });
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

// -- import (list-level: always creates new forms, never overwrites an existing one by name) --

document.getElementById('evalFormImportBtn').addEventListener('click', () => {
  document.getElementById('evalFormImportFile').click();
});

document.getElementById('evalFormImportFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const summaryEl = document.getElementById('evalFormsImportSummary');
  summaryEl.classList.add('hidden');
  showAlertError('evalFormsError', '');

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    return showAlertError('evalFormsError', `Not valid JSON: ${err.message}`);
  }
  const forms = Array.isArray(parsed) ? parsed : [parsed];
  if (!forms.length) return showAlertError('evalFormsError', 'File has no forms to import.');

  const btn = document.getElementById('evalFormImportBtn');
  await withBusy(btn, 'Importing…', async () => {
    const results = [];
    for (const item of forms) {
      const name = item && item.name && String(item.name).trim();
      if (!name) {
        results.push({ ok: false, label: '(unnamed)', message: 'missing "name"' });
        continue;
      }
      if (!Array.isArray(item.questionGroups) || !item.questionGroups.length) {
        results.push({ ok: false, label: name, message: 'missing "questionGroups"' });
        continue;
      }
      try {
        const payload = evalFormSavePayload(normalizeEvalFormForBuilder(item));
        const saved = await proxy('POST', '/api/v2/quality/forms/evaluations', { body: payload });
        evalFormsResource.prepend(saved);
        results.push({ ok: true, label: name });
      } catch (err) {
        results.push({ ok: false, label: name, message: err.message });
      }
    }
    summaryEl.classList.remove('hidden');
    renderBulkResults('evalFormsImportSummary', results);
    const okCount = results.filter((r) => r.ok).length;
    showToast(`Imported ${okCount} of ${results.length} form${results.length === 1 ? '' : 's'}.`, okCount < results.length);
  });
});

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
  showAlertError('auditError', '');
  const statusEl = document.getElementById('auditSearchStatus');
  const btn = document.getElementById('auditSearchBtn');

  let interval;
  try {
    interval = auditIntervalFromInputs();
  } catch (err) {
    return showAlertError('auditError', err.message);
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
      showAlertError('auditError', err.message);
    }
  });
}

document.getElementById('auditSearchBtn').addEventListener('click', runAuditSearch);
document.getElementById('auditLoadMoreBtn').addEventListener('click', () => {
  if (!auditState.transactionId || !auditState.cursor) return;
  fetchAuditResultsPage(auditState.transactionId, auditState.cursor).catch((err) => showAlertError('auditError', err.message));
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

// ---- Release Notes ----------------------------------------------------
// Static, hand-curated content (not fetched from Genesys) — mirrors this toolkit's own git
// history, newest first. Update this array when shipping something worth calling out.

const RELEASE_NOTES = [
  {
    date: '2026-08-19',
    title: 'Bulk edit emails for Users',
    items: [
      'New "Bulk edit emails…" entry point on the Users tab, with two modes since every user needs a distinct email.',
      'Change domain: applies to whichever users are checked in the list, swapping the domain half of each one\'s current email. Anyone whose current email doesn\'t match the given old domain is left out and called out in the preview.',
      'Mapping list: paste or upload old-email/new-email pairs (one per line) — independent of the checkbox selection, resolved against the full user directory rather than only what\'s loaded on screen.',
      'Both modes require an explicit Preview before Apply activates, validate for duplicate/invalid new emails, and update the profile email only — login username is untouched.',
    ],
  },
  {
    date: '2026-08-17',
    title: 'Prompts now export as audio, not JSON',
    items: [
      'Export (single prompt, selected, or all) now downloads the actual .wav audio file per language — the same file Genesys Cloud\'s own "download" action gives you — instead of a JSON file of TTS text.',
      'Exporting more than one file at once bundles everything into a single .zip built server-side, instead of one browser download per file.',
      'A prompt with no rendered audio yet for a given language is reported clearly rather than producing an empty or corrupt file.',
      'Import is unchanged and still reads the earlier JSON export shape, for moving prompts between orgs.',
    ],
  },
  {
    date: '2026-08-17',
    title: 'Bulk Default Scripts editor for Queues',
    items: [
      'New "Edit Default Scripts…" button alongside the SLA editor: pick a default Script per media type and apply it across one or many selected queues at once.',
      'Shows "Mixed across selected queues" when the current default varies, and requires an explicit choice before applying.',
    ],
  },
  {
    date: '2026-08-16',
    title: 'In-app Release Notes',
    items: [
      'This tab — a running, dated log of what\'s shipped, kept in sync with the toolkit\'s own history.',
    ],
  },
  {
    date: '2026-08-15',
    title: 'Disconnect Interaction module',
    items: [
      'New Routing → Disconnect Interaction tab: pick one or more queues (each showing its configured media types up front), load active interactions, and disconnect a specific interaction, a checked subset, or every interaction on the selected queue(s).',
      'Every disconnect path requires an explicit, cannot-be-undone confirmation and reports per-interaction results.',
      "Fixed app-wide: Genesys API error messages were being silently dropped in favor of a generic \"Request failed\" message — the real reason now shows everywhere a call fails.",
    ],
  },
  {
    date: '2026-08-14',
    title: 'Bulk Service Level (SLA) editor for Queues',
    items: [
      'Bulk-edit Target %, Within (sec), and Alerting timeout across one or many queues at once, per media type.',
      "Enable SLA on media types a queue doesn't have configured yet, with an explicit opt-in and a review/diff step before applying.",
      'Save and reapply named SLA presets (stored locally in your browser).',
      'Queue detail tiles now show SLA and alerting timeout for every configured media type, not just the first one found.',
    ],
  },
  {
    date: '2026-08-13',
    title: 'Evaluation Forms module',
    items: [
      'Build QA evaluation forms with question groups, weighted multiple-choice answers, and critical/kill-question flags.',
      "Generate a form from a plain-text description of your criteria, using the same AI key configured under Architect.",
      'Import/export forms as JSON; editing always re-fetches the full form first so partial list data can never overwrite your questions.',
    ],
  },
  {
    date: '2026-08-10',
    title: 'Prompts: bulk actions and language filtering',
    items: [
      'Bulk select/export/delete for Prompts and Flows.',
      'Filter Prompts by any number of languages at once, with a language badge shown per row.',
      "Corrected the Arabic locale list to match Genesys's actual supported variants.",
    ],
  },
  {
    date: '2026-08-09',
    title: 'Division management and Prompt language import/export',
    items: [
      'Full division CRUD, plus a "manage users" picker to add/remove users from a division.',
      'Per-language TTS text on Architect Prompts across 47 standard locale codes, with JSON import/export to move a prompt between orgs with all its languages intact.',
    ],
  },
  {
    date: '2026-08-03',
    title: 'Schedules and rich-text Canned Responses',
    items: [
      'Full CRUD for Architect Schedules — name, start/end, optional iCal RRULE recurrence, and division.',
      'Canned Responses now support rich text formatting (font, size, bold/italic/underline, color).',
    ],
  },
  {
    date: '2026-07-31',
    title: 'Initial release',
    items: [
      'Canned Responses, Wrap-up Codes, Queues, Users & Divisions, Skills & Routing.',
      'Architect: multi-provider AI-assisted flow generation.',
      'Audit Log viewer and a built-in API Explorer.',
      'Dark mode and a mobile-responsive layout.',
    ],
  },
];

function renderReleaseNotes() {
  const container = document.getElementById('releaseNotesList');
  container.innerHTML = '';
  RELEASE_NOTES.forEach((r) => {
    container.appendChild(
      el('div', { class: 'card card-pad', style: 'margin-bottom:14px' }, [
        el('div', { class: 'release-note-date', text: r.date }),
        el('div', { class: 'release-note-title', text: r.title }),
        el('ul', { class: 'release-note-list' }, r.items.map((item) => el('li', { text: item }))),
      ])
    );
  });
}

// ---- init ----------------------------------------------------

loadRegions();
checkStatus();
