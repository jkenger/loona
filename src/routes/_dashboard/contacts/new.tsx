import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { createContact } from "@/server/contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PhoneInput } from "@/components/ui/phone-input"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Spinner, User, Envelope, MapPin, FacebookLogo } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/contacts/new")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    return { unauthorized: !hasRole(session.user.role, ROLES.LENDER) }
  },
  component: NewContactPage,
})

function NewContactPage() {
  const router = useRouter()
  const { unauthorized } = Route.useLoaderData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [phone, setPhone] = useState("")

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can create contacts."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
      />
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      phone: phone || undefined,
      email: formData.get("email") as string || undefined,
      address: formData.get("address") as string || undefined,
      city: formData.get("city") as string || undefined,
      facebookProfile: formData.get("facebookProfile") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    }

    try {
      const contact = await createContact({ data })
      toast.success("Contact created successfully")
      router.navigate({ to: "/contacts/$contactId", params: { contactId: contact.id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create contact")
      setError(err instanceof Error ? err.message : "Failed to create contact")
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Compact Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 pb-12">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/contacts" className="text-sm text-blue-200/70 hover:text-white transition-colors">
              Contacts
            </Link>
            <span className="text-blue-300/40">/</span>
            <h1 className="text-lg font-semibold">New Contact</h1>
          </div>
        </div>
      </div>

      {/* Form - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-6 pb-8">
      <Card className="shadow-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Enter the borrower's details</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name - Full Width */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  placeholder="Juan dela Cruz"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Phone & Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onValueChange={setPhone}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="juan@example.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Address & City */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    name="address"
                    placeholder="123 Main St, Brgy. Sample"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Manila"
                />
              </div>
            </div>

            {/* Facebook */}
            <div className="space-y-2">
              <Label htmlFor="facebookProfile">Facebook Profile</Label>
              <div className="relative">
                <FacebookLogo className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="facebookProfile"
                  name="facebookProfile"
                  placeholder="facebook.com/username"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional information about this contact..."
                rows={3}
              />
            </div>

            {error && (
              <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link to="/contacts">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    Create Contact
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
