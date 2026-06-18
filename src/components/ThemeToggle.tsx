import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeMode, THEME_MODES, type ThemeMode } from "@/contexts/ThemeModeContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  variant?: "default" | "icon";
  className?: string;
}

const MODE_ICON = { light: Sun, dark: Moon, auto: SunMoon } as const;

export default function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const { t } = useLanguage();
  const { mode, setMode } = useThemeMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const switchLabel = (target: ThemeMode) =>
    ({ light: t.app.theme.switchToLight, dark: t.app.theme.switchToDark, auto: t.app.theme.switchToAuto }[target]);

  if (!mounted) {
    return (
      <div
        className={cn(
          variant === "default" && "h-9 w-full",
          variant === "icon" && "h-9 w-9",
          className
        )}
        aria-hidden
      />
    );
  }

  // Compact single-button cycle for collapsed sidebar / page headers.
  if (variant === "icon") {
    const nextMode = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
    const Icon = MODE_ICON[mode];
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0 text-foreground/80 hover:text-foreground", className)}
            onClick={() => setMode(nextMode)}
            aria-label={switchLabel(nextMode)}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="sr-only">{switchLabel(nextMode)}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {switchLabel(nextMode)}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Explicit 3-option selector: Light / Dark / Auto, all directly selectable.
  return (
    <div role="group" className={cn("flex w-full items-center gap-1", className)}>
      {THEME_MODES.map((m) => {
        const Icon = MODE_ICON[m];
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={active}
            aria-label={switchLabel(m)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                : "text-foreground/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t.app.theme[m]}</span>
          </button>
        );
      })}
    </div>
  );
}
