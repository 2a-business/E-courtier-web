import { cn } from "./cn";

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-[var(--shadow-card)] [scrollbar-width:none]">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
            value === item.value ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
          )}
        >
          {item.label}
          {item.count ? (
            <span className={cn("rounded-full px-1.5 text-xs", value === item.value ? "bg-white/25" : "bg-brand-50 text-brand-700")}>{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, count, pageSize, onPage }: { page: number; count: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      <button type="button" className="h-10 rounded-full border border-line bg-white px-4 text-sm disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </button>
      {visible.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && visible[i - 1] !== p - 1 && <span className="text-muted">…</span>}
          <button
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPage(p)}
            className={cn("size-10 rounded-full text-sm font-semibold", p === page ? "bg-brand-600 text-white" : "border border-line bg-white")}
          >
            {p}
          </button>
        </span>
      ))}
      <button type="button" className="h-10 rounded-full border border-line bg-white px-4 text-sm disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Suivant
      </button>
    </nav>
  );
}
