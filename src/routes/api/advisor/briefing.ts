import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { buildBriefing } from "@/server/advisor-briefing"

export const Route = createFileRoute("/api/advisor/briefing")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        }

        try {
          const content = await buildBriefing(session.user.id)
          return new Response(JSON.stringify({ content }), {
            headers: { "Content-Type": "application/json" },
          })
        } catch (error) {
          console.error("Briefing error:", error)
          return new Response(JSON.stringify({ error: "Failed to build briefing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }
      },
    },
  },
})
