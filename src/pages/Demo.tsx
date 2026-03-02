import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play } from "lucide-react";

const Demo = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideo = async () => {
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
      {/* Header - matches app swoosh-gradient header */}
      <header className="sticky top-0 z-30 border-b border-white/10 swoosh-gradient">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <img
              alt="Dexsora"
              className="h-9"
              src="/lovable-uploads/76210976-089d-4afd-a7e8-0a43c108a0a1.png"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/90 tracking-wide font-['Plus_Jakarta_Sans']">
              Product Demo
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6 lg:p-10">
        {loading ? (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground text-sm">Loading demo…</p>
          </div>
        ) : videoUrl ? (
          <div className="w-full max-w-5xl animate-fade-in">
            <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-card">
              {/* Video header bar */}
              <div className="swoosh-gradient px-4 py-2.5 flex items-center gap-2">
                <Play className="h-4 w-4 text-white/90" />
                <span className="text-sm font-semibold text-white/95 font-['Plus_Jakarta_Sans']">
                  Platform Walkthrough
                </span>
              </div>
              <video
                src={videoUrl}
                controls
                autoPlay={false}
                className="w-full aspect-video bg-black"
                controlsList="nodownload"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3 animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Play className="h-7 w-7 text-accent-foreground" />
            </div>
            <p className="text-foreground text-lg font-semibold font-['Plus_Jakarta_Sans']">
              No demo video uploaded yet
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              An administrator can upload a demo video to the storage bucket to make it available here.
            </p>
          </div>
        )}
      </main>

      {/* Footer - matches app branding pill */}
      <footer className="border-t border-border px-6 py-4 flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full swoosh-gradient px-3.5 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
          Powered by Squad Tech Solution
        </span>
      </footer>
    </div>
  );
};

export default Demo;
