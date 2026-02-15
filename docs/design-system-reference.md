# Design System Reference

A practical, copy-paste-ready guide for building polished apps with shadcn/ui and Tailwind CSS. Derived from the Loona design system — a professional-grade lending platform UI.

---

## 1. The Formula

Starting from shadcn defaults, the recipe that turns a generic UI into something polished:

1. **Pick a primary hue** (Loona uses 207 — a professional blue)
2. **Tint your neutrals** — every gray (background, border, muted) carries a faint wash of that hue
3. **Two fonts** — a geometric sans for body (`Manrope`), a sharper geometric sans for brand/logo (`Sora`)
4. **Dark header anchor** — a fixed dark navigation bar gives every page a strong visual anchor
5. **Mesh gradient background** — stacked radial gradients at very low opacity add depth without distraction
6. **Staggered entrances** — content fades-and-slides in with staggered 100ms delays
7. **Consistent radius/shadow/ring** — one base radius (`0.5rem`), one shadow level per layer, one ring style for focus

Every section below covers one of these layers with the exact values and code to reproduce it.

---

## 2. Color System

### Principle

Generic shadcn uses pure grays (`hsl(0 0% ...)`) for backgrounds, borders, and muted text. This looks flat. By shifting every neutral to carry a faint tint of your primary hue, the entire palette feels cohesive — surfaces and accents share the same DNA.

### Pattern

Choose one primary hue (e.g. `207` for blue). Then:

- **Backgrounds/surfaces** — use that hue at 10-20% saturation, high lightness
- **Borders/inputs** — same hue, 12-15% saturation, ~90% lightness
- **Muted text** — same hue, 8% saturation, ~46% lightness
- **Primary** — full saturation at your hue (`207 83% 49%`)
- **Dark mode** — shift the neutral hue slightly (210 → 220), drop lightness, keep the tint

### Starter Snippet — Light Mode

```css
:root {
  /* Primary */
  --primary: hsl(207 83% 49%);
  --primary-foreground: hsl(0 0% 100%);

  /* Tinted neutrals */
  --background: hsl(210 20% 98%);
  --foreground: hsl(210 15% 12%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(210 15% 12%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(210 15% 12%);
  --secondary: hsl(210 12% 95%);
  --secondary-foreground: hsl(210 15% 22%);
  --muted: hsl(210 12% 95%);
  --muted-foreground: hsl(210 8% 46%);
  --accent: hsl(210 12% 93%);
  --accent-foreground: hsl(210 15% 22%);
  --destructive: hsl(0 72% 51%);
  --border: hsl(210 12% 90%);
  --input: hsl(210 12% 90%);
  --ring: hsl(207 83% 49%);

  /* Chart scale — same hue, descending lightness */
  --chart-1: hsl(207 83% 49%);
  --chart-2: hsl(207 83% 42%);
  --chart-3: hsl(207 83% 35%);
  --chart-4: hsl(207 83% 28%);
  --chart-5: hsl(207 83% 21%);

  --radius: 0.5rem;
}
```

### Starter Snippet — Dark Mode

```css
.dark {
  --background: hsl(220 20% 9%);
  --foreground: hsl(210 12% 93%);
  --card: hsl(220 20% 12%);
  --card-foreground: hsl(210 12% 93%);
  --popover: hsl(220 20% 12%);
  --popover-foreground: hsl(210 12% 93%);
  --primary: hsl(207 83% 55%);        /* bump lightness for contrast */
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(220 15% 18%);
  --secondary-foreground: hsl(210 12% 88%);
  --muted: hsl(220 15% 18%);
  --muted-foreground: hsl(210 8% 55%);  /* bump lightness for readability */
  --accent: hsl(220 15% 20%);
  --accent-foreground: hsl(210 12% 93%);
  --destructive: hsl(0 72% 51%);
  --border: hsl(220 15% 22%);
  --input: hsl(220 15% 18%);
  --ring: hsl(207 83% 55%);

  --chart-1: hsl(207 83% 55%);
  --chart-2: hsl(207 83% 48%);
  --chart-3: hsl(207 83% 41%);
  --chart-4: hsl(207 83% 34%);
  --chart-5: hsl(207 83% 27%);
}
```

### Adapting to Another Hue

To recolor the entire system, change three numbers:

| Token | What to change |
|-------|---------------|
| `--primary` | Your hue + full saturation (e.g. `160 70% 42%` for green) |
| Neutrals (210/220 hues above) | Replace `210`/`220` with your hue ± 3-5 degrees |
| Chart scale | Same hue as primary, step lightness down in 7% increments |

Everything else (saturation levels, lightness curves, dark mode offsets) stays the same.

---

## 3. Typography

### Principle

One font for everything looks monotonous. Two complementary fonts — one for body text, one for brand elements — create visual hierarchy without complexity.

### Pattern

| Role | Font | Usage |
|------|------|-------|
| Body (`--font-sans`) | [Manrope Variable](https://fontsource.org/fonts/manrope) | Everything: paragraphs, labels, buttons, nav |
| Brand (`--font-brand`) | [Sora Variable](https://fontsource.org/fonts/sora) | Logo, marketing headlines |

### Sizing Hierarchy

| Level | Classes | Usage |
|-------|---------|-------|
| Page title | `text-4xl font-bold tracking-tight` | One per page, inside the dark header |
| Section heading | `text-lg font-semibold` | Card group labels, section dividers |
| Card title | `text-sm font-medium` | KPI card headers, small card labels |
| Body | `text-sm` (default) | General content |
| Helper text | `text-xs text-muted-foreground` | Timestamps, secondary info |
| Micro label | `text-[10px] font-medium` | Badge text, category tags |

### Starter Snippet

```css
@import "@fontsource-variable/manrope";
@import "@fontsource-variable/sora";

@theme inline {
  --font-sans: 'Manrope Variable', sans-serif;
  --font-brand: 'Sora Variable', sans-serif;
}

@layer base {
  body {
    @apply font-sans bg-background text-foreground antialiased;
  }
}
```

Brand usage in JSX:

```tsx
<span
  className="font-bold text-xl"
  style={{ fontFamily: "var(--font-brand)" }}
>
  YourBrand
</span>
```

---

## 4. Dark Header Anchor

### Principle

A full-width dark navigation bar at the top of every authenticated page creates a strong visual anchor. The dark surface naturally separates chrome from content and makes the logo, nav links, and user menu readable regardless of light/dark mode.

### Pattern

- **Background**: A fixed dark blue — `bg-[hsl(215_50%_10%)]` — that does NOT change between themes
- **Text colors**: Opacity-based white — `text-white`, `text-blue-200/70` for secondary, `text-blue-200/60` for tertiary
- **Active indicators**: A 2px underline that slides in on hover/active via `after:` pseudo-element
- **User controls**: Pill-shaped triggers with `bg-white/10 hover:bg-white/15`

### Page Header Extension

Below the nav bar, each page has a **dark hero section** that extends the header:

```
┌─────────────────────────────────┐
│  Nav bar (hsl 215 50% 10%)      │  sticky top-0 z-50
├─────────────────────────────────┤
│  Page header (hsl 215 45% 14%)  │  pt-6 pb-16
│  Title + breadcrumbs            │
├─────────────────────────────────┤  ← content overlaps with -mt-8
│  Cards and content              │
│  ...                            │
```

### Starter Snippet — Nav Bar

```tsx
<header className="sticky top-0 z-50 bg-[hsl(215_50%_10%)] text-white">
  <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
    <div className="flex h-16 items-center justify-between">
      {/* Logo */}
      <a href="/" className="font-bold text-xl" style={{ fontFamily: "var(--font-brand)" }}>
        Brand
      </a>

      {/* Nav links */}
      <nav className="hidden md:flex items-center gap-1">
        <a
          href="/dashboard"
          className="relative px-3 py-1.5 text-sm font-medium text-blue-200/70
                     hover:text-white transition-colors
                     after:absolute after:left-0 after:bottom-0
                     after:h-[2px] after:w-0 after:bg-primary
                     after:transition-all after:duration-300 after:ease-out
                     hover:after:w-full"
        >
          Dashboard
        </a>
        {/* ...more links */}
      </nav>

      {/* User pill */}
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/15 transition-colors">
        <span>John</span>
      </button>
    </div>
  </div>
</header>
```

### Starter Snippet — Page Header with Overlap

```tsx
{/* Dark hero */}
<div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
  <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
    {/* Meta bar */}
    <div className="flex items-center gap-2 text-sm text-blue-200/70">
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground text-xs font-medium">
        Portal
      </span>
      <span className="text-blue-300/40">&middot;</span>
      <span>Overview</span>
    </div>

    {/* Title with accent border */}
    <div className="border-l-4 border-primary pl-4">
      <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-blue-200/70">Track your portfolio</p>
    </div>
  </div>
</div>

{/* Content overlaps the hero */}
<div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
  {/* Cards go here — they "float" above the dark section */}
</div>
```

---

## 5. Gradient & Depth System

### Principle

Flat single-color backgrounds feel sterile. A layered system of radial mesh gradients, blurred decorative circles, and glass effects adds depth without cluttering the UI.

### Pattern — Three Layers

| Layer | What | Opacity range |
|-------|------|--------------|
| 1. Mesh gradient | Stacked radial gradients on `body`/page wrapper | 3-8% |
| 2. Blur circles | Positioned `div`s with `blur-3xl` and primary tint | 5-10% |
| 3. Glass panels | `backdrop-filter: blur(12px)` with semi-transparent bg | 70% bg |

### Starter Snippet — Page Mesh Gradient

```css
/* Light mode */
.bg-gradient-page {
  background:
    radial-gradient(ellipse at 0% 0%, hsl(207 83% 49% / 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 0%, hsl(207 83% 55% / 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, hsl(207 83% 49% / 0.03) 0%, transparent 50%),
    var(--background);
}

/* Dark mode — slightly higher opacity, shifted lightness */
.dark .bg-gradient-page {
  background:
    radial-gradient(ellipse at 0% 0%, hsl(207 83% 55% / 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 0%, hsl(207 83% 60% / 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, hsl(207 83% 55% / 0.03) 0%, transparent 50%),
    var(--background);
}
```

### Starter Snippet — Decorative Blur Circles

```tsx
{/* Place inside the page wrapper, behind all content */}
<div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
  <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
  <div className="absolute top-1/2 -left-32 w-72 h-72 bg-primary/[0.07] rounded-full blur-3xl" />
  <div className="absolute -bottom-32 right-1/3 w-[500px] h-[500px] bg-primary/[0.05] rounded-full blur-3xl" />
</div>
```

### Starter Snippet — Glass Effect

```css
/* Light mode */
.glass {
  background: hsl(0 0% 100% / 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid hsl(210 12% 90% / 0.5);
}

/* Dark mode */
.dark .glass {
  background: hsl(220 20% 12% / 0.7);
  border: 1px solid hsl(220 15% 22% / 0.5);
}
```

### Starter Snippet — Button/Accent Gradient

```css
.bg-gradient-primary {
  background: linear-gradient(135deg, hsl(207 83% 53%) 0%, hsl(207 83% 45%) 100%);
}
.bg-gradient-primary:hover {
  background: linear-gradient(135deg, hsl(207 83% 49%) 0%, hsl(207 83% 41%) 100%);
}
```

### Starter Snippet — Card Header Gradient

```css
.bg-gradient-card-header {
  background: linear-gradient(135deg, hsl(207 83% 49% / 0.08) 0%, hsl(207 83% 55% / 0.04) 100%);
}
.dark .bg-gradient-card-header {
  background: linear-gradient(135deg, hsl(207 83% 55% / 0.12) 0%, hsl(207 83% 60% / 0.05) 100%);
}
```

---

## 6. Component Conventions

### Principle

Consistency across every component — same radius, same shadow depth, same focus ring, same transition speed. This is what makes a UI feel "designed" instead of assembled from parts.

### Border Radius

```css
--radius: 0.5rem;  /* 8px — the base */

/* Scale derived from the base */
--radius-sm: calc(var(--radius) - 2px);   /* 6px  — badges, small chips */
--radius-md: var(--radius);                /* 8px  — buttons, inputs, cards */
--radius-lg: calc(var(--radius) + 2px);    /* 10px — dropdowns, popovers */
--radius-xl: calc(var(--radius) + 4px);    /* 12px — dialogs */
--radius-2xl: calc(var(--radius) + 8px);   /* 16px — large cards, modals */
--radius-3xl: calc(var(--radius) + 12px);  /* 20px — hero cards */
--radius-4xl: calc(var(--radius) + 16px);  /* 24px — pills */
```

### Shadow Hierarchy

| Level | Class | When to use |
|-------|-------|------------|
| Base | `shadow-sm` | Standard cards, inputs |
| Elevated | `shadow-lg` | Overlapping content, dropdowns, important cards |
| Branded | `shadow-lg shadow-primary/25` | CTA buttons, primary actions |
| None | (no shadow) | Inline elements, ghost states |

### Focus Rings

Every interactive element uses the same ring:

```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

Badges use a slightly larger ring for their small size:

```
focus-visible:ring-[3px]
focus-visible:ring-ring/50
focus-visible:border-ring
```

### Transitions

| Type | Class | Usage |
|------|-------|-------|
| Color swap | `transition-colors` | Buttons, links, nav items |
| All properties | `transition-all duration-200` | Cards on hover, CTA buttons |
| Opacity | `transition-opacity` | Gradient buttons, overlays |

### Hover Patterns

```tsx
{/* Standard button hover — 90% opacity */}
className="bg-primary hover:bg-primary/90"

{/* Secondary button — 80% opacity */}
className="bg-secondary hover:bg-secondary/80"

{/* Card hover — accent border appears */}
className="hover:border-primary/50 transition-colors"

{/* Nav pill — white overlay increases */}
className="bg-white/10 hover:bg-white/15 transition-colors"
```

### Disabled State

```
disabled:pointer-events-none disabled:opacity-50
```

### Size Scale (Buttons)

| Size | Classes | Usage |
|------|---------|-------|
| `default` | `h-10 px-4 py-2` | Standard actions |
| `sm` | `h-9 px-3` | Inline actions, table rows |
| `lg` | `h-11 px-8` | CTAs, login forms |
| `icon` | `h-10 w-10` | Icon-only buttons |
| `icon-sm` | `h-8 w-8` | Compact icon buttons |
| `icon-xs` | `h-6 w-6` | Inline icon triggers |

---

## 7. Layout System

### Principle

A single max-width container with responsive padding, consistent vertical spacing, and a page-header-overlap pattern that gives every page a layered, card-on-surface feel.

### Max Width & Padding

```tsx
<div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
  {/* content */}
</div>
```

- `1440px` max-width for wide screens
- `px-4` (16px) on mobile, `px-6` (24px) on tablet, `px-8` (32px) on desktop

### Vertical Spacing

| Between | Class |
|---------|-------|
| Major page sections | `space-y-6` |
| Cards in a section | `space-y-4` or `gap-4` |
| Items inside a card | `space-y-2` |
| Text stack (title + description) | `space-y-1` or `mt-1.5` |

### Page Structure Template

```tsx
function MyPage() {
  return (
    <>
      {/* Dark hero header */}
      <div className="bg-[hsl(215_45%_14%)] text-white pt-6 lg:pt-8 pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-4xl font-bold tracking-tight">Page Title</h1>
            <p className="text-blue-200/70">Page description</p>
          </div>
        </div>
      </div>

      {/* Content with overlap */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 -mt-8 pb-8 space-y-6 relative">
        {/* KPI row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm">...</Card>
          <Card className="shadow-sm">...</Card>
          <Card className="shadow-sm">...</Card>
          <Card className="shadow-sm">...</Card>
        </div>

        {/* Main content area */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-sm">...</Card>
          <Card className="shadow-sm">...</Card>
        </div>
      </div>
    </>
  )
}
```

### Card Patterns

**KPI Card**:
```tsx
<Card className="shadow-sm">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
    <CardTitle className="text-sm font-medium">Revenue</CardTitle>
    <TrendUp className="h-4 w-4 text-primary" weight="bold" />
  </CardHeader>
  <CardContent className="p-4 pt-0">
    <div className="text-2xl font-bold text-primary">$12,450</div>
    <p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
  </CardContent>
</Card>
```

**Alert/Banner Card**:
```tsx
<div className="rounded-lg border border-destructive/20 bg-card shadow-lg p-4 relative overflow-hidden">
  <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
  <div className="flex items-center gap-3 relative">
    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
      <WarningIcon className="h-5 w-5 text-destructive" />
    </div>
    <div>
      <p className="font-semibold text-sm">3 overdue payments</p>
      <p className="text-xs text-muted-foreground">Total: $2,400 past due</p>
    </div>
  </div>
</div>
```

**Empty State**:
```tsx
<div className="text-center py-8">
  <InboxIcon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
  <p className="text-muted-foreground text-sm">No items yet</p>
</div>
```

**List Item with Icon**:
```tsx
<div className="flex items-center gap-3">
  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
    <UserIcon className="h-5 w-5 text-primary" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="font-semibold truncate">Item name</p>
    <p className="text-sm text-muted-foreground">Secondary info</p>
  </div>
</div>
```

---

## 8. Animation

### Principle

Animations should signal hierarchy (what loaded first matters most), provide feedback (something is happening), and feel snappy. All animations respect `prefers-reduced-motion`.

### Staggered Entrance

The universal page-load pattern. Every dashboard page wraps content in `<Stagger>` / `<StaggerItem>`:

```tsx
import { motion, useReducedMotion } from "framer-motion"

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
```

Usage:

```tsx
<Stagger className="space-y-6">
  <StaggerItem className="grid gap-4 lg:grid-cols-4">
    {/* KPI cards — appear first */}
  </StaggerItem>
  <StaggerItem>
    {/* Chart section — appears 100ms later */}
  </StaggerItem>
  <StaggerItem>
    {/* Table — appears 200ms later */}
  </StaggerItem>
</Stagger>
```

### Route Progress Bar

A thin bar at the very top of the viewport that animates during navigation:

```tsx
export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading })
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20",
        "transition-opacity duration-300",
        isLoading ? "opacity-100" : "opacity-0"
      )}
    >
      <div className={cn("h-full bg-primary", isLoading && "animate-progress")} />
    </div>
  )
}
```

```css
@keyframes progress {
  0%   { width: 0%; }
  50%  { width: 70%; }
  100% { width: 100%; }
}
.animate-progress {
  animation: progress 1.5s ease-in-out infinite;
}
```

### Micro-Interactions

**Brand letter animation** (spring physics):

```tsx
const letterVariants = {
  hidden: { opacity: 0, y: 20, rotateX: -90 },
  visible: {
    opacity: 1, y: 0, rotateX: 0,
    transition: { type: "spring", damping: 12, stiffness: 200 },
  },
}
```

**Pulsing dot indicator** (new-content badge):

```tsx
<span className="absolute top-0 right-0 flex h-2.5 w-2.5">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
</span>
```

**Subtle pulse for glow buttons**:

```css
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}
```

**Floating decorative circles** (landing pages):

```tsx
<motion.div
  className="absolute w-96 h-96 bg-white/5 rounded-full"
  animate={{ y: [0, -20, 0] }}
  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
/>
```

---

## 9. Dark Mode

### Principle

Dark mode is class-based (`.dark` on `<html>`), with system preference detection as the default. Every color, gradient, and decorative element has an explicit dark variant — nothing is left to "just invert."

### Strategy

```css
@custom-variant dark (&:is(.dark *));
```

```tsx
// Theme provider toggles the class on <html>
const root = document.documentElement
root.classList.remove("light", "dark")
root.classList.add(actualTheme) // "light" | "dark"
```

### What Changes Between Modes

| Element | Light | Dark |
|---------|-------|------|
| Background | `hsl(210 20% 98%)` | `hsl(220 20% 9%)` |
| Card surface | `hsl(0 0% 100%)` | `hsl(220 20% 12%)` |
| Primary | `hsl(207 83% 49%)` | `hsl(207 83% 55%)` — bumped 6% lighter |
| Muted text | `hsl(210 8% 46%)` | `hsl(210 8% 55%)` — bumped 9% lighter |
| Border | `hsl(210 12% 90%)` | `hsl(220 15% 22%)` |
| Mesh gradient | 3-8% primary opacity | 3-8% primary opacity (shifted lightness) |
| Glass bg | `white / 0.7` | `hsl(220 20% 12%) / 0.7` |
| Glass border | `hsl(210 12% 90%) / 0.5` | `hsl(220 15% 22%) / 0.5` |
| Blur circles | `bg-primary/10` | Same — works automatically since `--primary` shifts |
| Nav bar | `hsl(215 50% 10%)` | **No change** — already dark |
| Page header | `hsl(215 45% 14%)` | **No change** — already dark |

### Key Insight

The dark header (`hsl(215 50% 10%)`) and page hero (`hsl(215 45% 14%)`) use hardcoded dark values that don't change between modes. This means the top of every page looks identical in both themes — only the content area below shifts. This creates a stable visual anchor.

### Starter Snippet — Theme Provider

```tsx
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: "light" | "dark"
} | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null
    if (saved) setThemeState(saved)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const actual: "light" | "dark" =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        : theme
    setResolvedTheme(actual)
    root.classList.remove("light", "dark")
    root.classList.add(actual)
  }, [theme])

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handle = (e: MediaQueryListEvent) => {
      document.documentElement.classList.remove("light", "dark")
      document.documentElement.classList.add(e.matches ? "dark" : "light")
      setResolvedTheme(e.matches ? "dark" : "light")
    }
    mq.addEventListener("change", handle)
    return () => mq.removeEventListener("change", handle)
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem("theme", t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
```

---

## 10. New Project Checklist

Run through this when starting a new shadcn + Tailwind project:

### Foundation
- [ ] Install fonts: `@fontsource-variable/manrope` + `@fontsource-variable/sora` (or your chosen pair)
- [ ] Register `--font-sans` and `--font-brand` in your CSS `@theme` block
- [ ] Replace default shadcn CSS variables with tinted-neutral palette (Section 2)
- [ ] Set `--radius: 0.5rem`
- [ ] Add `@custom-variant dark (&:is(.dark *))` for class-based dark mode
- [ ] Set base styles: `body { @apply font-sans bg-background text-foreground antialiased; }`

### Gradients & Depth
- [ ] Add `.bg-gradient-page` utility with dark mode override
- [ ] Add `.bg-gradient-primary` for CTA buttons
- [ ] Add `.bg-gradient-card-header` for highlighted card sections
- [ ] Add `.glass` utility with dark mode override
- [ ] Add decorative blur circles to the dashboard layout

### Layout
- [ ] Set max-width container: `max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8`
- [ ] Build the dark header nav bar (Section 4)
- [ ] Build the dark page hero with overlap pattern (`pb-16` hero + `-mt-8` content)
- [ ] Wire up the route progress bar at `z-[100]`

### Animation
- [ ] Install `framer-motion`
- [ ] Add `Stagger` / `StaggerItem` wrapper components (Section 8)
- [ ] Add `animate-progress` keyframe for the route progress bar
- [ ] Add `animate-pulse-subtle` keyframe for glow buttons
- [ ] Wrap every dashboard page's content in `<Stagger>` / `<StaggerItem>`

### Dark Mode
- [ ] Add `ThemeProvider` wrapping the app
- [ ] Add a theme toggle in the user menu
- [ ] Verify every gradient utility has a `.dark` override
- [ ] Verify the glass effect has a `.dark` override
- [ ] Confirm the dark nav bar and page hero look the same in both themes

### Polish
- [ ] Confirm all buttons use `transition-colors` and hover at `primary/90`
- [ ] Confirm all cards use `shadow-sm` (or `shadow-lg` for elevated)
- [ ] Confirm all focus rings use `ring-2 ring-ring ring-offset-2`
- [ ] Confirm disabled states use `pointer-events-none opacity-50`
- [ ] Add `.scrollbar-none` utility for hidden-scrollbar containers
- [ ] Test on mobile — responsive padding and nav should work at `px-4`
