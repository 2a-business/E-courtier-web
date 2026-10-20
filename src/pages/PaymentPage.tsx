import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileSignature, FlaskConical, Lock, ReceiptText, Wallet } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ListingCover } from "../components/ListingCard";
import { StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Field";
import { ErrorState, InlineError, Notice, Skeleton } from "../components/ui/States";
import { api } from "../lib/api";
import { fcfa, formatDate } from "../lib/format";
import type { ListingDetail, Transaction } from "../lib/types";

interface PaymentConfig {
  wave_configured: boolean;
  simulation_enabled: boolean;
  dossier_fee: number;
  escrow_supported: boolean;
}

interface Quote {
  amount: number;
  amount_kind_label: string;
  fee_amount: number;
  total_amount: number;
  sale_deposit_percent: number | null;
}

const EVENT_LABELS: Record<string, string> = {
  created: "Dossier ouvert",
  payment_started: "Redirection vers Wave",
  payment_declared: "Paiement déclaré (à vérifier)",
  paid_confirmed: "Paiement vérifié et confirmé",
  paid_simulated: "Paiement simulé (démonstration)",
  cancelled: "Dossier annulé",
  failed: "Paiement échoué",
  refunded: "Remboursement enregistré",
};

function Breakdown({ amountLabel, amount, fee, total }: { amountLabel: string; amount: number; fee: number; total: number }) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-muted">{amountLabel}</dt><dd className="font-semibold">{fcfa(amount)}</dd></div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Frais de dossier E-Courtier <span className="block text-xs">(distincts du montant du logement)</span></dt>
        {/* Location : les frais sont réglés une seule fois, dans le dossier locatif. */}
        <dd className="font-semibold">{fee > 0 ? fcfa(fee) : "Réglés via le dossier locatif"}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-dashed border-line pt-3 text-base"><dt className="font-bold">Total à régler</dt><dd className="font-extrabold">{fcfa(total)}</dd></div>
    </dl>
  );
}

function StatusBanner({ tx }: { tx: Transaction }) {
  if (tx.status === "PAID" && tx.is_simulated) {
    return (
      <Notice tone="demo" icon={<FlaskConical className="size-5" aria-hidden />}>
        <strong>Paiement SIMULÉ</strong> le {formatDate(tx.paid_at, true)} — mode démonstration : aucun argent n'a circulé et ce dossier n'a aucune valeur réelle.
      </Notice>
    );
  }
  if (tx.status === "PAID") {
    return <Notice tone="success" icon={<CheckCircle2 className="size-5" aria-hidden />}><strong>Paiement confirmé</strong> le {formatDate(tx.paid_at, true)} après vérification par E-Courtier.</Notice>;
  }
  if (tx.status === "PENDING") {
    const declared = tx.attempts?.some((a) => a.status === "CUSTOMER_DECLARED");
    return (
      <Notice tone="warning" icon={<Clock className="size-5" aria-hidden />}>
        <strong>En attente — non payé.</strong>{" "}
        {declared ? "Vous avez déclaré un paiement : notre équipe le vérifie dans Wave Business avant confirmation." : "Aucun paiement n'a encore été reçu pour ce dossier."}
      </Notice>
    );
  }
  return <Notice tone="warning" icon={<AlertTriangle className="size-5" aria-hidden />}>Dossier {tx.status_label.toLowerCase()}.</Notice>;
}

function NewDossier({ listingId }: { listingId: string }) {
  const navigate = useNavigate();
  const key = useRef(crypto.randomUUID());
  const listing = useQuery({ queryKey: ["listing", listingId], queryFn: () => api<ListingDetail>(`/listings/${listingId}/`) });
  const quote = useQuery({ queryKey: ["quote", listingId], queryFn: () => api<Quote>("/transactions/quote/", { params: { listing: listingId } }) });
  const create = useMutation({
    mutationFn: () => api<Transaction>("/transactions/", { body: { listing: listingId }, headers: { "Idempotency-Key": key.current } }),
    onSuccess: (tx) => navigate(`/paiement/${tx.id}`, { replace: true }),
  });
  if (listing.isPending || quote.isPending) return <Skeleton className="h-96" />;
  if (listing.isError) return <ErrorState error={listing.error} />;
  if (quote.isError) return <ErrorState error={quote.error} />;
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl"><ListingCover listing={listing.data} /></div>
        <div>
          <p className="text-sm text-muted">Nouveau dossier</p>
          <h1 className="text-xl font-extrabold">{listing.data.title}</h1>
          <p className="text-sm text-muted">{listing.data.district}, {listing.data.city}</p>
        </div>
      </div>
      <Breakdown amountLabel={quote.data.amount_kind_label + (quote.data.sale_deposit_percent ? ` (${quote.data.sale_deposit_percent} % du prix)` : "")} amount={quote.data.amount} fee={quote.data.fee_amount} total={quote.data.total_amount} />
      <Notice tone="info">Un dossier ne peut être ouvert qu'après une visite confirmée. E-Courtier n'est pas un séquestre : les fonds ne sont ni bloqués ni libérés automatiquement.</Notice>
      <InlineError error={create.error} />
      <Button size="lg" block loading={create.isPending} onClick={() => create.mutate()}><ReceiptText className="size-5" aria-hidden /> Ouvrir mon dossier</Button>
    </Card>
  );
}

function Dossier({ id }: { id: string }) {
  const qc = useQueryClient();
  const [reference, setReference] = useState("");
  const [checkout, setCheckout] = useState<{ url: string; instructions: string } | null>(null);
  const tx = useQuery({ queryKey: ["transaction", id], queryFn: () => api<Transaction>(`/transactions/${id}/`), refetchInterval: (q) => (q.state.data?.status === "PENDING" ? 30_000 : false) });
  const config = useQuery({ queryKey: ["payment-config"], queryFn: () => api<PaymentConfig>("/transactions/config/") });
  const onUpdate = (data: Transaction) => qc.setQueryData(["transaction", id], data);

  const wave = useMutation({
    mutationFn: () => api<{ checkout: { url: string; instructions: string } }>(`/transactions/${id}/wave/`, { method: "POST" }),
    onSuccess: (data) => {
      setCheckout(data.checkout);
      window.open(data.checkout.url, "_blank", "noopener,noreferrer");
      tx.refetch();
    },
  });
  const declare = useMutation({ mutationFn: () => api<Transaction>(`/transactions/${id}/declare/`, { body: { provider_reference: reference } }), onSuccess: onUpdate });
  const simulate = useMutation({ mutationFn: () => api<Transaction>(`/transactions/${id}/simulate/`, { method: "POST" }), onSuccess: onUpdate });
  const cancel = useMutation({ mutationFn: () => api<Transaction>(`/transactions/${id}/cancel/`, { body: {} }), onSuccess: onUpdate });

  if (tx.isPending) return <Skeleton className="h-[32rem]" />;
  if (tx.isError) return <ErrorState error={tx.error} onRetry={() => tx.refetch()} />;
  const t = tx.data;
  const pending = t.status === "PENDING";
  // La déclaration n'est possible qu'après une redirection réelle vers Wave (le serveur refuse sinon : payment_not_started).
  const started = !!checkout || !!t.attempts?.some((a) => a.provider === "WAVE_LINK" && (a.status === "INITIATED" || a.status === "CUSTOMER_DECLARED"));

  function submitReference(e: FormEvent) {
    e.preventDefault();
    declare.mutate();
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Dossier <span className="font-mono font-semibold text-ink">{t.reference}</span></p>
            <h1 className="text-xl font-extrabold">{t.listing.title}</h1>
            <p className="text-sm text-muted">{t.listing.district}, {t.listing.city} · ouvert le {formatDate(t.created_at)}</p>
          </div>
          <StatusBadge status={t.status} label={t.is_simulated && t.status === "PAID" ? "Payée (simulation)" : t.status_label} />
        </div>
        <StatusBanner tx={t} />
        <Breakdown amountLabel={t.amount_kind_label} amount={t.amount} fee={t.fee_amount} total={t.total_amount} />
      </Card>

      {pending && (
        <Card className="overflow-hidden">
          <div className="bg-wave px-5 py-6 text-wave-ink sm:px-6">
            <p className="text-sm font-semibold opacity-80">wave digital finance</p>
            <h2 className="mt-1 text-2xl font-extrabold">Payez avec Wave</h2>
            <p className="mt-1 text-sm">Simple et sécurisé, depuis votre application Wave.</p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Cliquez sur « Payer avec Wave » : la page Wave Business s'ouvre.</li>
              <li>Saisissez exactement <strong>{fcfa(t.total_amount)}</strong> et, si possible, la référence <strong className="font-mono">{t.reference}</strong>.</li>
              <li>Confirmez dans votre application, puis revenez indiquer l'identifiant de transaction Wave ci-dessous.</li>
            </ol>
            <p className="flex items-center gap-2 text-xs text-muted"><Lock className="size-4" aria-hidden /> E-Courtier ne vous demandera jamais votre code secret ni vos identifiants Wave.</p>
            {config.data && !config.data.wave_configured ? (
              <Notice tone="warning">Le paiement Wave n'est pas configuré sur cet environnement (lien marchand absent).</Notice>
            ) : (
              <Button variant="wave" size="lg" block loading={wave.isPending} onClick={() => wave.mutate()}>
                <Wallet className="size-5" aria-hidden /> Payer avec Wave <ExternalLink className="size-4" aria-hidden />
              </Button>
            )}
            <InlineError error={wave.error} />
            {checkout && <Notice tone="info">{checkout.instructions} <a href={checkout.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Rouvrir Wave</a></Notice>}

            {started ? (
              <form onSubmit={submitReference} className="space-y-3 border-t border-line pt-4">
                <Input label="J'ai payé : identifiant de transaction Wave" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. T_8K2M4QXZ7Y" hint="Visible dans l'historique de votre application Wave. Votre dossier restera « en attente » jusqu'à vérification." pattern="[A-Za-z0-9_\-]{6,64}" />
                <InlineError error={declare.error} />
                <Button type="submit" variant="secondary" disabled={reference.trim().length < 6} loading={declare.isPending}>Déclarer mon paiement</Button>
              </form>
            ) : (
              <p className="border-t border-line pt-4 text-sm text-muted">Après avoir payé dans Wave, vous pourrez indiquer ici l'identifiant de transaction pour vérification.</p>
            )}

            {config.data?.simulation_enabled && (
              <div className="space-y-2 rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-orange-900"><FlaskConical className="size-4" aria-hidden /> Mode démonstration</p>
                <p className="text-sm text-orange-900">Simule un paiement réussi pour tester le parcours. Aucun argent ne circule ; le dossier et le contrat seront marqués « simulés ».</p>
                <InlineError error={simulate.error} />
                <Button variant="secondary" size="sm" loading={simulate.isPending} onClick={() => simulate.mutate()}>Simuler le paiement</Button>
              </div>
            )}

            <button type="button" onClick={() => window.confirm("Annuler ce dossier ?") && cancel.mutate()} className="text-sm font-semibold text-red-600 hover:underline">
              Annuler le dossier
            </button>
            <InlineError error={cancel.error} />
          </div>
        </Card>
      )}

      {t.contract && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600"><FileSignature className="size-5" aria-hidden /></span>
            <div>
              <p className="font-semibold">Contrat</p>
              <StatusBadge status={t.contract.status} label={t.contract.status_label} />
            </div>
          </div>
          <Link to={`/contrats/${t.contract.id}`}><Button variant="secondary">Suivre le contrat</Button></Link>
        </Card>
      )}

      {!!t.events?.length && (
        <Card className="p-5">
          <h2 className="mb-3 font-bold">Historique</h2>
          <ol className="space-y-3 border-l-2 border-brand-100 pl-4">
            {t.events.map((e, i) => (
              <li key={i}>
                <p className="text-sm font-semibold">{EVENT_LABELS[e.event] ?? e.event}</p>
                <p className="text-xs text-muted">{formatDate(e.created_at, true)}{e.note && ` — ${e.note}`}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

export default function PaymentPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const listingId = params.get("logement");
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-6 md:pb-10">
      {id ? <Dossier id={id} /> : listingId ? <NewDossier listingId={listingId} /> : <ErrorState error={new Error("Aucun dossier sélectionné")} />}
    </div>
  );
}
