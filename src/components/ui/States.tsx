import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "../../lib/api";
import { Button } from "./Button";
import { cn } from "./cn";

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">{icon ?? <Inbox aria-hidden />}</span>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const network = error instanceof ApiError && error.status === 0;
  const message = error instanceof ApiError ? error.firstMessage : "Une erreur inattendue est survenue.";
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-[var(--radius-card)] bg-red-50 px-6 py-8 text-center", className)}>
      <span className="mb-2 text-red-600">{network ? <WifiOff aria-hidden /> : <AlertTriangle aria-hidden />}</span>
      <p className="font-semibold text-red-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.firstMessage : "Une erreur est survenue.";
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warning" | "success" | "demo"; children: ReactNode; icon?: ReactNode }) {
  const tones = {
    info: "bg-brand-50 text-brand-800 border-brand-100",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    success: "bg-green-50 text-green-900 border-green-200",
    demo: "bg-orange-50 text-orange-900 border-orange-300 border-dashed",
  };
  return (
    <div className={cn("flex gap-3 rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-line/70", className)} />;
}
