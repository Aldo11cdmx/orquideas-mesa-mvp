"use client"

import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { cn } from "@/lib/utils"

/**
 * A single module-level manager so toasts can be fired from anywhere
 * (API error handlers, async actions) without a hook.
 */
export const toastManager = Toast.createToastManager()

export interface ToastOptions {
  title: string
  description?: React.ReactNode
  type?: "success" | "error" | "warning" | "info"
  timeout?: number
  action?: React.ComponentPropsWithoutRef<"button">
}

const TYPE_TO_TONE: Record<NonNullable<ToastOptions["type"]>, string> = {
  success: "border-[var(--state-success)]/40 bg-[var(--state-success-soft)]",
  error: "border-[var(--state-error)]/40 bg-[var(--state-error-soft)]",
  warning: "border-[var(--state-warning)]/40 bg-[var(--state-warning-soft)]",
  info: "border-[var(--state-info)]/40 bg-[var(--state-info-soft)]",
}

export function toast(options: ToastOptions): string {
  return toastManager.add({
    ...options,
    type: options.type ?? "info",
  })
}

export function toastSuccess(title: string, description?: React.ReactNode) {
  return toast({ title, description, type: "success" })
}
export function toastError(title: string, description?: React.ReactNode) {
  return toast({ title, description, type: "error" })
}
export function toastWarning(title: string, description?: React.ReactNode) {
  return toast({ title, description, type: "warning" })
}
export function toastInfo(title: string, description?: React.ReactNode) {
  return toast({ title, description, type: "info" })
}

/**
 * Wraps an async action: pending → success/error toasts.
 */
export function toastPromise<Value>(
  promise: Promise<Value>,
  messages: {
    loading: string
    success: string | ((result: Value) => string)
    error: string | ((err: unknown) => string)
  }
): Promise<Value> {
  return toastManager.promise(promise, {
    loading: messages.loading,
    success: (result) => ({
      title: typeof messages.success === "function" ? messages.success(result) : messages.success,
      type: "success",
    }),
    error: (err) => ({
      title: typeof messages.error === "function" ? messages.error(err) : messages.error,
      type: "error",
    }),
  })
}

export function useToast() {
  return {
    toast,
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
    promise: toastPromise,
  }
}

export interface ToastViewportProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center"
}

/**
 * Drop this once near the root layout. Renders nothing on the server.
 */
export function ToastViewport({
  position = "bottom-right",
  className,
  ...props
}: ToastViewportProps) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={4000} limit={4}>
      <ToastViewportImpl position={position} className={className} {...props} />
    </Toast.Provider>
  )
}

function ToastViewportImpl({
  position,
  className,
  ...props
}: ToastViewportProps) {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Viewport
      className={cn(
        "fixed z-[100] flex w-full max-w-sm flex-col gap-2 p-4",
        position === "top-right" && "top-0 right-0 items-end",
        position === "top-center" && "top-0 left-1/2 -translate-x-1/2 items-center",
        position === "bottom-right" && "bottom-0 right-0 items-end",
        position === "bottom-center" && "bottom-0 left-1/2 -translate-x-1/2 items-center",
        className
      )}
      {...props}
    >
      {toasts.map((t) => (
        <ToastRoot key={t.id} toast={t} />
      ))}
    </Toast.Viewport>
  )
}

/**
 * Render one toast. Pair this with a `useToastManager` selector in a parent
 * that maps `toasts` → array of `<ToastRoot toast={t} />`.
 */
export function ToastRoot({ toast: toastObj }: { toast: React.ComponentProps<typeof Toast.Root>["toast"] }) {
  return (
    <Toast.Root
      toast={toastObj}
      className={cn(
        "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border bg-card p-4 text-card-foreground shadow-lg ring-1 ring-black/5 transition-all",
        TYPE_TO_TONE[(toastObj.type as keyof typeof TYPE_TO_TONE) ?? "info"] ?? TYPE_TO_TONE.info
      )}
    />
  )
}