import React, { useState, useRef, useEffect, useContext, createContext, type KeyboardEvent } from "react"
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
  Sparkle,
  MagnifyingGlass,
  Scales,
  TrendUp,
  TrendDown,
  Info,
  Warning,
  CheckCircle,
  ShieldWarning,
  Heartbeat,
  Lightning,
  ChartBar,
} from "@phosphor-icons/react"
import { useAdvisorChat } from "@/lib/hooks/use-advisor-chat"
import { formatDistanceToNow } from "date-fns"

interface AdvisorChatProps {
  open: boolean
  onClose: () => void
  onNavigate: (href: string) => void
}

const AdvisorNavContext = createContext<((href: string) => void) | null>(null)

const SUGGESTION_CHIPS = [
  { label: "Portfolio overview", message: "Give me a quick overview of my portfolio" },
  { label: "Overdue payments", message: "Who's overdue this week?" },
  { label: "Collection trends", message: "Show my collection trends for the past 3 months" },
  { label: "Top borrowers", message: "Who are my top 5 borrowers by loan amount?" },
]

const TOOL_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  query_data: { label: "Querying data...", icon: MagnifyingGlass },
  describe_data: { label: "Checking available data...", icon: List },
  get_loan_recommendation: { label: "Evaluating loan recommendation...", icon: Scales },
  get_borrower_risk_score: { label: "Assessing borrower risk...", icon: ShieldWarning },
  get_portfolio_health: { label: "Analyzing portfolio health...", icon: Heartbeat },
  simulate_scenario: { label: "Running simulation...", icon: Lightning },
  compare_periods: { label: "Comparing periods...", icon: ChartBar },
}

export function AdvisorChat({ open, onClose, onNavigate }: AdvisorChatProps) {
  const {
    conversations,
    activeConversationId,
    messages,
    isLoading,
    isStreaming,
    streamingText,
    activeToolCall,
    thinkingSteps,
    initialized,
    briefingContent,
    briefingLoading,
    alerts,
    initialize,
    selectConversation,
    startNewConversation,
    deleteConversation,
    sendMessage,
    dismissAlerts,
  } = useAdvisorChat()

  const [input, setInput] = useState("")
  const [showConvoList, setShowConvoList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && !initialized) {
      initialize()
    }
  }, [open, initialized, initialize])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || isStreaming) return
    if (!text) setInput("")
    sendMessage(msg)
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

  const handleSuggestionClick = async (message: string) => {
    let convoId = activeConversationId
    if (!convoId) {
      convoId = await startNewConversation()
      if (!convoId) return
    }
    sendMessage(message, convoId)
  }

  if (!open) return null

  return (
    <AdvisorNavContext.Provider value={onNavigate}>
    <AnimatePresence>
      {/* Mobile backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/40 md:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed inset-0 z-50 flex flex-col bg-background md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-gradient-to-r from-primary/5 via-violet-500/5 to-indigo-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary via-violet-500 to-indigo-500 text-white">
              <Sparkle className="h-4 w-4" weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm">Luna</h3>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              </div>
              <p className="text-xs text-muted-foreground">AI Assistant</p>
            </div>
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
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">
                              {convo.title || "New conversation"}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatRelativeTime(convo.updatedAt || convo.createdAt)}
                            </span>
                          </div>
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
              <div className="flex flex-col h-full px-6">
                {/* Briefing section */}
                {briefingContent ? (
                  <div className="flex-1 overflow-y-auto py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <LunaAvatar size="sm" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Briefing</span>
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed mb-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <SimpleMarkdown content={briefingContent} />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTION_CHIPS.map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => handleSuggestionClick(chip.message)}
                          disabled={isLoading}
                          className="rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-violet-500 to-indigo-500 text-white mb-4">
                      <Sparkle className="h-7 w-7" weight="fill" />
                    </div>
                    <h2 className="text-base font-semibold mb-1">Hi! I'm Luna.</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      {briefingLoading
                        ? "Loading your daily briefing..."
                        : "I can help you understand your portfolio, track payments, and make smarter lending decisions."}
                    </p>
                    {!briefingLoading && (
                      <div className="flex flex-wrap justify-center gap-2">
                        {SUGGESTION_CHIPS.map((chip) => (
                          <button
                            key={chip.label}
                            onClick={() => handleSuggestionClick(chip.message)}
                            disabled={isLoading}
                            className="rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Pinned alerts */}
                {alerts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Alerts</span>
                      <button
                        onClick={dismissAlerts}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Dismiss all
                      </button>
                    </div>
                    {alerts.map((alert) => (
                      <div key={alert.id} className="mb-1.5">
                        <AlertCard
                          data={{
                            type: alert.type === "loan_milestone" ? "success" : "warning",
                            title: alert.title,
                            message: alert.message,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {messages.length === 0 && !isStreaming && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary via-violet-500 to-indigo-500 text-white mb-3">
                      <Sparkle className="h-5 w-5" weight="fill" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      How can I help you today?
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTION_CHIPS.map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => handleSend(chip.message)}
                          disabled={isStreaming}
                          className="rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                ))}

                {/* Streaming message */}
                {isStreaming && (
                  <div className="space-y-2">
                    {thinkingSteps.length > 0 && <ThinkingSteps steps={thinkingSteps} />}
                    {activeToolCall && <ToolCallCard toolName={activeToolCall} />}
                    {streamingText && (
                      <MessageBubble role="assistant" content={streamingText} />
                    )}
                    {!streamingText && !activeToolCall && thinkingSteps.length === 0 && <TypingIndicator />}
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
                placeholder="Ask Luna anything..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleSend()}
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
    </AdvisorNavContext.Provider>
  )
}

function ThinkingSteps({ steps }: { steps: string[] }) {
  return (
    <div className="flex gap-2">
      <LunaAvatar />
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground italic">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
            <span>{step}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 mt-1">
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-pulse" />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

function LunaAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-8 w-8"
  const iconClasses = size === "sm" ? "h-3 w-3" : "h-4 w-4"
  return (
    <div className={`${sizeClasses} flex items-center justify-center rounded-full bg-gradient-to-br from-primary via-violet-500 to-indigo-500 text-white shrink-0`}>
      <Sparkle className={iconClasses} weight="fill" />
    </div>
  )
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user"
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <LunaAvatar />}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
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

function ToolCallCard({ toolName }: { toolName: string }) {
  const tool = TOOL_LABELS[toolName]
  const label = tool?.label ?? `Analyzing ${toolName.replace(/^get_/, "").replace(/_/g, " ")}...`
  const Icon = tool?.icon ?? MagnifyingGlass

  return (
    <div className="flex gap-2">
      <LunaAvatar />
      <div className="flex items-center gap-2.5 rounded-xl border bg-muted/50 px-3.5 py-2.5">
        <Icon className="h-4 w-4 text-primary shrink-0" weight="fill" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-pulse" />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <LunaAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return ""
  }
}

const BLOCK_REGEX = /:::(stats|table|alert)\n([\s\S]*?)\n:::/g

function SimpleMarkdown({ content }: { content: string }) {
  const segments: React.ReactElement[] = []
  let lastIndex = 0

  for (const match of content.matchAll(BLOCK_REGEX)) {
    const before = content.slice(lastIndex, match.index).trim()
    if (before) {
      segments.push(<PlainMarkdown key={segments.length} content={before} />)
    }
    const type = match[1] as "stats" | "table" | "alert"
    const json = match[2].trim()
    try {
      const data = JSON.parse(json)
      if (type === "stats") segments.push(<StatsCard key={segments.length} data={data} />)
      else if (type === "table") segments.push(<DataTable key={segments.length} data={data} />)
      else if (type === "alert") segments.push(<AlertCard key={segments.length} data={data} />)
    } catch {
      segments.push(<PlainMarkdown key={segments.length} content={match[0]} />)
    }
    lastIndex = match.index! + match[0].length
  }

  const remaining = content.slice(lastIndex).trim()
  if (remaining) {
    segments.push(<PlainMarkdown key={segments.length} content={remaining} />)
  }

  return <>{segments}</>
}

function StatsCard({ data }: { data: Array<{ label: string; value: string; trend?: "up" | "down" | "neutral" }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 my-2">
      {data.map((stat, i) => (
        <div key={i} className="rounded-lg border bg-background px-3 py-2">
          <div className="flex items-center gap-1">
            <span className={`text-base font-bold ${
              stat.trend === "up" ? "text-green-600 dark:text-green-400" :
              stat.trend === "down" ? "text-red-600 dark:text-red-400" : ""
            }`}>
              {stat.value}
            </span>
            {stat.trend === "up" && <TrendUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" weight="bold" />}
            {stat.trend === "down" && <TrendDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" weight="bold" />}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

function DataTable({ data }: { data: { title?: string; columns: string[]; rows: string[][]; rateColumn?: string } }) {
  const rateIdx = data.rateColumn ? data.columns.indexOf(data.rateColumn) : -1

  const getRateColor = (val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return ""
    if (num >= 80) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    if (num >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }

  return (
    <div className="my-2 rounded-lg border overflow-hidden">
      {data.title && (
        <div className="px-3 py-1.5 border-b bg-muted/50">
          <p className="text-xs font-semibold">{data.title}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              {data.columns.map((col, i) => (
                <th key={i} className="px-2.5 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-border/50">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-2.5 py-1.5 whitespace-nowrap ${ci === rateIdx ? getRateColor(cell) + " font-medium text-center rounded" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AlertCard({ data }: { data: { type: "info" | "warning" | "success"; title: string; message: string } }) {
  const styles = {
    info: { border: "border-l-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", icon: Info, iconColor: "text-blue-500" },
    warning: { border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", icon: Warning, iconColor: "text-amber-500" },
    success: { border: "border-l-green-500", bg: "bg-green-50 dark:bg-green-950/20", icon: CheckCircle, iconColor: "text-green-500" },
  }
  const s = styles[data.type] || styles.info
  const Icon = s.icon

  return (
    <div className={`my-2 rounded-lg border-l-4 ${s.border} ${s.bg} px-3 py-2.5`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 ${s.iconColor} shrink-0 mt-0.5`} weight="fill" />
        <div>
          <p className="text-xs font-semibold">{data.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{data.message}</p>
        </div>
      </div>
    </div>
  )
}

function PlainMarkdown({ content }: { content: string }) {
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
  const onNavigate = useContext(AdvisorNavContext)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/)
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
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (linkMatch) {
          const [, linkText, href] = linkMatch
          if (href.startsWith("/") && onNavigate) {
            return (
              <button
                key={i}
                onClick={() => onNavigate(href)}
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                {linkText}
              </button>
            )
          }
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              {linkText}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
