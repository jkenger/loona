import { useState, useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { payPenalty } from "@/server/penalties"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Spinner, Money, Bank } from "@phosphor-icons/react"
import { format } from "date-fns"

interface PayPenaltyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  penalty: {
    id: string
    penaltyType: string
    amount: string
    contactName?: string
  } | null
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

export function PayPenaltyDialog({
  open,
  onOpenChange,
  penalty,
}: PayPenaltyDialogProps) {
  const router = useRouter()

  const [step, setStep] = useState<"form" | "confirm">("form")
  const [method, setMethod] = useState<"cash" | "gcash" | "maya" | "bank">("cash")
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open && penalty) {
      setMethod("cash")
      setPaymentDate(new Date())
      setNotes("")
      setStep("form")
    }
  }, [open, penalty?.id])

  const penaltyTypeLabel = penalty?.penaltyType === "daily_interest" ? "Daily Interest" : "Late Fee"

  const handleSubmit = async () => {
    if (!penalty) return

    setIsSubmitting(true)
    try {
      const result = await payPenalty({
        data: {
          penaltyId: penalty.id,
          method,
          paidAt: format(paymentDate, "yyyy-MM-dd"),
          notes: notes || undefined,
        },
      })
      toast.success("Penalty payment recorded", {
        action: result.paymentId
          ? {
              label: "Share Receipt",
              onClick: () => {
                const url = `${window.location.origin}/share/receipt/${result.paymentId}`
                navigator.clipboard.writeText(url)
                toast.success("Receipt link copied to clipboard")
              },
            }
          : undefined,
      })
      router.invalidate()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record penalty payment")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Pay Penalty" : "Confirm Payment"}
          </DialogTitle>
          <DialogDescription>
            {penaltyTypeLabel} &middot; {penalty ? formatCurrency(penalty.amount) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 flex-1 -mx-4 px-4">
          {penalty && step === "form" && (
            <div className="space-y-4">
              {/* Penalty info */}
              <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
                {penalty.contactName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Borrower</span>
                    <span className="font-medium">{penalty.contactName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Penalty Type</span>
                  <span className="font-medium">{penaltyTypeLabel}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Amount</span>
                  <span className="font-bold">{formatCurrency(penalty.amount)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const isSelected = method === m.value
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMethod(m.value as any)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <MethodIcon method={m.value} className="h-5 w-5" selected={isSelected} />
                          {m.label}
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
                  <Label htmlFor="penaltyNotes">Notes (optional)</Label>
                  <Input
                    id="penaltyNotes"
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {penalty && step === "confirm" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="text-center pb-3 border-b">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(penalty.amount)}</p>
                  <p className="text-sm text-muted-foreground">Penalty Payment</p>
                </div>
                <div className="space-y-2 text-sm">
                  {penalty.contactName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Borrower</span>
                      <span className="font-medium">{penalty.contactName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{penaltyTypeLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="font-medium">{format(paymentDate, "MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium">{METHOD_LABELS[method]}</span>
                  </div>
                  {notes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes</span>
                      <span className="font-medium text-right max-w-[180px] truncate">{notes}</span>
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
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep("confirm")}>
                Review Payment
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
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
