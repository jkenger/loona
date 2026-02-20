import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/settings/penalty-settings")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/member-tiers" })
  },
  component: () => null,
})
