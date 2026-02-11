import { createFileRoute, Outlet, redirect, Link, useRouter, useNavigate, useLocation } from "@tanstack/react-router"
import { useState } from "react"
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
import { LoonaBrand } from "@/components/ui/loona-brand"
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
  Article,
  Newspaper,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"

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

// Navigation items for lenders (shown in top nav)
const lenderNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: House, exact: true },
  { name: "Contacts", href: "/contacts", icon: Users, exact: false },
  { name: "Loans", href: "/loans", icon: CurrencyCircleDollar, exact: false },
  { name: "Payments", href: "/payments", icon: Receipt, exact: false },
  { name: "Agents", href: "/agents", icon: UsersThree, exact: false },
]

// Navigation items for admin portal (shown in top nav when on /admin routes)
const adminNavigation = [
  { name: "Overview", href: "/admin", icon: ShieldStar, exact: true },
  { name: "Users", href: "/admin/users", icon: UserList, exact: false },
  { name: "Compliance", href: "/admin/compliance", icon: ShieldCheck, exact: false },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardText, exact: false },
  { name: "Blog", href: "/admin/blog", icon: Article, exact: false },
]

// Navigation items for agent portal
const agentNavigation = [
  { name: "Home", href: "/agent", icon: House, exact: true },
  { name: "Earnings", href: "/agent/earnings", icon: Wallet, exact: false },
]

function DashboardLayout() {
  const { session, agentPermissions, cashPosition: initialCashPosition, latestPosts = [] } = Route.useRouteContext()
  const [cashPosition, setCashPosition] = useState(initialCashPosition)
  const router = useRouter()
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()

  // Determine user roles
  const isAgent = hasRole(session.user.role, ROLES.AGENT)
  const isLender = hasRole(session.user.role, ROLES.LENDER)
  const isAdmin = hasRole(session.user.role, ROLES.ADMIN)

  // Detect if we're in the admin portal or agent portal
  const isOnAdminPortal = location.pathname.startsWith("/admin")
  const isOnAgentPortal = location.pathname === "/agent" || location.pathname.startsWith("/agent/")

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
    <div className="min-h-screen bg-gradient-page relative">
      {/* Decorative background circles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-72 h-72 bg-primary/[0.07] rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/3 w-[500px] h-[500px] bg-primary/[0.05] rounded-full blur-3xl" />
      </div>

      {/* Route loading progress */}
      <RouteProgress />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[hsl(215_50%_10%)] text-white relative">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to={homeLink} className="flex items-center">
              <LoonaBrand size="sm" variant="white" animated={false} />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  activeOptions={{ exact: item.exact }}
                  className="relative px-3 py-1.5 text-sm font-medium text-blue-200/70 hover:text-white transition-colors [&.active]:text-white after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all after:duration-300 after:ease-out hover:after:w-full [&.active]:after:w-full"
                >
                  {item.name}
                  {"badge" in item && (item as { badge?: string }).badge && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none bg-primary text-primary-foreground">
                      {(item as { badge?: string }).badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* What's New Popover (hidden on admin portal) */}
              {!isOnAdminPortal && (
                <Popover>
                  <PopoverTrigger className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/15 transition-colors">
                    <Newspaper className="h-4 w-4 text-white" />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="z-[60] w-80 p-0">
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
              {/* User dropdown with integrated wallet */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/15 transition-colors"
                >
                  {hasCapitalSet && !isOnAgentPortal && !isOnAdminPortal ? (
                    <>
                      <Wallet className="h-4 w-4 text-primary" weight="fill" />
                      <span className="font-semibold text-white">
                        {formatPHP(cashPosition.cashAvailable)}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-6 w-6 rounded-full bg-primary/30 flex items-center justify-center">
                        <span className="text-xs font-medium text-white">
                          {session.user.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                      <span className="hidden sm:block text-sm font-medium text-white max-w-[120px] truncate">
                        {session.user.name}
                      </span>
                    </>
                  )}
                  <CaretDown className="h-3.5 w-3.5 text-blue-200/60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Wallet Section (lender portal only) */}
                  {isLender && !isOnAgentPortal && !isOnAdminPortal && (
                    <>
                      <div className="px-2 py-2">
                        {hasCapitalSet && !isEditingCapital ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Wallet className="h-3.5 w-3.5 text-primary" weight="fill" />
                                <span className="text-xs font-medium text-muted-foreground">Cash Position</span>
                              </div>
                              <button
                                onClick={handleEditCapital}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <PencilSimple className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-lg font-bold text-primary">
                              {formatPHP(cashPosition.cashAvailable)}
                            </p>
                            <button
                              onClick={() => setShowBreakdown(!showBreakdown)}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5"
                            >
                              <CaretDown className={`h-3 w-3 transition-transform ${showBreakdown ? "rotate-180" : ""}`} />
                              {showBreakdown ? "Hide" : "How is this calculated?"}
                            </button>
                            {showBreakdown && (
                              <div className="space-y-0.5 text-xs text-muted-foreground rounded bg-muted/50 p-2 mt-1.5">
                                <div className="flex justify-between">
                                  <span>Starting Capital</span>
                                  <span className="font-medium text-foreground">{formatPHP(cashPosition.initialCapital)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>&minus; Total Disbursed</span>
                                  <span className="font-medium text-foreground">{formatPHP(parseFloat(cashPosition.totalDisbursed))}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>+ Total Collected</span>
                                  <span className="font-medium text-foreground">{formatPHP(parseFloat(cashPosition.totalCollected))}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1 mt-1">
                                  <span className="font-medium text-foreground">= Cash Available</span>
                                  <span className="font-bold text-primary">{formatPHP(cashPosition.cashAvailable)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Wallet className="h-3.5 w-3.5 text-primary" weight="fill" />
                              <span className="text-xs font-medium text-muted-foreground">
                                {isEditingCapital ? "Edit Starting Capital" : "Set Starting Capital"}
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-1.5"
                              onKeyDown={(e) => e.stopPropagation()}
                            >
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
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isAdmin && !isOnAdminPortal && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate({ to: "/admin" })}
                        className="flex items-center cursor-pointer"
                      >
                        <ShieldStar className="h-4 w-4 mr-2" />
                        <span>Admin Portal</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isOnAdminPortal && isLender && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate({ to: "/dashboard" })}
                        className="flex items-center cursor-pointer"
                      >
                        <House className="h-4 w-4 mr-2" />
                        <span>Back to Dashboard</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isAgent && !isOnAgentPortal && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate({ to: "/agent" })}
                        className="flex items-center cursor-pointer"
                      >
                        <UsersThree className="h-4 w-4 mr-2" />
                        <span>Agent Portal</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isAgent && isOnAgentPortal && (isLender || isAdmin) && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate({ to: isLender ? "/dashboard" : "/admin" })}
                        className="flex items-center cursor-pointer"
                      >
                        <House className="h-4 w-4 mr-2" />
                        <span>{isLender ? "Back to Dashboard" : "Back to Admin"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isLender && !isOnAdminPortal && !isOnAgentPortal && (
                    <div className="md:hidden">
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Navigation</p>
                      </div>
                      {lenderNavigation.map((item) => (
                        <DropdownMenuItem
                          key={item.href}
                          onClick={() => navigate({ to: item.href })}
                          className="flex items-center cursor-pointer"
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          <span>{item.name}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  )}
                  {isAdmin && isOnAdminPortal && (
                    <div className="md:hidden">
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Navigation</p>
                      </div>
                      {adminNavigation.map((item) => (
                        <DropdownMenuItem
                          key={item.href}
                          onClick={() => navigate({ to: item.href })}
                          className="flex items-center cursor-pointer"
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          <span>{item.name}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  )}
                  {isAgent && isOnAgentPortal && (
                    <div className="md:hidden">
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Navigation</p>
                      </div>
                      {agentNavigation.map((item) => (
                        <DropdownMenuItem
                          key={item.href}
                          onClick={() => navigate({ to: item.href })}
                          className="flex items-center cursor-pointer"
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          <span>{item.name}</span>
                          {"badge" in item && (item as { badge?: string }).badge && (
                            <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none bg-primary text-primary-foreground">
                              {(item as { badge?: string }).badge}
                            </span>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  )}
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/settings" })}
                    className="cursor-pointer"
                  >
                    <Gear className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="cursor-pointer"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-4 w-4 mr-2" />
                    ) : (
                      <Moon className="h-4 w-4 mr-2" />
                    )}
                    {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <SignOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Beta Banner */}
      <div className="bg-amber-500 text-amber-950">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium">
            <Flask className="h-4 w-4" weight="fill" />
            <span>
              You're using the beta version of Loona.{" "}
              <a
                href="mailto:feedback@loona.app"
                className="underline underline-offset-2 hover:no-underline"
              >
                Send feedback
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Agent Permissions Banner */}
      {isOnAgentPortal && hasAgentRestrictions && (
        <div className="bg-red-600 text-white">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium">
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
        </div>
      )}

      {/* Page content - full width, pages control their own constraints */}
      <main className="relative">
        <Outlet />
      </main>
    </div>
  )
}
