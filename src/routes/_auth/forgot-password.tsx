import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { forgetPassword } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner, Envelope, ArrowRight, ArrowLeft, CheckCircle } from "@phosphor-icons/react"
import { LoonaBrand, AnimatedTagline } from "@/components/ui/loona-brand"

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await forgetPassword({
        email,
        redirectTo: "/reset-password",
      })

      if (result.error) {
        setError(result.error.message || "Failed to send reset email")
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
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
            We've sent a password reset link to <strong className="text-foreground">{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            The link will expire in 1 hour. If you don't see the email, check your spam folder.
          </p>
          <Link to="/login">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Button>
          </Link>
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

      {/* Form Card */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="space-y-2 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Forgot password?</h2>
          <p className="text-muted-foreground">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
                Sending...
              </>
            ) : (
              <>
                Send reset link
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link to="/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
