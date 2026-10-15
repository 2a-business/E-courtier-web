import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../components/ui/cn";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Notification, Paginated } from "../lib/types";

const SMS_NOTE: Record<string, string> = {
  LOGGED_NOT_SENT: "SMS non envoyé (environnement de développement)",
  NO_PHONE: "Pas de SMS : aucun numéro renseigné",
  SENT: "SMS transmis",
  FAILED: "Échec d'envoi du SMS",
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["notifications", "list"], queryFn: () => api<Paginated<Notification>>("/notifications/") });
  const markAll = useMutation({
    mutationFn: () => api("/notifications/read/", { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <Button variant="ghost" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>Tout marquer comme lu</Button>
      </div>
      {query.isPending ? <Skeleton className="h-60" /> : query.isError ? <ErrorState error={query.error} /> : query.data.results.length === 0 ? (
        <EmptyState title="Aucune notification" />
      ) : (
        <ul className="space-y-2">
          {query.data.results.map((n) => (
            <li key={n.id}>
              <Card className={cn("p-4", !n.read_at && "border-l-4 border-brand-600")}>
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{n.title}</p>
                  <time className="shrink-0 text-xs text-muted">{formatDate(n.created_at, true)}</time>
                </div>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {n.link && <Link to={n.link} className="text-sm font-semibold text-brand-700">Ouvrir</Link>}
                  {SMS_NOTE[n.sms_status] && <span className="text-[11px] text-muted">{SMS_NOTE[n.sms_status]}</span>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
