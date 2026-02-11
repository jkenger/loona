import { useState, useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { reversePayment } from "@/server/payments"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@phosphor-icons/react"

interface ReversePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: {
    id: string
    amount: string
    method: string
    paidAt: string
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

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank Transfer",
}

export function ReversePaymentDialog({
  open,
  onOpenChange,
  payment,
}: ReversePaymentDialogProps) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [isReversing, setIsReversing] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setIsReversing(false)
    }
  }, [open])

  const handleReverse = async () => {
    if (!payment || !reason.trim()) return

    setIsReversing(true)
    try {
      await reversePayment({
        data: {
          paymentId: payment.id,
          reason: reason.trim(),
        },
      })
      toast.success("Payment reversed")
      router.invalidate()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reverse payment")
    } finally {
      setIsReversing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse Payment</DialogTitle>
          <DialogDescription>
            This will undo the payment and restore loan balances.
            Applied penalties for this installment will also be reverted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <div className="space-y-4">
            {/* Payment summary */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="text-center pb-3 border-b">
                <p className="text-2xl font-bold text-destructive">{formatCurrency(payment.amount)}</p>
                <p className="text-sm text-muted-foreground">Payment Amount</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(payment.paidAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{METHOD_LABELS[payment.method] ?? payment.method}</span>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reversalReason">Reason for reversal</Label>
              <Textarea
                id="reversalReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Wrong amount entered, duplicate payment..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReversing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReverse}
            disabled={isReversing || !reason.trim()}
          >
            {isReversing ? (
              <>
                <Spinner className="h-4 w-4 animate-spin mr-2" />
                Reversing...
              </>
            ) : (
              "Reverse Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
