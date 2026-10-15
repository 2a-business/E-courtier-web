const number = new Intl.NumberFormat("fr-FR");

/** 280000 → « 280 000 FCFA » (franc CFA BCEAO, XOF). */
export function fcfa(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${number.format(value).replace(/ | /g, " ")} FCFA`;
}

export function priceSuffix(transactionType: string): string {
  return transactionType === "RENT" ? " / mois" : "";
}

const TZ = "Africa/Dakar";

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDayLong(iso: string): string {
  const s = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(iso),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Clé AAAA-MM-JJ dans le fuseau de Dakar. */
export function dayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: "APARTMENT", label: "Appartement" },
  { value: "HOUSE", label: "Maison" },
  { value: "VILLA", label: "Villa" },
  { value: "STUDIO", label: "Studio" },
  { value: "ROOM", label: "Chambre" },
  { value: "LAND", label: "Terrain" },
  { value: "OFFICE", label: "Bureau / local" },
];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  AGENT: "Agent immobilier",
  OWNER: "Propriétaire",
  CUSTOMER: "Client",
};
