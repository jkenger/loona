import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useCallback, useEffect } from "react"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { useLunaChat, type ChatMessage } from "@/lib/hooks/use-luna-chat"
import {
  getConversations,
  getConversation,
  deleteConversation,
} from "@/server/luna/conversations"
import { ChatMessages } from "@/components/luna/chat-messages"
import { ChatInput } from "@/components/luna/chat-input"
import { ContextPanel } from "@/components/luna/context-panel"
import { ConversationSidebar } from "@/components/luna/conversation-sidebar"
import { Button } from "@/components/ui/button"
import { Sparkle, List, SidebarSimple, X } from "@phosphor-icons/react"
import type { LunaMessage } from "@/lib/db"

const searchSchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().optional(),
})

export const Route = createFileRoute("/_dashboard/luna/")({
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    const { session } = context as {
      session: { user: { role: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { conversations: [], unauthorized: true }
    }
    const conversations = await getConversations()
    return { conversations, unauthorized: false }
  },
  component: LunaPage,
})

function LunaPage() {
  const { conversations: initialConversations, unauthorized } =
    Route.useLoaderData()
  const { message: initialMessage, conversationId: resumeId } =
    Route.useSearch()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState(initialConversations)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(true)

  const chat = useLunaChat({
    conversationId: resumeId,
    initialMessage: initialMessage,
  })

  // Load conversation when resuming
  useEffect(() => {
    if (resumeId && !initialMessage) {
      getConversation({ data: { conversationId: resumeId } }).then(
        ({ messages }: { messages: LunaMessage[] }) => {
          const chatMessages: ChatMessage[] = messages
            .filter((m: LunaMessage) => m.role === "user" || m.role === "assistant")
            .map((m: LunaMessage) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          chat.loadConversation(resumeId, chatMessages)
        },
      )
    }
  }, [resumeId])

  // Listen for suggestion clicks from empty state
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) chat.sendMessage(detail)
    }
    window.addEventListener("luna-suggestion", handler)
    return () => window.removeEventListener("luna-suggestion", handler)
  }, [chat.sendMessage])

  // Refresh conversation list when a new conversation is created
  useEffect(() => {
    if (chat.conversationId) {
      getConversations().then(setConversations)
    }
  }, [chat.conversationId])

  const handleSelectConversation = useCallback(
    async (id: string) => {
      const { messages } = await getConversation({
        data: { conversationId: id },
      }) as { messages: LunaMessage[] }
      const chatMessages: ChatMessage[] = messages
        .filter((m: LunaMessage) => m.role === "user" || m.role === "assistant")
        .map((m: LunaMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      chat.loadConversation(id, chatMessages)
      setSidebarOpen(false)
      // Update URL without navigation
      navigate({
        to: "/luna",
        search: { conversationId: id },
        replace: true,
      })
    },
    [chat, navigate],
  )

  const handleNewChat = useCallback(() => {
    chat.clearChat()
    setSidebarOpen(false)
    navigate({ to: "/luna", search: {}, replace: true })
  }, [chat, navigate])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation({ data: { conversationId: id } })
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (chat.conversationId === id) {
        chat.clearChat()
      }
    },
    [chat],
  )

  if (unauthorized) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">
          Luna AI is available for lenders only.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Conversation Sidebar — mobile: overlay, desktop: static */}
      <div
        className={cn(
          "border-r bg-background transition-all duration-200 shrink-0",
          // Mobile: overlay
          "fixed inset-y-0 left-0 z-40 w-64 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "lg:w-56",
        )}
      >
        <div className="flex items-center justify-between p-3 border-b lg:hidden">
          <span className="text-xs font-semibold">Conversations</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ConversationSidebar
          conversations={conversations}
          activeId={chat.conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
        />
      </div>
      {/* Sidebar backdrop on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <List className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Sparkle className="h-3 w-3 text-white" weight="fill" />
              </div>
              <span className="text-sm font-semibold">Luna</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setContextOpen((o) => !o)}
          >
            <SidebarSimple
              className="h-4 w-4"
              weight={contextOpen ? "fill" : "regular"}
            />
          </Button>
        </div>

        {/* Messages */}
        <ChatMessages
          messages={chat.messages}
          activeToolCall={chat.activeToolCall}
          contextCards={chat.contextCards}
        />

        {/* Input */}
        <ChatInput
          onSend={chat.sendMessage}
          onStop={chat.stopStreaming}
          isStreaming={chat.isStreaming}
        />
      </div>

      {/* Context Panel — collapsible */}
      {contextOpen && (
        <div className="hidden md:flex w-72 lg:w-80 border-l flex-col bg-muted/20 dark:bg-muted/10 shrink-0">
          <div className="border-b px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Context
            </span>
          </div>
          <ContextPanel
            cards={chat.contextCards}
            onDismiss={chat.dismissContextCard}
          />
        </div>
      )}
    </div>
  )
}
