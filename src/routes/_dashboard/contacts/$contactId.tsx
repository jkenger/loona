import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { getContact, updateContact, deleteContact } from "@/server/contacts"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CurrencyInput } from "@/components/ui/currency-input"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { useRef, useEffect, useCallback } from "react"
import {
  ArrowLeft,
  Phone,
  Envelope,
  MapPin,
  FacebookLogo,
  CurrencyCircleDollar,
  Plus,
  ArrowRight,
  PencilSimple,
  Trash,
  Spinner,
  User,
  Copy,
  Check,
  ChatText,
  NoteBlank,
  UserCircle,
  ArrowSquareOut,
  Lock,
  Wallet,
} from "@phosphor-icons/react"
import { LendingTip } from "@/components/lending-tip"

export const Route = createFileRoute("/_dashboard/contacts/$contactId")({
  loader: async ({ params, context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { contact: null, unauthorized: true }
    }

    try {
      const contact = await getContact({ data: params.contactId })
      // Only allow if user is the lender (not agent viewing via assignment)
      if (!contact.isLender) {
        return { contact: null, unauthorized: true }
      }
      return { contact, unauthorized: false }
    } catch {
      return { contact: null, unauthorized: false }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: ContactDetailPage,
})

function ContactDetailPage() {
  const { contact, unauthorized } = Route.useLoaderData()
  const router = useRouter()

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)

  // Inline notes
  const [inlineNotes, setInlineNotes] = useState(contact?.notes || "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inline income
  const [editingIncome, setEditingIncome] = useState(false)
  const [inlineIncome, setInlineIncome] = useState(contact?.income || "")
  const [inlineOtherIncome, setInlineOtherIncome] = useState(contact?.otherIncome || "")
  const [savingIncome, setSavingIncome] = useState(false)
  const [incomeSaved, setIncomeSaved] = useState(false)

  const saveIncome = useCallback(async () => {
    if (!contact) return
    // Skip save if neither value changed
    if (inlineIncome === (contact.income || "") && inlineOtherIncome === (contact.otherIncome || "")) {
      setEditingIncome(false)
      return
    }
    setSavingIncome(true)
    try {
      await updateContact({
        data: {
          id: contact.id,
          name: contact.name,
          income: inlineIncome || undefined,
          otherIncome: inlineOtherIncome || undefined,
        },
      })
      setIncomeSaved(true)
      setTimeout(() => setIncomeSaved(false), 2000)
      router.invalidate()
    } catch {
      toast.error("Failed to save income")
    } finally {
      setSavingIncome(false)
      setEditingIncome(false)
    }
  }, [contact, router, inlineIncome, inlineOtherIncome])

  const saveNotes = useCallback(async (value: string) => {
    if (!contact || value === (contact.notes || "")) return
    setSavingNotes(true)
    try {
      await updateContact({
        data: {
          id: contact.id,
          name: contact.name,
          notes: value || undefined,
        },
      })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch {
      toast.error("Failed to save notes")
    } finally {
      setSavingNotes(false)
    }
  }, [contact])

  // Auto-save notes after 1s of inactivity
  useEffect(() => {
    if (!contact || inlineNotes === (contact.notes || "")) return
    if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current)
    notesTimeoutRef.current = setTimeout(() => saveNotes(inlineNotes), 1000)
    return () => {
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current)
    }
  }, [inlineNotes, contact, saveNotes])

  // Edit form state - use empty strings for null contact case
  const [editName, setEditName] = useState(contact?.name || "")
  const [editPhone, setEditPhone] = useState(contact?.phone || "")
  const [editEmail, setEditEmail] = useState(contact?.email || "")
  const [editAddress, setEditAddress] = useState(contact?.address || "")
  const [editCity, setEditCity] = useState(contact?.city || "")
  const [editFacebook, setEditFacebook] = useState(contact?.facebookProfile || "")
  const [editIncome, setEditIncome] = useState(contact?.income || "")
  const [editOtherIncome, setEditOtherIncome] = useState(contact?.otherIncome || "")
  const [editNotes, setEditNotes] = useState(contact?.notes || "")

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access the contact details page."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  if (!contact) {
    return (
      <AccessDenied
        title="Contact Not Found"
        message="This contact doesn't exist or you don't have access to it."
        homeLink="/loans"
        homeLinkLabel="Back to Loans"
      />
    )
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)

    try {
      await updateContact({
        data: {
          id: contact.id,
          name: editName,
          phone: editPhone || undefined,
          email: editEmail || undefined,
          address: editAddress || undefined,
          city: editCity || undefined,
          facebookProfile: editFacebook || undefined,
          income: editIncome || undefined,
          otherIncome: editOtherIncome || undefined,
          notes: editNotes || undefined,
        },
      })
      toast.success("Contact updated successfully")
      setShowEditDialog(false)
      router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update contact")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      await deleteContact({ data: contact.id })
      toast.success("Contact deleted")
      router.navigate({ to: "/loans" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contact")
      setIsDeleting(false)
    }
  }

  const activeLoansCount = contact.loans.filter(l => l.status === "active").length
  const completedLoansCount = contact.loans.filter(l => l.status === "completed").length

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/borrower/${contact.id}`
    : `/share/borrower/${contact.id}`

  const shareMessage = `Hi ${contact.name}! Here's your payment history summary with me: ${shareUrl}`

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    toast.success("Link copied to clipboard")
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(shareMessage)
    setCopiedMessage(true)
    toast.success("Message copied to clipboard")
    setTimeout(() => setCopiedMessage(false), 2000)
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back link */}
      <Link to="/loans" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Loans
      </Link>

      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{contact.name}</h1>
              {activeLoansCount > 0 && (
                <Badge variant="secondary">
                  {activeLoansCount} active loan{activeLoansCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{contact.city || "Contact"}</p>
          </div>
        </div>
        {contact.isLender && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(true)} className="gap-2">
              <PencilSimple className="h-4 w-4" weight="bold" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteDialog(true)} className="gap-2">
              <Trash className="h-4 w-4" weight="bold" />
              Delete
            </Button>
            <Link to="/loans/new-wizard" search={{ contactId: contact.id }}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" weight="bold" />
                New Loan
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Envelope className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.address}</span>
                </div>
              )}
              {contact.facebookProfile && (
                <div className="flex items-center gap-3">
                  <FacebookLogo className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={contact.facebookProfile.startsWith("http") ? contact.facebookProfile : `https://${contact.facebookProfile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Facebook Profile
                  </a>
                </div>
              )}

              {/* Inline Income */}
              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                {editingIncome ? (
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Basic Pay</span>
                        <CurrencyInput
                          autoFocus
                          value={inlineIncome}
                          onValueChange={setInlineIncome}
                          placeholder="0"
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              saveIncome()
                            }
                            if (e.key === "Escape") {
                              setInlineIncome(contact.income || "")
                              setInlineOtherIncome(contact.otherIncome || "")
                              setEditingIncome(false)
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Other Income</span>
                        <CurrencyInput
                          value={inlineOtherIncome}
                          onValueChange={setInlineOtherIncome}
                          placeholder="0"
                          className="h-8 text-sm"
                          onBlur={() => saveIncome()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              saveIncome()
                            }
                            if (e.key === "Escape") {
                              setInlineIncome(contact.income || "")
                              setInlineOtherIncome(contact.otherIncome || "")
                              setEditingIncome(false)
                            }
                          }}
                        />
                      </div>
                    </div>
                    {(parseFloat(inlineIncome) > 0 || parseFloat(inlineOtherIncome) > 0) && (
                      <p className="text-xs text-muted-foreground">
                        Total: {formatCurrency(String((parseFloat(inlineIncome) || 0) + (parseFloat(inlineOtherIncome) || 0)))}/mo
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className={contact.income ? "" : "text-muted-foreground"}>
                      {(() => {
                        const basic = parseFloat(contact.income || "0")
                        const other = parseFloat(contact.otherIncome || "0")
                        if (!basic && !other) return "Add monthly income"
                        if (other > 0) {
                          return `${formatCurrency(String(basic))} + ${formatCurrency(String(other))} = ${formatCurrency(String(basic + other))}/mo`
                        }
                        return `${formatCurrency(contact.income!)}/mo`
                      })()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {savingIncome && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Spinner className="h-3 w-3 animate-spin" />
                        </span>
                      )}
                      {incomeSaved && !savingIncome && (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Check className="h-3 w-3" weight="bold" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingIncome(true)}
                        className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <PencilSimple className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inline Notes */}
          <Card className="shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <NoteBlank className="h-4 w-4" />
                  Notes
                </CardTitle>
                {savingNotes && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Spinner className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {notesSaved && !savingNotes && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" weight="bold" />
                    Saved
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Textarea
                placeholder="Add notes about this borrower..."
                value={inlineNotes}
                onChange={(e) => setInlineNotes(e.target.value)}
                onBlur={() => saveNotes(inlineNotes)}
                rows={4}
                className="resize-none text-sm"
              />
            </CardContent>
          </Card>

          {/* Borrower Profile */}
          <Card className="shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Borrower Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {completedLoansCount > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Share {contact.name}'s credit standing summary.
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm select-all min-w-0"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button size="sm" variant="outline" onClick={handleCopyLink} className="gap-2 shrink-0">
                      {copiedLink ? (
                        <Check className="h-4 w-4" weight="bold" />
                      ) : (
                        <Copy className="h-4 w-4" weight="bold" />
                      )}
                      {copiedLink ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyMessage} className="gap-2 w-full">
                    {copiedMessage ? (
                      <Check className="h-4 w-4" weight="bold" />
                    ) : (
                      <ChatText className="h-4 w-4" weight="bold" />
                    )}
                    {copiedMessage ? "Copied" : "Copy with Message"}
                  </Button>
                  <Link
                    to="/share/borrower/$contactId"
                    params={{ contactId: contact.id }}
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    Preview
                    <ArrowSquareOut className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Complete a loan to unlock the borrower profile
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Loans */}
        <Card className="lg:col-span-2 shadow-sm rounded-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle>Loans</CardTitle>
            <CardDescription>
              {contact.loans.length} loan{contact.loans.length !== 1 ? "s" : ""} total
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {contact.loans.length > 0 ? (
              <div className="space-y-4">
                {contact.loans.map((loan) => (
                  <Link
                    key={loan.id}
                    to="/loans/$loanId"
                    params={{ loanId: loan.id }}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded border hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CurrencyCircleDollar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {formatCurrency(loan.principal)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {loan.interestRate}% for {loan.termMonths} months
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge
                            variant={loan.status === "active" ? "secondary" : "outline"}
                          >
                            {loan.status.replace("_", " ")}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(loan.remainingBalance)} remaining
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
                {contact.loans.filter((l: any) => l.status === "defaulted").length >= 2 && (
                  <LendingTip tip="Repeated defaults may signal over-lending, not bad character." className="justify-center mt-4" />
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CurrencyCircleDollar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {contact.isLender ? "No loans yet" : "No assigned loans for this contact"}
                </p>
                {contact.isLender && (
                  <Link to="/loans/new-wizard" search={{ contactId: contact.id }}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Loan
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <PhoneInput
                id="phone"
                value={editPhone}
                onValueChange={setEditPhone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook Profile</Label>
              <Input
                id="facebook"
                value={editFacebook}
                onChange={(e) => setEditFacebook(e.target.value)}
                placeholder="facebook.com/username"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Income</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Basic Pay</span>
                  <CurrencyInput
                    id="income"
                    value={editIncome}
                    onValueChange={setEditIncome}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Other Income</span>
                  <CurrencyInput
                    id="otherIncome"
                    value={editOtherIncome}
                    onValueChange={setEditOtherIncome}
                    placeholder="0"
                  />
                </div>
              </div>
              {(parseFloat(editIncome) > 0 || parseFloat(editOtherIncome) > 0) && (
                <p className="text-xs text-muted-foreground">
                  Total: {formatCurrency(String((parseFloat(editIncome) || 0) + (parseFloat(editOtherIncome) || 0)))}/mo
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {contact.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {contact.loans.length > 0 && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
              This contact has {contact.loans.length} loan{contact.loans.length !== 1 ? "s" : ""}.
              You must delete all loans first.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || contact.loans.length > 0}
            >
              {isDeleting ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
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
