import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { getCashTransactions, addCashTransaction, deleteCashTransaction } from "@/server/lender-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  Spinner,
  Receipt,
  TrendUp,
  TrendDown,
  CurrencyCircleDollar,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/settings/cash-transactions")({
  loader: async () => {
    const transactions = await getCashTransactions()
    return { transactions }
  },
  component: CashTransactionsPage,
})

type Tx = Awaited<ReturnType<typeof getCashTransactions>>[0]

function CashTransactionsPage() {
  const { transactions: initial } = Route.useLoaderData()
  const [transactions, setTransactions] = useState<Tx[]>(initial)

  // Add dialog
  const [showAdd, setShowAdd] = useState(false)
  const [txType, setTxType] = useState<"deposit" | "expense">("expense")
  const [txAmount, setTxAmount] = useState("")
  const [txDescription, setTxDescription] = useState("")
  const [txDate, setTxDate] = useState<Date>(new Date())
  const [isAdding, setIsAdding] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filter
  const [filter, setFilter] = useState<"all" | "deposit" | "expense">("all")

  const totalDeposits = transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + parseFloat(t.amount), 0)
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0)
  const net = totalDeposits - totalExpenses

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.type === filter)

  const handleAdd = async () => {
    const amount = parseFloat(txAmount)
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!txDescription.trim()) { toast.error("Enter a description"); return }
    setIsAdding(true)
    try {
      const row = await addCashTransaction({
        data: {
          type: txType,
          amount,
          description: txDescription.trim(),
          transactionDate: format(txDate, "yyyy-MM-dd"),
        },
      })
      setTransactions((prev) => [row, ...prev])
      setTxAmount(""); setTxDescription(""); setTxDate(new Date())
      setShowAdd(false)
      toast.success(txType === "deposit" ? "Deposit recorded" : "Expense recorded")
    } catch {
      toast.error("Failed to save transaction")
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteCashTransaction({ data: id })
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error("Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  const openAdd = (type: "deposit" | "expense") => {
    setTxType(type)
    setTxAmount(""); setTxDescription(""); setTxDate(new Date())
    setShowAdd(true)
  }

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <StaggerItem>
        <div className="flex items-center gap-3 mb-1">
          <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Link>
        </div>
        <div className="flex items-start justify-between gap-3 mt-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cash Transactions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Record deposits and expenses that affect your available cash position</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => openAdd("expense")}>
              <ArrowDown className="h-4 w-4 text-red-500" />
              Expense
            </Button>
            <Button size="sm" className="gap-1.5 h-9" onClick={() => openAdd("deposit")}>
              <ArrowUp className="h-4 w-4" />
              Deposit
            </Button>
          </div>
        </div>
      </StaggerItem>

      {/* KPI strip */}
      <StaggerItem>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendUp className="h-3.5 w-3.5 text-emerald-500" />
              Total Deposits
            </div>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(totalDeposits)}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendDown className="h-3.5 w-3.5 text-red-500" />
              Total Expenses
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(totalExpenses)}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CurrencyCircleDollar className="h-3.5 w-3.5" />
              Net
            </div>
            <p className={cn("text-lg font-bold tabular-nums", net >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400")}>
              {net >= 0 ? "+" : ""}{fmt(net)}
            </p>
          </div>
        </div>
      </StaggerItem>

      {/* Filter pills */}
      {transactions.length > 0 && (
        <div className="flex items-center gap-1.5">
          {(["all", "deposit", "expense"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {f === "deposit" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              {f === "expense" && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
              {f === "all" ? "All" : f === "deposit" ? "Deposits" : "Expenses"}
              <span className="text-muted-foreground/70">
                ({f === "all" ? transactions.length : transactions.filter((t) => t.type === f).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Transaction list */}
      <StaggerItem>
        {filtered.length > 0 ? (
          <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
            {/* Desktop header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] gap-3 px-4 py-2.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <span>Description</span>
              <span className="text-center">Type</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {filtered.map((tx) => (
              <div key={tx.id} className="border-b last:border-0">
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] gap-3 px-4 py-3 items-center">
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.transactionDate), "MMMM d, yyyy")}</p>
                  </div>
                  <div className="flex justify-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] gap-1 h-5",
                        tx.type === "deposit"
                          ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                          : "border-red-300 text-red-700 dark:text-red-400"
                      )}
                    >
                      {tx.type === "deposit"
                        ? <ArrowUp className="h-2.5 w-2.5" weight="bold" />
                        : <ArrowDown className="h-2.5 w-2.5" weight="bold" />}
                      {tx.type === "deposit" ? "Deposit" : "Expense"}
                    </Badge>
                  </div>
                  <p className={cn(
                    "text-sm font-semibold text-right tabular-nums",
                    tx.type === "deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {tx.type === "deposit" ? "+" : "−"}{fmt(parseFloat(tx.amount))}
                  </p>
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      {deletingId === tx.id
                        ? <Spinner className="h-3.5 w-3.5 animate-spin" />
                        : <Trash className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Mobile row */}
                <div className="sm:hidden px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      tx.type === "deposit" ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-red-100 dark:bg-red-950/40"
                    )}>
                      {tx.type === "deposit"
                        ? <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" weight="bold" />
                        : <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" weight="bold" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.transactionDate), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={cn(
                      "text-sm font-semibold tabular-nums",
                      tx.type === "deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {tx.type === "deposit" ? "+" : "−"}{fmt(parseFloat(tx.amount))}
                    </p>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      {deletingId === tx.id
                        ? <Spinner className="h-3.5 w-3.5 animate-spin" />
                        : <Trash className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border shadow-sm bg-card flex flex-col items-center justify-center py-12">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium mb-1">No transactions yet</p>
            <p className="text-xs text-muted-foreground mb-4">Record your first deposit or expense</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openAdd("expense")} className="gap-1.5">
                <ArrowDown className="h-4 w-4 text-red-500" />
                Expense
              </Button>
              <Button size="sm" onClick={() => openAdd("deposit")} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Deposit
              </Button>
            </div>
          </div>
        )}
      </StaggerItem>

      {/* Add Transaction Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{txType === "deposit" ? "Record Deposit" : "Record Expense"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Type toggle */}
            <div className="flex rounded-lg border p-1 w-fit">
              <button
                type="button"
                onClick={() => setTxType("expense")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  txType === "expense" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Expense
              </button>
              <button
                type="button"
                onClick={() => setTxType("deposit")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  txType === "deposit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Deposit
              </button>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <CurrencyInput
                value={txAmount}
                onValueChange={setTxAmount}
                placeholder="0"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
                placeholder={txType === "expense" ? "e.g. GoDaddy renewal, Office supplies" : "e.g. Capital top-up, Reinvestment"}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker value={txDate} onChange={(d) => d && setTxDate(d)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={isAdding}>Cancel</Button>
            <Button onClick={handleAdd} disabled={isAdding} className="gap-2">
              {isAdding ? <Spinner className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
  )
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
