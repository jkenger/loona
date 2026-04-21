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
  Lock,
  Spinner,
  Check,
  Eye,
  EyeSlash,
  PencilSimple,
  ArrowSquareOut,
  Wallet,
  GlobeSimple,
  FacebookLogo,
  LinkSimple,
  Copy,
  Bell,
  QrCode,
  Receipt,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { getLenderSettings, saveLenderSettings } from "@/server/lender-settings"
import { getLenderProfileLinks, saveLenderProfileLinks } from "@/server/lender-profile"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { cn } from "@/lib/utils"

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
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-8">
      <Skeleton className="h-9 w-32" />
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ============================================================================
// Reusable section components
// ============================================================================

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <StaggerItem className={cn("rounded-xl border bg-card", className)}>{children}</StaggerItem>
}

function SectionHeader({ icon: IconComp, title, description }: {
  icon: Icon
  title: string
  description?: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <IconComp className="h-4.5 w-4.5 text-muted-foreground" weight="bold" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children, border = true }: {
  label: string
  description?: string
  children: React.ReactNode
  border?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-3.5", border && "border-t")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ============================================================================
// Main page
// ============================================================================

function SettingsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { lenderConfig, profileLinks } = Route.useLoaderData()

  // Profile
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)

  // Password
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  // Capital
  const [isEditingCapital, setIsEditingCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState("")
  const [isSavingCapital, setIsSavingCapital] = useState(false)
  const [currentCapital, setCurrentCapital] = useState(lenderConfig?.initialCapital ?? 0)

  // Notifications
  const [paymentReceiptsEnabled, setPaymentReceiptsEnabled] = useState(lenderConfig?.paymentReceiptsEnabled ?? false)
  const [overdueAlertsEnabled, setOverdueAlertsEnabled] = useState(lenderConfig?.overdueAlertsEnabled ?? false)
  const [overdueAlertDaysBefore, setOverdueAlertDaysBefore] = useState(String(lenderConfig?.overdueAlertDaysBefore ?? 3))
  const [overdueAlertDaysAfter, setOverdueAlertDaysAfter] = useState(String(lenderConfig?.overdueAlertDaysAfter ?? 3))
  const [lenderPaymentNotifications, setLenderPaymentNotifications] = useState(lenderConfig?.lenderPaymentNotificationsEnabled ?? false)
  const [lenderDocumentNotifications, setLenderDocumentNotifications] = useState(lenderConfig?.lenderDocumentNotificationsEnabled ?? false)
  const [lenderPenaltyNotifications, setLenderPenaltyNotifications] = useState(lenderConfig?.lenderPenaltyNotificationsEnabled ?? false)
  const [lenderDailySummary, setLenderDailySummary] = useState(lenderConfig?.lenderDailySummaryEnabled ?? false)
  const [agentNotifications, setAgentNotifications] = useState(lenderConfig?.agentNotificationsEnabled ?? false)
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  // Profile links
  const [isEditingWebsite, setIsEditingWebsite] = useState(false)
  const [websiteInput, setWebsiteInput] = useState("")
  const [isSavingWebsite, setIsSavingWebsite] = useState(false)
  const [currentWebsite, setCurrentWebsite] = useState(profileLinks?.websiteUrl ?? "")
  const [isEditingFacebook, setIsEditingFacebook] = useState(false)
  const [facebookInput, setFacebookInput] = useState("")
  const [isSavingFacebook, setIsSavingFacebook] = useState(false)
  const [currentFacebook, setCurrentFacebook] = useState(profileLinks?.facebookUrl ?? "")

  const user = session?.user
  const isLender = hasRole(user?.role ?? null, ROLES.LENDER)

  // ---- Handlers ----

  const handleEditName = () => { setNewName(user?.name || ""); setIsEditingName(true) }
  const handleCancelEditName = () => { setIsEditingName(false); setNewName("") }

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim().length < 2) { toast.error("Name must be at least 2 characters"); return }
    setIsSavingName(true)
    try {
      const result = await updateUserName({ name: newName.trim() })
      if (result.error) { toast.error(result.error.message) }
      else { toast.success("Name updated"); setIsEditingName(false); router.invalidate() }
    } catch { toast.error("Failed to update name") }
    finally { setIsSavingName(false) }
  }

  const openPasswordDialog = () => {
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
    setPasswordError(""); setShowCurrentPassword(false); setShowNewPassword(false)
    setShowPasswordDialog(true)
  }

  const handleChangePassword = async () => {
    setPasswordError("")
    if (!currentPassword) { setPasswordError("Current password is required"); return }
    if (!newPassword) { setPasswordError("New password is required"); return }
    if (newPassword.length < 8) { setPasswordError("Must be at least 8 characters"); return }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); return }
    if (currentPassword === newPassword) { setPasswordError("Must be different from current"); return }
    setIsChangingPassword(true)
    try {
      const result = await changePassword({ currentPassword, newPassword })
      if (result.error) { setPasswordError(result.error.message) }
      else { toast.success("Password changed"); setShowPasswordDialog(false) }
    } catch { setPasswordError("Failed to change password") }
    finally { setIsChangingPassword(false) }
  }

  const handleEditCapital = () => { setCapitalInput(currentCapital > 0 ? currentCapital.toString() : ""); setIsEditingCapital(true) }

  const handleSaveCapital = async () => {
    const amount = parseFloat(capitalInput)
    if (isNaN(amount) || amount < 0) { toast.error("Please enter a valid amount"); return }
    setIsSavingCapital(true)
    try {
      await saveLenderSettings({ data: buildPayload({ initialCapital: amount }) })
      setCurrentCapital(amount); setIsEditingCapital(false); toast.success("Capital updated")
    } catch { toast.error("Failed to save") }
    finally { setIsSavingCapital(false) }
  }

  const buildPayload = (overrides: Record<string, any> = {}) => ({
    initialCapital: currentCapital,
    paymentReceiptsEnabled,
    overdueAlertsEnabled,
    overdueAlertDaysBefore: parseInt(overdueAlertDaysBefore) || 3,
    overdueAlertDaysAfter: parseInt(overdueAlertDaysAfter) || 3,
    lenderPaymentNotificationsEnabled: lenderPaymentNotifications,
    lenderDocumentNotificationsEnabled: lenderDocumentNotifications,
    lenderPenaltyNotificationsEnabled: lenderPenaltyNotifications,
    lenderDailySummaryEnabled: lenderDailySummary,
    agentNotificationsEnabled: agentNotifications,
    ...overrides,
  })

  type NotificationField =
    | "paymentReceiptsEnabled" | "overdueAlertsEnabled"
    | "lenderPaymentNotificationsEnabled" | "lenderDocumentNotificationsEnabled"
    | "lenderPenaltyNotificationsEnabled" | "lenderDailySummaryEnabled"
    | "agentNotificationsEnabled"

  const notificationSetters: Record<NotificationField, (v: boolean) => void> = {
    paymentReceiptsEnabled: setPaymentReceiptsEnabled,
    overdueAlertsEnabled: setOverdueAlertsEnabled,
    lenderPaymentNotificationsEnabled: setLenderPaymentNotifications,
    lenderDocumentNotificationsEnabled: setLenderDocumentNotifications,
    lenderPenaltyNotificationsEnabled: setLenderPenaltyNotifications,
    lenderDailySummaryEnabled: setLenderDailySummary,
    agentNotificationsEnabled: setAgentNotifications,
  }

  const handleToggle = async (field: NotificationField, value: boolean) => {
    notificationSetters[field](value)
    setIsSavingNotifications(true)
    try { await saveLenderSettings({ data: buildPayload({ [field]: value }) }) }
    catch { notificationSetters[field](!value); toast.error("Failed to save") }
    finally { setIsSavingNotifications(false) }
  }

  const handleSaveAlertDays = async () => {
    const before = parseInt(overdueAlertDaysBefore), after = parseInt(overdueAlertDaysAfter)
    if (isNaN(before) || before < 1 || before > 30 || isNaN(after) || after < 1 || after > 30) { toast.error("1–30 days"); return }
    setIsSavingNotifications(true)
    try { await saveLenderSettings({ data: buildPayload({ overdueAlertDaysBefore: before, overdueAlertDaysAfter: after }) }) }
    catch { toast.error("Failed to save") }
    finally { setIsSavingNotifications(false) }
  }

  const handleEditWebsite = () => { setWebsiteInput(currentWebsite || ""); setIsEditingWebsite(true) }
  const handleEditFacebook = () => { setFacebookInput(currentFacebook || ""); setIsEditingFacebook(true) }

  const handleSaveWebsite = async () => {
    if (websiteInput && !websiteInput.startsWith("http")) { toast.error("Must start with http:// or https://"); return }
    setIsSavingWebsite(true)
    try {
      await saveLenderProfileLinks({ data: { websiteUrl: websiteInput || null, facebookUrl: currentFacebook || null } })
      setCurrentWebsite(websiteInput || ""); setIsEditingWebsite(false); toast.success("Saved")
    } catch { toast.error("Failed to save") }
    finally { setIsSavingWebsite(false) }
  }

  const handleSaveFacebook = async () => {
    if (facebookInput && !facebookInput.startsWith("http")) { toast.error("Must start with http:// or https://"); return }
    setIsSavingFacebook(true)
    try {
      await saveLenderProfileLinks({ data: { websiteUrl: currentWebsite || null, facebookUrl: facebookInput || null } })
      setCurrentFacebook(facebookInput || ""); setIsEditingFacebook(false); toast.success("Saved")
    } catch { toast.error("Failed to save") }
    finally { setIsSavingFacebook(false) }
  }

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/lender/${user?.id}`)
    toast.success("Link copied")
  }

  if (!user) return null

  const formatCapital = (v: number) => v > 0
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
    : "Not set"

  // ---- Render ----

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, notifications, and preferences.</p>
      </div>

      {/* ============ ACCOUNT ============ */}
      <Section>
        <SectionHeader icon={User} title="Account" description="Your profile and login details" />

        {/* Name */}
        <SettingRow label="Name">
          {isEditingName ? (
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Your name" className="h-8 w-48 text-sm" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSaveName() }} />
              <Button size="sm" variant="default" onClick={handleSaveName} disabled={isSavingName} className="h-8 px-3">
                {isSavingName ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEditName} disabled={isSavingName} className="h-8 px-2 text-xs">Cancel</Button>
            </div>
          ) : (
            <button onClick={handleEditName} className="flex items-center gap-2 text-sm hover:text-primary transition-colors group">
              <span className="font-medium">{user.name || "—"}</span>
              <PencilSimple className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
            </button>
          )}
        </SettingRow>

        {/* Email */}
        <SettingRow label="Email" description="Cannot be changed">
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </SettingRow>

        {/* Password */}
        <SettingRow label="Password" border>
          <Button size="sm" variant="outline" onClick={openPasswordDialog} className="h-8 text-xs gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Change
          </Button>
        </SettingRow>

        {/* Member since */}
        <div className="px-5 pb-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Member since {user.createdAt ? format(new Date(user.createdAt), "MMMM yyyy") : "—"}
          </p>
        </div>
      </Section>

      {/* ============ NOTIFICATIONS ============ */}
      {isLender && (
        <Section>
          <SectionHeader icon={Bell} title="Notifications" description="Control what emails you and your borrowers receive" />

          {/* Borrower emails */}
          <div className="px-5 pb-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Borrower emails</p>
          </div>

          <SettingRow label="Payment Receipts" description="Email borrowers after each payment" border={false}>
            <Switch checked={paymentReceiptsEnabled} onCheckedChange={(v) => handleToggle("paymentReceiptsEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          <SettingRow label="Overdue Reminders" description="Before, on, and after due date">
            <Switch checked={overdueAlertsEnabled} onCheckedChange={(v) => handleToggle("overdueAlertsEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          {overdueAlertsEnabled && (
            <div className="mx-5 mb-3 rounded-lg bg-muted/40 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Days before</Label>
                  <Input type="number" min={1} max={30} value={overdueAlertDaysBefore} onChange={(e) => setOverdueAlertDaysBefore(e.target.value)} onBlur={handleSaveAlertDays} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Days after</Label>
                  <Input type="number" min={1} max={30} value={overdueAlertDaysAfter} onChange={(e) => setOverdueAlertDaysAfter(e.target.value)} onBlur={handleSaveAlertDays} className="h-8 text-sm" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Always notifies on the due date. Saves on blur.</p>
            </div>
          )}

          {/* Lender emails */}
          <div className="px-5 pt-3 pb-1 border-t">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Your email notifications</p>
          </div>

          <SettingRow label="Payment Received" description="When a payment is recorded" border={false}>
            <Switch checked={lenderPaymentNotifications} onCheckedChange={(v) => handleToggle("lenderPaymentNotificationsEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          <SettingRow label="Document Signed" description="When a borrower or co-maker signs">
            <Switch checked={lenderDocumentNotifications} onCheckedChange={(v) => handleToggle("lenderDocumentNotificationsEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          <SettingRow label="Penalty Generated" description="Late fees & daily interest alerts">
            <Switch checked={lenderPenaltyNotifications} onCheckedChange={(v) => handleToggle("lenderPenaltyNotificationsEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          <SettingRow label="Daily Summary" description="Portfolio digest + missed payment alerts">
            <Switch checked={lenderDailySummary} onCheckedChange={(v) => handleToggle("lenderDailySummaryEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          <div className="px-5 pt-4 pb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent notifications</p>
          </div>

          <SettingRow label="Agent Alerts" description="Commission earned, overdue follow-ups & weekly summary">
            <Switch checked={agentNotifications} onCheckedChange={(v) => handleToggle("agentNotificationsEnabled", v)} disabled={isSavingNotifications} />
          </SettingRow>

          <div className="h-3" />
        </Section>
      )}

      {/* ============ BUSINESS ============ */}
      {isLender && (
        <Section>
          <SectionHeader icon={Wallet} title="Business" description="Financial settings and lending configuration" />

          {/* Starting Capital */}
          <SettingRow label="Starting Capital" description="Used to calculate your cash position">
            {isEditingCapital ? (
              <div className="flex gap-2">
                <CurrencyInput value={capitalInput} onValueChange={setCapitalInput} placeholder="500,000" className="h-8 w-40 text-sm" onKeyDown={(e) => { if (e.key === "Enter") handleSaveCapital() }} />
                <Button size="sm" onClick={handleSaveCapital} disabled={isSavingCapital} className="h-8 px-3">
                  {isSavingCapital ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingCapital(false)} className="h-8 px-2 text-xs">Cancel</Button>
              </div>
            ) : (
              <button onClick={handleEditCapital} className="flex items-center gap-2 text-sm hover:text-primary transition-colors group">
                <span className="font-medium">{formatCapital(currentCapital)}</span>
                <PencilSimple className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              </button>
            )}
          </SettingRow>

          {/* Cash Transactions */}
          <SettingRow label="Cash Transactions" description="Record deposits and expenses against your cash position">
            <Link to="/settings/cash-transactions">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Manage
              </Button>
            </Link>
          </SettingRow>

          {/* Penalty Rules */}
          <SettingRow label="Penalty Rules" description="Late fees, daily interest, and caps">
            <Link to="/settings/penalty-settings">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                Configure
                <ArrowSquareOut className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </SettingRow>

          {/* QR Payment Codes */}
          <SettingRow label="QR Payment Codes" description="GCash, Maya, and other payment QR codes">
            <Link to="/settings/qr-payments">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <QrCode className="h-3.5 w-3.5" />
                Manage
              </Button>
            </Link>
          </SettingRow>

          {/* Commission Settings */}
          <SettingRow label="Commission Settings" description="Agent commission tiers & rules">
            <Link to="/agents/commission-settings" search={{ tab: undefined }}>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                Configure
                <ArrowSquareOut className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </SettingRow>

          {/* Loan Applications */}
          <SettingRow label="Loan Application Link" description="Share this link so borrowers can apply directly">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  const url = `${window.location.origin}/share/apply/${user?.id}`
                  navigator.clipboard.writeText(url)
                  toast.success("Application link copied!")
                }}
              >
                Copy Link
                <LinkSimple className="h-3.5 w-3.5" />
              </Button>
              <Link to="/loans/applications">
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5">
                  View Applications
                  <ArrowSquareOut className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </SettingRow>

          <div className="h-3" />
        </Section>
      )}

      {/* ============ PUBLIC PROFILE ============ */}
      {isLender && (
        <Section>
          <SectionHeader icon={LinkSimple} title="Public Profile" description="Visible to borrowers on your share page" />

          {/* Website */}
          <SettingRow label="Website">
            {isEditingWebsite ? (
              <div className="flex gap-2">
                <Input value={websiteInput} onChange={(e) => setWebsiteInput(e.target.value)} placeholder="https://..." className="h-8 w-52 text-sm" onKeyDown={(e) => { if (e.key === "Enter") handleSaveWebsite() }} />
                <Button size="sm" onClick={handleSaveWebsite} disabled={isSavingWebsite} className="h-8 px-3">
                  {isSavingWebsite ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingWebsite(false)} className="h-8 px-2 text-xs">Cancel</Button>
              </div>
            ) : (
              <button onClick={handleEditWebsite} className="flex items-center gap-2 text-sm hover:text-primary transition-colors group">
                <GlobeSimple className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={cn("font-medium truncate max-w-[200px]", !currentWebsite && "text-muted-foreground")}>{currentWebsite || "Not set"}</span>
                <PencilSimple className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              </button>
            )}
          </SettingRow>

          {/* Facebook */}
          <SettingRow label="Facebook">
            {isEditingFacebook ? (
              <div className="flex gap-2">
                <Input value={facebookInput} onChange={(e) => setFacebookInput(e.target.value)} placeholder="https://facebook.com/..." className="h-8 w-52 text-sm" onKeyDown={(e) => { if (e.key === "Enter") handleSaveFacebook() }} />
                <Button size="sm" onClick={handleSaveFacebook} disabled={isSavingFacebook} className="h-8 px-3">
                  {isSavingFacebook ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingFacebook(false)} className="h-8 px-2 text-xs">Cancel</Button>
              </div>
            ) : (
              <button onClick={handleEditFacebook} className="flex items-center gap-2 text-sm hover:text-primary transition-colors group">
                <FacebookLogo className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={cn("font-medium truncate max-w-[200px]", !currentFacebook && "text-muted-foreground")}>{currentFacebook || "Not set"}</span>
                <PencilSimple className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
              </button>
            )}
          </SettingRow>

          {/* Share Link */}
          <SettingRow label="Share Link" description="Send this to potential borrowers">
            <Button size="sm" variant="outline" onClick={handleCopyShareLink} className="h-8 text-xs gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy Link
            </Button>
          </SettingRow>

          <div className="h-3" />
        </Section>
      )}

      {/* ============ CHANGE PASSWORD DIALOG ============ */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input id="currentPassword" type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="pr-10" />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrentPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="pr-10" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
            </div>

            {passwordError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{passwordError}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} disabled={isChangingPassword}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? <><Spinner className="h-4 w-4 animate-spin mr-2" />Changing...</> : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stagger>
  )
}
