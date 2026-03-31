import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkle, ArrowRight } from "@phosphor-icons/react"

export function LunaDashboardWidget() {
  const [input, setInput] = useState("")
  const navigate = useNavigate()

  const handleSubmit = () => {
    if (input.trim()) {
      navigate({ to: "/luna", search: { message: input.trim() } })
    } else {
      navigate({ to: "/luna" })
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkle className="h-3 w-3 text-white" weight="fill" />
          </div>
          <CardTitle className="text-base font-semibold">Luna AI</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="text-xs text-muted-foreground mb-3">
          Ask about your portfolio, payments, or borrowers
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Ask Luna anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="h-8 text-sm"
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSubmit}>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
