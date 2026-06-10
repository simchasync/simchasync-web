import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OTHER = "other";

function isKnownOption(options: readonly string[], value: string): boolean {
  return options.includes(value);
}

interface EnumSelectWithOtherProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  labels: Record<string, string>;
  placeholder?: string;
  customPlaceholder?: string;
}

/**
 * A <Select> of known options plus an "Other" item that reveals a free-text
 * input. The "other" value is a UI-only sentinel — it is never passed to
 * onChange. While in custom mode, onChange receives whatever the user types.
 */
export default function EnumSelectWithOther({
  value, onChange, options, labels, placeholder, customPlaceholder,
}: EnumSelectWithOtherProps) {
  const [customMode, setCustomMode] = useState(() => value !== "" && !isKnownOption(options, value));

  useEffect(() => {
    if (isKnownOption(options, value)) setCustomMode(false);
  }, [value, options]);

  const selectValue = customMode ? OTHER : (isKnownOption(options, value) ? value : "");

  const handleSelect = (v: string) => {
    if (v === OTHER) {
      setCustomMode(true);
      if (isKnownOption(options, value)) onChange("");
    } else {
      setCustomMode(false);
      onChange(v);
    }
  };

  return (
    <div className="space-y-1.5">
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{labels[opt] ?? opt}</SelectItem>
          ))}
          <SelectItem value={OTHER}>{labels.other ?? "Other"}</SelectItem>
        </SelectContent>
      </Select>
      {customMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={customPlaceholder}
          autoComplete="off"
        />
      )}
    </div>
  );
}
