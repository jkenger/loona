import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/contacts/")({
  beforeLoad: () => {
    throw redirect({ to: "/loans" })
  },
})
