'use client';

import { useState } from 'react';
import { useGeneration } from '@/hooks/useGeneration';
import { useApiKeys } from '@/hooks/useApiKeys';
import { ReferenceImage, AspectRatio, ImageSize } from '@/types';
import { ReferenceUpload } from './ReferenceUpload';
import { GeneratedGallery } from './GeneratedGallery';
import { ApiKeyManager } from './ApiKeyManager';
import { ImagePreview } from './ImagePreview';
import { GridExtractor } from './GridExtractor';
import ReferenceGenerator from './ReferenceGenerator';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Wand2,
  History,
  Trash2,
  Settings,
  X,
  RatioIcon,
  Maximize,
  Key,
  Zap,
  Grid3X3,
  Users,
} from 'lucide-react';

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: 'free', label: 'Free', icon: '🎨' },
  { value: '1:1', label: 'Square', icon: '⬜' },
  { value: '16:9', label: 'Landscape', icon: '🖼️' },
  { value: '9:16', label: 'Portrait', icon: '📱' },
  { value: '4:3', label: 'Standard', icon: '🖥️' },
  { value: '3:4', label: 'Tall', icon: '📋' },
];

const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: '1K', label: '1K (1024px)' },
  { value: '2K', label: '2K (2048px)' },
];

type TabType = 'generate' | 'extract' | 'references';

export function ImageGenerator() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [previewImage, setPreviewImage] = useState<{ url: string; prompt: string } | null>(null);

  const { hasKeys, availableKeysCount, activeKey } = useApiKeys();
  const {
    isGenerating,
    error,
    generatedImages,
    history,
    generate,
    clearHistory,
    removeFromHistory,
    setError,
  } = useGeneration();

  const handleGenerate = () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    generate(prompt.trim(), referenceImages, aspectRatio, imageSize);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  const handleImageClick = (imageUrl: string, imagePrompt: string) => {
    setPreviewImage({ url: imageUrl, prompt: imagePrompt });
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreview
          imageUrl={previewImage.url}
          prompt={previewImage.prompt}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center animate-pulse-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text">GemAI</h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                Free AI Image Generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Key Indicator */}
            {activeKey && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 animate-scale-in">
                <Zap className="w-3 h-3 text-[var(--primary)] animate-bounce-subtle" />
                <span className="text-xs text-[var(--primary)] font-medium">
                  {activeKey.name}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  ({activeKey.usageCount} uses)
                </span>
              </div>
            )}

            {hasKeys && (
              <span className="badge badge-success">
                {availableKeysCount} key{availableKeysCount !== 1 ? 's' : ''} available
              </span>
            )}

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                'btn btn-icon',
                showHistory
                  ? 'bg-[var(--primary)] text-white glow'
                  : 'hover:bg-[var(--secondary)]'
              )}
              title="History"
            >
              <History className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'btn btn-icon',
                showSettings
                  ? 'bg-[var(--primary)] text-white glow'
                  : 'hover:bg-[var(--secondary)]'
              )}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Generator */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab Switcher */}
            <div className="flex gap-2 p-1.5 bg-[var(--secondary)] rounded-xl">
              <button
                onClick={() => setActiveTab('generate')}
                className={cn(
                  'tab-button',
                  activeTab === 'generate' && 'active'
                )}
              >
                <Wand2 className="w-4 h-4" />
                Generate
              </button>
              <button
                onClick={() => setActiveTab('extract')}
                className={cn(
                  'tab-button',
                  activeTab === 'extract' && 'active'
                )}
              >
                <Grid3X3 className="w-4 h-4" />
                Grid Extractor
              </button>
              <button
                onClick={() => setActiveTab('references')}
                className={cn(
                  'tab-button',
                  activeTab === 'references' && 'active'
                )}
              >
                <Users className="w-4 h-4" />
                References
              </button>
            </div>

            {/* Grid Extractor Tab */}
            {activeTab === 'extract' && (
              <GridExtractor />
            )}

            {/* Reference Generator Tab */}
            {activeTab === 'references' && activeKey && (
              <div className="card p-5">
                <ReferenceGenerator apiKey={activeKey.key} />
              </div>
            )}
            {activeTab === 'references' && !activeKey && (
              <div className="card p-5 text-center">
                <p className="text-[var(--muted-foreground)]">Please add an API key first</p>
              </div>
            )}

            {/* Generate Tab */}
            {activeTab === 'generate' && (
            <>
            {/* Prompt Input */}
            <div className="card card-hover p-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to generate..."
                rows={4}
                className="w-full bg-transparent resize-none focus:outline-none text-lg placeholder:text-[var(--muted-foreground)]"
              />

              {/* Image Options */}
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="flex flex-wrap gap-4">
                  {/* Aspect Ratio */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <RatioIcon className="w-4 h-4 text-[var(--primary)]" />
                      Aspect Ratio
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.value}
                          onClick={() => setAspectRatio(ratio.value)}
                          className={cn(
                            'btn px-3 py-1.5 rounded-lg text-sm',
                            aspectRatio === ratio.value
                              ? 'bg-[var(--primary)] text-white shadow-lg shadow-purple-500/25'
                              : 'bg-[var(--secondary)] hover:bg-[var(--muted)] hover:scale-105'
                          )}
                        >
                          <span className="mr-1">{ratio.icon}</span>
                          {ratio.value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Size */}
                  <div className="min-w-[150px]">
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Maximize className="w-4 h-4 text-[var(--primary)]" />
                      Image Size
                    </label>
                    <div className="flex gap-2">
                      {IMAGE_SIZES.map((size) => (
                        <button
                          key={size.value}
                          onClick={() => setImageSize(size.value)}
                          className={cn(
                            'btn px-3 py-1.5 rounded-lg text-sm',
                            imageSize === size.value
                              ? 'bg-[var(--primary)] text-white shadow-lg shadow-purple-500/25'
                              : 'bg-[var(--secondary)] hover:bg-[var(--muted)] hover:scale-105'
                          )}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference Images */}
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <ReferenceUpload
                  images={referenceImages}
                  onChange={setReferenceImages}
                  maxImages={20}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-[var(--destructive)] shrink-0 mt-0.5" />
                  <p className="text-sm text-[var(--destructive)]">{error}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !hasKeys}
                className={cn(
                  'btn mt-4 w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2',
                  isGenerating
                    ? 'bg-[var(--primary)]/50 cursor-wait'
                    : hasKeys
                    ? 'btn-primary animate-pulse-glow'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Generate Image
                  </>
                )}
              </button>

              {!hasKeys && (
                <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
                  Add an API key to start generating
                </p>
              )}

              <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
                Press Cmd/Ctrl + Enter to generate
              </p>
            </div>

            {/* Generated Images */}
            {generatedImages.length > 0 && (
              <GeneratedGallery
                images={generatedImages}
                title="Generated"
                showPrompt={false}
                onImageClick={handleImageClick}
              />
            )}

            {/* History (Mobile) */}
            {showHistory && history.length > 0 && (
              <div className="lg:hidden">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <History className="w-5 h-5 text-[var(--primary)]" />
                    History
                  </h2>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-[var(--destructive)] flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </div>
                <GeneratedGallery
                  images={history}
                  onRemove={removeFromHistory}
                  title=""
                  onImageClick={handleImageClick}
                />
              </div>
            )}
            </>
            )}
          </div>

          {/* Right Column - Settings & History */}
          <div className="space-y-6">
            {/* API Key Manager */}
            <div className={cn(showSettings ? 'block' : 'hidden lg:block')}>
              <ApiKeyManager />
            </div>

            {/* History (Desktop) */}
            <div className="hidden lg:block">
              {history.length > 0 && (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2">
                      <History className="w-5 h-5 text-[var(--primary)]" />
                      History
                    </h2>
                    <button
                      onClick={clearHistory}
                      className="btn text-xs text-[var(--destructive)] flex items-center gap-1 hover:underline px-2 py-1 rounded-lg hover:bg-[var(--destructive)]/10"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {history.slice(0, 10).map((img) => (
                      <div
                        key={img.id}
                        className="flex gap-3 p-2 rounded-lg hover:bg-[var(--secondary)] transition-all group cursor-pointer hover:scale-[1.02]"
                        onClick={() => handleImageClick(img.imageUrl, img.prompt)}
                      >
                        <div className="image-hover">
                          <img
                            src={img.imageUrl}
                            alt={img.prompt}
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2">{img.prompt}</p>
                          <p className="text-xs text-[var(--muted-foreground)] mt-1">
                            {new Date(img.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(img.id);
                          }}
                          className="btn btn-icon p-1 opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4 text-[var(--muted-foreground)]" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {history.length > 10 && (
                    <p className="text-xs text-center text-[var(--muted-foreground)] mt-3">
                      +{history.length - 10} more images
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="card p-4">
              <h3 className="font-medium mb-3 gradient-text">How it works</h3>
              <ul className="text-sm text-[var(--muted-foreground)] space-y-3">
                <li className="flex items-start gap-3 animate-slide-up" style={{ animationDelay: '0ms' }}>
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  Get a FREE API key from Google AI Studio
                </li>
                <li className="flex items-start gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  Add your key(s) above
                </li>
                <li className="flex items-start gap-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  Enter a prompt and generate!
                </li>
                <li className="flex items-start gap-3 animate-slide-up" style={{ animationDelay: '150ms' }}>
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">4</span>
                  Add more keys for more daily images
                </li>
              </ul>

              <div className="mt-4 p-3 bg-gradient-to-r from-[var(--primary)]/20 to-purple-600/20 rounded-lg border border-[var(--primary)]/30">
                <p className="text-xs text-[var(--primary)] font-medium">
                  ✨ Each FREE key = ~100 images/day
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
