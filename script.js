/**
 * HasnainPay — Digital Wallet Application
 * ─────────────────────────────────────────
 * Author  : Sardar Mr. Muhammed Hasnain Khan Rind Baloch
 * Email   : hasnainabass243@gmail.com
 * Version : 1.0.0
 *
 * Architecture:
 *  - Auth   : Simple credential check + LocalStorage
 *  - Data   : All data in LocalStorage (friends + transactions)
 *  - Pages  : Single-HTML multi-page (showPage helper)
 *  - Modals : Bottom-sheet style overlays
 */

'use strict';

/* ═══════════════════════════════════════════════
   CONSTANTS & STATE
════════════════════════════════════════════════ */
const LS_KEYS = {
  USERS    : 'hnp_users',
  FRIENDS  : 'hnp_friends',
  TXNS     : 'hnp_transactions',
  SESSION  : 'hnp_session',
};

// Default demo credential
const DEFAULT_USER = {
  email    : 'admin@wallet.com',
  password : '1234',
};

let state = {
  currentUser   : null,
  friends       : [],   // [{ id, name, phone }]
  transactions  : {},   // { friendId: [{ id, type, amount, note, datetime }] }
  activeFriendId: null, // currently viewed friend
  txnMode       : 'receive', // 'receive' | 'give'
};

/* ═══════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initUsers();
  checkSession();
  bindPasswordToggles();
  setDefaultDateTime();
});

/** Seed default user if none exist */
function initUsers() {
  const users = loadUsers();
  if (users.length === 0) {
    saveUsers([DEFAULT_USER]);
  }
}

/** Check if there's an active session */
function checkSession() {
  const session = localStorage.getItem(LS_KEYS.SESSION);
  if (session) {
    state.currentUser = session;
    loadStateFromLS();
    showPage('page-dashboard');
    renderDashboard();
  } else {
    showPage('page-login');
  }
}

/* ═══════════════════════════════════════════════
   LOCAL STORAGE HELPERS
════════════════════════════════════════════════ */
function loadUsers()       { return JSON.parse(localStorage.getItem(LS_KEYS.USERS)    || '[]');  }
function saveUsers(u)      { localStorage.setItem(LS_KEYS.USERS,    JSON.stringify(u)); }
function loadFriends()     { return JSON.parse(localStorage.getItem(LS_KEYS.FRIENDS)  || '[]');  }
function saveFriends(f)    { localStorage.setItem(LS_KEYS.FRIENDS,  JSON.stringify(f)); }
function loadTxns()        { return JSON.parse(localStorage.getItem(LS_KEYS.TXNS)     || '{}');  }
function saveTxns(t)       { localStorage.setItem(LS_KEYS.TXNS,     JSON.stringify(t)); }

function loadStateFromLS() {
  state.friends      = loadFriends();
  state.transactions = loadTxns();
}

/** Called by all "Save" buttons */
function saveAllData() {
  saveFriends(state.friends);
  saveTxns(state.transactions);
  showToast('Data saved successfully!');
}

/* ═══════════════════════════════════════════════
   PAGE ROUTING
════════════════════════════════════════════════ */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    // scroll to top on page change
    page.scrollTop = 0;
    window.scrollTo(0, 0);
  }
}

/* ═══════════════════════════════════════════════
   AUTHENTICATION
════════════════════════════════════════════════ */
function doLogin() {
  const email = val('login-email').trim().toLowerCase();
  const pw    = val('login-password');
  const errEl = document.getElementById('login-error');

  if (!email || !pw) {
    return showError(errEl, 'Please enter email and password.');
  }

  const users = loadUsers();
  const user  = users.find(u => u.email.toLowerCase() === email && u.password === pw);

  if (!user) {
    return showError(errEl, 'Invalid email or password.');
  }

  hideEl(errEl);
  state.currentUser = email;
  localStorage.setItem(LS_KEYS.SESSION, email);
  loadStateFromLS();
  showPage('page-dashboard');
  renderDashboard();

  // Clear fields
  set('login-email', '');
  set('login-password', '');
}

function doLogout() {
  saveAllData();
  localStorage.removeItem(LS_KEYS.SESSION);
  state.currentUser    = null;
  state.friends        = [];
  state.transactions   = {};
  state.activeFriendId = null;
  showPage('page-login');
}

function doReset() {
  const email  = val('reset-email').trim().toLowerCase();
  const newPw  = val('reset-new-pw');
  const conPw  = val('reset-confirm-pw');
  const msgEl  = document.getElementById('reset-msg');

  if (!email || !newPw || !conPw) {
    return showError(msgEl, 'All fields are required.');
  }
  if (newPw.length < 4) {
    return showError(msgEl, 'Password must be at least 4 characters.');
  }
  if (newPw !== conPw) {
    return showError(msgEl, 'Passwords do not match.');
  }

  const users = loadUsers();
  const idx   = users.findIndex(u => u.email.toLowerCase() === email);
  if (idx === -1) {
    return showError(msgEl, 'Email not found. Use the demo email.');
  }

  users[idx].password = newPw;
  saveUsers(users);

  msgEl.className = 'error-msg success';
  msgEl.textContent = '✓ Password updated! Redirecting to login…';

  setTimeout(() => {
    hideEl(msgEl);
    set('reset-email', '');
    set('reset-new-pw', '');
    set('reset-confirm-pw', '');
    showPage('page-login');
  }, 2000);
}

/* ═══════════════════════════════════════════════
   DASHBOARD RENDERING
════════════════════════════════════════════════ */
function renderDashboard() {
  renderFriendsList();
  updateTotalBalance();
}

function renderFriendsList() {
  const container = document.getElementById('friends-list');
  const emptyEl   = document.getElementById('empty-friends');
  const countEl   = document.getElementById('friend-count');

  // Remove all friend cards (keep empty-state)
  container.querySelectorAll('.friend-card').forEach(c => c.remove());
  countEl.textContent = state.friends.length;

  if (state.friends.length === 0) {
    showEl(emptyEl);
    return;
  }
  hideEl(emptyEl);

  state.friends.forEach(friend => {
    const balance = getFriendBalance(friend.id);
    const card    = document.createElement('div');
    card.className = 'friend-card';
    card.onclick   = () => openFriendDetail(friend.id);

    const balClass = balance > 0 ? 'pos' : (balance < 0 ? 'neg' : 'zero');
    const balStr   = formatAmount(Math.abs(balance));
    const balSign  = balance > 0 ? '+' : (balance < 0 ? '-' : '');

    card.innerHTML = `
      <div class="f-avatar">${avatarLetter(friend.name)}</div>
      <div class="f-info">
        <div class="f-name">${escHtml(friend.name)}</div>
        <div class="f-phone">${escHtml(friend.phone || 'No details')}</div>
      </div>
      <div class="f-balance ${balClass}">${balSign}${balStr}</div>
      <i class="fa-solid fa-chevron-right f-arrow"></i>
    `;
    container.appendChild(card);
  });
}

function updateTotalBalance() {
  let total = 0;
  state.friends.forEach(f => { total += getFriendBalance(f.id); });
  const el = document.getElementById('total-balance');
  el.textContent = 'PKR ' + formatAmount(total);
  el.style.color = total < 0
    ? 'var(--red)'
    : (total > 0 ? 'var(--green)' : 'var(--text-main)');

  document.getElementById('balance-subtitle').textContent =
    `Across ${state.friends.length} friend${state.friends.length !== 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════════════
   FRIEND MANAGEMENT
════════════════════════════════════════════════ */
function openAddFriend() {
  set('friend-name-input',  '');
  set('friend-phone-input', '');
  const errEl = document.getElementById('add-friend-error');
  hideEl(errEl);

  // Show contact picker button only if API available
  const pickWrap = document.getElementById('contact-pick-btn-wrap');
  pickWrap.style.display = ('contacts' in navigator && 'ContactsManager' in window) ? 'block' : 'none';

  openModal('modal-add-friend');
}

async function pickContact() {
  // Contact Picker API (Chrome Android / some browsers)
  if (!('contacts' in navigator)) {
    alert('Contact Picker is not supported on this device/browser.');
    return;
  }
  try {
    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    if (contacts && contacts.length > 0) {
      const c = contacts[0];
      set('friend-name-input',  (c.name && c.name[0]) ? c.name[0] : '');
      set('friend-phone-input', (c.tel  && c.tel[0])  ? c.tel[0]  : '');
    }
  } catch (err) {
    console.warn('Contact picker error:', err);
  }
}

function addFriend() {
  const name  = val('friend-name-input').trim();
  const phone = val('friend-phone-input').trim();
  const errEl = document.getElementById('add-friend-error');

  if (!name) {
    return showError(errEl, 'Friend name is required.');
  }

  // Duplicate check
  if (state.friends.find(f => f.name.toLowerCase() === name.toLowerCase())) {
    return showError(errEl, 'A friend with this name already exists.');
  }

  const friend = {
    id   : generateId(),
    name : name,
    phone: phone,
  };

  state.friends.push(friend);
  if (!state.transactions[friend.id]) {
    state.transactions[friend.id] = [];
  }

  saveFriends(state.friends);
  saveTxns(state.transactions);

  closeModal('modal-add-friend');
  renderDashboard();
  showToast(`${name} added!`);
}

function openDeleteFriend() {
  const listEl = document.getElementById('delete-friend-list');
  const errEl  = document.getElementById('delete-friend-error');
  hideEl(errEl);
  listEl.innerHTML = '';

  if (state.friends.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.88rem;">No friends to delete.</p>';
  } else {
    state.friends.forEach(f => {
      const item = document.createElement('div');
      item.className = 'delete-item';
      item.innerHTML = `
        <div class="f-avatar">${avatarLetter(f.name)}</div>
        <div class="f-name">${escHtml(f.name)}</div>
        <button class="btn-del" onclick="confirmDeleteFriend('${f.id}')">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      `;
      listEl.appendChild(item);
    });
  }

  openModal('modal-delete-friend');
}

function confirmDeleteFriend(friendId) {
  const friend = state.friends.find(f => f.id === friendId);
  if (!friend) return;

  if (!confirm(`Delete "${friend.name}" and all their transactions?`)) return;

  state.friends = state.friends.filter(f => f.id !== friendId);
  delete state.transactions[friendId];

  saveFriends(state.friends);
  saveTxns(state.transactions);

  closeModal('modal-delete-friend');
  renderDashboard();
  showToast(`${friend.name} deleted.`);
}

/* ═══════════════════════════════════════════════
   FRIEND DETAIL PAGE
════════════════════════════════════════════════ */
function openFriendDetail(friendId) {
  const friend = state.friends.find(f => f.id === friendId);
  if (!friend) return;

  state.activeFriendId = friendId;

  // Populate header
  document.getElementById('friend-detail-name').textContent  = friend.name;
  document.getElementById('friend-detail-phone').textContent = friend.phone || 'No details';
  document.getElementById('friend-avatar-letter').textContent = avatarLetter(friend.name);

  renderFriendDetail();
  showPage('page-friend');
}

function renderFriendDetail() {
  const fid     = state.activeFriendId;
  const txns    = (state.transactions[fid] || []).slice().reverse(); // newest first
  const balance = getFriendBalance(fid);

  // Balance pill
  const pillAmt = document.getElementById('friend-balance-display');
  const pillBdg = document.getElementById('friend-balance-badge');
  const pill    = document.getElementById('friend-balance-pill');

  pillAmt.textContent = 'PKR ' + formatAmount(Math.abs(balance));
  pillAmt.className   = 'pill-amount ' + (balance > 0 ? 'pos' : (balance < 0 ? 'neg' : 'zero'));

  if (balance > 0) {
    pillBdg.textContent = 'TO RECEIVE';
    pillBdg.className   = 'pill-badge pos';
    pill.style.borderColor = 'rgba(34,197,94,0.3)';
  } else if (balance < 0) {
    pillBdg.textContent = 'TO GIVE';
    pillBdg.className   = 'pill-badge neg';
    pill.style.borderColor = 'rgba(239,68,68,0.3)';
  } else {
    pillBdg.textContent = 'SETTLED';
    pillBdg.className   = 'pill-badge zero';
    pill.style.borderColor = 'var(--navy-border)';
  }

  // Transaction list
  const listEl  = document.getElementById('txn-list');
  const emptyEl = document.getElementById('empty-txns');
  listEl.querySelectorAll('.txn-item').forEach(el => el.remove());

  if (txns.length === 0) {
    showEl(emptyEl);
    return;
  }
  hideEl(emptyEl);

  txns.forEach(txn => {
    const item = document.createElement('div');
    item.className = 'txn-item';
    const isReceive = txn.type === 'receive';
    const dateStr   = formatDateTime(txn.datetime);
    const sign      = isReceive ? '+' : '-';

    item.innerHTML = `
      <div class="txn-icon ${txn.type}">
        <i class="fa-solid fa-arrow-${isReceive ? 'down-to-bracket' : 'up-from-bracket'}"></i>
      </div>
      <div class="txn-meta">
        <div class="txn-note">${escHtml(txn.note || (isReceive ? 'Received' : 'Given'))}</div>
        <div class="txn-date">${dateStr}</div>
      </div>
      <div class="txn-amount ${txn.type}">${sign} PKR ${formatAmount(txn.amount)}</div>
    `;
    listEl.appendChild(item);
  });
}

function goBack() {
  showPage('page-dashboard');
  renderDashboard();
}

/* ═══════════════════════════════════════════════
   TRANSACTIONS
════════════════════════════════════════════════ */
function openTxnModal(mode) {
  state.txnMode = mode;
  const isReceive = (mode === 'receive');

  // Update modal UI
  const header   = document.getElementById('txn-modal-header');
  const title    = document.getElementById('txn-modal-title');
  const submitEl = document.getElementById('txn-submit-btn');

  header.className   = isReceive ? 'modal-header receive-header' : 'modal-header give-header';
  title.innerHTML    = `<i class="fa-solid fa-arrow-${isReceive ? 'down-to-bracket' : 'up-from-bracket'}"></i> ${isReceive ? 'You Receive' : 'You Give'}`;
  submitEl.style.background = isReceive
    ? 'linear-gradient(135deg,#16A34A,#22C55E)'
    : 'linear-gradient(135deg,#DC2626,#EF4444)';

  // Reset fields
  set('txn-amount',   '');
  set('txn-note',     '');
  setDefaultDateTime();
  hideEl(document.getElementById('txn-error'));

  openModal('modal-txn');
}

function submitTransaction() {
  const amountStr = val('txn-amount').trim();
  const note      = val('txn-note').trim();
  const datetime  = val('txn-datetime');
  const errEl     = document.getElementById('txn-error');
  const fid       = state.activeFriendId;

  if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
    return showError(errEl, 'Please enter a valid positive amount.');
  }

  const txn = {
    id      : generateId(),
    type    : state.txnMode,           // 'receive' | 'give'
    amount  : parseFloat(parseFloat(amountStr).toFixed(2)),
    note    : note,
    datetime: datetime || new Date().toISOString(),
  };

  if (!state.transactions[fid]) state.transactions[fid] = [];
  state.transactions[fid].push(txn);

  saveTxns(state.transactions);
  closeModal('modal-txn');
  renderFriendDetail();

  const friend = state.friends.find(f => f.id === fid);
  const label  = state.txnMode === 'receive' ? 'Received' : 'Given';
  showToast(`${label}: PKR ${formatAmount(txn.amount)}`);
}

/* ═══════════════════════════════════════════════
   BALANCE CALCULATIONS
════════════════════════════════════════════════ */
/**
 * Returns net balance for a friend.
 * Positive = friend owes you (you've received OR they owe)
 * receive = money coming TO you   → +
 * give    = money going FROM you  → -
 */
function getFriendBalance(friendId) {
  const txns = state.transactions[friendId] || [];
  return txns.reduce((sum, t) => {
    return sum + (t.type === 'receive' ? t.amount : -t.amount);
  }, 0);
}

/* ═══════════════════════════════════════════════
   MODAL HELPERS
════════════════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    // Trap focus by making body non-scrollable
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  document.body.style.overflow = '';
}

// Close modal when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

/* ═══════════════════════════════════════════════
   TOAST NOTIFICATION
════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('save-toast');
  el.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escHtml(msg)}`;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

/* ═══════════════════════════════════════════════
   PASSWORD TOGGLE
════════════════════════════════════════════════ */
function bindPasswordToggles() {
  const toggle = document.getElementById('toggle-login-pw');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const input = document.getElementById('login-password');
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      toggle.className = `fa-regular toggle-pw ${isText ? 'fa-eye' : 'fa-eye-slash'}`;
    });
  }
}

/* ═══════════════════════════════════════════════
   UTILITY FUNCTIONS
════════════════════════════════════════════════ */

/** Get input value */
function val(id)      { return (document.getElementById(id) || {}).value || ''; }
/** Set input value  */
function set(id, v)   { const el = document.getElementById(id); if (el) el.value = v; }
/** Show element     */
function showEl(el)   { if (el) el.classList.remove('hidden'); }
/** Hide element     */
function hideEl(el)   { if (el) el.classList.add('hidden'); }

/** Show error in element */
function showError(el, msg) {
  if (!el) return;
  el.textContent  = msg;
  el.className    = 'error-msg';
  showEl(el);
}

/** Generate unique ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Avatar initial letter */
function avatarLetter(name) {
  return (name || '?').charAt(0).toUpperCase();
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format number as currency string */
function formatAmount(n) {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format ISO datetime to readable string */
function formatDateTime(dt) {
  if (!dt) return 'Unknown date';
  try {
    const d = new Date(dt);
    return d.toLocaleString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dt; }
}

/** Set default datetime in txn modal to now */
function setDefaultDateTime() {
  const now = new Date();
  // datetime-local format: YYYY-MM-DDTHH:MM
  const pad  = n => String(n).padStart(2, '0');
  const str  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  set('txn-datetime', str);
}

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  // Enter to submit login
  if (e.key === 'Enter') {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    if (activePage.id === 'page-login')  doLogin();
    if (activePage.id === 'page-reset')  doReset();
  }
  // Escape to close modals
  if (e.key === 'Escape') {
    ['modal-add-friend','modal-delete-friend','modal-txn'].forEach(closeModal);
  }
});
