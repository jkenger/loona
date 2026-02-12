import { cn } from "@/lib/utils"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { Matcher, DayButton } from "react-day-picker"

export interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  className?: string
  disabled?: boolean
  disabledDates?: Matcher | Matcher[]
  disabledTooltip?: string
}

function DatePicker({
  value,
  onChange,
  className,
  disabled,
  disabledDates,
  disabledTooltip,
}: DatePickerProps) {
  const components = disabledTooltip
    ? {
        DayButton: (props: React.ComponentProps<typeof DayButton>) => {
          if (props.modifiers.disabled) {
            return (
              <Tooltip>
                <TooltipTrigger
                  render={(triggerProps) => (
                    <span {...triggerProps} className="flex size-full items-center justify-center">
                      <CalendarDayButton {...props} />
                    </span>
                  )}
                />
                <TooltipContent>{disabledTooltip}</TooltipContent>
              </Tooltip>
            )
          }
          return <CalendarDayButton {...props} />
        },
      }
    : undefined

  return (
    <Calendar
      mode="single"
      selected={value}
      onSelect={onChange}
      disabled={disabled ? true : disabledDates}
      components={components}
      className={cn(
        "rounded border border-input bg-background",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    />
  )
}

export { DatePicker }
