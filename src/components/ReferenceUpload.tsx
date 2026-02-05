'use client';

import { useCallback, useState } from 'react';
import { ReferenceImage } from '@/types';
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
  maxImages = 20,
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

      const newImages: ReferenceImage[] = filesToAdd.map((file) => ({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
      }));

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

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-lg overflow-hidden group"
            >
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
            </div>
          ))}
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
