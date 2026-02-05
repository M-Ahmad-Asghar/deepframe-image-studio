'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { ApiKey, KeyManagerState } from '@/types';
import {
  getStoredKeys,
  addApiKey as addKey,
  removeApiKey as removeKey,
  getNextAvailableKey,
  markKeyUsed,
  markKeyLimited,
  resetAllKeys,
  updateKeyName,
} from '@/lib/keyManager';

// Global state to sync across components
let listeners: Array<() => void> = [];
let cachedState: KeyManagerState = { keys: [], currentKeyIndex: 0, activeKeyId: null };

// Cached server snapshot to avoid infinite loop
const serverSnapshot: KeyManagerState = { keys: [], currentKeyIndex: 0, activeKeyId: null };

function getSnapshot(): KeyManagerState {
  return cachedState;
}

function getServerSnapshot(): KeyManagerState {
  return serverSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emitChange() {
  cachedState = getStoredKeys();
  for (const listener of listeners) {
    listener();
  }
}

// Initialize cache
if (typeof window !== 'undefined') {
  cachedState = getStoredKeys();

  // Listen for storage changes (cross-tab sync)
  window.addEventListener('storage', (e) => {
    if (e.key === 'gem-ai-api-keys') {
      emitChange();
    }
  });
}

export function useApiKeys() {
  // Use useSyncExternalStore for consistent state across components
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot // Use cached server snapshot to avoid infinite loop
  );

  // Also trigger re-render on mount to get initial state
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    emitChange();
    forceUpdate((n) => n + 1);
  }, []);

  const addApiKey = useCallback((key: string, name?: string) => {
    const newKey = addKey(key, name);
    emitChange();
    return newKey;
  }, []);

  const removeApiKey = useCallback((id: string) => {
    removeKey(id);
    emitChange();
  }, []);

  const getNextKey = useCallback(() => {
    const key = getNextAvailableKey();
    emitChange();
    return key;
  }, []);

  const useKey = useCallback((id: string) => {
    markKeyUsed(id);
    emitChange();
  }, []);

  const limitKey = useCallback((id: string) => {
    markKeyLimited(id);
    emitChange();
  }, []);

  const resetKeys = useCallback(() => {
    resetAllKeys();
    emitChange();
  }, []);

  const renameKey = useCallback((id: string, name: string) => {
    updateKeyName(id, name);
    emitChange();
  }, []);

  // Get active key from state
  const activeKey = state.activeKeyId
    ? state.keys.find(k => k.id === state.activeKeyId) || null
    : null;

  return {
    keys: state.keys,
    isLoading: false,
    addApiKey,
    removeApiKey,
    getNextKey,
    useKey,
    limitKey,
    resetKeys,
    renameKey,
    hasKeys: state.keys.length > 0,
    availableKeysCount: state.keys.filter((k) => !k.isLimited).length,
    activeKey,
    activeKeyId: state.activeKeyId,
  };
}
