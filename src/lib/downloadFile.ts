import { getSignedUrl } from "./getSignedUrl";

export const downloadFile = async (urlOrPath: string, fileName: string) => {
  try {
    // Resolve signed URL for private bucket files
    const url = await getSignedUrl("lead-documents", urlOrPath);
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    const url = await getSignedUrl("lead-documents", urlOrPath);
    window.open(url, "_blank");
  }
};
