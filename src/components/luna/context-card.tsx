import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import type { ContextCard as ContextCardType } from "@/server/luna/tools"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface ContextCardProps {
  card: ContextCardType
  onDismiss: () => void
}

const fmt = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

function OverdueLoansTable({ data }: { data: any[] }) {
  return (
    <div className="space-y-2">
      {data.map((row: any, i: number) => (
        <div
          key={i}
          className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
        >
          <div>
            <p className="font-medium text-xs">{row.borrowerName}</p>
            <p className="text-[11px] text-muted-foreground">
              Due {new Date(row.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
            </p>
          </div>
          <span className="text-xs font-semibold text-destructive">
            {fmt(row.amountDue)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PaymentHistoryTable({ data }: { data: any[] }) {
  return (
    <div className="space-y-2">
      {data.map((row: any, i: number) => (
        <div
          key={i}
          className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
        >
          <div>
            <p className="font-medium text-xs">{row.borrowerName ?? "Payment"}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.method} · {new Date(row.paidAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
            </p>
          </div>
          <span className={cn("text-xs font-semibold", row.reversed ? "text-muted-foreground line-through" : "text-emerald-600 dark:text-emerald-400")}>
            {fmt(row.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PortfolioStats({ data }: { data: any }) {
  const stats = [
    { label: "Active Loans", value: data.activeLoans ?? data.expectedCount },
    { label: "Outstanding", value: data.outstandingBalance ? fmt(data.outstandingBalance) : undefined },
    { label: "Collected", value: data.totalCollected ? fmt(data.totalCollected) : data.collected ? fmt(data.collected) : undefined },
    { label: "Collection Rate", value: data.rate ? `${data.rate}%` : undefined },
    { label: "Overdue", value: data.overdueCount !== undefined ? `${data.overdueCount} items` : undefined },
    { label: "Interest Earned", value: data.interestEarned ? fmt(data.interestEarned) : undefined },
  ].filter((s) => s.value !== undefined)

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-muted/50 dark:bg-muted/30 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          <p className="text-sm font-semibold mt-0.5">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function PaymentConfirmation({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="h-5 w-5" weight="fill" />
        <span className="text-sm font-semibold">Payment Recorded</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Borrower</p>
          <p className="font-medium">{data.borrowerName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Amount</p>
          <p className="font-medium">{fmt(data.amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Method</p>
          <p className="font-medium capitalize">{data.method}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className="font-medium">{fmt(data.remainingBalance)}</p>
        </div>
      </div>
      {data.isCompleted && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Loan is now fully paid!
        </div>
      )}
    </div>
  )
}

function BorrowerList({ data }: { data: any[] }) {
  return (
    <div className="space-y-2">
      {data.map((row: any, i: number) => (
        <div
          key={i}
          className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
        >
          <div>
            <p className="font-medium text-xs">{row.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.activeLoans} active loans{row.tier ? ` · ${row.tier}` : ""}
            </p>
          </div>
          {row.phone && (
            <span className="text-[11px] text-muted-foreground">{row.phone}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function LoanDetail({ data }: { data: any }) {
  // Could be a single loan object or array of loan summaries
  if (Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data.map((row: any, i: number) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
          >
            <div>
              <p className="font-medium text-xs">{row.borrowerName}</p>
              <p className="text-[11px] text-muted-foreground capitalize">
                {row.paymentFrequency} · {row.status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold">{fmt(Number(row.principal))}</p>
              <p className="text-[11px] text-muted-foreground">
                {fmt(Number(row.remainingBalance))} left
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Single loan detail with schedule
  const loan = data.loan
  const schedule = data.schedule
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Principal</p>
          <p className="font-medium">{fmt(loan.principal)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className="font-medium">{fmt(loan.remainingBalance)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Interest</p>
          <p className="font-medium">{loan.interestRate}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">Payment</p>
          <p className="font-medium capitalize">{fmt(loan.paymentAmount)} / {loan.paymentFrequency}</p>
        </div>
      </div>
      {schedule && schedule.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Schedule</p>
          {schedule.slice(0, 8).map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
              <span className={cn(s.status === "paid" ? "text-muted-foreground" : s.status === "overdue" ? "text-destructive" : "")}>
                {new Date(s.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              </span>
              <span className={cn("font-medium", s.status === "paid" ? "text-muted-foreground" : s.status === "overdue" ? "text-destructive" : "")}>
                {s.status === "paid" ? "Paid" : fmt(s.amount - s.paidAmount)}
              </span>
            </div>
          ))}
          {schedule.length > 8 && (
            <p className="text-[10px] text-muted-foreground">+{schedule.length - 8} more</p>
          )}
        </div>
      )}
    </div>
  )
}

function ContactDetail({ data }: { data: any }) {
  const { contact, loans: contactLoans } = data
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Phone</p>
          <p className="font-medium">{contact.phone || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">City</p>
          <p className="font-medium">{contact.city || "—"}</p>
        </div>
        {contact.tier && (
          <div>
            <p className="text-muted-foreground">Tier</p>
            <p className="font-medium capitalize">{contact.tier}</p>
          </div>
        )}
        {contact.onTimeRate !== null && (
          <div>
            <p className="text-muted-foreground">On-Time Rate</p>
            <p className="font-medium">{contact.onTimeRate}%</p>
          </div>
        )}
      </div>
      {contactLoans && contactLoans.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Loans</p>
          {contactLoans.map((l: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
              <span className="capitalize">{l.status}</span>
              <span className="font-medium">{fmt(l.principal)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PaymentPreview({ data }: { data: any }) {
  const [confirmed, setConfirmed] = useState(false)

  const dueDateStr = new Date(data.installmentDueDate).toLocaleDateString(
    "en-PH",
    { month: "long", day: "numeric", year: "numeric" },
  )

  const handleConfirm = () => {
    setConfirmed(true)
    window.dispatchEvent(
      new CustomEvent("luna-suggestion", {
        detail: `Yes, confirm the payment of ${fmt(data.amount)} via ${data.method} for ${data.borrowerName}.`,
      }),
    )
  }

  const handleCancel = () => {
    window.dispatchEvent(
      new CustomEvent("luna-suggestion", {
        detail: "Cancel the payment, I changed my mind.",
      }),
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <WarningCircle className="h-5 w-5" weight="fill" />
        <span className="text-sm font-semibold">Review Payment</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Borrower</p>
          <p className="font-medium">{data.borrowerName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Amount</p>
          <p className="font-medium">{fmt(data.amount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Method</p>
          <p className="font-medium capitalize">{data.method}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Due Date</p>
          <p className="font-medium">{dueDateStr}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Installment</p>
          <p className="font-medium">{fmt(data.installmentAmount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className="font-medium">{fmt(data.installmentRemaining)}</p>
        </div>
      </div>
      {!confirmed ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={handleConfirm}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" weight="fill" />
            Confirm Payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/50 dark:bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-center">
          Confirming payment...
        </div>
      )}
    </div>
  )
}

export function ContextCardComponent({ card, onDismiss }: ContextCardProps) {
  const renderContent = () => {
    switch (card.type) {
      case "overdue_loans_table":
        return <OverdueLoansTable data={card.data} />
      case "payment_history":
        return <PaymentHistoryTable data={card.data} />
      case "portfolio_stats":
        return <PortfolioStats data={card.data} />
      case "payment_preview":
        return <PaymentPreview data={card.data} />
      case "payment_confirmation":
        return <PaymentConfirmation data={card.data} />
      case "borrower_list":
        return <BorrowerList data={card.data} />
      case "loan_detail":
        return <LoanDetail data={card.data} />
      case "contact_detail":
        return <ContactDetail data={card.data} />
      default:
        return (
          <pre className="text-xs overflow-auto max-h-40">
            {JSON.stringify(card.data, null, 2)}
          </pre>
        )
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold">{card.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2">{renderContent()}</CardContent>
    </Card>
  )
}
