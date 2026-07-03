import { Card, CardContent, Chip } from "@mui/material";

export const ACCENT_STYLES: Record<string, { border: string; iconBg: string; iconText: string }> = {
  emerald: { border: "border-t-emerald-400/40", iconBg: "bg-emerald-500/10", iconText: "text-emerald-600 dark:text-emerald-400" },
  amber: { border: "border-t-amber-400/40", iconBg: "bg-amber-500/10", iconText: "text-amber-600 dark:text-amber-400" },
  cyan: { border: "border-t-cyan-400/40", iconBg: "bg-cyan-500/10", iconText: "text-cyan-600 dark:text-cyan-400" },
  violet: { border: "border-t-violet-400/40", iconBg: "bg-violet-500/10", iconText: "text-violet-600 dark:text-violet-400" },
  rose: { border: "border-t-rose-400/40", iconBg: "bg-rose-500/10", iconText: "text-rose-600 dark:text-rose-400" },
};

export function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  const a = ACCENT_STYLES[accent] ?? ACCENT_STYLES.emerald;
  return (
    <Card variant="outlined" className={`animate-card-in card-interactive overflow-hidden border-t-[3px] ${a.border}`}>
      <CardContent className="p-3 md:p-5">
        <div className="flex items-start justify-between gap-1 mb-2 md:mb-3">
          <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight line-clamp-2">{label}</p>
          <div className={`flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl shrink-0 ${a.iconBg}`}>
            <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${a.iconText}`} />
          </div>
        </div>
        <p className="text-lg md:text-2xl font-bold tracking-tight tabular-nums truncate">{value}</p>
        {sub && <p className="text-[10px] md:text-xs text-muted-foreground/70 mt-0.5 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-1 w-6 rounded-full bg-gradient-to-r from-primary to-primary/40" />
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
      {count !== undefined && (
        <Chip
          label={count}
          size="small"
          className="font-normal bg-secondary text-secondary-foreground"
          sx={{ height: 16, fontSize: "10px", "& .MuiChip-label": { px: "6px" } }}
        />
      )}
    </div>
  );
}
