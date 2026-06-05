import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, Navigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Calendar, Users, FileText, CreditCard, Share2, Globe,
  Check, Star, ArrowRight, Music, Sparkles, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

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
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
              <Music className="h-4 w-4 text-primary" />
            </div>
            <span className="font-display text-[17px] font-semibold tracking-tight">
              SimchaSync
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {(["features", "pricing"] as const).map((id) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {l.nav[id as keyof typeof l.nav]}
              </a>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" className="hover:bg-accent" />
            <Link to="/auth/login">
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
              >
                {l.nav.login}
              </Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="gap-1.5 font-medium shadow-sm">
                {l.nav.signup}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/60 py-24 md:py-36">
        {/* Subtle radial accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.12),transparent)]"
        />

        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mx-auto max-w-2xl text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-accent/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              30-day free trial · No credit card required
            </motion.div>

            {/* Headline */}
            <h1 className="mb-5 font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-6xl">
              {l.hero.title.split("Simchas")[0]}
              <span className="text-primary">Simchas</span>
              {l.hero.title.split("Simchas")[1]}
            </h1>

            {/* Subheadline */}
            <p className="mb-10 text-base leading-relaxed text-muted-foreground md:text-lg">
              {l.hero.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/auth/register">
                <Button
                  size="lg"
                  className="h-11 gap-2 px-8 font-semibold shadow-md transition-all hover:shadow-lg hover:translate-y-[-1px]"
                >
                  {l.hero.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-8 font-medium"
                >
                  {l.hero.ctaSecondary}
                </Button>
              </a>
            </div>

            {/* Social proof */}
            <p className="mt-8 text-xs text-muted-foreground/60">
              Trusted by 2,000+ families across North America & Israel
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32">
        <div className="container">
          <AnimatedSection className="mb-14 max-w-xl">
            <SectionLabel>Features</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mb-3 font-display text-3xl font-bold tracking-tight md:text-4xl"
            >
              {l.features.title}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground"
            >
              {l.features.subtitle}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {l.features.items.map((item, i) => {
              const Icon = featureIcons[i];
              return (
                <motion.div key={i} variants={fadeUp} custom={i}>
                  <Card className="group h-full border-border/60 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-6">
                      {/* Icon */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-accent transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="mb-1 font-display text-[15px] font-semibold leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
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
      <section id="pricing" className="border-t border-border/60 bg-accent/30 py-24 md:py-32">
        <div className="container">
          <AnimatedSection className="mb-14 max-w-xl">
            <SectionLabel>Pricing</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mb-3 font-display text-3xl font-bold tracking-tight md:text-4xl"
            >
              {l.pricing.title}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground"
            >
              {l.pricing.subtitle}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {l.pricing.plans.map((plan, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative">
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
                      <Star className="h-3 w-3" />
                      Most popular
                    </span>
                  </div>
                )}

                <Card
                  className={[
                    "h-full border-border/60 bg-card transition-all duration-300",
                    plan.popular
                      ? "border-primary/50 shadow-md ring-1 ring-primary/20"
                      : "hover:border-border",
                  ].join(" ")}
                >
                  <CardContent className="flex flex-col p-7">
                    {/* Plan header */}
                    <div className="mb-6 border-b border-border/60 pb-6">
                      <h3 className="mb-0.5 font-display text-lg font-bold">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{plan.desc}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-4xl font-bold text-foreground">
                          {plan.price}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {plan.period}
                        </span>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="mb-8 flex flex-col gap-2.5">
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
                              "flex items-start gap-2.5 text-sm",
                              isComingSoon
                                ? "text-muted-foreground/50"
                                : "text-foreground/80",
                            ].join(" ")}
                          >
                            <Check
                              className={[
                                "mt-0.5 h-4 w-4 shrink-0",
                                isComingSoon
                                  ? "text-muted-foreground/30"
                                  : "text-primary",
                              ].join(" ")}
                            />
                            <span className="flex flex-wrap items-center gap-1.5">
                              {label}
                              {isComingSoon && (
                                <Badge
                                  variant="outline"
                                  className="h-4 border-border/40 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                                >
                                  Soon
                                </Badge>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* CTA — pushed to bottom */}
                    <div className="mt-auto">
                      <Link to="/auth/register">
                        <Button
                          variant={plan.popular ? "default" : "outline"}
                          className={[
                            "w-full font-semibold",
                            plan.popular
                              ? "shadow-sm hover:shadow-md hover:translate-y-[-1px] transition-all"
                              : "",
                          ].join(" ")}
                        >
                          {plan.cta}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>

          {/* Reassurance line */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 text-center text-sm text-muted-foreground"
          >
            All plans include a 30-day free trial. Cancel any time, no questions asked.
          </motion.p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-background py-10">
        <div className="container flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Music className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold">SimchaSync</span>
          </Link>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SimchaSync. All rights reserved.
          </p>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
            <a href="#" className="transition-colors hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}