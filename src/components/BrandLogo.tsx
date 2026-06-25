import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
  showIcon?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
};

const sizeClasses = {
  xs: { icon: "h-7 w-7", wordmark: "text-sm", gap: "gap-1.5" },
  sm: { icon: "h-10 w-10", wordmark: "text-lg", gap: "gap-2.5" },
  md: { icon: "h-14 w-14", wordmark: "text-2xl", gap: "gap-3" },
  lg: { icon: "h-20 w-20", wordmark: "text-3xl", gap: "gap-4" },
} as const;

function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src="/simchasync-icon.png"
      alt="SimchaSync Logo"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

export default function BrandLogo({
  className,
  iconClassName,
  wordmarkClassName,
  showWordmark = true,
  showIcon = true,
  size = "sm",
}: BrandLogoProps) {
  const s = sizeClasses[size];

  return (
    <div className={cn("inline-flex items-center", showIcon && s.gap, className)}>
      {showIcon && <BrandIcon className={cn(s.icon, iconClassName)} />}
      {showWordmark && (
        <div className={cn("font-display font-semibold leading-none tracking-tight", s.wordmark, wordmarkClassName)}>
          {/* Every BrandLogo placement sits on a background that tracks the light/dark
              theme (bg-card, bg-gradient-navy, bg-gradient-sidebar all flip with it), so
              dark: variants here always match the real rendered background. Both brand
              colors fail WCAG AA contrast against the *other* mode's background if not
              swapped — navy is unreadable on dark surfaces, gold fails on light ones. */}
          <span className="text-[#112A4D] dark:text-white">Simcha</span>
          <span className="text-[#8A6A24] dark:text-[#C7A155]">Sync</span>
        </div>
      )}
    </div>
  );
}
