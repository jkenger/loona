import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  getDay,
} from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { Link } from "@tanstack/react-router"

type DashboardCalendarProps = {
  calendarData: Record<
    string,
    {
      payments: {
        id: string
        loanId: string
        borrowerName: string
        amount: string
        status: "pending" | "paid" | "overdue" | "partial"
        paidAmount: string
      }[]
      totalExpected: number
      totalPaid: number
      hasPaid: boolean
      hasPending: boolean
      hasOverdue: boolean
    }
  >
  currentMonth: Date
}

export function DashboardPaymentCalendar({
  calendarData,
  currentMonth,
}: DashboardCalendarProps) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDay = getDay(monthStart)
  const paddingDays = Array(startDay).fill(null)

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div>
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, index) => (
          <div key={`pad-${index}`} className="h-12" />
        ))}

        {days.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd")
          const dayData = calendarData[dateKey]
          const hasPayments = !!dayData
          const today = isToday(date)

          const dayContent = (
            <div
              className={cn(
                "h-12 rounded text-sm relative flex flex-col items-center justify-center transition-colors",
                today && "ring-1 ring-primary bg-primary/5",
                hasPayments && "hover:bg-muted/50 cursor-pointer",
                !hasPayments && "text-muted-foreground",
              )}
            >
              <span className={cn("font-medium", today && "text-primary")}>
                {format(date, "d")}
              </span>

              {hasPayments && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayData.hasPaid && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  {dayData.hasOverdue && (
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  )}
                  {dayData.hasPending && !dayData.hasOverdue && (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )

          if (!hasPayments) {
            return <div key={dateKey}>{dayContent}</div>
          }

          return (
            <Popover key={dateKey}>
              <PopoverTrigger
                openOnHover
                delay={100}
                closeDelay={100}
                render={<div />}
                className="w-full"
              >
                {dayContent}
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">
                      {format(date, "MMMM d, yyyy")}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {dayData.payments.length} payment
                      {dayData.payments.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dayData.payments.map((payment) => {
                      const remaining =
                        parseFloat(payment.amount) -
                        parseFloat(payment.paidAmount)
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {payment.borrowerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.status === "paid"
                                ? formatCurrency(payment.amount)
                                : `${formatCurrency(remaining)} remaining`}
                            </p>
                          </div>
                          <Badge
                            variant={
                              (
                                {
                                  paid: "default",
                                  partial: "secondary",
                                  pending: "outline",
                                  overdue: "destructive",
                                } as const
                              )[payment.status] as any
                            }
                            className="text-xs shrink-0"
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>

                  <Link to="/payments" className="block">
                    <Button size="sm" className="w-full gap-1.5">
                      View Payments
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Paid</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Overdue</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span className="text-muted-foreground">Upcoming</span>
        </div>
      </div>
    </div>
  )
}
