import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldWarning, House } from "@phosphor-icons/react"

interface AccessDeniedProps {
  title?: string
  message?: string
  homeLink?: string
  homeLinkLabel?: string
}

export function AccessDenied({
  title = "Access Denied",
  message = "You don't have permission to view this page.",
  homeLink = "/",
  homeLinkLabel = "Go to Dashboard",
}: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <ShieldWarning className="h-8 w-8 text-destructive" weight="fill" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground mb-6">{message}</p>
          <Link to={homeLink}>
            <Button className="gap-2">
              <House className="h-4 w-4" />
              {homeLinkLabel}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
