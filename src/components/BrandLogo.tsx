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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      aria-label="SimchaSync Logo"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="sc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3f72" />
          <stop offset="100%" stopColor="#0b1b36" />
        </linearGradient>
        <linearGradient id="sc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ead06e" />
          <stop offset="100%" stopColor="#9c7228" />
        </linearGradient>
        <linearGradient id="sc-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.13" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="100" height="100" rx="22" fill="url(#sc-bg)" />

      {/* Top-glass sheen */}
      <rect width="100" height="50" rx="22" fill="url(#sc-sheen)" />

      {/* Note head — tilted oval */}
      <ellipse
        cx="34"
        cy="70"
        rx="14.5"
        ry="9.5"
        transform="rotate(-20 34 70)"
        fill="url(#sc-gold)"
      />

      {/* Stem */}
      <rect x="46.5" y="20" width="4.5" height="52" rx="2.25" fill="url(#sc-gold)" />

      {/* Flag — elegant single sweep */}
      <path
        d="M51 20 C77 27 79 54 58 66"
        stroke="url(#sc-gold)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
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
        <div
          className={cn(
            "font-display leading-none tracking-wide",
            s.wordmark,
            wordmarkClassName,
          )}
        >
          {/* Every BrandLogo placement sits on a background that tracks the light/dark
              theme, so dark: variants always match the real rendered background. */}
          <span className="font-light text-[#112A4D] dark:text-white/90">Simcha</span>
          <span className="font-bold text-[#8A6A24] dark:text-[#C7A155]">Sync</span>
        </div>
      )}
    </div>
  );
}
