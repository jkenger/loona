---
name: ui-ux
description: Design and implement polished, production-grade UI pages and components for the Loona lending app. Use when redesigning pages, building new screens, or improving visual consistency. Follows the established Loona design system with shadcn/ui, Phosphor icons, and TanStack Router.
---

# Loona UI/UX Design Skill

Design and implement senior-level UI for the Loona lending platform. All output must be production-ready React/TSX using the existing stack.

## Stack & Constraints

- **Framework**: TanStack Start (React SSR), TanStack Router file-based routes
- **Components**: shadcn/ui — use existing components, never introduce new UI libraries
- **Icons**: `@phosphor-icons/react` — `weight="bold"` for icon badges, default weight inline
- **Styling**: Tailwind CSS utility classes only — no custom CSS files
- **Theme**: Supports light/dark via `dark:` variants — always add dark mode classes
- **Layout root**: `px-4 sm:px-6 lg:px-8 py-6` container with `max-w-3xl mx-auto` (settings/forms) or `max-w-4xl mx-auto` (wider content)

## Design System Components

These reusable components are the foundation. Define them locally in each file (copy-paste pattern, not imported):

```tsx
function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card", className)}>{children}</div>
}

function SectionHeader({ icon: IconComp, title, description }: { icon: Icon; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <IconComp className="h-4.5 w-4.5 text-muted-foreground" weight="bold" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children, border = true }: {
  label: string; description?: string; children: React.ReactNode; border?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-3.5", border && "border-t")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
```

Import `type Icon from "@phosphor-icons/react"` for the SectionHeader prop type.

## Page Layout Pattern

Every settings/form page follows this structure:

```tsx
<div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
  {/* Header with back link */}
  <div>
    <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
      <ArrowLeft className="h-3.5 w-3.5" />
      Settings
    </Link>
    <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
    <p className="text-sm text-muted-foreground mt-1">Brief description of what this page does.</p>
  </div>

  {/* Sections */}
  <Section>
    <SectionHeader icon={SomeIcon} title="Section Title" description="Optional subtitle" />
    <SettingRow label="Setting Name" description="Optional description">
      {/* control: Switch, Select, Input, Button */}
    </SettingRow>
  </Section>

  {/* Save button */}
  <div className="flex justify-end pb-4">
    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
      {isSaving ? <><Spinner className="h-4 w-4 animate-spin" />Saving...</> : "Save Settings"}
    </Button>
  </div>
</div>
```

## Visual Specifications

### Controls
- `Switch` for boolean toggles — right-aligned in SettingRow
- `Input` for text/numbers: `className="h-8 text-sm"` (compact), `w-32` for narrow numeric fields
- `Select` + `SelectTrigger`: `className="h-8 text-sm"`
- `Label`: `className="text-xs text-muted-foreground"` above each control
- Number inputs: always set `min`, `max`, `step` — use `parseInt`/`parseFloat` with `|| 0` fallback

### Spacing & Borders
- First `SettingRow` in a section: `border={false}` or naturally after `SectionHeader`'s `pb-4`
- Subsequent rows: `border-t` (default `border={true}`)
- Inline sub-fields (shown when a toggle is on): `px-5 pb-4 pt-1` wrapper with `space-y-3` or `grid gap-4 sm:grid-cols-2`
- Bottom spacer before save: `<div className="h-1" />` inside last section

### Icon Badge Sizing
- Icon badge container: `h-9 w-9 rounded-lg bg-muted`
- Icon inside: `h-4.5 w-4.5` (Tailwind arbitrary `h-[1.125rem]` equivalent)

### Info / Warning Boxes
```tsx
{/* Blue info box */}
<div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4">
  <div className="flex items-start gap-3">
    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
    <div className="space-y-2 text-sm text-muted-foreground">
      <p className="font-medium text-foreground text-xs">Title</p>
      <p className="text-xs">Body text...</p>
    </div>
  </div>
</div>

{/* Amber warning inset (inside blue box or standalone) */}
<div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-700 dark:text-amber-400">
  Warning message here.
</div>
```

## Dashboard / List Pages

For pages with sidebar navigation (e.g., commission settings with multiple sub-sections):

```tsx
{/* Desktop: sticky sidebar + content */}
<div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-6 space-y-6 lg:space-y-0">
  <aside className="lg:sticky lg:top-6 lg:self-start space-y-2">
    <div className="rounded-xl border bg-card p-2">
      {/* nav items */}
    </div>
  </aside>
  <main className="space-y-6">
    {/* sections */}
  </main>
</div>

{/* Mobile: horizontal scroll tabs */}
<div className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
  {tabs.map(tab => (
    <button key={tab.id} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
      active === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
    )}>
      {tab.label}
    </button>
  ))}
</div>
```

## State Patterns

```tsx
// Config state (for settings pages loaded from server)
const [config, setConfig] = useState<ConfigType>(initialConfig)
const [isSaving, setIsSaving] = useState(false)

const update = (partial: Partial<ConfigType>) => setConfig(prev => ({ ...prev, ...partial }))

// Nested update
update({ nestedField: { ...config.nestedField, key: value } })
```

## Modals / Onboarding

For feature announcement modals (shown once per lender via a `seen` flag in config):

- Use shadcn `Dialog` + `DialogContent`
- Gradient header: `bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white rounded-t-xl`
- Feature grid: `grid grid-cols-2 gap-3` with colored icon tiles (`bg-blue-50 dark:bg-blue-950/40 rounded-lg p-3`)
- Primary CTA: full-width `Button` + subtle `text-xs text-muted-foreground` skip link below
- Dismiss on both actions, save seen state silently

## Rules

1. **Read before editing** — always read the current file before modifying it
2. **Match existing patterns** — check nearby pages for conventions before introducing new ones
3. **No new dependencies** — use what's already installed
4. **Compact controls** — prefer `h-8` inputs/selects over full-height defaults in settings forms
5. **Dark mode always** — every color utility needs a `dark:` counterpart
6. **Keep it minimal** — don't add features not asked for; don't over-engineer layouts
7. **Consistent page structure** — every settings sub-page uses the same back-link + h1 + description header pattern
