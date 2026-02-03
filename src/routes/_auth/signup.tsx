import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { signUp } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner, User, Envelope, Lock, ArrowRight, CheckCircle } from "@phosphor-icons/react"
import { LoonaBrand, AnimatedTagline } from "@/components/ui/loona-brand"

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const passwordRequirements = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: password === confirmPassword && password.length > 0, text: "Passwords match" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Failed to create account")
        setLoading(false)
        return
      }

      router.navigate({ to: "/dashboard" })
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
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
          <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
          <p className="text-muted-foreground">
            Start managing your loans in minutes
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Full name
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="Juan dela Cruz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="name"
              />
            </div>
          </div>

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
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="new-password"
              />
            </div>
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
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-11"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Password requirements */}
          {(password || confirmPassword) && (
            <div className="space-y-2">
              {passwordRequirements.map((req) => (
                <div key={req.text} className="flex items-center gap-2 text-xs">
                  <CheckCircle
                    className={`h-4 w-4 ${req.met ? "text-green-600" : "text-muted-foreground/50"}`}
                    weight={req.met ? "fill" : "regular"}
                  />
                  <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
                    {req.text}
                  </span>
                </div>
              ))}
            </div>
          )}

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
                Creating account...
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
