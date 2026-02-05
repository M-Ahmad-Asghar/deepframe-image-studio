'use client';

import { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { downloadImage } from '@/lib/utils';
import { useState } from 'react';

interface ImagePreviewProps {
  imageUrl: string;
  prompt?: string;
  onClose: () => void;
}

export function ImagePreview({ imageUrl, prompt, onClose }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = () => {
    downloadImage(imageUrl, `gem-ai-${Date.now()}.png`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-scale-in"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className="btn p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm border border-white/10 hover:border-white/30 hover:scale-110 transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-sm px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 font-medium">{Math.round(zoom * 100)}%</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className="btn p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm border border-white/10 hover:border-white/30 hover:scale-110 transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="btn p-3 bg-gradient-to-r from-[var(--primary)] to-purple-600 hover:from-[var(--primary)]/80 hover:to-purple-600/80 rounded-full backdrop-blur-sm border border-white/20 hover:scale-110 transition-all shadow-lg shadow-purple-500/25"
          title="Download"
        >
          <Download className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={onClose}
          className="btn p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm border border-white/10 hover:border-white/30 hover:scale-110 transition-all"
          title="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={prompt || 'Generated image'}
          className="rounded-2xl transition-transform duration-200 shadow-2xl shadow-purple-500/20"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
      </div>

      {/* Prompt at bottom - outside image area */}
      {prompt && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-none">
          <div className="max-w-2xl w-full mx-auto">
            <p
              className="text-white text-sm bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-md rounded-xl px-5 py-3 text-center overflow-hidden border border-white/10"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                maxHeight: '5rem',
              }}
            >
              {prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
