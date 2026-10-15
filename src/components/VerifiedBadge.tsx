import { BadgeCheck } from "lucide-react";
import { cn } from "./ui/cn";

/** Le badge n'est affiché que si l'API indique une décision APPROVED. */
export function VerifiedBadge({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span
      title="Justificatifs examinés par E-Courtier (sans garantie juridique)"
      className={cn("inline-flex items-center gap-1 rounded-full bg-green-50 font-semibold text-green-700", small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs", className)}
    >
      <BadgeCheck className={small ? "size-3.5" : "size-4"} aria-hidden />
      Annonce vérifiée
    </span>
  );
}
