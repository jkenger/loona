import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  House,
  CurrencyCircleDollar,
  Receipt,
  Users,
  UsersThree,
  Gear,
  ShieldStar,
  UserList,
  ShieldCheck,
  ClipboardText,
  Envelope,
  Article,
  Wallet,
  DotsThree,
  BookOpenText,
  Calculator,
  SignOut,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
} from "@/components/ui/bottom-sheet"
import { signOut } from "@/lib/auth-client"

type NavItem = {
  name: string
  href: string
  icon: Icon
  exact: boolean
}

const portalConfig: Record<
  "lender" | "agent" | "admin",
  { primary: NavItem[]; more: NavItem[] }
> = {
  lender: {
    primary: [
      { name: "Dashboard", href: "/dashboard", icon: House, exact: true },
      { name: "Loans", href: "/loans", icon: CurrencyCircleDollar, exact: false },
      { name: "Payments", href: "/payments", icon: Receipt, exact: false },
    ],
    more: [
      { name: "Contacts", href: "/contacts", icon: Users, exact: false },
      { name: "Agents", href: "/agents", icon: UsersThree, exact: false },
      { name: "Estimator", href: "/tools/estimator", icon: Calculator, exact: true },
      { name: "Playbook", href: "/playbook", icon: BookOpenText, exact: true },
      { name: "Settings", href: "/settings", icon: Gear, exact: false },
    ],
  },
  agent: {
    primary: [
      { name: "Home", href: "/agent", icon: House, exact: true },
      { name: "Loans", href: "/agent/loans", icon: CurrencyCircleDollar, exact: false },
      { name: "Earnings", href: "/agent/earnings", icon: Wallet, exact: false },
    ],
    more: [
      { name: "Playbook", href: "/agent/playbook", icon: BookOpenText, exact: true },
    ],
  },
  admin: {
    primary: [
      { name: "Overview", href: "/admin", icon: ShieldStar, exact: true },
      { name: "Users", href: "/admin/users", icon: UserList, exact: false },
      { name: "Compliance", href: "/admin/compliance", icon: ShieldCheck, exact: false },
    ],
    more: [
      { name: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardText, exact: false },
      { name: "Waitlist", href: "/admin/waitlist", icon: Envelope, exact: false },
      { name: "Blog", href: "/admin/blog", icon: Article, exact: false },
    ],
  },
}

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href
  // Payments tab also covers /penalties (penalties is a sub-section of payments)
  if (href === "/payments" && pathname.startsWith("/penalties")) return true
  return pathname === href || pathname.startsWith(href + "/")
}

export function MobileBottomNav({ portal }: { portal: "lender" | "agent" | "admin" }) {
  const location = useLocation()
  const router = useRouter()
  const { primary, more } = portalConfig[portal]

  const handleSignOut = async () => {
    await signOut()
    router.navigate({ to: "/login" })
  }

  const moreIsActive = more.some((item) => isActive(location.pathname, item.href, item.exact))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[hsl(215_50%_10%)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around">
        {primary.map((item) => {
          const active = isActive(location.pathname, item.href, item.exact)
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 ${active ? "text-white" : "text-blue-200/50"}`}
            >
              <item.icon className="h-5 w-5" weight={active ? "fill" : "regular"} />
              <span className="text-[10px] leading-tight">{item.name}</span>
            </Link>
          )
        })}
        {more.length > 0 && (
          <BottomSheet>
            <BottomSheetTrigger
              className={`flex flex-col items-center gap-0.5 px-3 py-1 ${moreIsActive ? "text-white" : "text-blue-200/50"}`}
            >
              <DotsThree className="h-5 w-5" weight={moreIsActive ? "fill" : "regular"} />
              <span className="text-[10px] leading-tight">More</span>
            </BottomSheetTrigger>
            <BottomSheetContent>
              <div className="px-4 pb-4 space-y-1">
                {more.map((item) => {
                  const active = isActive(location.pathname, item.href, item.exact)
                  return (
                    <BottomSheetClose key={item.name} render={<div />}>
                      <Link
                        to={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
                      >
                        <item.icon className="h-5 w-5" weight={active ? "fill" : "regular"} />
                        {item.name}
                      </Link>
                    </BottomSheetClose>
                  )
                })}
                <div className="border-t pt-2 mt-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                  >
                    <SignOut className="h-5 w-5" />
                    Sign out
                  </button>
                </div>
              </div>
            </BottomSheetContent>
          </BottomSheet>
        )}
      </div>
    </nav>
  )
}
