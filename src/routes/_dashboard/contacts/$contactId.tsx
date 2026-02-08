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
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
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
} from "@phosphor-icons/react"

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

  // Edit form state - use empty strings for null contact case
  const [editName, setEditName] = useState(contact?.name || "")
  const [editPhone, setEditPhone] = useState(contact?.phone || "")
  const [editEmail, setEditEmail] = useState(contact?.email || "")
  const [editAddress, setEditAddress] = useState(contact?.address || "")
  const [editCity, setEditCity] = useState(contact?.city || "")
  const [editFacebook, setEditFacebook] = useState(contact?.facebookProfile || "")
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
        homeLink="/contacts"
        homeLinkLabel="Back to Contacts"
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
      router.navigate({ to: "/contacts" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete contact")
      setIsDeleting(false)
    }
  }

  const activeLoansCount = contact.loans.filter(l => l.status === "active").length

  return (
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Back link */}
          <Link to="/contacts" className="inline-flex items-center gap-2 text-sm text-blue-200/70 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Contacts
          </Link>

          {/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-7 w-7 text-primary-foreground" weight="bold" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{contact.name}</h1>
                  {activeLoansCount > 0 && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary-foreground border-0">
                      {activeLoansCount} active loan{activeLoansCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-blue-200/70">{contact.city || "Contact"}</p>
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
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <Card className="shadow-lg">
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
            {contact.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loans */}
        <Card className="lg:col-span-2 shadow-lg">
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
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
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
