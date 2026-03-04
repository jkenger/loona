import React, { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  X,
  Plus,
  List,
  PaperPlaneRight,
  Trash,
  Spinner,
  ArrowLeft,
  Robot,
} from "@phosphor-icons/react"
import { useAdvisorChat } from "@/lib/hooks/use-advisor-chat"

interface AdvisorChatProps {
  open: boolean
  onClose: () => void
}

export function AdvisorChat({ open, onClose }: AdvisorChatProps) {
  const {
    conversations,
    activeConversationId,
    messages,
    isLoading,
    isStreaming,
    streamingText,
    activeToolCall,
    initialized,
    initialize,
    selectConversation,
    startNewConversation,
    deleteConversation,
    sendMessage,
  } = useAdvisorChat()

  const [input, setInput] = useState("")
  const [showConvoList, setShowConvoList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize on first open
  useEffect(() => {
    if (open && !initialized) {
      initialize()
    }
  }, [open, initialized, initialize])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput("")
    sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = async () => {
    setShowConvoList(false)
    await startNewConversation()
  }

  const handleSelectConversation = async (id: string) => {
    setShowConvoList(false)
    await selectConversation(id)
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[600px] flex flex-col bg-background md:rounded-xl md:shadow-2xl md:border overflow-hidden"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Robot className="h-5 w-5 text-primary" weight="fill" />
            <h3 className="font-semibold text-sm">Advisor</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNewConversation}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowConvoList(!showConvoList)}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative">
          {/* Conversation list sidebar */}
          <AnimatePresence>
            {showConvoList && (
              <motion.div
                className="absolute inset-0 z-10 bg-background flex flex-col"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowConvoList(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">Conversations</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                      <p>No conversations yet</p>
                    </div>
                  ) : (
                    conversations.map((convo) => (
                      <div
                        key={convo.id}
                        className={`flex items-center gap-2 px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                          convo.id === activeConversationId ? "bg-muted/50" : ""
                        }`}
                        onClick={() => handleSelectConversation(convo.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {convo.title || "New conversation"}
                          </p>
                          {convo.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {convo.lastMessage}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteConversation(convo.id)
                          }}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
            {!activeConversationId ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Robot className="h-12 w-12 text-primary/30 mb-3" weight="fill" />
                <p className="text-sm text-muted-foreground mb-4">
                  Ask me about your portfolio, borrowers, overdue payments, or get loan recommendations.
                </p>
                <Button size="sm" onClick={handleNewConversation} disabled={isLoading}>
                  {isLoading ? (
                    <Spinner className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Start a conversation
                </Button>
              </div>
            ) : (
              <>
                {messages.length === 0 && !isStreaming && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <Robot className="h-10 w-10 text-primary/30 mb-3" weight="fill" />
                    <p className="text-sm text-muted-foreground">
                      How can I help you today?
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                ))}

                {/* Streaming message */}
                {isStreaming && (
                  <div className="space-y-2">
                    {activeToolCall && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Spinner className="h-3 w-3 animate-spin" />
                        <span>Analyzing {formatToolName(activeToolCall)}...</span>
                      </div>
                    )}
                    {streamingText && (
                      <MessageBubble role="assistant" content={streamingText} />
                    )}
                    {!streamingText && !activeToolCall && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input area */}
        {activeConversationId && (
          <div className="border-t px-3 py-3 bg-card shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your advisor..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? (
                  <Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <PaperPlaneRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <SimpleMarkdown content={content} />
          </div>
        )}
      </div>
    </div>
  )
}

function SimpleMarkdown({ content }: { content: string }) {
  // Simple markdown renderer: bold, italic, lists, line breaks
  const lines = content.split("\n")
  const elements: React.ReactElement[] = []
  let listItems: string[] = []
  let listType: "ul" | "ol" | null = null

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType
      elements.push(
        <Tag key={elements.length} className={listType === "ul" ? "list-disc pl-4" : "list-decimal pl-4"}>
          {listItems.map((item, i) => (
            <li key={i}><InlineMarkdown text={item} /></li>
          ))}
        </Tag>
      )
      listItems = []
      listType = null
    }
  }

  for (const line of lines) {
    const ulMatch = line.match(/^[-*]\s+(.+)/)
    const olMatch = line.match(/^\d+\.\s+(.+)/)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)

    if (ulMatch) {
      if (listType !== "ul") flushList()
      listType = "ul"
      listItems.push(ulMatch[1])
    } else if (olMatch) {
      if (listType !== "ol") flushList()
      listType = "ol"
      listItems.push(olMatch[1])
    } else {
      flushList()
      if (headingMatch) {
        const level = headingMatch[1].length
        const text = headingMatch[2]
        if (level === 1) elements.push(<h3 key={elements.length} className="font-bold text-sm mt-2 mb-1"><InlineMarkdown text={text} /></h3>)
        else if (level === 2) elements.push(<h4 key={elements.length} className="font-semibold text-sm mt-2 mb-1"><InlineMarkdown text={text} /></h4>)
        else elements.push(<h5 key={elements.length} className="font-medium text-sm mt-1 mb-0.5"><InlineMarkdown text={text} /></h5>)
      } else if (line.trim() === "") {
        elements.push(<br key={elements.length} />)
      } else {
        elements.push(<p key={elements.length}><InlineMarkdown text={line} /></p>)
      }
    }
  }
  flushList()

  return <>{elements}</>
}

function InlineMarkdown({ text }: { text: string }) {
  // Handle **bold** and *italic* and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="bg-muted-foreground/10 px-1 py-0.5 rounded text-xs">{part.slice(1, -1)}</code>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function formatToolName(name: string): string {
  return name
    .replace(/^get_/, "")
    .replace(/_/g, " ")
}
