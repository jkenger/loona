import { useState, useEffect } from "react"

/**
 * Hex color palette for html2canvas PDF zones.
 * When pdfMode is true, always returns light-mode colors
 * so the captured PDF looks correct regardless of theme.
 */
export function useDocColors(pdfMode: boolean) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  const dark = isDark && !pdfMode

  return {
    bg: dark ? "#1e293b" : "white",
    text: dark ? "#e2e8f0" : "#374151",
    textStrong: dark ? "#f1f5f9" : "#111827",
    muted: dark ? "#94a3b8" : "#6b7280",
    border: dark ? "#334155" : "#e5e7eb",
    borderStrong: dark ? "#475569" : "#d1d5db",
    rowAlt: dark ? "#253349" : "#f9fafb",
    rowEven: dark ? "#1e293b" : "white",
    mutedBg: dark ? "#334155" : "#f3f4f6",
    headerBg: dark ? "#334155" : "#e5e7eb",
    green: dark ? "#22c55e" : "#16a34a",
    greenBg: dark ? "#14532d" : "#dcfce7",
    amber: dark ? "#f59e0b" : "#d97706",
    amberBg: dark ? "#78350f" : "#fef3c7",
    purple: dark ? "#a78bfa" : "#7c3aed",
    purpleBg: dark ? "#3b0764" : "#ede9fe",
    blue: dark ? "#60a5fa" : "#2563eb",
    blueBg: dark ? "#1e3a5f" : "#dbeafe",
  }
}

/**
 * Shared html2pdf.js wrapper — generates a PDF from an element.
 */
export async function generatePdf(element: HTMLElement, filename: string) {
  const html2pdf = (await import("html2pdf.js")).default

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: {
      unit: "mm" as const,
      format: "a4" as const,
      orientation: "portrait" as const,
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] as const },
  }

  await html2pdf().set(opt).from(element).save()
}
