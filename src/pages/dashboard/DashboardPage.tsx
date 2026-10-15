import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, CalendarClock, CheckCircle2, ClipboardList, FileSignature, LayoutDashboard, MessageSquareText, Plus, ReceiptText, Star,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { DailyAreaChart } from "../../components/Charts";
import { ListingCover } from "../../components/ListingCard";
import { Stars } from "../../components/Reviews";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle, StatCard } from "../../components/ui/Card";
import { cn } from "../../components/ui/cn";
import { EmptyState, ErrorState, InlineError, Skeleton } from "../../components/ui/States";
import { Pagination } from "../../components/ui/Tabs";
import { api } from "../../lib/api";
import { fcfa, formatDate, formatDayLong, formatTime } from "../../lib/format";
import type { Contract, OwnerListing, Paginated, Transaction, Visit } from "../../lib/types";

type Tab = "apercu" | "annonces" | "visites" | "dossiers" | "contrats" | "avis";

interface OwnerStats {
  listings_total: number;
  listings_by_status: Record<string, number>;
  listings_by_verification: Record<string, number>;
  visits_pending: number;
  visits_upcoming: number;
  visits_completed: number;
  transactions_pending: number;
  transactions_paid: number;
  transactions_paid_simulated: number;
  reviews_count: number;
  reviews_average: number | null;
  visit_requests_daily: { date: string; count: number }[];
}

function MyListings() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const query = useQuery({ queryKey: ["my-listings", page], queryFn: () => api<Paginated<OwnerListing>>("/listings/mine/", { params: { page, page_size: 8 } }) });
  const publication = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/listings/${id}/publication/`, { body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-listings"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/listings/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-listings"] }),
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data.count) {
    return <EmptyState title="Aucune annonce" text="Publiez votre premier bien : ajoutez des photos, proposez des créneaux et faites vérifier vos justificatifs." action={<Link to="/tableau-de-bord/annonces/nouvelle"><Button><Plus className="size-4" aria-hidden /> Nouvelle annonce</Button></Link>} />;
  }
  return (
    <Card className="p-4 sm:p-5">
      <p className="mb-3 text-sm"><strong className="text-brand-700">{query.data.count}</strong> annonce(s)</p>
      <InlineError error={publication.error ?? remove.error} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-ink text-left text-white">
              <th className="rounded-l-xl px-3 py-2.5 font-semibold">Annonce</th>
              <th className="px-3 py-2.5 font-semibold">Statut</th>
              <th className="px-3 py-2.5 font-semibold">Vérification</th>
              <th className="rounded-r-xl px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.data.results.map((l) => (
              <tr key={l.id} className="border-b border-line align-top last:border-0">
                <td className="px-3 py-3">
                  <div className="flex gap-3">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl"><ListingCover listing={l} /></div>
                    <div>
                      <Link to={`/logements/${l.id}`} className="font-semibold hover:text-brand-700">{l.title}</Link>
                      <p className="text-xs text-muted">Créée le {formatDate(l.created_at)}</p>
                      <p className="font-semibold text-brand-700">{fcfa(l.price)}</p>
                      {(l.visits_pending > 0 || l.reports_open > 0) && (
                        <p className="text-xs">
                          {l.visits_pending > 0 && <span className="text-amber-700">{l.visits_pending} visite(s) à confirmer </span>}
                          {l.reports_open > 0 && <span className="text-red-600">· {l.reports_open} signalement(s)</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><StatusBadge status={l.publication_status} /></td>
                <td className="px-3 py-3"><StatusBadge status={l.verification_status} /></td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <Link to={`/tableau-de-bord/annonces/${l.id}`} className="font-semibold text-brand-700">Modifier</Link>
                    {l.publication_status === "DRAFT" && <button type="button" className="font-semibold" onClick={() => publication.mutate({ id: l.id, status: "PUBLISHED" })}>Publier</button>}
                    {l.publication_status === "PUBLISHED" && <button type="button" className="font-semibold" onClick={() => publication.mutate({ id: l.id, status: "ARCHIVED" })}>Archiver</button>}
                    {l.publication_status === "ARCHIVED" && <button type="button" className="font-semibold" onClick={() => publication.mutate({ id: l.id, status: "DRAFT" })}>Remettre en brouillon</button>}
                    {l.publication_status === "DRAFT" && (
                      <button type="button" className="font-semibold text-red-600" onClick={() => window.confirm(`Supprimer « ${l.title} » ?`) && remove.mutate(l.id)}>Supprimer</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} count={query.data.count} pageSize={8} onPage={(p) => setParams({ onglet: "annonces", page: String(p) })} />
    </Card>
  );
}

export function VisitList({ role }: { role: "host" | "customer" }) {
  const query = useQuery({ queryKey: ["visits", role], queryFn: () => api<Visit[]>("/visits/", { params: { role } }) });
  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError) return <ErrorState error={query.error} />;
  const visits = query.data;
  if (!visits.length) return <EmptyState title="Aucune visite" text={role === "host" ? "Les demandes de visite de vos annonces apparaîtront ici." : "Planifiez une visite depuis la fiche d'un logement."} />;
  const upcoming = visits.filter((v) => ["PENDING", "CONFIRMED"].includes(v.status));
  const past = visits.filter((v) => !["PENDING", "CONFIRMED"].includes(v.status));
  const Item = ({ v }: { v: Visit }) => (
    <li>
      <Link to={`/visites/${v.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 hover:border-brand-400">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-center text-brand-700">
          <span className="text-[11px] font-semibold uppercase leading-none">{new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "Africa/Dakar" }).format(new Date(v.slot.starts_at))}</span>
          <span className="text-lg font-extrabold leading-none">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "Africa/Dakar" }).format(new Date(v.slot.starts_at))}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{v.listing.title}</p>
          <p className="text-sm text-muted">{formatDayLong(v.slot.starts_at)} à {formatTime(v.slot.starts_at)} · {role === "host" ? v.customer_name : v.host_name}</p>
        </div>
        <StatusBadge status={v.status} label={v.status_label} />
      </Link>
    </li>
  );
  return (
    <div className="space-y-6">
      <section><SectionTitle title="À venir" /><ul className="space-y-2">{upcoming.length ? upcoming.map((v) => <Item key={v.id} v={v} />) : <p className="text-sm text-muted">Aucune visite à venir.</p>}</ul></section>
      {past.length > 0 && <section><SectionTitle title="Historique" /><ul className="space-y-2">{past.map((v) => <Item key={v.id} v={v} />)}</ul></section>}
    </div>
  );
}

export function TransactionList({ role }: { role: "owner" | "customer" }) {
  const query = useQuery({ queryKey: ["transactions", role], queryFn: () => api<Transaction[]>("/transactions/", { params: { role } }) });
  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError) return <ErrorState error={query.error} />;
  if (!query.data.length) return <EmptyState title="Aucun dossier" text={role === "owner" ? "Les dossiers ouverts par vos clients apparaîtront ici." : "Après une visite confirmée, constituez votre dossier depuis la fiche de visite."} />;
  return (
    <ul className="space-y-2">
      {query.data.map((t) => (
        <li key={t.id}>
          <Link to={`/paiement/${t.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3 hover:border-brand-400">
            <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600"><ReceiptText className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{t.listing.title}</p>
              <p className="text-sm text-muted"><span className="font-mono">{t.reference}</span> · {fcfa(t.total_amount)}{role === "owner" && ` · ${t.customer_name}`}</p>
            </div>
            <StatusBadge status={t.status} label={t.is_simulated && t.status === "PAID" ? "Payée (simulation)" : t.status_label} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ContractList() {
  const query = useQuery({ queryKey: ["contracts"], queryFn: () => api<Contract[]>("/contracts/") });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError) return <ErrorState error={query.error} />;
  if (!query.data.length) return <EmptyState title="Aucun contrat" text="Un contrat est préparé automatiquement après la confirmation d'un paiement." />;
  return (
    <ul className="space-y-2">
      {query.data.map((c) => (
        <li key={c.id}>
          <Link to={`/contrats/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 hover:border-brand-400">
            <FileSignature className="size-5 text-brand-600" aria-hidden />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.listing_title}</p><p className="font-mono text-xs text-muted">{c.reference}</p></div>
            {c.is_simulated && <span className="text-xs font-semibold text-orange-700">Simulation</span>}
            <StatusBadge status={c.status} label={c.status_label} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReceivedReviews() {
  const query = useQuery({ queryKey: ["reviews-received"], queryFn: () => api<Paginated<{ id: number; rating: number; comment: string; author_name: string; listing_title: string; created_at: string }>>("/reviews/received/") });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError) return <ErrorState error={query.error} />;
  if (!query.data.count) return <EmptyState title="Pas encore d'avis" />;
  return (
    <ul className="space-y-3">
      {query.data.results.map((r) => (
        <li key={r.id} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex justify-between gap-2"><p className="font-semibold">{r.author_name}</p><Stars value={r.rating} /></div>
          <p className="text-xs text-muted">{r.listing_title} · {formatDate(r.created_at)}</p>
          {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
        </li>
      ))}
    </ul>
  );
}

function Overview() {
  const stats = useQuery({ queryKey: ["owner-stats"], queryFn: () => api<OwnerStats>("/listings/mine/stats/") });
  if (stats.isPending) return <Skeleton className="h-96" />;
  if (stats.isError) return <ErrorState error={stats.error} />;
  const s = stats.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Building2 aria-hidden />} label="Mes annonces" value={<>{s.listings_by_status.PUBLISHED ?? 0}<span className="text-sm font-medium text-muted"> / {s.listings_total} publiées</span></>} />
        <StatCard icon={<CalendarClock aria-hidden />} label="Visites à confirmer" value={s.visits_pending} tone="amber" />
        <StatCard icon={<CheckCircle2 aria-hidden />} label="Annonces vérifiées" value={s.listings_by_verification.APPROVED ?? 0} tone="green" />
        <StatCard icon={<Star aria-hidden />} label="Avis reçus" value={<>{s.reviews_count}{s.reviews_average && <span className="text-sm font-medium text-muted"> · {s.reviews_average}/5</span>}</>} tone="blue" />
      </div>
      <Card className="p-5">
        <SectionTitle title="Demandes de visite" subtitle="30 derniers jours" />
        <DailyAreaChart data={s.visit_requests_daily} label="Demandes de visite par jour sur 30 jours" />
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-muted">Visites à venir (confirmées)</p><p className="text-2xl font-bold">{s.visits_upcoming}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted">Dossiers en attente de paiement</p><p className="text-2xl font-bold">{s.transactions_pending}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted">Dossiers payés</p><p className="text-2xl font-bold">{s.transactions_paid}{s.transactions_paid_simulated > 0 && <span className="text-sm font-medium text-orange-700"> + {s.transactions_paid_simulated} simulé(s)</span>}</p></Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const manager = user!.role === "OWNER" || user!.role === "AGENT";
  const tabs: { value: Tab; label: string; icon: typeof Star }[] = manager
    ? [
        { value: "apercu", label: "Tableau de bord", icon: LayoutDashboard },
        { value: "annonces", label: "Mes annonces", icon: Building2 },
        { value: "visites", label: "Visites", icon: CalendarClock },
        { value: "dossiers", label: "Dossiers reçus", icon: ClipboardList },
        { value: "contrats", label: "Contrats", icon: FileSignature },
        { value: "avis", label: "Avis", icon: MessageSquareText },
      ]
    : [
        { value: "visites", label: "Mes visites", icon: CalendarClock },
        { value: "dossiers", label: "Mes dossiers", icon: ReceiptText },
        { value: "contrats", label: "Mes contrats", icon: FileSignature },
      ];
  const tab = (tabs.find((t) => t.value === params.get("onglet"))?.value ?? tabs[0].value) as Tab;

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-28 pt-6 md:pb-10">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-20 rounded-[var(--radius-card)] bg-ink p-4 text-white">
          <p className="px-2 text-xs uppercase tracking-wide text-white/50">Compte</p>
          <p className="truncate px-2 font-semibold">{user!.full_name}</p>
          <p className="truncate px-2 text-xs text-white/60">{user!.email}</p>
          <p className="mt-5 px-2 text-xs uppercase tracking-wide text-white/50">Menu</p>
          <nav aria-label="Menu du tableau de bord" className="mt-2 space-y-1">
            {tabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-current={tab === value ? "page" : undefined}
                onClick={() => setParams({ onglet: value })}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", tab === value ? "bg-brand-600 font-semibold" : "text-white/75 hover:bg-white/10")}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{tabs.find((t) => t.value === tab)?.label}</h1>
          {manager && <Link to="/tableau-de-bord/annonces/nouvelle"><Button><Plus className="size-4" aria-hidden /> Nouvelle annonce</Button></Link>}
        </div>
        <div className="flex gap-1 overflow-x-auto lg:hidden" role="tablist" aria-label="Sections">
          {tabs.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setParams({ onglet: t.value })} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", tab === t.value ? "bg-brand-600 text-white" : "bg-white text-muted")}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "apercu" && <Overview />}
        {tab === "annonces" && <MyListings />}
        {tab === "visites" && <VisitList role={manager ? "host" : "customer"} />}
        {tab === "dossiers" && <TransactionList role={manager ? "owner" : "customer"} />}
        {tab === "contrats" && <ContractList />}
        {tab === "avis" && <ReceivedReviews />}
        {manager && tab === "visites" && (
          <section className="pt-4"><SectionTitle title="Mes propres demandes de visite" /><VisitList role="customer" /></section>
        )}
      </div>
    </div>
  );
}
