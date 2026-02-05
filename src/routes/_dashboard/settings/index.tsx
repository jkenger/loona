import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useSession, changePassword, updateUserName } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  User,
  Envelope,
  Lock,
  Spinner,
  Check,
  Eye,
  EyeSlash,
  PencilSimple,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/settings/")({
  component: SettingsPage,
})

function SettingsPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // Profile edit state
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState("")
  const [isSavingName, setIsSavingName] = useState(false)

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  const user = session?.user

  const handleEditName = () => {
    setNewName(user?.name || "")
    setIsEditingName(true)
  }

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      toast.error("Name must be at least 2 characters")
      return
    }

    setIsSavingName(true)
    try {
      const result = await updateUserName({ name: newName.trim() })
      if (result.error) {
        toast.error(result.error.message)
      } else {
        toast.success("Name updated successfully")
        setIsEditingName(false)
        router.invalidate()
      }
    } catch {
      toast.error("Failed to update name")
    } finally {
      setIsSavingName(false)
    }
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setNewName("")
  }

  const openPasswordDialog = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError("")
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowPasswordDialog(true)
  }

  const handleChangePassword = async () => {
    setPasswordError("")

    // Validation
    if (!currentPassword) {
      setPasswordError("Current password is required")
      return
    }
    if (!newPassword) {
      setPasswordError("New password is required")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password")
      return
    }

    setIsChangingPassword(true)
    try {
      const result = await changePassword({ currentPassword, newPassword })
      if (result.error) {
        setPasswordError(result.error.message)
      } else {
        toast.success("Password changed successfully")
        setShowPasswordDialog(false)
      }
    } catch {
      setPasswordError("Failed to change password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div>
      {/* Header with background */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Meta Bar */}
          <div className="flex items-center gap-2 text-sm text-blue-200/70">
            <span>Settings</span>
            <span className="text-blue-300/40">·</span>
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>

          {/* Title Row */}
          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
            <p className="text-blue-200/70">Manage your account and preferences</p>
          </div>
        </div>
      </div>

      {/* Content - overlaps header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        <div className="max-w-2xl space-y-6">
          {/* Profile Card */}
          <Card className="shadow-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label>Name</Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Your name"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={isSavingName}
                    >
                      {isSavingName ? (
                        <Spinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEditName}
                      disabled={isSavingName}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                      <span className="font-medium">{user.name || "—"}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEditName}
                      className="gap-1"
                    >
                      <PencilSimple className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-3 p-3 rounded border bg-muted/30">
                  <Envelope className="h-5 w-5 text-muted-foreground" />
                  <span>{user.email}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              {/* Account created */}
              <div className="text-sm text-muted-foreground pt-2 border-t">
                Account created: {user.createdAt ? format(new Date(user.createdAt), "MMMM d, yyyy") : "—"}
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="shadow-lg">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Security
              </CardTitle>
              <CardDescription>Manage your password</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">
                      Last changed: Unknown
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={openPasswordDialog}>
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            {passwordError && (
              <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
                {passwordError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
              disabled={isChangingPassword}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Spinner className="h-4 w-4 animate-spin mr-2" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
