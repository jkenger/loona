import { useState, useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { editPaymentDate } from "@/server/payments"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowRight, Spinner } from "@phosphor-icons/react"
import { format } from "date-fns"

interface EditPaymentDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: {
    id: string
    amount: string
    method: string
    paidAt: string
  } | null
  scheduleInfo?: {
    label: string
    dueDate: string
    amount: string
  } | null
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank Transfer",
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

export function EditPaymentDateDialog({
  open,
  onOpenChange,
  payment,
  scheduleInfo,
}: EditPaymentDateDialogProps) {
  const router = useRouter()
  const [newDate, setNewDate] = useState<Date | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open && payment) {
      setNewDate(new Date(payment.paidAt))
      setIsSaving(false)
    }
  }, [open, payment])

  const oldDate = payment ? new Date(payment.paidAt) : null
  const dateChanged = newDate && oldDate
    ? newDate.toDateString() !== oldDate.toDateString()
    : false

  const handleSave = async () => {
    if (!payment || !newDate || !dateChanged) return

    setIsSaving(true)
    try {
      const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`
      await editPaymentDate({
        data: {
          paymentId: payment.id,
          paidAt: dateStr,
        },
      })
      toast.success("Payment date updated")
      router.invalidate()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update payment date")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payment Date</DialogTitle>
          <DialogDescription>
            Change the date this payment was recorded on.
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <div className="space-y-4">
            {/* Payment summary */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="text-center pb-3 border-b">
                <p className="text-2xl font-bold text-primary">{formatCurrency(payment.amount)}</p>
                <p className="text-sm text-muted-foreground">Payment Amount</p>
              </div>
              <div className="space-y-2 text-sm">
                {scheduleInfo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{scheduleInfo.label}</span>
                    <span className="font-medium">
                      {formatCurrency(scheduleInfo.amount)} · due {format(new Date(scheduleInfo.dueDate), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{METHOD_LABELS[payment.method] ?? payment.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Date</span>
                  <span className="font-medium">{format(new Date(payment.paidAt), "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>

            {/* Date picker */}
            <div className="flex justify-center">
              <DatePicker
                value={newDate}
                onChange={setNewDate}
                disabledDates={{ after: new Date() }}
              />
            </div>

            {/* Confirmation preview */}
            {dateChanged && oldDate && newDate && (
              <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <span className="text-muted-foreground">{format(oldDate, "MMM d, yyyy")}</span>
                <ArrowRight className="h-4 w-4 text-primary" weight="bold" />
                <span className="font-medium text-primary">{format(newDate, "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !dateChanged}
          >
            {isSaving ? (
              <>
                <Spinner className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
