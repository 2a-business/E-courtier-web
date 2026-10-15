import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Select, Textarea } from "./ui/Field";
import { Modal } from "./ui/Modal";
import { InlineError, Notice } from "./ui/States";

const REASONS = [
  { value: "FRAUD", label: "Arnaque ou fraude suspectée" },
  { value: "MISLEADING_PHOTOS", label: "Photos trompeuses" },
  { value: "WRONG_INFO", label: "Informations erronées (prix, surface…)" },
  { value: "UNAVAILABLE", label: "Logement plus disponible" },
  { value: "ABUSIVE_FEES", label: "Frais de courtage abusifs demandés" },
  { value: "OTHER", label: "Autre" },
];

export function ReportButton({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("FRAUD");
  const [details, setDetails] = useState("");
  const report = useMutation({ mutationFn: () => api("/reports/", { body: { listing: listingId, reason, details } }) });

  function submit(e: FormEvent) {
    e.preventDefault();
    report.mutate();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (user ? setOpen(true) : navigate(`/connexion?suite=/logements/${listingId}`))}
        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"
      >
        <Flag className="size-4" aria-hidden /> Signaler cette annonce
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Signaler l'annonce">
        {report.isSuccess ? (
          <div className="space-y-4">
            <Notice tone="success">Merci. Votre signalement a été transmis à l'équipe de modération, qui l'examinera.</Notice>
            <Button block onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Select label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS} />
            <Textarea label="Détails (facultatif)" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} hint="Ne communiquez pas de mot de passe ni de code de paiement." />
            <InlineError error={report.error} />
            <Button type="submit" variant="danger" block loading={report.isPending}>Envoyer le signalement</Button>
          </form>
        )}
      </Modal>
    </>
  );
}
