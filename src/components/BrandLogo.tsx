import { BRAND } from "@/lib/brand";
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
          <span style={{ color: BRAND.simcha }}>Simcha</span>
          <span style={{ color: BRAND.sync }}>Sync</span>
        </div>
      )}
    </div>
  );
}
