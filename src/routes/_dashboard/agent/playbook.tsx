import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getPlaybookForAgent } from "@/server/playbook"
import { PLAYBOOK_SECTIONS } from "@/lib/constants/playbook-sections"
import { TiptapRenderer } from "@/components/blog/tiptap-renderer"
import { Card, CardContent } from "@/components/ui/card"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  CaretDown,
  Info,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/agent/playbook")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.AGENT)) {
      return { lenders: [], unauthorized: true }
    }
    const lenders = await getPlaybookForAgent()
    return { lenders, unauthorized: false }
  },
  component: AgentPlaybookPage,
})

type Lang = "en" | "tl"

function AgentPlaybookPage() {
  const { lenders, unauthorized } = Route.useLoaderData()
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [lang, setLang] = useState<Lang>("en")

  if (unauthorized) {
    return <AccessDenied />
  }

  const showLenderHeadings = lenders.length > 1

  const toggleSection = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const getSectionContent = (sections: Record<string, { content: string | null; contentTl: string | null }>, key: string): string | null => {
    const section = sections[key]
    if (!section) return null
    return lang === "tl" ? section.contentTl : section.content
  }

  const hasAnyContent = lenders.some((l) =>
    PLAYBOOK_SECTIONS.some((s) => getSectionContent(l.sections, s.key))
  )

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <StaggerItem>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Playbook</h1>
            <p className="text-muted-foreground mt-1">
              Lending guidelines from your lender
            </p>
          </div>
          <div className="inline-flex rounded-md border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-3 py-1 transition-colors ${
                lang === "en"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang("tl")}
              className={`px-3 py-1 transition-colors ${
                lang === "tl"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Tagalog
            </button>
          </div>
        </div>
      </StaggerItem>

      {lenders.length === 0 || !hasAnyContent ? (
        <StaggerItem>
          <Card className="shadow-sm rounded-xl">
            <CardContent className="py-12 text-center">
              <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {lang === "tl"
                  ? "Walang available na playbook content sa Tagalog. Hindi pa naisulat ng iyong lender ang kanilang mga alituntunin sa Tagalog."
                  : "No playbook content available yet. Your lender hasn't documented their guidelines."}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      ) : (
        lenders.map((lender) => (
          <StaggerItem key={lender.lenderId}>
            {showLenderHeadings && (
              <h2 className="text-lg font-semibold mb-4">{lender.lenderName}</h2>
            )}
            <div className="space-y-4">
              {PLAYBOOK_SECTIONS.map((section) => {
                const content = getSectionContent(lender.sections, section.key)
                const compositeKey = `${lender.lenderId}:${section.key}`
                const isExpanded = expandedKeys.has(compositeKey)
                const Icon = section.icon

                return (
                  <Card key={section.key} className="shadow-sm rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection(compositeKey)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
                        <Icon className="h-5 w-5 text-primary" weight="duotone" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{section.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {section.description}
                        </p>
                      </div>
                      {content ? (
                        <CaretDown
                          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          Not documented
                        </span>
                      )}
                    </button>

                    {isExpanded && (
                      <CardContent className="px-4 pb-4 pt-0">
                        {content ? (
                          <TiptapRenderer content={content} />
                        ) : (
                          <p className="text-sm text-muted-foreground italic py-4">
                            {lang === "tl"
                              ? "Hindi pa naisulat ng iyong lender ang seksyong ito sa Tagalog."
                              : "Not yet documented by your lender."}
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          </StaggerItem>
        ))
      )}
    </Stagger>
  )
}
