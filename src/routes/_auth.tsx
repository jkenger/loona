import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { getServerSession } from "@/server/session"
import { ChartLineUp, ShieldCheck, Users, Lightning } from "@phosphor-icons/react"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AuthLayout,
})

const features = [
  {
    icon: ChartLineUp,
    title: "Track Everything",
    description: "Monitor loans, payments, and cashflow in real-time",
  },
  {
    icon: Users,
    title: "Manage Contacts",
    description: "Keep all borrower information organized",
  },
  {
    icon: Lightning,
    title: "Fast & Simple",
    description: "Record payments in seconds, not minutes",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Private",
    description: "Your data is encrypted and protected",
  },
]

function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-white/3 rounded-full -translate-x-1/2 -translate-y-1/2" />

        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white">Loona</h1>
          <p className="text-primary-foreground/70 mt-1">Loan Management Made Simple</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Manage your lending business with confidence
            </h2>
            <p className="text-primary-foreground/70">
              Everything you need to track loans, collect payments, and grow your portfolio.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <feature.icon className="h-6 w-6 text-white mb-2" weight="duotone" />
                <h3 className="font-medium text-white text-sm">{feature.title}</h3>
                <p className="text-primary-foreground/60 text-xs mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-primary-foreground/50 text-sm">
            Trusted by lenders across the Philippines
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-page p-6 sm:p-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
