import { createFileRoute, Outlet, redirect, Link, useRouter, useNavigate } from "@tanstack/react-router"
import { getServerSession } from "@/server/session"
import { signOut } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { RouteProgress } from "@/components/ui/route-progress"
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
    return { session }
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

// Agent menu items (shown in user dropdown)
const agentMenuItems = [
  { name: "My Contacts", href: "/agent/contacts", icon: Users },
  { name: "My Loans", href: "/agent/loans", icon: CurrencyCircleDollar },
  { name: "My Payments", href: "/agent/payments", icon: Receipt },
  { name: "My Commissions", href: "/agent/commissions", icon: Wallet },
]

function DashboardLayout() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()

  // Determine user roles
  const isAgent = hasRole(session.user.role, ROLES.AGENT)
  const isLender = hasRole(session.user.role, ROLES.LENDER)

  // Lenders see lender navigation, agent-only users see no top nav
  const navigation = isLender ? lenderNavigation : []
  const homeLink = isLender ? "/dashboard" : isAgent ? "/agent" : "/dashboard"

  const handleSignOut = async () => {
    await signOut()
    router.navigate({ to: "/login" })
  }

  return (
    <div className="min-h-screen bg-gradient-page relative overflow-hidden">
      {/* Decorative background circles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-72 h-72 bg-primary/[0.07] rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/3 w-[500px] h-[500px] bg-primary/[0.05] rounded-full blur-3xl" />
      </div>

      {/* Route loading progress */}
      <RouteProgress />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 glass relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to={homeLink} className="flex items-center">
              <span className="text-xl font-bold">Loona</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  activeOptions={{ exact: item.exact }}
                  className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&.active]:text-primary after:absolute after:left-0 after:bottom-[-2px] after:h-[2px] after:w-0 after:bg-primary after:transition-all after:duration-200 hover:after:w-full [&.active]:after:w-full"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="h-9 w-9 p-0"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {session.user.name?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                      {session.user.name}
                    </span>
                    <CaretDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {isAgent && (
                    <>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Agent Portal</p>
                      </div>
                      {agentMenuItems.map((item) => (
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
                    </>
                  )}
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

      {/* Page content - constrained width */}
      <main className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
