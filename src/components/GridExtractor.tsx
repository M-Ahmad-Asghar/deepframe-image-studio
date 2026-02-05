'use client';

import { useState, useCallback } from 'react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { extractGridCell, regenerateGridCell } from '@/lib/gemini';
import { cn, generateId, downloadImage } from '@/lib/utils';
import {
  Grid3X3,
  Upload,
  X,
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { AspectRatio } from '@/types';

interface ExtractedImage {
  id: string;
  row: number;
  col: number;
  imageUrl: string | null;
  status: 'pending' | 'extracting' | 'done' | 'error';
  error?: string;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: 'free', label: 'Free (Auto)' },
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Landscape' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '4:3', label: '4:3 Standard' },
  { value: '3:4', label: '3:4 Tall' },
];

export function GridExtractor() {
  const [gridImage, setGridImage] = useState<{ file: File; preview: string } | null>(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentCell, setCurrentCell] = useState<{ row: number; col: number } | null>(null);
  const [previewImage, setPreviewImage] = useState<ExtractedImage | null>(null);
  const [regenerateModal, setRegenerateModal] = useState<ExtractedImage | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { getNextKey, useKey, limitKey, hasKeys } = useApiKeys();

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setGridImage({
        file,
        preview: URL.createObjectURL(file),
      });
      setExtractedImages([]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setGridImage({
        file,
        preview: URL.createObjectURL(file),
      });
      setExtractedImages([]);
    }
  }, []);

  const initializeGrid = useCallback(() => {
    const images: ExtractedImage[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        images.push({
          id: generateId(),
          row: r,
          col: c,
          imageUrl: null,
          status: 'pending',
        });
      }
    }
    setExtractedImages(images);
  }, [rows, cols]);

  const startExtraction = useCallback(async () => {
    if (!gridImage || !hasKeys) return;

    initializeGrid();
    setIsExtracting(true);
    setIsPaused(false);

    const totalCells = rows * cols;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        // Check if paused
        if (isPaused) {
          setIsExtracting(false);
          return;
        }

        const cellIndex = (r - 1) * cols + (c - 1);
        setCurrentCell({ row: r, col: c });

        // Update status to extracting
        setExtractedImages(prev =>
          prev.map((img, idx) =>
            idx === cellIndex ? { ...img, status: 'extracting' } : img
          )
        );

        // Get API key
        const apiKey = getNextKey();
        if (!apiKey) {
          setExtractedImages(prev =>
            prev.map((img, idx) =>
              idx >= cellIndex ? { ...img, status: 'error', error: 'No API key available' } : img
            )
          );
          setIsExtracting(false);
          return;
        }

        try {
          const result = await extractGridCell(
            apiKey.key,
            gridImage.file,
            r,
            c,
            rows,
            cols,
            aspectRatio
          );

          if (result.success && result.images?.[0]) {
            useKey(apiKey.id);
            setExtractedImages(prev =>
              prev.map((img, idx) =>
                idx === cellIndex
                  ? { ...img, status: 'done', imageUrl: result.images![0] }
                  : img
              )
            );
          } else {
            if (result.error === 'RATE_LIMITED') {
              limitKey(apiKey.id);
              // Retry with next key
              c--;
              continue;
            }
            setExtractedImages(prev =>
              prev.map((img, idx) =>
                idx === cellIndex
                  ? { ...img, status: 'error', error: result.error }
                  : img
              )
            );
          }
        } catch (error: any) {
          setExtractedImages(prev =>
            prev.map((img, idx) =>
              idx === cellIndex
                ? { ...img, status: 'error', error: error.message }
                : img
            )
          );
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsExtracting(false);
    setCurrentCell(null);
  }, [gridImage, hasKeys, rows, cols, aspectRatio, isPaused, getNextKey, useKey, limitKey, initializeGrid]);

  const pauseExtraction = () => {
    setIsPaused(true);
  };

  const regenerateCell = useCallback(async (img: ExtractedImage, prompt?: string) => {
    if (!gridImage || !hasKeys) return;

    setIsRegenerating(true);
    const cellIndex = extractedImages.findIndex(i => i.id === img.id);

    // Update status to extracting
    setExtractedImages(prev =>
      prev.map((i, idx) =>
        idx === cellIndex ? { ...i, status: 'extracting', error: undefined } : i
      )
    );

    const apiKey = getNextKey();
    if (!apiKey) {
      setExtractedImages(prev =>
        prev.map((i, idx) =>
          idx === cellIndex ? { ...i, status: 'error', error: 'No API key available' } : i
        )
      );
      setIsRegenerating(false);
      return;
    }

    try {
      // Use AI-based regeneration for custom prompts and enhancement
      const result = await regenerateGridCell(
        apiKey.key,
        gridImage.file,
        img.row,
        img.col,
        rows,
        cols,
        aspectRatio,
        prompt
      );

      if (result.success && result.images?.[0]) {
        useKey(apiKey.id);
        setExtractedImages(prev =>
          prev.map((i, idx) =>
            idx === cellIndex
              ? { ...i, status: 'done', imageUrl: result.images![0] }
              : i
          )
        );
      } else {
        if (result.error === 'RATE_LIMITED') {
          limitKey(apiKey.id);
        }
        setExtractedImages(prev =>
          prev.map((i, idx) =>
            idx === cellIndex
              ? { ...i, status: 'error', error: result.error }
              : i
          )
        );
      }
    } catch (error: any) {
      setExtractedImages(prev =>
        prev.map((i, idx) =>
          idx === cellIndex
            ? { ...i, status: 'error', error: error.message }
            : i
        )
      );
    }

    setIsRegenerating(false);
    setRegenerateModal(null);
    setCustomPrompt('');
  }, [gridImage, hasKeys, extractedImages, rows, cols, aspectRatio, getNextKey, useKey, limitKey]);

  const resetExtraction = () => {
    setExtractedImages([]);
    setIsExtracting(false);
    setIsPaused(false);
    setCurrentCell(null);
  };

  const downloadAll = () => {
    extractedImages
      .filter(img => img.status === 'done' && img.imageUrl)
      .forEach((img, idx) => {
        setTimeout(() => {
          downloadImage(img.imageUrl!, `grid-${img.row}-${img.col}.png`);
        }, idx * 500);
      });
  };

  const completedCount = extractedImages.filter(img => img.status === 'done').length;
  const totalCount = rows * cols;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center">
          <Grid3X3 className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-semibold">Grid Extractor</h2>
      </div>

      {/* Grid Image Upload */}
      {!gridImage ? (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--secondary)] flex items-center justify-center group-hover:bg-[var(--primary)]/10 group-hover:scale-110 transition-all">
            <Upload className="w-8 h-8 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Upload Grid Image</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Drop a grid image or click to upload
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative group">
            <img
              src={gridImage.preview}
              alt="Grid"
              className="w-full rounded-xl max-h-64 object-contain bg-black/20"
            />
            <button
              onClick={() => {
                URL.revokeObjectURL(gridImage.preview);
                setGridImage(null);
                resetExtraction();
              }}
              className="btn absolute top-2 right-2 p-2 bg-black/60 rounded-full hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Grid Size Inputs */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">Rows</label>
              <select
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                disabled={isExtracting}
                className="input text-sm py-2.5"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">Columns</label>
              <select
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
                disabled={isExtracting}
                className="input text-sm py-2.5"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                disabled={isExtracting}
                className="input text-sm py-2.5"
              >
                {ASPECT_RATIOS.map(ar => (
                  <option key={ar.value} value={ar.value}>{ar.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Preview */}
          <div className="p-4 bg-[var(--secondary)] rounded-xl">
            <p className="text-xs text-[var(--muted-foreground)] mb-3 font-medium">
              Grid: {rows} × {cols} = {totalCount} cells
            </p>
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {extractedImages.length > 0 ? (
                extractedImages.map((img) => (
                  <div
                    key={img.id}
                    className={cn(
                      'aspect-video rounded-lg border flex items-center justify-center text-xs overflow-hidden transition-all relative group',
                      img.status === 'pending' && 'bg-[var(--muted)] border-[var(--border)]',
                      img.status === 'extracting' && 'bg-[var(--primary)]/20 border-[var(--primary)] animate-pulse glow',
                      img.status === 'done' && 'border-green-500 glow-success',
                      img.status === 'error' && 'bg-[var(--destructive)]/20 border-[var(--destructive)] glow-danger'
                    )}
                  >
                    {img.status === 'done' && img.imageUrl ? (
                      <>
                        <img src={img.imageUrl} alt={`${img.row}-${img.col}`} className="w-full h-full object-cover" />
                        {/* Hover overlay with View/Regenerate buttons */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(img);
                            }}
                            className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full transition-all hover:scale-110"
                            title="View"
                          >
                            <Eye className="w-3 h-3 text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRegenerateModal(img);
                            }}
                            disabled={isExtracting || isRegenerating}
                            className="p-1.5 bg-[var(--primary)]/60 hover:bg-[var(--primary)] rounded-full transition-all hover:scale-110 disabled:opacity-50"
                            title="Regenerate"
                          >
                            <RefreshCw className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      </>
                    ) : img.status === 'extracting' ? (
                      <Loader2 className="w-3 h-3 animate-spin text-[var(--primary)]" />
                    ) : img.status === 'error' ? (
                      <div className="flex flex-col items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-[var(--destructive)]" />
                        <button
                          onClick={() => setRegenerateModal(img)}
                          disabled={isExtracting || isRegenerating}
                          className="p-1 bg-[var(--primary)]/60 hover:bg-[var(--primary)] rounded-full transition-all"
                          title="Retry"
                        >
                          <RefreshCw className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--muted-foreground)]">{img.row},{img.col}</span>
                    )}
                  </div>
                ))
              ) : (
                Array.from({ length: totalCount }, (_, i) => (
                  <div
                    key={i}
                    className="aspect-video rounded-lg border border-[var(--border)] bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/30 transition-all"
                  >
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {Math.floor(i / cols) + 1},{(i % cols) + 1}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Progress */}
          {extractedImages.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">
                  {isExtracting ? `Extracting ${currentCell?.row},${currentCell?.col}...` : 'Progress'}
                </span>
                <span className="font-medium text-[var(--primary)]">{completedCount}/{totalCount}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isExtracting ? (
              <>
                <button
                  onClick={startExtraction}
                  disabled={!hasKeys}
                  className={cn(
                    'btn flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold',
                    hasKeys ? 'btn-primary' : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
                  )}
                >
                  <Play className="w-4 h-4" />
                  Start Extraction
                </button>
                {extractedImages.length > 0 && completedCount > 0 && (
                  <>
                    <button
                      onClick={downloadAll}
                      className="btn px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 glow-success"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={resetExtraction}
                      className="btn btn-secondary px-4 py-3 rounded-xl text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <button
                onClick={pauseExtraction}
                className="btn flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 shadow-lg shadow-orange-500/25"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
          </div>

          {!hasKeys && (
            <div className="p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 rounded-lg text-center">
              <p className="text-xs text-[var(--destructive)]">
                Add an API key to start extraction
              </p>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && previewImage.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-scale-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(previewImage.imageUrl!, `grid-${previewImage.row}-${previewImage.col}.png`);
              }}
              className="btn p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm border border-white/10 hover:border-white/30"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
                setRegenerateModal(previewImage);
              }}
              className="btn p-3 bg-gradient-to-r from-[var(--primary)] to-purple-600 hover:from-[var(--primary)]/80 hover:to-purple-600/80 rounded-full backdrop-blur-sm border border-white/20"
              title="Regenerate"
            >
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setPreviewImage(null)}
              className="btn p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm border border-white/10 hover:border-white/30"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <img
            src={previewImage.imageUrl}
            alt={`Cell ${previewImage.row},${previewImage.col}`}
            className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl shadow-purple-500/20"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <p className="text-white text-sm bg-gradient-to-r from-[var(--primary)]/80 to-purple-600/80 backdrop-blur-sm rounded-full px-5 py-2.5 font-medium shadow-lg">
              Row {previewImage.row}, Column {previewImage.col}
            </p>
          </div>
        </div>
      )}

      {/* Regenerate Modal */}
      {regenerateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-scale-in"
          onClick={() => {
            if (!isRegenerating) {
              setRegenerateModal(null);
              setCustomPrompt('');
            }
          }}
        >
          <div
            className="card p-6 max-w-md w-full mx-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Regenerate Cell</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Row {regenerateModal.row}, Column {regenerateModal.col}
                </p>
              </div>
            </div>

            {/* Current image preview */}
            {regenerateModal.imageUrl && (
              <div className="mb-4 rounded-xl overflow-hidden border border-[var(--border)]">
                <img
                  src={regenerateModal.imageUrl}
                  alt="Current"
                  className="w-full h-32 object-cover"
                />
              </div>
            )}

            {/* Custom prompt input */}
            <div className="mb-4">
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-2 block">
                Custom Instructions (optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Focus on the character's face, Keep the background darker..."
                className="input text-sm py-3 min-h-[80px] resize-none"
                disabled={isRegenerating}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => regenerateCell(regenerateModal, customPrompt || undefined)}
                disabled={isRegenerating || !hasKeys}
                className={cn(
                  'btn flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold',
                  isRegenerating ? 'bg-[var(--primary)]/50' : 'btn-primary'
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
                    Regenerate
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setRegenerateModal(null);
                  setCustomPrompt('');
                }}
                disabled={isRegenerating}
                className="btn btn-secondary px-4 py-3 rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
