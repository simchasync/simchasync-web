import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/gradient-background";
import { APP_KILL_SWITCH_MESSAGE } from "@/lib/appKillSwitch";
import { ShieldAlert } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function Maintenance() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-navy text-secondary-foreground">
      <GradientBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,_hsl(38_80%_55%_/_0.12),_transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,_hsl(210_50%_40%_/_0.2),_transparent_55%)]" />

      <header className="relative z-10 border-b border-secondary/30 bg-navy/60 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-2">
          <BrandLogo size="md" />
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <div className="mx-auto w-full max-w-lg text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_40px_hsl(38_80%_55%_/_0.15)]">
            <ShieldAlert className="h-8 w-8" strokeWidth={1.75} aria-hidden />
          </div>

          <p className="mb-2 font-display text-5xl font-bold leading-none tracking-tight text-primary md:text-6xl">
            Temporarily offline
          </p>
          <h1 className="mb-4 font-display text-2xl font-semibold text-secondary-foreground md:text-3xl">
            We&apos;re making a quick update
          </h1>
          <p className="mb-10 text-balance text-secondary-foreground/70 md:text-lg">{APP_KILL_SWITCH_MESSAGE}</p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="bg-gradient-gold font-semibold text-primary-foreground shadow-gold hover:opacity-90"
            >
              <a href="mailto:support@simchasync.com">Contact support</a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}