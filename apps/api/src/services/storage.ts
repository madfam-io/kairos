/**
 * Storage service for file uploads
 * Uses Supabase Storage when configured, falls back to base64 data URLs
 */

import { getEnv, features } from '../lib/env';
import { log } from '../lib/logger';

interface UploadResult {
  url: string;
  isDataUrl: boolean;
  size: number;
  mimeType: string;
}

interface StorageConfig {
  bucket: string;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

const AUDIO_CONFIG: StorageConfig = {
  bucket: 'card-audio',
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
};

const IMAGE_CONFIG: StorageConfig = {
  bucket: 'card-screenshots',
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
};

/**
 * Upload a file to storage
 */
async function uploadToSupabase(
  file: File,
  userId: string,
  cardId: string,
  config: StorageConfig
): Promise<UploadResult> {
  const env = getEnv();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase not configured');
  }

  // Generate unique filename
  const extension = file.name.split('.').pop() || 'bin';
  const filename = `${userId}/${cardId}/${Date.now()}.${extension}`;

  // Upload to Supabase Storage
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${config.bucket}/${filename}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase upload failed: ${error}`);
  }

  // Get public URL
  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${config.bucket}/${filename}`;

  return {
    url: publicUrl,
    isDataUrl: false,
    size: file.size,
    mimeType: file.type,
  };
}

/**
 * Convert file to base64 data URL (fallback)
 */
async function fileToDataUrl(file: File): Promise<UploadResult> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataUrl = `data:${file.type};base64,${base64}`;

  return {
    url: dataUrl,
    isDataUrl: true,
    size: file.size,
    mimeType: file.type,
  };
}

/**
 * Validate file before upload
 */
function validateFile(file: File, config: StorageConfig): void {
  if (file.size > config.maxSizeBytes) {
    throw new Error(
      `File too large. Maximum size is ${config.maxSizeBytes / 1024 / 1024}MB`
    );
  }

  if (!config.allowedMimeTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${config.allowedMimeTypes.join(', ')}`
    );
  }
}

/**
 * Upload audio file for a card
 */
export async function uploadCardAudio(
  file: File,
  userId: string,
  cardId: string
): Promise<UploadResult> {
  validateFile(file, AUDIO_CONFIG);

  // Try Supabase first, fall back to base64
  if (features.hasSupabase()) {
    try {
      const result = await uploadToSupabase(file, userId, cardId, AUDIO_CONFIG);
      log.info('Audio uploaded to Supabase', {
        userId,
        cardId,
        size: result.size,
      });
      return result;
    } catch (error) {
      log.warn('Supabase upload failed, falling back to base64', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to base64
  log.info('Using base64 storage for audio', { userId, cardId, size: file.size });
  return fileToDataUrl(file);
}

/**
 * Upload screenshot/image for a card
 */
export async function uploadCardScreenshot(
  file: File,
  userId: string,
  cardId: string
): Promise<UploadResult> {
  validateFile(file, IMAGE_CONFIG);

  // Try Supabase first, fall back to base64
  if (features.hasSupabase()) {
    try {
      const result = await uploadToSupabase(file, userId, cardId, IMAGE_CONFIG);
      log.info('Screenshot uploaded to Supabase', {
        userId,
        cardId,
        size: result.size,
      });
      return result;
    } catch (error) {
      log.warn('Supabase upload failed, falling back to base64', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to base64
  log.info('Using base64 storage for screenshot', { userId, cardId, size: file.size });
  return fileToDataUrl(file);
}

/**
 * Delete a file from storage (if using Supabase)
 */
export async function deleteFromStorage(url: string): Promise<boolean> {
  // Skip data URLs
  if (url.startsWith('data:')) {
    return true;
  }

  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  try {
    // Extract path from URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
    if (!pathMatch) {
      return false;
    }

    const objectPath = pathMatch[1];
    const [bucket, ...pathParts] = objectPath.split('/');
    const filePath = pathParts.join('/');

    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    log.error('Failed to delete from storage', error instanceof Error ? error : new Error(String(error)), { url });
    return false;
  }
}

/**
 * Check if storage is available (Supabase configured)
 */
export function isStorageAvailable(): boolean {
  return features.hasSupabase();
}
