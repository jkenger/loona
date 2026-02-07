import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_auth/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
  component: () => null,
})
