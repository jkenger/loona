import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/tools/")({
  beforeLoad: () => {
    throw redirect({ to: "/tools/estimator" })
  },
})
