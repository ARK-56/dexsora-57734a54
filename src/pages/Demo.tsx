import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import dexsoraLogo from "@/assets/dexsora-logo.png";

const Demo = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideo = async () => {
      // List files in demo-videos bucket, pick the first video
      const { data } = await supabase.storage.from("demo-videos").list("", {
        limit: 1,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (data && data.length > 0) {
        const { data: urlData } = supabase.storage
          .from("demo-videos")
          .getPublicUrl(data[0].name);
        setVideoUrl(urlData.publicUrl);
      }
      setLoading(false);
    };
    fetchVideo();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <img src={dexsoraLogo} alt="Dexsora" className="h-8 w-auto" />
        <h1 className="text-xl font-bold text-foreground">Product Demo</h1>
      </header>

      {/* Video */}
      <main className="flex-1 flex items-center justify-center p-6">
        {loading ? (
          <p className="text-muted-foreground">Loading demo video…</p>
        ) : videoUrl ? (
          <div className="w-full max-w-5xl rounded-xl overflow-hidden border border-border shadow-lg bg-card">
            <video
              src={videoUrl}
              controls
              autoPlay={false}
              className="w-full aspect-video"
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-lg">No demo video uploaded yet.</p>
            <p className="text-sm text-muted-foreground">
              An admin can upload a demo video from the storage bucket.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Dexsora — All rights reserved
      </footer>
    </div>
  );
};

export default Demo;
