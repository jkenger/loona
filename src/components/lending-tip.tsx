import { Lightbulb } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export function LendingTip({ tip, className }: { tip: string; className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground flex items-center gap-1.5", className)}>
      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary/60" />
      {tip}
    </p>
  )
}
