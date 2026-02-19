import { createFileRoute } from "@tanstack/react-router"
import { getPublicPaymentReceipt } from "@/server/payments"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { LoonaBrand } from "@/components/ui/loona-brand"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Stagger, StaggerItem } from "@/components/ui/stagger"

export const Route = createFileRoute("/share/receipt/$paymentId")({
  loader: async ({ params }) => {
    try {
      const receipt = await getPublicPaymentReceipt({ data: params.paymentId })
      return { receipt }
    } catch {
      return { receipt: null }
    }
  },
  component: ReceiptPage,
})

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank Transfer",
}

function formatCurrencyExact(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function ReceiptPage() {
  const { receipt } = Route.useLoaderData()

  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Receipt Not Found</h1>
          <p className="text-muted-foreground">
            This payment receipt doesn't exist or has been reversed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="py-6 border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 flex items-center justify-between">
          <LoonaBrand size="sm" animated={false} />
          <Badge variant="outline">Payment Receipt</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Stagger className="space-y-4">
          <StaggerItem>
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Amount Block */}
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-6 text-center">
                  <p className="text-xs font-semibold tracking-wider text-green-600 dark:text-green-400 uppercase mb-1">
                    Amount Paid
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrencyExact(receipt.amount)}
                  </p>
                </div>

                {/* Detail Rows */}
                <div className="divide-y">
                  <DetailRow
                    label="Date"
                    value={format(new Date(receipt.paidAt), "MMMM d, yyyy")}
                  />
                  <DetailRow
                    label="Method"
                    value={METHOD_LABELS[receipt.method] ?? receipt.method}
                  />
                  <DetailRow label="Borrower" value={receipt.borrowerName} />
                  {receipt.scheduleItem && (
                    <>
                      <DetailRow
                        label="Installment"
                        value={
                          receipt.scheduleItem.installmentLabel
                            ? `${receipt.scheduleItem.installmentLabel} — Due ${format(new Date(receipt.scheduleItem.dueDate), "MMM d, yyyy")}`
                            : `Due ${format(new Date(receipt.scheduleItem.dueDate), "MMM d, yyyy")}`
                        }
                      />
                      <DetailRow
                        label="Installment Amount"
                        value={formatCurrency(receipt.scheduleItem.amount)}
                      />
                    </>
                  )}
                  {receipt.notes && (
                    <DetailRow label="Notes" value={receipt.notes} />
                  )}
                  {receipt.agentName && (
                    <DetailRow label="Recorded by" value={receipt.agentName} />
                  )}
                </div>

                {/* Footer */}
                <div className="border-t pt-4 text-center text-xs text-muted-foreground space-y-0.5">
                  <p>Receipt ID: {receipt.id.slice(0, 8).toUpperCase()}</p>
                  <p>
                    Recorded{" "}
                    {format(
                      new Date(receipt.createdAt),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </p>
                  <p>Lender: {receipt.lenderName}</p>
                  <p className="pt-2 opacity-70">Powered by Loona</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
