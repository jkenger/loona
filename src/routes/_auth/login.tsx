import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { signIn } from "@/lib/auth-client"
import { getDashboardPath } from "@/lib/constants/roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner, Envelope, Lock, ArrowRight, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react"
import { LoonaBrand, AnimatedTagline } from "@/components/ui/loona-brand"

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: (search.error as string) || undefined,
  }),
  component: LoginPage,
})

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function getErrorMessage(error?: string): string | null {
  if (!error) return null
  if (error === "UNABLE_TO_CREATE_USER" || error === "unable_to_create_user") {
    return "Your account hasn't been approved yet. Please check your email for an invite, or join the waitlist if you haven't already."
  }
  return "Something went wrong during sign-in. Please try again."
}

function LoginPage() {
  const router = useRouter()
  const { error: urlError } = Route.useSearch()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const urlErrorMessage = getErrorMessage(urlError)

  const handleGoogleSignIn = async () => {
    setError("")
    setGoogleLoading(true)

    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      })
    } catch {
      setError("Something went wrong. Please try again.")
      setGoogleLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn.magicLink({
        email,
        callbackURL: "/dashboard",
      })

      if (result.error) {
        setError(result.error.message || "Failed to send login link")
        setLoading(false)
        return
      }

      setMagicLinkSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Invalid credentials")
        setLoading(false)
        return
      }

      const user = result.data?.user as { role?: string } | undefined
      const role = user?.role
      router.navigate({ to: getDashboardPath(role) })
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="space-y-8">
        {/* Header - visible on mobile only */}
        <div className="lg:hidden text-center">
          <LoonaBrand size="lg" variant="gradient" animated />
          <AnimatedTagline
            text="Loan Management Made Simple"
            className="text-muted-foreground text-sm mt-1"
            delay={0.5}
          />
        </div>

        {/* Success Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-primary" weight="fill" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Check your email</h2>
          <p className="text-muted-foreground mb-6">
            We've sent a login link to <strong className="text-foreground">{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            The link will expire in 15 minutes. If you don't see the email, check your spam folder.
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setMagicLinkSent(false)
              setEmail("")
            }}
          >
            Try a different email
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header - visible on mobile only */}
      <div className="lg:hidden text-center">
        <LoonaBrand size="lg" variant="gradient" animated />
        <AnimatedTagline
          text="Loan Management Made Simple"
          className="text-muted-foreground text-sm mt-1"
          delay={0.5}
        />
      </div>

      {/* URL Error Banner (e.g., waitlist rejection from OAuth callback) */}
      {urlErrorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl">
          {urlErrorMessage}
        </div>
      )}

      {/* Form Card */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="text-muted-foreground">
            Sign in to access your account
          </p>
        </div>

        {/* Primary: Google Sign In */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 gap-3 font-medium"
          disabled={googleLoading}
          onClick={handleGoogleSignIn}
        >
          {googleLoading ? (
            <>
              <Spinner className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <GoogleIcon className="h-5 w-5" />
              Sign in with Google
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Secondary / Tertiary: Magic link or Password form */}
        {showPasswordForm ? (
          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setError("") }}
                className="text-primary hover:underline font-medium"
              >
                Sign in with magic link instead
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Sending link...
                </>
              ) : (
                <>
                  Send login link
                  <PaperPlaneTilt className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(true); setError("") }}
                className="text-primary hover:underline font-medium"
              >
                Sign in with password instead
              </button>
            </p>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/" className="text-primary hover:underline font-medium">
          Join the waitlist
        </Link>
      </p>
    </div>
  )
}
