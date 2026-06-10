import type { ElementType } from "react";

interface SectionLabelProps {
  icon?: ElementType;
  title: string;
}

export default function SectionLabel({ icon: Icon, title }: SectionLabelProps) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {title}
    </p>
  );
}
