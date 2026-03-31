import { useEffect, useRef } from "react"
import { ChatMessage } from "./chat-message"
import { ToolIndicator } from "./tool-indicator"
import type { ChatMessage as ChatMessageType } from "@/lib/hooks/use-luna-chat"
import type { ContextCard } from "@/server/luna/tools"

interface ChatMessagesProps {
  messages: ChatMessageType[]
  activeToolCall: string | null
  contextCards?: ContextCard[]
}

const baseSuggestions = [
  "How's my portfolio doing?",
  "Who has overdue payments?",
  "Show me recent collections",
]

function getSuggestions(contextCards: ContextCard[]): string[] {
  if (contextCards.length === 0) return baseSuggestions

  const latest = contextCards[0]
  switch (latest.type) {
    case "overdue_loans_table":
      return [
        "Show me details for the most overdue one",
        "What's my collection rate this month?",
        "Send reminders to overdue borrowers",
      ]
    case "loan_detail":
      return [
        "Show payment history for this loan",
        "Record a payment for this borrower",
        "What's the borrower's profile?",
      ]
    case "contact_detail":
      return [
        "Show their active loans",
        "Record a payment for them",
        "How's my overall portfolio?",
      ]
    case "payment_history":
      return [
        "What's my collection rate?",
        "Who has overdue payments?",
        "Show portfolio overview",
      ]
    case "portfolio_stats":
      return [
        "Who has overdue payments?",
        "Show recent collections",
        "What's my collection rate this month?",
      ]
    case "payment_confirmation":
      return [
        "Show remaining balance for this loan",
        "Who else has payments due?",
        "How's my portfolio doing?",
      ]
    case "borrower_list":
      return [
        "Show details for the first one",
        "Who has overdue payments?",
        "How's my portfolio?",
      ]
    default:
      return baseSuggestions
  }
}

export function ChatMessages({ messages, activeToolCall, contextCards = [] }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeToolCall])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base">Hi, I'm Luna</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your AI lending advisor. Ask me about your portfolio, borrowers,
              payments, or let me help record a payment.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {[
              "How's my portfolio doing?",
              "Who has overdue payments?",
              "Show me recent collections",
            ].map((suggestion) => (
              <button
                key={suggestion}
                className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors text-muted-foreground"
                onClick={() => {
                  // Bubble up to parent — handled by the page
                  const event = new CustomEvent("luna-suggestion", {
                    detail: suggestion,
                  })
                  window.dispatchEvent(event)
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => {
        // Skip empty assistant messages (pre-tool-result placeholders)
        if (msg.role === "assistant" && !msg.content && !msg.isStreaming)
          return null

        return (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={msg.isStreaming}
          />
        )
      })}
      {activeToolCall && <ToolIndicator toolName={activeToolCall} />}
      {!activeToolCall && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
        <div className="flex flex-wrap gap-2 pl-10">
          {getSuggestions(contextCards).map((suggestion) => (
            <button
              key={suggestion}
              className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("luna-suggestion", { detail: suggestion }),
                )
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
