import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { PaperPlaneRight, Stop } from "@phosphor-icons/react"

interface ChatInputProps {
  onSend: (message: string) => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Ask Luna anything...",
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [input, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 160) + "px"
  }

  return (
    <div className="border-t bg-background p-3">
      <div className="flex items-end gap-2 rounded-xl border bg-muted/30 dark:bg-muted/20 px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background transition-shadow">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-h-[1.5rem] max-h-40"
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onStop}
          >
            <Stop className="h-4 w-4" weight="fill" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
          >
            <PaperPlaneRight className="h-3.5 w-3.5" weight="fill" />
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
        Luna may make mistakes. Verify important information.
      </p>
    </div>
  )
}
