import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router"
import { getServerSession } from "@/server/session"
import { ChartLineUp, ShieldCheck, Users, Lightning } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { LoonaBrand, AnimatedTagline, FloatingCircle } from "@/components/ui/loona-brand"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AuthLayout,
})

const features = [
  {
    icon: ChartLineUp,
    title: "Track Everything",
    description: "Monitor loans, payments, and cashflow in real-time",
  },
  {
    icon: Users,
    title: "Manage Contacts",
    description: "Keep all borrower information organized",
  },
  {
    icon: Lightning,
    title: "Fast & Simple",
    description: "Record payments in seconds, not minutes",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Private",
    description: "Your data is encrypted and protected",
  },
]

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      damping: 15,
      stiffness: 100,
    },
  },
}

const featureCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      damping: 20,
      stiffness: 100,
    },
  },
  hover: {
    scale: 1.02,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    transition: { duration: 0.2 },
  },
}

function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated decorative circles */}
        <FloatingCircle
          className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"
          delay={0}
          duration={8}
        />
        <FloatingCircle
          className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"
          delay={0.5}
          duration={7}
        />
        <FloatingCircle
          className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2"
          delay={1}
          duration={10}
        />

        {/* Content */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <LoonaBrand size="xl" variant="white" animated />
          <AnimatedTagline
            text="Loan Management Made Simple"
            className="text-primary-foreground/70 mt-2"
            delay={0.8}
          />
        </motion.div>

        <motion.div
          className="relative z-10 space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Manage your lending business with confidence
            </h2>
            <p className="text-primary-foreground/70">
              Everything you need to track loans, collect payments, and grow your portfolio.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 gap-4"
            variants={containerVariants}
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-default"
                variants={featureCardVariants}
                whileHover="hover"
                custom={index}
              >
                <motion.div
                  initial={{ rotate: -10, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    delay: 0.8 + index * 0.1,
                    damping: 10,
                    stiffness: 200,
                  }}
                >
                  <feature.icon className="h-6 w-6 text-white mb-2" weight="duotone" />
                </motion.div>
                <h3 className="font-medium text-white text-sm">{feature.title}</h3>
                <p className="text-primary-foreground/60 text-xs mt-1">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
        >
          <p className="text-primary-foreground/50 text-sm mb-2">
            Trusted by lenders across the Philippines
          </p>
          <div className="flex gap-4 text-xs text-primary-foreground/40">
            <Link to="/privacy" className="hover:text-primary-foreground/70 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-primary-foreground/70 transition-colors">
              Terms of Service
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-page p-6 sm:p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Outlet />
        </motion.div>

        {/* Footer links - visible on mobile */}
        <motion.div
          className="lg:hidden mt-8 flex gap-4 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
