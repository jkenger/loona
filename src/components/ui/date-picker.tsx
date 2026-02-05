import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"

export interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  className?: string
  disabled?: boolean
}

function DatePicker({
  value,
  onChange,
  className,
  disabled,
}: DatePickerProps) {
  return (
    <Calendar
      mode="single"
      selected={value}
      onSelect={onChange}
      disabled={disabled}
      className={cn(
        "rounded border border-input bg-background",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    />
  )
}

export { DatePicker }
