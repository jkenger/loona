import { useState, useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { recordPayment } from "@/server/payments"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/ui/currency-input"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Spinner, Warning, Money, Bank } from "@phosphor-icons/react"
import { format } from "date-fns"

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string
  borrowerName: string
  scheduleItem: {
    id: string
    amount: string
    paidAmount: string
    dueDate: string
  } | null
  /** @deprecated No longer displayed — applied penalties are now separate payments */
  appliedPenalties?: number
  scheduleIndex?: number
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank" },
] as const

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
)

function MethodIcon({ method, className, selected }: { method: string; className?: string; selected?: boolean }) {
  switch (method) {
    case "cash":
      return <Money className={className} weight={selected ? "fill" : "regular"} />
    case "gcash":
      return <img src="/icons/gcash.svg" alt="GCash" className={className} />
    case "maya":
      return <img src="/icons/maya.svg" alt="Maya" className={className} />
    case "bank":
      return <Bank className={className} weight={selected ? "fill" : "regular"} />
    default:
      return null
  }
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  loanId,
  borrowerName,
  scheduleItem,
  appliedPenalties: _appliedPenalties = 0,
  scheduleIndex,
}: RecordPaymentDialogProps) {
  const router = useRouter()

  const [paymentStep, setPaymentStep] = useState<"form" | "confirm">("form")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "maya" | "bank">("cash")
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  const [paymentNotes, setPaymentNotes] = useState("")
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)

  // Reset form state when dialog opens with a new schedule item
  useEffect(() => {
    if (open && scheduleItem) {
      const remaining = parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount)
      setPaymentAmount(remaining.toString())
      setPaymentMethod("cash")
      setPaymentDate(new Date())
      setPaymentNotes("")
      setPaymentStep("form")
    }
  }, [open, scheduleItem?.id])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleRecordPayment = async () => {
    if (!scheduleItem) return

    setIsRecordingPayment(true)
    try {
      const result = await recordPayment({
        data: {
          loanId,
          scheduleItemId: scheduleItem.id,
          amount: parseFloat(paymentAmount),
          method: paymentMethod,
          paidAt: format(paymentDate, "yyyy-MM-dd"),
          notes: paymentNotes || undefined,
        },
      })
      toast.success("Payment recorded successfully", {
        action: {
          label: "Share Receipt",
          onClick: () => {
            const url = `${window.location.origin}/share/receipt/${result.id}`
            navigator.clipboard.writeText(url)
            toast.success("Receipt link copied to clipboard")
          },
        },
      })
      router.invalidate()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setIsRecordingPayment(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {paymentStep === "form" ? "Record Payment" : "Confirm Payment"}
          </DialogTitle>
          <DialogDescription>
            {scheduleItem && (
              <>
                {scheduleIndex != null && <>Payment #{scheduleIndex + 1} · </>}
                Due {new Date(scheduleItem.dueDate).toLocaleDateString()}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 flex-1 -mx-4 px-4">
          {scheduleItem && paymentStep === "form" && (
            <div className="space-y-4">
              {/* Schedule item info */}
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Due</span>
                  <span className="font-medium">{formatCurrency(scheduleItem.amount)}</span>
                </div>
                {parseFloat(scheduleItem.paidAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-medium text-primary">{formatCurrency(scheduleItem.paidAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold">
                    {formatCurrency(parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount))}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <CurrencyInput
                    id="paymentAmount"
                    value={paymentAmount}
                    onValueChange={setPaymentAmount}
                    placeholder="1,000"
                  />
                  {(() => {
                    const entered = parseFloat(paymentAmount) || 0
                    const remaining = parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount)
                    if (entered > remaining && remaining > 0) {
                      return (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <Warning className="h-3 w-3 shrink-0" weight="bold" />
                          Exceeds remaining balance.{" "}
                          <button
                            type="button"
                            className="underline hover:text-destructive/80 transition-colors"
                            onClick={() => setPaymentAmount(remaining.toString())}
                          >
                            Set to {formatCurrency(remaining)}
                          </button>
                        </p>
                      )
                    }
                    return null
                  })()}
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                      const isSelected = paymentMethod === method.value
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setPaymentMethod(method.value as any)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <MethodIcon method={method.value} className="h-5 w-5" selected={isSelected} />
                          {method.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <DatePicker
                    value={paymentDate}
                    onChange={(date) => date && setPaymentDate(date)}
                    disabledDates={{ after: new Date() }}
                    disabledTooltip="Payment date cannot be in the future"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentNotes">Notes (optional)</Label>
                  <Input
                    id="paymentNotes"
                    placeholder="Any additional notes..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {scheduleItem && paymentStep === "confirm" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="text-center pb-3 border-b">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(paymentAmount)}</p>
                  <p className="text-sm text-muted-foreground">Payment Amount</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Borrower</span>
                    <span className="font-medium">{borrowerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="font-medium">{format(paymentDate, "MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium">{METHOD_LABELS[paymentMethod]}</span>
                  </div>
                  {paymentNotes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes</span>
                      <span className="font-medium text-right max-w-[180px] truncate">{paymentNotes}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Please review the details above before confirming.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {paymentStep === "form" ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setPaymentStep("confirm")}
                disabled={!paymentAmount || (scheduleItem != null && (parseFloat(paymentAmount) || 0) > parseFloat(scheduleItem.amount) - parseFloat(scheduleItem.paidAmount))}
              >
                Review Payment
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPaymentStep("form")}>
                Back
              </Button>
              <Button onClick={handleRecordPayment} disabled={isRecordingPayment}>
                {isRecordingPayment ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin mr-2" />
                    Recording...
                  </>
                ) : (
                  "Confirm Payment"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
