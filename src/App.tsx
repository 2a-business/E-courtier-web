import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppLayout } from "./components/Layout";
import { PageSpinner } from "./components/ui/Spinner";
import { ApiError } from "./lib/api";
import HomePage from "./pages/HomePage";

const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ListingPage = lazy(() => import("./pages/ListingPage"));
const VisitNewPage = lazy(() => import("./pages/VisitNewPage"));
const VisitDetailPage = lazy(() => import("./pages/VisitDetailPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const ApplicationPage = lazy(() => import("./pages/ApplicationPage"));
const ContractPage = lazy(() => import("./pages/ContractPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const ListingEditorPage = lazy(() => import("./pages/dashboard/ListingEditorPage"));
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));
const LoginPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.ResetPasswordPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

const page = (node: ReactNode) => <Suspense fallback={<PageSpinner />}>{node}</Suspense>;
const priv = (node: ReactNode, roles?: Parameters<typeof RequireAuth>[0]["roles"]) => page(<RequireAuth roles={roles}>{node}</RequireAuth>);

export const routes = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/assistant", element: page(<AssistantPage />) },
      { path: "/recherche", element: page(<SearchPage />) },
      { path: "/logements/:id", element: page(<ListingPage />) },
      { path: "/visites/nouveau", element: priv(<VisitNewPage />) },
      { path: "/visites/:id", element: priv(<VisitDetailPage />) },
      { path: "/dossiers/:id", element: priv(<ApplicationPage />) },
      { path: "/paiement", element: priv(<PaymentPage />) },
      { path: "/paiement/:id", element: priv(<PaymentPage />) },
      { path: "/contrats/:id", element: priv(<ContractPage />) },
      { path: "/tableau-de-bord", element: priv(<DashboardPage />) },
      { path: "/tableau-de-bord/annonces/nouvelle", element: priv(<ListingEditorPage />, ["OWNER", "AGENT"]) },
      { path: "/tableau-de-bord/annonces/:id", element: priv(<ListingEditorPage />, ["OWNER", "AGENT", "ADMIN"]) },
      { path: "/admin", element: priv(<AdminPage />, ["ADMIN"]) },
      { path: "/connexion", element: page(<LoginPage />) },
      { path: "/inscription", element: page(<RegisterPage />) },
      { path: "/mot-de-passe-oublie", element: page(<ForgotPasswordPage />) },
      { path: "/reinitialiser-mot-de-passe", element: page(<ResetPasswordPage />) },
      { path: "/profil", element: priv(<ProfilePage />) },
      { path: "/notifications", element: priv(<NotificationsPage />) },
      { path: "*", element: page(<NotFoundPage />) },
    ],
  },
];

const router = createBrowserRouter(routes);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
