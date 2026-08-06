import { Navigate, Link } from "react-router-dom";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { useRef, useState, useEffect, useId } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import BrandLogo from "@/components/BrandLogo";
import BlurText from "@/components/landing/BlurText";
import {
  Calendar, CreditCard, Users, Check, ArrowRight, Star, ChevronRight,
  Sparkles, Menu, X, Quote,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const;
const GOLD = "linear-gradient(135deg, #EDD08A 0%, #C7A155 50%, #9A7830 100%)";
const goldText: React.CSSProperties = {
  background: GOLD,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";
const FEATURES_BG_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260611_183632_c311af08-e4b7-458f-81e7-79847a49b3d3.mp4";
const MISSION_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4";

// Shared focus-visible ring (gold, keyboard users only)
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#C7A155] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// ── Ambient background video ──────────────────────────────────────────────────
// Plays only while on screen (saves battery/CPU) and never autoplays for users
// who prefer reduced motion — they get a still gradient instead. `preload="none"`
// keeps secondary videos from downloading until they're actually needed.
function AmbientVideo({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.05 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduce]);

  if (reduce) {
    return (
      <div
        aria-hidden
        className={className}
        style={{
          ...style,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 35%, rgba(199,161,85,0.10), transparent 70%)",
        }}
      />
    );
  }

  return (
    <video
      ref={ref}
      aria-hidden
      className={className}
      style={style}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
    />
  );
}

// ── Navbar (scroll-aware + accessible mobile menu) ────────────────────────────

const NAV_LINKS = [
  { id: "features", label: "Features" },
  { id: "showcase", label: "Product" },
  { id: "pricing", label: "Pricing" },
] as const;

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "py-2" : "py-4"}`}>
      <nav
        aria-label="Primary"
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 md:px-6 transition-all duration-300 ${scrolled ? "landing-glass-strong mt-0 rounded-full py-2" : "mt-2 py-1"}`}
      >
        <Link to="/" className={`shrink-0 rounded-full transition-opacity hover:opacity-80 ${FOCUS}`} aria-label="SimchaSync home">
          <BrandLogo size="sm" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className={`rounded-full px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white font-sans ${FOCUS}`}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/auth/login" className={`rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:text-white font-sans ${FOCUS}`}>
            Log In
          </Link>
          <Link to="/auth/register" className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold font-sans transition-transform hover:-translate-y-0.5 ${FOCUS}`} style={{ background: GOLD, color: "#1a0f00" }}>
            Start Free Trial <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className={`md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 landing-glass ${FOCUS}`}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <div
        id="mobile-menu"
        className="md:hidden mx-4 mt-2 transition-all duration-200 ease-out"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="landing-glass-strong rounded-2xl p-3">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className={`block rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 font-sans ${FOCUS}`}>
              {l.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Link to="/auth/login" onClick={() => setOpen(false)} className={`rounded-full px-4 py-2.5 text-center text-sm font-medium text-white/80 landing-glass font-sans ${FOCUS}`}>Log In</Link>
            <Link to="/auth/register" onClick={() => setOpen(false)} className={`rounded-full px-4 py-2.5 text-center text-sm font-semibold font-sans ${FOCUS}`} style={{ background: GOLD, color: "#1a0f00" }}>Start Free</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroBackground() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1.2]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.72, 0]);

  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden bg-black">
      {reduce ? (
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 60% at 50% 0%, rgba(199,161,85,0.14), #000 70%)" }} />
      ) : (
        <motion.video
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          style={{ opacity, y, scale, willChange: "transform, opacity", backfaceVisibility: "hidden", transform: "translateZ(0)" }}
        />
      )}
      <div aria-hidden className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none" style={{ height: "16rem", background: "linear-gradient(to bottom, transparent, #000)" }} />
    </div>
  );
}

function HeroPreview({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
      className="relative mx-auto w-full max-w-md"
      style={{ perspective: 1200 }}
    >
      <div aria-hidden className="absolute -inset-6 -z-10" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(199,161,85,0.28), transparent 70%)", filter: "blur(34px)" }} />
      <div className="landing-glass-strong rounded-3xl p-5" style={{ transform: reduce ? undefined : "rotateY(-8deg) rotateX(4deg)", transformStyle: "preserve-3d" }}>
        <div className="flex items-center gap-2 pb-4">
          <BrandLogo size="xs" />
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/50 font-sans">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#2BE2A6" }} /> Live
          </span>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "rgba(237,208,138,0.06)", border: "1px solid rgba(237,208,138,0.25)" }}>
          <p className="text-[11px] uppercase tracking-wide text-white/45 font-sans mb-1">Next simcha</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-serif italic font-bold text-white" style={{ fontSize: "1.3rem", lineHeight: 1.1 }}>Goldstein Wedding</p>
              <p className="text-[12px] text-white/55 font-sans">Sun, 14 Adar · Ateres Chaya · 8:00 PM</p>
            </div>
            <span className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold font-sans" style={{ background: GOLD, color: "#1a0f00" }}>Confirmed</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wide text-white/40 font-sans">This month</p>
            <p className="font-serif italic font-bold mt-0.5" style={{ fontSize: "1.4rem", ...goldText }}>$18,420</p>
            <div className="mt-2 flex items-end gap-[3px] h-6">{[40, 55, 48, 70, 62, 88, 100].map((h, i) => <Bar key={i} h={h} />)}</div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wide text-white/40 font-sans">Bookings</p>
            <p className="font-serif italic font-bold mt-0.5" style={{ fontSize: "1.4rem", ...goldText }}>27</p>
            <div className="mt-2 flex items-end gap-[3px] h-6">{[50, 36, 60, 52, 78, 66, 92].map((h, i) => <Bar key={i} h={h} mint />)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Hero({ subtitle, cta, ctaSecondary }: { subtitle: string; cta: string; ctaSecondary: string }) {
  const reduce = useReducedMotion();
  const words = ["Manage", "Your", "Simchas", "Like", "a", "Pro"];

  return (
    <section className="relative min-h-[100svh] bg-black flex flex-col overflow-hidden selection:bg-[#C7A155] selection:text-black">
      <HeroBackground />

      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.70) 100%)" }} />
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 30% at 50% -5%, rgba(237,208,138,0.10), transparent 60%)" }} />
      <div aria-hidden className="absolute bottom-0 left-0 right-0 z-[2] pointer-events-none h-56" style={{ background: "linear-gradient(to bottom, transparent 0%, #000 70%, #000 100%)" }} />

      <Navbar />

      <div className="relative z-10 flex-1 flex items-center pt-28 pb-10 px-4 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Left — copy */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
              className="landing-glass mb-7 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 sm:pr-4 max-w-[94vw]"
            >
              <span className="shrink-0 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-bold tracking-wide font-sans" style={{ ...goldText, border: "1px solid rgba(237,208,138,0.25)" }}>
                ♫ FREE TRIAL
              </span>
              <span className="text-[11px] sm:text-[13px] text-white/80 font-sans truncate">Try free for 30 days — no credit card required</span>
            </motion.div>

            <h1 className="font-serif italic text-white m-0 mb-6 max-w-xl px-1" style={{ fontSize: "clamp(2.3rem, 5.2vw, 4.4rem)", lineHeight: 1.0, letterSpacing: "-0.02em", fontWeight: 700 }}>
              {words.map((word, i) => (
                <motion.span
                  key={word + i}
                  initial={reduce ? false : { opacity: 0, filter: "blur(10px)", y: -18 }}
                  animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.6, ease: EASE }}
                  className="inline-block"
                  style={{ marginRight: "0.22em", ...(word === "Simchas" ? { ...goldText, filter: "drop-shadow(0 0 18px rgba(242,184,75,0.30))" } : {}) }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <BlurText text={subtitle} delay={90} animateBy="words" direction="top" className="mb-9 text-base md:text-lg text-white/60 font-light font-sans leading-relaxed max-w-lg tracking-wide" />

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5 w-full sm:w-auto max-w-sm sm:max-w-none"
            >
              <Link to="/auth/register" className={`flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold font-sans transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 ${FOCUS}`} style={{ background: GOLD, color: "#1a0f00", boxShadow: "0 8px 32px rgba(199,161,85,0.40)" }}>
                {cta} <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#features" className={`landing-glass flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-medium text-white/75 font-sans transition-colors hover:text-white ${FOCUS}`}>
                {ctaSecondary}
              </a>
            </motion.div>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
              className="flex flex-wrap items-stretch justify-center lg:justify-start gap-4 mt-10"
            >
              {[
                { value: "$29.99/mo", label: "Starting price · cancel anytime" },
              ].map(({ value, label }) => (
                <div key={value} className="landing-glass rounded-[1.25rem] px-7 py-5 text-left" style={{ minWidth: 190 }}>
                  <p className="font-serif italic font-bold leading-none mb-2" style={{ fontSize: "1.9rem", ...goldText }}>{value}</p>
                  <p className="text-[12px] text-white/45 font-sans font-light leading-snug">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — product preview */}
          <div className="hidden lg:block">
            <HeroPreview reduce={reduce} />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-[12px] sm:text-[13px] text-white/40 font-sans font-light">
        {["No credit card", "30-day money-back guarantee", "Cancel anytime"].map((item) => (
          <span key={item} className="whitespace-nowrap inline-flex items-center gap-1"><Check className="h-3 w-3 text-[#C7A155]" /> {item}</span>
        ))}
      </div>
    </section>
  );
}

// ── Social proof strip ────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section aria-label="Trusted by" className="relative z-10 border-y border-white/10 bg-[#080808] py-8">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-sans">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#D9B36B" }}>Trusted by</span>
          <span className="text-[15px] sm:text-base text-white/75">musicians across North America &amp; Israel</span>
        </p>
      </div>
    </section>
  );
}

// ── Mission (scroll-driven word reveal) ───────────────────────────────────────

interface ScrollWordProps { word: string; progress: MotionValue<number>; range: [number, number]; highlighted?: boolean }
function ScrollWord({ word, progress, range, highlighted = false }: ScrollWordProps) {
  const opacity = useTransform(progress, range, [0.45, 1]);
  return (
    <motion.span style={{ opacity, display: "inline-block", marginRight: "0.25em" }}>
      {highlighted ? <span className="font-serif italic" style={goldText}>{word}</span> : <span className="text-white/90">{word}</span>}
    </motion.span>
  );
}

function MissionSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const wordProgress = useTransform(scrollYProgress, [0.15, 0.85], [0, 1]);

  const para1 = "We built SimchaSync for the musicians behind every simcha — where bookings, invoices, and client relationships stay synced without the chaos.";
  const para2 = "A platform where your music business runs as beautifully as the celebrations you perform — less admin, less friction, more music.";
  const words1 = para1.split(" ");
  const words2 = para2.split(" ");
  const total = words1.length + words2.length;
  const HIGHLIGHTED = new Set(["simcha", "synced", "beautifully", "music."]);

  const renderStatic = (words: string[], offset = 0) =>
    words.map((word, i) => {
      const hl = HIGHLIGHTED.has(word.toLowerCase().replace(/[.,—]/g, ""));
      return (
        <span key={offset + i} style={{ display: "inline-block", marginRight: "0.25em" }}>
          {hl ? <span className="font-serif italic" style={goldText}>{word}</span> : <span className="text-white/80">{word}</span>}
        </span>
      );
    });

  return (
    <section ref={sectionRef} className="relative bg-black overflow-hidden flex items-center" style={{ minHeight: reduce ? "auto" : "78vh", padding: "clamp(3.5rem,7vw,6rem) clamp(1.5rem,5vw,5rem)" }}>
      <AmbientVideo src={MISSION_VIDEO} className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none" style={{ opacity: 0.3 }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 95% 80% at 50% 45%, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.82) 55%, rgba(0,0,0,0.95) 100%)" }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-56 pointer-events-none" style={{ background: "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 pointer-events-none" style={{ background: "linear-gradient(to top, #000, transparent)" }} />

      <div className="relative z-10 max-w-5xl mx-auto">
        <p className="font-medium leading-relaxed select-none" style={{ fontSize: "clamp(1.5rem,3.4vw,2.6rem)", letterSpacing: "-0.02em", textShadow: "0 2px 14px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9)" }}>
          {reduce ? renderStatic(words1) : words1.map((word, i) => (
            <ScrollWord key={i} word={word} progress={wordProgress} range={[i / total, (i + 1) / total]} highlighted={HIGHLIGHTED.has(word.toLowerCase().replace(/[.,—]/g, ""))} />
          ))}
        </p>
        <p className="font-medium leading-relaxed select-none mt-8" style={{ fontSize: "clamp(1.15rem,2.4vw,1.9rem)", letterSpacing: "-0.02em", textShadow: "0 2px 14px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9)" }}>
          {reduce ? renderStatic(words2, words1.length) : words2.map((word, i) => {
            const idx = words1.length + i;
            return <ScrollWord key={i} word={word} progress={wordProgress} range={[idx / total, (idx + 1) / total]} highlighted={HIGHLIGHTED.has(word.toLowerCase().replace(/[.,—]/g, ""))} />;
          })}
        </p>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURE_ICONS = [Calendar, Users, CreditCard, Sparkles];
const FEATURE_TAGS = [
  ["Hebrew Dates", "Contracts", "Voice Memos", "Venues"],
  ["Client History", "Balances", "Preferences", "CRM"],
  ["Stripe", "PDF Invoices", "Payment Links", "P&L"],
  ["Caption Writer", "Hashtags", "Booking Chatbot", "Smart Replies"],
];

function FeaturesSection({ items }: { items: { title: string; desc: string }[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const four = items.slice(0, 4);

  return (
    <section id="features" ref={ref} className="relative bg-[#050505] overflow-hidden scroll-mt-24">
      <AmbientVideo src={FEATURES_BG_VIDEO} className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none z-0" style={{ opacity: 0.4 }} />
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.82) 70%, rgba(5,5,5,0.95) 100%)" }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-40 z-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, #050505, transparent)" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 z-0 pointer-events-none" style={{ background: "linear-gradient(to top, #050505, transparent)" }} />

      <div className="relative z-10 mx-auto max-w-6xl" style={{ padding: "clamp(5rem,10vw,8rem) clamp(1.5rem,5vw,3rem) 4rem" }}>
        <motion.div initial={reduce ? false : { opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE }}>
          <p className="text-[13px] font-medium font-sans uppercase tracking-[0.12em] mb-4" style={goldText}>// Everything you need</p>
          <h2 className="font-serif italic text-white m-0" style={{ fontSize: "clamp(2.4rem,7vw,5rem)", lineHeight: 0.94, letterSpacing: "-0.02em", fontWeight: 700 }}>
            Run your music<br />business
          </h2>
        </motion.div>

        <div className="grid gap-5 mt-14 sm:grid-cols-2 lg:grid-cols-4 items-start">
          {four.map((item, i) => {
            const Icon = FEATURE_ICONS[i];
            const tags = FEATURE_TAGS[i];
            const isAI = /^ai/i.test(item.title);
            return (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.12 + i * 0.1, ease: EASE }}
                whileHover={reduce ? undefined : { y: -6 }}
                className={`group ${isAI ? "landing-glass-strong" : "landing-glass"} flex flex-col p-6`}
                style={{ borderRadius: 22 }}
              >
                {/* Icon + optional AI badge */}
                <div className="mb-5 flex items-center justify-between">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 48, height: 48, borderRadius: 14,
                      color: isAI ? "#1a0f00" : "#EDD08A",
                      background: isAI ? GOLD : "rgba(237,208,138,0.10)",
                      border: isAI ? "none" : "1px solid rgba(237,208,138,0.20)",
                      boxShadow: isAI ? "0 6px 22px rgba(199,161,85,0.45)" : undefined,
                    }}
                  >
                    <Icon className="h-[22px] w-[22px]" />
                  </div>
                  {isAI && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider font-sans" style={{ background: GOLD, color: "#1a0f00" }}>
                      <Sparkles className="h-3 w-3" /> NEW · AI
                    </span>
                  )}
                </div>

                {/* Title + description */}
                <h3 className="font-serif italic font-bold m-0" style={{ fontSize: "clamp(1.45rem,2.4vw,1.8rem)", letterSpacing: "-0.02em", lineHeight: 1.05, ...goldText }}>
                  {item.title.replace(/ — Coming Soon/i, "")}
                </h3>
                <p className="mt-2.5 text-[13.5px] text-white/60 font-sans font-light leading-relaxed">
                  {item.desc.replace(/ \(Coming Soon\)/i, "")}
                </p>

                {/* Tags footer */}
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2.5 py-1 text-[11px] text-white/70 font-sans whitespace-nowrap transition-colors group-hover:text-white/90"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Product showcase ──────────────────────────────────────────────────────────

function Bar({ h, mint = false }: { h: number; mint?: boolean }) {
  return <span className="flex-1 rounded-[3px]" style={{ height: `${h}%`, background: mint ? "linear-gradient(180deg,#2BE2A6,rgba(43,226,166,0.25))" : "linear-gradient(180deg,#EDD08A,rgba(199,161,85,0.25))" }} />;
}

function ShowcaseSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="showcase" ref={ref} className="relative bg-[#050505] overflow-hidden scroll-mt-24" style={{ padding: "clamp(4rem,8vw,6.5rem) clamp(1.5rem,5vw,3rem)" }}>
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 55% 60% at 80% 45%, rgba(199,161,85,0.14), transparent 68%)" }} />
      {/* Dot-grid texture (masked so it fades out) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px", WebkitMaskImage: "radial-gradient(ellipse 55% 60% at 78% 45%, #000, transparent 72%)", maskImage: "radial-gradient(ellipse 55% 60% at 78% 45%, #000, transparent 72%)" }} />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — copy */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE }}>
          <p className="text-[13px] font-medium font-sans uppercase tracking-[0.14em] mb-4" style={goldText}>// See it in action</p>
          <h3 className="font-serif italic text-white m-0 mb-5" style={{ fontSize: "clamp(2rem,3.8vw,3rem)", lineHeight: 1.02, letterSpacing: "-0.02em", fontWeight: 700 }}>
            Your whole season,<br className="hidden sm:block" /> in one clear view
          </h3>
          <p className="text-white/60 font-sans font-light leading-relaxed mb-7" style={{ maxWidth: "46ch" }}>
            From first inquiry to final payment — every booking, colleague and dollar stays synced, so nothing slips through the cracks.
          </p>
          <ul className="space-y-3.5 mb-8">
            {[
              "Calendar with Hebrew & English dates side by side",
              "Assign band members & track who's confirmed",
              "Automatic payment reminders & follow-ups",
              "One-tap financial reports for the accountant",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px] text-white/85 font-sans font-light">
                <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(199,161,85,0.16)", color: "#EDD08A" }}><Check className="h-3.5 w-3.5" /></span>
                {t}
              </li>
            ))}
          </ul>
          <Link to="/auth/register" className={`inline-flex items-center gap-2 rounded-full text-[15px] font-semibold font-sans ${FOCUS}`} style={goldText}>
            Start free and see it yourself <ArrowRight className="h-4 w-4" style={{ color: "#C7A155" }} />
          </Link>
        </motion.div>

        {/* Right — floating dashboard */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          className="relative mx-auto w-full max-w-lg"
          style={{ perspective: 1300 }}
        >
          <div aria-hidden className="absolute -inset-8 -z-10" style={{ background: "radial-gradient(ellipse at 55% 45%, rgba(199,161,85,0.22), transparent 70%)", filter: "blur(40px)" }} />
          <div className="landing-glass-strong rounded-3xl p-4" style={{ transform: reduce ? undefined : "rotateY(-7deg) rotateX(3deg)", transformStyle: "preserve-3d" }} aria-hidden>
            <div className="flex items-center gap-1.5 px-1 pb-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff6058" }} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ffbe2f" }} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2bca43" }} />
              <span className="ml-auto text-[11px] text-white/45 font-sans">Dashboard · This month</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/40 font-sans">Revenue</p>
                <p className="font-serif italic font-bold mt-0.5" style={{ fontSize: "1.5rem", ...goldText }}>$18,420</p>
                <div className="mt-2 flex items-end gap-[3px] h-6">{[40, 55, 48, 70, 62, 88, 100].map((h, i) => <Bar key={i} h={h} />)}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/40 font-sans">Bookings</p>
                <p className="font-serif italic font-bold mt-0.5" style={{ fontSize: "1.5rem", ...goldText }}>27</p>
                <div className="mt-2 flex items-end gap-[3px] h-6">{[50, 36, 60, 52, 78, 66, 92].map((h, i) => <Bar key={i} h={h} mint />)}</div>
              </div>
              <p className="col-span-2 mt-1 mb-0.5 text-[10px] uppercase tracking-wide text-white/40 font-sans">Upcoming</p>
              {[
                { av: "GW", t: "Goldstein Wedding", s: "Sun · Ateres Chaya · 8:00 PM", tag: "Paid", ok: true },
                { av: "KB", t: "Bar Mitzvah — Klein", s: "Thu · Terrace on the Park", tag: "Deposit", ok: false },
              ].map((r) => (
                <div key={r.av} className="col-span-2 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold" style={{ background: GOLD, color: "#1a0f00" }}>{r.av}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-white/90 truncate font-sans">{r.t}</p>
                    <p className="text-[10.5px] text-white/45 truncate font-sans">{r.s}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold font-sans" style={r.ok ? { background: "rgba(199,161,85,0.2)", color: "#EDD08A" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>{r.tag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Floating "payment received" toast for depth */}
          {!reduce && (
            <div className="landing-glass-strong absolute -bottom-6 right-3 hidden items-center gap-2.5 rounded-2xl px-4 py-3 sm:flex" style={{ boxShadow: "0 22px 50px -20px rgba(0,0,0,0.75)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(43,226,166,0.16)", color: "#2BE2A6" }}><Check className="h-4 w-4" /></span>
              <span>
                <span className="block text-[12px] font-semibold text-white font-sans">Payment received</span>
                <span className="block text-[11px] text-white/50 font-sans">+$2,400 · Goldstein Wedding</span>
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
// NOTE: sample testimonials — replace with real client quotes before launch.

const TESTIMONIALS = [
  { q: "I used to track bookings in three different notebooks. Now everything — dates, deposits, the band — is in one place. Total game-changer.", n: "David Rosen", r: "Bandleader, Brooklyn", av: "DR" },
  { q: "The invoice + Stripe combo alone paid for itself in the first week. Clients pay faster and I stopped chasing deposits.", n: "Shani Klein", r: "Singer, Lakewood", av: "SK" },
  { q: "Hebrew dates built in, voice memos on each event, and AI captions for social — it just gets our world. Feels made for us.", n: "Meir Friedman", r: "Freilach Orchestra", av: "MF" },
];

function Testimonials() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section aria-label="Testimonials" ref={ref} className="relative bg-[#050505] overflow-hidden" style={{ padding: "clamp(5rem,10vw,7rem) clamp(1.5rem,5vw,3rem)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <p className="text-[13px] font-medium font-sans uppercase tracking-[0.12em] mb-4" style={goldText}>// Loved by performers</p>
          <h2 className="font-serif italic text-white m-0" style={{ fontSize: "clamp(2rem,5vw,3.5rem)", lineHeight: 1, letterSpacing: "-0.02em", fontWeight: 700 }}>
            Less admin, more music
          </h2>
        </div>
        <div className="grid gap-5 mx-auto max-w-md lg:max-w-none lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.n}
              initial={reduce ? false : { opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: EASE }}
              className="landing-glass flex flex-col p-6"
              style={{ borderRadius: 22 }}
            >
              <Quote className="h-6 w-6 mb-3" style={{ color: "#C7A155" }} aria-hidden />
              <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="h-3.5 w-3.5 fill-current" style={{ color: "#EDD08A" }} />)}
              </div>
              <blockquote className="text-[15px] text-white/80 font-sans font-light leading-relaxed flex-1">{t.q}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold" style={{ background: GOLD, color: "#1a0f00" }}>{t.av}</span>
                <span>
                  <span className="block text-sm font-semibold text-white/90 font-sans">{t.n}</span>
                  <span className="block text-[12.5px] text-white/45 font-sans">{t.r}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing (with monthly / yearly toggle) ────────────────────────────────────

type Plan = { name: string; price: string; period: string; desc: string; features: string[]; cta: string; popular?: boolean; contactHref?: string };

function priceFor(price: string, yearly: boolean): string {
  const n = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return price;
  const val = yearly ? Math.max(Math.round(n * 0.8) - 0.01, 0) : n;
  return `$${val.toFixed(2)}`;
}

function PricingSection({ plans }: { plans: Plan[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [yearly, setYearly] = useState(false);
  const toggleId = useId();

  return (
    <section id="pricing" ref={ref} className="relative bg-[#050505] overflow-hidden scroll-mt-24" style={{ padding: "clamp(5rem,10vw,7rem) clamp(1.5rem,5vw,3rem)" }}>
      {/* Top gold glow */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-0 pointer-events-none" style={{ height: 560, background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(199,161,85,0.14), transparent 68%)" }} />
      {/* Soft bottom glow */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 z-0 pointer-events-none" style={{ height: 320, background: "radial-gradient(ellipse 70% 100% at 50% 100%, rgba(199,161,85,0.06), transparent 72%)" }} />
      {/* Dot-grid texture (masked so it fades out) */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "24px 24px", WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 32%, #000, transparent 72%)", maskImage: "radial-gradient(ellipse 80% 60% at 50% 32%, #000, transparent 72%)" }} />

      <motion.div initial={reduce ? false : { opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE }} className="relative z-10 text-center mb-9">
        <p className="text-[13px] font-medium font-sans uppercase tracking-[0.14em] mb-4" style={goldText}>// Transparent pricing</p>
        <h2 className="font-serif italic text-white m-0 mb-4" style={{ fontSize: "clamp(2.2rem,6vw,4rem)", lineHeight: 1.02, letterSpacing: "-0.02em", fontWeight: 700 }}>Simple, honest pricing</h2>
        <p className="text-[15px] text-white/70 font-sans font-light m-0">Start with a free 30-day trial. Full access, no credit card required.</p>
      </motion.div>

      <div className="relative z-10 flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm font-sans ${!yearly ? "text-white" : "text-white/45"}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="Toggle yearly billing"
          id={toggleId}
          onClick={() => setYearly((y) => !y)}
          className={`relative h-7 w-[52px] rounded-full border transition-colors ${FOCUS}`}
          style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(237,208,138,0.3)" }}
        >
          <span className="absolute top-[3px] h-[21px] w-[21px] rounded-full transition-all" style={{ left: yearly ? "27px" : "3px", background: GOLD }} />
        </button>
        <span className={`text-sm font-sans ${yearly ? "text-white" : "text-white/45"}`}>Yearly</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold font-sans" style={{ background: "rgba(43,226,166,0.14)", color: "#2BE2A6" }}>Save 20%</span>
      </div>

      <div className="relative z-10 mx-auto grid gap-6 max-w-[420px] md:max-w-[860px] md:grid-cols-2 xl:max-w-[1360px] xl:grid-cols-4">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={reduce ? false : { opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: EASE }}
            className={`relative flex flex-col ${plan.popular ? "landing-glass-strong xl:scale-[1.035]" : "landing-glass"}`}
            style={{
              borderRadius: 24,
              padding: "34px 28px 28px",
              ...(plan.popular ? { border: "1px solid rgba(237,208,138,0.45)", boxShadow: "0 30px 90px -35px rgba(199,161,85,0.45)" } : {}),
            }}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold tracking-wider font-sans whitespace-nowrap" style={{ background: GOLD, color: "#1a0f00", boxShadow: "0 8px 20px rgba(199,161,85,0.5)" }}>
                <Star className="h-3 w-3 fill-current" /> MOST POPULAR
              </span>
            )}

            <h3 className="font-serif italic font-bold m-0 mb-1.5" style={{ fontSize: "1.65rem", ...goldText }}>{plan.name}</h3>
            <p className="text-[13px] text-white/70 font-sans font-light m-0 min-h-[38px]">{plan.desc}</p>

            <div className="mt-4 mb-6 pb-6 flex items-end" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="font-serif italic text-white font-bold" style={{ fontSize: plan.contactHref ? "2.2rem" : "2.9rem", lineHeight: 0.95 }}>{plan.contactHref ? plan.price : priceFor(plan.price, yearly)}</span>
              {!plan.contactHref && <span className="text-[14px] text-white/55 font-sans ml-1.5 mb-1">/mo</span>}
              {!plan.contactHref && yearly && <span className="ml-auto mb-1 rounded-full px-2 py-0.5 text-[10px] font-semibold font-sans" style={{ background: "rgba(43,226,166,0.14)", color: "#2BE2A6" }}>billed yearly</span>}
            </div>

            <ul className="flex-1 flex flex-col gap-3 m-0 p-0 list-none mb-7">
              {plan.features.map((f) => {
                const isComingSoon = /coming soon/i.test(f);
                const label = f.replace(/ — Coming Soon/i, "");
                return (
                  <li key={f} className={`flex items-start gap-2.5 text-[13.5px] font-sans font-light ${isComingSoon ? "text-white/45" : "text-white/85"}`}>
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" style={isComingSoon ? { color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)" } : { color: "#EDD08A", background: "rgba(199,161,85,0.16)" }}><Check className="h-3 w-3" /></span>
                    {label}
                  </li>
                );
              })}
            </ul>

            {plan.contactHref ? (
              <a href={plan.contactHref} className={`block text-center rounded-full py-3.5 text-[15px] font-semibold font-sans transition-all hover:-translate-y-0.5 ${FOCUS}`} style={{ border: "1px solid rgba(237,208,138,0.3)", ...goldText }}>
                {plan.cta}
              </a>
            ) : (
              <Link to="/auth/register" className={`block text-center rounded-full py-3.5 text-[15px] font-semibold font-sans transition-all hover:-translate-y-0.5 ${FOCUS}`} style={plan.popular ? { background: GOLD, color: "#1a0f00", boxShadow: "0 8px 26px rgba(199,161,85,0.4)" } : { border: "1px solid rgba(237,208,138,0.3)", ...goldText }}>
                {plan.cta}
              </Link>
            )}
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 mt-10 text-[12px] sm:text-[13px] text-white/35 font-sans font-light">
        {["No credit card required", "Cancel anytime", "30-day money-back guarantee"].map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 whitespace-nowrap"><Check className="h-3 w-3 text-[#C7A155]" /> {item}</span>
        ))}
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section ref={ref} className="relative bg-[#050505] overflow-hidden" style={{ padding: "clamp(3rem,6vw,5rem) clamp(1.5rem,5vw,3rem) clamp(4rem,7vw,6rem)" }}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: EASE }}
        className="landing-glass-strong relative mx-auto max-w-4xl overflow-hidden text-center"
        style={{ borderRadius: 32, padding: "clamp(2.75rem,6vw,4.5rem) clamp(1.5rem,5vw,3rem)" }}
      >
        {/* Layered gold glow */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 90% at 50% 0%, rgba(199,161,85,0.18), transparent 62%)" }} />
        <div aria-hidden className="absolute left-1/2 -top-12 -translate-x-1/2 pointer-events-none" style={{ width: 480, height: 300, borderRadius: "50%", background: "#C7A155", filter: "blur(130px)", opacity: 0.24 }} />

        <p className="relative text-[12px] font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#D9B36B" }}>Start today</p>
        <h2 className="relative font-serif italic text-white m-0 mb-4 mx-auto" style={{ fontSize: "clamp(2.1rem,4.6vw,3.6rem)", lineHeight: 1.02, letterSpacing: "-0.02em", fontWeight: 700, maxWidth: "18ch" }}>
          Ready to make every <span style={goldText}>simcha</span> easier?
        </h2>
        <p className="relative text-white/60 font-sans font-light text-[16px] sm:text-[17px] mb-8 mx-auto" style={{ maxWidth: "44ch" }}>
          Join the performers who run their music business on SimchaSync.
        </p>
        <Link to="/auth/register" className={`relative inline-flex items-center justify-center gap-2 rounded-full px-9 py-4 text-base font-semibold font-sans transition-transform hover:-translate-y-0.5 ${FOCUS}`} style={{ background: GOLD, color: "#1a0f00", boxShadow: "0 10px 40px rgba(199,161,85,0.45)" }}>
          Start your free 30-day trial <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="relative mt-5 text-[13px] text-white/40 font-sans">No credit card required · Cancel anytime</p>
      </motion.div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 text-center sm:text-left bg-[#050505]" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "28px clamp(1.5rem,5vw,5rem)" }}>
      <BrandLogo size="sm" />
      <p className="order-last sm:order-none text-[13px] text-white/55 font-sans m-0">© {new Date().getFullYear()} SimchaSync. All rights reserved.</p>
      <div className="flex gap-5">
        {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "mailto:simchasync@gmail.com"]].map(([label, href]) =>
          href.startsWith("mailto") ? (
            <a key={label} href={href} className={`text-[13px] font-medium text-white/75 font-sans no-underline transition-colors hover:text-[#C7A155] ${FOCUS}`}>{label}</a>
          ) : (
            <Link key={label} to={href} className={`text-[13px] font-medium text-white/75 font-sans no-underline transition-colors hover:text-[#C7A155] ${FOCUS}`}>{label}</Link>
          )
        )}
      </div>
    </footer>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Index() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const l = t.landing;

  if (!loading && user) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen antialiased" style={{ background: "#050505" }}>
      <a href="#features" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <main>
        <Hero subtitle={l.hero.subtitle} cta={l.hero.cta} ctaSecondary={l.hero.ctaSecondary} />
        <SocialProof />
        <MissionSection />
        <FeaturesSection items={l.features.items} />
        <ShowcaseSection />
        <Testimonials />
        <PricingSection plans={l.pricing.plans} />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
