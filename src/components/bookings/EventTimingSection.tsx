import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

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

const WEDDING_FIELDS: { key: keyof TimingFields; label: string }[] = [
  { key: "chuppah_time", label: "Chuppah Time" },
  { key: "meal_time", label: "Meal Time" },
  { key: "first_dance_time", label: "First Dance Time" },
  { key: "second_dance_time", label: "Second Dance Time" },
  { key: "mitzvah_tanz_time", label: "Mitzvah Tanz" },
];

export default function EventTimingSection({ eventType, timing, onChange, canWrite }: EventTimingSectionProps) {
  const isWedding = eventType === "wedding";
  const fields = isWedding ? WEDDING_FIELDS : [{ key: "event_start_time" as keyof TimingFields, label: "Event Start Time" }];

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 font-semibold text-sm">
        <Clock className="h-4 w-4 text-primary" />
        Event Timing
      </h4>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="time"
              value={timing[f.key] || ""}
              onChange={(e) => onChange({ ...timing, [f.key]: e.target.value })}
              disabled={!canWrite}
              className={!canWrite ? "bg-muted" : ""}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export type { TimingFields };
