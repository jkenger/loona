import { useState, useCallback, useRef } from "react"
import {
  getOrCreateAdvisor,
  getConversations,
  getConversation,
  createConversation,
  deleteConversation as deleteConversationFn,
  updateConversationTitle,
} from "@/server/advisor"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  metadata?: string | null
  createdAt: string
}

type ConversationPreview = {
  id: string
  title: string | null
  lastMessage: string | null
  updatedAt: string
  createdAt: string
}

export function useAdvisorChat() {
  const [advisorId, setAdvisorId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const initialize = useCallback(async () => {
    if (initialized) return
    setIsLoading(true)
    try {
      const advisor = await getOrCreateAdvisor()
      setAdvisorId(advisor.id)
      const convos = await getConversations()
      setConversations(convos)
      setInitialized(true)
    } catch (error) {
      console.error("Failed to initialize advisor:", error)
    } finally {
      setIsLoading(false)
    }
  }, [initialized])

  const loadConversations = useCallback(async () => {
    try {
      const convos = await getConversations()
      setConversations(convos)
    } catch (error) {
      console.error("Failed to load conversations:", error)
    }
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      const convo = await getConversation({ data: id })
      setActiveConversationId(id)
      setMessages(convo.messages)
    } catch (error) {
      console.error("Failed to load conversation:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const startNewConversation = useCallback(async () => {
    if (!advisorId) return
    setIsLoading(true)
    try {
      const convo = await createConversation({ data: { advisorId } })
      setActiveConversationId(convo.id)
      setMessages([])
      await loadConversations()
    } catch (error) {
      console.error("Failed to create conversation:", error)
    } finally {
      setIsLoading(false)
    }
  }, [advisorId, loadConversations])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversationFn({ data: id })
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
      await loadConversations()
    } catch (error) {
      console.error("Failed to delete conversation:", error)
    }
  }, [activeConversationId, loadConversations])

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      await updateConversationTitle({ data: { id, title } })
      await loadConversations()
    } catch (error) {
      console.error("Failed to rename conversation:", error)
    }
  }, [loadConversations])

  const sendMessage = useCallback(async (text: string) => {
    if (!activeConversationId || isStreaming) return

    // Optimistically add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)
    setStreamingText("")
    setActiveToolCall(null)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: text,
        }),
        signal: abort.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const dataLine = line.trim()
          if (!dataLine.startsWith("data: ")) continue
          const jsonStr = dataLine.slice(6)

          try {
            const event = JSON.parse(jsonStr)
            if (event.type === "text") {
              fullText += event.content
              setStreamingText(fullText)
            } else if (event.type === "tool_call") {
              setActiveToolCall(event.name)
            } else if (event.type === "done") {
              // Add assistant message to local state
              const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: fullText,
                createdAt: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, assistantMessage])
              setStreamingText("")
              setActiveToolCall(null)
              // Refresh conversation list for updated title/preview
              loadConversations()
            } else if (event.type === "error") {
              console.error("Advisor error:", event.message)
              const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                createdAt: new Date().toISOString(),
              }
              setMessages((prev) => [...prev, errorMessage])
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to send message:", error)
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't reach the advisor. Please try again.",
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } finally {
      setIsStreaming(false)
      setStreamingText("")
      setActiveToolCall(null)
      abortRef.current = null
    }
  }, [activeConversationId, isStreaming, loadConversations])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    conversations,
    activeConversationId,
    messages,
    isLoading,
    isStreaming,
    streamingText,
    activeToolCall,
    initialized,
    initialize,
    loadConversations,
    selectConversation,
    startNewConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    stopStreaming,
  }
}
