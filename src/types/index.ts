export interface ApiKey {
  id: string;
  key: string;
  name: string;
  usageCount: number;
  lastUsed: string | null;
  isLimited: boolean;
  addedAt: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: string;
  referenceCount: number;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}

export interface ReferenceImage {
  id: string;
  file: File;
  preview: string;
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'free';
export type ImageSize = '1K' | '2K';

export interface GenerationRequest {
  prompt: string;
  referenceImages: ReferenceImage[];
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}

export interface ImageConfig {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

export interface GenerationResult {
  success: boolean;
  images?: string[];
  error?: string;
}

export interface KeyManagerState {
  keys: ApiKey[];
  currentKeyIndex: number;
  activeKeyId: string | null;
}
