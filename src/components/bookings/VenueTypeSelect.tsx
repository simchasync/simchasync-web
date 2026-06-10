import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { VENUE_TYPES, isKnownVenueType } from "@/lib/venueTypes";

interface VenueTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const OTHER = "other";

export default function VenueTypeSelect({ value, onChange }: VenueTypeSelectProps) {
  const { t } = useLanguage();
  const labels = t.app.bookings.venueTypes as Record<string, string>;

  const isCustom = value !== "" && !isKnownVenueType(value);
  const selectValue = isCustom ? OTHER : value;

  return (
    <div className="space-y-1.5">
      <Select value={selectValue} onValueChange={(v) => onChange(v === OTHER ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder={labels.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {VENUE_TYPES.map((vt) => (
            <SelectItem key={vt} value={vt}>{labels[vt]}</SelectItem>
          ))}
          <SelectItem value={OTHER}>{labels.other}</SelectItem>
        </SelectContent>
      </Select>
      {selectValue === OTHER && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={labels.customPlaceholder}
          autoComplete="off"
        />
      )}
    </div>
  );
}
