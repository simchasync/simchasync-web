import { useEffect, useRef } from "react";

const MUX_URL =
  "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8";

const FADE_MS = 800;

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  // rAF-driven fade-in — no CSS transitions, matches the cinematic landing design
  const fadeIn = () => {
    const video = videoRef.current;
    if (!video) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / FADE_MS, 1);
      video.style.opacity = String(p);
      rafRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = "0";

    const onPlay = () => fadeIn();

    // Safari / iOS — native HLS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_URL;
      video.addEventListener("playing", onPlay, { once: true });
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        video.removeEventListener("playing", onPlay);
      };
    }

    // Chrome / Firefox / Edge — load hls.js eagerly (no requestIdleCallback delay)
    let cancelled = false;
    let hls: { destroy: () => void } | undefined;

    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !video) return;

      if (!Hls.isSupported()) {
        // Last-resort: try direct src (some environments handle it)
        video.src = MUX_URL;
        video.addEventListener("playing", onPlay, { once: true });
        return;
      }

      const instance = new Hls({ startPosition: 0, debug: false });
      hls = instance;
      instance.loadSource(MUX_URL);
      instance.attachMedia(video);
      video.addEventListener("playing", onPlay, { once: true });
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      hls?.destroy();
      video.removeEventListener("playing", onPlay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
