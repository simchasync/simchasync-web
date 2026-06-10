import EnumSelectWithOther from "./EnumSelectWithOther";
import { useLanguage } from "@/contexts/LanguageContext";
import { EVENT_TYPES } from "@/lib/eventTypes";

interface EventTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export default function EventTypeSelect({ value, onChange }: EventTypeSelectProps) {
  const { t } = useLanguage();
  const labels = t.app.bookings.types as Record<string, string>;

  return (
    <EnumSelectWithOther
      value={value}
      onChange={onChange}
      options={EVENT_TYPES}
      labels={labels}
      placeholder={labels.placeholder}
      customPlaceholder={labels.customPlaceholder}
    />
  );
}
