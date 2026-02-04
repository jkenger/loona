import { format } from "date-fns"
import { ReactNode } from "react"

interface PageHeaderProps {
  badge: string
  section: string
  title: string
  subtitle?: string
  actions?: ReactNode
  showDate?: boolean
}

export function PageHeader({
  badge,
  section,
  title,
  subtitle,
  actions,
  showDate = true,
}: PageHeaderProps) {
  return (
    <div className="bg-slate-900 text-white pt-6 lg:pt-8 pb-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Meta Bar */}
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 text-white text-xs font-medium">
            {badge}
          </span>
          <span className="text-slate-500">·</span>
          <span>{section}</span>
          {showDate && (
            <>
              <span className="text-slate-500">·</span>
              <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
            </>
          )}
        </div>

        {/* Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-slate-300">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

interface PageContentProps {
  children: ReactNode
  className?: string
}

export function PageContent({ children, className = "" }: PageContentProps) {
  return (
    <div
      className={`mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative ${className}`}
    >
      {children}
    </div>
  )
}
