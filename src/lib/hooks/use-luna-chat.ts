import { useState, useCallback, useRef, useEffect } from "react"
import type { ContextCard } from "@/server/luna/tools"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

interface UseLunaChatOptions {
  conversationId?: string
  initialMessage?: string
}

export function useLunaChat(options?: UseLunaChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [contextCards, setContextCards] = useState<ContextCard[]>([])
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(
    options?.conversationId ?? null,
  )
  const abortRef = useRef<AbortController | null>(null)
  const initialSentRef = useRef(false)

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)
      setActiveToolCall(null)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch("/api/luna/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: text,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || "Failed to send message")
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = JSON.parse(line.slice(6))

            switch (data.type) {
              case "text":
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + data.content,
                    }
                  }
                  return updated
                })
                break

              case "tool_call":
                setActiveToolCall(data.toolName)
                break

              case "tool_result":
                setActiveToolCall(null)
                if (data.contextCard) {
                  setContextCards((prev) => [data.contextCard, ...prev])
                }
                // After tool result, model continues — reset assistant message for new text
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (
                    last?.role === "assistant" &&
                    last.isStreaming &&
                    last.content
                  ) {
                    // There was text before tool call — finalize it and add new streaming msg
                    updated[updated.length - 1] = {
                      ...last,
                      isStreaming: false,
                    }
                    updated.push({
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: "",
                      isStreaming: true,
                    })
                  }
                  return updated
                })
                break

              case "done":
                if (data.conversationId) {
                  setConversationId(data.conversationId)
                }
                break

              case "error":
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === "assistant" && last.isStreaming) {
                    updated[updated.length - 1] = {
                      ...last,
                      content: `Error: ${data.message}`,
                      isStreaming: false,
                    }
                  }
                  return updated
                })
                break
            }
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === "assistant" && last.isStreaming) {
              updated[updated.length - 1] = {
                ...last,
                content: `Error: ${error.message}`,
                isStreaming: false,
              }
            }
            return updated
          })
        }
      } finally {
        setIsStreaming(false)
        setActiveToolCall(null)
        abortRef.current = null
        // Finalize any streaming messages
        setMessages((prev) =>
          prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        )
      }
    },
    [conversationId, isStreaming],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setContextCards([])
    setConversationId(null)
    setActiveToolCall(null)
  }, [])

  const dismissContextCard = useCallback((index: number) => {
    setContextCards((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const loadConversation = useCallback(
    (id: string, existingMessages: ChatMessage[]) => {
      setConversationId(id)
      setMessages(existingMessages)
      setContextCards([])
    },
    [],
  )

  // Auto-send initial message
  useEffect(() => {
    if (options?.initialMessage && !initialSentRef.current) {
      initialSentRef.current = true
      sendMessage(options.initialMessage)
    }
  }, [options?.initialMessage, sendMessage])

  return {
    messages,
    contextCards,
    activeToolCall,
    isStreaming,
    conversationId,
    sendMessage,
    stopStreaming,
    clearChat,
    dismissContextCard,
    loadConversation,
  }
}
