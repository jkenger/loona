import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"

interface TiptapRendererProps {
  content: string // JSON string
}

export function TiptapRenderer({ content }: TiptapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { class: "text-primary underline" },
      }),
    ],
    content: JSON.parse(content),
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none font-sans",
      },
    },
  })

  if (!editor) return null

  return <EditorContent editor={editor} />
}
