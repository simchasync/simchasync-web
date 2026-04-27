import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar, Users, FileText, CreditCard, Share2, Globe,
  Check, Star, ArrowRight, Music, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

const featureIcons = [Calendar, Users, FileText, CreditCard, Share2, Globe];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Index() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const l = t.landing;

  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-navy text-secondary-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-secondary/30 bg-navy/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Music className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold text-primary">SimchaSync</span>
          </Link>
          <div className="hidden items-center gap-4 md:flex">
            <ThemeToggle variant="icon" className="hover:bg-secondary/50" />
            <a href="#features" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">{l.nav.features}</a>
            <a href="#pricing" className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors">{l.nav.pricing}</a>
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-secondary-foreground/70 hover:text-primary">{l.nav.login}</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="bg-gradient-gold shadow-gold hover:opacity-90 text-primary-foreground font-semibold">{l.nav.signup}</Button>
            </Link>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle variant="icon" className="hover:bg-secondary/50" />
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-secondary-foreground/70">{l.nav.login}</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="bg-gradient-gold text-primary-foreground font-semibold">{l.nav.signup}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(38_80%_55%_/_0.08),_transparent_60%)]" />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm text-primary shadow-mint-soft">
              <Sparkles className="h-4 w-4 text-mint" />
              30-Day Free Trial — No Credit Card Required
            </div>
            <h1 className="mb-6 font-display text-4xl font-bold leading-tight tracking-tight text-secondary-foreground md:text-6xl lg:text-7xl">
              {l.hero.title.split("Simchas")[0]}
              <span className="text-gradient-gold">Simchas</span>
              {l.hero.title.split("Simchas")[1]}
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-secondary-foreground/60 md:text-xl">
              {l.hero.subtitle}
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/auth/register">
                <Button size="lg" className="bg-gradient-gold shadow-gold text-primary-foreground font-semibold text-lg px-8 py-6 hover:opacity-90">
                  {l.hero.cta}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="border-foreground/30 text-foreground hover:border-primary hover:text-primary text-lg px-8 py-6">
                  {l.hero.ctaSecondary}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="mb-16 text-center"
          >
            <motion.h2 variants={fadeUp} custom={0} className="mb-4 font-display text-3xl font-bold text-secondary-foreground md:text-5xl">
              {l.features.title}
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-secondary-foreground/50">
              {l.features.subtitle}
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {l.features.items.map((item, i) => {
              const Icon = featureIcons[i];
              return (
                <motion.div key={i} variants={fadeUp} custom={i + 2}>
                  <Card className="group border-secondary/20 bg-secondary/40 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-gold/10 hover:shadow-lg h-full">
                    <CardContent className="p-6">
                      <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="mb-2 font-display text-xl font-semibold text-secondary-foreground">{item.title}</h3>
                      <p className="text-secondary-foreground/50">{item.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-secondary-foreground md:text-5xl">{l.pricing.title}</h2>
            <p className="text-lg text-secondary-foreground/50">{l.pricing.subtitle}</p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
            {l.pricing.plans.map((plan, i) => (
              <Card
                key={i}
                className={`relative border-secondary/20 bg-secondary/40 backdrop-blur-sm transition-all ${
                  plan.popular ? "border-primary/50 shadow-gold" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-gold px-4 py-1 text-xs font-bold text-primary-foreground">
                    <Star className="mr-1 inline h-3 w-3" /> MOST POPULAR
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="mb-1 font-display text-2xl font-bold text-secondary-foreground">{plan.name}</h3>
                  <p className="mb-6 text-sm text-secondary-foreground/50">{plan.desc}</p>
                  <div className="mb-6">
                    <span className="font-display text-5xl font-bold text-primary">{plan.price}</span>
                    <span className="text-secondary-foreground/50">{plan.period}</span>
                  </div>
                  <ul className="mb-8 space-y-3">
                    {plan.features.map((f, j) => {
                      const isComingSoon = f.includes("Coming Soon") || f.includes("בקרוב");
                      const label = isComingSoon ? f.replace(/ — Coming Soon| — בקרוב/, "") : f;
                      return (
                        <li key={j} className={`flex items-start gap-2 text-sm ${isComingSoon ? "text-secondary-foreground/40" : "text-secondary-foreground/70"}`}>
                          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isComingSoon ? "text-secondary-foreground/30" : "text-primary"}`} />
                          <span className="flex items-center gap-1.5 flex-wrap">
                            {label}
                            {isComingSoon && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal bg-secondary/60 text-secondary-foreground/50 border-0">
                                Coming Soon
                              </Badge>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Link to="/auth/register">
                    <Button
                      className={`w-full font-semibold ${
                        plan.popular
                          ? "bg-gradient-gold shadow-gold text-primary-foreground hover:opacity-90"
                          : "border-primary/30 text-primary hover:bg-primary/10"
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-secondary/20 py-12">
        <div className="container flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold text-primary">SimchaSync</span>
          </div>
          <p className="text-sm text-secondary-foreground/40">
            © {new Date().getFullYear()} SimchaSync. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
