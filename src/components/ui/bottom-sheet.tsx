"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

function BottomSheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="bottom-sheet" {...props} />
}

function BottomSheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />
}

function BottomSheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="bottom-sheet-close" {...props} />
}

function BottomSheetContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="bottom-sheet-overlay"
        className="data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50"
      />
      <DialogPrimitive.Popup
        data-slot="bottom-sheet-content"
        className={cn(
          "bg-background fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] outline-none",
          "data-open:animate-in data-closed:animate-out data-closed:slide-out-to-bottom data-open:slide-in-from-bottom duration-200",
          className
        )}
        {...props}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
}
