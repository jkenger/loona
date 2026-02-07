import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-muted", className)}
      {...props}
    />
  )
}

// Pre-built skeleton patterns for common use cases
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  )
}

function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between py-4 px-4 border-b", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4 py-3 border-b">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div>
      {/* Header */}
      <div className="bg-slate-900 text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-5 w-64 bg-white/10" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <Skeleton className="h-10 w-48 bg-white/10" />
              <Skeleton className="h-4 w-56 bg-white/10" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-11 w-36 bg-white/10 rounded-md" />
              <Skeleton className="h-11 w-36 bg-white/10 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Content overlapping header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>

        {/* Calendar + Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-36" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={`h-${i}`} className="h-5" />
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-sm p-4 space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-9 w-9 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio + Forecast */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-card shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded bg-muted/50 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-28" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-sm p-4 space-y-4">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Reusable page-level skeleton building blocks
function SkeletonPageHeader() {
  return (
    <div className="bg-slate-900 text-white pt-6 lg:pt-8 pb-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-5 w-64 bg-white/10" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="border-l-4 border-primary pl-4 space-y-2">
            <Skeleton className="h-10 w-48 bg-white/10" />
            <Skeleton className="h-4 w-56 bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonPageContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
      {children}
    </div>
  )
}

function SkeletonTablePage() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonPageContent>
        <div className="rounded-lg border bg-card shadow-lg p-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1 max-w-sm" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-3 border-b flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 p-3 border-b last:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 ml-auto rounded" />
            </div>
          ))}
        </div>
      </SkeletonPageContent>
    </div>
  )
}

function SkeletonFormPage() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonPageContent>
        <div className="rounded-lg border bg-card shadow-sm p-6 space-y-6 max-w-2xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </SkeletonPageContent>
    </div>
  )
}

function SkeletonDetailPage() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonPageContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 rounded-lg border bg-card p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </SkeletonPageContent>
    </div>
  )
}

function SkeletonStatsPage() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonPageContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </SkeletonPageContent>
    </div>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonListItem,
  SkeletonTable,
  SkeletonDashboard,
  SkeletonPageHeader,
  SkeletonPageContent,
  SkeletonTablePage,
  SkeletonFormPage,
  SkeletonDetailPage,
  SkeletonStatsPage,
}
