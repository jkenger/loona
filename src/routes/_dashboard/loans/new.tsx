import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

const searchSchema = z.object({
  contactId: z.string().optional(),
})

export const Route = createFileRoute("/_dashboard/loans/new")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/loans/new-wizard",
      search: search.contactId ? { contactId: search.contactId } : undefined,
    })
  },
})
