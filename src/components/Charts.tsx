import { useId, useState } from "react";

/** Série temporelle unique (aire + ligne 2px), info-bulle au survol / clavier, tableau accessible. */
export function DailyAreaChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { l: 28, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.count)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const fmt = (d: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00`));
  const ticks = [0, Math.round(max / 2), max];

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-labelledby={`${id}-t`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
        }}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
      >
        <title id={`${id}-t`}>{label}</title>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-brand-600)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--color-brand-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">{t}</text>
          </g>
        ))}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => data[i] && (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--color-muted)">{fmt(data[i].date)}</text>
        ))}
        <path d={area} fill={`url(#${id}-g)`} />
        <path d={line} fill="none" stroke="var(--color-brand-600)" strokeWidth="2" strokeLinejoin="round" />
        {hover !== null && data[hover] && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-muted)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].count)} r="5" fill="var(--color-brand-600)" stroke="#fff" strokeWidth="2" />
          </>
        )}
        {data.map((_, i) => (
          <rect key={i} x={x(i) - (W / data.length) / 2} y={0} width={W / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl bg-ink px-3 py-1.5 text-xs text-white shadow"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          {fmt(data[hover].date)} · <strong>{data[hover].count}</strong>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Date</th><th>Nombre</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Barres-jauges étiquetées (libellé + valeur en texte, la couleur n'est jamais seule porteuse de sens). */
export function MeterList({ items }: { items: { label: string; value: number; tone?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate">{i.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface">
            <span className="block h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.tone ?? "var(--color-brand-500)" }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
