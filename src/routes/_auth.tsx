import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { getServerSession } from "@/server/session"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    // Redirect to dashboard if already authenticated
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-page p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
