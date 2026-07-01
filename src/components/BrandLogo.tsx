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
      {/* Deep navy background */}
      <rect width="100" height="100" rx="20" fill="#0D1F3C" />
      {/* Gold inner border ring — luxury detail */}
      <rect x="3.5" y="3.5" width="93" height="93" rx="17" fill="none" stroke="#C7A155" strokeWidth="1.5" opacity="0.45" />
      {/* Notehead — precise oval at 25° */}
      <ellipse cx="35" cy="69" rx="13" ry="8.5" transform="rotate(-25 35 69)" fill="#C7A155" />
      {/* Stem — right edge of notehead, perfectly vertical */}
      <rect x="47" y="26" width="4" height="44" rx="2" fill="#C7A155" />
      {/* Flag — single elegant S-curve */}
      <path d="M51 26 C78 31 80 55 57 64" stroke="#C7A155" strokeWidth="4.5" fill="none" strokeLinecap="round" />
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
