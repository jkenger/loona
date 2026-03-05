import { motion } from "framer-motion"
import { Sparkle } from "@phosphor-icons/react"

interface AdvisorBubbleProps {
  onClick: () => void
  alertCount?: number
}

export function AdvisorBubble({ onClick, alertCount = 0 }: AdvisorBubbleProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-violet-500 to-indigo-500 text-white shadow-lg hover:shadow-xl transition-shadow"
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {/* Pulse ring on first appearance */}
      <motion.span
        className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-violet-500 to-indigo-500"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
      <Sparkle className="h-7 w-7" weight="fill" />
      {alertCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
          {alertCount > 9 ? "9+" : alertCount}
        </span>
      )}
    </motion.button>
  )
}
