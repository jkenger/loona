import { useState, useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { regenerateSchedule } from "@/server/loans"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner, Warning } from "@phosphor-icons/react"

interface RegenerateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string
  remainingBalance: number
  remainingCount: number
  originalPaymentAmount: number
  firstItemAmount: number
  skippedCount: number
  pendingPenaltyCount: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function RegenerateScheduleDialog({
  open,
  onOpenChange,
  loanId,
  remainingBalance,
  remainingCount,
  originalPaymentAmount,
  firstItemAmount,
  skippedCount,
  pendingPenaltyCount,
}: RegenerateScheduleDialogProps) {
  const router = useRouter()
  const [isRegenerating, setIsRegenerating] = useState(false)

  useEffect(() => {
    if (open) {
      setIsRegenerating(false)
    }
  }, [open])

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    try {
      await regenerateSchedule({ data: { loanId } })
      toast.success("Schedule regenerated successfully")
      router.invalidate()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate schedule")
    } finally {
      setIsRegenerating(false)
    }
  }

  const allSameAmount = Math.abs(firstItemAmount - originalPaymentAmount) < 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate Schedule</DialogTitle>
          <DialogDescription>
            Replace remaining unpaid installments with new payments starting from today.
            The first payment absorbs any balance difference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="text-center pb-3 border-b">
              <p className="text-2xl font-bold text-primary">{formatCurrency(remainingBalance)}</p>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Installments</span>
                <span className="font-medium">{remainingCount}</span>
              </div>
              {allSameAmount ? (
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Payment Amount</span>
                  <span className="font-bold text-primary">{formatCurrency(originalPaymentAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">First Payment</span>
                    <span className="font-bold text-primary">{formatCurrency(firstItemAmount)}</span>
                  </div>
                  {remainingCount > 1 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Remaining {remainingCount - 1} {remainingCount - 1 === 1 ? "payment" : "payments"}
                      </span>
                      <span className="font-medium">{formatCurrency(originalPaymentAmount)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {pendingPenaltyCount > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <Warning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {pendingPenaltyCount} pending {pendingPenaltyCount === 1 ? "penalty" : "penalties"} will
                be deleted. New penalties will generate naturally as new items become overdue.
              </p>
            </div>
          )}

          {skippedCount > 0 && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
              <Warning className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {skippedCount} {skippedCount === 1 ? "item has" : "items have"} applied or waived
                penalties and will be kept as-is.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRegenerating}>
            Cancel
          </Button>
          <Button onClick={handleRegenerate} disabled={isRegenerating}>
            {isRegenerating ? (
              <>
                <Spinner className="h-4 w-4 animate-spin mr-2" />
                Regenerating...
              </>
            ) : (
              "Regenerate Schedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
