import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Bath, BedDouble, Building2, CalendarDays, ChevronLeft, ChevronRight, DoorOpen, Images, Info, MapPin, Maximize2, Pencil, ShieldCheck, Sofa, UserRound,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ReportButton } from "../components/ReportDialog";
import { ReviewsSection, Stars } from "../components/Reviews";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { ErrorState, Notice, Skeleton } from "../components/ui/States";
import { ApiError, api } from "../lib/api";
import { fcfa, formatDate, priceSuffix, ROLE_LABELS } from "../lib/format";
import type { ListingDetail } from "../lib/types";
import NotFoundPage from "./NotFoundPage";

const ApproxLocationMap = lazy(() => import("../components/MapView").then((m) => ({ default: m.ApproxLocationMap })));

function Gallery({ listing }: { listing: ListingDetail }) {
  const [index, setIndex] = useState<number | null>(null);
  const photos = listing.photos;
  if (!photos.length) return <div className="grid aspect-[16/9] place-items-center rounded-[var(--radius-card)] bg-brand-50 text-muted">Aucune photo</div>;
  const go = (delta: number) => setIndex((i) => (i === null ? 0 : (i + delta + photos.length) % photos.length));
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <button type="button" onClick={() => setIndex(0)} className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] lg:aspect-auto lg:h-[460px]">
          <img src={photos[0].image} alt={photos[0].caption || listing.title} className="size-full object-cover" fetchPriority="high" />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow">
            <Images className="size-4" aria-hidden /> Toutes les photos ({photos.length})
          </span>
        </button>
        <div className="hidden grid-cols-2 gap-3 lg:grid">
          {photos.slice(1, 5).map((p, i) => (
            <button key={p.id} type="button" onClick={() => setIndex(i + 1)} className="flex flex-col gap-1 text-left">
              <img src={p.thumbnail || p.image} alt={p.caption || `Photo ${i + 2}`} loading="lazy" className="h-[200px] w-full rounded-2xl object-cover" />
              {p.caption && <span className="text-sm font-medium">{p.caption}</span>}
            </button>
          ))}
        </div>
      </div>
      <Modal open={index !== null} onClose={() => setIndex(null)} title={`Photo ${(index ?? 0) + 1} sur ${photos.length}`}>
        {index !== null && (
          <div className="space-y-3">
            <img src={photos[index].image} alt={photos[index].caption || listing.title} className="w-full rounded-2xl" />
            {photos[index].caption && <p className="text-sm text-muted">{photos[index].caption}</p>}
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => go(-1)}><ChevronLeft className="size-4" aria-hidden /> Précédente</Button>
              <Button variant="secondary" onClick={() => go(1)}>Suivante <ChevronRight className="size-4" aria-hidden /></Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Feature({ icon: Icon, value, label }: { icon: typeof Bath; value: string; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-5 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function ListingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["listing", id, user?.id], queryFn: () => api<ListingDetail>(`/listings/${id}/`) });

  if (query.isPending) {
    return <div className="mx-auto max-w-7xl space-y-4 px-4 py-6"><Skeleton className="h-[460px]" /><Skeleton className="h-40" /></div>;
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage title="Annonce introuvable" text="Elle a peut-être été retirée ou n'est plus publiée." />;
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>;
  }
  const l = query.data;
  const own = user && l.owner.id === user.id;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-4 md:pb-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Retour
        </button>
        {l.can_manage && (
          <Link to={`/tableau-de-bord/annonces/${l.id}`}><Button size="sm" variant="secondary"><Pencil className="size-4" aria-hidden /> Gérer l'annonce</Button></Link>
        )}
      </div>

      {l.is_demo && <div className="mb-4"><Notice tone="demo">Annonce de <strong>démonstration</strong> : le bien, les photos (illustrations générées) et le propriétaire sont fictifs.</Notice></div>}
      {l.publication_status !== "PUBLISHED" && <div className="mb-4"><Notice tone="warning">Cette annonce n'est pas visible du public (statut : <StatusBadge status={l.publication_status} />).</Notice></div>}

      <Gallery listing={l} />

      <nav aria-label="Fil d'Ariane" className="mt-5 text-sm text-muted">
        <ol className="flex flex-wrap gap-1">
          <li><Link to="/" className="hover:text-ink">Accueil</Link> ›</li>
          <li><Link to={`/recherche?city=${encodeURIComponent(l.city)}`} className="hover:text-ink">{l.city}</Link> ›</li>
          <li><Link to={`/recherche?district=${encodeURIComponent(l.district)}`} className="hover:text-ink">{l.district}</Link> ›</li>
          <li aria-current="page" className="text-ink">{l.property_type_label}</li>
        </ol>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{l.property_type_label} · {l.transaction_type === "RENT" ? "Location" : "Vente"}</Badge>
              {l.is_verified && <VerifiedBadge />}
              {l.is_furnished && <Badge>Meublé</Badge>}
              {l.rating.count > 0 && <span className="inline-flex items-center gap-1 text-sm"><Stars value={l.rating.average ?? 0} /> ({l.rating.count})</span>}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{l.title}</h1>
            <p className="mt-2 text-2xl font-bold text-brand-700 lg:hidden">{fcfa(l.price)}<span className="text-base font-medium text-muted">{priceSuffix(l.transaction_type)}</span></p>
          </div>

          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 text-brand-600" aria-hidden />
              <div>
                <p className="font-semibold">{l.address_private ?? l.address_public ?? `Quartier ${l.district}`}</p>
                <p className="text-sm text-muted">{l.district}, {l.city}</p>
                {!l.address_private && <p className="mt-1 text-xs text-muted">L'adresse exacte est communiquée après confirmation de votre visite.</p>}
              </div>
            </div>
            {l.latitude && <a href="#localisation" className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold">Voir la localisation</a>}
          </Card>

          <section>
            <h2 className="mb-4 text-xl font-bold">Caractéristiques</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {l.surface_m2 && <Feature icon={Maximize2} value={`${l.surface_m2} m²`} label="Surface" />}
              <Feature icon={DoorOpen} value={`${l.rooms} pièce${l.rooms > 1 ? "s" : ""}`} label="Pièces" />
              <Feature icon={BedDouble} value={`${l.bedrooms} chambre${l.bedrooms > 1 ? "s" : ""}`} label="Chambres" />
              <Feature icon={Bath} value={`${l.bathrooms}`} label="Salles de bain" />
              <Feature icon={Sofa} value={l.is_furnished ? "Meublé" : "Non meublé"} label="Ameublement" />
              <Feature icon={Building2} value={l.property_type_label} label="Type de bien" />
              <Feature icon={CalendarDays} value={formatDate(l.published_at)} label="Publication" />
            </div>
          </section>

          {l.amenities.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">Équipements</h2>
              <ul className="flex flex-wrap gap-2">
                {l.amenities.map((a) => <li key={a.slug} className="rounded-full border border-line bg-white px-4 py-2 text-sm">{a.label}</li>)}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-bold">Description</h2>
            <p className="whitespace-pre-line leading-relaxed text-ink/90">{l.description}</p>
          </section>

          {l.latitude && l.longitude && (
            <section id="localisation">
              <h2 className="mb-3 text-xl font-bold">Localisation approximative</h2>
              <Card className="h-72 overflow-hidden">
                <Suspense fallback={<div className="grid size-full place-items-center"><Spinner /></div>}>
                  <ApproxLocationMap lat={l.latitude} lng={l.longitude} />
                </Suspense>
              </Card>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-bold">Avis</h2>
            <ReviewsSection listingId={l.id} />
          </section>

          <ReportButton listingId={l.id} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4 p-5">
            <div>
              <p className="text-sm text-muted">{l.transaction_type === "RENT" ? "Loyer mensuel" : "Prix de vente"}</p>
              <p className="text-3xl font-extrabold">{fcfa(l.price)}</p>
            </div>
            {own ? (
              <Notice tone="info">C'est votre annonce. Gérez les créneaux de visite depuis votre tableau de bord.</Notice>
            ) : (
              <Link to={`/visites/nouveau?logement=${l.id}`} className="block">
                <Button block size="lg"><CalendarDays className="size-5" aria-hidden /> Planifier une visite</Button>
              </Link>
            )}
            <dl className="space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{l.transaction_type === "RENT" ? "1er mois de loyer" : "Acompte de réservation"}</dt><dd className="font-semibold">{l.transaction_type === "RENT" ? fcfa(l.price) : "selon conditions"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Frais de dossier E-Courtier</dt><dd className="font-semibold">5 000 FCFA</dd></div>
            </dl>
            <p className="flex gap-2 text-xs text-muted"><Info className="size-4 shrink-0" aria-hidden /> Le dossier et le paiement se font après une visite confirmée. Les frais de dossier sont toujours affichés séparément.</p>
            {!own && (
              <Link to={`/paiement?logement=${l.id}`} className="block text-center text-sm font-semibold text-brand-700 hover:underline">
                Déjà visité ? Constituer mon dossier
              </Link>
            )}
          </Card>

          <Card className="flex items-center gap-3 p-4">
            <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600"><UserRound aria-hidden /></span>
            <div className="min-w-0">
              <p className="font-semibold">{l.owner.name}</p>
              <p className="text-sm text-muted">{ROLE_LABELS[l.owner.role]}{l.owner.agency_name && ` · ${l.owner.agency_name}`}</p>
              <p className="text-xs text-muted">Membre depuis {formatDate(l.owner.date_joined)}</p>
            </div>
          </Card>

          {l.is_verified && l.verification.disclaimer && (
            <Card className="p-4">
              <p className="flex items-center gap-2 font-semibold text-green-700"><ShieldCheck className="size-5" aria-hidden /> {l.verification.label}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{l.verification.disclaimer}</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
