import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { PageSpinner } from "../components/ui/Spinner";
import type { Role } from "../lib/types";
import { useAuth } from "./AuthContext";

/** Garde de navigation côté client. La sécurité réelle est appliquée par l'API. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageSpinner />;
  if (!user) return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Accès non autorisé</h1>
        <p className="mt-2 text-muted">Cette page est réservée à d'autres profils d'utilisateurs.</p>
      </div>
    );
  }
  return <>{children}</>;
}
