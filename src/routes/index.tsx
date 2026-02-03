import { createFileRoute, redirect } from "@tanstack/react-router"
import { getServerSession } from "@/server/session"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: "/dashboard" })
    }
    throw redirect({ to: "/login" })
  },
  component: () => null,
})
