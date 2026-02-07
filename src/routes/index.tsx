import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Envelope, ArrowRight, CheckCircle, Spinner, WarningCircle } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { LoonaBrand, AnimatedTagline, FloatingCircle } from "@/components/ui/loona-brand"
import { getServerSession } from "@/server/session"
import { getDashboardPath } from "@/lib/constants/roles"
import { joinWaitlist } from "@/server/waitlist"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: getDashboardPath(session.user.role) })
    }
  },
  component: LandingPage,
})

function LandingPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await joinWaitlist({ data: { email } })
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

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

          {/* Waitlist form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {submitted ? (
              <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-xl p-4">
                <CheckCircle className="h-5 w-5" weight="fill" />
                <span className="font-medium">You're on the list! We'll be in touch.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
                <div className="relative flex-1">
                  <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 px-6 bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading ? (
                    <Spinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join beta
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}
            {error && (
              <div className="flex items-center justify-center gap-2 text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-xl p-3 mt-3">
                <WarningCircle className="h-4 w-4" weight="fill" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Currently in closed beta. Sign up to get early access.
            </p>
          </motion.div>
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
