"use client"

import { motion } from "framer-motion"

interface LoonaBrandProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "white" | "gradient"
  animated?: boolean
  className?: string
}

const sizeClasses = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
}

const variantClasses = {
  default: "text-foreground",
  white: "text-white",
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
      type: "spring",
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
      ease: "easeInOut",
    },
  },
}

export function LoonaBrand({
  size = "lg",
  variant = "default",
  animated = true,
  className = ""
}: LoonaBrandProps) {
  const letters = "Loona".split("")

  if (!animated) {
    return (
      <span className={`font-bold ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
        Loona
      </span>
    )
  }

  return (
    <motion.div
      className={`relative inline-flex ${className}`}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Glow effect behind text */}
      {variant === "white" && (
        <motion.div
          className="absolute inset-0 blur-xl bg-white/20 rounded-full"
          variants={glowVariants}
          initial="initial"
          animate="animate"
        />
      )}

      {/* Animated letters */}
      <span className={`font-bold ${sizeClasses[size]} ${variantClasses[variant]} relative flex`}>
        {letters.map((letter, index) => (
          <motion.span
            key={index}
            variants={letterVariants}
            className="inline-block"
            style={{ transformOrigin: "bottom" }}
          >
            {letter}
          </motion.span>
        ))}
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
