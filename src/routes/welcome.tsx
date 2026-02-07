import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import confetti from "canvas-confetti"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { getServerSession } from "@/server/session"
import { completeOnboarding } from "@/server/onboarding"
import { createContact } from "@/server/contacts"
import { hasRole, ROLES, getDashboardPath } from "@/lib/constants/roles"
import { LoonaBrand, FloatingCircle } from "@/components/ui/loona-brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Rocket,
  UserPlus,
  Coins,
  UsersThree,
  CurrencyCircleDollar,
  Spinner,
  User,
  CheckCircle,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/welcome")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/login" })
    }
    // Already onboarded → go to dashboard
    if (session.user.hasCompletedOnboarding) {
      throw redirect({ to: getDashboardPath(session.user.role) })
    }
    // Non-lenders skip the wizard
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      throw redirect({ to: getDashboardPath(session.user.role) })
    }
    return { session }
  },
  component: WelcomeWizard,
})

const STEP_LABELS = ["Welcome", "Contacts", "Tips", "Ready"]

const fadeVariants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function WelcomeWizard() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isCompleting, setIsCompleting] = useState(false)

  const firstName = session.user.name?.split(" ")[0] || "there"

  const goNext = () => setStep((s) => Math.min(s + 1, 4))
  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      await completeOnboarding()
      navigate({ to: "/dashboard" })
    } catch {
      setIsCompleting(false)
    }
  }

  const handleSkip = async () => {
    setIsCompleting(true)
    try {
      await completeOnboarding()
      navigate({ to: "/dashboard" })
    } catch {
      setIsCompleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-primary/80 relative overflow-hidden flex items-center justify-center p-4">
      {/* Floating circles */}
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
        className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2"
        delay={1}
        duration={10}
      />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Step Indicator */}
        <motion.div
          className="flex items-center justify-center gap-0 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isActive = step === stepNum
            const isCompleted = step > stepNum
            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      "w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 transition-colors",
                      isCompleted ? "bg-white" : "bg-white/20"
                    )}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                      isActive && "border-white bg-white text-primary",
                      isCompleted && "border-white bg-white text-primary",
                      !isActive && !isCompleted && "border-white/30 text-white/50"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" weight="bold" />
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium hidden sm:inline",
                      isActive && "text-white",
                      isCompleted && "text-white",
                      !isActive && !isCompleted && "text-white/40"
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </motion.div>

        {/* Step Content */}
        <Card className="shadow-2xl border-0 overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={fadeVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                {step === 1 && (
                  <StepWelcome firstName={firstName} onNext={goNext} onSkip={handleSkip} isCompleting={isCompleting} />
                )}
                {step === 2 && (
                  <StepContacts onNext={goNext} onBack={goBack} onSkip={handleSkip} isCompleting={isCompleting} />
                )}
                {step === 3 && (
                  <StepTips onNext={goNext} onBack={goBack} onSkip={handleSkip} isCompleting={isCompleting} />
                )}
                {step === 4 && (
                  <StepReady onComplete={handleComplete} onBack={goBack} isCompleting={isCompleting} />
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// Step 1 — Welcome
// ============================================================================

function StepWelcome({
  firstName,
  onNext,
  onSkip,
  isCompleting,
}: {
  firstName: string
  onNext: () => void
  onSkip: () => void
  isCompleting: boolean
}) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <LoonaBrand size="xl" variant="gradient" animated={false} />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Loona, {firstName}!
        </h1>
        <p className="text-muted-foreground text-lg">
          Track loans, collect payments, and manage your lending business — all in one place.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/50 overflow-hidden">
        <img
          src="/onboarding/step-dashboard.png"
          alt="Dashboard overview"
          className="w-full h-auto"
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = "none"
            target.nextElementSibling?.classList.remove("hidden")
          }}
        />
        <div className="hidden flex items-center justify-center h-40 text-muted-foreground text-sm">
          <div className="text-center space-y-2">
            <Rocket className="h-8 w-8 mx-auto text-primary" weight="duotone" />
            <p>Your dashboard awaits</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" className="gap-2 px-8" onClick={onNext}>
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          onClick={onSkip}
          disabled={isCompleting}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Skip intro
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Step 2 — Add your first contact
// ============================================================================

function StepContacts({
  onNext,
  onBack,
  onSkip,
  isCompleting,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  isCompleting: boolean
}) {
  const [contactAdded, setContactAdded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string

    try {
      await createContact({
        data: {
          name,
          phone: phone || undefined,
        },
      })
      toast.success(`${name} added as a contact`)
      setContactAdded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact")
      setSaving(false)
    }
  }

  if (contactAdded) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto">
          <CheckCircle className="h-6 w-6 text-primary" weight="fill" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Contact added!
          </h2>
          <p className="text-muted-foreground">
            You can add more contacts anytime from your dashboard.
          </p>
        </div>
        <Button size="lg" className="gap-2 px-8" onClick={onNext}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto">
          <UserPlus className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Add your first contact
        </h2>
        <p className="text-muted-foreground">
          Contacts are your borrowers. Add one now to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="onboard-name">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="onboard-name"
              name="name"
              placeholder="Juan dela Cruz"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboard-phone">Phone Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <PhoneInput
            id="onboard-phone"
            value={phone}
            onValueChange={setPhone}
          />
        </div>

        {error && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="lg" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" size="lg" className="gap-2 px-6" disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Add Contact
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onNext}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              I'll do this later
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              type="button"
              onClick={onSkip}
              disabled={isCompleting}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Skip intro
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// Step 3 — Quick tips
// ============================================================================

const tips = [
  {
    icon: CurrencyCircleDollar,
    title: "Create a loan",
    description: "Set up loan terms, interest rates, and payment schedules in just a few clicks.",
    image: "/onboarding/step-loans.png",
  },
  {
    icon: Coins,
    title: "Record payments",
    description: "Log collections instantly — cash, GCash, Maya, or bank transfer.",
    image: "/onboarding/step-payments.png",
  },
  {
    icon: UsersThree,
    title: "Invite agents",
    description: "Add collection agents and track their performance and commissions.",
    image: "/onboarding/step-agents.png",
  },
]

function StepTips({
  onNext,
  onBack,
  onSkip,
  isCompleting,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  isCompleting: boolean
}) {
  const [tipIndex, setTipIndex] = useState(0)
  const tip = tips[tipIndex]
  const isLastTip = tipIndex === tips.length - 1

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Quick tips
        </h2>
        <p className="text-muted-foreground">
          Here's what you can do with Loona.
        </p>
      </div>

      {/* Carousel */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Screenshot */}
            <div className="rounded-lg border bg-muted/50 overflow-hidden">
              <img
                src={tip.image}
                alt={tip.title}
                className="w-full h-auto"
                onError={(e) => {
                  const target = e.currentTarget
                  target.style.display = "none"
                  target.nextElementSibling?.classList.remove("hidden")
                }}
              />
              <div className="hidden flex items-center justify-center h-44 text-muted-foreground">
                <tip.icon className="h-12 w-12 text-primary/30" weight="duotone" />
              </div>
            </div>

            {/* Title + description */}
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <tip.icon className="h-5 w-5 text-primary" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold">{tip.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tip.description}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots + carousel nav */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTipIndex((i) => i - 1)}
            disabled={tipIndex === 0}
            className="gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Prev
          </Button>

          <div className="flex items-center gap-2">
            {tips.map((_, i) => (
              <button
                key={i}
                onClick={() => setTipIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === tipIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTipIndex((i) => i + 1)}
            disabled={isLastTip}
            className="gap-1"
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Step navigation */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button size="lg" className="gap-2 px-8" onClick={onNext}>
            {isLastTip ? "Next" : "Skip tips"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <button
          onClick={onSkip}
          disabled={isCompleting}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Skip intro
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Step 4 — You're all set!
// ============================================================================

function StepReady({
  onComplete,
  onBack,
  isCompleting,
}: {
  onComplete: () => void
  onBack: () => void
  isCompleting: boolean
}) {
  useEffect(() => {
    const end = Date.now() + 1500
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [])

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <motion.div
          className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            damping: 10,
            stiffness: 150,
            delay: 0.2,
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              damping: 8,
              stiffness: 200,
              delay: 0.4,
            }}
          >
            <Check className="h-10 w-10 text-primary" weight="bold" />
          </motion.div>
        </motion.div>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          You're ready to go!
        </h2>
        <p className="text-muted-foreground text-lg">
          Your dashboard is set up and ready. Start by adding a contact and creating your first loan.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            size="lg"
            className="gap-2 px-8"
            onClick={onComplete}
            disabled={isCompleting}
          >
            {isCompleting ? "Setting up..." : "Go to Dashboard"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
