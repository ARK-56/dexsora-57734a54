import { supabase } from "@/integrations/supabase/client";

/**
 * Get a signed URL for a file in a private storage bucket.
 * If the stored URL is already a full URL (legacy public URL), return it as-is.
 * Otherwise, create a signed URL with 1-hour expiry.
 */
export const getSignedUrl = async (
  bucket: string,
  filePath: string,
  expiresIn = 3600
): Promise<string> => {
  // Legacy: if it's already a full URL, return as-is
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL:", error);
    return filePath;
  }

  return data.signedUrl;
};
