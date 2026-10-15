import { Check } from "lucide-react";
import { cn } from "./ui/cn";

/** Progression d'un dossier (maquette « Candidature → Examen → Visite → Décision »). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-start" aria-label="Étapes du dossier">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={cn("absolute right-1/2 top-5 h-0.5 w-full -translate-x-5", done || active ? "bg-brand-600" : "bg-line")} />}
            <span
              className={cn(
                "relative z-10 grid size-10 place-items-center rounded-full border-2 text-sm font-bold",
                done ? "border-brand-600 bg-brand-600 text-white" : active ? "border-brand-600 bg-white text-brand-600" : "border-line bg-white text-muted",
              )}
            >
              {done ? <Check className="size-5" aria-hidden /> : active ? <span className="size-3 rounded-full bg-brand-600" /> : i + 1}
            </span>
            <span className={cn("text-xs font-semibold sm:text-sm", active ? "text-brand-700" : done ? "text-ink" : "text-muted")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
