import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Stepper } from "../components/Stepper";
import { StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Field";
import { ErrorState, InlineError, Notice, Skeleton } from "../components/ui/States";
import { api } from "../lib/api";
import { formatDate, formatDayLong, formatTime } from "../lib/format";
import type { RentalApplication, Visit } from "../lib/types";
import { ListingHeader, VISIT_STEPS } from "./VisitNewPage";

function stepOf(v: Visit) {
  if (v.status === "PENDING") return 1;
  if (v.status === "CONFIRMED") return 2;
  if (v.status === "COMPLETED") return 3;
  return 0;
}

export default function VisitDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["visits", id], queryFn: () => api<Visit>(`/visits/${id}/`) });
  const navigate = useNavigate();
  // Ouvre (ou retrouve) le dossier locatif lié à cette visite ; la règle « visite confirmée » est vérifiée par le serveur.
  const openApplication = useMutation({
    mutationFn: () => api<RentalApplication>("/applications/", { body: { visit: Number(id) } }),
    onSuccess: (app) => navigate(`/dossiers/${app.id}`),
  });
  const action = useMutation({
    mutationFn: (status: string) => api<Visit>(`/visits/${id}/status/`, { body: { status, reason } }),
    onSuccess: (data) => {
      qc.setQueryData(["visits", id], data);
      qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });

  if (query.isPending) return <div className="mx-auto max-w-3xl px-4 py-6"><Skeleton className="h-96" /></div>;
  if (query.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={query.error} /></div>;
  const v = query.data;
  const host = v.my_role === "host";
  const started = new Date(v.slot.starts_at) <= new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <Card className="space-y-6 border-t-4 border-brand-600 p-5 sm:p-6">
        <ListingHeader listing={{ ...v.listing }} />
        {v.status === "CANCELLED" ? <Notice tone="warning">Visite annulée le {formatDate(v.cancelled_at, true)}{v.cancel_reason && ` — ${v.cancel_reason}`}.</Notice> : <Stepper steps={VISIT_STEPS} current={stepOf(v)} />}
      </Card>

      {v.status === "CONFIRMED" && !host && (
        <Notice tone="success" icon={<CheckCircle2 className="size-5" aria-hidden />}>Votre visite est confirmée. Présentez-vous à l'heure ; ne versez aucune somme sur place avant d'avoir vu le logement.</Notice>
      )}

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Détails du rendez-vous</h2>
          <StatusBadge status={v.status} label={v.status_label} />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3"><CalendarDays className="size-5 text-brand-600" aria-hidden /><div><dt className="text-xs text-muted">Date</dt><dd className="font-semibold">{formatDayLong(v.slot.starts_at)}, {formatTime(v.slot.starts_at)} – {formatTime(v.slot.ends_at)}</dd></div></div>
          <div className="flex gap-3"><MapPin className="size-5 text-brand-600" aria-hidden /><div><dt className="text-xs text-muted">Adresse</dt><dd className="font-semibold">{v.address ?? "Communiquée après confirmation"}</dd></div></div>
          <div><dt className="text-xs text-muted">{host ? "Client" : "Propriétaire / agent"}</dt><dd className="font-semibold">{host ? v.customer_name : v.host_name}</dd></div>
          {v.contact_phone && <div className="flex gap-3"><Phone className="size-5 text-brand-600" aria-hidden /><div><dt className="text-xs text-muted">Téléphone</dt><dd><a href={`tel:${v.contact_phone.replace(/\s/g, "")}`} className="font-semibold text-brand-700">{v.contact_phone}</a></dd></div></div>}
        </dl>
        {v.message && <p className="rounded-2xl bg-surface p-3 text-sm"><span className="font-semibold">Message : </span>{v.message}</p>}

        {(v.status === "PENDING" || v.status === "CONFIRMED") && (
          <div className="space-y-3 border-t border-line pt-4">
            <InlineError error={action.error} />
            <div className="flex flex-wrap gap-2">
              {host && v.status === "PENDING" && <Button loading={action.isPending} onClick={() => action.mutate("CONFIRMED")}>Confirmer la visite</Button>}
              {host && v.status === "CONFIRMED" && <Button loading={action.isPending} disabled={!started} onClick={() => action.mutate("COMPLETED")} title={started ? undefined : "Possible après l'heure du rendez-vous"}>Marquer comme effectuée</Button>}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Input label="Motif d'annulation (facultatif)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="flex-1" />
              <Button variant="secondary" loading={action.isPending} onClick={() => action.mutate("CANCELLED")}>Annuler la visite</Button>
            </div>
          </div>
        )}
      </Card>

      {!host && (v.status === "CONFIRMED" || v.status === "COMPLETED") && v.listing.transaction_type === "RENT" && (
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Le logement vous convient ?</p>
              <p className="text-sm text-muted">Constituez votre dossier locatif (pièces et informations), puis transmettez-le au propriétaire ou à l'agent.</p>
            </div>
            <Button loading={openApplication.isPending} onClick={() => openApplication.mutate()}>Constituer mon dossier</Button>
          </div>
          <InlineError error={openApplication.error} />
          <p className="text-sm text-muted">Paiement du premier loyer via Wave (les frais de dossier se règlent dans le dossier locatif) : <Link to={`/paiement?logement=${v.listing.id}`} className="font-semibold text-brand-700 underline">ouvrir le dossier de paiement</Link>.</p>
        </Card>
      )}

      {!host && (v.status === "CONFIRMED" || v.status === "COMPLETED") && v.listing.transaction_type !== "RENT" && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">Le logement vous convient ?</p>
            <p className="text-sm text-muted">Ouvrez votre dossier de réservation et réglez via Wave. Frais de dossier affichés séparément.</p>
          </div>
          <Link to={`/paiement?logement=${v.listing.id}`}><Button>Ouvrir mon dossier</Button></Link>
        </Card>
      )}
    </div>
  );
}
