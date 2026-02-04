import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { resetPassword } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner, Lock, ArrowRight, CheckCircle, Warning } from "@phosphor-icons/react"
import { LoonaBrand, AnimatedTagline } from "@/components/ui/loona-brand"

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const result = await resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        setError(result.error.message || "Failed to reset password")
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // No token provided
  if (!token) {
    return (
      <div className="space-y-8">
        <div className="lg:hidden text-center">
          <LoonaBrand size="lg" variant="gradient" animated />
          <AnimatedTagline
            text="Loan Management Made Simple"
            className="text-muted-foreground text-sm mt-1"
            delay={0.5}
          />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Warning className="h-8 w-8 text-destructive" weight="fill" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Invalid link</h2>
          <p className="text-muted-foreground mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/forgot-password">
            <Button className="gap-2">
              Request a new link
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-8">
        <div className="lg:hidden text-center">
          <LoonaBrand size="lg" variant="gradient" animated />
          <AnimatedTagline
            text="Loan Management Made Simple"
            className="text-muted-foreground text-sm mt-1"
            delay={0.5}
          />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-primary" weight="fill" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Password reset!</h2>
          <p className="text-muted-foreground mb-6">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <Link to="/login">
            <Button className="gap-2">
              Sign in
              <ArrowRight className="h-4 w-4" />
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
          <h2 className="text-2xl font-semibold tracking-tight">Set new password</h2>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              New password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="new-password"
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
                Resetting...
              </>
            ) : (
              <>
                Reset password
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
