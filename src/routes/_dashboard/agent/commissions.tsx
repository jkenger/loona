import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/agent/commissions")({
  beforeLoad: () => {
    throw redirect({ to: "/agent/earnings" })
  },
})
