import { createFileRoute } from "@tanstack/react-router"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"
import { db, advisorConversations, advisorMessages } from "@/lib/db"
import { eq, and, asc } from "drizzle-orm"
import { buildSystemPrompt } from "@/server/advisor-prompt"
import { advisorTools, executeAdvisorTool } from "@/server/advisor-tools"

export const Route = createFileRoute("/api/advisor/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Auth via Better Auth cookies
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        }

        const lenderId = session.user.id

        let body: { conversationId: string; message: string }
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        }

        const { conversationId, message } = body
        if (!conversationId || !message?.trim()) {
          return new Response(JSON.stringify({ error: "conversationId and message required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        }

        // Verify conversation ownership
        const convo = await db.query.advisorConversations.findFirst({
          where: and(
            eq(advisorConversations.id, conversationId),
            eq(advisorConversations.lenderId, lenderId)
          ),
        })
        if (!convo) {
          return new Response(JSON.stringify({ error: "Conversation not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          })
        }

        // Save user message
        await db.insert(advisorMessages).values({
          conversationId,
          role: "user",
          content: message.trim(),
        })

        // Build message history (last 20 messages for context)
        const history = await db.query.advisorMessages.findMany({
          where: eq(advisorMessages.conversationId, conversationId),
          orderBy: [asc(advisorMessages.createdAt)],
          limit: 20,
        })

        const messages: Anthropic.MessageParam[] = history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))

        // Build system prompt
        const systemPrompt = await buildSystemPrompt(lenderId)

        // Auto-title on first message
        const isFirstMessage = history.length <= 1
        if (isFirstMessage) {
          const title = message.trim().slice(0, 100)
          await db
            .update(advisorConversations)
            .set({ title, updatedAt: new Date() })
            .where(eq(advisorConversations.id, conversationId))
        } else {
          await db
            .update(advisorConversations)
            .set({ updatedAt: new Date() })
            .where(eq(advisorConversations.id, conversationId))
        }

        // SSE streaming response
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            const send = (data: Record<string, unknown>) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            }

            try {
              const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
              let currentMessages = [...messages]
              let fullResponse = ""
              let toolCallsMetadata: { name: string; input: unknown }[] = []

              // Tool use loop — up to 5 rounds
              for (let round = 0; round < 5; round++) {
                const response = await anthropic.messages.create({
                  model: "claude-sonnet-4-20250514",
                  max_tokens: 2048,
                  system: systemPrompt,
                  tools: advisorTools,
                  messages: currentMessages,
                  stream: true,
                })

                let hasToolUse = false
                let roundText = ""
                const toolUseBlocks: { id: string; name: string; input: string }[] = []
                let currentToolId = ""
                let currentToolName = ""
                let currentToolInput = ""

                for await (const event of response) {
                  if (event.type === "content_block_start") {
                    if (event.content_block.type === "text") {
                      // text block starting
                    } else if (event.content_block.type === "tool_use") {
                      hasToolUse = true
                      currentToolId = event.content_block.id
                      currentToolName = event.content_block.name
                      currentToolInput = ""
                      send({ type: "tool_call", name: currentToolName })
                    }
                  } else if (event.type === "content_block_delta") {
                    if (event.delta.type === "text_delta") {
                      roundText += event.delta.text
                      // Don't send yet — we'll decide after the round if it's thinking or final
                    } else if (event.delta.type === "input_json_delta") {
                      currentToolInput += event.delta.partial_json
                    }
                  } else if (event.type === "content_block_stop") {
                    if (currentToolId) {
                      toolUseBlocks.push({
                        id: currentToolId,
                        name: currentToolName,
                        input: currentToolInput,
                      })
                      currentToolId = ""
                    }
                  }
                }

                if (!hasToolUse) {
                  // Final round — this is the actual response
                  fullResponse = roundText
                  send({ type: "text", content: roundText })
                  break
                }

                // Non-final round — text before tool use is "thinking"
                if (roundText.trim()) {
                  send({ type: "thinking", content: roundText.trim() })
                }

                // Execute tools and continue conversation
                const assistantContent: Anthropic.ContentBlockParam[] = []

                // Add any text that came before tool use
                if (roundText) {
                  assistantContent.push({ type: "text", text: roundText })
                }

                const toolResults: Anthropic.ToolResultBlockParam[] = []
                for (const tool of toolUseBlocks) {
                  let parsedInput = {}
                  try {
                    parsedInput = tool.input ? JSON.parse(tool.input) : {}
                  } catch {
                    // empty input
                  }

                  assistantContent.push({
                    type: "tool_use",
                    id: tool.id,
                    name: tool.name,
                    input: parsedInput,
                  })

                  toolCallsMetadata.push({ name: tool.name, input: parsedInput })
                  const result = await executeAdvisorTool(tool.name, parsedInput, lenderId)
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: tool.id,
                    content: result,
                  })
                }

                // roundText is already handled — reset for next round

                currentMessages = [
                  ...currentMessages,
                  { role: "assistant", content: assistantContent },
                  { role: "user", content: toolResults },
                ]
              }

              // Save assistant message
              await db.insert(advisorMessages).values({
                conversationId,
                role: "assistant",
                content: fullResponse,
                metadata: toolCallsMetadata.length > 0
                  ? JSON.stringify({ toolCalls: toolCallsMetadata })
                  : null,
              })

              send({ type: "done" })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error"
              send({ type: "error", message: errorMessage })
            } finally {
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      },
    },
  },
})
