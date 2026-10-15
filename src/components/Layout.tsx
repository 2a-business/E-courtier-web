import { useQuery } from "@tanstack/react-query";
import { Bell, Home, LayoutDashboard, LogIn, LogOut, MessageCircle, Search, Shield, UserRound } from "lucide-react";
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { cn } from "./ui/cn";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight" aria-label="E-Courtier, accueil">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-sm">
        <Home className="size-5" aria-hidden />
      </span>
      <span className={cn("text-lg", light ? "text-white" : "text-ink")}>
        E-<span className="text-brand-600">Courtier</span>
      </span>
    </Link>
  );
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ unread: number }>("/notifications/unread-count/"),
    refetchInterval: 60_000,
  });
  const unread = data?.unread ?? 0;
  return (
    <Link
      to="/notifications"
      className="relative grid size-10 place-items-center rounded-full bg-white shadow-[var(--shadow-card)]"
      aria-label={unread ? `Notifications, ${unread} non lue(s)` : "Notifications"}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-500 px-1 text-center text-[11px] font-bold text-white">{unread}</span>}
    </Link>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-full px-4 py-2 text-sm font-semibold transition", isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink");

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          <NavLink to="/recherche?transaction_type=RENT" className={linkClass}>Louer</NavLink>
          <NavLink to="/recherche?transaction_type=SALE" className={() => linkClass({ isActive: false })}>Acheter</NavLink>
          <NavLink to="/assistant" className={linkClass}>Assistant IA</NavLink>
          {user && <NavLink to="/tableau-de-bord" className={linkClass}>Mon espace</NavLink>}
          {user?.role === "ADMIN" && <NavLink to="/admin" className={linkClass}>Administration</NavLink>}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <span className="hidden text-sm font-semibold lg:inline">{user.first_name}</span>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
                className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted hover:text-ink md:flex"
              >
                <LogOut className="size-4" aria-hidden /> Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link to="/connexion" className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-brand-700 sm:flex">Connexion</Link>
              <Link to="/inscription" className="flex h-10 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Barre d'onglets flottante mobile, inspirée de la maquette d'accueil. */
export function BottomNav() {
  const { user } = useAuth();
  const items = [
    { to: "/", label: "Accueil", icon: Home, end: true },
    { to: "/recherche", label: "Recherche", icon: Search },
    { to: "/assistant", label: "Assistant", icon: MessageCircle },
    user?.role === "ADMIN"
      ? { to: "/admin", label: "Admin", icon: Shield }
      : { to: "/tableau-de-bord", label: "Espace", icon: LayoutDashboard },
    user ? { to: "/profil", label: "Profil", icon: UserRound } : { to: "/connexion", label: "Connexion", icon: LogIn },
  ];
  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-3 bottom-3 z-40 rounded-full bg-white/95 p-1.5 shadow-[0_8px_30px_rgb(27_27_47/0.18)] backdrop-blur md:hidden">
      <ul className="flex justify-between">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold", isActive ? "bg-brand-50 text-brand-700" : "text-muted")
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-white pb-28 pt-10 md:pb-10">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">Recherche, visite et location ou achat de logements au Sénégal, avec des annonces examinées par notre équipe.</p>
        </div>
        <div>
          <p className="font-semibold">Explorer</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li><Link to="/recherche?transaction_type=RENT" className="hover:text-ink">Logements à louer</Link></li>
            <li><Link to="/recherche?transaction_type=SALE" className="hover:text-ink">Biens à vendre</Link></li>
            <li><Link to="/recherche?verified=true" className="hover:text-ink">Annonces vérifiées</Link></li>
            <li><Link to="/assistant" className="hover:text-ink">Assistant IA</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Propriétaires et agents</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li><Link to="/inscription?role=OWNER" className="hover:text-ink">Publier une annonce</Link></li>
            <li><Link to="/tableau-de-bord" className="hover:text-ink">Mon tableau de bord</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Bon à savoir</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li>Prix affichés en francs CFA (FCFA, XOF).</li>
            <li>Frais de dossier E-Courtier : affichés séparément avant tout paiement.</li>
            <li>Ne versez jamais d'avance hors de la plateforme avant une visite. Signalez toute annonce suspecte.</li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-7xl px-4 text-xs text-muted">© {new Date().getFullYear()} E-Courtier — version 1. Les annonces marquées « démonstration » sont fictives.</p>
    </footer>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <ScrollRestoration />
    </div>
  );
}
