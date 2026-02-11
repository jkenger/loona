import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/agent/commission-program")({
  beforeLoad: () => {
    throw redirect({ to: "/agent/earnings" })
  },
})
