import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CalendarPlus, FileUp, ImagePlus, ShieldCheck, Star, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { cn } from "../../components/ui/cn";
import { Checkbox, Input, Select, Textarea } from "../../components/ui/Field";
import { EmptyState, ErrorState, InlineError, Notice, Skeleton } from "../../components/ui/States";
import { ApiError, api, apiBlob } from "../../lib/api";
import { fileSize, formatDate, formatDayLong, formatTime, PROPERTY_TYPES } from "../../lib/format";
import { listingSchema, type ListingForm } from "../../lib/schemas";
import type { Amenity, ListingDetail, VerificationDocument, VerificationRequest } from "../../lib/types";

const EMPTY: ListingForm = {
  title: "", description: "", property_type: "APARTMENT", transaction_type: "RENT", price: "" as unknown as number,
  surface_m2: "", rooms: 1, bedrooms: 0, bathrooms: 1, is_furnished: false, city: "Dakar", district: "",
  address_public: "", address_private: "", latitude: "", longitude: "", amenities: [],
};

function toForm(l: ListingDetail): ListingForm {
  return {
    title: l.title, description: l.description, property_type: l.property_type, transaction_type: l.transaction_type, price: l.price,
    surface_m2: l.surface_m2 ?? "", rooms: l.rooms, bedrooms: l.bedrooms, bathrooms: l.bathrooms, is_furnished: l.is_furnished,
    city: l.city, district: l.district, address_public: l.address_public, address_private: l.address_private ?? "",
    latitude: l.latitude ?? "", longitude: l.longitude ?? "", amenities: l.amenities.map((a) => a.slug),
  };
}

function ListingFormCard({ listing, onSaved }: { listing?: ListingDetail; onSaved: (l: ListingDetail) => void }) {
  const amenities = useQuery({ queryKey: ["amenities"], queryFn: () => api<Amenity[]>("/amenities/"), staleTime: Infinity });
  const form = useForm<ListingForm>({ resolver: zodResolver(listingSchema), defaultValues: listing ? toForm(listing) : EMPTY });
  const [error, setError] = useState<unknown>(null);
  const { errors, isSubmitting, isDirty } = form.formState;
  const selected = form.watch("amenities");

  useEffect(() => {
    if (listing) form.reset(toForm(listing));
  }, [listing, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const body = {
      ...values,
      surface_m2: values.surface_m2 === "" ? null : values.surface_m2,
      latitude: values.latitude === "" ? null : Number(values.latitude).toFixed(6),
      longitude: values.longitude === "" ? null : Number(values.longitude).toFixed(6),
    };
    try {
      const saved = listing
        ? await api<ListingDetail>(`/listings/${listing.id}/`, { method: "PATCH", body })
        : await api<ListingDetail>("/listings/", { body });
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.errors) Object.entries(e.errors).forEach(([k, v]) => form.setError(k as keyof ListingForm, { message: Array.isArray(v) ? v[0] : String(v) }));
      setError(e);
    }
  });

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <SectionTitle title="Informations" />
        <Input label="Titre" error={errors.title?.message} {...form.register("title")} placeholder="Appartement 3 pièces lumineux à Fann Hock" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Transaction" options={[{ value: "RENT", label: "Location" }, { value: "SALE", label: "Vente" }]} {...form.register("transaction_type")} />
          <Select label="Type de bien" options={PROPERTY_TYPES} {...form.register("property_type")} />
          <Input label="Prix (FCFA)" type="number" inputMode="numeric" min={1000} hint="Loyer mensuel ou prix de vente, hors frais de dossier." error={errors.price?.message} {...form.register("price")} />
          <Input label="Surface (m²)" type="number" min={5} error={errors.surface_m2?.message} {...form.register("surface_m2")} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Pièces" type="number" min={1} error={errors.rooms?.message} {...form.register("rooms")} />
          <Input label="Chambres" type="number" min={0} error={errors.bedrooms?.message} {...form.register("bedrooms")} />
          <Input label="Salles de bain" type="number" min={0} error={errors.bathrooms?.message} {...form.register("bathrooms")} />
        </div>
        <Checkbox label="Logement meublé" {...form.register("is_furnished")} />
        <Textarea label="Description" rows={6} error={errors.description?.message} {...form.register("description")} />

        <SectionTitle title="Localisation" subtitle="L'adresse exacte n'est montrée qu'aux visiteurs confirmés. La carte publique est arrondie à ~100 m." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Ville" error={errors.city?.message} {...form.register("city")} />
          <Input label="Quartier" error={errors.district?.message} {...form.register("district")} />
          <Input label="Repère public (facultatif)" placeholder="Près de la pharmacie de Fann" {...form.register("address_public")} />
          <Input label="Adresse exacte (privée)" {...form.register("address_private")} />
          <Input label="Latitude (facultatif)" type="number" step="0.000001" placeholder="14.6858" error={errors.latitude?.message} {...form.register("latitude")} />
          <Input label="Longitude (facultatif)" type="number" step="0.000001" placeholder="-17.4652" error={errors.longitude?.message} {...form.register("longitude")} />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Équipements</legend>
          <div className="flex flex-wrap gap-2">
            {(amenities.data ?? []).map((a) => {
              const on = selected.includes(a.slug);
              return (
                <button
                  key={a.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => form.setValue("amenities", on ? selected.filter((s) => s !== a.slug) : [...selected, a.slug], { shouldDirty: true })}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white")}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        {listing?.verification_status === "APPROVED" && (
          <Notice tone="warning">Modifier le type, la transaction, la ville, le quartier ou l'adresse exacte retirera le badge « Annonce vérifiée ».</Notice>
        )}
        <InlineError error={error} />
        <Button type="submit" loading={isSubmitting} disabled={!!listing && !isDirty}>{listing ? "Enregistrer les modifications" : "Créer le brouillon"}</Button>
      </form>
    </Card>
  );
}

function PhotosCard({ listing, refresh }: { listing: ListingDetail; refresh: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const photos = listing.photos;
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
    refresh();
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("image", file);
      try {
        await api(`/listings/${listing.id}/photos/`, { form });
      } catch (e) {
        setError(e);
        break;
      }
    }
    setUploading(false);
    refresh();
  }

  function move(index: number, delta: number) {
    const ids = photos.map((p) => p.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    run(() => api(`/listings/${listing.id}/photos/reorder/`, { body: { ids } }));
  }

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle title="Photos" subtitle="JPEG, PNG ou WEBP, 5 Mo max. Les images sont redimensionnées et leurs métadonnées (GPS) supprimées." />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white">
            <img src={p.thumbnail || p.image} alt={p.caption || `Photo ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between gap-1 p-2">
              {p.is_primary ? <span className="text-xs font-semibold text-brand-700">Principale</span> : (
                <button type="button" aria-label="Définir comme photo principale" className="grid size-8 place-items-center rounded-full hover:bg-surface" onClick={() => run(() => api(`/listings/${listing.id}/photos/${p.id}/primary/`, { method: "POST" }))}><Star className="size-4" aria-hidden /></button>
              )}
              <span className="flex">
                <button type="button" aria-label="Avancer" disabled={i === 0} className="grid size-8 place-items-center rounded-full hover:bg-surface disabled:opacity-30" onClick={() => move(i, -1)}><ArrowUp className="size-4" aria-hidden /></button>
                <button type="button" aria-label="Reculer" disabled={i === photos.length - 1} className="grid size-8 place-items-center rounded-full hover:bg-surface disabled:opacity-30" onClick={() => move(i, 1)}><ArrowDown className="size-4" aria-hidden /></button>
                <button type="button" aria-label="Supprimer la photo" className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50" onClick={() => window.confirm("Supprimer cette photo ?") && run(() => api(`/listings/${listing.id}/photos/${p.id}/`, { method: "DELETE" }))}><Trash2 className="size-4" aria-hidden /></button>
              </span>
            </div>
          </li>
        ))}
        <li>
          <label className={cn("flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-sm font-semibold text-brand-700", uploading && "opacity-60")}>
            <ImagePlus aria-hidden />
            {uploading ? "Envoi…" : "Ajouter des photos"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files)} />
          </label>
        </li>
      </ul>
      <div className="mt-3"><InlineError error={error} /></div>
    </Card>
  );
}

function PublicationCard({ listing, refresh }: { listing: ListingDetail; refresh: () => void }) {
  const change = useMutation({ mutationFn: (status: string) => api(`/listings/${listing.id}/publication/`, { body: { status } }), onSuccess: refresh });
  const s = listing.publication_status;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div><p className="text-sm text-muted">Publication</p><StatusBadge status={s} /></div>
      <div className="flex flex-wrap gap-2">
        {s === "DRAFT" && <Button loading={change.isPending} onClick={() => change.mutate("PUBLISHED")}>Publier</Button>}
        {s === "PUBLISHED" && <Button variant="secondary" loading={change.isPending} onClick={() => change.mutate("DRAFT")}>Repasser en brouillon</Button>}
        {s !== "ARCHIVED" && s !== "SUSPENDED" && <Button variant="ghost" onClick={() => change.mutate("ARCHIVED")}>Archiver</Button>}
        {s === "ARCHIVED" && <Button variant="secondary" onClick={() => change.mutate("DRAFT")}>Restaurer en brouillon</Button>}
        <Link to={`/logements/${listing.id}`}><Button variant="ghost">Voir la fiche</Button></Link>
      </div>
      {s === "SUSPENDED" && <div className="w-full"><Notice tone="warning">Annonce suspendue par la modération. Contactez l'équipe E-Courtier.</Notice></div>}
      <div className="w-full"><InlineError error={change.error} /></div>
    </Card>
  );
}

function SlotsCard({ listing }: { listing: ListingDetail }) {
  const qc = useQueryClient();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: tomorrow, start_time: "09:00", end_time: "12:00", duration_minutes: "45" });
  const slots = useQuery({ queryKey: ["host-slots", listing.id], queryFn: () => api<{ id: number; starts_at: string; ends_at: string; booked: boolean; is_active: boolean }[]>("/visits/manage/slots/", { params: { listing: listing.id } }) });
  const create = useMutation({
    mutationFn: () => api("/visits/manage/slots/", { body: { listing: listing.id, ...form, duration_minutes: Number(form.duration_minutes) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["host-slots", listing.id] }),
  });
  const remove = useMutation({ mutationFn: (id: number) => api(`/visits/manage/slots/${id}/`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["host-slots", listing.id] }) });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle title="Créneaux de visite" subtitle="Heure de Dakar. Un créneau réservé ne peut pas être supprimé." />
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
        <Input label="Date" type="date" min={tomorrow} value={form.date} onChange={set("date")} className="col-span-2 sm:col-span-1" />
        <Input label="Début" type="time" value={form.start_time} onChange={set("start_time")} />
        <Input label="Fin" type="time" value={form.end_time} onChange={set("end_time")} />
        <Select label="Durée" value={form.duration_minutes} onChange={set("duration_minutes")} options={["30", "45", "60", "90"].map((v) => ({ value: v, label: `${v} min` }))} />
        <Button type="submit" loading={create.isPending} className="col-span-2 sm:col-span-1"><CalendarPlus className="size-4" aria-hidden /> Ajouter</Button>
      </form>
      <div className="mt-3"><InlineError error={create.error ?? remove.error} /></div>
      {slots.isPending ? <Skeleton className="mt-4 h-24" /> : slots.isError ? <ErrorState error={slots.error} /> : slots.data.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Aucun créneau à venir : les clients ne peuvent pas encore réserver.</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {slots.data.map((s) => (
            <li key={s.id} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", s.booked ? "border-amber-300 bg-amber-50" : "border-line bg-white")}>
              <span>{formatDayLong(s.starts_at).split(" ").slice(0, 3).join(" ")} · {formatTime(s.starts_at)}</span>
              {s.booked ? <span className="text-xs font-semibold text-amber-800">Réservé</span> : (
                <button type="button" aria-label="Supprimer le créneau" onClick={() => remove.mutate(s.id)} className="text-red-600"><Trash2 className="size-4" aria-hidden /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const DOC_TYPES = [
  { value: "ID_CARD", label: "Carte nationale d'identité" },
  { value: "PASSPORT", label: "Passeport" },
  { value: "LAND_TITLE", label: "Titre foncier" },
  { value: "DEED", label: "Acte de vente / bail / délibération" },
  { value: "MANDATE", label: "Mandat de gestion (agent)" },
  { value: "UTILITY_BILL", label: "Facture (Senelec, SDE…)" },
  { value: "OTHER", label: "Autre justificatif" },
];

export async function openPrivateDocument(id: number) {
  const blob = await apiBlob(`/verification/documents/${id}/file/`);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function VerificationCard({ listing, refresh }: { listing: ListingDetail; refresh: () => void }) {
  const qc = useQueryClient();
  const [docType, setDocType] = useState("ID_CARD");
  const [file, setFile] = useState<File | null>(null);
  const docs = useQuery({ queryKey: ["docs", listing.id], queryFn: () => api<VerificationDocument[]>(`/verification/listings/${listing.id}/documents/`) });
  const history = useQuery({ queryKey: ["verif-requests", listing.id], queryFn: () => api<VerificationRequest[]>(`/verification/listings/${listing.id}/requests/`) });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["docs", listing.id] });
    qc.invalidateQueries({ queryKey: ["verif-requests", listing.id] });
    refresh();
  };
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("doc_type", docType);
      form.append("file", file!);
      return api(`/verification/listings/${listing.id}/documents/`, { form });
    },
    onSuccess: () => {
      setFile(null);
      invalidate();
    },
  });
  const remove = useMutation({ mutationFn: (id: number) => api(`/verification/documents/${id}/`, { method: "DELETE" }), onSuccess: invalidate });
  const submit = useMutation({ mutationFn: () => api(`/verification/listings/${listing.id}/submit/`, { method: "POST" }), onSuccess: invalidate });
  const status = listing.verification_status;
  const draftDocs = (docs.data ?? []).filter((d) => !d.submitted);
  const lastRejected = history.data?.find((r) => r.status === "REJECTED");

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle title="Vérification de l'annonce" subtitle="Documents privés : visibles uniquement par vous et l'équipe de vérification." action={<StatusBadge status={status} />} />
      <Notice tone="info" icon={<ShieldCheck className="size-5" aria-hidden />}>
        Fournissez une pièce d'identité et un justificatif du bien (titre foncier, acte ou mandat). L'examen par E-Courtier réduit les risques mais ne vaut ni authentification officielle ni garantie de propriété.
      </Notice>
      {status === "REJECTED" && lastRejected && <div className="mt-3"><Notice tone="warning">Dernier refus : {lastRejected.decision_reason}. Ajoutez des pièces corrigées puis soumettez à nouveau.</Notice></div>}
      {status === "PENDING" ? (
        <p className="mt-4 text-sm font-semibold text-amber-700">Demande en cours d'examen. Vous serez notifié de la décision.</p>
      ) : status !== "APPROVED" && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Select label="Type de justificatif" value={docType} onChange={(e) => setDocType(e.target.value)} options={DOC_TYPES} />
            <Input label="Fichier (PDF, JPEG, PNG — 8 Mo max.)" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}><FileUp className="size-4" aria-hidden /> Déposer</Button>
          </div>
          <InlineError error={upload.error ?? remove.error ?? submit.error} />
          {draftDocs.length > 0 && (
            <ul className="space-y-2">
              {draftDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                  <button type="button" className="text-left font-semibold text-brand-700" onClick={() => openPrivateDocument(d.id)}>{d.doc_type_label}</button>
                  <span className="truncate text-muted">{d.original_name} · {fileSize(d.size)}</span>
                  <button type="button" aria-label="Supprimer le justificatif" className="text-red-600" onClick={() => remove.mutate(d.id)}><Trash2 className="size-4" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" disabled={!draftDocs.length} loading={submit.isPending} onClick={() => submit.mutate()}>Soumettre à la vérification</Button>
        </div>
      )}
      {!!history.data?.length && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-sm font-semibold">Historique</p>
          <ul className="space-y-1 text-sm">
            {history.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} /> soumise le {formatDate(r.submitted_at)}
                {r.decided_at && <span className="text-muted">· décision le {formatDate(r.decided_at)} par {r.decided_by_name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function ListingEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["listing", id, "edit"], queryFn: () => api<ListingDetail>(`/listings/${id}/`), enabled: !!id });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["listing", id] });
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  };

  if (id && query.isPending) return <div className="mx-auto max-w-4xl px-4 py-6"><Skeleton className="h-[40rem]" /></div>;
  if (id && query.isError) return <div className="mx-auto max-w-4xl px-4 py-10"><ErrorState error={query.error} /></div>;
  const listing = query.data;
  if (listing && !listing.can_manage) return <div className="mx-auto max-w-4xl px-4 py-10"><EmptyState title="Vous ne gérez pas cette annonce" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <div>
        <Link to="/tableau-de-bord?onglet=annonces" className="text-sm font-semibold text-muted">← Mes annonces</Link>
        <h1 className="mt-1 text-2xl font-extrabold">{listing ? listing.title : "Nouvelle annonce"}</h1>
      </div>
      {listing && <PublicationCard listing={listing} refresh={refresh} />}
      <ListingFormCard listing={listing} onSaved={(saved) => (listing ? refresh() : navigate(`/tableau-de-bord/annonces/${saved.id}`, { replace: true }))} />
      {listing ? (
        <>
          <PhotosCard listing={listing} refresh={refresh} />
          <SlotsCard listing={listing} />
          <VerificationCard listing={listing} refresh={refresh} />
        </>
      ) : (
        <Notice tone="info">Après création du brouillon, vous pourrez ajouter les photos, les créneaux de visite et les justificatifs.</Notice>
      )}
    </div>
  );
}
