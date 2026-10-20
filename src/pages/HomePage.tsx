import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CalendarCheck, MessageCircle, Search, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ListingCard } from "../components/ListingCard";
import { Button } from "../components/ui/Button";
import { Card, SectionTitle } from "../components/ui/Card";
import { cn } from "../components/ui/cn";
import { Select } from "../components/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { api } from "../lib/api";
import { PROPERTY_TYPES } from "../lib/format";
import type { ListingCard as Listing, Paginated } from "../lib/types";

interface Location {
  city: string;
  districts: { district: string; count: number }[];
}

function useListings(key: string, params: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: ["search", key, params],
    queryFn: () => api<Paginated<Listing>>("/search/listings/", { params }),
  });
}

function ListingGrid({ query, emptyText }: { query: ReturnType<typeof useListings>; emptyText: string }) {
  if (query.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.results.length) return <EmptyState title="Aucune annonce pour le moment" text={emptyText} />;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {query.data.results.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}

function QuickSearch() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"RENT" | "SALE">("RENT");
  const [place, setPlace] = useState("");
  const [type, setType] = useState("");
  const [budget, setBudget] = useState("");
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => api<Location[]>("/search/locations/") });
  const placeOptions = (locations.data ?? []).flatMap((loc) => [
    { value: `city:${loc.city}`, label: loc.city },
    ...loc.districts.map((d) => ({ value: `district:${d.district}`, label: `   ${d.district} (${d.count})` })),
  ]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ transaction_type: mode });
    if (place) {
      const [kind, value] = place.split(/:(.*)/s);
      params.set(kind, value);
    }
    if (type) params.set("property_type", type);
    if (budget) params.set("price_max", budget);
    navigate(`/recherche?${params}`);
  }

  const budgets = mode === "RENT"
    ? [100000, 200000, 300000, 500000, 1000000]
    : [25000000, 50000000, 100000000, 250000000];

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} aria-label="Recherche rapide" className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Type de transaction" className="grid grid-cols-2 rounded-2xl bg-surface p-1">
          {(["RENT", "SALE"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                setBudget("");
              }}
              className={cn("rounded-xl py-2.5 text-sm font-bold transition", mode === m ? "bg-white text-ink shadow-sm" : "text-muted")}
            >
              {m === "RENT" ? "Louer" : "Acheter"}
            </button>
          ))}
        </div>
        <Select label="Ville ou quartier" value={place} onChange={(e) => setPlace(e.target.value)} options={placeOptions} placeholder="Tout le Sénégal" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type de bien" value={type} onChange={(e) => setType(e.target.value)} options={PROPERTY_TYPES} placeholder="Tous" />
          <Select
            label="Budget max."
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            options={budgets.map((b) => ({ value: String(b), label: new Intl.NumberFormat("fr-FR").format(b) + " F" }))}
            placeholder="Sans limite"
          />
        </div>
        <Button type="submit" size="lg" block>
          <Search className="size-5" aria-hidden /> Rechercher
        </Button>
      </form>
    </Card>
  );
}

const CATEGORIES = [{ value: "", label: "Tous" }, ...PROPERTY_TYPES.slice(0, 5)];

// Pixel transparent servi à la largeur où un visuel n'est pas affiché : le navigateur ne télécharge pas l'image
// masquée (une <img> en display:none est sinon téléchargée quand même).
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Accueil mobile et tablette (< lg) : visuel promotionnel, qui porte déjà le titre, l'accroche et les atouts. */
function MobileHero() {
  return (
    <div className="lg:hidden">
      <h1 className="sr-only">Trouvez le logement de vos rêves au Sénégal.</h1>
      <picture>
        <source media="(min-width: 1024px)" srcSet={BLANK} />
        <source type="image/webp" srcSet="/accueil-mobile-640.webp 640w, /accueil-mobile-1024.webp 1024w" sizes="(max-width: 576px) 100vw, 576px" />
        <img
          src="/accueil-mobile-1024.jpg"
          width={1024}
          height={1536}
          alt="E-Courtier : louez ou achetez sans courir les quartiers — annonces vérifiées, visites planifiées, frais transparents. Une femme consulte l'application devant une résidence moderne."
          className="mx-auto block h-auto max-h-[85svh] w-full max-w-xl rounded-[2rem] bg-[#f5f6fd] object-contain shadow-sm"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
  );
}

export default function HomePage() {
  const featured = useListings("featured", { featured: true, page_size: 8 });
  const verified = useListings("verified", { verified: true, page_size: 4, ordering: "newest" });

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-12">
          <MobileHero />
          {/* Ordinateur : accroche textuelle et recherche rapide (sur mobile, la recherche reste dans l'onglet Recherche). */}
          <div className="hidden lg:block">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
              <BadgeCheck className="size-4" aria-hidden /> Annonces examinées · Visites planifiées · Frais transparents
            </p>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Trouvez le logement <span className="text-brand-600">de vos rêves</span> au Sénégal.
            </h1>
            <p className="mt-3 max-w-xl text-muted">
              Louez ou achetez sans courir les quartiers : comparez des annonces détaillées, réservez une visite et suivez votre dossier en ligne.
            </p>
            <div className="mt-6 max-w-xl">
              <QuickSearch />
            </div>
          </div>
          <div className="relative hidden lg:block">
            <picture>
              <source media="(max-width: 1023px)" srcSet={BLANK} />
              <source media="(max-width: 1024px)" srcSet="/hero-dakar-sm.jpg" />
              <img src="/hero-dakar.jpg" alt="Résidence moderne entourée de verdure à Dakar" className="h-[560px] w-full rounded-[2rem] object-cover shadow-xl" fetchPriority="high" />
            </picture>
            <Link
              to="/assistant"
              className="absolute -left-8 bottom-10 flex max-w-xs items-center gap-3 rounded-2xl bg-white p-4 shadow-xl transition hover:-translate-y-0.5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><Sparkles className="size-5" aria-hidden /></span>
              <span>
                <span className="block font-bold">Demandez à l'assistant</span>
                <span className="text-sm text-muted">« Un F3 à Fann Hock à moins de 300 000 FCFA »</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4">
        <Link to="/assistant" className="flex items-center gap-4 rounded-[var(--radius-card)] bg-gradient-to-r from-brand-700 to-brand-500 p-5 text-white shadow-lg lg:hidden">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/20"><MessageCircle aria-hidden /></span>
          <span className="flex-1">
            <span className="block font-bold">Assistant IA</span>
            <span className="text-sm text-white/85">Décrivez votre logement idéal en français, nous cherchons parmi les annonces réelles.</span>
          </span>
          <ArrowRight aria-hidden />
        </Link>

        <section aria-labelledby="cat-title">
          <h2 id="cat-title" className="sr-only">Catégories</h2>
          <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {CATEGORIES.map((c) => (
              <li key={c.value}>
                <Link
                  to={c.value ? `/recherche?property_type=${c.value}` : "/recherche"}
                  className="block whitespace-nowrap rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold hover:border-brand-400 hover:text-brand-700"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle title="Annonces à la une" subtitle="Sélectionnées par l'équipe E-Courtier" action={<Link to="/recherche" className="text-sm font-semibold text-brand-700">Tout voir</Link>} />
          <ListingGrid query={featured} emptyText="Les annonces mises en avant apparaîtront ici." />
        </section>

        <section>
          <SectionTitle
            title="Logements vérifiés"
            subtitle="Justificatifs examinés par notre équipe avant l'attribution du badge"
            action={<Link to="/recherche?verified=true" className="text-sm font-semibold text-brand-700">Tout voir</Link>}
          />
          <ListingGrid query={verified} emptyText="Aucune annonce n'a encore été vérifiée." />
        </section>

        <section aria-labelledby="how" className="grid gap-4 md:grid-cols-4">
          <h2 id="how" className="sr-only">Comment ça marche</h2>
          {[
            { icon: Search, title: "Cherchez", text: "Filtres précis, carte ou assistant en langage naturel." },
            { icon: CalendarCheck, title: "Visitez", text: "Réservez un créneau proposé par le propriétaire ou l'agent." },
            { icon: Wallet, title: "Payez en sécurité", text: "Via Wave, frais de dossier de 5 000 FCFA affichés à part." },
            { icon: ShieldAlert, title: "Signalez", text: "Une annonce douteuse ? Signalez-la, nous enquêtons." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-5">
              <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </section>
      </div>
    </>
  );
}
