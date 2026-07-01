import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, Navigate } from "react-router-dom";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import BlurText from "@/components/landing/BlurText";
import {
  Calendar, Users, FileText, CreditCard, Share2, Globe,
  Check, Star, ArrowRight, Sparkles, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import BackgroundVideo from "@/components/landing/BackgroundVideo";
import BrandLogo from "@/components/BrandLogo";

// ─── Animation helpers ────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: EASE },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

// ─── Feature metadata ─────────────────────────────────────────────────────────

const featureIcons = [Calendar, Users, FileText, CreditCard, Share2, Globe];

// ─── Reusable section wrapper ─────────────────────────────────────────────────

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      variants={fadeUp}
      className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70"
    >
      {children}
    </motion.p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Index() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const l = t.landing;

  if (!loading && user) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen text-foreground antialiased">
      {/* ── Dark Hero Section with Video ─────────────────────────────────────── */}
      <section className="relative bg-black min-h-screen flex flex-col overflow-hidden selection:bg-white selection:text-black">
        <BackgroundVideo />

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60 pointer-events-none z-[1]" />

        {/* ── Navigation ─────────────────────────────────────────────────────── */}
        <header className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between gap-4">
            {/* Logo - removed per user request */}

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {(["features", "pricing"] as const).map((id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="rounded-md px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {l.nav[id as keyof typeof l.nav]}
                </a>
              ))}
            </nav>

            {/* Auth actions */}
            <div className="flex items-center gap-2">
              <ThemeToggle variant="icon" className="text-white/70 hover:bg-white/10 hover:text-white" />
              <Link to="/auth/login" aria-label={l.nav.login}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden text-white/70 hover:text-primary hover:bg-primary/10 md:inline-flex"
                >
                  {l.nav.login}
                </Button>
              </Link>
              <Link to="/auth/register">
                <Button size="sm" className="gap-1.5 font-medium shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20">
                  {l.nav.signup}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* ── Hero Content ──────────────────────────────────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 md:py-24">
          {/* Premium gradient backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(255,255,255,0.06),transparent_50%)]"
          />

          <div className="container relative">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
              className="mx-auto max-w-3xl text-center"
            >
              {/* Premium Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary shadow-lg shadow-primary/5 backdrop-blur-md"
              >
                <Sparkles className="h-4 w-4 text-primary/80" />
                <span>Try free for 30 days — No credit card</span>
              </motion.div>

              {/* Premium Headline */}
              <h1 className="mb-8 font-display text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-white/90 md:text-7xl">
                {l.hero.title.split(" ").map((word, i, arr) => {
                  const delay = i * 0.12;
                  const isSimchas = word === "Simchas";
                  return (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, filter: "blur(10px)", y: -16 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      transition={{ delay, duration: 0.5, ease: EASE }}
                      className={`inline-block ${isSimchas ? "bg-gradient-to-r from-primary via-[#f5b342] to-[#d4932a] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(242,184,75,0.3)]" : ""}`}
                    >
                      {word}{i < arr.length - 1 ? "\u00A0" : ""}
                    </motion.span>
                  );
                })}
              </h1>

              {/* Premium Subheadline */}
              <BlurText
                text={l.hero.subtitle}
                delay={100}
                animateBy="words"
                direction="top"
                className="mb-12 text-base md:text-lg leading-relaxed text-white/60 font-light tracking-wide max-w-xl mx-auto"
              />

              {/* Premium CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
                className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:items-center"
              >
                <Link to="/auth/register">
                  <Button
                    size="lg"
                    className="gap-2 px-8 py-6 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 hover:translate-y-[-2px]"
                  >
                    {l.hero.cta}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="px-8 py-6 text-base font-semibold bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-white/20 hover:border-white/40 hover:text-white shadow-none"
                  >
                    {l.hero.ctaSecondary}
                  </Button>
                </a>
              </motion.div>

              {/* Premium Social proof */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
                className="mt-12 text-sm font-medium text-white/60"
              >
                ✓ Trusted by 2,000+ families across North America & Israel
              </motion.p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="relative py-28 md:py-40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="container relative">
          <AnimatedSection className="mb-16 max-w-2xl">
            <SectionLabel>Everything You Need</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mb-4 font-display text-4xl font-bold tracking-tight md:text-5xl"
            >
              {l.features.title}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg text-muted-foreground/90"
            >
              {l.features.subtitle}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {l.features.items.map((item, i) => {
              const Icon = featureIcons[i];
              return (
                <motion.div key={i} variants={fadeUp} custom={i}>
                  <Card className="group relative h-full overflow-hidden border-border/40 bg-gradient-to-br from-card to-card/50 transition-all duration-500 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardContent className="relative flex flex-col gap-4 p-7">
                      {/* Icon */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 group-hover:from-primary/30 group-hover:to-primary/10 transition-colors duration-300">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="mb-2 font-display text-lg font-semibold leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground/80">
                          {item.desc}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative py-28 md:py-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent pointer-events-none" />
        <div className="container relative">
          <AnimatedSection className="mb-16 max-w-2xl mx-auto text-center">
            <SectionLabel>Transparent Pricing</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mb-4 font-display text-4xl font-bold tracking-tight md:text-5xl"
            >
              {l.pricing.title}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg text-muted-foreground/90"
            >
              {l.pricing.subtitle}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
            {l.pricing.plans.map((plan, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative group">
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 z-20 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-primary/80 px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/40">
                      <Star className="h-4 w-4 fill-current" />
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <Card
                  className={[
                    "h-full relative overflow-hidden transition-all duration-500",
                    plan.popular
                      ? "border-primary/60 shadow-2xl shadow-primary/20 lg:scale-105 bg-gradient-to-br from-card to-primary/5"
                      : "border-border/40 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 bg-gradient-to-br from-card/80 to-card",
                  ].join(" ")}
                >
                  {plan.popular && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />}

                  <CardContent className="relative flex flex-col h-full p-8">
                    <div className="mb-8 pb-8 border-b border-border/40">
                      <h3 className="mb-2 font-display text-2xl font-bold">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-muted-foreground/80">{plan.desc}</p>
                    </div>

                    <div className="mb-8">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-5xl font-black text-foreground">
                          {plan.price}
                        </span>
                        <span className="text-base text-muted-foreground/70">
                          {plan.period}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-muted-foreground/60">30-day free trial included</p>
                    </div>

                    <ul className="mb-10 flex flex-col gap-3.5 flex-1">
                      {plan.features.map((f, j) => {
                        const isComingSoon =
                          f.includes("Coming Soon") || f.includes("בקרוב");
                        const label = isComingSoon
                          ? f.replace(/ — Coming Soon| — בקרוב/, "")
                          : f;
                        return (
                          <li
                            key={j}
                            className={[
                              "flex items-start gap-3 text-sm font-medium",
                              isComingSoon
                                ? "text-muted-foreground/40"
                                : "text-foreground/80",
                            ].join(" ")}
                          >
                            <Check
                              className={[
                                "mt-0.5 h-5 w-5 shrink-0 rounded-full p-0.5",
                                isComingSoon
                                  ? "bg-muted/20 text-muted-foreground/30"
                                  : "bg-primary/20 text-primary",
                              ].join(" ")}
                            />
                            <span className="flex flex-wrap items-center gap-2">
                              {label}
                              {isComingSoon && (
                                <Badge
                                  variant="outline"
                                  className="h-5 border-border/40 px-2 py-0 text-[10px] font-bold uppercase text-muted-foreground/60"
                                >
                                  Soon
                                </Badge>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    <Link to="/auth/register" className="block">
                      <Button
                        variant={plan.popular ? "default" : "outline"}
                        className={[
                          "w-full font-bold text-base py-6",
                          plan.popular
                            ? "shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 hover:-translate-y-0.5 transition-all duration-300"
                            : "border-border/40 hover:border-primary/50 hover:bg-accent/50",
                        ].join(" ")}
                      >
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-14 text-center"
          >
            <p className="text-sm font-medium text-muted-foreground/80">
              ✓ No credit card required · ✓ Cancel anytime · ✓ 30-day money-back guarantee
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-background py-10">
        <div className="container flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <Link to="/" className="transition-opacity hover:opacity-90">
            <BrandLogo size="sm" showIcon={false} wordmarkClassName="text-sm font-semibold" />
          </Link>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SimchaSync. All rights reserved.
          </p>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <a href="mailto:simchasync@gmail.com" className="transition-colors hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
