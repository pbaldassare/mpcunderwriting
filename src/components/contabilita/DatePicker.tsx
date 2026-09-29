import {
  DateInput,
  formatIsoDateOnly,
  parseIsoDateOnly,
} from "@/components/ui/date-input";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder: string;
  className?: string;
}

/** Wrapper contabilità: value Date, stesso UX di DateInput (digitazione + calendario). */
export function DatePicker({ value, onChange, placeholder, className }: DatePickerProps) {
  const iso = value ? formatIsoDateOnly(value) : "";

  return (
    <DateInput
      value={iso}
      onChange={(e) => {
        const next = e.target.value;
        onChange(next ? parseIsoDateOnly(next) ?? null : null);
      }}
      placeholder={placeholder}
      className={cn("w-[150px]", className)}
    />
  );
}
