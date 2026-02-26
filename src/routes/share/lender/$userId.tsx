import { createFileRoute, Link } from "@tanstack/react-router"
import { getPublicLenderProfile } from "@/server/lender-profile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { GlobeSimple, FacebookLogo, ShieldCheck, CheckCircle } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import type { PenaltyConfig } from "@/lib/constants/penalty-defaults"

export const Route = createFileRoute("/share/lender/$userId")({
  loader: async ({ params }) => {
    try {
      const profile = await getPublicLenderProfile({ data: params.userId })
      return { profile }
    } catch {
      return { profile: null }
    }
  },
  component: LenderProfilePage,
})

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  semimonthly: "Semi-monthly",
  monthly: "Monthly",
}

function PenaltyPolicyContent({ config }: { config: PenaltyConfig }) {
  if (!config.enabled) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0" weight="fill" />
        <span>This lender does not charge late penalties.</span>
      </div>
    )
  }

  const rows: { label: string; value: string }[] = []

  rows.push({
    label: "Grace Period",
    value: `${config.gracePeriodDays} day${config.gracePeriodDays !== 1 ? "s" : ""} after due date`,
  })

  if (config.lateFee.enabled) {
    rows.push({
      label: "Late Fee",
      value:
        config.lateFee.type === "fixed"
          ? `${formatCurrency(config.lateFee.amount)} per missed payment`
          : `${config.lateFee.amount}% of overdue amount`,
    })
  }

  if (config.dailyPenaltyInterest.enabled) {
    rows.push({
      label: "Daily Penalty Interest",
      value: `${config.dailyPenaltyInterest.ratePerDay}% per day (max ${config.dailyPenaltyInterest.maxDays} days)`,
    })
  }

  rows.push({
    label: "Penalty Cap",
    value:
      config.penaltyCap.type === "percentage"
        ? `${config.penaltyCap.amount}% of principal`
        : formatCurrency(config.penaltyCap.amount),
  })

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between items-baseline text-sm py-1.5 border-b last:border-0">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium text-right">{row.value}</span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Amounts shown are monthly equivalents. For weekly, bi-weekly, or daily loans, penalties are scaled down proportionally per installment.
      </p>
    </div>
  )
}

function LenderProfilePage() {
  const { profile } = Route.useLoaderData()

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-page">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Profile Not Available</h1>
          <p className="text-muted-foreground">
            This lender profile doesn't exist or is not available.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side - Branding & Lender Info */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary via-primary to-primary/80 p-12 flex-col items-center justify-center relative overflow-hidden">
        {/* Decorative floating circles */}
        <FloatingCircle
          className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"
          delay={0}
          duration={8}
        />
        <FloatingCircle
          className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"
          delay={0.5}
          duration={7}
        />
        <FloatingCircle
          className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2"
          delay={1}
          duration={10}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {/* Brand */}
          <LoonaBrand size="lg" variant="white" animated />

          {/* Avatar */}
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {profile.lenderName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Name & Member Since */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">{profile.lenderName}</h1>
            <p className="text-white/70 text-sm">
              Member since {format(new Date(profile.memberSince), "MMMM yyyy")}
            </p>
          </div>

          {/* Links */}
          {(profile.websiteUrl || profile.facebookUrl) && (
            <div className="flex flex-wrap justify-center gap-2">
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full px-4 py-1.5 text-sm transition-colors"
                >
                  <GlobeSimple className="h-4 w-4" />
                  {new URL(profile.websiteUrl).hostname}
                </a>
              )}
              {profile.facebookUrl && (
                <a
                  href={profile.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full px-4 py-1.5 text-sm transition-colors"
                >
                  <FacebookLogo className="h-4 w-4" weight="fill" />
                  Facebook
                </a>
              )}
            </div>
          )}

          {/* Stats Pills */}
          <div className="flex flex-wrap justify-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
              <p className="text-xl font-bold text-white">{profile.totalActiveLoans}</p>
              <p className="text-xs text-white/70">Active</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
              <p className="text-xl font-bold text-white">{profile.totalCompletedLoans}</p>
              <p className="text-xs text-white/70">Completed</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
              {profile.penaltyConfig.enabled ? (
                <>
                  <p className="text-xl font-bold text-amber-300">Active</p>
                  <p className="text-xs text-white/70">Penalty Policy</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-white flex items-center justify-center gap-1">
                    No Late
                    <CheckCircle className="h-5 w-5 text-green-300" weight="fill" />
                  </p>
                  <p className="text-xs text-white/70">Penalties</p>
                </>
              )}
            </div>
          </div>

          <p className="text-white/40 text-xs pt-4">
            Trusted by lenders across the Philippines
          </p>
        </motion.div>
      </div>

      {/* Mobile hero (compact, visible only on small screens) */}
      <div className="md:hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-8 relative overflow-hidden">
        <FloatingCircle
          className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"
          delay={0}
          duration={8}
        />
        <FloatingCircle
          className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"
          delay={0.3}
          duration={7}
        />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          <LoonaBrand size="sm" variant="white" animated />

          <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <span className="text-xl font-bold text-white">
              {profile.lenderName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="space-y-0.5">
            <h1 className="text-xl font-bold text-white">{profile.lenderName}</h1>
            <p className="text-white/70 text-xs">
              Member since {format(new Date(profile.memberSince), "MMMM yyyy")}
            </p>
          </div>

          {(profile.websiteUrl || profile.facebookUrl) && (
            <div className="flex flex-wrap justify-center gap-2">
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full px-3 py-1 text-xs transition-colors"
                >
                  <GlobeSimple className="h-3.5 w-3.5" />
                  {new URL(profile.websiteUrl).hostname}
                </a>
              )}
              {profile.facebookUrl && (
                <a
                  href={profile.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full px-3 py-1 text-xs transition-colors"
                >
                  <FacebookLogo className="h-3.5 w-3.5" weight="fill" />
                  Facebook
                </a>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-lg font-bold text-white">{profile.totalActiveLoans}</p>
              <p className="text-[10px] text-white/70">Active</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <p className="text-lg font-bold text-white">{profile.totalCompletedLoans}</p>
              <p className="text-[10px] text-white/70">Completed</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              {profile.penaltyConfig.enabled ? (
                <>
                  <p className="text-lg font-bold text-amber-300">Active</p>
                  <p className="text-[10px] text-white/70">Penalty Policy</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-white flex items-center justify-center gap-1">
                    No Late
                    <CheckCircle className="h-4 w-4 text-green-300" weight="fill" />
                  </p>
                  <p className="text-[10px] text-white/70">Penalties</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Content Cards */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-page p-6 sm:p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Stagger className="space-y-4">
            {/* Typical Packages Card */}
            <StaggerItem>
              <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Typical Loan Packages</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Based on {profile.totalCompletedLoans} completed loan{profile.totalCompletedLoans !== 1 ? "s" : ""}
                  </p>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {profile.packages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No completed loans yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {profile.packages.map((pkg: { interestRate: string; termMonths: number; paymentFrequency: string; loanCount: number; typicalPrincipal: number }, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg border-l-4 border-l-primary/30 bg-muted/30 pl-4"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              {pkg.interestRate}% &middot; {pkg.termMonths} month{pkg.termMonths !== 1 ? "s" : ""} &middot; {FREQUENCY_LABELS[pkg.paymentFrequency] ?? pkg.paymentFrequency}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Typical amount: {formatCurrency(pkg.typicalPrincipal)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {pkg.loanCount} loan{pkg.loanCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Penalty Policy Card */}
            <StaggerItem>
              <Card className="shadow-lg">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Penalty Policy</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <PenaltyPolicyContent config={profile.penaltyConfig} />
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Footer */}
            <StaggerItem>
              <div className="text-center pt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Powered by Loona
                </p>
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                  <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                  <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
                </div>
              </div>
            </StaggerItem>
          </Stagger>
        </motion.div>
      </div>
    </div>
  )
}
