import { type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  description?: string
  destructive?: boolean
  trend?: {
    value: number
    label?: string
  }
  className?: string
}

export function StatCard({
  label,
  value,
  icon,
  description,
  destructive = false,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn(
              "text-3xl font-bold tracking-tight",
              destructive && "text-destructive"
            )}>
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p className={cn(
                "text-xs font-medium",
                destructive ? "text-destructive" : "text-primary"
              )}>
                {trend.value >= 0 ? "+" : ""}
                {trend.value}% {trend.label || "from last period"}
              </p>
            )}
          </div>
          {icon && (
            <div className={cn(
              "p-2.5 rounded",
              destructive
                ? "bg-destructive/20 text-destructive"
                : "bg-primary/20 text-primary"
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
