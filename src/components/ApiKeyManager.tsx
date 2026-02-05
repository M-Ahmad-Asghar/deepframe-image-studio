'use client';

import { useState } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { cn } from '@/lib/utils';
import { Key, Plus, Trash2, AlertCircle, CheckCircle, ExternalLink, Zap } from 'lucide-react';
import { validateApiKey } from '@/lib/gemini';

export function ApiKeyManager() {
  const {
    keys,
    addApiKey,
    removeApiKey,
    resetKeys,
    availableKeysCount,
    activeKeyId,
  } = useApiKeys();

  const [newKey, setNewKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleAddKey = async () => {
    if (!newKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setError('');

    const isValid = await validateApiKey(newKey.trim());

    if (!isValid) {
      setError('Invalid API key. Please check and try again.');
      setIsValidating(false);
      return;
    }

    try {
      addApiKey(newKey.trim(), keyName.trim() || undefined);
      setNewKey('');
      setKeyName('');
      setShowForm(false);
    } catch (e: any) {
      setError(e.message);
    }

    setIsValidating(false);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center">
            <Key className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold">API Keys</h2>
          <span className="badge badge-primary">
            {availableKeysCount}/{keys.length} available
          </span>
        </div>

        {keys.length > 0 && (
          <button
            onClick={resetKeys}
            className="btn text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-2 py-1 rounded-lg hover:bg-[var(--secondary)]"
          >
            Reset limits
          </button>
        )}
      </div>

      {/* Key List */}
      {keys.length > 0 && (
        <div className="space-y-2 mb-4">
          {keys.map((key, index) => {
            const isActive = key.id === activeKeyId;
            // Also show as "last used" if this key has the most recent lastUsed timestamp
            const isLastUsed = !activeKeyId && key.lastUsed &&
              keys.every(k => !k.lastUsed || new Date(key.lastUsed!) >= new Date(k.lastUsed!));
            return (
              <div
                key={key.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border transition-all animate-slide-up hover:scale-[1.01]',
                  key.isLimited
                    ? 'bg-[var(--destructive)]/10 border-[var(--destructive)]/30'
                    : (isActive || isLastUsed)
                    ? 'bg-[var(--primary)]/10 border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/30 glow'
                    : 'bg-[var(--secondary)] border-transparent hover:border-[var(--border)]'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  {key.isLimited ? (
                    <div className="w-8 h-8 rounded-lg bg-[var(--destructive)]/20 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-[var(--destructive)]" />
                    </div>
                  ) : (isActive || isLastUsed) ? (
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-[var(--primary)] animate-bounce-subtle" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{key.name}</p>
                      {(isActive || isLastUsed) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-purple-600 text-white font-medium animate-scale-in">
                          {isActive ? 'ACTIVE' : 'LAST USED'}
                        </span>
                      )}
                      {key.isLimited && (
                        <span className="badge badge-danger text-[10px]">LIMITED</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                      {' • '}{key.usageCount} uses
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeApiKey(key.id)}
                  className="btn btn-icon p-2 hover:bg-[var(--destructive)]/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-[var(--destructive)]" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Key Form */}
      {showForm ? (
        <div className="space-y-3 animate-scale-in">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="input text-sm"
          />
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Paste your Gemini API key"
            className="input text-sm"
          />

          {error && (
            <div className="p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg flex items-center gap-2 animate-scale-in">
              <AlertCircle className="w-4 h-4 text-[var(--destructive)]" />
              <p className="text-xs text-[var(--destructive)]">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAddKey}
              disabled={isValidating}
              className={cn(
                'btn flex-1 px-4 py-2.5 rounded-xl text-sm font-medium',
                isValidating ? 'bg-[var(--primary)]/50' : 'btn-primary'
              )}
            >
              {isValidating ? 'Validating...' : 'Add Key'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError('');
                setNewKey('');
                setKeyName('');
              }}
              className="btn btn-secondary px-4 py-2.5 rounded-xl text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setShowForm(true)}
            className="btn w-full flex items-center justify-center gap-2 px-4 py-3.5 border-2 border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add API Key
          </button>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="btn flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] py-2 rounded-lg hover:bg-[var(--secondary)]"
          >
            <ExternalLink className="w-3 h-3" />
            Get FREE API key from Google AI Studio
          </a>
        </div>
      )}
    </div>
  );
}
