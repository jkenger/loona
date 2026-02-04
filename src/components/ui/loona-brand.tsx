"use client"

import { motion } from "framer-motion"

interface LoonaBrandProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "white" | "dark" | "gradient"
  animated?: boolean
  showMoon?: boolean
  className?: string
}

const sizeClasses = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
}

const moonSizeClasses = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
}

const variantClasses = {
  default: "text-foreground",
  white: "text-white",
  dark: "text-slate-900",
  gradient: "bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent",
}

// Letter animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const letterVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    rotateX: -90,
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      type: "spring" as const,
      damping: 12,
      stiffness: 200,
    },
  },
}

// Glow pulse animation
const glowVariants = {
  initial: { opacity: 0.5, scale: 1 },
  animate: {
    opacity: [0.5, 0.8, 0.5],
    scale: [1, 1.02, 1],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

export function LoonaBrand({
  size = "lg",
  variant = "default",
  animated = true,
  showMoon = true,
  className = ""
}: LoonaBrandProps) {
  const letters = "Loona".split("")

  // Non-animated version with moon accent
  if (!animated) {
    return (
      <span className={`font-bold ${sizeClasses[size]} relative inline-flex items-center ${className}`}>
        {variant === "white" ? (
          <>
            <span className="text-white">L</span>
            <span className="relative">
              {showMoon && (
                <span className={`absolute -top-0.5 -right-1 ${moonSizeClasses[size]} rounded-full bg-primary`} />
              )}
              <span className="text-primary">oo</span>
            </span>
            <span className="text-white">na</span>
          </>
        ) : variant === "dark" ? (
          <>
            <span className="text-slate-900">L</span>
            <span className="relative">
              {showMoon && (
                <span className={`absolute -top-0.5 -right-1 ${moonSizeClasses[size]} rounded-full bg-primary`} />
              )}
              <span className="text-primary">oo</span>
            </span>
            <span className="text-slate-900">na</span>
          </>
        ) : (
          <span className={variantClasses[variant]}>
            L
            <span className="relative">
              {showMoon && (
                <span className={`absolute -top-0.5 -right-1 ${moonSizeClasses[size]} rounded-full bg-primary`} />
              )}
              oo
            </span>
            na
          </span>
        )}
      </span>
    )
  }

  return (
    <motion.div
      className={`relative inline-flex items-center ${className}`}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Glow effect behind text */}
      {variant === "white" && (
        <motion.div
          className="absolute inset-0 blur-xl bg-primary/30 rounded-full"
          variants={glowVariants}
          initial="initial"
          animate="animate"
        />
      )}

      {/* Animated letters with special treatment */}
      <span className={`font-bold ${sizeClasses[size]} relative flex items-center`}>
        {letters.map((letter, index) => {
          // "oo" gets primary color treatment
          const isOo = index === 1 || index === 2
          const colorClass = variant === "white"
            ? (isOo ? "text-primary" : "text-white")
            : variant === "dark"
            ? (isOo ? "text-primary" : "text-slate-900")
            : variantClasses[variant]

          return (
            <motion.span
              key={index}
              variants={letterVariants}
              className={`inline-block ${colorClass}`}
              style={{ transformOrigin: "bottom" }}
            >
              {letter}
              {/* Moon dot after second "o" */}
              {index === 2 && showMoon && (
                <motion.span
                  className={`absolute -top-0.5 -right-1 ${moonSizeClasses[size]} rounded-full bg-primary`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
                />
              )}
            </motion.span>
          )
        })}
      </span>
    </motion.div>
  )
}

// Animated tagline component
interface TaglineProps {
  text: string
  className?: string
  delay?: number
}

export function AnimatedTagline({ text, className = "", delay = 0.5 }: TaglineProps) {
  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay,
        ease: "easeOut"
      }}
    >
      {text}
    </motion.p>
  )
}

// Floating animation for decorative elements
export function FloatingCircle({
  className,
  delay = 0,
  duration = 6,
}: {
  className: string
  delay?: number
  duration?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -20, 0],
      }}
      transition={{
        opacity: { duration: 0.8, delay },
        scale: { duration: 0.8, delay },
        y: {
          duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
      }}
    />
  )
}
