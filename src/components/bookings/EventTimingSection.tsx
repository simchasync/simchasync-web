import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { formatTimeUS } from "@/lib/formatTime";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimingFields {
  chuppah_time: string;
  meal_time: string;
  first_dance_time: string;
  second_dance_time: string;
  mitzvah_tanz_time: string;
  event_start_time: string;
}

interface EventTimingSectionProps {
  eventType: string;
  timing: TimingFields;
  onChange: (timing: TimingFields) => void;
  canWrite: boolean;
}

type TimingLabelKey = "chuppah" | "meal" | "firstDance" | "secondDance" | "mitzvahTanz" | "eventStart";

const WEDDING_FIELDS: { key: keyof TimingFields; labelKey: TimingLabelKey }[] = [
  { key: "chuppah_time", labelKey: "chuppah" },
  { key: "meal_time", labelKey: "meal" },
  { key: "first_dance_time", labelKey: "firstDance" },
  { key: "second_dance_time", labelKey: "secondDance" },
  { key: "mitzvah_tanz_time", labelKey: "mitzvahTanz" },
];

export default function EventTimingSection({ eventType, timing, onChange, canWrite }: EventTimingSectionProps) {
  const { t } = useLanguage();
  const labels = t.app.bookings.timing;
  const isWedding = eventType === "wedding";
  const fields = isWedding
    ? WEDDING_FIELDS
    : [{ key: "event_start_time" as keyof TimingFields, labelKey: "eventStart" as const }];

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 font-semibold text-sm">
        <Clock className="h-4 w-4 text-primary" />
        {labels.title}
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-xs">{labels[f.labelKey]}</Label>
            {canWrite ? (
              <Input
                type="time"
                value={timing[f.key] || ""}
                onChange={(e) => onChange({ ...timing, [f.key]: e.target.value })}
              />
            ) : (
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                {formatTimeUS(timing[f.key]) || "—"}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { TimingFields };
