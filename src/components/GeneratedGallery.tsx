'use client';

import { GeneratedImage } from '@/types';
import { downloadImage, formatDate } from '@/lib/utils';
import { Download, Trash2, Clock, ImageIcon, Sparkles, Expand } from 'lucide-react';

interface GeneratedGalleryProps {
  images: GeneratedImage[];
  onRemove?: (id: string) => void;
  onImageClick?: (imageUrl: string, prompt: string) => void;
  title?: string;
  showPrompt?: boolean;
}

export function GeneratedGallery({
  images,
  onRemove,
  onImageClick,
  title = 'Generated Images',
  showPrompt = true,
}: GeneratedGalleryProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold">{title}</h2>
          <span className="badge badge-primary">
            {images.length}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="group card card-hover overflow-hidden animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Image */}
            <div className="relative aspect-square bg-[var(--secondary)]">
              <img
                src={image.imageUrl}
                alt={image.prompt}
                className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                onClick={() => onImageClick?.(image.imageUrl, image.prompt)}
              />

              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 pointer-events-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageClick?.(image.imageUrl, image.prompt);
                  }}
                  className="btn p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 hover:scale-110 transition-all pointer-events-auto border border-white/20"
                  title="Preview"
                >
                  <Expand className="w-5 h-5 text-white" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(image.imageUrl, `gem-ai-${image.id}.png`);
                  }}
                  className="btn p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 hover:scale-110 transition-all pointer-events-auto border border-white/20"
                  title="Download"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>

                {onRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(image.id);
                    }}
                    className="btn p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-[var(--destructive)]/50 hover:scale-110 transition-all pointer-events-auto border border-white/20"
                    title="Remove"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>

              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-2">
                {/* Reference Badge */}
                {image.referenceCount > 0 && (
                  <div className="px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full flex items-center gap-1.5 border border-white/10">
                    <ImageIcon className="w-3 h-3 text-white" />
                    <span className="text-xs text-white font-medium">
                      {image.referenceCount} ref
                    </span>
                  </div>
                )}

                {/* Aspect Ratio Badge */}
                {image.aspectRatio && (
                  <div className="px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full border border-white/10">
                    <span className="text-xs text-white font-medium">{image.aspectRatio}</span>
                  </div>
                )}
              </div>

              {/* Size Badge */}
              {image.imageSize && (
                <div className="absolute top-2 right-2 px-2.5 py-1 bg-gradient-to-r from-[var(--primary)]/80 to-purple-600/80 backdrop-blur-sm rounded-full border border-white/20">
                  <span className="text-xs text-white font-medium">{image.imageSize}</span>
                </div>
              )}
            </div>

            {/* Info */}
            {showPrompt && (
              <div className="p-4">
                <p className="text-sm line-clamp-2 mb-2">{image.prompt}</p>
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(image.timestamp)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
