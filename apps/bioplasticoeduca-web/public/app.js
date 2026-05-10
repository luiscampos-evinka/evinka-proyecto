const baseContent = {
  sections: {
    'que-es': {
      title: '¿Qué es el plástico biodegradable?',
      description: 'Es un tipo de plástico diseñado para descomponerse más rápido que el plástico tradicional, generalmente con ayuda de microorganismos, humedad, calor o condiciones especiales.',
      coreCards: [
        { title: 'Plástico tradicional', text: 'Puede tardar cientos de años en degradarse y suele contaminar ríos, mares y suelos.' },
        { title: 'Biodegradable', text: 'Puede degradarse en menos tiempo y reducir parte del impacto ambiental si se usa y desecha correctamente.' },
      ],
      extra: [{ title: 'Impacto ambiental', text: 'Aunque ayuda, no significa que pueda botarse en cualquier lugar. También necesita buena gestión de residuos.' }],
    },
    beneficios: {
      items: [
        { icon: '🌎', title: 'Reduce la contaminación', text: 'Ayuda a disminuir residuos que quedan mucho tiempo en el ambiente.' },
        { icon: '⏱️', title: 'Se descompone más rápido', text: 'En condiciones adecuadas, tarda menos que el plástico convencional.' },
        { icon: '🐢', title: 'Menor impacto en animales', text: 'Puede reducir el daño a ecosistemas y fauna si se gestiona bien.' },
        { icon: '🌽', title: 'Uso de materiales naturales', text: 'Muchos bioplásticos provienen del maíz, almidón u otras fuentes renovables.' },
      ],
      extra: [],
    },
    tipos: {
      items: [
        { title: 'PLA', text: 'Ácido poliláctico. Se obtiene de recursos como maíz o caña de azúcar. Se usa en envases y vasos.' },
        { title: 'PHA', text: 'Polihidroxialcanoatos. Son producidos por microorganismos y pueden degradarse con relativa facilidad.' },
        { title: 'Base de almidón', text: 'Usa almidón vegetal para crear materiales que pueden usarse en bolsas o empaques.' },
      ],
      extra: [],
    },
    aprende: {
      title: 'Bioplástico casero básico',
      materials: ['Almidón', 'Agua', 'Glicerina', 'Vinagre'],
      steps: [
        'Mezcla 1 cucharada de almidón con agua.',
        'Agrega 1 cucharadita de vinagre y unas gotas de glicerina.',
        'Calienta a fuego bajo mientras mezclas.',
        'Cuando espese, extiéndelo sobre una superficie plana.',
        'Déjalo secar hasta formar una lámina.',
      ],
      extra: [{ title: 'Consejo', text: 'Haz este experimento con ayuda de un adulto y sin tocar ollas calientes directamente.' }],
    },
  },
  customQuestions: [],
};

const seedQuestionBank = [
  { topic: 'que-es', source: 'base', question: '¿Qué busca hacer el plástico biodegradable?', answers: ['Descomponerse más rápido que el plástico tradicional', 'Durar más de 500 años', 'Convertirse siempre en vidrio', 'Contaminar menos solo si se quema'], correct: 0 },
  { topic: 'beneficios', source: 'base', question: '¿Cuál es un beneficio del plástico biodegradable?', answers: ['Aumenta el uso de combustibles fósiles', 'Reduce parte de la contaminación', 'Nunca necesita manejo de residuos', 'Es igual al plástico tradicional'], correct: 1 },
  { topic: 'tipos', source: 'base', question: '¿Qué significa PLA?', answers: ['Plástico Libre Animal', 'Polímero Ligero Artificial', 'Ácido poliláctico', 'Papel Laminado Activo'], correct: 2 },
  { topic: 'aprende', source: 'base', question: '¿Cuál de estos materiales puede usarse para hacer bioplástico casero?', answers: ['Almidón', 'Arena', 'Hierro', 'Petróleo'], correct: 0 },
  { topic: 'que-es', source: 'base', question: '¿Qué impacto se busca reducir con mejores materiales?', answers: ['El impacto en animales y ecosistemas', 'La cantidad de árboles en bosques', 'La luz del sol', 'La lluvia en ciudades'], correct: 0 },
  { topic: 'tipos', source: 'base', question: '¿Cuál de estos es un tipo de bioplástico?', answers: ['PHA', 'PVC viejo', 'Acero biodegradable', 'Cartón plástico'], correct: 0 },
  { topic: 'beneficios', source: 'base', question: '¿Qué idea resume mejor esta plataforma?', answers: ['Aprender para usar mejor materiales y cuidar el planeta', 'Usar más plástico sin pensar', 'Evitar toda innovación ecológica', 'Solo memorizar nombres científicos'], correct: 0 },
];

const state = {
  session: null,
  content: structuredClone(baseContent),
  progress: null,
  users: [],
  dynamicQuiz: [],
  quiz: { index: 0, answers: [] },
  deferredPrompt: null,
  authMode: 'login',
};

const screens = [...document.querySelectorAll('[data-screen]')];
const navButtons = [...document.querySelectorAll('[data-go]')];

function isNativeAppShell() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {}
  return location.hostname === 'localhost' || location.protocol === 'capacitor:';
}

function applyRuntimeShellMode() {
  const nativeApp = isNativeAppShell();
  document.body.classList.toggle('native-app', nativeApp);
  if (nativeApp) {
    document.getElementById('installBtn').hidden = true;
  }
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed: ${res.status}`);
  return data;
}

function mergeContent(remote) {
  return {
    sections: {
      'que-es': { ...baseContent.sections['que-es'], extra: [...baseContent.sections['que-es'].extra, ...(remote?.sections?.['que-es']?.extra || [])] },
      beneficios: { ...baseContent.sections.beneficios, extra: [...baseContent.sections.beneficios.extra, ...(remote?.sections?.beneficios?.extra || [])] },
      tipos: { ...baseContent.sections.tipos, extra: [...baseContent.sections.tipos.extra, ...(remote?.sections?.tipos?.extra || [])] },
      aprende: { ...baseContent.sections.aprende, extra: [...baseContent.sections.aprende.extra, ...(remote?.sections?.aprende?.extra || [])] },
    },
    customQuestions: [...baseContent.customQuestions, ...(remote?.customQuestions || [])],
  };
}

function goTo(screen) {
  screens.forEach((item) => item.classList.toggle('active-screen', item.dataset.screen === screen));
  document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.go === screen));
  if (screen === 'quiz') renderQuiz();
  if (screen === 'admin') renderAdminData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setAuthOverlay(visible) {
  document.getElementById('authOverlay').classList.toggle('visible', visible);
}

function showMessage(targetId, message, type = 'error') {
  const node = document.getElementById(targetId);
  node.textContent = message;
  node.className = `inline-message ${type === 'success' ? 'success' : ''}`;
  node.classList.remove('hidden');
}

function clearMessage(targetId) {
  const node = document.getElementById(targetId);
  node.textContent = '';
  node.className = 'inline-message hidden';
}

function userInitials(name = '') {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '--';
}

function labelTopic(topic) {
  return ({ 'que-es': '¿Qué es?', beneficios: 'Beneficios', tipos: 'Tipos', aprende: 'Aprende en casa' })[topic] || 'Tema';
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll('.auth-switch-btn').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
  document.querySelectorAll('.auth-mode').forEach((panel) => {
    const isLogin = panel.id === 'loginForm';
    panel.classList.toggle('hidden', mode === 'login' ? !isLogin : isLogin);
    panel.classList.toggle('active-auth-mode', mode === 'login' ? isLogin : !isLogin);
  });
  clearMessage('authMessage');
}

function setSessionUi() {
  const user = state.session?.user;
  const isAdmin = user?.role === 'admin';
  document.getElementById('sessionName').textContent = user?.name || 'Invitado';
  document.getElementById('sessionEmail').textContent = user?.email || 'Sin sesión';
  document.getElementById('userInitials').textContent = userInitials(user?.name || user?.email || '');
  const roleNode = document.getElementById('sessionRole');
  roleNode.textContent = isAdmin ? 'Admin' : 'Usuario';
  roleNode.className = `role-pill ${isAdmin ? 'role-admin' : 'role-user'}`;
  document.getElementById('sessionStatus').textContent = user ? 'Sesión activa' : 'Esperando ingreso';
  document.getElementById('adminTabBtn').classList.toggle('hidden', !isAdmin);
  document.getElementById('adminModuleCard').classList.toggle('hidden', !isAdmin);
  document.getElementById('accountName').textContent = user?.name || 'Invitado';
  document.getElementById('accountEmail').textContent = user?.email || 'Sin sesión';
  document.getElementById('accountInitials').textContent = userInitials(user?.name || user?.email || '');
  const accountRoleNode = document.getElementById('accountRole');
  accountRoleNode.textContent = isAdmin ? 'Admin' : 'Usuario';
  accountRoleNode.className = `role-pill ${isAdmin ? 'role-admin' : 'role-user'}`;
  document.getElementById('accountStatus').textContent = user ? 'Sesión activa' : 'Sin sesión';
  document.getElementById('accountLastLogin').textContent = user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-PE') : 'Primer ingreso o sin registro';
  document.getElementById('heroMessage').textContent = user
    ? isAdmin ? 'Puedes gestionar contenidos, preguntas y cuentas desde tu panel de administración.' : 'Tu experiencia se ajusta a tu avance para ayudarte a aprender paso a paso.'
    : 'Crea una cuenta o ingresa para acceder a la experiencia completa.';
  document.getElementById('learningRecommendation').textContent = getLearningRecommendation();
  document.getElementById('dailyMission').textContent = getDailyMission();
  document.getElementById('latestScore').textContent = state.progress ? `Último puntaje: ${state.progress.score}/${state.progress.total}` : 'Aún sin quiz';
  document.getElementById('latestWeakTopics').textContent = state.progress?.weakTopics?.length ? `Refuerza: ${state.progress.weakTopics.map(labelTopic).join(', ')}.` : 'Cuando respondas, aquí aparecerá tu resumen.';
  document.getElementById('appModeLabel').textContent = getAppModeLabel();
  document.getElementById('impactSummary').textContent = getImpactSummary();
  document.getElementById('smartModeValue').textContent = getSmartModeValue();
  document.getElementById('progressValue').textContent = getProgressValue();
  document.getElementById('nextStepValue').textContent = getNextStepValue();
}

function getLearningRecommendation() {
  if (!state.session?.user) return 'Ingresa para activar tu avance y repaso dinámico.';
  const weakTopics = state.progress?.weakTopics || [];
  return weakTopics.length ? `Te recomiendo repasar: ${weakTopics.map(labelTopic).join(', ')}.` : 'Empieza por “Fundamentos” y luego entra al quiz adaptativo.';
}

function getDailyMission() {
  if (!state.session?.user) return 'Tu siguiente paso aparecerá aquí automáticamente.';
  const weakTopics = state.progress?.weakTopics || [];
  return weakTopics.length
    ? `Misión de hoy: reforzar ${weakTopics.map(labelTopic).join(', ')} y luego repetir el quiz.`
    : 'Misión de hoy: completa una sección y luego valida tu avance en el quiz.';
}

function getAppModeLabel() {
  if (state.session?.user?.role === 'admin') return 'Administración y aprendizaje';
  return state.session?.user ? 'Aprendizaje guiado' : 'Exploración guiada';
}

function getImpactSummary() {
  if (!state.session?.user) return 'Contenidos, práctica y repaso organizados en una sola experiencia.';
  if (state.progress?.weakTopics?.length) return 'La plataforma detectó temas para reforzar en tu siguiente repaso.';
  if (state.progress) return 'Tu avance quedó registrado para seguir aprendiendo desde donde te quedaste.';
  return 'Tu cuenta está lista para comenzar el recorrido de aprendizaje.';
}

function getSmartModeValue() {
  if (state.progress?.weakTopics?.length) return `Refuerzo en ${state.progress.weakTopics.length} tema(s)`;
  return state.session?.user ? 'Aprendizaje activo' : 'Exploración guiada';
}

function getProgressValue() {
  if (!state.progress) return 'Aún sin medición';
  return `${Math.round((state.progress.score / state.progress.total) * 100)}% dominado`;
}

function getNextStepValue() {
  if (!state.session?.user) return 'Empieza por la base';
  const weakTopics = state.progress?.weakTopics || [];
  return weakTopics.length ? `Volver a ${labelTopic(weakTopics[0])}` : 'Entrar al quiz adaptativo';
}

function renderContent() {
  const content = state.content.sections;
  document.getElementById('queEsTitle').textContent = content['que-es'].title;
  document.getElementById('queEsDescription').textContent = content['que-es'].description;
  document.getElementById('queEsCore').innerHTML = content['que-es'].coreCards.map((item) => `<article class="content-card premium-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join('');
  renderExtraCards('queEsExtra', content['que-es'].extra);

  document.getElementById('benefitsList').innerHTML = content.beneficios.items.map((item) => `<article class="benefit-card premium-card"><span>${escapeHtml(item.icon || '🌿')}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></article>`).join('');
  renderExtraCards('beneficiosExtra', content.beneficios.extra);

  document.getElementById('typesGrid').innerHTML = content.tipos.items.map((item) => `<article class="type-card premium-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join('');
  renderExtraCards('tiposExtra', content.tipos.extra);

  document.getElementById('learnTitle').textContent = content.aprende.title;
  document.getElementById('recipeMaterials').innerHTML = content.aprende.materials.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  document.getElementById('recipeSteps').innerHTML = content.aprende.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  renderExtraCards('aprendeExtra', content.aprende.extra);
}

function renderExtraCards(targetId, items) {
  document.getElementById(targetId).innerHTML = items.map((item) => `<article class="content-card premium-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join('');
}

function generateDynamicQuiz() {
  const weakTopics = state.progress?.weakTopics || [];
  const pool = [...seedQuestionBank, ...state.content.customQuestions.map((item) => ({ ...item, source: 'admin' }))];
  const prioritized = [];
  weakTopics.forEach((topic) => pool.filter((item) => item.topic === topic).forEach((item) => prioritized.push(item)));
  pool.forEach((item) => { if (!prioritized.includes(item)) prioritized.push(item); });
  state.dynamicQuiz = shuffle(prioritized).slice(0, Math.min(7, prioritized.length));
  state.quiz.index = 0;
  state.quiz.answers = Array(state.dynamicQuiz.length).fill(null);
}

function renderQuiz() {
  if (!state.dynamicQuiz.length) generateDynamicQuiz();
  const item = state.dynamicQuiz[state.quiz.index];
  if (!item) return;
  document.getElementById('quizQuestion').textContent = item.question;
  document.getElementById('quizSourceChip').textContent = item.source === 'admin' ? 'Admin' : 'Base';
  document.getElementById('quizTopicChip').textContent = labelTopic(item.topic);
  document.getElementById('quizStepLabel').textContent = `Pregunta ${state.quiz.index + 1} de ${state.dynamicQuiz.length}`;
  document.getElementById('quizProgress').style.width = `${((state.quiz.index + 1) / state.dynamicQuiz.length) * 100}%`;
  document.getElementById('quizModeDescription').textContent = state.progress?.weakTopics?.length ? `Estoy reforzando especialmente: ${state.progress.weakTopics.map(labelTopic).join(', ')}.` : 'Las preguntas combinan base + aportes del admin.';
  document.getElementById('quizAnswers').innerHTML = item.answers.map((answer, index) => `<button class="answer-btn ${state.quiz.answers[state.quiz.index] === index ? 'selected' : ''}" type="button" data-answer="${index}">${escapeHtml(answer)}</button>`).join('');
  document.getElementById('quizNextBtn').disabled = state.quiz.answers[state.quiz.index] == null;
  document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => {
    state.quiz.answers[state.quiz.index] = Number(button.dataset.answer);
    renderQuiz();
  }));
}

async function finishQuiz() {
  const score = state.quiz.answers.reduce((sum, answer, index) => sum + (answer === state.dynamicQuiz[index].correct ? 1 : 0), 0);
  const weakTopics = unique(state.dynamicQuiz.filter((item, index) => state.quiz.answers[index] !== item.correct).map((item) => item.topic));
  state.progress = { score, total: state.dynamicQuiz.length, weakTopics, completedAt: new Date().toISOString() };
  if (state.session?.user) {
    try {
      const result = await api('/api/progress', { method: 'POST', body: state.progress });
      state.progress = result.progress;
    } catch (error) { console.error(error); }
  }
  document.getElementById('resultTitle').textContent = score >= 6 ? '¡Excelente trabajo!' : score >= 4 ? '¡Vas muy bien!' : '¡Buen intento!';
  document.getElementById('resultScore').textContent = `Obtuviste ${score}/${state.dynamicQuiz.length}`;
  document.getElementById('resultMessage').textContent = score >= 6 ? 'Ya manejas bien el tema y puedes explicarlo con claridad.' : score >= 4 ? 'Tienes una buena base. Solo toca reforzar algunos puntos.' : 'No pasa nada. Revisa las secciones y vuelve a intentarlo.';
  document.getElementById('resultInsight').textContent = weakTopics.length ? `Refuerza: ${weakTopics.map(labelTopic).join(', ')}. El siguiente quiz te dará más foco allí.` : 'Muy bien. En el siguiente intento te mezclaré preguntas nuevas para mantener el reto.';
  setSessionUi();
  goTo('resultado');
}

function resetQuiz() {
  generateDynamicQuiz();
  renderQuiz();
  goTo('quiz');
}

function renderAdminData() {
  renderAdminLists();
  renderUsersList();
}

function renderAdminLists() {
  const contentItems = Object.entries(state.content.sections).flatMap(([section, data]) => (data.extra || []).map((item) => ({ section, ...item })));
  document.getElementById('adminContentList').innerHTML = contentItems.length ? contentItems.map((item) => `<article class="stack-item premium-card"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(labelTopic(item.section))}</small><p>${escapeHtml(item.text)}</p></article>`).join('') : '<div class="empty-state">Aún no hay contenido adicional.</div>';
  document.getElementById('adminQuestionList').innerHTML = state.content.customQuestions.length ? state.content.customQuestions.map((item) => `<article class="stack-item premium-card"><strong>${escapeHtml(item.question)}</strong><small>${escapeHtml(labelTopic(item.topic))} · Correcta: ${escapeHtml(item.answers[item.correct] || '')}</small></article>`).join('') : '<div class="empty-state">Aún no hay preguntas personalizadas.</div>';
}

function renderUsersList() {
  const wrap = document.getElementById('adminUsersList');
  if (!wrap) return;
  wrap.innerHTML = state.users.length ? state.users.map((user) => `<article class="stack-item premium-card"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${user.role === 'admin' ? 'Admin' : 'Usuario'}</small><p>${user.hasPassword ? 'Cuenta con contraseña activa.' : 'Cuenta sin contraseña.'}${user.progress ? ` Último quiz: ${user.progress.score}/${user.progress.total}.` : ''}</p></article>`).join('') : '<div class="empty-state">Aún no hay cuentas cargadas.</div>';
}

async function loadContent() {
  const result = await api('/api/content', { method: 'GET' });
  state.content = mergeContent(result.content);
  renderContent();
  renderAdminLists();
  generateDynamicQuiz();
}

async function loadUsers() {
  if (state.session?.user?.role !== 'admin') {
    state.users = [];
    renderUsersList();
    return;
  }
  const result = await api('/api/admin/users', { method: 'GET' });
  state.users = result.users || [];
  renderUsersList();
}

async function loadSession() {
  try {
    const result = await api('/api/auth/session', { method: 'GET' });
    state.session = { user: result.user };
    state.progress = result.progress || null;
    setAuthOverlay(false);
    await loadUsers();
  } catch {
    state.session = null;
    state.progress = null;
    state.users = [];
    setAuthOverlay(true);
  }
  setSessionUi();
}

function bindAuth() {
  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('authMessage');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const button = document.getElementById('loginBtn');
    button.disabled = true;
    button.textContent = 'Ingresando...';
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      state.session = { user: result.user };
      state.progress = result.progress || null;
      setAuthOverlay(false);
      setSessionUi();
      await loadUsers();
      generateDynamicQuiz();
      goTo('inicio');
    } catch (error) {
      showMessage('authMessage', error.message || 'No pude iniciar sesión.');
    } finally {
      button.disabled = false;
      button.textContent = 'Entrar';
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('authMessage');
    const body = {
      name: document.getElementById('registerName').value.trim(),
      email: document.getElementById('registerEmail').value.trim(),
      password: document.getElementById('registerPassword').value,
      confirmPassword: document.getElementById('registerPasswordConfirm').value,
    };
    const button = document.getElementById('registerBtn');
    button.disabled = true;
    button.textContent = 'Creando...';
    try {
      await api('/api/auth/register', { method: 'POST', body });
      showMessage('authMessage', 'Cuenta creada. Ahora puedes ingresar con tu correo y contraseña.', 'success');
      document.getElementById('loginEmail').value = body.email;
      document.getElementById('loginPassword').value = body.password;
      event.target.reset();
      setAuthMode('login');
    } catch (error) {
      showMessage('authMessage', error.message || 'No pude crear la cuenta.');
    } finally {
      button.disabled = false;
      button.textContent = 'Crear cuenta';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch (error) { console.error(error); }
    state.session = null;
    state.progress = null;
    state.users = [];
    setSessionUi();
    setAuthOverlay(true);
    setAuthMode('login');
    goTo('inicio');
  });

  document.getElementById('accountPasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('accountMessage');
    const body = {
      currentPassword: document.getElementById('accountCurrentPassword').value,
      newPassword: document.getElementById('accountNewPassword').value,
      confirmPassword: document.getElementById('accountConfirmPassword').value,
    };
    try {
      const result = await api('/api/auth/change-password', { method: 'POST', body });
      event.target.reset();
      showMessage('accountMessage', result.message || 'Contraseña actualizada.', 'success');
    } catch (error) {
      showMessage('accountMessage', error.message || 'No pude actualizar la contraseña.');
    }
  });
}

function bindNavigation() {
  navButtons.forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.go;
    if (target === 'admin' && state.session?.user?.role !== 'admin') return;
    goTo(target);
  }));
}

function bindQuiz() {
  document.getElementById('quizNextBtn').addEventListener('click', async () => {
    if (state.quiz.answers[state.quiz.index] == null) return;
    if (state.quiz.index === state.dynamicQuiz.length - 1) {
      await finishQuiz();
      return;
    }
    state.quiz.index += 1;
    renderQuiz();
  });
  document.getElementById('quizRestartBtn').addEventListener('click', resetQuiz);
  document.getElementById('retryQuizBtn').addEventListener('click', resetQuiz);
}

function bindAdmin() {
  document.getElementById('adminContentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('adminMessage');
    const body = {
      section: document.getElementById('adminSection').value,
      title: document.getElementById('adminContentTitle').value.trim(),
      text: document.getElementById('adminContentText').value.trim(),
    };
    try {
      const result = await api('/api/content/card', { method: 'POST', body });
      state.content = mergeContent(result.content);
      renderContent();
      renderAdminLists();
      generateDynamicQuiz();
      event.target.reset();
      showMessage('adminMessage', 'Tarjeta guardada.', 'success');
    } catch (error) {
      showMessage('adminMessage', error.message || 'No pude guardar la tarjeta.');
    }
  });

  document.getElementById('adminQuestionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('adminMessage');
    const body = {
      topic: document.getElementById('adminQuestionTopic').value,
      question: document.getElementById('adminQuestionText').value.trim(),
      answers: document.getElementById('adminQuestionAnswers').value.split('|').map((item) => item.trim()).filter(Boolean),
      correct: Number(document.getElementById('adminQuestionCorrect').value),
    };
    try {
      const result = await api('/api/content/question', { method: 'POST', body });
      state.content = mergeContent(result.content);
      renderContent();
      renderAdminLists();
      generateDynamicQuiz();
      event.target.reset();
      showMessage('adminMessage', 'Pregunta guardada.', 'success');
    } catch (error) {
      showMessage('adminMessage', error.message || 'No pude guardar la pregunta.');
    }
  });

  document.getElementById('generateAdminPasswordBtn').addEventListener('click', () => {
    document.getElementById('adminUserPassword').value = generatePassword();
  });

  document.getElementById('adminUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage('adminMessage');
    const body = {
      name: document.getElementById('adminUserName').value.trim(),
      email: document.getElementById('adminUserEmail').value.trim(),
      role: document.getElementById('adminUserRole').value,
      password: document.getElementById('adminUserPassword').value,
    };
    try {
      const result = await api('/api/admin/users', { method: 'POST', body });
      state.users = result.users || [];
      renderUsersList();
      event.target.reset();
      showMessage('adminMessage', `Cuenta creada para ${body.email}.`, 'success');
    } catch (error) {
      showMessage('adminMessage', error.message || 'No pude crear la cuenta.');
    }
  });
}

function bindInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    document.getElementById('installBtn').hidden = false;
  });
  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    document.getElementById('installBtn').hidden = true;
  });
}

function generatePassword(length = 18) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function shuffle(list) {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function unique(list) { return [...new Set(list.filter(Boolean))]; }

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function init() {
  applyRuntimeShellMode();
  bindAuth();
  bindNavigation();
  bindQuiz();
  bindAdmin();
  bindInstall();
  setAuthMode('login');
  await loadContent();
  await loadSession();
  goTo('inicio');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}

init().catch((error) => {
  console.error(error);
  showMessage('authMessage', 'Hubo un problema cargando la app.');
});
