import { createFileRoute, redirect, Link, useRouter, useNavigate, useLocation, Outlet } from "@tanstack/react-router"
import { useState, useEffect, useCallback } from "react"
import { getServerSession } from "@/server/session"
import { getOnboardingStatus } from "@/server/onboarding"
import { getAgentPermissions } from "@/server/agent-portal"
import { getCashPosition, saveLenderSettings } from "@/server/lender-settings"
import { getLatestPosts } from "@/server/blog"
import { signOut } from "@/lib/auth-client"
import { toast } from "sonner"
import { RouteProgress } from "@/components/ui/route-progress"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Button } from "@/components/ui/button"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { useTheme } from "@/lib/theme"
import {
  House,
  Users,
  CurrencyCircleDollar,
  Receipt,
  UsersThree,
  SignOut,
  Wallet,
  CaretDown,
  Sun,
  Moon,
  Flask,
  ShieldStar,
  UserList,
  ClipboardText,
  Gear,
  Warning,
  ShieldCheck,
  PencilSimple,
  Check,
  Spinner,
  X,
  Newspaper,
  Envelope,
  BookOpenText,
  Calculator,
  ChartLineUp,
} from "@phosphor-icons/react"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { AdvisorBubble } from "@/components/advisor-bubble"
import { AdvisorChat } from "@/components/advisor-chat"
import { triggerAlertEvaluation, getUnreadAlertCount } from "@/server/advisor-alerts"

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async ({ location }) => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/login" })
    }

    // Redirect new lenders to the welcome wizard
    // Session cookie cache (5 min TTL) may be stale after completing onboarding,
    // so verify against DB when the cached session says not onboarded
    if (
      hasRole(session.user.role, ROLES.LENDER) &&
      !session.user.hasCompletedOnboarding
    ) {
      const actualStatus = await getOnboardingStatus()
      if (!actualStatus) {
        throw redirect({ to: "/welcome" })
      }
    }

    // Fetch agent permissions if user is an agent
    let agentPermissions = null
    if (hasRole(session.user.role, ROLES.AGENT)) {
      try {
        agentPermissions = await getAgentPermissions()
      } catch {
        // Ignore errors - permissions will be null
      }
    }

    // Fetch cash position for lenders on lender portal only
    const isOnLenderPortal = !location.pathname.startsWith("/agent") && !location.pathname.startsWith("/admin")
    const isOnAdminPortal = location.pathname.startsWith("/admin")
    let cashPosition = null
    if (isOnLenderPortal && hasRole(session.user.role, ROLES.LENDER)) {
      try {
        cashPosition = await getCashPosition()
      } catch {
        // Ignore - wallet won't show
      }
    }

    // Fetch latest blog posts for non-admin portals
    let latestPosts: Awaited<ReturnType<typeof getLatestPosts>> = []
    if (!isOnAdminPortal) {
      try {
        latestPosts = await getLatestPosts()
      } catch {
        // Ignore - popover won't show posts
      }
    }

    return { session, agentPermissions, cashPosition, latestPosts }
  },
  component: DashboardLayout,
})

// Navigation items for lenders
const lenderNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: House, exact: true },
  { name: "Contacts", href: "/contacts", icon: Users, exact: false },
  { name: "Loans", href: "/loans", icon: CurrencyCircleDollar, exact: false },
  { name: "Payments", href: "/payments", icon: Receipt, exact: false },
  { name: "Agents", href: "/agents", icon: UsersThree, exact: false },
  { name: "Estimator", href: "/tools/estimator", icon: Calculator, exact: false },
  { name: "Reports", href: "/reports", icon: ChartLineUp, exact: false },
  { name: "Playbook", href: "/playbook", icon: BookOpenText, exact: true },
]

// Navigation items for admin portal
const adminNavigation = [
  { name: "Overview", href: "/admin", icon: ShieldStar, exact: true },
  { name: "Users", href: "/admin/users", icon: UserList, exact: false },
  { name: "Compliance", href: "/admin/compliance", icon: ShieldCheck, exact: false },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardText, exact: false },
  { name: "Waitlist", href: "/admin/waitlist", icon: Envelope, exact: false },
]

// Navigation items for agent portal
const agentNavigation = [
  { name: "Home", href: "/agent", icon: House, exact: true },
  { name: "Loans", href: "/agent/loans", icon: CurrencyCircleDollar, exact: false },
  { name: "Earnings", href: "/agent/earnings", icon: Wallet, exact: false },
  { name: "Playbook", href: "/agent/playbook", icon: BookOpenText, exact: true },
]

function DashboardLayout() {
  const { session, agentPermissions, cashPosition: initialCashPosition, latestPosts = [] } = Route.useRouteContext()
  const [cashPosition, setCashPosition] = useState(initialCashPosition)
  const router = useRouter()
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const [advisorOpen, setAdvisorOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  // Determine user roles
  const isAgent = hasRole(session.user.role, ROLES.AGENT)
  const isLender = hasRole(session.user.role, ROLES.LENDER)
  const isAdmin = hasRole(session.user.role, ROLES.ADMIN)

  // Detect if we're in the admin portal or agent portal
  const isOnAdminPortal = location.pathname.startsWith("/admin")
  const isOnAgentPortal = location.pathname === "/agent" || location.pathname.startsWith("/agent/")

  // Evaluate alerts on mount (lender portal only)
  useEffect(() => {
    if (!isLender || isOnAgentPortal || isOnAdminPortal) return
    triggerAlertEvaluation().then(() => {
      getUnreadAlertCount().then(setAlertCount)
    })
  }, [isLender, isOnAgentPortal, isOnAdminPortal])

  // Check for agent permission restrictions
  const hasAgentRestrictions = agentPermissions && (
    !agentPermissions.canRecordPayments || !agentPermissions.canCreateLoans
  )

  // Show portal-specific nav based on current route
  const navigation = isOnAdminPortal && isAdmin
    ? adminNavigation
    : isOnAgentPortal && isAgent
      ? agentNavigation
      : isLender
        ? lenderNavigation
        : []
  const portal: "lender" | "agent" | "admin" = isOnAdminPortal && isAdmin ? "admin" : isOnAgentPortal && isAgent ? "agent" : "lender"

  const homeLink = isOnAdminPortal && isAdmin
    ? "/admin"
    : isOnAgentPortal && isAgent
      ? "/agent"
      : isLender ? "/dashboard" : isAgent ? "/agent" : isAdmin ? "/admin" : "/dashboard"

  // Wallet state
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [isEditingCapital, setIsEditingCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState("")
  const [isSavingCapital, setIsSavingCapital] = useState(false)

  const hasCapitalSet = cashPosition && cashPosition.initialCapital > 0

  // Track whether user has unseen blog posts
  const [hasNewPosts, setHasNewPosts] = useState(false)
  useEffect(() => {
    if (latestPosts.length === 0) return
    const newestDate = latestPosts[0]?.publishedAt
    if (!newestDate) return
    const lastSeen = localStorage.getItem("loona:whats-new-seen")
    if (!lastSeen || new Date(newestDate).getTime() > new Date(lastSeen).getTime()) {
      setHasNewPosts(true)
    }
  }, [latestPosts])

  const markPostsSeen = useCallback(() => {
    const newestDate = latestPosts[0]?.publishedAt
    if (newestDate) {
      localStorage.setItem("loona:whats-new-seen", new Date(newestDate).toISOString())
    }
    setHasNewPosts(false)
  }, [latestPosts])

  const formatPHP = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

  const handleEditCapital = () => {
    setCapitalInput(cashPosition?.initialCapital ? cashPosition.initialCapital.toString() : "")
    setIsEditingCapital(true)
  }

  const handleSaveCapital = async () => {
    const amount = parseFloat(capitalInput)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    setIsSavingCapital(true)
    try {
      await saveLenderSettings({ data: { initialCapital: amount } })
      const updated = await getCashPosition()
      setCashPosition(updated)
      setIsEditingCapital(false)
      toast.success("Starting capital saved")
    } catch {
      toast.error("Failed to save capital")
    } finally {
      setIsSavingCapital(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.navigate({ to: "/login" })
  }

  return (
    <div className="min-h-screen bg-gradient-sidebar">
      <RouteProgress />

      {/* Beta Banner */}
      <div className="bg-amber-500 text-amber-950">
        <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium px-4">
          <Flask className="h-4 w-4" weight="fill" />
          <span>
            You're using the beta version of Loona.{" "}
            <a
              href="mailto:feedback@loona.ph"
              className="underline underline-offset-2 hover:no-underline"
            >
              Send feedback
            </a>
          </span>
        </div>
      </div>

      <div className="flex h-[calc(100vh-40px)]">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 h-full bg-gradient-sidebar text-sidebar-foreground overflow-hidden">
          {/* User Header */}
          <div className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-primary">
                  {session.user.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {session.user.name}
                </p>
                <Link to={homeLink} className="text-[11px] text-muted-foreground hover:text-sidebar-foreground transition-colors">
                  Loona
                </Link>
              </div>
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors shrink-0 p-1 rounded-md hover:bg-sidebar-accent"
                title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4.5 w-4.5" />
                ) : (
                  <Moon className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {navigation.map((item) => {
              const forceActive = item.href === "/payments" && location.pathname.startsWith("/penalties")
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  activeOptions={{ exact: item.exact }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors [&.active]:bg-sidebar-primary/10 [&.active]:text-sidebar-primary [&.active]:font-semibold ${forceActive ? "bg-sidebar-primary/10 text-sidebar-primary font-semibold" : ""}`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Cash Position Card — lender portal only */}
          {isLender && !isOnAgentPortal && !isOnAdminPortal && (
            <div className="mx-3 mb-3 rounded-lg bg-sidebar-accent/50 p-3">
              {hasCapitalSet && !isEditingCapital ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-primary" weight="fill" />
                      <span className="text-xs font-medium text-muted-foreground">Cash Position</span>
                    </div>
                    <button
                      onClick={handleEditCapital}
                      className="text-muted-foreground hover:text-sidebar-foreground transition-colors"
                    >
                      <PencilSimple className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatPHP(cashPosition.cashAvailable)}
                  </p>
                  <button
                    onClick={() => setShowBreakdown(!showBreakdown)}
                    className="text-[11px] text-muted-foreground hover:text-sidebar-foreground transition-colors flex items-center gap-1 mt-0.5"
                  >
                    <CaretDown className={`h-3 w-3 transition-transform ${showBreakdown ? "rotate-180" : ""}`} />
                    {showBreakdown ? "Hide" : "How is this calculated?"}
                  </button>
                  {showBreakdown && (
                    <div className="space-y-0.5 text-xs text-muted-foreground rounded bg-sidebar-accent p-2 mt-1.5">
                      <div className="flex justify-between">
                        <span>Starting Capital</span>
                        <span className="font-medium text-sidebar-foreground">{formatPHP(cashPosition.initialCapital)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>&minus; Total Disbursed</span>
                        <span className="font-medium text-sidebar-foreground">{formatPHP(parseFloat(cashPosition.totalDisbursed))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>+ Total Collected</span>
                        <span className="font-medium text-sidebar-foreground">{formatPHP(parseFloat(cashPosition.totalCollected))}</span>
                      </div>
                      <div className="flex justify-between border-t border-sidebar-border pt-1 mt-1">
                        <span className="font-medium text-sidebar-foreground">= Cash Available</span>
                        <span className="font-bold text-primary">{formatPHP(cashPosition.cashAvailable)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wallet className="h-4 w-4 text-primary" weight="fill" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {isEditingCapital ? "Edit Starting Capital" : "Set Starting Capital"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CurrencyInput
                      value={capitalInput}
                      onValueChange={setCapitalInput}
                      placeholder="500,000"
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveCapital()
                        if (e.key === "Escape") setIsEditingCapital(false)
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleSaveCapital}
                      disabled={isSavingCapital}
                    >
                      {isSavingCapital ? (
                        <Spinner className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {isEditingCapital && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setIsEditingCapital(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {!isEditingCapital && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Track your available cash on hand
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom utilities */}
          <div className="border-t border-sidebar-border px-2 py-2 space-y-0.5">
            {/* Settings */}
            <Link
              to="/settings"
              activeOptions={{ exact: false }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors [&.active]:bg-sidebar-primary/10 [&.active]:text-sidebar-primary [&.active]:font-semibold"
            >
              <Gear className="h-5 w-5 shrink-0" />
              Settings
            </Link>

            {/* Portal switches */}
            {isAdmin && !isOnAdminPortal && (
              <Link
                to="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <ShieldStar className="h-5 w-5 shrink-0" />
                Admin Portal
              </Link>
            )}
            {isAgent && !isOnAgentPortal && (
              <Link
                to="/agent"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <UsersThree className="h-5 w-5 shrink-0" />
                Agent Portal
              </Link>
            )}
            {isOnAdminPortal && isLender && (
              <Link
                to="/dashboard"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <House className="h-5 w-5 shrink-0" />
                Back to Dashboard
              </Link>
            )}
            {isAgent && isOnAgentPortal && (isLender || isAdmin) && (
              <Link
                to={isLender ? "/dashboard" : "/admin"}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <House className="h-5 w-5 shrink-0" />
                {isLender ? "Back to Dashboard" : "Back to Admin"}
              </Link>
            )}

            {/* What's New */}
            {!isOnAdminPortal && (
              <Popover onOpenChange={(open) => { if (open) markPostsSeen() }}>
                <PopoverTrigger className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors w-full text-left">
                  <span className="relative">
                    <Newspaper className="h-5 w-5 shrink-0" />
                    {hasNewPosts && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                      </span>
                    )}
                  </span>
                  What's New
                </PopoverTrigger>
                <PopoverContent side="right" align="end" className="z-[60] w-80 p-0">
                  <div className="px-4 pt-3 pb-2 border-b">
                    <h3 className="text-sm font-semibold">What's New</h3>
                  </div>
                  {latestPosts.length > 0 ? (
                    <div className="divide-y">
                      {latestPosts.map((post) => (
                        <Link
                          key={post.slug}
                          to={`/blog/${post.slug}`}
                          className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm font-medium leading-snug">{post.title}</p>
                          {post.excerpt && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {post.category && (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {post.category.name}
                              </span>
                            )}
                            {post.publishedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-muted-foreground">No posts yet</p>
                    </div>
                  )}
                  <div className="border-t px-4 py-2">
                    <Link
                      to="/blog"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View all posts &rarr;
                    </Link>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive transition-colors w-full text-left"
            >
              <SignOut className="h-5 w-5 shrink-0" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="flex-1 flex flex-col min-w-0 bg-background md:border-l md:border-border">
          {/* Agent Permissions Banner */}
          {isOnAgentPortal && hasAgentRestrictions && (
            <div className="bg-red-600 text-white">
              <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium px-4">
                <Warning className="h-4 w-4" weight="fill" />
                <span>
                  Restricted access:{" "}
                  {!agentPermissions?.canRecordPayments && !agentPermissions?.canCreateLoans
                    ? "Payment recording and loan creation disabled"
                    : !agentPermissions?.canRecordPayments
                      ? "Payment recording disabled"
                      : "Loan creation disabled"
                  }
                  {" "}by your lender.
                </span>
              </div>
            </div>
          )}

          {/* Page content */}
          <main className="relative pb-20 md:pb-0">
            <Outlet />
          </main>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav portal={portal} />

      {/* AI Advisor — lender portal only */}
      {isLender && !isOnAgentPortal && !isOnAdminPortal && (
        <>
          {!advisorOpen && <AdvisorBubble onClick={() => setAdvisorOpen(true)} alertCount={alertCount} />}
          <AdvisorChat
            open={advisorOpen}
            onClose={() => { setAdvisorOpen(false); getUnreadAlertCount().then(setAlertCount) }}
            onNavigate={(href) => { setAdvisorOpen(false); navigate({ to: href }) }}
          />
        </>
      )}
    </div>
  )
}
