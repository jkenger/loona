import { createFileRoute, useRouter, Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useSession, changePassword, updateUserName } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  User,
  Envelope,
  Lock,
  Spinner,
  Check,
  Eye,
  EyeSlash,
  PencilSimple,
  Warning,
  ArrowSquareOut,
  Wallet,
  GlobeSimple,
  FacebookLogo,
  LinkSimple,
  Copy,
  GearSix,
  Bell,
} from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { getLenderSettings, saveLenderSettings } from "@/server/lender-settings"
import { getLenderProfileLinks, saveLenderProfileLinks } from "@/server/lender-profile"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Stagger, StaggerItem } from "@/components/ui/stagger"

export const Route = createFileRoute("/_dashboard/settings/")({
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    const isLender = hasRole(session.user.role, ROLES.LENDER)
    const [lenderConfig, profileLinks] = isLender
      ? await Promise.all([getLenderSettings(), getLenderProfileLinks()])
      : [null, null]
    return { lenderConfig, profileLinks }
  },
  pendingComponent: SettingsSkeleton,
  component: SettingsPage,
})

function SettingsSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { lenderConfig, profileLinks } = Route.useLoaderData()

  // Profile edit state
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  // Capital state
  const [isEditingCapital, setIsEditingCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState("")
  const [isSavingCapital, setIsSavingCapital] = useState(false)
  const [currentCapital, setCurrentCapital] = useState(lenderConfig?.initialCapital ?? 0)

  // Notification toggles
  const [paymentReceiptsEnabled, setPaymentReceiptsEnabled] = useState(lenderConfig?.paymentReceiptsEnabled ?? false)
  const [overdueAlertsEnabled, setOverdueAlertsEnabled] = useState(lenderConfig?.overdueAlertsEnabled ?? false)
  const [overdueAlertDaysBefore, setOverdueAlertDaysBefore] = useState(String(lenderConfig?.overdueAlertDaysBefore ?? 3))
  const [overdueAlertDaysAfter, setOverdueAlertDaysAfter] = useState(String(lenderConfig?.overdueAlertDaysAfter ?? 3))
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  // Profile links state
  const [isEditingWebsite, setIsEditingWebsite] = useState(false)
  const [websiteInput, setWebsiteInput] = useState("")
  const [isSavingWebsite, setIsSavingWebsite] = useState(false)
  const [currentWebsite, setCurrentWebsite] = useState(profileLinks?.websiteUrl ?? "")

  const [isEditingFacebook, setIsEditingFacebook] = useState(false)
  const [facebookInput, setFacebookInput] = useState("")
  const [isSavingFacebook, setIsSavingFacebook] = useState(false)
  const [currentFacebook, setCurrentFacebook] = useState(profileLinks?.facebookUrl ?? "")

  const user = session?.user

  const handleEditName = () => {
    setNewName(user?.name || "")
    setIsEditingName(true)
  }

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      toast.error("Name must be at least 2 characters")
      return
    }

    setIsSavingName(true)
    try {
      const result = await updateUserName({ name: newName.trim() })
      if (result.error) {
        toast.error(result.error.message)
      } else {
        toast.success("Name updated successfully")
        setIsEditingName(false)
        router.invalidate()
      }
    } catch {
      toast.error("Failed to update name")
    } finally {
      setIsSavingName(false)
    }
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setNewName("")
  }

  const openPasswordDialog = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError("")
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowPasswordDialog(true)
  }

  const handleChangePassword = async () => {
    setPasswordError("")

    if (!currentPassword) {
      setPasswordError("Current password is required")
      return
    }
    if (!newPassword) {
      setPasswordError("New password is required")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password")
      return
    }

    setIsChangingPassword(true)
    try {
      const result = await changePassword({ currentPassword, newPassword })
      if (result.error) {
        setPasswordError(result.error.message)
      } else {
        toast.success("Password changed successfully")
        setShowPasswordDialog(false)
      }
    } catch {
      setPasswordError("Failed to change password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleEditCapital = () => {
    setCapitalInput(currentCapital > 0 ? currentCapital.toString() : "")
    setIsEditingCapital(true)
  }

  const handleSaveCapital = async () => {
    const amount = parseFloat(capitalInput)
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount")
      return
    }
    setIsSavingCapital(true)
    try {
      await saveLenderSettings({ data: buildNotificationPayload({ initialCapital: amount }) })
      setCurrentCapital(amount)
      setIsEditingCapital(false)
      toast.success("Starting capital updated")
    } catch {
      toast.error("Failed to save capital")
    } finally {
      setIsSavingCapital(false)
    }
  }

  const buildNotificationPayload = (overrides: Partial<{
    initialCapital: number
    paymentReceiptsEnabled: boolean
    overdueAlertsEnabled: boolean
    overdueAlertDaysBefore: number
    overdueAlertDaysAfter: number
  }>) => ({
    initialCapital: currentCapital,
    paymentReceiptsEnabled,
    overdueAlertsEnabled,
    overdueAlertDaysBefore: parseInt(overdueAlertDaysBefore) || 3,
    overdueAlertDaysAfter: parseInt(overdueAlertDaysAfter) || 3,
    ...overrides,
  })

  const handleToggleNotification = async (
    field: "paymentReceiptsEnabled" | "overdueAlertsEnabled",
    value: boolean
  ) => {
    if (field === "paymentReceiptsEnabled") setPaymentReceiptsEnabled(value)
    else setOverdueAlertsEnabled(value)

    setIsSavingNotifications(true)
    try {
      await saveLenderSettings({ data: buildNotificationPayload({ [field]: value }) })
    } catch {
      if (field === "paymentReceiptsEnabled") setPaymentReceiptsEnabled(!value)
      else setOverdueAlertsEnabled(!value)
      toast.error("Failed to save setting")
    } finally {
      setIsSavingNotifications(false)
    }
  }

  const handleSaveAlertDays = async () => {
    const before = parseInt(overdueAlertDaysBefore)
    const after = parseInt(overdueAlertDaysAfter)
    if (isNaN(before) || before < 1 || before > 30 || isNaN(after) || after < 1 || after > 30) {
      toast.error("Days must be between 1 and 30")
      return
    }
    setIsSavingNotifications(true)
    try {
      await saveLenderSettings({ data: buildNotificationPayload({ overdueAlertDaysBefore: before, overdueAlertDaysAfter: after }) })
      toast.success("Alert schedule saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSavingNotifications(false)
    }
  }

  const handleEditWebsite = () => {
    setWebsiteInput(currentWebsite || "")
    setIsEditingWebsite(true)
  }

  const handleSaveWebsite = async () => {
    if (websiteInput && !websiteInput.startsWith("http")) {
      toast.error("Please enter a valid URL starting with http:// or https://")
      return
    }
    setIsSavingWebsite(true)
    try {
      await saveLenderProfileLinks({ data: { websiteUrl: websiteInput || null, facebookUrl: currentFacebook || null } })
      setCurrentWebsite(websiteInput || "")
      setIsEditingWebsite(false)
      toast.success("Website URL updated")
    } catch {
      toast.error("Failed to save URL")
    } finally {
      setIsSavingWebsite(false)
    }
  }

  const handleEditFacebook = () => {
    setFacebookInput(currentFacebook || "")
    setIsEditingFacebook(true)
  }

  const handleSaveFacebook = async () => {
    if (facebookInput && !facebookInput.startsWith("http")) {
      toast.error("Please enter a valid URL starting with http:// or https://")
      return
    }
    setIsSavingFacebook(true)
    try {
      await saveLenderProfileLinks({ data: { websiteUrl: currentWebsite || null, facebookUrl: facebookInput || null } })
      setCurrentFacebook(facebookInput || "")
      setIsEditingFacebook(false)
      toast.success("Facebook URL updated")
    } catch {
      toast.error("Failed to save URL")
    } finally {
      setIsSavingFacebook(false)
    }
  }

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/share/lender/${user?.id}`
    navigator.clipboard.writeText(shareUrl)
    toast.success("Share link copied to clipboard")
  }

  const isLender = hasRole(user?.role ?? null, ROLES.LENDER)

  if (!user) {
    return null
  }

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column — Account */}
        <div className="lg:col-span-3 space-y-5">
          {/* Profile */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Profile</h3>
              </div>
            </div>
            <div className="p-5 pt-0 space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label>Name</Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Your name"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={isSavingName}
                    >
                      {isSavingName ? (
                        <Spinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEditName}
                      disabled={isSavingName}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                      <span className="font-medium">{user.name || "—"}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEditName}
                      className="gap-1"
                    >
                      <PencilSimple className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-3 p-3 rounded border bg-muted/30">
                  <Envelope className="h-5 w-5 text-muted-foreground" />
                  <span>{user.email}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              {/* Account created */}
              <div className="text-sm text-muted-foreground pt-2 border-t">
                Account created: {user.createdAt ? format(new Date(user.createdAt), "MMMM d, yyyy") : "—"}
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Security</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">
                      Last changed: Unknown
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openPasswordDialog}>
                  Change Password
                </Button>
              </div>
            </div>
          </div>

          {/* Penalty Rules */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <Warning className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Penalty Rules</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                to="/settings/penalty-settings"
                className="group flex items-center justify-between p-3 rounded border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">Late Fees & Penalties</p>
                  <p className="text-xs text-muted-foreground">
                    Set up late fees, daily penalty interest, and caps
                  </p>
                </div>
                <ArrowSquareOut className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column — Lender Settings */}
        <div className="lg:col-span-2 space-y-5">
          {/* Public Profile */}
          {isLender && (
            <div className="rounded-xl border shadow-sm">
              <div className="p-5 pb-3">
                <div className="flex items-center gap-2">
                  <LinkSimple className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Public Profile</h3>
                </div>
              </div>
              <div className="p-5 pt-0 space-y-4">
                {/* Website URL */}
                <div className="space-y-2">
                  <Label className="text-xs">Website URL</Label>
                  {isEditingWebsite ? (
                    <div className="flex gap-2">
                      <Input
                        value={websiteInput}
                        onChange={(e) => setWebsiteInput(e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveWebsite()
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveWebsite}
                        disabled={isSavingWebsite}
                      >
                        {isSavingWebsite ? (
                          <Spinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingWebsite(false)}
                        disabled={isSavingWebsite}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <GlobeSimple className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate text-sm">
                          {currentWebsite || "Not set"}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditWebsite}
                        className="gap-1 shrink-0"
                      >
                        <PencilSimple className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                {/* Facebook URL */}
                <div className="space-y-2">
                  <Label className="text-xs">Facebook URL</Label>
                  {isEditingFacebook ? (
                    <div className="flex gap-2">
                      <Input
                        value={facebookInput}
                        onChange={(e) => setFacebookInput(e.target.value)}
                        placeholder="https://facebook.com/your-page"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveFacebook()
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveFacebook}
                        disabled={isSavingFacebook}
                      >
                        {isSavingFacebook ? (
                          <Spinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingFacebook(false)}
                        disabled={isSavingFacebook}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <FacebookLogo className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate text-sm">
                          {currentFacebook || "Not set"}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditFacebook}
                        className="gap-1 shrink-0"
                      >
                        <PencilSimple className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                {/* Share Link */}
                <div className="space-y-2">
                  <Label className="text-xs">Share Link</Label>
                  <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <LinkSimple className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate text-muted-foreground">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/share/lender/${user?.id}`
                          : `/share/lender/${user?.id}`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyShareLink}
                      className="gap-1 shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with potential borrowers to show your lender profile.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Financial Settings */}
          {isLender && (
            <div className="rounded-xl border shadow-sm">
              <div className="p-5 pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Financial</h3>
                </div>
              </div>
              <div className="p-5 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs">Starting Capital</Label>
                  {isEditingCapital ? (
                    <div className="flex gap-2">
                      <CurrencyInput
                        value={capitalInput}
                        onValueChange={setCapitalInput}
                        placeholder="500,000"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCapital()
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveCapital}
                        disabled={isSavingCapital}
                      >
                        {isSavingCapital ? (
                          <Spinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingCapital(false)}
                        disabled={isSavingCapital}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {currentCapital > 0
                            ? new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(currentCapital)
                            : "Not set"}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditCapital}
                        className="gap-1"
                      >
                        <PencilSimple className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This is used to calculate your cash position on the dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {isLender && (
            <div className="rounded-xl border shadow-sm">
              <div className="p-5 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Notifications</h3>
                </div>
              </div>
              <div className="p-5 pt-0 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Payment Receipts</p>
                    <p className="text-xs text-muted-foreground">
                      Email borrowers a receipt after each payment
                    </p>
                  </div>
                  <Switch
                    checked={paymentReceiptsEnabled}
                    onCheckedChange={(v) => handleToggleNotification("paymentReceiptsEnabled", v)}
                    disabled={isSavingNotifications}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Overdue Alerts</p>
                      <p className="text-xs text-muted-foreground">
                        Remind borrowers before, on, and after due date
                      </p>
                    </div>
                    <Switch
                      checked={overdueAlertsEnabled}
                      onCheckedChange={(v) => handleToggleNotification("overdueAlertsEnabled", v)}
                      disabled={isSavingNotifications}
                    />
                  </div>
                  {overdueAlertsEnabled && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Days before due</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={overdueAlertDaysBefore}
                            onChange={(e) => setOverdueAlertDaysBefore(e.target.value)}
                            onBlur={handleSaveAlertDays}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Days after due</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={overdueAlertDaysAfter}
                            onChange={(e) => setOverdueAlertDaysAfter(e.target.value)}
                            onBlur={handleSaveAlertDays}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Always sends on the due date too. Saves on blur.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <GearSix className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">More Settings</h3>
              </div>
            </div>
            <div className="p-5 pt-0 space-y-0">
              <Link
                to="/settings/penalty-settings"
                className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
              >
                <span className="h-2 w-2 rounded-full shrink-0 bg-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Penalty Settings</p>
                  <p className="text-xs text-muted-foreground">Late fees & daily interest</p>
                </div>
                <ArrowSquareOut className="h-4 w-4 text-muted-foreground" />
              </Link>
              {isLender && (
                <Link
                  to="/agents/commission-settings"
                  search={{ tab: undefined }}
                  className="flex items-center gap-3 py-3 border-b last:border-0 hover:bg-muted/50 -mx-5 px-5 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full shrink-0 bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Commission Settings</p>
                    <p className="text-xs text-muted-foreground">Agent commission tiers & rules</p>
                  </div>
                  <ArrowSquareOut className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            {passwordError && (
              <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                {passwordError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
              disabled={isChangingPassword}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
  )
}
