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
  xs: { icon: "h-4 w-4",  wordmark: "text-sm",  gap: "gap-1.5" },
  sm: { icon: "h-5 w-5",  wordmark: "text-xl",  gap: "gap-2"   },
  md: { icon: "h-7 w-7",  wordmark: "text-2xl", gap: "gap-2.5" },
  lg: { icon: "h-9 w-9",  wordmark: "text-3xl", gap: "gap-3"   },
} as const;

// Gold gradient stops — shared across icon and text
const GOLD_START  = "#EDD08A";
const GOLD_MID    = "#C7A155";
const GOLD_END    = "#9A7830";
const GOLD_STYLE  = `linear-gradient(135deg, ${GOLD_START} 0%, ${GOLD_MID} 50%, ${GOLD_END} 100%)`;

function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      aria-label="SimchaSync Logo"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="scIconGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={GOLD_START} />
          <stop offset="50%"  stopColor={GOLD_MID}   />
          <stop offset="100%" stopColor={GOLD_END}    />
        </linearGradient>
      </defs>
      {/* music.svg path — double music note (♫) */}
      <path
        fill="url(#scIconGold)"
        d="M15 0h1v11.5c0 1.381-1.567 2.5-3.5 2.5S9 12.881 9 11.5S10.567 9 12.5 9c.979 0 1.865.287 2.5.751V4L7 5.778V13.5C7 14.881 5.433 16 3.5 16S0 14.881 0 13.5S1.567 11 3.5 11c.979 0 1.865.287 2.5.751V2l9-2z"
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
    <div className={cn("inline-flex items-center", showIcon && showWordmark && s.gap, className)}>
      {showIcon && <BrandIcon className={cn(s.icon, iconClassName)} />}
      {showWordmark && (
        <span
          className={cn("font-display font-bold leading-none tracking-wide", s.wordmark, wordmarkClassName)}
          style={{
            background:              GOLD_STYLE,
            WebkitBackgroundClip:    "text",
            WebkitTextFillColor:     "transparent",
            backgroundClip:          "text",
          }}
        >
          SimchaSync
        </span>
      )}
    </div>
  );
}
