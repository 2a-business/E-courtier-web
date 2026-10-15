import { Bath, BedDouble, ImageOff, MapPin, Maximize2, Share2 } from "lucide-react";
import { Link } from "react-router";
import { fcfa, priceSuffix } from "../lib/format";
import type { ListingCard as Listing } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { cn } from "./ui/cn";
import { VerifiedBadge } from "./VerifiedBadge";

export function ListingCover({ listing, className }: { listing: Listing; className?: string }) {
  return listing.cover ? (
    <img src={listing.cover} alt={`Photo : ${listing.title}`} loading="lazy" decoding="async" className={cn("size-full object-cover", className)} />
  ) : (
    <div className={cn("grid size-full place-items-center bg-brand-50 text-brand-400", className)}>
      <ImageOff aria-hidden />
      <span className="sr-only">Pas de photo</span>
    </div>
  );
}

async function share(listing: Listing) {
  const url = `${window.location.origin}/logements/${listing.id}`;
  if (navigator.share) {
    await navigator.share({ title: listing.title, url }).catch(() => undefined);
  } else {
    await navigator.clipboard?.writeText(url);
    window.alert("Lien copié dans le presse-papiers.");
  }
}

export function Features({ listing, compact }: { listing: Listing; compact?: boolean }) {
  const items = [
    listing.bedrooms > 0 && { icon: BedDouble, text: `${listing.bedrooms} ch.` },
    listing.bathrooms > 0 && { icon: Bath, text: `${listing.bathrooms} sdb` },
    listing.surface_m2 && { icon: Maximize2, text: `${listing.surface_m2} m²` },
  ].filter(Boolean) as { icon: typeof Bath; text: string }[];
  return (
    <ul className="flex flex-wrap gap-2">
      <li className={cn("rounded-full border border-line px-3 py-1.5 text-xs font-medium", compact && "py-1")}>{listing.rooms} pièce{listing.rooms > 1 ? "s" : ""}</li>
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className={cn("flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium", compact && "py-1")}>
          <Icon className="size-3.5 text-muted" aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Carte verticale (maquette accueil) : image arrondie, type en surimpression, prix et caractéristiques. */
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white p-2 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <ListingCover listing={listing} className="transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone="dark" className="backdrop-blur">{listing.property_type_label}</Badge>
          {listing.is_demo && <Badge tone="amber">Démonstration</Badge>}
        </div>
        <button
          type="button"
          onClick={() => share(listing)}
          aria-label={`Partager « ${listing.title} »`}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/30 text-white backdrop-blur hover:bg-white/50"
        >
          <Share2 className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold leading-snug">
            <Link to={`/logements/${listing.id}`} className="after:absolute after:inset-0">
              {listing.title}
            </Link>
          </h3>
        </div>
        <p className="text-lg font-bold text-brand-700">
          {fcfa(listing.price)}
          <span className="text-sm font-medium text-muted">{priceSuffix(listing.transaction_type)}</span>
        </p>
        <p className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-4 shrink-0" aria-hidden /> {listing.district}, {listing.city}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Features listing={listing} compact />
        </div>
        {listing.is_verified && <VerifiedBadge className="self-start" />}
      </div>
    </article>
  );
}

/** Carte horizontale (maquette recherche) avec actions « Visiter » et « Voir ». */
export function ListingRow({ listing, active, onHover }: { listing: Listing; active?: boolean; onHover?: (id: string | null) => void }) {
  return (
    <article
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-[var(--shadow-card)] transition sm:flex-row",
        active ? "border-brand-500" : "border-transparent",
      )}
    >
      <div className="relative aspect-[16/10] sm:aspect-auto sm:w-64 sm:shrink-0">
        <ListingCover listing={listing} />
        {listing.is_demo && <Badge tone="amber" className="absolute left-3 top-3">Démonstration</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
          {listing.property_type_label} {listing.transaction_type === "RENT" ? "à louer" : "à vendre"}
          {listing.is_verified && <VerifiedBadge small />}
        </div>
        <p className="text-xl font-bold">
          {fcfa(listing.price)}
          <span className="text-sm font-medium text-muted">{priceSuffix(listing.transaction_type)}</span>
        </p>
        <h3 className="font-semibold">{listing.title}</h3>
        <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-4" aria-hidden /> {listing.district}, {listing.city}</p>
        <Features listing={listing} compact />
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to={`/logements/${listing.id}`}><Button size="sm">Voir le logement</Button></Link>
          <Link to={`/visites/nouveau?logement=${listing.id}`}><Button size="sm" variant="secondary">Planifier une visite</Button></Link>
        </div>
      </div>
    </article>
  );
}
