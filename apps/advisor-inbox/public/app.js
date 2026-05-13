const QUICK_REPLIES = [
  {
    label: 'Pedir ubicación',
    text: '¡Gracias! Para ayudarte mejor, compárteme por favor tu ubicación o la dirección exacta de instalación.',
  },
  {
    label: 'Agendar visita',
    text: 'Perfecto. Podemos coordinar una visita técnica para validar la instalación. ¿Qué día y rango horario te acomoda mejor?',
  },
  {
    label: 'Pedir recibo',
    text: 'Para avanzar, por favor envíame una foto clara de tu recibo de luz y, si tienes, del tablero eléctrico.',
  },
  {
    label: 'Confirmar potencia',
    text: 'Antes de cotizarte con precisión, necesito confirmar la potencia requerida y el tipo de vehículo. ¿Me compartes ese dato?',
  },
  {
    label: 'Enviar seguimiento',
    text: 'Te escribo para dar seguimiento a tu solicitud. Si quieres, hoy mismo dejamos listo el siguiente paso para tu instalación.',
  },
  {
    label: 'Cerrar con llamada',
    text: 'Si prefieres, te llamo y lo resolvemos más rápido. ¿Me confirmas si te va bien una llamada breve?',
  },
];

const state = {
  user: null,
  conversations: [],
  activeId: null,
  activeConversation: null,
  pollTimer: null,
  isLoadingConversation: false,
  isSendingMessage: false,
  pendingAttachment: null,
  savingMeta: false,
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
  casePriority: document.getElementById('casePriority'),
  caseSla: document.getElementById('caseSla'),
  caseStage: document.getElementById('caseStage'),
  assignedTo: document.getElementById('assignedTo'),
  messageList: document.getElementById('messageList'),
  composerForm: document.getElementById('composerForm'),
  composerInput: document.getElementById('composerInput'),
  composerSendBtn: document.querySelector('#composerForm .composer-send'),
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
  openProfileBtn: document.getElementById('openProfileBtn'),
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
  snapshotPhone: document.getElementById('snapshotPhone'),
  snapshotEmail: document.getElementById('snapshotEmail'),
  snapshotLocation: document.getElementById('snapshotLocation'),
  snapshotAddress: document.getElementById('snapshotAddress'),
  snapshotTicket: document.getElementById('snapshotTicket'),
  summaryText: document.getElementById('summaryText'),
  summaryPriorityBadge: document.getElementById('summaryPriorityBadge'),
  quickReplies: document.getElementById('quickReplies'),
  createVisitBtn: document.getElementById('createVisitBtn'),
  openQuoteBtn: document.getElementById('openQuoteBtn'),
  markReadyCloseBtn: document.getElementById('markReadyCloseBtn'),
  internalNoteInput: document.getElementById('internalNoteInput'),
  nextActionSelect: document.getElementById('nextActionSelect'),
  prioritySelect: document.getElementById('prioritySelect'),
  saveCaseMetaBtn: document.getElementById('saveCaseMetaBtn'),
  metaSaveStatus: document.getElementById('metaSaveStatus'),
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
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
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

function labelNextAction(value) {
  return {
    contactar_cliente: 'Contactar cliente',
    pedir_datos: 'Pedir datos',
    agendar_visita: 'Agendar visita',
    enviar_cotizacion: 'Enviar cotización',
    seguimiento: 'Seguimiento',
    cerrar: 'Cerrar caso',
  }[value] || 'Sin definir';
}

function normalizeStage(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 'Handoff asesor';
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function minutesSince(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.round((Date.now() - time) / 60000));
}

function waitReference(item = {}) {
  return item.lastIncomingAt || item.lastMessageAt || item.updatedAt || item.createdAt;
}

function waitLabel(item = {}) {
  const mins = minutesSince(waitReference(item));
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function computePriority(item = {}) {
  if (item.manualPriority === 'urgent' || item.manualPriority === 'high' || item.manualPriority === 'normal') {
    return item.manualPriority;
  }
  const text = `${item.handoffReason || ''} ${item.lastMessageText || ''}`.toLowerCase();
  const mins = minutesSince(waitReference(item));
  const urgentSignals = ['urgente', 'hoy', 'ahora', 'llamar', 'caído', 'problema'];
  if (item.status === 'new' && (mins >= 20 || Number(item.unreadCount || 0) >= 3)) return 'urgent';
  if (urgentSignals.some((term) => text.includes(term))) return 'urgent';
  if (item.status === 'new' || mins >= 8 || Number(item.unreadCount || 0) > 0) return 'high';
  return 'normal';
}

function priorityLabel(value) {
  return { urgent: 'Urgente', high: 'Alta', normal: 'Normal' }[value] || 'Normal';
}

function computeSla(item = {}) {
  if (item.status === 'resolved') return { tone: 'resolved', label: 'Resuelto' };
  const mins = minutesSince(waitReference(item));
  const threshold = item.status === 'new' ? 5 : 15;
  if (mins >= threshold * 2) return { tone: 'danger', label: `Vencido · ${waitLabel(item)}` };
  if (mins >= threshold) return { tone: 'warn', label: `En riesgo · ${waitLabel(item)}` };
  return { tone: 'healthy', label: `A tiempo · ${waitLabel(item)}` };
}

function mediaClassFromMessage(message) {
  if ((message.mimeType || '').startsWith('image/') || message.type === 'image') return 'image';
  return 'document';
}

function buildSummary(conversation = {}) {
  const bits = [];
  if (conversation.handoffReason) bits.push(conversation.handoffReason);
  if (conversation.nextAction) bits.push(`Próximo paso: ${labelNextAction(conversation.nextAction)}.`);
  if (conversation.internalNote) bits.push(`Nota interna: ${conversation.internalNote}`);
  if (!bits.length && conversation.ticketContext) bits.push(`Ticket/contexto: ${conversation.ticketContext}`);
  if (!bits.length) bits.push('Caso listo para atención humana. Revisar contexto, validar necesidad y ejecutar siguiente paso comercial.');
  return bits.join(' ');
}

function buildQuoteUrl(conversation = {}) {
  const params = new URLSearchParams();
  params.set('source', 'advisor');
  if (conversation.customerName) params.set('clientName', conversation.customerName);
  if (conversation.email) params.set('email', conversation.email);
  if (conversation.district || conversation.province) params.set('city', [conversation.district, conversation.province].filter(Boolean).join(' - '));
  if (conversation.id) params.set('reference', conversation.id);
  if (conversation.createdAt) params.set('visitDate', String(conversation.createdAt).slice(0, 10));
  const notes = [
    conversation.installationAddress ? `Dirección: ${conversation.installationAddress}` : (conversation.receiptAddress ? `Dirección: ${conversation.receiptAddress}` : ''),
    conversation.phonePretty ? `Teléfono: ${conversation.phonePretty}` : '',
    conversation.ticketContext ? `Ticket: ${conversation.ticketContext}` : '',
    conversation.handoffReason ? `Motivo: ${conversation.handoffReason}` : '',
    conversation.internalNote ? `Nota asesor: ${conversation.internalNote}` : '',
  ].filter(Boolean).join('\n');
  if (notes) params.set('technicianNotes', notes);
  return `https://cotizador.evinka.net/?${params.toString()}`;
}

function renderStats() {
  const items = state.conversations;
  const active = items.filter((item) => item.status !== 'resolved');
  const urgent = active.filter((item) => computePriority(item) === 'urgent');
  const risk = active.filter((item) => {
    const tone = computeSla(item).tone;
    return tone === 'warn' || tone === 'danger';
  });
  const resolved = items.filter((item) => item.status === 'resolved');
  els.statsBar.innerHTML = `
    <div class="stat"><span class="muted">Activos</span><strong>${active.length}</strong></div>
    <div class="stat"><span class="muted">Urgentes</span><strong>${urgent.length}</strong></div>
    <div class="stat"><span class="muted">En riesgo</span><strong>${risk.length}</strong></div>
    <div class="stat"><span class="muted">Resueltos</span><strong>${resolved.length}</strong></div>
  `;
}

function filteredConversations() {
  const q = (els.searchInput.value || '').trim().toLowerCase();
  return state.conversations.filter((item) => {
    if (!q) return true;
    return [
      item.customerName,
      item.phonePretty,
      item.phone,
      item.handoffReason,
      item.email,
      item.internalNote,
      item.nextAction,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}

function renderConversationList() {
  const previousScroll = els.conversationList.scrollTop;
  const items = filteredConversations();
  renderStats();
  if (!items.length) {
    els.conversationList.innerHTML = '<div class="empty-state compact-empty"><p>No hay conversaciones para este filtro.</p></div>';
    return;
  }
  els.conversationList.innerHTML = items.map((item) => {
    const priority = computePriority(item);
    const sla = computeSla(item);
    return `
      <article class="conversation-item ${item.id === state.activeId ? 'active' : ''}" data-id="${item.id}">
        <div class="conversation-top">
          <div>
            <div class="conversation-title">${escapeHtml(item.customerName)}</div>
            <div class="conversation-phone">${escapeHtml(item.phonePretty || item.phone || '')}</div>
          </div>
          <div class="conversation-time-block">
            <span class="wait-pill ${sla.tone}">${escapeHtml(waitLabel(item))}</span>
            ${item.unreadCount ? `<span class="unread-pill">${item.unreadCount}</span>` : ''}
          </div>
        </div>
        <div class="conversation-bottom">
          <div class="badges">
            <span class="badge ${item.status}">${escapeHtml(labelStatus(item.status))}</span>
            <span class="badge priority ${priority}">${escapeHtml(priorityLabel(priority))}</span>
            ${item.assignedToLabel ? `<span class="badge neutral">${escapeHtml(item.assignedToLabel)}</span>` : ''}
          </div>
        </div>
        <div class="conversation-preview">${escapeHtml(item.internalNote || item.lastMessageText || item.handoffReason || item.phonePretty)}</div>
        <div class="conversation-footer-row">
          <span class="sla-label ${sla.tone}">${escapeHtml(sla.label)}</span>
          ${item.nextAction ? `<span class="mini-inline">${escapeHtml(labelNextAction(item.nextAction))}</span>` : ''}
        </div>
      </article>
    `;
  }).join('');

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
  const iconLabel = isImage ? '' : (file.fileName.split('.').pop() || 'DOC').slice(0, 4).toUpperCase();
  els.attachmentPreview.classList.remove('hidden');
  els.attachmentPreview.innerHTML = `
    <div class="attachment-preview-main">
      ${isImage
        ? `<img src="${file.previewUrl}" alt="${escapeHtml(file.fileName)}" class="attachment-preview-thumb" />`
        : `<div class="attachment-preview-thumb">${escapeHtml(iconLabel)}</div>`}
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
          <img src="${message.mediaUrl}" alt="${escapeHtml(message.fileName || 'imagen')}" class="message-image" />
        </a>
        ${text ? `<div class="message-text">${text}</div>` : ''}
      </div>
    `;
  }
  const iconLabel = (message.fileName?.split('.').pop() || 'DOC').slice(0, 4).toUpperCase();
  return `
    <div class="message-media">
      <a class="message-file" href="${message.mediaUrl}" target="_blank" rel="noreferrer">
        <div class="message-file-icon">${escapeHtml(iconLabel)}</div>
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
  const disabled = status === 'resolved';
  els.claimBtn.disabled = disabled;
  els.resolveBtn.disabled = disabled;
  els.returnBotBtn.disabled = disabled;
  els.saveCaseMetaBtn.disabled = disabled || state.savingMeta;
  els.createVisitBtn.disabled = disabled;
  els.openQuoteBtn.disabled = disabled;
  els.markReadyCloseBtn.disabled = disabled;
  els.composerInput.disabled = disabled || state.isSendingMessage;
  if (els.composerSendBtn) {
    els.composerSendBtn.disabled = disabled || state.isSendingMessage;
    els.composerSendBtn.textContent = state.isSendingMessage ? 'Enviando...' : 'Enviar';
  }
}

function pushOptimisticMessage({ text = '', type = 'text', fileName = '', mimeType = '', fileSize = 0 }) {
  if (!state.activeConversation?.messages) return;
  const content = type === 'text' ? text : (text || fileName || 'Archivo');
  state.activeConversation.messages.push({
    id: `tmp-${Date.now()}`,
    role: 'advisor',
    advisorName: state.user?.name || 'Asesor EVINKA',
    advisorEmail: state.user?.email || '',
    text: content,
    type,
    fileName,
    mimeType,
    fileSize,
    createdAt: new Date().toISOString(),
  });
  if (state.activeConversation?.conversation) {
    state.activeConversation.conversation.lastMessageText = content;
    state.activeConversation.conversation.lastMessageAt = new Date().toISOString();
  }
  renderConversationDetail({ preserveScroll: true });
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

function renderQuickReplies() {
  els.quickReplies.innerHTML = QUICK_REPLIES.map((reply) => `
    <button type="button" class="quick-reply-chip" data-text="${escapeHtml(reply.text)}">${escapeHtml(reply.label)}</button>
  `).join('');
  document.querySelectorAll('.quick-reply-chip').forEach((button) => {
    button.addEventListener('click', () => {
      const text = button.dataset.text || '';
      els.composerInput.value = text;
      autoResizeComposer();
      els.composerInput.focus();
      els.composerInput.setSelectionRange(els.composerInput.value.length, els.composerInput.value.length);
    });
  });
}

function fillInternalMeta(detail) {
  const conv = detail?.conversation || {};
  els.internalNoteInput.value = conv.internalNote || '';
  els.nextActionSelect.value = conv.nextAction || '';
  els.prioritySelect.value = conv.manualPriority || '';
  els.metaSaveStatus.textContent = '';
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
  const priority = computePriority(detail.conversation);
  const sla = computeSla(detail.conversation);

  els.emptyState.classList.add('hidden');
  els.chatView.classList.remove('hidden');
  els.customerName.textContent = detail.conversation.customerName;
  els.customerMeta.textContent = [detail.conversation.phonePretty, detail.conversation.email].filter(Boolean).join(' · ');
  els.chatSubmeta.textContent = [detail.conversation.district, detail.conversation.province].filter(Boolean).join(' · ');
  els.customerAvatar.textContent = initials(detail.conversation.customerName);
  els.handoffReason.textContent = detail.conversation.handoffReason || 'Solicitud manual del cliente';
  els.caseStatus.textContent = labelStatus(detail.conversation.status);
  els.casePriority.textContent = priorityLabel(priority);
  els.caseSla.textContent = sla.label;
  els.caseStage.textContent = normalizeStage(detail.conversation.step);
  els.assignedTo.textContent = detail.conversation.assignedToLabel || 'Sin asignar';
  els.snapshotPhone.textContent = detail.conversation.phonePretty || detail.conversation.phone || '-';
  els.snapshotEmail.textContent = detail.conversation.email || '-';
  els.snapshotLocation.textContent = [detail.conversation.district, detail.conversation.province].filter(Boolean).join(' · ') || '-';
  els.snapshotAddress.textContent = detail.conversation.installationAddress || detail.conversation.receiptAddress || '-';
  els.snapshotTicket.textContent = detail.conversation.ticketContext || '-';
  els.summaryText.textContent = buildSummary(detail.conversation);
  els.summaryPriorityBadge.textContent = priorityLabel(priority);
  els.summaryPriorityBadge.className = `badge priority ${priority}`;
  fillInternalMeta(detail);
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
  if (refreshActive && state.activeId && !data.some((item) => item.id === state.activeId)) {
    state.activeId = null;
    state.activeConversation = null;
  }
  renderConversationList();
  if (refreshActive && state.activeId && data.some((item) => item.id === state.activeId)) {
    await loadConversation(state.activeId, { skipRefreshList: true, preserveScroll: true });
  } else if (!state.activeConversation) {
    renderConversationDetail();
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

async function saveCaseMeta() {
  if (!state.activeId || state.savingMeta) return;
  state.savingMeta = true;
  els.metaSaveStatus.textContent = 'Guardando...';
  toggleActionButtons(state.activeConversation);
  try {
    const data = await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}/meta`, {
      method: 'PATCH',
      body: JSON.stringify({
        internalNote: els.internalNoteInput.value,
        nextAction: els.nextActionSelect.value,
        manualPriority: els.prioritySelect.value,
      }),
    });
    if (state.activeConversation?.conversation) {
      state.activeConversation.conversation.internalNote = data.state.internalNote || '';
      state.activeConversation.conversation.nextAction = data.state.nextAction || '';
      state.activeConversation.conversation.manualPriority = data.state.manualPriority || '';
    }
    els.metaSaveStatus.textContent = 'Guardado';
    renderConversationDetail({ preserveScroll: true });
    await loadConversations({ refreshActive: false });
  } catch (error) {
    els.metaSaveStatus.textContent = error.message || 'No se pudo guardar';
  } finally {
    state.savingMeta = false;
    toggleActionButtons(state.activeConversation);
  }
}

async function createVisitAction() {
  const conversation = state.activeConversation?.conversation;
  if (!conversation) return;
  const addressSeed = conversation.installationAddress || conversation.receiptAddress || '';
  const clientAddress = window.prompt('Dirección para la visita técnica', addressSeed);
  if (clientAddress === null) return;
  if (!String(clientAddress || '').trim()) {
    alert('Necesito una dirección para crear la visita.');
    return;
  }
  const timeWindow = window.prompt('Rango horario (opcional)', '');
  const notes = [conversation.handoffReason, conversation.internalNote].filter(Boolean).join(' | ');
  try {
    const data = await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}/actions/create-visit`, {
      method: 'POST',
      body: JSON.stringify({
        clientAddress,
        timeWindow: timeWindow === null ? '' : timeWindow,
        notes,
      }),
    });
    const visitId = data.visit?.id ? ` (${data.visit.id})` : '';
    alert(`${data.created ? 'Visita creada' : 'Visita actualizada'}${visitId}.`);
    await loadConversations({ refreshActive: true });
  } catch (error) {
    alert(error.message || 'No pude crear la visita.');
  }
}

function openQuoteAction() {
  const conversation = state.activeConversation?.conversation;
  if (!conversation) return;
  window.open(buildQuoteUrl(conversation), '_blank', 'noopener');
}

async function markReadyCloseAction() {
  if (!state.activeId) return;
  try {
    await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}/actions/ready-close`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    els.nextActionSelect.value = 'cerrar';
    if (!els.prioritySelect.value) els.prioritySelect.value = 'high';
    await saveCaseMeta();
    alert('Caso marcado como listo para cierre.');
  } catch (error) {
    alert(error.message || 'No pude marcar el caso.');
  }
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

  state.isSendingMessage = true;
  toggleActionButtons(state.activeConversation);

  try {
    if (state.pendingAttachment) {
      pushOptimisticMessage({
        text,
        type: (state.pendingAttachment.mimeType || '').startsWith('image/') ? 'image' : 'document',
        fileName: state.pendingAttachment.fileName,
        mimeType: state.pendingAttachment.mimeType,
        fileSize: state.pendingAttachment.fileSize,
      });
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
      pushOptimisticMessage({ text, type: 'text' });
      await api(`/api/inbox/conversations/${encodeURIComponent(state.activeId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    }

    els.composerInput.value = '';
    autoResizeComposer();
    await loadConversation(state.activeId, { skipRefreshList: true, preserveScroll: true });
    await loadConversations({ refreshActive: false });
  } finally {
    state.isSendingMessage = false;
    toggleActionButtons(state.activeConversation);
  }
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
els.openProfileBtn?.addEventListener('click', openProfileDrawer);
els.profileDrawerBackdrop.addEventListener('click', closeProfileDrawer);
els.closeProfileDrawerBtn.addEventListener('click', closeProfileDrawer);
els.saveCaseMetaBtn.addEventListener('click', () => saveCaseMeta());
els.createVisitBtn.addEventListener('click', () => createVisitAction());
els.openQuoteBtn.addEventListener('click', () => openQuoteAction());
els.markReadyCloseBtn.addEventListener('click', () => markReadyCloseAction());

state.pollTimer = setInterval(() => {
  if (state.user) loadConversations({ refreshActive: true }).catch(() => {});
}, 4000);

renderQuickReplies();
autoResizeComposer();
renderAttachmentPreview();
loadMe();
