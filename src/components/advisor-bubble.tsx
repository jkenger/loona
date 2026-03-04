import { motion } from "framer-motion"
import { ChatCircleDots } from "@phosphor-icons/react"

interface AdvisorBubbleProps {
  onClick: () => void
}

export function AdvisorBubble({ onClick }: AdvisorBubbleProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <ChatCircleDots className="h-7 w-7" weight="fill" />
    </motion.button>
  )
}
