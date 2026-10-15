import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSignature, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Checkbox, Input, Textarea } from "../components/ui/Field";
import { ErrorState, InlineError, Notice, Skeleton } from "../components/ui/States";
import { api, apiBlob } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Contract } from "../lib/types";

export default function ContractPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["contract", id], queryFn: () => api<Contract>(`/contracts/${id}/`) });
  const onUpdate = (c: Contract) => qc.setQueryData(["contract", id], c);
  const sign = useMutation({ mutationFn: (version: number) => api<Contract>(`/contracts/${id}/sign/`, { body: { version_number: version, consent } }), onSuccess: onUpdate });
  const send = useMutation({ mutationFn: () => api<Contract>(`/contracts/${id}/send/`, { method: "POST" }), onSuccess: onUpdate });
  const saveTerms = useMutation({ mutationFn: () => api<Contract>(`/contracts/${id}/terms/`, { body: { special_terms: terms ?? "" } }), onSuccess: (c) => { onUpdate(c); setTerms(null); } });
  const cancel = useMutation({ mutationFn: () => api<Contract>(`/contracts/${id}/cancel/`, { body: { reason } }), onSuccess: onUpdate });

  async function download(c: Contract) {
    const blob = await apiBlob(`/contracts/${c.id}/download/`);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `contrat-${c.reference}-v${c.current_version.number}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (query.isPending) return <div className="mx-auto max-w-3xl px-4 py-6"><Skeleton className="h-[30rem]" /></div>;
  if (query.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={query.error} /></div>;
  const c = query.data;
  const canEdit = c.my_role !== "CUSTOMER";
  const v = c.current_version;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Contrat · dossier <span className="font-mono">{c.reference}</span></p>
            <h1 className="text-xl font-extrabold">{c.listing_title}</h1>
          </div>
          <StatusBadge status={c.status} label={c.status_label} />
        </div>
        {c.is_simulated && <Notice tone="demo">Contrat issu d'un <strong>paiement simulé</strong> : document de démonstration sans valeur contractuelle.</Notice>}
        <Notice tone="warning" icon={<ShieldAlert className="size-5" aria-hidden />}>{c.legal_notice}</Notice>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => download(c)}><Download className="size-4" aria-hidden /> Télécharger (v{v.number})</Button>
          <Link to={`/paiement/${c.transaction_id}`}><Button variant="ghost" size="sm">Voir le dossier de paiement</Button></Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-2 font-bold">Version {v.number} — {formatDate(v.created_at, true)}</h2>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-surface p-4 font-sans text-sm leading-relaxed">{v.content}</pre>
        <p className="mt-2 break-all font-mono text-[11px] text-muted">Empreinte SHA-256 : {v.content_sha256}</p>
      </Card>

      {canEdit && c.status === "DRAFT" && (
        <Card className="space-y-3 p-5">
          <Textarea label="Clauses particulières" value={terms ?? c.special_terms} onChange={(e) => setTerms(e.target.value)} maxLength={3000} hint="Chaque modification crée une nouvelle version du document." />
          <InlineError error={saveTerms.error ?? send.error} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={terms === null} loading={saveTerms.isPending} onClick={() => saveTerms.mutate()}>Enregistrer une nouvelle version</Button>
            <Button loading={send.isPending} onClick={() => send.mutate()}>Envoyer pour signature</Button>
          </div>
        </Card>
      )}

      {c.status === "PENDING_SIGNATURE" && c.my_role !== "ADMIN" && !c.i_signed && (
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-bold"><FileSignature className="size-5 text-brand-600" aria-hidden /> Signer la version {v.number}</h2>
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label="J'ai lu le document et j'accepte de le signer électroniquement (signature simple, non qualifiée)." />
          <InlineError error={sign.error} />
          <Button disabled={!consent} loading={sign.isPending} onClick={() => sign.mutate(v.number)}>Signer</Button>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 font-bold">Signatures</h2>
        {c.signatures.length === 0 ? (
          <p className="text-sm text-muted">Aucune signature sur la version en cours.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {c.signatures.map((s) => (
              <li key={s.role} className="rounded-2xl bg-surface p-3">
                <strong>{s.signer_name}</strong> ({s.role === "CUSTOMER" ? "client" : "propriétaire / agent"}) — {formatDate(s.signed_at, true)}
                <span className="block break-all font-mono text-[11px] text-muted">Empreinte signée : {s.signed_sha256}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEdit && (c.status === "DRAFT" || c.status === "PENDING_SIGNATURE") && (
        <Card className="flex flex-wrap items-end gap-2 p-5">
          <Input label="Motif d'annulation" value={reason} onChange={(e) => setReason(e.target.value)} className="flex-1" />
          <Button variant="danger" disabled={!reason.trim()} loading={cancel.isPending} onClick={() => cancel.mutate()}>Annuler le contrat</Button>
          <div className="w-full"><InlineError error={cancel.error} /></div>
        </Card>
      )}
    </div>
  );
}
