import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getLoanApplications, reviewLoanApplication, revertLoanApplication } from "@/server/loan-applications"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useState } from "react"
import {
  ArrowLeft,
  ClipboardText,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Phone,
  EnvelopeSimple,
  MapPin,
  Spinner,
  LinkSimple,
  Copy,
  ArrowSquareOut,
  CalendarBlank,
  ArrowRight,
} from "@phosphor-icons/react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/loans/applications")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { id: string; role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) return { applications: [], unauthorized: true, userId: "" }
    const applications = await getLoanApplications()
    return { applications, unauthorized: false, userId: session.user.id }
  },
  component: ApplicationsPage,
})

function fmt(n: string | number) {
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function ApplicationsPage() {
  const { applications, unauthorized, userId } = Route.useLoaderData()
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [approveApp, setApproveApp] = useState<(typeof applications)[0] | null>(null)
  const [approvedResult, setApprovedResult] = useState<{ id: string; name: string; amount: string; app: (typeof applications)[0] } | null>(null)
  const [isUndoing, setIsUndoing] = useState(false)

  if (unauthorized) return <AccessDenied message="Only lenders can access applications." homeLink="/agent" homeLinkLabel="Go to Agent Portal" />

  const handleConfirmApprove = async () => {
    if (!approveApp) return
    setIsProcessing(approveApp.id)
    try {
      const result = await reviewLoanApplication({ data: { applicationId: approveApp.id, action: "approve" } })
      const appId = approveApp.id
      const appSnapshot = { ...approveApp }
      setApproveApp(null)
      if (result.applicant) {
        setApprovedResult({ id: appId, name: result.applicant.name, amount: result.applicant.requestedAmount ?? "0", app: appSnapshot })
      } else {
        toast.success("Application approved")
        router.invalidate()
      }
    } catch (err: any) { toast.error(err.message || "Failed to approve") }
    finally { setIsProcessing(null) }
  }

  const handleReject = async () => {
    if (!rejectId) return
    setIsProcessing(rejectId)
    try {
      await reviewLoanApplication({ data: { applicationId: rejectId, action: "reject", rejectionReason: rejectionReason.trim() || undefined } })
      toast.success("Application rejected"); setRejectId(null); setRejectionReason(""); router.invalidate()
    } catch (err: any) { toast.error(err.message || "Failed to reject") }
    finally { setIsProcessing(null) }
  }

  const pending = applications.filter((a) => a.status === "pending")
  const reviewed = applications.filter((a) => a.status !== "pending")

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link to="/loans" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Loans
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">Review incoming loan requests from borrowers</p>
      </div>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Application Overview */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Overview</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className={cn("text-lg font-bold", pending.length > 0 && "text-amber-600 dark:text-amber-400")}>{pending.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{applications.filter(a => a.status === "approved").length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                  <p className="text-lg font-bold">{applications.filter(a => a.status === "rejected").length}</p>
                </div>
              </div>
              {applications.length > 0 && (
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  {(() => {
                    const total = applications.length
                    const ap = applications.filter(a => a.status === "approved").length
                    const rj = applications.filter(a => a.status === "rejected").length
                    const pn = pending.length
                    return (
                      <>
                        {ap > 0 && <div className="h-full bg-green-500" style={{ width: `${(ap / total) * 100}%` }} />}
                        {pn > 0 && <div className="h-full bg-amber-400" style={{ width: `${(pn / total) * 100}%` }} />}
                        {rj > 0 && <div className="h-full bg-red-400" style={{ width: `${(rj / total) * 100}%` }} />}
                      </>
                    )
                  })()}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{applications.length} total applications</p>
            </div>
          </div>

          {/* Pending Applications */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Needs Review</h3>
                </div>
                {pending.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">{pending.length}</Badge>
                )}
              </div>
            </div>
            <div className="p-5 pt-0">
              {pending.length > 0 ? (
                <div className="space-y-0">
                  {pending.map((app) => (
                    <div key={app.id} className="py-3 border-b last:border-0 -mx-5 px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary font-bold text-xs">
                            {app.applicantName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{app.applicantName}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                              {app.applicantEmail && <span className="flex items-center gap-1"><EnvelopeSimple className="h-3 w-3" />{app.applicantEmail}</span>}
                              {app.applicantPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{app.applicantPhone}</span>}
                              {app.applicantCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{app.applicantCity}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              <span className="font-bold text-primary">{fmt(app.requestedAmount)}</span>
                              {app.requestedTermMonths && <span className="text-muted-foreground">{app.requestedTermMonths} mo</span>}
                              {app.purpose && <span className="text-muted-foreground truncate max-w-[150px]">{app.purpose}</span>}
                            </div>
                            {app.monthlyIncome && app.requestedTermMonths && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Income: {fmt(app.monthlyIncome)} · ~{Math.round((Number(app.requestedAmount) / app.requestedTermMonths / Number(app.monthlyIncome)) * 100)}% DTI
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <CalendarBlank className="h-3 w-3" />
                              {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0 mt-0.5">
                          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setApproveApp(app)} disabled={isProcessing === app.id}>
                            <CheckCircle className="h-3 w-3" weight="bold" />
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setRejectId(app.id); setRejectionReason("") }} disabled={isProcessing === app.id}>
                            <XCircle className="h-3 w-3" weight="bold" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No pending applications to review.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Share Link */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <LinkSimple className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Application Link</h3>
              </div>
            </div>
            <div className="p-5 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground">Share this link so borrowers can apply directly from their phone.</p>
              <Input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/apply/${userId}`}
                className="h-8 text-xs bg-muted/50 select-all font-mono"
                onFocus={(e) => e.target.select()}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 flex-1 h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/share/apply/${userId}`)
                    setCopied(true); toast.success("Link copied!"); setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <CheckCircle className="h-3.5 w-3.5" weight="bold" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
                <a
                  href={`/share/apply/${userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 rounded-md border flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Preview <ArrowSquareOut className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Reviewed History */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">History</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              {reviewed.length > 0 ? (
                <div className="space-y-0">
                  {reviewed
                    .sort((a, b) => new Date(b.reviewedAt ?? b.createdAt).getTime() - new Date(a.reviewedAt ?? a.createdAt).getTime())
                    .map((app) => {
                    const isApproved = app.status === "approved"
                    return (
                      <div key={app.id} className="flex items-center gap-3 py-3 border-b last:border-0 -mx-5 px-5 hover:bg-muted/50 transition-colors">
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                          isApproved ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                        )}>
                          {app.applicantName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{app.applicantName}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(app.requestedAmount)} · {app.reviewedAt ? format(new Date(app.reviewedAt), "MMM d") : ""}
                          </p>
                        </div>
                        <Badge className={cn("text-[10px] shrink-0", isApproved ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400")}>
                          {isApproved ? "Approved" : "Rejected"}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <ClipboardText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No reviewed applications yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Approve Confirmation Dialog */}
      <Dialog open={!!approveApp} onOpenChange={(open) => { if (!open) setApproveApp(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              Review the details below before approving.
            </DialogDescription>
          </DialogHeader>
          {approveApp && (
            <div className="space-y-3">
              {/* Applicant info */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {approveApp.applicantName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{approveApp.applicantName}</p>
                    {approveApp.applicantEmail && <p className="text-xs text-muted-foreground">{approveApp.applicantEmail}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {approveApp.applicantPhone && (
                    <>
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium text-right">{approveApp.applicantPhone}</span>
                    </>
                  )}
                  {approveApp.applicantAddress && (
                    <>
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right">{approveApp.applicantAddress}{approveApp.applicantCity ? `, ${approveApp.applicantCity}` : ""}</span>
                    </>
                  )}
                  {!approveApp.applicantAddress && approveApp.applicantCity && (
                    <>
                      <span className="text-muted-foreground">City</span>
                      <span className="font-medium text-right">{approveApp.applicantCity}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Loan request */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Request</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-primary text-right">{fmt(approveApp.requestedAmount)}</span>
                  {approveApp.requestedTermMonths && (
                    <>
                      <span className="text-muted-foreground">Term</span>
                      <span className="font-medium text-right">{approveApp.requestedTermMonths} months</span>
                    </>
                  )}
                  {approveApp.purpose && (
                    <>
                      <span className="text-muted-foreground">Purpose</span>
                      <span className="font-medium text-right">{approveApp.purpose}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Income & DTI */}
              {(approveApp.monthlyIncome || approveApp.otherIncome) && (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Income & Capacity</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    {approveApp.monthlyIncome && (
                      <>
                        <span className="text-muted-foreground">Monthly Income</span>
                        <span className="font-medium text-right">{fmt(approveApp.monthlyIncome)}</span>
                      </>
                    )}
                    {approveApp.otherIncome && (
                      <>
                        <span className="text-muted-foreground">Other Income</span>
                        <span className="font-medium text-right">{fmt(approveApp.otherIncome)}</span>
                      </>
                    )}
                    {approveApp.monthlyIncome && approveApp.requestedTermMonths && (
                      <>
                        <span className="text-muted-foreground">Est. DTI</span>
                        {(() => {
                          const grossIncome = Number(approveApp.monthlyIncome) + Number(approveApp.otherIncome || 0)
                          const monthlyPayment = Number(approveApp.requestedAmount) / approveApp.requestedTermMonths
                          const dti = Math.round((monthlyPayment / grossIncome) * 100)
                          return (
                            <span className={cn("font-bold text-right", dti > 40 ? "text-red-600 dark:text-red-400" : dti > 25 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400")}>
                              {dti}%
                            </span>
                          )
                        })()}
                      </>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">Approving will let you create the loan in the wizard with final terms.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveApp(null)} disabled={isProcessing === approveApp?.id}>Cancel</Button>
            <Button onClick={handleConfirmApprove} disabled={isProcessing === approveApp?.id} className="gap-1.5">
              {isProcessing === approveApp?.id ? <Spinner className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" weight="bold" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approved Success Dialog */}
      <Dialog open={!!approvedResult} onOpenChange={(open) => {
        if (!open) {
          setApprovedResult(null)
          router.invalidate()
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center text-center py-4">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" weight="bold" />
            </div>
            <DialogTitle className="text-lg">Application Approved!</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>{approvedResult?.name}</strong>'s application for {approvedResult ? fmt(approvedResult.amount) : ""} has been approved.
            </p>
          </div>
          <DialogFooter className="sm:flex-col gap-2">
            <Button
              className="w-full gap-1.5"
              onClick={() => {
                if (!approvedResult) return
                const app = approvedResult.app
                setApprovedResult(null)
                router.navigate({
                  to: "/loans/new-wizard",
                  search: {
                    fromApplication: JSON.stringify({
                      name: app.applicantName, phone: app.applicantPhone, email: app.applicantEmail,
                      address: app.applicantAddress, city: app.applicantCity, principal: app.requestedAmount,
                      termMonths: app.requestedTermMonths, purpose: app.purpose,
                      income: app.monthlyIncome, otherIncome: app.otherIncome,
                    }),
                  },
                })
              }}
            >
              Create Loan Now <ArrowRight className="h-4 w-4" weight="bold" />
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => { setApprovedResult(null); router.invalidate() }}>
              I'll do it later
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-1 disabled:opacity-50"
              disabled={isUndoing}
              onClick={async () => {
                if (!approvedResult) return
                setIsUndoing(true)
                try {
                  await revertLoanApplication({ data: approvedResult.id })
                  toast.success("Approval reverted — application is back to pending")
                  setApprovedResult(null)
                  router.invalidate()
                } catch (err: any) {
                  toast.error(err.message || "Failed to undo")
                } finally {
                  setIsUndoing(false)
                }
              }}
            >
              {isUndoing ? "Undoing..." : "Undo approval"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) setRejectId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Provide an optional reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Insufficient income for requested amount" rows={3} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing === rejectId}>
              {isProcessing === rejectId ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
  )
}
