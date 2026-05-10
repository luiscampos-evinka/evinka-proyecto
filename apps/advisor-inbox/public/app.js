const state = {
  user: null,
  conversations: [],
  activeId: null,
  activeConversation: null,
  pollTimer: null,
  isLoadingConversation: false,
  pendingAttachment: null,
};

const els = {
  loginView: document.getElementById('loginView'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  appView: document.getElementById('appView'),
  conversationList: document.getElementById('conversationList'),
  emptyState: document.getElementById('emptyState'),
  chatView: document.getElementById('chatView'),
  customerName: document.getElementById('customerName'),
  customerMeta: document.getElementById('customerMeta'),
  chatSubmeta: document.getElementById('chatSubmeta'),
  customerAvatar: document.getElementById('customerAvatar'),
  profileSummaryBtn: document.getElementById('profileSummaryBtn'),
  handoffReason: document.getElementById('handoffReason'),
  caseStatus: document.getElementById('caseStatus'),
  assignedTo: document.getElementById('assignedTo'),
  messageList: document.getElementById('messageList'),
  composerForm: document.getElementById('composerForm'),
  composerInput: document.getElementById('composerInput'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  statsBar: document.getElementById('statsBar'),
  logoutBtn: document.getElementById('logoutBtn'),
  claimBtn: document.getElementById('claimBtn'),
  resolveBtn: document.getElementById('resolveBtn'),
  returnBotBtn: document.getElementById('returnBotBtn'),
  attachBtn: document.getElementById('attachBtn'),
  fileInput: document.getElementById('fileInput'),
  attachmentPreview: document.getElementById('attachmentPreview'),
  profileDrawer: document.getElementById('profileDrawer'),
  profileDrawerBackdrop: document.getElementById('profileDrawerBackdrop'),
  closeProfileDrawerBtn: document.getElementById('closeProfileDrawerBtn'),
  drawerName: document.getElementById('drawerName'),
  drawerShortName: document.getElementById('drawerShortName'),
  drawerAvatar: document.getElementById('drawerAvatar'),
  drawerPhone: document.getElementById('drawerPhone'),
  drawerEmail: document.getElementById('drawerEmail'),
  drawerLocation: document.getElementById('drawerLocation'),
  drawerAddress: document.getElementById('drawerAddress'),
  drawerReason: document.getElementById('drawerReason'),
  drawerStatus: document.getElementById('drawerStatus'),
  drawerAssigned: document.getElementById('drawerAssigned'),
};

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function formatSize(bytes = 0) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkifyText(value = '') {
  return escapeHtml(value).replace(/(https?:\/\/[^\s<]+)/gi, (match) => `<a class="message-link-anchor" href="${match}" target="_blank" rel="noreferrer">${match}</a>`);
}

function firstUrl(value = '') {
  const match = String(value || '').match(/https?:\/\/\S+/i);
  return match ? match[0] : null;
}

function compactHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function initials(text = '') {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || 'EV';
}

function isNearBottom(element, threshold = 80) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

function autoResizeComposer() {
  els.composerInput.style.height = 'auto';
  els.composerInput.style.height = `${Math.min(els.composerInput.scrollHeight, 180)}px`;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error inesperado');
  return data;
}

function setLoggedIn(on) {
  els.loginView.classList.toggle('hidden', on);
  els.appView.classList.toggle('hidden', !on);
}

function labelStatus(value) {
  if (value === 'resolved') return 'Resuelto';
  if (value === 'open') return 'Tomado';
  return 'Nuevo';
}

function mediaClassFromMessage(message) {
  if ((message.mimeType || '').startsWith('image/') || message.type === 'image') return 'image';
  return 'document';
}

function renderStats() {
  const items = state.conversations;
  const active = items.filter((item) => item.status !== 'resolved');
  const pending = active.filter((item) => item.status === 'new');
  const open = active.filter((item) => item.status === 'open');
  els.statsBar.innerHTML = `
    <div class="stat"><span class="muted">Nuevos</span><strong>${pending.length}</strong></div>
    <div class="stat"><span class="muted">Tomados</span><strong>${open.length}</strong></div>
    <div class="stat"><span class="muted">Total</span><strong>${items.length}</strong></div>
  `;
}

function filteredConversations() {
  const q = (els.searchInput.value || '').trim().toLowerCase();
  return state.conversations.filter((item) => {
    if (!q) return true;
    return [item.customerName, item.phonePretty, item.phone, item.handoffReason, item.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}

function renderConversationList() {
  const previousScroll = els.conversationList.scrollTop;
  const items = filteredConversations();
  renderStats();
  if (!items.length) {
    els.conversationList.innerHTML = '<div class="empty-state"><p>No hay conversaciones para este filtro.</p></div>';
    return;
  }
  els.conversationList.innerHTML = items.map((item) => `
    <article class="conversation-item ${item.id === state.activeId ? 'active' : ''}" data-id="${item.id}">
      <div class="conversation-top">
        <div>
          <div class="conversation-title">${escapeHtml(item.customerName)}</div>
          <div class="conversation-phone">${escapeHtml(item.phonePretty || item.phone || '')}</div>
        </div>
        <div class="muted">${escapeHtml(formatDate(item.lastMessageAt))}</div>
      </div>
      <div class="conversation-bottom">
        <div class="badges">
          <span class="badge ${item.status}">${escapeHtml(labelStatus(item.status))}</span>
          ${item.assignedToLabel ? `<span class="badge">${escapeHtml(item.assignedToLabel)}</span>` : ''}
        </div>
        ${item.unreadCount ? `<span class="unread-pill">${item.unreadCount}</span>` : ''}
      </div>
      <div class="conversation-preview">${escapeHtml(item.lastMessageText || item.handoffReason || item.phonePretty)}</div>
    </article>
  `).join('');

  els.conversationList.scrollTop = Math.min(previousScroll, els.conversationList.scrollHeight);
  document.querySelectorAll('.conversation-item').forEach((node) => {
    node.addEventListener('click', () => loadConversation(node.dataset.id));
  });
}

function classifyMessage(message) {
  if (message.systemAction || message.role === 'system') return 'system';
  if (message.role === 'assistant' && message.advisorName) return 'advisor';
  return message.role;
}

function renderAttachmentPreview() {
  const file = state.pendingAttachment;
  if (!file) {
    els.attachmentPreview.classList.add('hidden');
    els.attachmentPreview.innerHTML = '';
    return;
  }
  const isImage = (file.mimeType || '').startsWith('image/');
  els.attachmentPreview.classList.remove('hidden');
  els.attachmentPreview.innerHTML = `
    <div class="attachment-preview-main">
      ${isImage
        ? `<img src="${file.previewUrl}" alt="${escapeHtml(file.fileName)}" class="attachment-preview-thumb" />`
        : `<div class="attachment-preview-thumb">PDF</div>`}
      <div>
        <div class="attachment-preview-name">${escapeHtml(file.fileName)}</div>
        <div class="attachment-preview-meta">${escapeHtml(file.mimeType)} · ${escapeHtml(formatSize(file.fileSize))}</div>
      </div>
    </div>
    <button type="button" class="attachment-remove" id="attachmentRemoveBtn">Quitar</button>
  `;
  document.getElementById('attachmentRemoveBtn')?.addEventListener('click', clearAttachment);
}

function clearAttachment() {
  if (state.pendingAttachment?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(state.pendingAttachment.previewUrl);
  }
  state.pendingAttachment = null;
  els.fileInput.value = '';
  renderAttachmentPreview();
}

function renderMessageBody(message) {
  const rawText = message.text || '';
  const text = linkifyText(rawText);
  const previewUrl = firstUrl(rawText);
  const previewCard = previewUrl
    ? `<a class="message-link-card" href="${previewUrl}" target="_blank" rel="noreferrer"><div class="message-link-host">${escapeHtml(compactHost(previewUrl))}</div><div class="message-link-url">${escapeHtml(previewUrl)}</div></a>`
    : '';
  if (!message.mediaUrl) return `${previewCard}${text ? `<div class="message-text">${text}</div>` : ''}`;
  const mediaType = mediaClassFromMessage(message);
  if (mediaType === 'image') {
    return `
      <div class="message-media">
        <a href="${message.mediaUrl}" target="_blank" rel="noreferrer">
          <img src="${message.mediaUrl}" alt="${escapeHtml(message.fileName || 'imagen') }" class="message-image" />
        </a>
        ${text ? `<div class="message-text">${text}</div>` : ''}
      </div>
    `;
  }
  return `
    <div class="message-media">
      <a class="message-file" href="${message.mediaUrl}" target="_blank" rel="noreferrer">
        <div class="message-file-icon">PDF</div>
        <div class="message-file-meta">
          <div class="message-file-name">${escapeHtml(message.fileName || 'Documento')}</div>
          <div class="message-file-size">${escapeHtml(formatSize(message.fileSize))}</div>
        </div>
      </a>
      ${text && rawText !== (message.fileName || '') ? `<div class="message-text">${text}</div>` : ''}
    </div>
  `;
}

function toggleActionButtons(detail) {
  const status = detail?.conversation?.status || 'new';
  els.claimBtn.disabled = status === 'resolved';
  els.resolveBtn.disabled = status === 'resolved';
  els.returnBotBtn.disabled = status === 'resolved';
}

function closeProfileDrawer() {
  els.profileDrawer.classList.add('hidden');
}

function openProfileDrawer() {
  const detail = state.activeConversation;
  if (!detail) return;
  els.drawerName.textContent = detail.conversation.customerName || '-';
  els.drawerShortName.textContent = detail.conversation.customerName || '-';
  els.drawerAvatar.textContent = initials(detail.conversation.customerName);
  els.drawerPhone.textContent = detail.conversation.phonePretty || detail.conversation.phone || '-';
  els.drawerEmail.textContent = detail.conversation.email || '-';
  els.drawerLocation.textContent = [detail.conversation.district, detail.conversation.province].filter(Boolean).join(' · ') || '-';
  els.drawerAddress.textContent = detail.conversation.installationAddress || detail.conversation.receiptAddress || '-';
  els.drawerReason.textContent = detail.conversation.handoffReason || '-';
  els.drawerStatus.textContent = labelStatus(detail.conversation.status);
  els.drawerAssigned.textContent = detail.conversation.assignedToLabel || 'Sin asignar';
  els.profileDrawer.classList.remove('hidden');
}

function renderConversationDetail({ preserveScroll = true } = {}) {
  const detail = state.activeConversation;
  if (!detail) {
    els.emptyState.classList.remove('hidden');
    els.chatView.classList.add('hidden');
    return;
  }
  const shouldStick = preserveScroll ? isNearBottom(els.messageList) : true;
  const previousScroll = els.messageList.scrollTop;
  const previousHeight = els.messageList.scrollHeight;

  els.emptyState.classList.add('hidden');
  els.chatView.classList.remove('hidden');
  els.customerName.textContent = detail.conversation.customerName;
  els.customerMeta.textContent = [detail.conversation.phonePretty, detail.conversation.email].filter(Boolean).join(' · ');
  els.chatSubmeta.textContent = [detail.conversation.district, detail.conversation.province].filter(Boolean).join(' · ');
  els.customerAvatar.textContent = initials(detail.conversation.customerName);
  els.handoffReason.textContent = detail.conversation.handoffReason || 'Solicitud manual del cliente';
  els.caseStatus.textContent = labelStatus(detail.conversation.status);
  els.assignedTo.textContent = detail.conversation.assignedToLabel || 'Sin asignar';
  toggleActionButtons(detail);

  els.messageList.innerHTML = detail.messages.map((message) => {
    const kind = classifyMessage(message);
    const author = kind === 'advisor'
      ? (message.advisorName || 'Asesor EVINKA')
      : kind === 'user'
        ? detail.conversation.customerName
        : 'Sistema';
    const footer = kind === 'system'
      ? `<div class="message-system-meta">${escapeHtml(author)} · ${escapeHtml(formatDate(message.createdAt))}</div>`
      : `<div class="message-footer"><span>${escapeHtml(formatTime(message.createdAt))}</span>${kind === 'advisor' || kind === 'assistant' ? '<span class="message-checks">✓✓</span>' : ''}</div>`;
    return `
      <div class="message-row ${kind}">
        <div class="message-bubble">
          ${renderMessageBody(message)}
          ${footer}
        </div>
      </div>
    `;
  }).join('');

  if (shouldStick) {
    els.messageList.scrollTop = els.messageList.scrollHeight;
  } else {
    const delta = els.messageList.scrollHeight - previousHeight;
    els.messageList.scrollTop = previousScroll + Math.max(delta, 0);
  }
}

async function loadMe() {
  try {
    const data = await api('/api/me');
    state.user = data.user;
    setLoggedIn(true);
    await loadConversations({ refreshActive: true });
  } catch {
    setLoggedIn(false);
  }
}

async function loadConversations({ refreshActive = true } = {}) {
  const data = await api(`/api/inbox/conversations?status=${encodeURIComponent(els.statusFilter.value)}`);
  state.conversations = data;
  renderConversationList();
  if (refreshActive && state.activeId && data.some((item) => item.id === state.activeId)) {
    await loadConversation(state.activeId, { skipRefreshList: true, preserveScroll: true });
  }
}

async function loadConversation(id, { skipRefreshList = false, preserveScroll = false } = {}) {
  if (state.isLoadingConversation) return;
  state.isLoadingConversation = true;
  try {
    state.activeId = id;
    const detail = await api(`/api/inbox/conversations/${encodeURIComponent(id)}`);
    state.activeConversation = detail;
    renderConversationList();
    renderConversationDetail({ preserveScroll });
    if (!skipRefreshList) await loadConversations({ refreshActive: false });
  } finally {
    state.isLoadingConversation = false;
  }
}

async function performAction(action) {
  if (!state.activeId) return;
  await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
  await loadConversations({ refreshActive: true });
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sendCurrentPayload() {
  const text = els.composerInput.value.trim();
  if (!state.activeId) return;
  if (!text && !state.pendingAttachment) return;

  if (state.pendingAttachment) {
    await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}/media`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: state.pendingAttachment.fileName,
        mimeType: state.pendingAttachment.mimeType,
        base64: state.pendingAttachment.base64,
        caption: text,
      }),
    });
    clearAttachment();
  } else {
    await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  els.composerInput.value = '';
  autoResizeComposer();
  await loadConversations({ refreshActive: true });
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginError.classList.add('hidden');
  const form = new FormData(els.loginForm);
  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    els.loginForm.reset();
    await loadMe();
  } catch (error) {
    els.loginError.textContent = error.message;
    els.loginError.classList.remove('hidden');
  }
});

els.logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  state.conversations = [];
  state.activeConversation = null;
  state.activeId = null;
  clearAttachment();
  setLoggedIn(false);
});

els.searchInput.addEventListener('input', renderConversationList);
els.statusFilter.addEventListener('change', () => loadConversations({ refreshActive: true }));
els.composerInput.addEventListener('input', autoResizeComposer);
els.composerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    els.composerForm.requestSubmit();
  }
});
els.attachBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 14 * 1024 * 1024) {
    alert('El archivo excede el máximo permitido de 14 MB.');
    els.fileInput.value = '';
    return;
  }
  const base64 = await fileToBase64(file);
  state.pendingAttachment = {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    base64,
    previewUrl: (file.type || '').startsWith('image/') ? URL.createObjectURL(file) : '',
  };
  renderAttachmentPreview();
});

els.composerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await sendCurrentPayload();
  } catch (error) {
    alert(error.message || 'No pude enviar el mensaje.');
  }
});

els.claimBtn.addEventListener('click', () => performAction('claim'));
els.resolveBtn.addEventListener('click', () => performAction('resolve'));
els.returnBotBtn.addEventListener('click', () => performAction('return_to_bot'));
els.profileSummaryBtn.addEventListener('click', openProfileDrawer);
els.profileDrawerBackdrop.addEventListener('click', closeProfileDrawer);
els.closeProfileDrawerBtn.addEventListener('click', closeProfileDrawer);

state.pollTimer = setInterval(() => {
  if (state.user) loadConversations({ refreshActive: true }).catch(() => {});
}, 15000);

autoResizeComposer();
renderAttachmentPreview();
loadMe();
