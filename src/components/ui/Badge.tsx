import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-surface text-muted",
  brand: "bg-brand-50 text-brand-700",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
  dark: "bg-ink/80 text-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  PUBLISHED: "green", DRAFT: "neutral", ARCHIVED: "neutral", SUSPENDED: "red",
  APPROVED: "green", PENDING: "amber", REJECTED: "red", NOT_SUBMITTED: "neutral", INVALIDATED: "neutral",
  CONFIRMED: "green", CANCELLED: "neutral", COMPLETED: "blue",
  PAID: "green", FAILED: "red", REFUNDED: "blue",
  PENDING_SIGNATURE: "amber", SIGNED: "green",
  OPEN: "amber", IN_REVIEW: "blue", RESOLVED: "green", DISMISSED: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Publiée", DRAFT: "Brouillon", ARCHIVED: "Archivée", SUSPENDED: "Suspendue",
  APPROVED: "Vérifiée", PENDING: "En attente", REJECTED: "Refusée", NOT_SUBMITTED: "Non soumise", INVALIDATED: "Invalidée",
  CONFIRMED: "Confirmée", CANCELLED: "Annulée", COMPLETED: "Effectuée",
  PAID: "Payée", FAILED: "Échouée", REFUNDED: "Remboursée",
  PENDING_SIGNATURE: "À signer", SIGNED: "Signé",
  OPEN: "Ouvert", IN_REVIEW: "En examen", RESOLVED: "Traité", DISMISSED: "Classé",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{label ?? STATUS_LABELS[status] ?? status}</Badge>;
}
