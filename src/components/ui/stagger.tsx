import { motion, useReducedMotion } from "framer-motion"
import { type ReactNode } from "react"

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

interface StaggerProps {
  children: ReactNode
  className?: string
}

export function Stagger({ children, className }: StaggerProps) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: StaggerProps) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
