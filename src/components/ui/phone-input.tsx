import * as React from "react"
import { Input } from "./input"
import { cn, formatPhoneInput, parsePhoneInput } from "@/lib/utils"
import { Phone } from "@phosphor-icons/react"

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string
  onValueChange: (value: string) => void
  showIcon?: boolean
}

function PhoneInput({
  className,
  value,
  onValueChange,
  showIcon = true,
  ...props
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    value ? formatPhoneInput(value) : ""
  )

  // Sync display value when external value changes
  React.useEffect(() => {
    const formatted = value ? formatPhoneInput(value) : ""
    setDisplayValue(formatted)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const formatted = formatPhoneInput(input)
    setDisplayValue(formatted)

    // Pass raw phone value to parent
    const rawValue = parsePhoneInput(formatted)
    onValueChange(rawValue)
  }

  return (
    <div className="relative">
      {showIcon && (
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      )}
      <Input
        type="tel"
        inputMode="tel"
        className={cn(showIcon && "pl-10", className)}
        value={displayValue}
        onChange={handleChange}
        placeholder="0917 123 4567"
        {...props}
      />
    </div>
  )
}

export { PhoneInput }
