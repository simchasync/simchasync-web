import { Navigate, Link } from "react-router-dom";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import BrandLogo from "@/components/BrandLogo";
import BackgroundVideo from "@/components/landing/BackgroundVideo";
import {
  Calendar,
  CreditCard,
  Users,
  Share2,
  Check,
  Star,
  ArrowRight,
  Instagram,
  Linkedin,
  Twitter,
  ChevronRight,
} from "lucide-react";

// ── Animation helper ──────────────────────────────────────────────────────────

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 } as Record<string, unknown>,
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, delay, ease: "easeOut" },
});

// ── Scroll-driven per-word opacity reveal ─────────────────────────────────────
// Each word is its own component so useTransform is called at component level.

function ScrollWord({
  word,
  index,
  total,
  progress,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(
    progress,
    [index / total, Math.min((index + 1.5) / total, 1)],
    [0.12, 1]
  );
  return <motion.span style={{ opacity }}>{word} </motion.span>;
}

// ── CTA section background video (Mux HLS) ────────────────────────────────────

const MUX_URL =
  "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8";

function CTAVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let hls: { destroy: () => void } | undefined;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_URL;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const instance = new Hls({ debug: false });
        hls = instance;
        instance.loadSource(MUX_URL);
        instance.attachMedia(video);
      });
    }

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, []);

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
    />
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-28 py-4">
      {/* Logo */}
      <Link to="/" className="shrink-0 transition-opacity hover:opacity-80">
        <BrandLogo size="sm" />
      </Link>

      {/* Center nav */}
      <nav className="hidden md:flex items-center gap-1 text-sm">
        {(["Features", "Pricing"] as const).map((label, i) => (
          <span key={label} className="flex items-center gap-1">
            {i > 0 && <span className="text-white/20 select-none">•</span>}
            <a
              href={`#${label.toLowerCase()}`}
              className="px-3 py-1.5 text-white/55 hover:text-white transition-colors font-sans"
            >
              {label}
            </a>
          </span>
        ))}
        <span className="text-white/20 select-none mx-1">•</span>
        <Link
          to="/auth/login"
          className="px-3 py-1.5 text-white/55 hover:text-white transition-colors font-sans"
        >
          Log In
        </Link>
      </nav>

      {/* Right: social + CTA */}
      <div className="flex items-center gap-2">
        {[Instagram, Linkedin, Twitter].map((Icon, i) => (
          <button
            key={i}
            className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <Link
          to="/auth/register"
          className="hidden md:flex items-center gap-1.5 ml-2 rounded-full bg-white text-black px-5 py-2 text-sm font-semibold font-sans transition-opacity hover:opacity-85"
        >
          Start Free Trial <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ subtitle, cta }: { subtitle: string; cta: string }) {
  return (
    <section className="relative min-h-screen bg-black flex flex-col overflow-hidden">
      <BackgroundVideo />

      {/* Bottom fade to black */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black to-transparent z-[2] pointer-events-none" />

      <Navbar />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-28 md:pt-32 px-6 text-center">
        {/* Social proof */}
        <motion.div
          {...fadeUp(0.1)}
          className="flex items-center gap-3 mb-10"
        >
          <div className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-black bg-white/10 flex items-center justify-center text-[9px] text-white/70 font-sans font-medium"
              >
                {["J", "M", "D"][i]}
              </div>
            ))}
          </div>
          <span className="text-sm text-white/55 font-sans">
            2,000+ families across North America & Israel
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fadeUp(0.15)}
          className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-[-2px] text-white max-w-4xl mx-auto leading-[1.0] mb-6"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Manage Your{" "}
          <em className="font-serif not-italic italic font-normal">Simchas</em>
          {" "}Like a Pro
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          {...fadeUp(0.2)}
          className="text-lg text-white/70 max-w-xl mx-auto mb-10 font-sans leading-relaxed"
        >
          {subtitle}
        </motion.p>

        {/* CTA form row */}
        <motion.div {...fadeUp(0.25)}>
          <div className="liquid-glass rounded-full p-2 flex items-center gap-2 max-w-lg w-full">
            <input
              type="email"
              placeholder="Enter your email address"
              className="flex-1 bg-transparent border-none outline-none pl-4 text-sm text-white placeholder:text-white/35 font-sans min-w-0"
            />
            <Link
              to="/auth/register"
              className="shrink-0 bg-white text-black rounded-full px-8 py-3 text-sm font-semibold font-sans tracking-wide hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {cta}
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Bottom trust strip */}
      <motion.p
        {...fadeUp(0.35)}
        className="relative z-10 text-center pb-8 text-[12px] text-white/30 font-sans"
      >
        ✓ 30-day free trial &nbsp;·&nbsp; ✓ No credit card required &nbsp;·&nbsp; ✓ Cancel anytime
      </motion.p>
    </section>
  );
}

// ── Problem Section ───────────────────────────────────────────────────────────

function ProblemSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const cards = [
    {
      icon: Calendar,
      title: "Smart Bookings",
      desc: "Families expect to book online instantly. Manual calls, paper contracts, and missed inquiries are costing you gigs.",
    },
    {
      icon: CreditCard,
      title: "Digital Payments",
      desc: "Clients want to pay by card. Chasing checks and manually tracking deposits wastes hours you don't have.",
    },
    {
      icon: Users,
      title: "Client CRM",
      desc: "Without a system, client history disappears between events. Every booking starts over from scratch.",
    },
  ];

  return (
    <section
      ref={ref}
      className="relative bg-black text-center pt-52 md:pt-64 pb-6 md:pb-9 px-6"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-[-2px] text-white max-w-4xl mx-auto leading-[1.0] mb-6"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        Event management has{" "}
        <em className="font-serif not-italic italic font-normal">changed.</em>{" "}
        Have you?
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        className="text-white/55 text-lg max-w-2xl mx-auto mb-24 font-sans"
      >
        Your clients expect modern tools — seamless booking, instant invoices,
        and real-time updates.
      </motion.p>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-12 md:gap-8 mb-20 max-w-5xl mx-auto">
        {cards.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: "easeOut" }}
            className="flex flex-col items-center gap-4"
          >
            <div className="liquid-glass w-[200px] h-[200px] rounded-2xl flex items-center justify-center mx-auto">
              <Icon className="h-16 w-16 text-white/70" strokeWidth={1} />
            </div>
            <p className="font-semibold text-base text-white font-sans">{title}</p>
            <p className="text-white/50 text-sm font-sans leading-relaxed max-w-[220px] mx-auto">{desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="text-white/35 text-sm font-sans"
      >
        If you're not using modern tools, your competitors are.
      </motion.p>
    </section>
  );
}

// ── Mission Section (scroll-driven word reveal) ───────────────────────────────

const MISSION_P1 =
  "We're building the platform that Jewish musicians singers and bands deserve — where bookings flow effortlessly payments happen instantly and every client relationship grows stronger with every simcha.";

const MISSION_P2 =
  "A platform where your music business runs itself — with less admin less chasing and more time on stage doing what you love.";

function MissionSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "end 0.2"],
  });

  const p1Words = MISSION_P1.split(" ");
  const p2Words = MISSION_P2.split(" ");

  return (
    <section
      ref={ref}
      className="relative bg-black pt-0 pb-32 md:pb-44 px-6"
    >
      {/* Decorative video orb */}
      <div className="flex justify-center mb-20">
        <div
          className="liquid-glass rounded-2xl overflow-hidden"
          style={{ width: "min(800px, 100%)", aspectRatio: "1/1" }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-80"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <p
          className="text-2xl md:text-4xl lg:text-5xl font-medium tracking-[-1px] leading-snug"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {p1Words.map((word, i) => (
            <ScrollWord
              key={i}
              word={word}
              index={i}
              total={p1Words.length}
              progress={scrollYProgress}
            />
          ))}
        </p>

        <p
          className="text-xl md:text-2xl lg:text-3xl font-medium mt-10 leading-snug"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {p2Words.map((word, i) => (
            <ScrollWord
              key={i}
              word={word}
              index={p1Words.length + i}
              total={p1Words.length + p2Words.length}
              progress={scrollYProgress}
            />
          ))}
        </p>
      </div>
    </section>
  );
}

// ── Solution / Features Section ───────────────────────────────────────────────

const SOLUTION_FEATURES = [
  {
    icon: Calendar,
    title: "Smart Bookings",
    desc: "Hebrew dates, venue details, contracts, voice memos — every event organized in one place.",
  },
  {
    icon: CreditCard,
    title: "Invoices & Payments",
    desc: "Generate invoices, collect payments via Stripe, and track every shekel automatically.",
  },
  {
    icon: Users,
    title: "Client CRM",
    desc: "Full client history, preferences, and balances — never start a booking from scratch again.",
  },
  {
    icon: Share2,
    title: "Social Media",
    desc: "Schedule posts and manage your presence across platforms from a single hub.",
  },
];

function SolutionSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="features"
      ref={ref}
      className="relative bg-black py-32 md:py-44 px-6 md:px-28"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      <motion.p
        {...fadeUp(0)}
        className="text-xs tracking-[3px] uppercase text-white/45 font-sans mb-6"
      >
        SOLUTION
      </motion.p>

      <motion.h2
        {...fadeUp(0.1)}
        className="text-4xl md:text-6xl font-medium tracking-[-2px] text-white mb-16 leading-[1.05] max-w-2xl"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        The platform for{" "}
        <em className="font-serif not-italic italic font-normal">meaningful</em>{" "}
        work
      </motion.h2>

      {/* Feature video */}
      <motion.div
        {...fadeUp(0.15)}
        className="rounded-2xl overflow-hidden mb-16"
        style={{ aspectRatio: "3/1" }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
        />
      </motion.div>

      {/* 4-column grid */}
      <div className="grid md:grid-cols-4 gap-8">
        {SOLUTION_FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <motion.div key={title} {...fadeUp(0.1 + i * 0.08)}>
            <div className="mb-4">
              <Icon className="h-5 w-5 text-white/50" strokeWidth={1.5} />
            </div>
            <p className="font-semibold text-base text-white font-sans mb-2">{title}</p>
            <p className="text-white/45 text-sm font-sans leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Pricing Section ───────────────────────────────────────────────────────────

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
      className="relative bg-black py-32 md:py-44 px-6 md:px-28"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-xs tracking-[3px] uppercase text-white/45 font-sans mb-6"
      >
        PRICING
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-4xl md:text-6xl font-medium tracking-[-2px] text-white mb-4 leading-[1.05]"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        Simple,{" "}
        <em className="font-serif not-italic italic font-normal">honest</em>{" "}
        pricing
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="text-white/45 text-lg font-sans mb-16 max-w-md"
      >
        Start with a free 30-day trial. Full access, no credit card required.
      </motion.p>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.1 }}
            className="liquid-glass rounded-2xl p-8 flex flex-col"
            style={{
              transform: plan.popular ? "scale(1.02)" : undefined,
              background: plan.popular ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)",
            }}
          >
            {plan.popular && (
              <div className="mb-5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/80 font-sans tracking-wide">
                  <Star className="h-3 w-3 fill-current" /> MOST POPULAR
                </span>
              </div>
            )}

            <h3
              className="text-2xl font-medium text-white mb-1"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {plan.name}
            </h3>
            <p className="text-white/45 text-sm font-sans mb-6">{plan.desc}</p>

            <div className="mb-6 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span
                className="text-5xl font-bold text-white"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-2px" }}
              >
                {plan.price}
              </span>
              <span className="text-white/35 text-sm font-sans ml-1">{plan.period}</span>
            </div>

            <ul className="flex-1 flex flex-col gap-3 mb-8">
              {plan.features.map((f) => {
                const isComingSoon = /coming soon/i.test(f);
                const label = f.replace(/ — Coming Soon/i, "");
                return (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm font-sans font-light ${
                      isComingSoon ? "text-white/25" : "text-white/65"
                    }`}
                  >
                    <Check
                      className="h-4 w-4 shrink-0 mt-0.5"
                      style={isComingSoon ? { color: "rgba(255,255,255,0.2)" } : { color: "rgba(255,255,255,0.7)" }}
                    />
                    {label}
                  </li>
                );
              })}
            </ul>

            <Link
              to="/auth/register"
              className="block text-center rounded-lg py-3.5 text-sm font-semibold font-sans transition-opacity hover:opacity-85"
              style={
                plan.popular
                  ? { background: "#fff", color: "#000" }
                  : { border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)" }
              }
            >
              {plan.cta}
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.6 }}
        className="mt-10 text-center text-[13px] text-white/25 font-sans"
      >
        ✓ No credit card required &nbsp;·&nbsp; ✓ Cancel anytime &nbsp;·&nbsp; ✓ 30-day money-back guarantee
      </motion.p>
    </section>
  );
}

// ── CTA Section ───────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative bg-black py-32 md:py-44 px-6 overflow-hidden text-center"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      <CTAVideo />
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: "rgba(0,0,0,0.52)" }}
      />

      <div className="relative z-10">
        {/* Concentric circles icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center mb-8"
        >
          <div className="w-12 h-12 rounded-full border-2 border-white/40 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border border-white/40" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-medium tracking-[-2px] text-white mb-6 leading-[1.0]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Start Your{" "}
          <em className="font-serif not-italic italic font-normal">Journey</em>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-white/55 text-lg font-sans mb-10 max-w-md mx-auto"
        >
          Join 2,000+ families across North America and Israel who trust
          SimchaSync to run their business.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center justify-center gap-4 flex-wrap"
        >
          <Link
            to="/auth/register"
            className="flex items-center gap-2 rounded-lg bg-white text-black px-8 py-3.5 text-sm font-semibold font-sans hover:opacity-90 transition-opacity"
          >
            Subscribe Now <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/auth/register"
            className="liquid-glass flex items-center gap-2 rounded-lg px-8 py-3.5 text-sm font-semibold text-white/80 font-sans hover:text-white transition-colors"
          >
            Start Free Trial
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-black py-12 px-8 md:px-28 flex flex-wrap items-center justify-between gap-4"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-white/40 text-sm font-sans">
        © {new Date().getFullYear()} SimchaSync. All rights reserved.
      </p>
      <div className="flex gap-6">
        {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "mailto:simchasync@gmail.com"]].map(
          ([label, href]) =>
            href.startsWith("mailto") ? (
              <a key={label} href={href} className="text-white/40 text-sm font-sans hover:text-white transition-colors no-underline">
                {label}
              </a>
            ) : (
              <Link key={label} to={href} className="text-white/40 text-sm font-sans hover:text-white transition-colors no-underline">
                {label}
              </Link>
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
    <div className="min-h-screen antialiased" style={{ background: "#000", color: "#fff" }}>
      <Hero subtitle={l.hero.subtitle} cta={l.hero.cta} />
      <ProblemSection />
      <MissionSection />
      <SolutionSection />
      <PricingSection plans={l.pricing.plans} />
      <CTASection />
      <Footer />
    </div>
  );
}
