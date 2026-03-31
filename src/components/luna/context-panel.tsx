import { ContextCardComponent } from "./context-card"
import type { ContextCard } from "@/server/luna/tools"
import { Sparkle } from "@phosphor-icons/react"

interface ContextPanelProps {
  cards: ContextCard[]
  onDismiss: (index: number) => void
}

export function ContextPanel({ cards, onDismiss }: ContextPanelProps) {
  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mx-auto">
            <Sparkle className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-xs text-muted-foreground">
            Data and results will appear here as Luna looks things up.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {cards.map((card, i) => (
        <ContextCardComponent
          key={`${card.type}-${i}`}
          card={card}
          onDismiss={() => onDismiss(i)}
        />
      ))}
    </div>
  )
}
