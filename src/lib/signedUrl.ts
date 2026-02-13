import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a signed URL from a file path or legacy public URL.
 * Handles both new file paths and old full public URLs gracefully.
 */
export const getSignedUrl = async (
  filePathOrUrl: string,
  bucket = "lead-documents",
  expiresIn = 3600
): Promise<string> => {
  if (!filePathOrUrl) return "";

  // Extract path from full URL if it's a legacy public URL
  let path = filePathOrUrl;
  if (filePathOrUrl.includes("/storage/v1/")) {
    const marker = `/${bucket}/`;
    const idx = filePathOrUrl.indexOf(marker);
    if (idx !== -1) {
      path = filePathOrUrl.substring(idx + marker.length);
    }
    // Remove query params
    path = path.split("?")[0];
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data) return "";
  return data.signedUrl;
};
