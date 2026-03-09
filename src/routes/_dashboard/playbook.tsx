import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useRef } from "react"
import { toast } from "sonner"
import { getPlaybook, savePlaybookSection } from "@/server/playbook"
import { PLAYBOOK_SECTIONS } from "@/lib/constants/playbook-sections"
import { TiptapEditor } from "@/components/blog/tiptap-editor"
import { Button } from "@/components/ui/button"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { AccessDenied } from "@/components/access-denied"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  CaretDown,
  FloppyDisk,
  Spinner,
  BookOpenText,
  CheckCircle,
  ChartBar,
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
  pendingComponent: PlaybookSkeleton,
  component: PlaybookPage,
})

function PlaybookSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border shadow-sm p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border shadow-sm p-5 space-y-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const totalCount = PLAYBOOK_SECTIONS.length
  const progressPercent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0

  return (
    <Stagger className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BookOpenText className="h-7 w-7 text-primary" weight="duotone" />
            Playbook
          </h1>
          <p className="text-muted-foreground mt-1">
            Your lending handbook — document guidelines for yourself and your agents
          </p>
        </div>
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={cn(
              "px-3 py-1 transition-colors",
              lang === "en"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("tl")}
            className={cn(
              "px-3 py-1 transition-colors",
              lang === "tl"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Tagalog
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <StaggerItem className="grid gap-5 lg:grid-cols-5">
        {/* Left Column — Sections */}
        <div className="lg:col-span-3 space-y-3">
          {PLAYBOOK_SECTIONS.map((section) => {
            const isExpanded = expandedKeys.has(section.key)
            const isSaving = savingKeys.has(section.key)
            const hasContent = !!getContent(section.key)
            const Icon = section.icon
            const langKey = `${section.key}:${lang}`

            return (
              <div key={section.key} className="rounded-xl border shadow-sm overflow-hidden">
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
                    className={cn(
                      "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-3">
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
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right Column — Progress */}
        <div className="lg:col-span-2 space-y-5">
          {/* Completion Progress */}
          <div className="rounded-xl border shadow-sm">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2">
                <ChartBar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Completion</h3>
              </div>
            </div>
            <div className="p-5 pt-0">
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-3xl font-bold">{progressPercent}%</p>
                <p className="text-sm text-muted-foreground">{filledCount} of {totalCount} sections</p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Section checklist */}
              <div className="space-y-0">
                {PLAYBOOK_SECTIONS.map((section) => {
                  const hasContent = !!getContent(section.key)
                  const Icon = section.icon
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => {
                        if (!expandedKeys.has(section.key)) {
                          toggleSection(section.key)
                        }
                        // Scroll left column section into view
                        document.getElementById(`section-${section.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }}
                      className="flex items-center gap-3 py-2.5 border-b last:border-0 -mx-5 px-5 hover:bg-muted/50 transition-colors w-full text-left"
                    >
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        hasContent ? "bg-green-500" : "bg-muted-foreground/30"
                      )} />
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cn(
                        "text-sm flex-1 truncate",
                        hasContent ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {section.title}
                      </span>
                      {hasContent && (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" weight="fill" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </StaggerItem>
    </Stagger>
  )
}
