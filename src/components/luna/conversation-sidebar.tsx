import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Plus, Trash, ChatCircle } from "@phosphor-icons/react"
import { formatDistanceToNow } from "date-fns"

interface ConversationSidebarProps {
  conversations: Array<{
    id: string
    title: string | null
    lastMessageAt: Date
  }>
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors",
              activeId === conv.id
                ? "bg-muted"
                : "hover:bg-muted/50",
            )}
            onClick={() => onSelect(conv.id)}
          >
            <ChatCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {conv.title || "New Chat"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(conv.lastMessageAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(conv.id)
              }}
            >
              <Trash className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
