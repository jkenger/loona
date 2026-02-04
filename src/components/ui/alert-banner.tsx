import { ReactNode } from "react"

interface AlertBannerProps {
  variant?: "default" | "destructive"
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function AlertBanner({
  variant = "default",
  icon,
  title,
  description,
  action,
}: AlertBannerProps) {
  const variantStyles = {
    default: {
      border: "border-primary/20",
      overlay: "bg-primary/5",
      iconBg: "bg-primary/10",
      titleColor: "text-foreground",
    },
    destructive: {
      border: "border-destructive/20",
      overlay: "bg-destructive/5",
      iconBg: "bg-destructive/10",
      titleColor: "text-destructive",
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      className={`rounded-lg border ${styles.border} bg-card shadow-lg p-4 relative overflow-hidden`}
    >
      <div className={`absolute inset-0 ${styles.overlay} pointer-events-none`} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
          <div>
            <p className={`font-semibold text-sm ${styles.titleColor}`}>{title}</p>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
    </div>
  )
}
