import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { db, lunaConversations, lunaMessages } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import {
  anthropic,
  buildSystemPrompt,
  buildAnthropicMessages,
  getAnthropicToolDefinitions,
} from "@/server/luna/chat"
import { executeTool } from "@/server/luna/tools"

const MAX_TOOL_ROUNDS = 8

export const Route = createFileRoute("/api/luna/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Authenticate via session cookie
        const session = await auth.api.getSession({
          headers: request.headers,
        })
        if (!session) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        }

        const lenderId = session.user.id
        const body = await request.json()
        const { conversationId: inputConversationId, message } = body as {
          conversationId?: string
          message: string
        }

        if (!message?.trim()) {
          return new Response(
            JSON.stringify({ error: "Message is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          )
        }

        // Create or validate conversation
        let conversationId = inputConversationId

        if (conversationId) {
          const [existing] = await db
            .select({ id: lunaConversations.id })
            .from(lunaConversations)
            .where(
              and(
                eq(lunaConversations.id, conversationId),
                eq(lunaConversations.lenderId, lenderId),
              ),
            )
          if (!existing) {
            return new Response(
              JSON.stringify({ error: "Conversation not found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              },
            )
          }
        } else {
          const [conv] = await db
            .insert(lunaConversations)
            .values({ lenderId })
            .returning()
          conversationId = conv.id
        }

        // Save user message
        await db.insert(lunaMessages).values({
          conversationId,
          role: "user",
          content: message,
        })

        // Update lastMessageAt
        await db
          .update(lunaConversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(lunaConversations.id, conversationId))

        // Load history
        const history = await db
          .select()
          .from(lunaMessages)
          .where(eq(lunaMessages.conversationId, conversationId))
          .orderBy(lunaMessages.createdAt)

        const systemPrompt = await buildSystemPrompt(lenderId)
        const anthropicMessages = buildAnthropicMessages(history)
        const tools = getAnthropicToolDefinitions()

        // Stream response
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            const send = (data: any) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              )
            }

            try {
              let currentMessages = anthropicMessages
              let rounds = 0

              while (rounds < MAX_TOOL_ROUNDS) {
                rounds++
                let assistantText = ""
                const toolCalls: Array<{
                  id: string
                  name: string
                  input: any
                }> = []

                const response = anthropic.messages.stream({
                  model: "claude-sonnet-4-20250514",
                  max_tokens: 4096,
                  system: systemPrompt,
                  messages: currentMessages,
                  tools,
                })

                for await (const event of response) {
                  if (
                    event.type === "content_block_delta" &&
                    event.delta.type === "text_delta"
                  ) {
                    assistantText += event.delta.text
                    send({ type: "text", content: event.delta.text })
                  }

                  if (
                    event.type === "content_block_stop" &&
                    event.index !== undefined
                  ) {
                    const finalMessage = await response.finalMessage()
                    const block = finalMessage.content[event.index]
                    if (block?.type === "tool_use") {
                      toolCalls.push({
                        id: block.id,
                        name: block.name,
                        input: block.input,
                      })
                    }
                  }
                }

                const finalMessage = await response.finalMessage()

                if (toolCalls.length === 0) {
                  // No tool calls — save assistant message and finish
                  if (assistantText) {
                    await db.insert(lunaMessages).values({
                      conversationId: conversationId!,
                      role: "assistant",
                      content: assistantText,
                    })
                  }

                  // Auto-title on first exchange
                  const [conv] = await db
                    .select({ title: lunaConversations.title })
                    .from(lunaConversations)
                    .where(eq(lunaConversations.id, conversationId!))

                  if (!conv?.title && message.length > 0) {
                    const title =
                      message.length > 60
                        ? message.slice(0, 57) + "..."
                        : message
                    await db
                      .update(lunaConversations)
                      .set({ title })
                      .where(eq(lunaConversations.id, conversationId!))
                  }

                  send({
                    type: "done",
                    conversationId,
                  })
                  break
                }

                // Process tool calls
                const toolResults: Array<{
                  tool_use_id: string
                  content: string
                }> = []

                for (const tc of toolCalls) {
                  send({
                    type: "tool_call",
                    toolName: tc.name,
                    toolCallId: tc.id,
                  })

                  // Save tool_call message
                  await db.insert(lunaMessages).values({
                    conversationId: conversationId!,
                    role: "tool_call",
                    content: JSON.stringify(tc.input),
                    toolName: tc.name,
                    toolCallId: tc.id,
                  })

                  // Execute tool
                  const result = await executeTool(tc.name, tc.input, lenderId)

                  // Save tool_result message
                  await db.insert(lunaMessages).values({
                    conversationId: conversationId!,
                    role: "tool_result",
                    content: result.result,
                    toolName: tc.name,
                    toolCallId: tc.id,
                  })

                  send({
                    type: "tool_result",
                    toolCallId: tc.id,
                    toolName: tc.name,
                    result: result.result,
                    contextCard: result.contextCard,
                  })

                  toolResults.push({
                    tool_use_id: tc.id,
                    content: result.result,
                  })
                }

                // Build messages for next round
                // Add the assistant's full response (text + tool_use blocks)
                currentMessages = [
                  ...currentMessages,
                  {
                    role: "assistant" as const,
                    content: finalMessage.content,
                  },
                  {
                    role: "user" as const,
                    content: toolResults.map((tr) => ({
                      type: "tool_result" as const,
                      ...tr,
                    })),
                  },
                ]
              }
            } catch (error: any) {
              send({
                type: "error",
                message: error.message || "An error occurred",
              })
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
