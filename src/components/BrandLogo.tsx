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
      {/* Gold inner border ring */}
      <rect x="3.5" y="3.5" width="93" height="93" rx="17" fill="none" stroke="#C7A155" strokeWidth="1.5" opacity="0.45" />
      {/* Music note — source path from 24×24 viewBox, scaled & centred */}
      <g transform="translate(18, 12) scale(2.75)">
        <path
          fill="#C7A155"
          d="M15.915 6.702a6.249 6.249 0 0 0-.77-.45h.01A3.612 3.612 0 0 1 13 3.026V2.5h-1v13.96a3.965 3.965 0 0 0-2.508-.417C7.562 16.3 5.996 17.61 6 18.963s1.578 2.249 3.508 1.993c1.867-.246 3.38-1.481 3.474-2.788H13V6.996a5.411 5.411 0 0 1 2.159.703 6.036 6.036 0 0 1 2.176 2.15 6.365 6.365 0 0 1 .25 5.94l.481.211a6.982 6.982 0 0 0-2.15-9.298z"
        />
      </g>
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
