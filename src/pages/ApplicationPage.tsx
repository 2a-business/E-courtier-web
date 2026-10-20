import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, FileUp, Lock, ReceiptText, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, SectionTitle } from "../components/ui/Card";
import { Checkbox, Input, Select, Textarea } from "../components/ui/Field";
import { ErrorState, InlineError, Notice, Skeleton } from "../components/ui/States";
import { api, apiBlob } from "../lib/api";
import { fcfa, fileSize, formatDate } from "../lib/format";
import type { RentalApplication } from "../lib/types";
import { ListingHeader } from "./VisitNewPage";

export const APPLICATION_DOC_TYPES = [
  { value: "ID_CARD", label: "Carte nationale d'identité" },
  { value: "PASSPORT", label: "Passeport" },
  { value: "INCOME_PROOF", label: "Justificatif de revenus" },
  { value: "EMPLOYMENT_PROOF", label: "Attestation de travail ou d'activité" },
  { value: "RESIDENCE_PROOF", label: "Justificatif de domicile actuel" },
  { value: "GUARANTOR_ID", label: "Pièce d'identité du garant" },
  { value: "OTHER", label: "Autre document" },
];

const EVENT_LABELS: Record<string, string> = {
  created: "Dossier ouvert",
  submitted: "Dossier transmis",
  resubmitted: "Complément transmis",
  review_started: "Examen commencé",
  info_requested: "Complément demandé",
  accepted: "Dossier accepté",
  rejected: "Dossier refusé",
};

/** Pièce privée : téléchargement authentifié, ouverte depuis un lien temporaire local (jamais d'URL publique). */
async function openApplicationDocument(id: number) {
  const blob = await apiBlob(`/applications/documents/${id}/file/`);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type InfoForm = {
  profession: string;
  employer: string;
  monthly_income_xof: string;
  household_size: string;
  move_in_date: string;
  has_guarantor: boolean;
  guarantor_name: string;
  message: string;
};

function toForm(a: RentalApplication): InfoForm {
  return {
    profession: a.profession, employer: a.employer, monthly_income_xof: a.monthly_income_xof?.toString() ?? "",
    household_size: a.household_size?.toString() ?? "", move_in_date: a.move_in_date ?? "", has_guarantor: a.has_guarantor,
    guarantor_name: a.guarantor_name, message: a.message,
  };
}

function InfoCard({ app, onSaved }: { app: RentalApplication; onSaved: (a: RentalApplication) => void }) {
  const [form, setForm] = useState<InfoForm>(() => toForm(app));
  useEffect(() => setForm(toForm(app)), [app]);
  const set = (key: keyof InfoForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = useMutation({
    mutationFn: () =>
      api<RentalApplication>(`/applications/${app.id}/`, {
        method: "PATCH",
        body: {
          ...form,
          monthly_income_xof: form.monthly_income_xof === "" ? null : Number(form.monthly_income_xof),
          household_size: form.household_size === "" ? null : Number(form.household_size),
          move_in_date: form.move_in_date || null,
        },
      }),
    onSuccess: onSaved,
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle title="Vos informations" subtitle="Visibles par le propriétaire ou l'agent uniquement après transmission." />
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Profession *" value={form.profession} onChange={set("profession")} maxLength={100} />
        <Input label="Employeur" value={form.employer} onChange={set("employer")} maxLength={120} />
        <Input label="Revenus mensuels (FCFA) *" type="number" min={0} value={form.monthly_income_xof} onChange={set("monthly_income_xof")} />
        <Input label="Nombre d'occupants *" type="number" min={1} max={30} value={form.household_size} onChange={set("household_size")} />
        <Input label="Date d'entrée souhaitée *" type="date" value={form.move_in_date} onChange={set("move_in_date")} />
        <div className="flex flex-col justify-end gap-2">
          <Checkbox label="J'ai un garant" checked={form.has_guarantor} onChange={(e) => setForm((f) => ({ ...f, has_guarantor: e.target.checked }))} />
          {form.has_guarantor && <Input label="Nom du garant *" value={form.guarantor_name} onChange={set("guarantor_name")} maxLength={120} />}
        </div>
        <Textarea label="Message au propriétaire ou à l'agent" value={form.message} onChange={set("message")} maxLength={1000} className="sm:col-span-2" />
        <div className="space-y-2 sm:col-span-2">
          <InlineError error={save.error} />
          <Button type="submit" variant="secondary" loading={save.isPending}>Enregistrer le brouillon</Button>
          {save.isSuccess && <span className="ml-3 text-sm text-green-700">Brouillon enregistré.</span>}
        </div>
      </form>
    </Card>
  );
}

function InfoSummary({ app }: { app: RentalApplication }) {
  const rows: [string, string][] = [
    ["Profession", app.profession || "—"],
    ["Employeur", app.employer || "—"],
    ["Revenus mensuels", app.monthly_income_xof != null ? fcfa(app.monthly_income_xof) : "—"],
    ["Nombre d'occupants", app.household_size?.toString() ?? "—"],
    ["Date d'entrée souhaitée", app.move_in_date ? formatDate(app.move_in_date) : "—"],
    ["Garant", app.has_guarantor ? app.guarantor_name || "Oui" : "Non"],
  ];
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle title={app.my_role === "customer" ? "Vos informations" : `Candidat : ${app.customer_name}`} />
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
      {app.message && <p className="mt-4 rounded-2xl bg-surface p-3 text-sm"><span className="font-semibold">Message : </span>{app.message}</p>}
    </Card>
  );
}

function DocumentsCard({ app, refresh }: { app: RentalApplication; refresh: () => void }) {
  const [docType, setDocType] = useState("ID_CARD");
  const [file, setFile] = useState<File | null>(null);
  const [replaces, setReplaces] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const r = app.requirements;
  // Contrôle immédiat côté navigateur (confort) ; le serveur reste seul juge du contenu réel du fichier.
  function choose(next: File | null) {
    if (!next) {
      setFile(null);
      setFileError(null);
      setInputKey((k) => k + 1);
      return;
    }
    const allowed = /\.(pdf|jpe?g|png)$/i.test(next.name) && (!next.type || ["application/pdf", "image/jpeg", "image/png"].includes(next.type));
    if (!allowed) setFileError(`Format non accepté : ${r.accepted_formats.join(", ")} uniquement.`);
    else if (next.size > r.max_document_size_mb * 1024 * 1024) setFileError(`Fichier trop lourd (${fileSize(next.size)}) : ${r.max_document_size_mb} Mo maximum.`);
    else if (next.size === 0) setFileError("Fichier vide.");
    else setFileError(null);
    setFile(next);
  }
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("doc_type", docType);
      form.append("file", file!);
      if (replaces) form.append("replaces", String(replaces));
      return api(`/applications/${app.id}/documents/`, { form });
    },
    onSuccess: () => {
      choose(null);
      setReplaces(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: number) => api(`/applications/documents/${id}/`, { method: "DELETE" }), onSuccess: refresh });
  const preview = (id: number) => openApplicationDocument(id).catch(setPreviewError);

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle title="Pièces du dossier" subtitle="Documents privés : visibles par vous, par le responsable du logement après transmission, et consultables par l'administration E-Courtier (consultations tracées)." />
      {app.my_role === "customer" && (
        <ul className="mb-4 space-y-1 text-sm" aria-label="Pièces attendues">
          {r.required_documents.map((d) => (
            <li key={d.label} className="flex items-center gap-2">
              {d.satisfied ? <CheckCircle2 className="size-4 text-green-600" aria-hidden /> : <Circle className="size-4 text-amber-600" aria-hidden />}
              <span><strong>Obligatoire :</strong> {d.label}{d.satisfied ? "" : " (manquante)"}</span>
            </li>
          ))}
          <li className="text-muted">Facultatives : {r.optional_documents.map((d) => d.label).join(", ")}.</li>
        </ul>
      )}
      {app.documents.length === 0 ? <p className="text-sm text-muted">Aucune pièce déposée.</p> : (
        <ul className="space-y-2">
          {app.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm">
              <button type="button" className="text-left font-semibold text-brand-700" onClick={() => preview(d.id)}>{d.doc_type_label}</button>
              <span className="min-w-0 flex-1 truncate text-muted">{d.original_name} · {fileSize(d.size)}</span>
              {d.submitted ? <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock className="size-3.5" aria-hidden />Transmise</span> : app.can_edit && (
                <>
                  <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => { setReplaces(d.id); setDocType(d.doc_type); }}>Remplacer</button>
                  <button type="button" aria-label={`Supprimer ${d.doc_type_label}`} className="text-red-600" onClick={() => remove.mutate(d.id)}><Trash2 className="size-4" aria-hidden /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <InlineError error={previewError ?? remove.error} />
      {app.can_edit && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {replaces && <Notice tone="info">Remplacement de la pièce sélectionnée. <button type="button" className="font-semibold underline" onClick={() => setReplaces(null)}>Annuler</button></Notice>}
          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <Select label="Type de pièce" value={docType} onChange={(e) => setDocType(e.target.value)} options={APPLICATION_DOC_TYPES} />
            <Input
              key={inputKey}
              label={`Fichier (${r.accepted_formats.join(", ")} — ${r.max_document_size_mb} Mo max.)`}
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </div>
          {fileError && <p role="alert" className="text-sm font-medium text-red-600">{fileError}</p>}
          {file && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">Fichier sélectionné : <strong>{file.name}</strong> · {fileSize(file.size)}</span>
              <button type="button" className="font-semibold text-brand-700" onClick={() => choose(null)}>Changer de fichier</button>
            </div>
          )}
          <Button disabled={!file || !!fileError} loading={upload.isPending} onClick={() => upload.mutate()}><FileUp className="size-4" aria-hidden /> {replaces ? "Remplacer la pièce" : "Envoyer la pièce"}</Button>
          <p className="text-xs text-muted">Le contenu réel du fichier est vérifié par E-Courtier : un fichier renommé ou d'un autre format est refusé.</p>
          <InlineError error={upload.error} />
        </div>
      )}
    </Card>
  );
}

function SubmitCard({ app, onDone }: { app: RentalApplication; onDone: (a: RentalApplication) => void }) {
  const [consent, setConsent] = useState(false);
  const submit = useMutation({ mutationFn: () => api<RentalApplication>(`/applications/${app.id}/submit/`, { body: { consent } }), onSuccess: onDone });
  const r = app.requirements;
  const missing = [...r.missing_documents, ...r.missing_fields];
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <SectionTitle title={app.status === "INFO_REQUESTED" ? "Transmettre le complément" : "Vérifier et transmettre"} />
      {missing.length > 0
        ? <Notice tone="warning">Dossier incomplet. À compléter : {missing.join(", ")}.</Notice>
        : <Notice tone="success">Dossier complet : vous pouvez le transmettre.</Notice>}
      <Checkbox
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        label="J'accepte que mes informations et pièces soient transmises au propriétaire ou à l'agent de ce logement pour l'examen de ma candidature, et consultables par l'administration E-Courtier en cas de besoin. Elles ne sont jamais publiées."
      />
      <InlineError error={submit.error} />
      <Button disabled={missing.length > 0 || !consent} loading={submit.isPending} onClick={() => submit.mutate()}>Transmettre au propriétaire ou à l'agent</Button>
    </Card>
  );
}

function ReviewCard({ app, onDone }: { app: RentalApplication; onDone: (a: RentalApplication) => void }) {
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const call = (path: string, body?: unknown) => api<RentalApplication>(`/applications/${app.id}/${path}/`, body === undefined ? { method: "POST" } : { body });
  const review = useMutation({ mutationFn: () => call("review"), onSuccess: onDone });
  const info = useMutation({ mutationFn: () => call("request-info", { message }), onSuccess: (a) => { setMessage(""); onDone(a); } });
  const decide = useMutation({ mutationFn: (decision: "ACCEPTED" | "REJECTED") => call("decision", { decision, reason }), onSuccess: onDone });
  const open = app.status === "SUBMITTED" || app.status === "UNDER_REVIEW";
  const feeOk = app.payment.fee.status === "CONFIRMED" || app.payment.fee.status === "NOT_REQUIRED";
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <SectionTitle title="Examen du dossier" />
      {app.status === "SUBMITTED" && <Button variant="secondary" loading={review.isPending} onClick={() => review.mutate()}>Commencer l'examen</Button>}
      {open && (
        <div className="space-y-2">
          <Textarea label="Demander des pièces ou informations complémentaires" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} hint="Le candidat verra ce message et pourra compléter son dossier." />
          <Button variant="secondary" disabled={!message.trim()} loading={info.isPending} onClick={() => info.mutate()}>Demander un complément</Button>
        </div>
      )}
      {app.status === "INFO_REQUESTED" && <Notice tone="info">Complément demandé : en attente du candidat.</Notice>}
      {open && !feeOk && <Notice tone="info">Acceptation possible après la confirmation des frais de dossier par E-Courtier (statut actuel : {app.payment.fee.status_label.toLowerCase()}).</Notice>}
      <div className="space-y-2 border-t border-line pt-4">
        <Textarea label="Motif de la décision (obligatoire en cas de refus)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        <div className="flex flex-wrap gap-2">
          {open && <Button disabled={!feeOk} loading={decide.isPending} onClick={() => decide.mutate("ACCEPTED")}>Accepter le dossier</Button>}
          <Button variant="secondary" disabled={!reason.trim()} loading={decide.isPending} onClick={() => decide.mutate("REJECTED")}>Refuser le dossier</Button>
        </div>
      </div>
      <InlineError error={review.error ?? info.error ?? decide.error} />
    </Card>
  );
}

function NotesCard({ app, refresh }: { app: RentalApplication; refresh: () => void }) {
  const [text, setText] = useState("");
  const add = useMutation({ mutationFn: () => api(`/applications/${app.id}/notes/`, { body: { text } }), onSuccess: () => { setText(""); refresh(); } });
  return (
    <Card className="space-y-3 p-5 sm:p-6">
      <SectionTitle title="Notes internes" subtitle="Jamais visibles par le candidat." />
      {app.internal_notes?.length ? (
        <ul className="space-y-2 text-sm">
          {app.internal_notes.map((n) => <li key={n.id} className="rounded-xl bg-surface p-3"><p>{n.text}</p><p className="mt-1 text-xs text-muted">{n.author_name} · {formatDate(n.created_at, true)}</p></li>)}
        </ul>
      ) : <p className="text-sm text-muted">Aucune note.</p>}
      {app.my_role === "responsible" && (
        <div className="space-y-2">
          <Textarea label="Nouvelle note" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <InlineError error={add.error} />
          <Button variant="secondary" disabled={!text.trim()} loading={add.isPending} onClick={() => add.mutate()}>Ajouter la note</Button>
        </div>
      )}
    </Card>
  );
}

const FEE_TEXT: Partial<Record<string, string>> = {
  NOT_STARTED: "Les frais seront à régler après la transmission du dossier.",
  PENDING: "À régler via Wave.",
  AWAITING_VERIFICATION: "Paiement en attente de vérification : E-Courtier le rapproche dans Wave Business avant confirmation.",
  CONFIRMED: "Frais vérifiés et confirmés par E-Courtier.",
  FAILED: "Paiement non retrouvé : vérifiez la référence ou contactez le support.",
  CANCELLED: "Frais annulés (dossier refusé).",
};

function FeeCard({ app, onDone }: { app: RentalApplication; onDone: (a: RentalApplication) => void }) {
  const fee = app.payment.fee;
  const [reference, setReference] = useState("");
  const [checkout, setCheckout] = useState<{ url: string; instructions: string } | null>(null);
  const start = useMutation({
    mutationFn: () => api<{ checkout: { url: string; instructions: string }; application: RentalApplication }>(`/applications/${app.id}/fee/start/`, { method: "POST" }),
    onSuccess: (data) => {
      setCheckout(data.checkout);
      onDone(data.application);
      // Lien fourni par le serveur (jamais codé dans le frontend) ; repli : lien « Rouvrir Wave » ci-dessous.
      window.open(data.checkout.url, "_blank", "noopener,noreferrer");
    },
  });
  const declare = useMutation({
    mutationFn: () => api<RentalApplication>(`/applications/${app.id}/fee/declare/`, { body: { provider_reference: reference } }),
    onSuccess: (a) => { setReference(""); onDone(a); },
  });
  const customer = app.my_role === "customer";
  if (fee.status === "NOT_REQUIRED") return null;
  const canDeclare = customer && fee.started && ["PENDING", "AWAITING_VERIFICATION", "FAILED"].includes(fee.status);
  return (
    <Card className="space-y-3 p-5 sm:p-6">
      <SectionTitle title="Frais de dossier" subtitle="Calculés par E-Courtier ; confirmés uniquement après vérification dans Wave Business." action={<StatusBadge status={fee.status === "AWAITING_VERIFICATION" ? "PENDING" : fee.status === "CONFIRMED" ? "PAID" : fee.status} label={fee.status_label} />} />
      <p className="text-sm">Montant dû : <strong>{fcfa(fee.amount)}</strong>{fee.reference && <> · référence à indiquer : <span className="font-mono font-semibold">{fee.reference}</span></>}</p>
      <p className="text-sm text-muted">{FEE_TEXT[fee.status]}</p>
      {fee.status === "FAILED" && fee.failure_reason && <Notice tone="warning">Motif : {fee.failure_reason}</Notice>}
      {fee.provider_reference && <p className="text-sm">Référence Wave déclarée : <span className="font-mono">{fee.provider_reference}</span></p>}
      {customer && fee.payment_problem && <Notice tone="warning">{fee.payment_problem}</Notice>}
      {customer && fee.can_pay && (
        <Button variant="wave" loading={start.isPending} onClick={() => start.mutate()}><Wallet className="size-5" aria-hidden /> Payer {fcfa(fee.amount)} avec Wave <ExternalLink className="size-4" aria-hidden /></Button>
      )}
      <InlineError error={start.error} />
      {checkout && <Notice tone="info">{checkout.instructions} <a href={checkout.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Rouvrir Wave</a></Notice>}
      {canDeclare && (
        <form onSubmit={(e) => { e.preventDefault(); declare.mutate(); }} className="space-y-2 border-t border-line pt-3">
          <Input label="J'ai payé : identifiant de transaction Wave" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. T_8K2M4QXZ7Y" pattern="[A-Za-z0-9_\-]{6,64}" hint="Visible dans l'historique de votre application Wave. Votre déclaration ne vaut pas confirmation." />
          <InlineError error={declare.error} />
          <Button type="submit" variant="secondary" disabled={reference.trim().length < 6} loading={declare.isPending}>Déclarer mon paiement</Button>
        </form>
      )}
    </Card>
  );
}

function RentPaymentCard({ app }: { app: RentalApplication }) {
  const tx = app.payment.transaction;
  if (!tx && app.my_role !== "customer") return null;
  return (
    <Card className="space-y-3 p-5 sm:p-6">
      <SectionTitle title="Premier loyer" subtitle="Paiement distinct du dossier, suivi dans votre dossier de paiement." action={<ReceiptText className="size-5 text-brand-600" aria-hidden />} />
      {tx ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Dossier de paiement <span className="font-mono">{tx.reference}</span> · {fcfa(tx.total_amount)}</span>
          <StatusBadge status={tx.status} label={tx.is_simulated && tx.status === "PAID" ? "Payée (simulation)" : tx.status_label} />
          {tx.status === "PENDING" && <span className="text-muted">Non payé tant que E-Courtier n'a pas vérifié le paiement.</span>}
          {app.my_role === "customer" && <Link to={`/paiement/${tx.id}`} className="font-semibold text-brand-700 underline">Voir le paiement</Link>}
        </div>
      ) : (
        <p className="text-sm text-muted">Aucun paiement de loyer en cours pour ce logement.</p>
      )}
    </Card>
  );
}

export default function ApplicationPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["application", id], queryFn: () => api<RentalApplication>(`/applications/${id}/`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["application", id] });
  const update = (a: RentalApplication) => {
    qc.setQueryData(["application", id], a);
    qc.invalidateQueries({ queryKey: ["applications"] });
  };

  if (query.isPending) return <div className="mx-auto max-w-3xl px-4 py-6"><Skeleton className="h-96" /></div>;
  if (query.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>;
  const app = query.data;
  const customer = app.my_role === "customer";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <Card className="space-y-4 border-t-4 border-brand-600 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-extrabold">Dossier locatif</h1>
          <StatusBadge status={app.state} label={app.status === "DRAFT" ? undefined : app.status_label} />
        </div>
        <ListingHeader listing={app.listing} />
        <p className="text-sm">
          Destinataire : <strong>{app.responsible.name}</strong> ({app.responsible.role_label.toLowerCase()}{app.responsible.agency_name && ` · ${app.responsible.agency_name}`})
          {" "}· visite du {formatDate(app.visit_starts_at, true)} (<Link to={`/visites/${app.visit}`} className="font-semibold text-brand-700 underline">voir la visite</Link>)
        </p>
        <p className="text-sm text-muted">
          {app.submitted_at ? `Transmis le ${formatDate(app.submitted_at, true)}` : "Non transmis"}
          {app.decided_at && ` · décision le ${formatDate(app.decided_at, true)}`}
          {app.my_role === "admin" && " · consultation administrateur (lecture seule)"}
        </p>
      </Card>

      {app.status === "INFO_REQUESTED" && (
        <Notice tone="warning"><strong>Complément demandé :</strong> {app.info_request_message}</Notice>
      )}
      {app.status === "ACCEPTED" && <Notice tone="success" icon={<CheckCircle2 className="size-5" aria-hidden />}>Dossier accepté{app.decision_reason && ` — ${app.decision_reason}`}. Le paiement du premier loyer et le contrat suivent leur propre parcours.</Notice>}
      {app.status === "REJECTED" && <Notice tone="warning">Dossier refusé — motif : {app.decision_reason}</Notice>}
      {customer && app.status === "DRAFT" && (
        <Notice tone="info" icon={<ShieldCheck className="size-5" aria-hidden />}>Brouillon privé : le propriétaire ou l'agent ne voit rien avant votre transmission explicite.</Notice>
      )}

      {customer && app.can_edit ? <InfoCard app={app} onSaved={update} /> : <InfoSummary app={app} />}
      <DocumentsCard app={app} refresh={refresh} />
      {customer && app.can_edit && <SubmitCard app={app} onDone={update} />}
      {app.my_role === "responsible" && ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(app.status) && <ReviewCard app={app} onDone={update} />}
      {app.internal_notes !== null && <NotesCard app={app} refresh={refresh} />}
      <FeeCard app={app} onDone={update} />
      <RentPaymentCard app={app} />

      <Card className="p-5 sm:p-6">
        <SectionTitle title="Historique" />
        <ol className="space-y-2 text-sm">
          {app.events.map((e, i) => (
            <li key={i} className="flex flex-wrap gap-x-2">
              <span className="font-semibold">{EVENT_LABELS[e.event] ?? e.event}</span>
              <span className="text-muted">{formatDate(e.created_at, true)}{e.actor_name && ` · ${e.actor_name}`}</span>
              {e.note && <span className="w-full text-muted">« {e.note} »</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
