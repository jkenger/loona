import { useState, useCallback, useRef } from "react"
import {
  getOrCreateAdvisor,
  getConversations,
  getConversation,
  createConversation,
  deleteConversation as deleteConversationFn,
  updateConversationTitle,
} from "@/server/advisor"
import { getUnreadAlerts, markAlertsRead } from "@/server/advisor-alerts"

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
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([])
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [briefingContent, setBriefingContent] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [alerts, setAlerts] = useState<{ id: string; title: string; message: string; type: string; createdAt: string }[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const fetchBriefing = useCallback(async () => {
    const todayKey = `luna-briefing-${new Date().toISOString().slice(0, 10)}`
    const cached = localStorage.getItem(todayKey)
    if (cached) {
      setBriefingContent(cached)
      return
    }
    setBriefingLoading(true)
    try {
      const res = await fetch("/api/advisor/briefing")
      if (res.ok) {
        const data = await res.json()
        setBriefingContent(data.content)
        localStorage.setItem(todayKey, data.content)
      }
    } catch (error) {
      console.error("Failed to fetch briefing:", error)
    } finally {
      setBriefingLoading(false)
    }
  }, [])

  const initialize = useCallback(async () => {
    if (initialized) return
    setIsLoading(true)
    try {
      const advisor = await getOrCreateAdvisor()
      setAdvisorId(advisor.id)
      const convos = await getConversations()
      setConversations(convos)
      setInitialized(true)
      fetchBriefing()
      // Fetch unread alerts
      getUnreadAlerts().then((a) => {
        setAlerts(a.map((alert) => ({
          id: alert.id,
          title: alert.title,
          message: alert.message,
          type: alert.type,
          createdAt: new Date(alert.createdAt).toISOString(),
        })))
      })
    } catch (error) {
      console.error("Failed to initialize advisor:", error)
    } finally {
      setIsLoading(false)
    }
  }, [initialized, fetchBriefing])

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

  const startNewConversation = useCallback(async (): Promise<string | null> => {
    if (!advisorId) return null
    setIsLoading(true)
    try {
      const convo = await createConversation({ data: { advisorId } })
      setActiveConversationId(convo.id)
      setMessages([])
      await loadConversations()
      return convo.id
    } catch (error) {
      console.error("Failed to create conversation:", error)
      return null
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

  const sendMessage = useCallback(async (text: string, overrideConversationId?: string) => {
    const convoId = overrideConversationId ?? activeConversationId
    if (!convoId || isStreaming) return

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
    setThinkingSteps([])
    setActiveToolCall(null)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convoId,
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
            } else if (event.type === "thinking") {
              setThinkingSteps((prev) => [...prev, event.content])
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

  const dismissAlerts = useCallback(async () => {
    if (alerts.length === 0) return
    await markAlertsRead()
    setAlerts([])
  }, [alerts.length])

  return {
    conversations,
    activeConversationId,
    messages,
    isLoading,
    isStreaming,
    streamingText,
    thinkingSteps,
    activeToolCall,
    initialized,
    briefingContent,
    briefingLoading,
    alerts,
    initialize,
    loadConversations,
    selectConversation,
    startNewConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    stopStreaming,
    dismissAlerts,
  }
}
