import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, Building2, FileText, Flag, ReceiptText, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DailyAreaChart, MeterList } from "../../components/Charts";
import { ListingCover } from "../../components/ListingCard";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle, StatCard } from "../../components/ui/Card";
import { Checkbox, Input, Select } from "../../components/ui/Field";
import { EmptyState, ErrorState, InlineError, Notice, Skeleton } from "../../components/ui/States";
import { Pagination, Tabs } from "../../components/ui/Tabs";
import { api } from "../../lib/api";
import { fcfa, fileSize, formatDate, ROLE_LABELS } from "../../lib/format";
import type { AdminFeePayment, OwnerListing, Paginated, Transaction, VerificationRequest } from "../../lib/types";
import { openPrivateDocument } from "../dashboard/ListingEditorPage";

type Tab = "apercu" | "verifications" | "annonces" | "signalements" | "paiements" | "frais" | "comptes" | "avis" | "journal";

function useList<T>(key: unknown[], path: string, params: Record<string, string | number | undefined> = {}) {
  return useQuery({ queryKey: ["admin", ...key, params], queryFn: () => api<Paginated<T>>(path, { params }) });
}

function Loading({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; refetch: () => void }; children: () => React.ReactNode }) {
  if (q.isPending) return <Skeleton className="h-72" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  return <>{children()}</>;
}

interface AdminStats {
  users_total: number;
  users_by_role: Record<string, number>;
  listings_published: number;
  listings_suspended: number;
  verifications_pending: number;
  reports_open: number;
  transactions_pending: number;
  transactions_to_check: number;
  transactions_paid: number;
  transactions_paid_simulated: number;
  fees_collected_real: number;
  listings_daily: { date: string; count: number }[];
  visits_daily: { date: string; count: number }[];
  verified_ratio: number | null;
}

function Overview() {
  const stats = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => api<AdminStats>("/admin/dashboard/") });
  const verif = useQuery({ queryKey: ["admin", "verif-stats"], queryFn: () => api<{ listings_by_status: Record<string, number>; documents_by_type: { label: string; count: number }[]; documents_total: number; recent_uploads: { id: number; doc_type_label: string; listing_title: string; uploaded_at: string }[] }>("/admin/verifications/stats/") });
  const usage = useQuery({ queryKey: ["admin", "assistant"], queryFn: () => api<{ llm_requests: number; llm_requests_limit: number; provider_calls: number; provider_calls_limit: number; tokens_in: number; tokens_out: number; provider: string; model: string; recent_errors: number; latency_p50_ms: number | null }>("/admin/assistant/usage/") });
  return (
    <Loading q={stats}>
      {() => {
        const s = stats.data!;
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard icon={<Users aria-hidden />} label="Comptes" value={s.users_total} />
              <StatCard icon={<Building2 aria-hidden />} label="Annonces publiées" value={s.listings_published} tone="blue" />
              <StatCard icon={<BadgeCheck aria-hidden />} label="Vérifications en attente" value={s.verifications_pending} tone="amber" />
              <StatCard icon={<Flag aria-hidden />} label="Signalements ouverts" value={s.reports_open} tone="red" />
              <StatCard icon={<ReceiptText aria-hidden />} label="Paiements à vérifier" value={s.transactions_to_check} tone="green" />
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-5">
                <SectionTitle title="Statut de vérification des annonces" subtitle={s.verified_ratio !== null ? `${Math.round(s.verified_ratio * 100)} % des annonces publiées sont vérifiées` : undefined} />
                {verif.data && (
                  <MeterList items={[
                    { label: "Vérifiées", value: verif.data.listings_by_status.APPROVED, tone: "#16a34a" },
                    { label: "En attente", value: verif.data.listings_by_status.PENDING, tone: "#d97706" },
                    { label: "Refusées", value: verif.data.listings_by_status.REJECTED, tone: "#dc2626" },
                    { label: "Non soumises", value: verif.data.listings_by_status.NOT_SUBMITTED, tone: "#9ca3af" },
                  ]} />
                )}
              </Card>
              <Card className="p-5">
                <SectionTitle title="Types de justificatifs" subtitle={verif.data ? `${verif.data.documents_total} document(s)` : undefined} />
                {verif.data && <MeterList items={verif.data.documents_by_type.filter((d) => d.count).map((d) => ({ label: d.label, value: d.count }))} />}
              </Card>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-5">
                <SectionTitle title="Demandes de visite" subtitle="30 derniers jours, toutes annonces" />
                <DailyAreaChart data={s.visits_daily} label="Demandes de visite par jour, 30 jours" />
              </Card>
              <Card className="p-5">
                <SectionTitle title="Dépôts récents" />
                <ul className="space-y-3 text-sm">
                  {(verif.data?.recent_uploads ?? []).map((u) => (
                    <li key={u.id} className="flex justify-between gap-2"><span><FileText className="mr-1 inline size-4 text-brand-600" aria-hidden />{u.doc_type_label} — <span className="text-muted">{u.listing_title}</span></span><time className="shrink-0 text-xs text-muted">{formatDate(u.uploaded_at)}</time></li>
                  ))}
                </ul>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-5"><p className="text-sm text-muted">Paiements confirmés (réels)</p><p className="text-2xl font-bold">{s.transactions_paid}</p><p className="text-xs text-muted">Frais de dossier encaissés : {fcfa(s.fees_collected_real)}</p></Card>
              <Card className="p-5"><p className="text-sm text-muted">Paiements simulés (démo)</p><p className="text-2xl font-bold text-orange-700">{s.transactions_paid_simulated}</p><p className="text-xs text-muted">Exclus des montants encaissés</p></Card>
              <Card className="p-5">
                <p className="text-sm text-muted">Assistant IA aujourd'hui</p>
                {usage.data ? (
                  <>
                    <p className="text-2xl font-bold">{usage.data.llm_requests} / {usage.data.llm_requests_limit}</p>
                    <p className="text-xs text-muted">Fournisseur : {usage.data.provider}{usage.data.model && ` (${usage.data.model})`} · appels {usage.data.provider_calls}/{usage.data.provider_calls_limit} · jetons {usage.data.tokens_in}+{usage.data.tokens_out} · erreurs récentes {usage.data.recent_errors}{usage.data.latency_p50_ms !== null && ` · latence médiane ${usage.data.latency_p50_ms} ms`}</p>
                  </>
                ) : <p className="text-sm">—</p>}
              </Card>
            </div>
          </div>
        );
      }}
    </Loading>
  );
}

function VerificationQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const q = useList<VerificationRequest>(["verifications"], "/admin/verifications/", { status });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => api(`/admin/verifications/${id}/decision/`, { body: { approve, reason: reasons[id] ?? "" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <div className="space-y-4">
      <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "PENDING", label: "En attente (plus anciennes d'abord)" }, { value: "APPROVED", label: "Approuvées" }, { value: "REJECTED", label: "Rejetées" }, { value: "ALL", label: "Toutes" }]} className="max-w-xs" />
      <Notice tone="warning" icon={<AlertTriangle className="size-5" aria-hidden />}>Vérifiez la cohérence entre l'identité, le justificatif du bien et l'annonce. Chaque consultation de document est journalisée. Le badge n'atteste pas l'authenticité officielle des pièces.</Notice>
      <InlineError error={decide.error} />
      <Loading q={q}>
        {() => q.data!.results.length === 0 ? <EmptyState title="File vide" text="Aucune demande dans ce statut." /> : (
          <ul className="space-y-4">
            {q.data!.results.map((r) => (
              <li key={r.id}>
                <Card className="grid gap-4 p-5 lg:grid-cols-[220px_1fr]">
                  <div className="h-36 overflow-hidden rounded-2xl">{r.listing && <ListingCover listing={r.listing} />}</div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/logements/${r.listing?.id}`} className="font-bold hover:text-brand-700">{r.listing?.title}</Link>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-muted">{r.listing?.district}, {r.listing?.city} · soumise le {formatDate(r.submitted_at, true)} par {r.submitted_by?.name} ({ROLE_LABELS[r.submitted_by?.role ?? "OWNER"]}, {r.submitted_by?.email})</p>
                    <ul className="flex flex-wrap gap-2">
                      {r.documents.map((d) => (
                        <li key={d.id}>
                          <button type="button" onClick={() => openPrivateDocument(d.id)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:border-brand-400">
                            <FileText className="size-4 text-brand-600" aria-hidden /> {d.doc_type_label} <span className="font-normal text-muted">{fileSize(d.size)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {r.status === "PENDING" ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <Input label="Motif (obligatoire en cas de rejet)" value={reasons[r.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })} className="min-w-60 flex-1" />
                        <Button loading={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>Approuver</Button>
                        <Button variant="danger" disabled={!reasons[r.id]?.trim()} loading={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}>Rejeter</Button>
                      </div>
                    ) : (
                      <p className="text-sm">Décision le {formatDate(r.decided_at, true)} par {r.decided_by_name}{r.decision_reason && ` — ${r.decision_reason}`}</p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Loading>
    </div>
  );
}

function ListingsModeration() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useList<OwnerListing>(["listings"], "/admin/listings/", { q: search || undefined, publication_status: status || undefined, page });
  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => {
      const reason = window.prompt(action === "suspend" ? "Motif de la suspension :" : "Motif du rétablissement :");
      if (!reason) return Promise.resolve(null);
      return api(`/admin/listings/${id}/moderation/`, { body: { action, reason } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const feature = useMutation({ mutationFn: ({ id, featured }: { id: string; featured: boolean }) => api(`/admin/listings/${id}/featured/`, { body: { featured } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input label="Rechercher" hideLabel placeholder="Titre ou quartier" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-64" />
        <Select label="Statut" hideLabel value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "PUBLISHED", label: "Publiées" }, { value: "DRAFT", label: "Brouillons" }, { value: "SUSPENDED", label: "Suspendues" }, { value: "ARCHIVED", label: "Archivées" }]} placeholder="Tous statuts" className="w-48" />
      </div>
      <InlineError error={moderate.error ?? feature.error} />
      <Loading q={q}>
        {() => (
          <Card className="overflow-x-auto p-2">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-muted"><th className="p-3">Annonce</th><th className="p-3">Statut</th><th className="p-3">Vérif.</th><th className="p-3">Signal.</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {q.data!.results.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="p-3"><Link to={`/logements/${l.id}`} className="font-semibold hover:text-brand-700">{l.title}</Link><p className="text-xs text-muted">{l.district} · {fcfa(l.price)}{l.is_demo && " · démo"}</p></td>
                    <td className="p-3"><StatusBadge status={l.publication_status} /></td>
                    <td className="p-3"><StatusBadge status={l.verification_status} /></td>
                    <td className="p-3">{l.reports_open || "—"}</td>
                    <td className="space-x-3 p-3">
                      {l.publication_status === "SUSPENDED"
                        ? <button type="button" className="font-semibold text-brand-700" onClick={() => moderate.mutate({ id: l.id, action: "restore" })}>Rétablir</button>
                        : <button type="button" className="font-semibold text-red-600" onClick={() => moderate.mutate({ id: l.id, action: "suspend" })}>Suspendre</button>}
                      {l.publication_status === "PUBLISHED" && (
                        <button type="button" className="font-semibold" onClick={() => feature.mutate({ id: l.id, featured: !l.is_featured })}>{l.is_featured ? "Retirer de la une" : "Mettre à la une"}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} count={q.data!.count} pageSize={12} onPage={setPage} />
          </Card>
        )}
      </Loading>
    </div>
  );
}

interface AdminReport { id: number; listing: string; listing_title: string; listing_status: string; reason_label: string; details: string; status: string; reporter_email: string; created_at: string; resolution_note: string }

function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [suspend, setSuspend] = useState<Record<number, boolean>>({});
  const q = useList<AdminReport>(["reports"], "/admin/reports/", { status: status || undefined });
  const handle = useMutation({
    mutationFn: ({ id, next }: { id: number; next: string }) => api(`/admin/reports/${id}/`, { body: { status: next, note: notes[id] ?? "", suspend_listing: !!suspend[id] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <div className="space-y-4">
      <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "OPEN", label: "Ouverts" }, { value: "IN_REVIEW", label: "En examen" }, { value: "RESOLVED", label: "Traités" }, { value: "DISMISSED", label: "Classés" }]} placeholder="Tous" className="max-w-xs" />
      <InlineError error={handle.error} />
      <Loading q={q}>
        {() => q.data!.results.length === 0 ? <EmptyState title="Aucun signalement" /> : (
          <ul className="space-y-3">
            {q.data!.results.map((r) => (
              <li key={r.id}>
                <Card className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{r.reason_label} — <Link to={`/logements/${r.listing}`} className="text-brand-700">{r.listing_title}</Link></p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-muted">Par {r.reporter_email} le {formatDate(r.created_at, true)} · annonce <StatusBadge status={r.listing_status} /></p>
                  {r.details && <p className="rounded-xl bg-surface p-3 text-sm">{r.details}</p>}
                  {(r.status === "OPEN" || r.status === "IN_REVIEW") ? (
                    <div className="space-y-2">
                      <Input label="Note de traitement" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                      <Checkbox label="Suspendre l'annonce (si traité)" checked={!!suspend[r.id]} onChange={(e) => setSuspend({ ...suspend, [r.id]: e.target.checked })} />
                      <div className="flex flex-wrap gap-2">
                        {r.status === "OPEN" && <Button size="sm" variant="secondary" onClick={() => handle.mutate({ id: r.id, next: "IN_REVIEW" })}>Prendre en charge</Button>}
                        <Button size="sm" onClick={() => handle.mutate({ id: r.id, next: "RESOLVED" })}>Traité</Button>
                        <Button size="sm" variant="ghost" onClick={() => handle.mutate({ id: r.id, next: "DISMISSED" })}>Classer sans suite</Button>
                      </div>
                    </div>
                  ) : r.resolution_note && <p className="text-sm">Note : {r.resolution_note}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Loading>
    </div>
  );
}

function Payments() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const q = useList<Transaction>(["transactions"], "/admin/transactions/", { status: status || undefined });
  const confirm = useMutation({ mutationFn: ({ id, reference }: { id: string; reference: string }) => api(`/admin/transactions/${id}/confirm/`, { body: { provider_reference: reference } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }) });
  const change = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => {
      const note = window.prompt("Motif :") ?? "";
      return note ? api(`/admin/transactions/${id}/status/`, { body: { status: next, note } }) : Promise.resolve(null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  return (
    <div className="space-y-4">
      <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "PENDING", label: "En attente" }, { value: "PAID", label: "Payées" }, { value: "CANCELLED", label: "Annulées" }, { value: "FAILED", label: "Échouées" }, { value: "REFUNDED", label: "Remboursées" }]} placeholder="Toutes" className="max-w-xs" />
      <Notice tone="info">Ne confirmez un paiement qu'après l'avoir retrouvé dans le tableau de bord Wave Business (montant exact et identifiant de transaction). Le retour du client depuis Wave ne prouve pas le paiement.</Notice>
      <InlineError error={confirm.error ?? change.error} />
      <Loading q={q}>
        {() => q.data!.results.length === 0 ? <EmptyState title="Aucun dossier" /> : (
          <ul className="space-y-3">
            {q.data!.results.map((t) => {
              const declared = t.attempts?.find((a) => a.status === "CUSTOMER_DECLARED");
              return (
                <li key={t.id}>
                  <Card className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold"><span className="font-mono">{t.reference}</span> — {t.listing.title}</p>
                      <StatusBadge status={t.status} label={t.is_simulated && t.status === "PAID" ? "Payée (simulation)" : t.status_label} />
                    </div>
                    <p className="text-sm text-muted">{t.customer_name} · {t.amount_kind_label} {fcfa(t.amount)} + frais {fcfa(t.fee_amount)} = <strong className="text-ink">{fcfa(t.total_amount)}</strong> · ouvert le {formatDate(t.created_at)}</p>
                    {declared && <p className="text-sm">Référence déclarée par le client : <span className="font-mono font-semibold">{declared.provider_reference}</span></p>}
                    {t.status === "PENDING" && (
                      <div className="flex flex-wrap items-end gap-2">
                        <Input label="Identifiant de transaction Wave vérifié" value={refs[t.id] ?? declared?.provider_reference ?? ""} onChange={(e) => setRefs({ ...refs, [t.id]: e.target.value })} className="min-w-60 flex-1" />
                        <Button disabled={!(refs[t.id] ?? declared?.provider_reference)} loading={confirm.isPending} onClick={() => confirm.mutate({ id: t.id, reference: refs[t.id] ?? declared?.provider_reference ?? "" })}>Confirmer le paiement</Button>
                        <Button variant="ghost" onClick={() => change.mutate({ id: t.id, next: "FAILED" })}>Marquer échoué</Button>
                      </div>
                    )}
                    {t.status === "PAID" && <Button size="sm" variant="secondary" onClick={() => change.mutate({ id: t.id, next: "REFUNDED" })}>Enregistrer un remboursement</Button>}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Loading>
    </div>
  );
}

/** Rapprochement manuel des frais de dossier : confirmés seulement après vérification dans Wave Business. */
function DossierFees() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("AWAITING_VERIFICATION");
  const [refs, setRefs] = useState<Record<number, string>>({});
  const q = useList<AdminFeePayment>(["application-fees"], "/admin/application-fees/", { status: status || undefined });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "application-fees"] });
  const confirm = useMutation({ mutationFn: ({ id, reference }: { id: number; reference: string }) => api(`/admin/application-fees/${id}/confirm/`, { body: { provider_reference: reference } }), onSuccess: done });
  const reject = useMutation({
    mutationFn: (id: number) => {
      const reason = window.prompt("Motif (visible par le client) :") ?? "";
      return reason.trim() ? api(`/admin/application-fees/${id}/reject/`, { body: { reason } }) : Promise.resolve(null);
    },
    onSuccess: done,
  });
  return (
    <div className="space-y-4">
      <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "AWAITING_VERIFICATION", label: "À vérifier" }, { value: "PENDING", label: "À payer" }, { value: "CONFIRMED", label: "Confirmés" }, { value: "FAILED", label: "Non retrouvés" }, { value: "CANCELLED", label: "Annulés" }]} placeholder="Tous" className="max-w-xs" />
      <Notice tone="info">Confirmez uniquement après avoir retrouvé, dans Wave Business, un paiement du montant exact avec l'identifiant déclaré. Ni le clic, ni le retour du client, ni sa déclaration ne prouvent le paiement.</Notice>
      <InlineError error={confirm.error ?? reject.error} />
      <Loading q={q}>
        {() => q.data!.results.length === 0 ? <EmptyState title="Aucun frais dans ce statut" /> : (
          <ul className="space-y-3">
            {q.data!.results.map((f) => (
              <li key={f.id}>
                <Card className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold"><span className="font-mono">{f.reference}</span> — {f.listing_title}</p>
                    <StatusBadge status={f.status === "AWAITING_VERIFICATION" ? "PENDING" : f.status === "CONFIRMED" ? "PAID" : f.status} label={f.status_label} />
                  </div>
                  <p className="text-sm text-muted">{f.customer_name} · <strong className="text-ink">{fcfa(f.amount)}</strong>{f.declared_at && ` · déclaré le ${formatDate(f.declared_at, true)}`}</p>
                  {f.provider_reference && <p className="text-sm">Référence Wave déclarée : <span className="font-mono font-semibold">{f.provider_reference}</span></p>}
                  {["AWAITING_VERIFICATION", "PENDING", "FAILED"].includes(f.status) && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Input label="Identifiant de transaction Wave vérifié" value={refs[f.id] ?? f.provider_reference} onChange={(e) => setRefs({ ...refs, [f.id]: e.target.value })} className="min-w-60 flex-1" />
                      <Button disabled={!(refs[f.id] ?? f.provider_reference)} loading={confirm.isPending} onClick={() => confirm.mutate({ id: f.id, reference: refs[f.id] ?? f.provider_reference })}>Confirmer les frais</Button>
                      {f.status === "AWAITING_VERIFICATION" && <Button variant="ghost" onClick={() => reject.mutate(f.id)}>Paiement non retrouvé</Button>}
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Loading>
    </div>
  );
}

interface AdminUser { id: number; email: string; first_name: string; last_name: string; phone: string; role: string; is_active: boolean; date_joined: string; last_login: string | null }

function Accounts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useList<AdminUser>(["users"], "/admin/users/", { q: search || undefined, page });
  const role = useMutation({ mutationFn: ({ id, value }: { id: number; value: string }) => api(`/admin/users/${id}/role/`, { body: { role: value } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }) });
  const active = useMutation({ mutationFn: ({ id, value }: { id: number; value: boolean }) => api(`/admin/users/${id}/active/`, { body: { is_active: value, reason: value ? "" : window.prompt("Motif de la désactivation :") ?? "" } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }) });
  return (
    <div className="space-y-4">
      <Input label="Rechercher" hideLabel placeholder="E-mail ou nom" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-72" />
      <InlineError error={role.error ?? active.error} />
      <Loading q={q}>
        {() => (
          <Card className="overflow-x-auto p-2">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-muted"><th className="p-3">Compte</th><th className="p-3">Rôle</th><th className="p-3">Inscription</th><th className="p-3">État</th></tr></thead>
              <tbody>
                {q.data!.results.map((u) => (
                  <tr key={u.id} className="border-t border-line">
                    <td className="p-3"><p className="font-semibold">{u.first_name} {u.last_name}</p><p className="text-xs text-muted">{u.email}</p></td>
                    <td className="p-3">
                      <label className="sr-only" htmlFor={`role-${u.id}`}>Rôle de {u.email}</label>
                      <select id={`role-${u.id}`} value={u.role} onChange={(e) => window.confirm(`Passer ${u.email} en ${ROLE_LABELS[e.target.value]} ?`) && role.mutate({ id: u.id, value: e.target.value })} className="rounded-xl border border-line bg-white px-2 py-1.5">
                        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-muted">{formatDate(u.date_joined)}</td>
                    <td className="p-3">
                      <button type="button" className={u.is_active ? "font-semibold text-red-600" : "font-semibold text-brand-700"} onClick={() => active.mutate({ id: u.id, value: !u.is_active })}>
                        {u.is_active ? "Désactiver" : "Réactiver"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} count={q.data!.count} pageSize={12} onPage={setPage} />
          </Card>
        )}
      </Loading>
    </div>
  );
}

function ReviewsModeration() {
  const qc = useQueryClient();
  const q = useList<{ id: number; rating: number; comment: string; author_name: string; listing_title: string; status: string; created_at: string }>(["reviews"], "/admin/reviews/");
  const mod = useMutation({
    mutationFn: ({ id, hide }: { id: number; hide: boolean }) => {
      const note = window.prompt("Motif :");
      return note ? api(`/admin/reviews/${id}/moderation/`, { body: { hide, note } }) : Promise.resolve(null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  });
  return (
    <Loading q={q}>
      {() => q.data!.results.length === 0 ? <EmptyState title="Aucun avis" /> : (
        <ul className="space-y-2">
          {q.data!.results.map((r) => (
            <li key={r.id}><Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-semibold">{r.listing_title} · {r.rating}/5 · {r.author_name}</p><p className="text-sm text-muted">{r.comment || "(sans commentaire)"}</p></div>
              <div className="flex items-center gap-3"><StatusBadge status={r.status === "HIDDEN" ? "SUSPENDED" : "PUBLISHED"} label={r.status === "HIDDEN" ? "Masqué" : "Publié"} />
                <Button size="sm" variant="secondary" onClick={() => mod.mutate({ id: r.id, hide: r.status !== "HIDDEN" })}>{r.status === "HIDDEN" ? "Rétablir" : "Masquer"}</Button></div>
            </Card></li>
          ))}
        </ul>
      )}
    </Loading>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const q = useList<{ id: number; actor_email: string; action: string; target_type: string; target_id: string; metadata: Record<string, unknown>; created_at: string }>(["audit"], "/admin/audit-log/", { page });
  return (
    <Loading q={q}>
      {() => (
        <Card className="overflow-x-auto p-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-left text-muted"><th className="p-3">Date</th><th className="p-3">Acteur</th><th className="p-3">Action</th><th className="p-3">Cible</th><th className="p-3">Détails</th></tr></thead>
            <tbody>
              {q.data!.results.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap p-3 text-muted">{formatDate(e.created_at, true)}</td>
                  <td className="p-3">{e.actor_email}</td>
                  <td className="p-3 font-mono text-xs">{e.action}</td>
                  <td className="p-3 font-mono text-xs">{e.target_type}#{e.target_id.slice(0, 8)}</td>
                  <td className="p-3 text-xs text-muted">{Object.entries(e.metadata).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} count={q.data!.count} pageSize={12} onPage={setPage} />
        </Card>
      )}
    </Loading>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: "apercu", label: "Tableau de bord" },
  { value: "verifications", label: "Vérifications" },
  { value: "annonces", label: "Annonces" },
  { value: "signalements", label: "Signalements" },
  { value: "paiements", label: "Paiements" },
  { value: "frais", label: "Frais de dossier" },
  { value: "comptes", label: "Comptes" },
  { value: "avis", label: "Avis" },
  { value: "journal", label: "Journal" },
];

export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get("onglet"))?.value ?? "apercu") as Tab;
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Administration</h1>
        <p className="text-muted">Vérifications, modération et suivi des paiements. Toutes les actions sont contrôlées par le serveur et journalisées.</p>
      </div>
      <Tabs label="Sections d'administration" value={tab} onChange={(v) => setParams({ onglet: v })} items={TABS} />
      {tab === "apercu" && <Overview />}
      {tab === "verifications" && <VerificationQueue />}
      {tab === "annonces" && <ListingsModeration />}
      {tab === "signalements" && <Reports />}
      {tab === "paiements" && <Payments />}
      {tab === "frais" && <DossierFees />}
      {tab === "comptes" && <Accounts />}
      {tab === "avis" && <ReviewsModeration />}
      {tab === "journal" && <AuditLog />}
    </div>
  );
}
