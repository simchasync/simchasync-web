import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, LayoutDashboard, Music, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

export default function NotFound() {
  const location = useLocation();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const p = t.pageNotFound;

  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("404:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-navy text-secondary-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,_hsl(38_80%_55%_/_0.12),_transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,_hsl(210_50%_40%_/_0.2),_transparent_55%)]" />

      <header className="relative z-10 border-b border-secondary/30 bg-navy/60 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <Music className="h-7 w-7 text-primary" />
            <span className="font-display text-xl font-bold text-primary">SimchaSync</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto w-full max-w-lg text-center"
        >
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_40px_hsl(38_80%_55%_/_0.15)]">
            <SearchX className="h-8 w-8" strokeWidth={1.75} aria-hidden />
          </div>

          <p className="mb-2 font-display text-7xl font-bold leading-none tracking-tight text-primary md:text-8xl">
            {p.code}
          </p>
          <h1 className="mb-4 font-display text-2xl font-semibold text-secondary-foreground md:text-3xl">
            {p.title}
          </h1>
          <p className="mb-10 text-balance text-secondary-foreground/70 md:text-lg">{p.description}</p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="bg-gradient-gold font-semibold text-primary-foreground shadow-gold hover:opacity-90"
            >
              <Link to="/" className="inline-flex items-center gap-2">
                <Home className="h-5 w-5 shrink-0" />
                {p.goHome}
              </Link>
            </Button>
            {!loading && user && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-secondary-foreground/25 bg-navy/40 text-secondary-foreground hover:border-primary hover:bg-navy/60 hover:text-primary"
              >
                <Link to="/app" className="inline-flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 shrink-0" />
                  {p.goToApp}
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
