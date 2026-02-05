import { ApiKey, KeyManagerState } from '@/types';
import { generateId } from './utils';

const STORAGE_KEY = 'gem-ai-api-keys';

export function getStoredKeys(): KeyManagerState {
  if (typeof window === 'undefined') {
    return { keys: [], currentKeyIndex: 0, activeKeyId: null };
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { keys: [], currentKeyIndex: 0, activeKeyId: null };
  }

  try {
    const state = JSON.parse(stored);
    // Ensure activeKeyId exists for backward compatibility
    if (state.activeKeyId === undefined) {
      state.activeKeyId = null;
    }
    return state;
  } catch {
    return { keys: [], currentKeyIndex: 0, activeKeyId: null };
  }
}

export function saveKeys(state: KeyManagerState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function addApiKey(key: string, name?: string): ApiKey {
  const state = getStoredKeys();

  // Check if key already exists
  const exists = state.keys.some(k => k.key === key);
  if (exists) {
    throw new Error('This API key already exists');
  }

  const newKey: ApiKey = {
    id: generateId(),
    key,
    name: name || `Key ${state.keys.length + 1}`,
    usageCount: 0,
    lastUsed: null,
    isLimited: false,
    addedAt: new Date().toISOString(),
  };

  state.keys.push(newKey);
  saveKeys(state);

  return newKey;
}

export function removeApiKey(id: string): void {
  const state = getStoredKeys();
  state.keys = state.keys.filter(k => k.id !== id);

  // Adjust current index if needed
  if (state.currentKeyIndex >= state.keys.length) {
    state.currentKeyIndex = Math.max(0, state.keys.length - 1);
  }

  // Clear active key if it was removed
  if (state.activeKeyId === id) {
    state.activeKeyId = null;
  }

  saveKeys(state);
}

export function getNextAvailableKey(): ApiKey | null {
  const state = getStoredKeys();
  const availableKeys = state.keys.filter(k => !k.isLimited);

  if (availableKeys.length === 0) {
    // Reset all keys if all are limited (might have reset)
    const now = new Date();
    state.keys.forEach(k => {
      const lastUsed = k.lastUsed ? new Date(k.lastUsed) : null;
      if (lastUsed && now.getTime() - lastUsed.getTime() > 24 * 60 * 60 * 1000) {
        k.isLimited = false;
        k.usageCount = 0;
      }
    });
    saveKeys(state);

    const resetKeys = state.keys.filter(k => !k.isLimited);
    if (resetKeys.length === 0) {
      state.activeKeyId = null;
      saveKeys(state);
      return null;
    }
    state.activeKeyId = resetKeys[0].id;
    saveKeys(state);
    return resetKeys[0];
  }

  // Round robin selection
  let nextIndex = state.currentKeyIndex;
  for (let i = 0; i < state.keys.length; i++) {
    const idx = (state.currentKeyIndex + i) % state.keys.length;
    if (!state.keys[idx].isLimited) {
      nextIndex = idx;
      break;
    }
  }

  const selectedKey = state.keys[nextIndex];
  state.currentKeyIndex = (nextIndex + 1) % state.keys.length;
  state.activeKeyId = selectedKey.id;
  saveKeys(state);

  return selectedKey;
}

export function getActiveKey(): ApiKey | null {
  const state = getStoredKeys();
  if (!state.activeKeyId) return null;
  return state.keys.find(k => k.id === state.activeKeyId) || null;
}

export function markKeyUsed(id: string): void {
  const state = getStoredKeys();
  const key = state.keys.find(k => k.id === id);

  if (key) {
    key.usageCount += 1;
    key.lastUsed = new Date().toISOString();
    state.activeKeyId = id;
    saveKeys(state);
  }
}

export function markKeyLimited(id: string): void {
  const state = getStoredKeys();
  const key = state.keys.find(k => k.id === id);

  if (key) {
    key.isLimited = true;
    // Clear active if this key was active
    if (state.activeKeyId === id) {
      state.activeKeyId = null;
    }
    saveKeys(state);
  }
}

export function resetAllKeys(): void {
  const state = getStoredKeys();
  state.keys.forEach(k => {
    k.isLimited = false;
    k.usageCount = 0;
  });
  state.currentKeyIndex = 0;
  state.activeKeyId = null;
  saveKeys(state);
}

export function updateKeyName(id: string, name: string): void {
  const state = getStoredKeys();
  const key = state.keys.find(k => k.id === id);

  if (key) {
    key.name = name;
    saveKeys(state);
  }
}
