import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_dashboard/contacts/new")({
  beforeLoad: () => {
    throw redirect({ to: "/loans" })
  },
})
