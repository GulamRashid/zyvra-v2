import { supabase } from './supabase';

/**
 * Validates and uploads a file to the Supabase Storage 'app-assets' bucket.
 * 
 * @param {File} file - The file object from <input type="file" />
 * @param {Object} options
 * @param {string} options.folder - Destination folder inside bucket (e.g., 'icons', 'banners', 'resources', 'avatars')
 * @param {string[]} [options.allowedExtensions] - e.g. ['svg', 'png', 'webp']
 * @param {number} [options.maxSizeBytes] - Maximum file size in bytes
 * @param {string} [options.customFileName] - Optional explicit filename
 * @returns {Promise<{ url: string, path: string, size: number, name: string }>}
 */
export async function uploadAsset(file, options = {}) {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const {
    folder = 'uploads',
    allowedExtensions = ['svg', 'png', 'webp', 'jpg', 'jpeg', 'pdf'],
    maxSizeBytes = 2 * 1024 * 1024, // 2MB default
    customFileName
  } = options;

  // 1. Validate file extension
  const fileNameParts = file.name.split('.');
  const extension = fileNameParts.length > 1 ? fileNameParts.pop().toLowerCase() : '';
  
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    throw new Error(
      `Invalid file format (.${extension || 'unknown'}). Allowed formats: ${allowedExtensions.map((e) => `.${e}`).join(', ')}`
    );
  }

  // 2. Validate file size
  if (file.size > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    const maxKb = Math.round(maxSizeBytes / 1024);
    const readableLimit = maxSizeBytes >= 1024 * 1024 ? `${maxMb} MB` : `${maxKb} KB`;
    const actualReadable = file.size >= 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
      : `${Math.round(file.size / 1024)} KB`;
    
    throw new Error(`File is too large (${actualReadable}). Maximum allowed size is ${readableLimit}.`);
  }

  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // 3. Build unique storage path
  const sanitizedOriginal = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 40);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const targetName = customFileName || `${sanitizedOriginal}_${timestamp}_${randomSuffix}.${extension}`;
  const filePath = `${folder.replace(/^\/+|\/+$/g, '')}/${targetName}`;

  // 4. Upload to bucket
  const { error: uploadError } = await supabase.storage
    .from('app-assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // 5. Retrieve public URL
  const { data: publicUrlData } = supabase.storage
    .from('app-assets')
    .getPublicUrl(filePath);

  return {
    url: publicUrlData?.publicUrl || '',
    path: filePath,
    size: file.size,
    name: targetName
  };
}

/**
 * Format bytes to human readable string (KB / MB)
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
