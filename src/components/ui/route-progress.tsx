import { useRouterState } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

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
      <div
        className={cn(
          "h-full bg-primary",
          isLoading && "animate-progress"
        )}
      />
    </div>
  )
}
