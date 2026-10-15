import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Home, MapPin, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Calendar } from "../components/Calendar";
import { ListingCover } from "../components/ListingCard";
import { Stepper } from "../components/Stepper";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../components/ui/cn";
import { Textarea } from "../components/ui/Field";
import { EmptyState, ErrorState, InlineError, Skeleton } from "../components/ui/States";
import { ApiError, api } from "../lib/api";
import { dayKey, fcfa, formatDayLong, formatTime, priceSuffix } from "../lib/format";
import type { ListingDetail, Slot, Visit } from "../lib/types";

export const VISIT_STEPS = ["Demande", "Confirmation", "Visite", "Dossier"];

function periodOf(iso: string) {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Dakar", hour: "2-digit", hour12: false }).format(new Date(iso)));
  return hour < 12 ? "Matin" : hour < 17 ? "Après-midi" : "Soir";
}

export function ListingHeader({ listing }: { listing: Pick<ListingDetail, "title" | "district" | "city" | "price" | "transaction_type"> }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Home aria-hidden /></span>
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">{listing.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <MapPin className="size-4" aria-hidden /> {listing.district}, {listing.city} · {fcfa(listing.price)}{priceSuffix(listing.transaction_type)}
        </p>
      </div>
    </div>
  );
}

export default function VisitNewPage() {
  const [params] = useSearchParams();
  const listingId = params.get("logement");
  const qc = useQueryClient();
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const listing = useQuery({ queryKey: ["listing", listingId], queryFn: () => api<ListingDetail>(`/listings/${listingId}/`), enabled: !!listingId });
  const slots = useQuery({ queryKey: ["slots", listingId], queryFn: () => api<Slot[]>("/visits/slots/", { params: { listing: listingId } }), enabled: !!listingId });

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    (slots.data ?? []).forEach((s) => map.set(dayKey(s.starts_at), [...(map.get(dayKey(s.starts_at)) ?? []), s]));
    return map;
  }, [slots.data]);
  const activeDay = day ?? [...byDay.keys()].sort()[0] ?? null;
  const daySlots = activeDay ? byDay.get(activeDay) ?? [] : [];

  const book = useMutation({
    mutationFn: () => api<Visit>("/visits/", { body: { slot_id: slotId, message } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
    onError: (error) => {
      // Créneau pris entre-temps : on rafraîchit les disponibilités depuis le serveur.
      if (error instanceof ApiError && error.status === 409) {
        setSlotId(null);
        slots.refetch();
      }
    },
  });

  if (!listingId) return <div className="mx-auto max-w-xl px-4 py-12"><EmptyState title="Aucun logement sélectionné" action={<Link to="/recherche"><Button>Rechercher un logement</Button></Link>} /></div>;
  if (listing.isPending) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-6"><Skeleton className="h-36" /><Skeleton className="h-96" /></div>;
  if (listing.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={listing.error} /></div>;
  const l = listing.data;

  if (book.isSuccess) {
    const visit = book.data;
    return (
      <div className="mx-auto max-w-md px-4 pb-28 pt-8 text-center md:pb-10">
        <Card className="p-6">
          <span className="mx-auto grid size-28 place-items-center rounded-full bg-green-50"><CheckCircle2 className="size-16 text-green-500" aria-hidden /></span>
          <h1 className="mt-4 text-2xl font-extrabold">Demande envoyée !</h1>
          <p className="mt-2 text-muted">
            {formatDayLong(visit.slot.starts_at)} à {formatTime(visit.slot.starts_at)}. Le propriétaire ou l'agent doit confirmer : vous serez notifié et l'adresse exacte vous sera alors communiquée.
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl text-left">
            <div className="h-44"><ListingCover listing={visit.listing} /></div>
            <div className="bg-surface p-3">
              <p className="font-semibold">{visit.listing.title}</p>
              <p className="text-sm text-muted">{visit.listing.district}, {visit.listing.city}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link to="/"><Button variant="secondary" block>Retour à l'accueil</Button></Link>
            <Link to={`/visites/${visit.id}`}><Button block>Suivre ma visite</Button></Link>
          </div>
          {"share" in navigator && (
            <button type="button" onClick={() => navigator.share({ title: visit.listing.title, url: `${location.origin}/logements/${visit.listing.id}` }).catch(() => undefined)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
              <Share2 className="size-4" aria-hidden /> Partager le logement
            </button>
          )}
        </Card>
      </div>
    );
  }

  const groups = ["Matin", "Après-midi", "Soir"].map((p) => ({ period: p, items: daySlots.filter((s) => periodOf(s.starts_at) === p) })).filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <Card className="space-y-6 border-t-4 border-brand-600 p-5 sm:p-6">
        <ListingHeader listing={l} />
        <Stepper steps={VISIT_STEPS} current={0} />
      </Card>

      <Card className="space-y-5 border-t-4 border-brand-600 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CalendarDays aria-hidden /></span>
          <div>
            <h2 className="text-lg font-bold">Réserver une visite</h2>
            <p className="text-sm text-muted">Choisissez un créneau proposé par le propriétaire ou l'agent (heure de Dakar).</p>
          </div>
        </div>

        {slots.isPending ? (
          <Skeleton className="h-72" />
        ) : slots.isError ? (
          <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
        ) : byDay.size === 0 ? (
          <EmptyState title="Aucun créneau disponible" text="Le propriétaire n'a pas encore proposé de créneaux, ou ils sont tous réservés. Revenez plus tard." />
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Calendar available={new Set(byDay.keys())} selected={activeDay} onSelect={(d) => { setDay(d); setSlotId(null); }} />
            <div className="space-y-4">
              {activeDay && <p className="text-sm font-semibold text-muted">{formatDayLong(daySlots[0]?.starts_at ?? `${activeDay}T12:00:00Z`)}</p>}
              {groups.map((g) => (
                <fieldset key={g.period}>
                  <legend className="mb-2 font-semibold">{g.period}</legend>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={slotId === s.id}
                        onClick={() => setSlotId(s.id)}
                        className={cn("rounded-xl border px-4 py-2.5 text-sm font-semibold transition", slotId === s.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white hover:border-brand-400")}
                      >
                        {formatTime(s.starts_at)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}

        <Textarea label="Message au propriétaire (facultatif)" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Présentez-vous brièvement, précisez vos questions…" />
        <InlineError error={book.error} />
        <Button size="lg" block disabled={!slotId} loading={book.isPending} onClick={() => book.mutate()}>
          <CalendarDays className="size-5" aria-hidden /> Confirmer la réservation
        </Button>
      </Card>
    </div>
  );
}
