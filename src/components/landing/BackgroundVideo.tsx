import { useEffect, useRef } from "react";

const MUX_URL =
  "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8";

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Native HLS (Safari/iOS) — no library needed.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_URL;
      return;
    }

    // Everyone else: load hls.js on demand so it stays out of the initial bundle.
    // This is a decorative background video — defer the 150KB+ fetch until the
    // browser is idle so it doesn't compete with fonts/LCP text for bandwidth
    // on first load. requestIdleCallback isn't in Safari, but Safari took the
    // native-HLS branch above and never reaches here.
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;
    const load = () => {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const instance = new Hls();
        hls = instance;
        instance.loadSource(MUX_URL);
        instance.attachMedia(video);
      });
    };
    const idleId = ("requestIdleCallback" in window ? window.requestIdleCallback(load) : setTimeout(load, 200)) as number;
    return () => {
      cancelled = true;
      hls?.destroy();
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover opacity-100"
      />
    </div>
  );
}
