'use client';

import { useCallback, useState } from 'react';
import { ReferenceImage, ReferenceType } from '@/types';
import { generateId, cn } from '@/lib/utils';
import { ImagePlus, X, Images } from 'lucide-react';

interface ReferenceUploadProps {
  images: ReferenceImage[];
  onChange: (images: ReferenceImage[]) => void;
  maxImages?: number;
}

export function ReferenceUpload({
  images,
  onChange,
  maxImages = 14, // Gemini 3 Pro limit: 5 humans + 6 objects + 3 style = 14
}: ReferenceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter((file) =>
        file.type.startsWith('image/')
      );

      const remainingSlots = maxImages - images.length;
      const filesToAdd = imageFiles.slice(0, remainingSlots);

      const newImages: ReferenceImage[] = filesToAdd.map((file) => {
        // Extract filename without extension for label
        const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        return {
          id: generateId(),
          file,
          preview: URL.createObjectURL(file),
          referenceType: 'anchor' as ReferenceType, // Default to anchor (style/environment)
          label: filenameWithoutExt, // Prefill with filename
        };
      });

      onChange([...images, ...newImages]);
    },
    [images, maxImages, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      const imageToRemove = images.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      onChange(images.filter((img) => img.id !== id));
    },
    [images, onChange]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  // Update reference type for an image
  const updateImageType = useCallback(
    (id: string, referenceType: ReferenceType) => {
      onChange(
        images.map((img) =>
          img.id === id ? { ...img, referenceType } : img
        )
      );
    },
    [images, onChange]
  );

  // Update label for an image
  const updateImageLabel = useCallback(
    (id: string, label: string) => {
      onChange(
        images.map((img) =>
          img.id === id ? { ...img, label: label || undefined } : img
        )
      );
    },
    [images, onChange]
  );

  // Get type color for visual indicator
  const getTypeColor = (type: ReferenceType) => {
    switch (type) {
      case 'character':
        return 'border-blue-500 bg-blue-500/20';
      case 'anchor':
        return 'border-purple-500 bg-purple-500/20';
      case 'object':
        return 'border-orange-500 bg-orange-500/20';
      default:
        return 'border-gray-500';
    }
  };

  const getTypeLabel = (type: ReferenceType) => {
    switch (type) {
      case 'character':
        return 'Character (Face Match)';
      case 'anchor':
        return 'Style/Environment';
      case 'object':
        return 'Object (Design Match)';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="w-4 h-4 text-[var(--primary)]" />
          <span className="text-sm font-medium">Reference Images</span>
          <span className="text-xs text-[var(--muted-foreground)]">
            (optional, max {maxImages})
          </span>
        </div>
        {images.length > 0 && (
          <button
            onClick={() => {
              images.forEach((img) => URL.revokeObjectURL(img.preview));
              onChange([]);
            }}
            className="text-xs text-[var(--destructive)] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Image Grid with Type Selector */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                'relative rounded-lg overflow-hidden border-2 transition-all',
                getTypeColor(img.referenceType)
              )}
            >
              {/* Image Preview */}
              <div className="aspect-square relative group">
                <img
                  src={img.preview}
                  alt="Reference"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemove(img.id)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                {/* File name overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-[10px] text-white truncate">
                    {img.file.name}
                  </p>
                </div>
              </div>

              {/* Type Selector */}
              <div className="p-2 bg-[var(--card)] space-y-2">
                {/* Type Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => updateImageType(img.id, 'character')}
                    className={cn(
                      'flex-1 text-[10px] py-1 px-1 rounded transition-colors',
                      img.referenceType === 'character'
                        ? 'bg-blue-500 text-white'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-blue-500/30'
                    )}
                    title="Character - Match face exactly"
                  >
                    Character
                  </button>
                  <button
                    onClick={() => updateImageType(img.id, 'anchor')}
                    className={cn(
                      'flex-1 text-[10px] py-1 px-1 rounded transition-colors',
                      img.referenceType === 'anchor'
                        ? 'bg-purple-500 text-white'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-purple-500/30'
                    )}
                    title="Style/Environment - Match style only"
                  >
                    Style-Env
                  </button>
                  <button
                    onClick={() => updateImageType(img.id, 'object')}
                    className={cn(
                      'flex-1 text-[10px] py-1 px-1 rounded transition-colors',
                      img.referenceType === 'object'
                        ? 'bg-orange-500 text-white'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-orange-500/30'
                    )}
                    title="Object - Match design exactly"
                  >
                    Object
                  </button>
                </div>

                {/* Label Input (for character or object) */}
                {(img.referenceType === 'character' || img.referenceType === 'object') && (
                  <input
                    type="text"
                    placeholder={img.referenceType === 'character' ? 'Name (e.g., Aurangzeb)' : 'Object name'}
                    value={img.label || ''}
                    onChange={(e) => updateImageLabel(img.id, e.target.value)}
                    className="w-full px-2 py-1 text-[10px] bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Type Legend */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Character: Face will match exactly
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Style-Env: Style reference only (won't copy)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Object: Design will match exactly
          </span>
        </div>
      )}

      {/* Upload Area */}
      {images.length < maxImages && (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all',
            isDragging
              ? 'border-[var(--primary)] bg-[var(--primary)]/10'
              : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--secondary)]'
          )}
        >
          <ImagePlus
            className={cn(
              'w-8 h-8',
              isDragging ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
            )}
          />
          <div className="text-center">
            <p className="text-sm text-[var(--foreground)]">
              Drop images here or click to upload
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {images.length}/{maxImages} images
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
