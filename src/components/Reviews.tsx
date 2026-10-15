import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Review } from "../lib/types";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Field";
import { EmptyState, ErrorState, InlineError } from "./ui/States";
import { cn } from "./ui/cn";

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-line")} aria-hidden />
      ))}
    </span>
  );
}

function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} étoile${i > 1 ? "s" : ""}`} aria-pressed={value === i}>
            <Star className={cn("size-7", i <= value ? "fill-amber-400 text-amber-400" : "text-line")} aria-hidden />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewsSection({ listingId }: { listingId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["reviews", listingId],
    queryFn: () => api<{ results: Review[]; can_review: boolean; owner_rating: { average: number | null; count: number } }>(`/reviews/listings/${listingId}/`),
  });
  const [rating, setRating] = useState(0);
  const [ownerRating, setOwnerRating] = useState(0);
  const [comment, setComment] = useState("");
  const create = useMutation({
    mutationFn: () => api(`/reviews/listings/${listingId}/`, { body: { rating, owner_rating: ownerRating, comment } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", listingId] });
      qc.invalidateQueries({ queryKey: ["listing", listingId] });
    },
  });

  if (query.isPending) return null;
  if (query.isError) return <ErrorState error={query.error} />;
  const { results, can_review, owner_rating } = query.data;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (rating && ownerRating) create.mutate();
  }

  return (
    <div className="space-y-4">
      {owner_rating.average && (
        <p className="text-sm text-muted">
          Note moyenne du propriétaire / agent : <strong className="text-ink">{owner_rating.average} / 5</strong> ({owner_rating.count} avis)
        </p>
      )}
      {results.length === 0 ? (
        <EmptyState title="Pas encore d'avis" text="Seuls les clients ayant effectivement visité ce logement peuvent laisser un avis." />
      ) : (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{r.author_name}</p>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              <p className="mt-2 text-xs text-muted">Visite effectuée · {formatDate(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      {can_review && !create.isSuccess && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-surface p-4">
          <p className="font-semibold">Donnez votre avis sur votre visite</p>
          <div className="flex flex-wrap gap-6">
            <StarInput label="Le logement" value={rating} onChange={setRating} />
            <StarInput label="Le propriétaire / agent" value={ownerRating} onChange={setOwnerRating} />
          </div>
          <Textarea label="Commentaire (facultatif)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          <InlineError error={create.error} />
          <Button type="submit" disabled={!rating || !ownerRating} loading={create.isPending}>Publier mon avis</Button>
        </form>
      )}
    </div>
  );
}
