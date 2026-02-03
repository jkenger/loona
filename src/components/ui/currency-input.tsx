import * as React from "react"
import { Input } from "./input"
import { cn, formatCurrencyInput, parseCurrencyInput } from "@/lib/utils"

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string
  onValueChange: (value: string) => void
  symbol?: string
}

function CurrencyInput({
  className,
  value,
  onValueChange,
  symbol = "₱",
  ...props
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    value ? formatCurrencyInput(value) : ""
  )

  // Sync display value when external value changes
  React.useEffect(() => {
    const formatted = value ? formatCurrencyInput(value) : ""
    setDisplayValue(formatted)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const formatted = formatCurrencyInput(input)
    setDisplayValue(formatted)

    // Pass raw number value to parent
    const rawValue = parseCurrencyInput(formatted)
    onValueChange(rawValue > 0 ? rawValue.toString() : "")
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        {symbol}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        className={cn("pl-7", className)}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    </div>
  )
}

export { CurrencyInput }
