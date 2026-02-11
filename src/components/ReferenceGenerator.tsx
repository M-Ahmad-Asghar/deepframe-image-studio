'use client';

import { useState, useRef } from 'react';
import { generateImage } from '@/lib/gemini';
import { ReferenceImage, AspectRatio, ImageSize } from '@/types';
import { generateId as genId } from '@/lib/utils';
import { ImagePreview } from './ImagePreview';

interface ReferenceItem {
  id: string;
  name: string;
  prompt: string;
  referenceImage: File | null;
  referencePreview: string | null;
  generatedImage: string | null;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
}

interface Category {
  name: string;
  items: ReferenceItem[];
  savePath: string;
  folderHandle: FileSystemDirectoryHandle | null;
}

interface ReferenceGeneratorProps {
  apiKey: string;
}

export default function ReferenceGenerator({ apiKey }: ReferenceGeneratorProps) {
  const [categories, setCategories] = useState<Record<string, Category>>({
    characters: { name: 'Characters', items: [], savePath: '', folderHandle: null },
    objects: { name: 'Objects', items: [], savePath: '', folderHandle: null },
    environments: { name: 'Environments', items: [], savePath: '', folderHandle: null },
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenerating, setCurrentGenerating] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('2K');
  const [previewImage, setPreviewImage] = useState<{ url: string; prompt?: string } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addItem = (categoryKey: string) => {
    const newItem: ReferenceItem = {
      id: generateId(),
      name: '',
      prompt: '',
      referenceImage: null,
      referencePreview: null,
      generatedImage: null,
      status: 'pending',
    };

    setCategories(prev => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        items: [...prev[categoryKey].items, newItem],
      },
    }));
  };

  const removeItem = (categoryKey: string, itemId: string) => {
    setCategories(prev => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        items: prev[categoryKey].items.filter(item => item.id !== itemId),
      },
    }));
  };

  const updateItem = (categoryKey: string, itemId: string, updates: Partial<ReferenceItem>) => {
    setCategories(prev => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        items: prev[categoryKey].items.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        ),
      },
    }));
  };

  const handleImageSelect = (categoryKey: string, itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateItem(categoryKey, itemId, {
        referenceImage: file,
        referencePreview: e.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePathSelect = async (categoryKey: string) => {
    try {
      // Check if File System Access API is supported
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });

        setCategories(prev => ({
          ...prev,
          [categoryKey]: {
            ...prev[categoryKey],
            savePath: dirHandle.name,
            folderHandle: dirHandle,
          },
        }));
      } else {
        // Fallback for unsupported browsers
        alert('Your browser does not support folder selection. Images will be downloaded to your default Downloads folder.');
      }
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        console.error('Folder selection error:', error);
      }
    }
  };

  const generateSingle = async (categoryKey: string, item: ReferenceItem): Promise<boolean> => {
    if (!item.prompt.trim()) return false;

    updateItem(categoryKey, item.id, { status: 'generating', error: undefined });
    setCurrentGenerating(item.id);

    try {
      // Build reference images array in correct format
      // Map category to reference type: characters -> character, objects -> object, environments -> anchor
      const getReferenceType = (catKey: string): 'character' | 'anchor' | 'object' => {
        if (catKey === 'characters') return 'character';
        if (catKey === 'objects') return 'object';
        return 'anchor'; // environments use anchor type
      };

      const referenceImages: ReferenceImage[] = [];
      if (item.referenceImage) {
        referenceImages.push({
          id: genId(),
          file: item.referenceImage,
          preview: item.referencePreview || '',
          referenceType: getReferenceType(categoryKey),
          label: item.name || undefined,
        });
      }

      const result = await generateImage(apiKey, {
        prompt: item.prompt,
        referenceImages: referenceImages,
        aspectRatio: aspectRatio as AspectRatio,
        imageSize: imageSize,
      });

      if (result.success && result.images && result.images.length > 0) {
        updateItem(categoryKey, item.id, {
          generatedImage: result.images[0],
          status: 'completed',
        });
        return true;
      } else {
        updateItem(categoryKey, item.id, {
          status: 'error',
          error: result.error || 'Generation failed',
        });
        return false;
      }
    } catch (error: any) {
      updateItem(categoryKey, item.id, {
        status: 'error',
        error: error.message || 'Generation failed',
      });
      return false;
    }
  };

  const startGeneration = async () => {
    setIsGenerating(true);

    // Collect all items that need generation
    const allItems: { categoryKey: string; item: ReferenceItem }[] = [];

    Object.entries(categories).forEach(([categoryKey, category]) => {
      category.items.forEach(item => {
        if (item.prompt.trim() && item.status !== 'completed') {
          allItems.push({ categoryKey, item });
        }
      });
    });

    // Generate one by one
    for (const { categoryKey, item } of allItems) {
      await generateSingle(categoryKey, item);
    }

    setIsGenerating(false);
    setCurrentGenerating(null);
  };

  const regenerateItem = async (categoryKey: string, item: ReferenceItem) => {
    setIsGenerating(true);
    await generateSingle(categoryKey, item);
    setIsGenerating(false);
    setCurrentGenerating(null);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save image to selected folder using File System Access API
  const saveImageToFolder = async (
    folderHandle: FileSystemDirectoryHandle,
    dataUrl: string,
    filename: string
  ) => {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Create file in the selected folder
      const fileHandle = await folderHandle.getFileHandle(`${filename}.png`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      return true;
    } catch (error) {
      console.error('Error saving to folder:', error);
      return false;
    }
  };

  const saveAllForCategory = async (categoryKey: string) => {
    const category = categories[categoryKey];

    if (category.folderHandle) {
      // Save to selected folder
      let savedCount = 0;
      for (const item of category.items) {
        if (item.generatedImage && item.name) {
          const success = await saveImageToFolder(category.folderHandle, item.generatedImage, item.name);
          if (success) savedCount++;
        }
      }
      alert(`Saved ${savedCount} images to "${category.savePath}" folder`);
    } else {
      // Fallback: download to default location
      category.items.forEach(item => {
        if (item.generatedImage && item.name) {
          downloadImage(item.generatedImage, item.name);
        }
      });
    }
  };

  const saveAll = async () => {
    for (const categoryKey of Object.keys(categories)) {
      await saveAllForCategory(categoryKey);
    }
  };

  const getTotalItems = () => {
    return Object.values(categories).reduce((acc, cat) => acc + cat.items.length, 0);
  };

  const getCompletedItems = () => {
    return Object.values(categories).reduce(
      (acc, cat) => acc + cat.items.filter(item => item.status === 'completed').length,
      0
    );
  };

  return (
    <div className="space-y-6">
      {/* Aspect Ratio & Size Selection */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-300">Aspect Ratio:</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="free">Free (Auto)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-300">Size:</label>
          <div className="flex gap-1">
            <button
              onClick={() => setImageSize('1K')}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                imageSize === '1K'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              1K
            </button>
            <button
              onClick={() => setImageSize('2K')}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                imageSize === '2K'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              2K
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      {Object.entries(categories).map(([categoryKey, category]) => (
        <div key={categoryKey} className="bg-white/5 rounded-xl p-4 border border-white/10">
          {/* Category Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{category.name}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePathSelect(categoryKey)}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {category.savePath || 'Set Path'}
              </button>
              <button
                onClick={() => addItem(categoryKey)}
                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>
          </div>

          {/* Items */}
          {category.items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No {category.name.toLowerCase()} added yet. Click "Add" to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white/5 rounded-lg p-3 border ${
                    item.status === 'generating'
                      ? 'border-yellow-500/50'
                      : item.status === 'completed'
                      ? 'border-green-500/50'
                      : item.status === 'error'
                      ? 'border-red-500/50'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Reference Image */}
                    <div className="flex-shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[item.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelect(categoryKey, item.id, file);
                        }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                        className="w-20 h-20 bg-white/10 rounded-lg border-2 border-dashed border-white/20 hover:border-purple-500/50 transition-colors flex items-center justify-center overflow-hidden"
                      >
                        {item.referencePreview ? (
                          <img
                            src={item.referencePreview}
                            alt="Reference"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <p className="text-[10px] text-gray-500 text-center mt-1">Reference</p>
                    </div>

                    {/* Input Fields */}
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Reference name (for saving)"
                        value={item.name}
                        onChange={(e) => updateItem(categoryKey, item.id, { name: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <textarea
                        placeholder="Describe what to generate..."
                        value={item.prompt}
                        onChange={(e) => updateItem(categoryKey, item.id, { prompt: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                      {item.error && (
                        <p className="text-red-400 text-xs">{item.error}</p>
                      )}
                    </div>

                    {/* Generated Image / Status */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center overflow-hidden ${
                          item.generatedImage ? 'cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all' : ''
                        }`}
                        onClick={() => {
                          if (item.generatedImage) {
                            setPreviewImage({ url: item.generatedImage, prompt: item.prompt });
                          }
                        }}
                      >
                        {item.status === 'generating' ? (
                          <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
                        ) : item.generatedImage ? (
                          <img
                            src={item.generatedImage}
                            alt="Generated"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-500 text-xs">Result</span>
                        )}
                      </div>
                      {item.generatedImage && (
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => regenerateItem(categoryKey, item)}
                            disabled={isGenerating}
                            className="flex-1 text-[10px] px-1 py-0.5 bg-yellow-600/50 hover:bg-yellow-600 text-white rounded transition-colors disabled:opacity-50"
                            title="Regenerate"
                          >
                            ↻
                          </button>
                          <button
                            onClick={() => downloadImage(item.generatedImage!, item.name || item.id)}
                            className="flex-1 text-[10px] px-1 py-0.5 bg-blue-600/50 hover:bg-blue-600 text-white rounded transition-colors"
                            title="Download"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeItem(categoryKey, item.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors self-start"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category Save All Button */}
          {category.items.some(item => item.status === 'completed') && (
            <button
              onClick={() => saveAllForCategory(categoryKey)}
              className="mt-3 w-full py-2 text-sm bg-green-600/50 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              Save All {category.name}
            </button>
          )}
        </div>
      ))}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={startGeneration}
          disabled={isGenerating || getTotalItems() === 0}
          className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              Generating... ({getCompletedItems()}/{getTotalItems()})
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Generation
            </>
          )}
        </button>

        {getCompletedItems() > 0 && (
          <button
            onClick={saveAll}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save All
          </button>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreview
          imageUrl={previewImage.url}
          prompt={previewImage.prompt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
