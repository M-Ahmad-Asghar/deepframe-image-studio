'use client';

import { useState, useCallback } from 'react';
import { GeneratedImage, GenerationRequest, ReferenceImage, AspectRatio, ImageSize } from '@/types';
import { generateImage } from '@/lib/gemini';
import { useApiKeys } from './useApiKeys';
import { generateId } from '@/lib/utils';

const HISTORY_KEY = 'gem-ai-history';
const MAX_HISTORY = 20; // Reduced due to large base64 images

function getStoredHistory(): GeneratedImage[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveHistory(history: GeneratedImage[]) {
  if (typeof window === 'undefined') return;

  const limitedHistory = history.slice(0, MAX_HISTORY);

  // Try to save, if quota exceeded, reduce history size
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
  } catch (e) {
    // Quota exceeded - try with fewer items
    console.warn('localStorage quota exceeded, reducing history size');

    // Try progressively smaller sizes
    for (let size = Math.floor(limitedHistory.length / 2); size > 0; size = Math.floor(size / 2)) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory.slice(0, size)));
        console.log(`History saved with ${size} items`);
        return;
      } catch {
        continue;
      }
    }

    // If all else fails, clear history
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore
    }
  }
}

export function useGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[]>(() => getStoredHistory());

  const { getNextKey, useKey, limitKey, hasKeys, availableKeysCount } = useApiKeys();

  const generate = useCallback(
    async (
      prompt: string,
      referenceImages: ReferenceImage[] = [],
      aspectRatio: AspectRatio = '1:1',
      imageSize: ImageSize = '1K'
    ) => {
      setError(null);
      setIsGenerating(true);
      setGeneratedImages([]);

      if (!hasKeys) {
        setError('Please add an API key first');
        setIsGenerating(false);
        return;
      }

      const request: GenerationRequest = {
        prompt,
        referenceImages,
        aspectRatio,
        imageSize,
      };

      let attempts = 0;
      const maxAttempts = Math.max(availableKeysCount, 1);

      while (attempts < maxAttempts) {
        const apiKey = getNextKey();

        if (!apiKey) {
          setError('All API keys have reached their limits. Add more keys or wait 24 hours.');
          setIsGenerating(false);
          return;
        }

        const result = await generateImage(apiKey.key, request);

        if (result.success && result.images) {
          useKey(apiKey.id);

          const newImages: GeneratedImage[] = result.images.map((img) => ({
            id: generateId(),
            prompt,
            imageUrl: img,
            timestamp: new Date().toISOString(),
            referenceCount: referenceImages.length,
            aspectRatio,
            imageSize,
          }));

          setGeneratedImages(newImages);

          // Add to history
          const updatedHistory = [...newImages, ...history];
          setHistory(updatedHistory);
          saveHistory(updatedHistory);

          setIsGenerating(false);
          return;
        }

        if (result.error === 'RATE_LIMITED') {
          limitKey(apiKey.id);
          attempts++;
          continue;
        }

        // Other errors - don't retry
        setError(result.error || 'Generation failed');
        setIsGenerating(false);
        return;
      }

      setError('All API keys have reached their limits. Add more keys or wait 24 hours.');
      setIsGenerating(false);
    },
    [hasKeys, availableKeysCount, getNextKey, useKey, limitKey, history]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((img) => img.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  return {
    isGenerating,
    error,
    generatedImages,
    history,
    generate,
    clearHistory,
    removeFromHistory,
    setError,
  };
}
