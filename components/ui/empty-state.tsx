import { type ReactNode } from "react"
import { AlertCircle, FileX, Inbox, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export type EmptyStateVariant = "default" | "search" | "error" | "empty"

const iconMap: Record<EmptyStateVariant, ReactNode> = {
  default: <Inbox aria-hidden="true" />,
  search: <Search aria-hidden="true" />,
  error: <AlertCircle aria-hidden="true" />,
  empty: <FileX aria-hidden="true" />,
}

export interface EmptyStateProps {
  /** One of: "default" | "search" | "error" | "empty" */
  variant?: EmptyStateVariant
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children?: ReactNode
}

/**
 * Replaces scattered inline "no data" / "nothing here" copy blocks.
 * Never conveys meaning through icon alone — every icon is paired with text.
 */
export function EmptyState({
  variant = "default",
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        {iconMap[variant]}
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
      {children}
    </div>
  )
}