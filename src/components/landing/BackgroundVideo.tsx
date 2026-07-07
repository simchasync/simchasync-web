import { useEffect, useRef } from "react";

const MUX_URL =
  "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8";

const FADE_IN_MS  = 900;
const FADE_OUT_MS = 600;
const FADE_LEAD   = 0.8; // seconds before end to start fade-out

export default function BackgroundVideo() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const rafRef    = useRef<number | null>(null);
  const fadingRef = useRef(false);

  const fadeTo = (video: HTMLVideoElement, target: number, ms: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = parseFloat(video.style.opacity) || 0;
    const t0   = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / ms, 1);
      video.style.opacity = String(from + (target - from) * p);
      rafRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = "0";

    let cancelled = false;
    let hls: { destroy: () => void } | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const onPlaying = () => {
      fadingRef.current = false;
      fadeTo(video, 1, FADE_IN_MS);
    };

    // Fade out just before end, then manually restart (loop=false so we control it)
    const onTimeUpdate = () => {
      const rem = video.duration - video.currentTime;
      if (!fadingRef.current && isFinite(rem) && rem > 0 && rem <= FADE_LEAD) {
        fadingRef.current = true;
        fadeTo(video, 0, FADE_OUT_MS);
      }
    };

    const onEnded = () => {
      video.style.opacity = "0";
      const t = setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        // onPlaying will fire and fade back in
      }, 80);
      timers.push(t);
    };

    const attach = () => {
      video.addEventListener("playing",    onPlaying);
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("ended",      onEnded);
    };

    // Native HLS (Safari / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_URL;
      attach();
      return () => cleanup(video, hls, rafRef, timers, onPlaying, onTimeUpdate, onEnded);
    }

    // Chrome / Firefox / Edge — hls.js, loaded eagerly
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;

      if (!Hls.isSupported()) {
        video.src = MUX_URL; // last resort
        attach();
        return;
      }

      const instance = new Hls({ debug: false, startPosition: 0 });
      hls = instance;
      instance.loadSource(MUX_URL);
      instance.attachMedia(video);
      attach();
    });

    return () => {
      cancelled = true;
      cleanup(video, hls, rafRef, timers, onPlaying, onTimeUpdate, onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* loop=false — we handle restarts via onEnded for reliable crossfade */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop={false}
        className="w-full h-full object-cover"
        style={{ opacity: 0 }}
      />
    </div>
  );
}

function cleanup(
  video: HTMLVideoElement,
  hls: { destroy: () => void } | undefined,
  rafRef: React.MutableRefObject<number | null>,
  timers: ReturnType<typeof setTimeout>[],
  ...listeners: EventListener[]
) {
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  timers.forEach(clearTimeout);
  hls?.destroy();
  const [onPlaying, onTimeUpdate, onEnded] = listeners;
  video.removeEventListener("playing",    onPlaying);
  video.removeEventListener("timeupdate", onTimeUpdate);
  video.removeEventListener("ended",      onEnded);
}
