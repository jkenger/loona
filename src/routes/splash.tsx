import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getServerSession } from "@/server/session"
import { getDashboardPath } from "@/lib/constants/roles"
import { LoonaBrand, AnimatedTagline, FloatingCircle } from "@/components/ui/loona-brand"

export const Route = createFileRoute("/splash")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: "/login" })
    }
    return { session }
  },
  component: SplashScreen,
})

function SplashScreen() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2000)
    const navTimer = setTimeout(() => {
      router.navigate({ to: getDashboardPath(session.user.role) })
    }, 2500)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(navTimer)
    }
  }, [router, session.user.role])

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/80 overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Decorative floating circles */}
          <FloatingCircle
            className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"
            delay={0}
            duration={8}
          />
          <FloatingCircle
            className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"
            delay={0.3}
            duration={7}
          />
          <FloatingCircle
            className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2"
            delay={0.6}
            duration={10}
          />

          {/* Brand content */}
          <div className="relative z-10 flex flex-col items-center">
            <LoonaBrand size="xl" variant="white" animated />
            <AnimatedTagline
              text="Loan Management Made Simple"
              className="text-primary-foreground/70 mt-3 text-lg"
              delay={0.8}
            />

            {/* Pulsing dots loader */}
            <motion.div
              className="flex gap-1.5 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-white/60"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
