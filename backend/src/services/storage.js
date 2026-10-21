import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase.js';

const BUCKET = 'item-images';

export async function uploadItemImage(foundId, file) {
  const extension = file.mimetype.split('/')[1] || 'jpg';
  const path = `${foundId}/${randomUUID()}.${extension}`;

  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('[Storage] Supabase upload failed:', error.message);
      throw error;
    }
    return data.path;
  }

  // Fallback for development if Supabase credentials are not configured yet
  // Store base64 data URI in storagePath so previews always work seamlessly
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  return base64;
}

export async function getSignedImageUrl(storagePath, expiresIn = 3600) {
  if (!storagePath) return null;

  if (storagePath.startsWith('data:')) {
    return storagePath;
  }

  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.warn('[Storage] Signed URL creation warning:', error.message);
      return null;
    }
    return data?.signedUrl || null;
  }

  return storagePath;
}
