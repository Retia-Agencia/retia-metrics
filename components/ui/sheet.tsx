"use client"

import { useRef, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

/**
 * Panel lateral derecho sobre el Dialog de Base UI (mismo molde que `dialog.tsx`): 480 px en escritorio y pantalla
 * completa en celular, con velo. Al abrir, el foco va a "Cerrar"; Escape o el velo cierran y el foco vuelve a quien lo
 * abrió (lo hace Base UI). Lo usa la explicación de toda cifra (ticket 419, diseño de la Cifra §2).
 */
function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetContent({ className, children, ...props }: Omit<DialogPrimitive.Popup.Props, "children"> & { children: ReactNode }) {
  const cerrar = useRef<HTMLButtonElement>(null)
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-backdrop"
        className="fixed inset-0 z-50 bg-velo transition-opacity duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        initialFocus={cerrar}
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-[480px] overflow-y-auto bg-card p-5 pr-[max(1.25rem,env(safe-area-inset-right))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-flotante outline-none duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right motion-reduce:animate-none",
          className
        )}
        {...props}
      >
        <DialogPrimitive.Close
          ref={cerrar}
          data-slot="sheet-close"
          className="absolute top-5 right-[max(1.25rem,env(safe-area-inset-right))] rounded-lg bg-tono-neutro-suave px-2.5 py-1 text-sm transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cerrar
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close-accion" {...props} />
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="sheet-title" className={cn("text-base font-semibold text-balance", className)} {...props} />
}

function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="sheet-description" className={cn("text-sm", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetContent, SheetClose, SheetTitle, SheetDescription }
