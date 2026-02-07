import { createFileRoute, Outlet, redirect, Link, useRouter, useNavigate, useLocation } from "@tanstack/react-router"
import { getServerSession } from "@/server/session"
import { getOnboardingStatus } from "@/server/onboarding"
import { getAgentPermissions } from "@/server/agent-portal"
import { signOut } from "@/lib/auth-client"
import { RouteProgress } from "@/components/ui/route-progress"
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
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
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

    return { session, agentPermissions }
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
]

// Navigation items for agent portal
const agentNavigation = [
  { name: "My Contacts", href: "/agent/contacts", icon: Users, exact: false },
  { name: "My Loans", href: "/agent/loans", icon: CurrencyCircleDollar, exact: false },
  { name: "My Payments", href: "/agent/payments", icon: Receipt, exact: false },
  { name: "My Commissions", href: "/agent/commissions", icon: Wallet, exact: false },
]

function DashboardLayout() {
  const { session, agentPermissions } = Route.useRouteContext()
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
  const isOnAgentPortal = location.pathname.startsWith("/agent")

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
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/30 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {session.user.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate text-white">
                    {session.user.name}
                  </span>
                  <CaretDown className="h-4 w-4 text-blue-200/60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
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
