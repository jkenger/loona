import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Philippine Peso currency (with commas)
 */
export function formatCurrencyInput(value: string): string {
  // Remove all non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, "")

  // Split by decimal point
  const parts = cleaned.split(".")

  // Format the integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  // Join back with decimal (limit to 2 decimal places)
  if (parts.length > 1) {
    return parts[0] + "." + parts[1].slice(0, 2)
  }

  return parts[0]
}

/**
 * Parse a formatted currency string back to a number
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "")
  return parseFloat(cleaned) || 0
}

/**
 * Format Philippine mobile number as 0917 123 4567
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, "")

  // Limit to 11 digits (PH mobile format)
  const limited = cleaned.slice(0, 11)

  // Format as 0917 123 4567
  if (limited.length <= 4) {
    return limited
  } else if (limited.length <= 7) {
    return `${limited.slice(0, 4)} ${limited.slice(4)}`
  } else {
    return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`
  }
}

/**
 * Parse a formatted phone string back to raw digits
 */
export function parsePhoneInput(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Format amount as Philippine Peso (e.g., ₱10,000)
 */
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format amount as compact Philippine Peso (e.g., ₱10K, ₱1.5M)
 */
export function formatCurrencyCompact(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (num >= 1000000) {
    return `₱${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `₱${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`
  }
  return `₱${num.toLocaleString()}`
}
