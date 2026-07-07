import { Navigate, Link } from "react-router-dom";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import BrandLogo from "@/components/BrandLogo";
import BlurText from "@/components/landing/BlurText";
import { Calendar, CreditCard, Users, Check, ArrowRight, Star, ChevronRight } from "lucide-react";

// ── Scroll-reveal word component ──────────────────────────────────────────────

interface ScrollWordProps {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
  highlighted?: boolean;
}

function ScrollWord({ word, progress, range, highlighted = false }: ScrollWordProps) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return (
    <motion.span style={{ opacity, display: "inline-block", marginRight: "0.25em" }}>
      {highlighted ? (
        <span className="font-serif italic" style={goldText}>{word}</span>
      ) : (
        <span className="text-white/65">{word}</span>
      )}
    </motion.span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const;
const GOLD = "linear-gradient(135deg, #EDD08A 0%, #C7A155 50%, #9A7830 100%)";
const goldText: React.CSSProperties = {
  background: GOLD,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10">
      <Link to="/" className="shrink-0 transition-opacity hover:opacity-80">
        <BrandLogo size="sm" />
      </Link>

      {/* Center pill — desktop */}
      <div className="landing-glass hidden md:flex items-center gap-0.5 rounded-full px-1.5 py-1.5">
        {(["features", "pricing"] as const).map((id) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:text-white font-sans capitalize"
          >
            {id}
          </a>
        ))}
        <Link to="/auth/login" className="rounded-full px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:text-white font-sans">
          Log In
        </Link>
        <Link
          to="/auth/register"
          className="landing-glass-strong flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ml-1 font-sans transition-opacity hover:opacity-80"
          style={goldText}
        >
          Start Free Trial <ChevronRight className="h-3.5 w-3.5" style={{ color: "#C7A155" }} />
        </Link>
      </div>

      {/* Mobile */}
      <div className="flex items-center gap-2 md:hidden">
        <Link to="/auth/login" className="text-sm text-white/70 font-sans px-3 py-2">Log In</Link>
        <Link
          to="/auth/register"
          className="landing-glass-strong rounded-full px-4 py-2 text-sm font-semibold font-sans"
          style={goldText}
        >
          Sign Up
        </Link>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";

// Mindloop-style direct MP4 with scroll-driven parallax + zoom + fade-out
function HeroBackground() {
  const { scrollYProgress } = useScroll();
  // Parallax drift (small range keeps upscaling minimal → crisper footage)
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);
  // Slow cinematic zoom as the user scrolls
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1.2]);
  // Fade out as hero exits
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.72, 0]);

  return (
    <div aria-hidden className="absolute inset-0 z-0 overflow-hidden bg-black">
      <motion.video
        className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
        src={HERO_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        style={{
          opacity,
          y,
          scale,
          // GPU compositing for smooth 60fps scroll + sharper scaling
          willChange: "transform, opacity",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
          imageRendering: "auto",
        }}
      />
      {/* Bottom section fade into features */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
        style={{ height: "16rem", background: "linear-gradient(to bottom, transparent, #000)" }}
      />
    </div>
  );
}

function Hero({ subtitle, cta, ctaSecondary }: { subtitle: string; cta: string; ctaSecondary: string }) {
  // "Manage Your" | "Simchas" | "Like a Pro"
  const line1 = ["Manage", "Your"];
  const line2 = ["Like", "a", "Pro"];
  const allWords = [...line1, "Simchas", ...line2];

  return (
    <section className="relative min-h-screen bg-black flex flex-col overflow-hidden selection:bg-white selection:text-black">
      <HeroBackground />

      {/* Overlay for text contrast */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.70) 100%)" }}
      />

      {/* Gold radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 30% at 50% -5%, rgba(237,208,138,0.10), transparent 60%)" }}
      />

      {/* Fade into mission section — pure black to match the next section */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 z-[2] pointer-events-none h-56"
        style={{ background: "linear-gradient(to bottom, transparent 0%, #000 70%, #000 100%)" }}
      />

      <Navbar />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-24 pb-8 px-4 sm:px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="landing-glass mb-8 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 sm:pr-4 max-w-[94vw]"
        >
          <span
            className="shrink-0 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-bold tracking-wide font-sans"
            style={{ ...goldText, border: "1px solid rgba(237,208,138,0.25)" }}
          >
            ♫ FREE TRIAL
          </span>
          <span className="text-[11px] sm:text-[13px] text-white/80 font-sans truncate">
            Try free for 30 days — No credit card required
          </span>
        </motion.div>

        {/* Headline — Instrument Serif italic, word-by-word blur reveal */}
        <h1
          className="font-serif italic text-white m-0 mb-6 max-w-3xl mx-auto px-1"
          style={{ fontSize: "clamp(2.4rem, 9vw, 6rem)", lineHeight: 0.98, letterSpacing: "-0.02em", fontWeight: 700 }}
        >
          {allWords.map((word, i) => (
            <motion.span
              key={word + i}
              initial={{ opacity: 0, filter: "blur(10px)", y: -18 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ delay: i * 0.10, duration: 0.6, ease: EASE }}
              className="inline-block"
              style={{
                marginRight: "0.22em",
                ...(word === "Simchas"
                  ? { ...goldText, filter: "drop-shadow(0 0 18px rgba(242,184,75,0.30))" }
                  : {}),
              }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <BlurText
          text={subtitle}
          delay={90}
          animateBy="words"
          direction="top"
          className="mb-10 text-base md:text-lg text-white/60 font-light font-sans leading-relaxed max-w-xl mx-auto tracking-wide"
        />

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5 w-full sm:w-auto max-w-sm sm:max-w-none"
        >
          <Link
            to="/auth/register"
            className="flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold font-sans transition-all duration-200 hover:opacity-88 hover:-translate-y-0.5"
            style={{ background: GOLD, color: "#1a0f00", boxShadow: "0 8px 32px rgba(199,161,85,0.40)" }}
          >
            {cta} <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="#features"
            className="landing-glass flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-medium text-white/75 font-sans transition-colors hover:text-white"
          >
            {ctaSecondary}
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
          className="flex flex-wrap items-stretch justify-center gap-4 mt-10"
        >
          {[
            { value: "$29.99/mo", label: "Starting price · cancel anytime" },
            { value: "2,000+", label: "Families across North America & Israel" },
          ].map(({ value, label }) => (
            <div key={value} className="landing-glass rounded-[1.25rem] px-7 py-5 text-left" style={{ minWidth: 190 }}>
              <p className="font-serif italic font-bold leading-none mb-2" style={{ fontSize: "1.9rem", ...goldText }}>{value}</p>
              <p className="text-[12px] text-white/45 font-sans font-light leading-snug">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Trust strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.6, ease: EASE }}
        className="relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-[12px] sm:text-[13px] text-white/40 font-sans font-light"
      >
        {["No credit card", "30-day money-back guarantee", "Cancel anytime"].map((item) => (
          <span key={item} className="whitespace-nowrap">✓ {item}</span>
        ))}
      </motion.div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURE_ICONS = [Calendar, CreditCard, Users];

const FEATURES_BG_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260611_183632_c311af08-e4b7-458f-81e7-79847a49b3d3.mp4";

function FeaturesSection({
  items,
}: {
  items: { title: string; desc: string }[];
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  // Scroll-driven background video (behind the cards)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const bgY       = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const bgScale   = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.04, 1.12]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 0.4, 0.4, 0]);

  const TAGS = [
    ["Hebrew Dates", "Contracts", "Voice Memos", "Venues"],
    ["Stripe", "PDF Invoices", "Payment Links", "P&L Reports"],
    ["Client History", "Balances", "Preferences", "CRM"],
  ];

  return (
    <section
      id="features"
      ref={ref}
      className="relative bg-[#050505] overflow-hidden"
    >
      {/* ── Scroll-driven background video (behind the cards) ── */}
      <motion.video
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none z-0"
        src={FEATURES_BG_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        style={{
          y: bgY,
          scale: bgScale,
          opacity: bgOpacity,
          willChange: "transform, opacity",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      />
      {/* Scrim over video so cards/text stay legible */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.82) 70%, rgba(5,5,5,0.95) 100%)",
        }}
      />
      {/* Top + bottom fades to blend into neighbouring sections */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 z-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #050505, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 z-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, #050505, transparent)" }}
      />

      {/* Gold radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(237,208,138,0.05), transparent 60%)" }}
      />

      <div
        className="relative z-10 flex flex-col"
        style={{ padding: "clamp(5rem,10vw,8rem) clamp(1.5rem,5vw,5rem) 4rem" }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p className="text-[13px] font-medium font-sans uppercase tracking-[0.12em] mb-4" style={goldText}>
            // Everything you need
          </p>
          <h2
            className="font-serif italic text-white m-0"
            style={{ fontSize: "clamp(2.6rem,7vw,5.5rem)", lineHeight: 0.94, letterSpacing: "-0.02em", fontWeight: 700 }}
          >
            Run your music<br />business
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-5 mt-14" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
          {items.slice(0, 3).map((item, i) => {
            const Icon = FEATURE_ICONS[i];
            const tags = TAGS[i];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.65, delay: 0.15 + i * 0.12, ease: EASE }}
                className="landing-glass flex flex-col p-6"
                style={{ borderRadius: 22, minHeight: 340 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="landing-glass flex items-center justify-center shrink-0"
                    style={{ width: 44, height: 44, borderRadius: 12, color: "#C7A155" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5" style={{ maxWidth: "65%" }}>
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="landing-glass rounded-full px-2.5 py-1 text-[11px] text-white/65 font-sans whitespace-nowrap"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-1" />

                <div className="mt-6">
                  <h3
                    className="font-serif italic font-bold m-0"
                    style={{ fontSize: "clamp(1.6rem,3vw,2rem)", letterSpacing: "-0.02em", lineHeight: 1, ...goldText }}
                  >
                    {item.title.replace(/ — Coming Soon/i, "")}
                  </h3>
                  <p
                    className="mt-3 text-sm text-white/55 font-sans font-light leading-relaxed"
                    style={{ maxWidth: "34ch" }}
                  >
                    {item.desc.replace(/ \(Coming Soon\)/i, "")}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Mission (scroll-driven word reveal) ───────────────────────────────────────

const MISSION_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4";

function MissionSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Word-reveal timeline is compressed into the middle of the scroll so the
  // text finishes revealing before the section scrolls away.
  const wordProgress = useTransform(scrollYProgress, [0.15, 0.85], [0, 1]);

  // Background video: subtle parallax drift + gentle scale as the section passes.
  // Tighter ranges keep upscaling minimal → crisper footage.
  const bgY     = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const bgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.04, 1.12]);

  const para1 = "We built SimchaSync for the musicians behind every simcha — where bookings, invoices, and client relationships stay synced without the chaos.";
  const para2 = "A platform where your music business runs as beautifully as the celebrations you perform — less admin, less friction, more music.";

  const words1 = para1.split(" ");
  const words2 = para2.split(" ");
  const total = words1.length + words2.length;
  const HIGHLIGHTED = new Set(["simcha", "synced", "beautifully", "music."]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-black overflow-hidden flex items-center"
      style={{ minHeight: "115vh", padding: "clamp(6rem,12vw,10rem) clamp(1.5rem,5vw,5rem)" }}
    >
      {/* ── Background video (behind the text) ── */}
      <motion.video
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
        src={MISSION_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        style={{
          y: bgY,
          scale: bgScale,
          opacity: 0.58,
          // GPU compositing for smooth 60fps scroll + sharper scaling
          willChange: "transform, opacity",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      />

      {/* Scrim for text legibility — darker at edges, lets center art breathe */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 75% at 50% 45%, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.72) 70%, rgba(0,0,0,0.92) 100%)",
        }}
      />
      {/* Top + bottom fades to blend into neighbouring sections */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-56 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #000 0%, #000 30%, transparent 100%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
        style={{ background: "linear-gradient(to top, #000, transparent)" }}
      />

      {/* ── Text (in front) ── */}
      <div className="relative z-10 max-w-5xl mx-auto">
        <p
          className="font-medium leading-relaxed select-none"
          style={{ fontSize: "clamp(1.5rem,3.4vw,2.6rem)", letterSpacing: "-0.02em", textShadow: "0 2px 30px rgba(0,0,0,0.6)" }}
        >
          {words1.map((word, i) => (
            <ScrollWord
              key={i}
              word={word}
              progress={wordProgress}
              range={[i / total, (i + 1) / total]}
              highlighted={HIGHLIGHTED.has(word.toLowerCase().replace(/[.,—]/g, ""))}
            />
          ))}
        </p>
        <p
          className="font-medium leading-relaxed select-none mt-8"
          style={{ fontSize: "clamp(1.15rem,2.4vw,1.9rem)", letterSpacing: "-0.02em", textShadow: "0 2px 30px rgba(0,0,0,0.6)" }}
        >
          {words2.map((word, i) => {
            const idx = words1.length + i;
            return (
              <ScrollWord
                key={i}
                word={word}
                progress={wordProgress}
                range={[idx / total, (idx + 1) / total]}
                highlighted={HIGHLIGHTED.has(word.toLowerCase().replace(/[.,—]/g, ""))}
              />
            );
          })}
        </p>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function PricingSection({
  plans,
}: {
  plans: {
    name: string;
    price: string;
    period: string;
    desc: string;
    features: string[];
    cta: string;
    popular?: boolean;
  }[];
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="pricing"
      ref={ref}
      className="relative bg-[#050505] overflow-hidden"
      style={{ padding: "clamp(5rem,10vw,8rem) clamp(1.5rem,5vw,5rem)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(237,208,138,0.03), transparent 70%)" }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: EASE }}
        className="text-center mb-16"
      >
        <p className="text-[13px] font-medium font-sans uppercase tracking-[0.12em] mb-4" style={goldText}>
          // Transparent Pricing
        </p>
        <h2
          className="font-serif italic text-white m-0 mb-4"
          style={{ fontSize: "clamp(2.2rem,6vw,4rem)", lineHeight: 1.02, letterSpacing: "-0.02em", fontWeight: 700 }}
        >
          Simple, honest pricing
        </h2>
        <p className="text-[15px] text-white/48 font-sans font-light m-0">
          Start with a free 30-day trial. Full access, no credit card required.
        </p>
      </motion.div>

      {/* Cards */}
      <div
        className="grid gap-5 mx-auto"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", maxWidth: 960 }}
      >
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.1 + i * 0.12, ease: EASE }}
            className={`${plan.popular ? "landing-glass-strong md:scale-[1.03]" : "landing-glass"}`}
            style={{
              borderRadius: 22,
              padding: 28,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {plan.popular && (
              <div className="mb-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold tracking-wider font-sans"
                  style={{ background: GOLD, color: "#1a0f00" }}
                >
                  <Star className="h-3 w-3 fill-current" /> MOST POPULAR
                </span>
              </div>
            )}

            <h3 className="font-serif italic font-bold m-0 mb-1.5" style={{ fontSize: "1.6rem", ...goldText }}>{plan.name}</h3>
            <p className="text-[13px] text-white/45 font-sans font-light m-0 mb-5">{plan.desc}</p>

            <div className="mb-6 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="font-serif italic text-white font-bold" style={{ fontSize: "2.8rem", lineHeight: 1 }}>{plan.price}</span>
              <span className="text-[14px] text-white/35 font-sans ml-1">{plan.period}</span>
            </div>

            <ul className="flex-1 flex flex-col gap-2.5 m-0 p-0 list-none mb-7">
              {plan.features.map((f) => {
                const isComingSoon = /coming soon/i.test(f);
                const label = f.replace(/ — Coming Soon/i, "");
                return (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-[13px] font-sans font-light ${
                      isComingSoon ? "text-white/30" : "text-white/68"
                    }`}
                  >
                    <Check
                      className="h-4 w-4 shrink-0 mt-0.5 rounded-full p-0.5"
                      style={
                        isComingSoon
                          ? { color: "rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.05)" }
                          : { color: "#C7A155", background: "rgba(199,161,85,0.15)" }
                      }
                    />
                    {label}
                  </li>
                );
              })}
            </ul>

            <Link
              to="/auth/register"
              className="block text-center rounded-full py-3.5 text-[15px] font-semibold font-sans transition-opacity hover:opacity-85"
              style={
                plan.popular
                  ? { background: GOLD, color: "#1a0f00", boxShadow: "0 6px 24px rgba(199,161,85,0.30)" }
                  : { border: "1px solid rgba(237,208,138,0.25)", ...goldText }
              }
            >
              {plan.cta}
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 mt-10 text-[12px] sm:text-[13px] text-white/30 font-sans font-light"
      >
        {["No credit card required", "Cancel anytime", "30-day money-back guarantee"].map((item) => (
          <span key={item} className="whitespace-nowrap">✓ {item}</span>
        ))}
      </motion.div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 text-center sm:text-left bg-[#050505]"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "28px clamp(1.5rem,5vw,5rem)" }}
    >
      <BrandLogo size="sm" />
      <p className="order-last sm:order-none text-xs text-white/28 font-sans m-0">
        © {new Date().getFullYear()} SimchaSync. All rights reserved.
      </p>
      <div className="flex gap-5">
        {[
          ["Privacy", "/privacy"],
          ["Terms", "/terms"],
          ["Contact", "mailto:simchasync@gmail.com"],
        ].map(([label, href]) =>
          href.startsWith("mailto") ? (
            <a key={label} href={href} className="text-xs text-white/30 font-sans no-underline transition-colors hover:text-[#C7A155]">
              {label}
            </a>
          ) : (
            <Link key={label} to={href} className="text-xs text-white/30 font-sans no-underline transition-colors hover:text-[#C7A155]">
              {label}
            </Link>
          )
        )}
      </div>
    </footer>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Full-width garden band straddling the hero/mission seam so the join is invisible.
function SeamDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Scroll-driven parallax drift + gentle breathing scale
  const y = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1.02, 1.08]);

  // Fade all four edges of the black-backed image so its rectangle blends into
  // the sections seamlessly (top/bottom into the join, left/right off-screen safe).
  const edgeMask =
    "linear-gradient(to bottom, transparent 0%, #000 14%, #000 82%, transparent 100%)";

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative z-[2] h-0 pointer-events-none select-none overflow-visible"
    >
      {/* Backing black band — guarantees no hard line across the full width */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-screen"
        style={{
          height: "min(56vw, 620px)",
          background: "linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)",
        }}
      />

      {/* Garden band — full-bleed, centered on the seam */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-[max(100vw,1100px)]">
        <motion.img
          src="/seam-garden.png"
          alt=""
          style={{
            y,
            scale,
            willChange: "transform",
            WebkitMaskImage: edgeMask,
            maskImage: edgeMask,
          }}
          className="block w-full h-auto opacity-95"
        />
      </div>
    </div>
  );
}

export default function Index() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const l = t.landing;

  if (!loading && user) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen antialiased" style={{ background: "#050505" }}>
      <Hero subtitle={l.hero.subtitle} cta={l.hero.cta} ctaSecondary={l.hero.ctaSecondary} />
      <SeamDivider />
      <MissionSection />
      <FeaturesSection items={l.features.items} />
      <PricingSection plans={l.pricing.plans} />
      <Footer />
    </div>
  );
}
