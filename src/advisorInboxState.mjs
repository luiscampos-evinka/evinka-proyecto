import fs from 'node:fs';
import path from 'node:path';

export const ADVISOR_STATE_PATH = process.env.ADVISOR_STATE_PATH || '/root/.openclaw/workspace/data/advisor-inbox-state.json';

function defaultState() {
  return {
    conversations: {},
  };
}

export function ensureAdvisorStateFile(filePath = ADVISOR_STATE_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultState(), null, 2));
  }
}

export function loadAdvisorState(filePath = ADVISOR_STATE_PATH) {
  ensureAdvisorStateFile(filePath);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : defaultState();
    parsed.conversations ||= {};
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveAdvisorState(state, filePath = ADVISOR_STATE_PATH) {
  ensureAdvisorStateFile(filePath);
  const next = state && typeof state === 'object' ? state : defaultState();
  next.conversations ||= {};
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
}

export function patchAdvisorConversation(conversationId, updater, filePath = ADVISOR_STATE_PATH) {
  const state = loadAdvisorState(filePath);
  const current = state.conversations[conversationId] || {};
  const next = updater({ ...current }) || current;
  state.conversations[conversationId] = {
    unreadCount: 0,
    internalStatus: 'new',
    tags: [],
    ...next,
    updatedAt: new Date().toISOString(),
  };
  saveAdvisorState(state, filePath);
  return state.conversations[conversationId];
}

export function getAdvisorConversationState(conversationId, filePath = ADVISOR_STATE_PATH) {
  const state = loadAdvisorState(filePath);
  return state.conversations[conversationId] || null;
}
