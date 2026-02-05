'use client';

import { useState, useCallback } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { generateGrid } from '@/lib/gemini';
import { cn, generateId, downloadImage } from '@/lib/utils';
import {
  LayoutGrid,
  Loader2,
  Download,
  AlertCircle,
  Wand2,
  Copy,
  Check,
  Upload,
  X,
  ImagePlus,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { AspectRatio, ReferenceImage } from '@/types';

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: 'free', label: 'Free (Auto)' },
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Landscape' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '4:3', label: '4:3 Standard' },
  { value: '3:4', label: '3:4 Tall' },
];

interface GeneratedGrid {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: string;
}

export function GridMaker() {
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedGrid, setGeneratedGrid] = useState<GeneratedGrid | null>(null);
  const [copied, setCopied] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [showModifyInput, setShowModifyInput] = useState(false);

  const { getNextKey, useKey, limitKey, hasKeys } = useApiKeys();

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: ReferenceImage[] = files
      .filter(file => file.type.startsWith('image/'))
      .slice(0, 20 - referenceImages.length) // Max 20 reference images
      .map(file => ({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
      }));
    setReferenceImages(prev => [...prev, ...newImages]);
  }, [referenceImages.length]);

  const removeImage = useCallback((id: string) => {
    setReferenceImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (!hasKeys) {
      setError('Please add an API key first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const apiKey = getNextKey();
    if (!apiKey) {
      setError('No API key available');
      setIsGenerating(false);
      return;
    }

    try {
      const result = await generateGrid(
        apiKey.key,
        prompt.trim(),
        referenceImages,
        aspectRatio
      );

      if (result.success && result.images?.[0]) {
        useKey(apiKey.id);
        setGeneratedGrid({
          id: generateId(),
          prompt: prompt.trim(),
          imageUrl: result.images[0],
          timestamp: new Date().toISOString(),
        });
      } else {
        if (result.error === 'RATE_LIMITED') {
          limitKey(apiKey.id);
          setError('Rate limited. Please try again or add more API keys.');
        } else {
          setError(result.error || 'Failed to generate grid');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, referenceImages, aspectRatio, hasKeys, getNextKey, useKey, limitKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  // Convert base64/dataURL to File object
  const dataURLtoFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  // Regenerate/modify the grid using the current grid as reference
  const handleRegenerate = useCallback(async () => {
    if (!modifyPrompt.trim() || !generatedGrid) {
      setError('Please enter modification instructions');
      return;
    }

    if (!hasKeys) {
      setError('Please add an API key first');
      return;
    }

    const apiKey = getNextKey();
    if (!apiKey) {
      setError('No available API keys. Please add more keys or wait for rate limits to reset.');
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      // Convert generated grid to File for reference
      const gridFile = await dataURLtoFile(generatedGrid.imageUrl, 'grid-reference.png');

      // Create reference image from the generated grid
      const gridReference: ReferenceImage = {
        id: generateId(),
        file: gridFile,
        preview: generatedGrid.imageUrl,
      };

      // Combine original prompt with modification instructions
      const modifiedPrompt = `Original grid prompt: "${generatedGrid.prompt}"

MODIFICATION REQUEST: ${modifyPrompt.trim()}

Please regenerate this grid with the requested modifications while keeping the same grid structure (2x2 with numbered cells 1-4).`;

      const result = await generateGrid(
        apiKey.key,
        modifiedPrompt,
        [gridReference, ...referenceImages], // Grid as first reference
        aspectRatio
      );

      useKey(apiKey.id);

      if (result.success && result.images && result.images.length > 0) {
        setGeneratedGrid({
          id: generateId(),
          prompt: `${generatedGrid.prompt} [Modified: ${modifyPrompt.trim()}]`,
          imageUrl: result.images[0],
          timestamp: new Date().toISOString(),
        });
        setModifyPrompt('');
        setShowModifyInput(false);
      } else {
        if (result.error === 'RATE_LIMITED') {
          limitKey(apiKey.id);
          setError('Rate limited. Please try again or add more API keys.');
        } else {
          setError(result.error || 'Failed to regenerate grid');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsRegenerating(false);
    }
  }, [modifyPrompt, generatedGrid, referenceImages, aspectRatio, hasKeys, getNextKey, useKey, limitKey]);

  const copyGridInfo = () => {
    if (generatedGrid) {
      const info = `Prompt: ${generatedGrid.prompt}`;
      navigator.clipboard.writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <LayoutGrid className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold">Grid Maker</h2>
          <p className="text-xs text-[var(--muted-foreground)]">Generate numbered grid images</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Prompt Input */}
        <div>
          <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to generate as a grid of variations..."
            rows={3}
            disabled={isGenerating}
            className="input text-sm py-3 resize-none"
          />
        </div>

        {/* Reference Images */}
        <div>
          <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">
            Reference Images (Optional)
          </label>

          <div className="flex flex-wrap gap-2">
            {/* Uploaded Images */}
            {referenceImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.preview}
                  alt="Reference"
                  className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-[var(--destructive)] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* Upload Button */}
            {referenceImages.length < 20 && (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all">
                <ImagePlus className="w-5 h-5 text-[var(--muted-foreground)]" />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isGenerating}
                />
              </label>
            )}
          </div>

          {referenceImages.length > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
              {referenceImages.length}/20 reference images
            </p>
          )}
        </div>

        {/* Aspect Ratio */}
        <div>
          <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">
            Aspect Ratio
          </label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.value}
                onClick={() => setAspectRatio(ar.value)}
                disabled={isGenerating}
                className={cn(
                  'btn px-3 py-1.5 rounded-lg text-sm',
                  aspectRatio === ar.value
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/25'
                    : 'bg-[var(--secondary)] hover:bg-[var(--muted)]'
                )}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-[var(--secondary)] rounded-xl">
          <p className="text-xs text-[var(--muted-foreground)]">
            💡 Grid Maker will generate a grid of image variations with <strong>numbered cells</strong> in each corner.
            You can then use <strong>Grid Extractor</strong> to extract individual cells in high quality.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--destructive)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--destructive)]">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !hasKeys}
          className={cn(
            'btn w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold',
            isGenerating
              ? 'bg-green-600/50 cursor-wait'
              : hasKeys
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Grid...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Grid
            </>
          )}
        </button>

        {!hasKeys && (
          <p className="text-center text-xs text-[var(--muted-foreground)]">
            Add an API key to start generating
          </p>
        )}

        {/* Generated Grid */}
        {generatedGrid && (
          <div className="space-y-3 animate-scale-in">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Generated Grid</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModifyInput(!showModifyInput)}
                  className={cn(
                    "btn p-2 rounded-lg transition-all",
                    showModifyInput
                      ? "bg-orange-600 text-white"
                      : "bg-[var(--secondary)] hover:bg-[var(--muted)]"
                  )}
                  title="Modify grid"
                  disabled={isRegenerating}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={copyGridInfo}
                  className="btn p-2 bg-[var(--secondary)] rounded-lg hover:bg-[var(--muted)] transition-all"
                  title="Copy prompt"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => downloadImage(generatedGrid.imageUrl, `grid-${Date.now()}.png`)}
                  className="btn p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                  title="Download grid"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modify/Regenerate Input */}
            {showModifyInput && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-2 animate-scale-in">
                <p className="text-xs text-orange-400 font-medium">
                  ✏️ Modify this grid - describe what changes you want
                </p>
                <textarea
                  value={modifyPrompt}
                  onChange={(e) => setModifyPrompt(e.target.value)}
                  placeholder="e.g., Make the lighting warmer, add more contrast, change background to blue..."
                  rows={2}
                  disabled={isRegenerating}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !modifyPrompt.trim()}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    isRegenerating
                      ? "bg-orange-600/50 cursor-wait"
                      : modifyPrompt.trim()
                      ? "bg-orange-600 text-white hover:bg-orange-700"
                      : "bg-gray-600/50 text-gray-400 cursor-not-allowed"
                  )}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Regenerate Grid
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="rounded-xl overflow-hidden border border-[var(--border)]">
              <img
                src={generatedGrid.imageUrl}
                alt="Generated grid"
                className="w-full"
              />
            </div>
            <p className="text-xs text-center text-[var(--primary)]">
              💡 Download this grid and use it in Grid Extractor to extract individual cells
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
