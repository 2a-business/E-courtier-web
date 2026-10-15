import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { List, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import { ListingRow } from "../components/ListingCard";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../components/ui/cn";
import { Checkbox, Input, Select } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { Pagination } from "../components/ui/Tabs";
import { api } from "../lib/api";
import { PROPERTY_TYPES } from "../lib/format";
import type { Amenity, ListingCard, Paginated } from "../lib/types";

const ResultsMap = lazy(() => import("../components/MapView").then((m) => ({ default: m.ResultsMap })));
const PAGE_SIZE = 12;

const SORTS = [
  { value: "newest", label: "Plus récentes" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "surface_desc", label: "Plus grandes surfaces" },
];

const FILTER_KEYS = ["transaction_type", "property_type", "city", "district", "price_min", "price_max", "rooms_min", "bedrooms_min", "surface_min", "amenities", "furnished", "verified", "q"];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"list" | "map">("list");
  const [showMore, setShowMore] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const page = Number(params.get("page") ?? 1);

  const query = Object.fromEntries([...params.entries()].filter(([k]) => FILTER_KEYS.includes(k) || k === "ordering" || k === "page"));
  const results = useQuery({
    queryKey: ["search", "page", query],
    queryFn: () => api<Paginated<ListingCard>>("/search/listings/", { params: { ...query, page_size: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });
  const amenities = useQuery({ queryKey: ["amenities"], queryFn: () => api<Amenity[]>("/amenities/"), staleTime: Infinity });

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  }

  const selectedAmenities = (params.get("amenities") ?? "").split(",").filter(Boolean);
  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;
  const tt = params.get("transaction_type");
  const place = params.get("district") || params.get("city") || "au Sénégal";
  const heading = `${tt === "SALE" ? "Biens à vendre" : tt === "RENT" ? "Logements à louer" : "Logements"} ${place === "au Sénégal" ? place : `à ${place}`}`;

  return (
    <div className="pb-24 md:pb-0">
      <div className="z-20 border-b border-line bg-white/95 backdrop-blur md:sticky md:top-16">
        <form
          className="mx-auto flex max-w-7xl flex-wrap items-end gap-2 px-4 py-3"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Filtres de recherche"
        >
          <Input
            label="Quartier"
            hideLabel
            placeholder="Quartier (ex. Mermoz)"
            defaultValue={params.get("district") ?? ""}
            onBlur={(e) => update({ district: e.target.value.trim() || null })}
            onKeyDown={(e) => e.key === "Enter" && update({ district: (e.target as HTMLInputElement).value.trim() || null })}
            className="w-full sm:w-52"
          />
          <Select label="Transaction" hideLabel value={tt ?? ""} onChange={(e) => update({ transaction_type: e.target.value || null })} options={[{ value: "RENT", label: "Location" }, { value: "SALE", label: "Vente" }]} placeholder="Location ou vente" className="w-[calc(50%-4px)] sm:w-40" />
          <Select label="Type de bien" hideLabel value={params.get("property_type") ?? ""} onChange={(e) => update({ property_type: e.target.value || null })} options={PROPERTY_TYPES} placeholder="Tous types" className="w-[calc(50%-4px)] sm:w-40" />
          <Input label="Prix max (FCFA)" hideLabel type="number" inputMode="numeric" min={0} placeholder="Prix max (FCFA)" defaultValue={params.get("price_max") ?? ""} onBlur={(e) => update({ price_max: e.target.value || null })} className="w-[calc(50%-4px)] sm:w-44" />
          <Select label="Pièces" hideLabel value={params.get("rooms_min") ?? ""} onChange={(e) => update({ rooms_min: e.target.value || null })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+ pièces` }))} placeholder="Pièces" className="w-[calc(50%-4px)] sm:w-32" />
          <Button variant="secondary" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} aria-controls="more-filters">
            <SlidersHorizontal className="size-4" aria-hidden /> Plus de filtres {activeCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{activeCount}</span>}
          </Button>
          {activeCount > 0 && (
            <Button variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Effacer <X className="size-4" aria-hidden />
            </Button>
          )}
        </form>
        {showMore && (
          <div id="more-filters" className="mx-auto grid max-w-7xl gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Ville" defaultValue={params.get("city") ?? ""} onBlur={(e) => update({ city: e.target.value.trim() || null })} />
            <Input label="Prix min (FCFA)" type="number" min={0} defaultValue={params.get("price_min") ?? ""} onBlur={(e) => update({ price_min: e.target.value || null })} />
            <Input label="Surface min (m²)" type="number" min={0} defaultValue={params.get("surface_min") ?? ""} onBlur={(e) => update({ surface_min: e.target.value || null })} />
            <Select label="Chambres" value={params.get("bedrooms_min") ?? ""} onChange={(e) => update({ bedrooms_min: e.target.value || null })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}+` }))} placeholder="Indifférent" />
            <Select label="Ameublement" value={params.get("furnished") ?? ""} onChange={(e) => update({ furnished: e.target.value || null })} options={[{ value: "true", label: "Meublé" }, { value: "false", label: "Non meublé" }]} placeholder="Indifférent" />
            <div className="flex items-end pb-3">
              <Checkbox label="Annonces vérifiées uniquement" checked={params.get("verified") === "true"} onChange={(e) => update({ verified: e.target.checked ? "true" : null })} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold">Équipements (tous requis)</legend>
              <div className="flex flex-wrap gap-2">
                {(amenities.data ?? []).map((a) => {
                  const on = selectedAmenities.includes(a.slug);
                  return (
                    <button
                      key={a.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ amenities: (on ? selectedAmenities.filter((s) => s !== a.slug) : [...selectedAmenities, a.slug]).join(",") || null })}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white")}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={cn("lg:sticky lg:top-36 lg:block lg:h-[calc(100dvh-10rem)]", view === "map" ? "block h-[65vh]" : "hidden")}>
          <Card className="size-full overflow-hidden">
            <Suspense fallback={<div className="grid size-full place-items-center"><Spinner /></div>}>
              <ResultsMap listings={results.data?.results ?? []} activeId={hovered} />
            </Suspense>
          </Card>
          <p className="mt-2 text-xs text-muted">Positions approximatives (~100 m) pour protéger l'adresse exacte. Marqueurs : résultats de la page affichée.</p>
        </div>

        <section aria-labelledby="results-title" className={cn(view === "map" && "hidden lg:block")}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="results-title" className="text-2xl font-extrabold">{heading}</h1>
              <p className="text-sm text-muted" aria-live="polite">
                {results.data ? `${results.data.count} résultat${results.data.count > 1 ? "s" : ""}` : "Recherche…"}
                {results.isFetching && !results.isPending && " · mise à jour…"}
              </p>
            </div>
            <Select label="Trier par" value={params.get("ordering") ?? "newest"} onChange={(e) => update({ ordering: e.target.value })} options={SORTS} className="w-52" />
          </div>

          {results.isPending ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div>
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : results.data.results.length === 0 ? (
            <EmptyState
              title="Aucun logement ne correspond"
              text="Élargissez le budget, retirez un équipement ou essayez un quartier voisin. Vous pouvez aussi décrire votre besoin à l'assistant."
              action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>Effacer les filtres</Button>}
            />
          ) : (
            <>
              <div className="space-y-4">
                {results.data.results.map((l) => <ListingRow key={l.id} listing={l} active={hovered === l.id} onHover={setHovered} />)}
              </div>
              <Pagination page={page} count={results.data.count} pageSize={PAGE_SIZE} onPage={(p) => { update({ page: String(p) }); window.scrollTo({ top: 0 }); }} />
            </>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
        className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl lg:hidden"
      >
        {view === "list" ? <><MapIcon className="size-4" aria-hidden /> Carte</> : <><List className="size-4" aria-hidden /> Liste</>}
      </button>
    </div>
  );
}
