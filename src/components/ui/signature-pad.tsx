import { useRef, useEffect, useState } from "react"
import SignaturePadLib from "signature_pad"
import { Button } from "@/components/ui/button"
import { Eraser, FloppyDisk } from "@phosphor-icons/react"

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onClear?: () => void
  onClearExisting?: () => void
  width?: number
  height?: number
  disabled?: boolean
  existingSignature?: string | null
  label?: string
}

export function SignaturePad({
  onSave,
  onClear,
  onClearExisting,
  width = 400,
  height = 150,
  disabled = false,
  existingSignature,
  label,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    if (!canvasRef.current || existingSignature || disabled) return

    const canvas = canvasRef.current
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext("2d")?.scale(ratio, ratio)

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(255, 255, 255, 0)",
      penColor: "#000000",
    })

    pad.addEventListener("endStroke", () => {
      setIsEmpty(pad.isEmpty())
    })

    padRef.current = pad
    return () => {
      pad.off()
      padRef.current = null
    }
  }, [existingSignature, disabled])

  const handleClear = () => {
    padRef.current?.clear()
    setIsEmpty(true)
    onClear?.()
  }

  const handleSave = () => {
    if (!padRef.current || padRef.current.isEmpty()) return
    const dataUrl = padRef.current.toDataURL("image/png")
    onSave(dataUrl)
  }

  if (existingSignature) {
    return (
      <div>
        {label && (
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {label}
          </p>
        )}
        <div
          className="border rounded-lg p-2 bg-white"
          style={{ maxWidth: width }}
        >
          <img
            src={existingSignature}
            alt={label || "Signature"}
            className="w-full h-auto"
            style={{ maxHeight: height }}
          />
        </div>
        {onClearExisting && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearExisting}
            className="mt-1.5 text-xs text-muted-foreground"
          >
            <Eraser className="h-3 w-3 mr-1" />
            Re-sign
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {label}
        </p>
      )}
      <div
        className="border-2 border-dashed rounded-lg bg-white relative"
        style={{ width: "100%", maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: `${height}px`,
            touchAction: "none",
            cursor: disabled ? "default" : "crosshair",
          }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground/50">
              Sign here
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="gap-1.5"
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={disabled || isEmpty}
          className="gap-1.5"
        >
          <FloppyDisk className="h-3.5 w-3.5" />
          Save Signature
        </Button>
      </div>
    </div>
  )
}
