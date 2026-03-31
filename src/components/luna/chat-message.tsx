import { Sparkle } from "@phosphor-icons/react"
import { memo } from "react"
import Markdown from "react-markdown"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  isStreaming,
}: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkle className="h-3.5 w-3.5 text-white" weight="fill" />
      </div>
      <div className="flex-1 min-w-0">
        {content ? (
          <div className="text-sm leading-relaxed luna-markdown">
            <Markdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                h3: ({ children }) => <h3 className="font-semibold text-sm mt-3 mb-1">{children}</h3>,
                h4: ({ children }) => <h4 className="font-semibold text-sm mt-2 mb-1">{children}</h4>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-")
                  if (isBlock) {
                    return (
                      <pre className="rounded-lg bg-muted px-3 py-2 my-2 overflow-x-auto">
                        <code className="text-xs">{children}</code>
                      </pre>
                    )
                  }
                  return (
                    <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                      {children}
                    </code>
                  )
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="w-full text-xs border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="border-b">{children}</thead>,
                th: ({ children }) => (
                  <th className="text-left font-semibold px-2 py-1.5 text-muted-foreground">{children}</th>
                ),
                td: ({ children }) => <td className="px-2 py-1.5 border-b border-muted">{children}</td>,
                a: ({ href, children }) => (
                  <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </Markdown>
          </div>
        ) : (
          isStreaming && (
            <div className="text-sm">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          )
        )}
      </div>
    </div>
  )
})
