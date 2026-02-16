import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useRef } from "react"
import { toast } from "sonner"
import { getPlaybook, savePlaybookSection } from "@/server/playbook"
import { PLAYBOOK_SECTIONS } from "@/lib/constants/playbook-sections"
import { TiptapEditor } from "@/components/blog/tiptap-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import {
  CaretDown,
  FloppyDisk,
  Spinner,
  BookOpenText,
  NotePencil,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_dashboard/playbook")({
  loader: async ({ context }) => {
    const { session } = context as { session: { user: { role: string | null } } }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { sections: {}, unauthorized: true }
    }
    const sections = await getPlaybook()
    return { sections, unauthorized: false }
  },
  component: PlaybookPage,
})

type Lang = "en" | "tl"

function PlaybookPage() {
  const { sections: initialSections, unauthorized } = Route.useLoaderData()
  const router = useRouter()
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const [lang, setLang] = useState<Lang>("en")
  const editorContent = useRef<Record<string, string>>({})

  if (unauthorized) {
    return <AccessDenied />
  }

  const getContent = (key: string): string | null => {
    const section = initialSections[key]
    if (!section) return null
    return lang === "tl" ? section.contentTl : section.content
  }

  // Initialize editor content from loaded data for current language
  for (const section of PLAYBOOK_SECTIONS) {
    const langKey = `${section.key}:${lang}`
    if (!(langKey in editorContent.current)) {
      const content = getContent(section.key)
      if (content) {
        editorContent.current[langKey] = content
      }
    }
  }

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

  const handleSave = async (sectionKey: string) => {
    const langKey = `${sectionKey}:${lang}`
    const content = editorContent.current[langKey]
    if (!content) {
      toast.error("Nothing to save — start writing first")
      return
    }

    setSavingKeys((prev) => new Set(prev).add(sectionKey))
    try {
      await savePlaybookSection({ data: { sectionKey, content, language: lang } })
      toast.success("Section saved")
      router.invalidate()
    } catch {
      toast.error("Failed to save section")
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev)
        next.delete(sectionKey)
        return next
      })
    }
  }

  const filledCount = PLAYBOOK_SECTIONS.filter(
    (s) => getContent(s.key)
  ).length

  return (
    <div>
      {/* Dark hero header */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
                <BookOpenText className="h-7 w-7 text-primary" weight="duotone" />
                Playbook
              </h1>
              <p className="text-blue-200/70 mt-1">
                Your lending handbook — document guidelines for yourself and your agents
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-white/20 overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={`px-3 py-1 transition-colors ${
                    lang === "en"
                      ? "bg-primary text-white"
                      : "text-blue-200/70 hover:text-white hover:bg-white/10"
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
                      : "text-blue-200/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Tagalog
                </button>
              </div>
              <span className="text-sm text-blue-200/50">
                {filledCount} of {PLAYBOOK_SECTIONS.length} sections filled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content - overlapping header */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 relative">
        <Stagger className="space-y-4">
          {PLAYBOOK_SECTIONS.map((section) => {
            const isExpanded = expandedKeys.has(section.key)
            const isSaving = savingKeys.has(section.key)
            const hasContent = !!getContent(section.key)
            const Icon = section.icon
            const langKey = `${section.key}:${lang}`

            return (
              <StaggerItem key={section.key}>
                <Card className="shadow-sm overflow-hidden">
                  {/* Section header - clickable */}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="h-5 w-5 text-primary" weight="duotone" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{section.title}</h3>
                        {hasContent ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                            Filled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                            Empty
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                    </div>
                    <CaretDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      <TiptapEditor
                        key={langKey}
                        content={getContent(section.key) ?? undefined}
                        onChange={(json) => {
                          editorContent.current[langKey] = json
                        }}
                        placeholder={`Write your ${section.title.toLowerCase()} guidelines here${lang === "tl" ? " (Tagalog)" : ""}...`}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSave(section.key)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Spinner className="h-4 w-4 animate-spin mr-1.5" />
                          ) : (
                            <FloppyDisk className="h-4 w-4 mr-1.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </div>
  )
}
