import { useState, useEffect } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pwa-install-prompt";
const MAX_SHOWS = 3;
const DELAY_MS = 60_000; // 60 seconds
const COOLDOWN_DAYS = 3;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile() || isStandalone()) return;

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const showCount = stored.showCount || 0;
    const lastShown = stored.lastShown ? new Date(stored.lastShown) : null;

    if (showCount >= MAX_SHOWS) return;
    if (lastShown) {
      const daysSince = (Date.now() - lastShown.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        showCount: showCount + 1,
        lastShown: new Date().toISOString(),
      }));
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 mx-4 md:hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-2xl border bg-card p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-base font-bold">Install SimchaSync</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1" onClick={() => setVisible(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Add SimchaSync to your home screen for a faster, app-like experience.
        </p>

        {isIOS() ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Share className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">1. Tap the Share button</p>
                <p className="text-xs text-muted-foreground">In Safari's bottom toolbar</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">2. Add to Home Screen</p>
                <p className="text-xs text-muted-foreground">Scroll down and tap it</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Tap "Add to Home Screen" or "Install App"</p>
                <p className="text-xs text-muted-foreground">From the browser menu (⋮)</p>
              </div>
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full" onClick={() => setVisible(false)}>
          Got it
        </Button>
      </div>
    </div>
  );
}
