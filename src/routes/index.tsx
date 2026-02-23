import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { LoonaBrand, AnimatedTagline, FloatingCircle } from "@/components/ui/loona-brand"
import { getServerSession } from "@/server/session"
import { getDashboardPath } from "@/lib/constants/roles"
import { buildMeta, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants/seo"

export const Route = createFileRoute("/")({
  head: () => buildMeta({
    title: 'Loona - Loan Management Made Simple',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  }),
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: getDashboardPath(session.user.role) })
    }
  },
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-page flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <FloatingCircle
        className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2"
        delay={0}
        duration={8}
      />
      <FloatingCircle
        className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2"
        delay={0.5}
        duration={7}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <LoonaBrand size="md" variant="gradient" animated={false} />
        <Link
          to="/login"
          className="text-sm font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-12">
        <motion.div
          className="max-w-lg text-center space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              Loan management,{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                simplified
              </span>
            </h1>
            <AnimatedTagline
              text="Track loans, collect payments, and manage your lending business — all in one place."
              className="text-muted-foreground text-lg"
              delay={0.3}
            />
          </div>

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-12 py-6 flex justify-center gap-6 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:text-foreground transition-colors">
          Terms of Service
        </Link>
      </footer>
    </div>
  )
}
