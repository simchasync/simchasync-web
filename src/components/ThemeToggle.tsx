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

  const nextMode: ThemeMode = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
  const Icon = MODE_ICON[mode];
  const modeLabel = t.app.theme[mode];
  const switchLabel = { light: t.app.theme.switchToLight, dark: t.app.theme.switchToDark, auto: t.app.theme.switchToAuto }[nextMode];

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={variant === "icon" ? "icon" : "sm"}
      className={cn(
        "shrink-0 text-foreground/80 hover:text-foreground",
        variant === "default" && "h-auto w-full justify-start gap-3 px-3 py-2 font-normal",
        className
      )}
      onClick={() => setMode(nextMode)}
      aria-label={switchLabel}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {variant === "default" && <span className="text-[13px]">{modeLabel}</span>}
      {variant === "icon" && <span className="sr-only">{switchLabel}</span>}
    </Button>
  );

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

  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {switchLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
