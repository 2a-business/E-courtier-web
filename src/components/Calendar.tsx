import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "./ui/cn";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Calendrier mensuel : seuls les jours ayant des créneaux disponibles sont sélectionnables. */
export function Calendar({ available, selected, onSelect }: { available: Set<string>; selected: string | null; onSelect: (day: string) => void }) {
  const first = [...available].sort()[0];
  const [month, setMonth] = useState(() => {
    const base = first ? new Date(`${first}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const cells = useMemo(() => {
    const offset = (month.getDay() + 6) % 7; // semaine commençant le lundi
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month);

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mois précédent" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-full hover:bg-surface">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="font-semibold capitalize" aria-live="polite">{label}</p>
        <button type="button" aria-label="Mois suivant" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-full hover:bg-surface">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center" role="grid" aria-label={`Disponibilités, ${label}`}>
        {WEEKDAYS.map((d, i) => <span key={i} className="py-1 text-xs font-semibold text-muted" aria-hidden>{d}</span>)}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const k = key(date);
          const enabled = available.has(k);
          const isSelected = selected === k;
          return (
            <button
              key={k}
              type="button"
              disabled={!enabled}
              aria-pressed={isSelected}
              aria-label={`${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date)}${enabled ? ", créneaux disponibles" : ", indisponible"}`}
              onClick={() => onSelect(k)}
              className={cn(
                "mx-auto grid size-10 place-items-center rounded-full text-sm transition",
                isSelected ? "bg-brand-600 font-bold text-white" : enabled ? "bg-brand-50 font-semibold text-brand-800 hover:bg-brand-100" : "border border-line text-muted/50",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
