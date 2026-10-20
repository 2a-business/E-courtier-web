import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "../auth/RequireAuth";
import { listing, mockFetch, renderRoute } from "../test/utils";
import AdminPage from "./admin/AdminPage";
import { LoginPage, ForgotPasswordPage } from "./AuthPages";
import ContractPage from "./ContractPage";
import DashboardPage from "./dashboard/DashboardPage";
import ListingEditorPage from "./dashboard/ListingEditorPage";
import HomePage from "./HomePage";
import ListingPage from "./ListingPage";
import NotificationsPage from "./NotificationsPage";
import ProfilePage from "./ProfilePage";
import VisitDetailPage from "./VisitDetailPage";

vi.mock("../components/MapView", () => ({ ResultsMap: () => <div>carte</div>, ApproxLocationMap: () => <div>carte</div> }));

const ID = "11111111-1111-1111-1111-111111111111";
const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });
const mkUser = (role: string) => ({ id: role === "OWNER" ? 2 : 1, email: `${role.toLowerCase()}@test.sn`, first_name: "Awa", last_name: "Diop", full_name: "Awa Diop", phone: "+221 77 123 45 67", role, date_joined: "2026-01-01", profile: { agency_name: "", bio: "" } });
const detail = (over = {}) => ({
  ...listing(), description: "Bel appartement lumineux.", address_public: "Près du marché", address_private: null,
  amenities: [{ slug: "balcon", label: "Balcon" }], photos: [{ id: 1, image: "/m/1.jpg", thumbnail: "/m/1t.jpg", width: 1, height: 1, caption: "Séjour", position: 0, is_primary: true }],
  owner: { id: 2, name: "Moussa N.", role: "OWNER", date_joined: "2026-01-01", agency_name: "" }, publication_status: "PUBLISHED",
  verification_status: "APPROVED", is_verified: true, verification: { label: "Annonce vérifiée", disclaimer: "Examen sans garantie juridique." },
  rating: { average: 4, count: 1 }, can_manage: false, created_at: "", updated_at: "", ...over,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function as(role: string, handler: Parameters<typeof mockFetch>[0]) {
  localStorage.setItem("ec-has-session", "1");
  return mockFetch((url, init) => {
    if (url.pathname.endsWith("/auth/refresh/")) return { body: { access: "jeton" } };
    if (url.pathname.endsWith("/auth/me/") && (init.method ?? "GET") === "GET") return { body: mkUser(role) };
    if (url.pathname.endsWith("/notifications/unread-count/")) return { body: { unread: 0 } };
    return handler(url, init);
  });
}

describe("Accueil", () => {
  it("charge les annonces à la une et vérifiées depuis l'API", async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith("/search/locations/")) return { body: [{ city: "Dakar", districts: [{ district: "Mermoz", count: 2 }] }] };
      if (url.pathname.endsWith("/search/listings/")) {
        return url.searchParams.get("featured") ? { body: page([listing({ title: "Villa à la une" })]) } : { body: page([]) };
      }
    });
    const { router } = renderRoute(<HomePage />);
    expect(await screen.findByText("Villa à la une")).toBeInTheDocument();
    expect(await screen.findByText("Aucune annonce n'a encore été vérifiée.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Acheter" }));
    await userEvent.selectOptions(await screen.findByLabelText("Ville ou quartier"), "district:Mermoz");
    await userEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    expect(router.state.location.search).toContain("transaction_type=SALE");
    expect(router.state.location.search).toContain("district=Mermoz");
  });
});

describe("Accueil mobile", () => {
  it("affiche le visuel promotionnel sans formulaire ni second Hero, et garde la recherche sur ordinateur", async () => {
    mockFetch((url) => (url.pathname.endsWith("/search/listings/") ? { body: page([]) } : url.pathname.endsWith("/search/locations/") ? { body: [] } : undefined));
    const { container } = renderRoute(<HomePage />);
    const visual = await screen.findByAltText(/E-Courtier : louez ou achetez sans courir les quartiers/);
    const mobile = visual.closest(".lg\\:hidden") as HTMLElement;
    expect(mobile).not.toBeNull();
    // Image entière (contain), pleine largeur, dimensions réservées (pas de décalage au chargement).
    expect(visual).toHaveClass("w-full", "object-contain");
    expect(visual).toHaveAttribute("width", "1024");
    expect(visual).toHaveAttribute("height", "1536");
    expect(visual).toHaveAttribute("fetchpriority", "high");
    const sources = [...mobile.querySelectorAll("source")];
    expect(sources[0]).toHaveAttribute("media", "(min-width: 1024px)"); // rien n'est téléchargé sur ordinateur
    expect(sources[1].getAttribute("srcset")).toContain("/accueil-mobile-640.webp 640w");
    // Aucun formulaire de recherche dans le rendu mobile ; le formulaire existe dans le Hero ordinateur.
    expect(within(mobile).queryByRole("form")).toBeNull();
    expect(within(mobile).queryByText("Louer")).toBeNull();
    const desktop = screen.getByRole("form", { name: "Recherche rapide" }).closest(".hidden.lg\\:block");
    expect(desktop).not.toBeNull();
    // Un seul titre principal par taille d'écran : sr-only sur mobile, visible sur ordinateur.
    const titles = [...container.querySelectorAll("h1")];
    expect(titles).toHaveLength(2);
    expect(mobile.contains(titles.find((h) => h.classList.contains("sr-only"))!)).toBe(true);
    expect(desktop!.contains(titles.find((h) => !h.classList.contains("sr-only"))!)).toBe(true);
    // Le visuel ordinateur n'est pas téléchargé sur mobile.
    expect(container.querySelector('img[src="/hero-dakar.jpg"]')!.closest("picture")!.querySelector("source")).toHaveAttribute("media", "(max-width: 1023px)");
  });
});

describe("Fiche logement", () => {
  it("affiche le badge, son avertissement, les frais et masque l'adresse exacte", async () => {
    mockFetch((url) => {
      if (url.pathname.includes("/reviews/listings/")) return { body: { results: [{ id: 1, rating: 4, owner_rating: 5, comment: "Conforme", author_name: "Aminata B.", created_at: "2026-10-01" }], can_review: false, owner_rating: { average: 5, count: 1 } } };
      if (url.pathname.endsWith(`/listings/${ID}/`)) return { body: detail() };
    });
    renderRoute(<ListingPage />, { path: "/logements/:id", route: `/logements/${ID}` });
    expect(await screen.findByRole("heading", { level: 1, name: /Fann Hock/ })).toBeInTheDocument();
    expect(screen.getAllByText("Annonce vérifiée").length).toBeGreaterThan(0);
    expect(screen.getByText("Examen sans garantie juridique.")).toBeInTheDocument();
    expect(screen.getByText("5 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText(/communiquée après confirmation/)).toBeInTheDocument();
    expect(await screen.findByText("Conforme")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Planifier une visite/ })).toHaveAttribute("href", `/visites/nouveau?logement=${ID}`);
  });

  it("affiche une page 404 pour une annonce introuvable", async () => {
    mockFetch(() => ({ status: 404, body: { code: "not_found", detail: "Annonce introuvable." } }));
    renderRoute(<ListingPage />, { path: "/logements/:id", route: `/logements/${ID}` });
    expect(await screen.findByText("Annonce introuvable")).toBeInTheDocument();
  });

  it("permet de signaler une annonce une fois connecté", async () => {
    const { calls } = as("CUSTOMER", (url, init) => {
      if (url.pathname.includes("/reviews/listings/")) return { body: { results: [], can_review: true, owner_rating: { average: null, count: 0 } } };
      if (url.pathname.endsWith(`/listings/${ID}/`)) return { body: detail() };
      if (url.pathname.endsWith("/reports/") && init.method === "POST") return { status: 201, body: {} };
    });
    renderRoute(<ListingPage />, { path: "/logements/:id", route: `/logements/${ID}` });
    await userEvent.click(await screen.findByRole("button", { name: /Signaler cette annonce/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer le signalement" }));
    expect(await screen.findByText(/transmis à l'équipe de modération/)).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/reports/"))!.body).toMatchObject({ listing: ID, reason: "FRAUD" });
    expect(screen.getByText("Donnez votre avis sur votre visite")).toBeInTheDocument();
  });
});

const visit = (over = {}) => ({
  id: 3, listing: listing(), slot: { id: 7, starts_at: "2020-10-20T15:00:00Z", ends_at: "2020-10-20T15:45:00Z" }, status: "PENDING",
  status_label: "En attente de confirmation", message: "Bonjour", customer_name: "Awa D.", host_name: "Moussa N.", address: null,
  contact_phone: null, my_role: "host", created_at: "", confirmed_at: null, completed_at: null, cancelled_at: null, cancel_reason: "", ...over,
});

describe("Suivi de visite", () => {
  it("permet à l'hôte de confirmer, puis montre l'adresse", async () => {
    let current = visit();
    as("OWNER", (url, init) => {
      if (url.pathname.endsWith("/visits/3/status/") && init.method === "POST") {
        current = visit({ status: "CONFIRMED", status_label: "Confirmée", address: "Rue 10", contact_phone: "+221 77 000 00 00" });
        return { body: current };
      }
      if (url.pathname.endsWith("/visits/3/")) return { body: current };
    });
    renderRoute(<RequireAuth><VisitDetailPage /></RequireAuth>, { path: "/visites/:id", route: "/visites/3" });
    await userEvent.click(await screen.findByRole("button", { name: "Confirmer la visite" }));
    expect(await screen.findByText("Rue 10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+221 77 000 00 00" })).toBeInTheDocument();
  });

  it("propose au client de constituer son dossier après confirmation", async () => {
    as("CUSTOMER", (url) => (url.pathname.endsWith("/visits/3/") ? { body: visit({ my_role: "customer", status: "CONFIRMED", status_label: "Confirmée", address: "Rue 10" }) } : undefined));
    renderRoute(<RequireAuth><VisitDetailPage /></RequireAuth>, { path: "/visites/:id", route: "/visites/3" });
    // Location : le dossier locatif s'ouvre via l'API ; le paiement Wave reste accessible séparément.
    expect(await screen.findByRole("button", { name: "Constituer mon dossier" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ouvrir le dossier de paiement" })).toHaveAttribute("href", `/paiement?logement=${ID}`);
  });
});

const contract = (over = {}) => ({
  id: "c1", reference: "EC-1", transaction_id: "t1", listing_title: "Appartement test", status: "PENDING_SIGNATURE", status_label: "En attente de signature",
  is_simulated: true, special_terms: "", current_version: { number: 2, content: "CONTRAT DE BAIL", content_sha256: "abc", created_at: "2026-10-14T10:00:00Z" },
  signatures: [], my_role: "CUSTOMER", i_signed: false, legal_notice: "Signature électronique simple, non qualifiée.", created_at: "", sent_at: null, signed_at: null, cancel_reason: "", ...over,
});

describe("Contrat", () => {
  it("exige le consentement et signe la version affichée", async () => {
    const { calls } = as("CUSTOMER", (url, init) => {
      if (url.pathname.endsWith("/contracts/c1/sign/") && init.method === "POST") {
        return { body: contract({ i_signed: true, signatures: [{ role: "CUSTOMER", signer_name: "Awa Diop", version_number: 2, signed_sha256: "abc", signed_at: "2026-10-14T11:00:00Z" }] }) };
      }
      if (url.pathname.endsWith("/contracts/c1/")) return { body: contract() };
    });
    renderRoute(<RequireAuth><ContractPage /></RequireAuth>, { path: "/contrats/:id", route: "/contrats/c1" });
    expect(await screen.findByText(/paiement simulé/)).toBeInTheDocument();
    expect(screen.getByText("Signature électronique simple, non qualifiée.")).toBeInTheDocument();
    const sign = screen.getByRole("button", { name: "Signer" });
    expect(sign).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(sign);
    expect(await screen.findByText("Awa Diop")).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/sign/"))!.body).toEqual({ version_number: 2, consent: true });
  });
});

describe("Tableau de bord", () => {
  it("montre les statistiques propriétaire", async () => {
    as("OWNER", (url) => {
      if (url.pathname.endsWith("/listings/mine/stats/")) {
        return { body: { listings_total: 3, listings_by_status: { PUBLISHED: 2 }, listings_by_verification: { APPROVED: 1 }, visits_pending: 4, visits_upcoming: 1, visits_completed: 0, transactions_pending: 0, transactions_paid: 1, transactions_paid_simulated: 2, reviews_count: 1, reviews_average: 4.5, visit_requests_daily: [{ date: "2026-10-13", count: 1 }, { date: "2026-10-14", count: 3 }] } };
      }
    });
    renderRoute(<RequireAuth><DashboardPage /></RequireAuth>, { path: "/tableau-de-bord", route: "/tableau-de-bord" });
    expect(await screen.findByText("Visites à confirmer")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("+ 2 simulé(s)")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Demandes de visite par jour/ })).toBeInTheDocument();
  });

  it("liste les annonces et publie un brouillon", async () => {
    const owned = { ...listing(), publication_status: "DRAFT", verification_status: "NOT_SUBMITTED", visits_pending: 1, reports_open: 0, created_at: "2026-10-01" };
    const { calls } = as("OWNER", (url, init) => {
      if (url.pathname.endsWith("/listings/mine/")) return { body: page([owned]) };
      if (url.pathname.endsWith("/publication/") && init.method === "POST") return { body: {} };
    });
    renderRoute(<RequireAuth><DashboardPage /></RequireAuth>, { path: "/tableau-de-bord", route: "/tableau-de-bord?onglet=annonces" });
    expect(await screen.findByText("1 visite(s) à confirmer")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith("/publication/"))).toBe(true));
  });

  it("affiche les visites, dossiers et contrats d'un client", async () => {
    as("CUSTOMER", (url) => {
      if (url.pathname.endsWith("/visits/")) return { body: [visit({ my_role: "customer" })] };
      if (url.pathname.endsWith("/transactions/")) return { body: [{ id: "t1", reference: "EC-9", listing: listing(), total_amount: 285000, status: "PAID", status_label: "Payée", is_simulated: true, customer_name: "" }] };
      if (url.pathname.endsWith("/contracts/")) return { body: [contract()] };
    });
    const { router } = renderRoute(<RequireAuth><DashboardPage /></RequireAuth>, { path: "/tableau-de-bord", route: "/tableau-de-bord" });
    expect(await screen.findByText("À venir")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("tab", { name: "Mes dossiers" })[0]);
    expect(await screen.findByText("Payée (simulation)")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("tab", { name: "Mes contrats" })[0]);
    expect(await screen.findByText("Simulation")).toBeInTheDocument();
    expect(router.state.location.search).toContain("onglet=contrats");
  });
});

describe("Éditeur d'annonce", () => {
  it("valide le formulaire puis crée un brouillon", async () => {
    const { calls } = as("OWNER", (url, init) => {
      if (url.pathname.endsWith("/amenities/")) return { body: [{ slug: "balcon", label: "Balcon" }] };
      if (url.pathname.endsWith("/listings/") && init.method === "POST") return { status: 201, body: detail({ id: "new" }) };
    });
    const { router } = renderRoute(<RequireAuth><ListingEditorPage /></RequireAuth>, { path: "/tableau-de-bord/annonces/nouvelle", route: "/tableau-de-bord/annonces/nouvelle" });
    await userEvent.click(await screen.findByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByText("5 caractères minimum.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Titre"), "Studio meublé à Mermoz");
    await userEvent.type(screen.getByLabelText("Prix (FCFA)"), "150000");
    await userEvent.type(screen.getByLabelText("Quartier"), "Mermoz");
    await userEvent.type(screen.getByLabelText("Description"), "Studio calme proche des commerces et des transports.");
    await userEvent.click(await screen.findByRole("button", { name: "Balcon" }));
    await userEvent.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    await waitFor(() => expect(router.state.location.pathname).not.toContain("nouvelle"));
    expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/listings/"))!.body).toMatchObject({ title: "Studio meublé à Mermoz", price: 150000, amenities: ["balcon"], latitude: null });
  });

  it("gère photos, créneaux et justificatifs d'une annonce existante", async () => {
    as("OWNER", (url) => {
      if (url.pathname.endsWith("/amenities/")) return { body: [] };
      if (url.pathname.endsWith(`/listings/${ID}/`)) return { body: detail({ can_manage: true, verification_status: "REJECTED", is_verified: false }) };
      if (url.pathname.endsWith("/visits/manage/slots/")) return { body: [{ id: 1, starts_at: "2026-10-20T09:00:00Z", ends_at: "2026-10-20T09:45:00Z", booked: true, is_active: true }] };
      if (url.pathname.endsWith("/documents/")) return { body: [{ id: 5, doc_type: "ID_CARD", doc_type_label: "Carte nationale d'identité", original_name: "cni.pdf", content_type: "application/pdf", size: 2048, uploaded_at: "", submitted: false }] };
      if (url.pathname.endsWith("/requests/")) return { body: [{ id: 1, status: "REJECTED", submitted_at: "2026-10-01", decided_at: "2026-10-02", decided_by_name: "Admin", decision_reason: "Titre illisible", documents: [] }] };
    });
    renderRoute(<RequireAuth><ListingEditorPage /></RequireAuth>, { path: "/tableau-de-bord/annonces/:id", route: `/tableau-de-bord/annonces/${ID}` });
    expect(await screen.findByText("Principale")).toBeInTheDocument();
    expect(await screen.findByText("Réservé")).toBeInTheDocument();
    expect(await screen.findByText(/Titre illisible/)).toBeInTheDocument();
    expect(screen.getByText(/cni.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Soumettre à la vérification" })).toBeEnabled();
  });
});

describe("Administration", () => {
  const stats = { users_total: 5, users_by_role: {}, listings_published: 14, listings_suspended: 0, verifications_pending: 2, reports_open: 1, transactions_pending: 1, transactions_to_check: 1, transactions_paid: 0, transactions_paid_simulated: 1, fees_collected_real: 0, listings_daily: [], visits_daily: [{ date: "2026-10-14", count: 2 }], verified_ratio: 0.43 };
  const verifStats = { listings_by_status: { APPROVED: 6, PENDING: 2, REJECTED: 0, NOT_SUBMITTED: 6 }, documents_by_type: [{ label: "Titre foncier", count: 4 }], documents_total: 4, recent_uploads: [] };

  function admin(extra: Parameters<typeof mockFetch>[0] = () => undefined) {
    return as("ADMIN", (url, init) => {
      if (url.pathname.endsWith("/admin/dashboard/")) return { body: stats };
      if (url.pathname.endsWith("/admin/verifications/stats/")) return { body: verifStats };
      if (url.pathname.endsWith("/admin/assistant/usage/")) return { body: { llm_requests: 0, llm_requests_limit: 120, provider_calls: 0, provider_calls_limit: 200, tokens_in: 0, tokens_out: 0, provider: "rules", model: "", recent_errors: 0, latency_p50_ms: null } };
      return extra(url, init);
    });
  }

  it("affiche le tableau de bord et les jauges", async () => {
    admin();
    renderRoute(<RequireAuth><AdminPage /></RequireAuth>, { path: "/admin", route: "/admin" });
    expect(await screen.findByText("Vérifications en attente")).toBeInTheDocument();
    expect(screen.getByText("43 % des annonces publiées sont vérifiées")).toBeInTheDocument();
    expect(await screen.findByText("Titre foncier")).toBeInTheDocument();
  });

  it("exige un motif pour rejeter et approuve une demande", async () => {
    const request = { id: 9, status: "PENDING", submitted_at: "2026-10-14", decided_at: null, decided_by_name: null, decision_reason: "", listing: listing(), submitted_by: { id: 2, name: "Moussa", email: "m@test.sn", role: "OWNER" }, documents: [{ id: 1, doc_type: "ID_CARD", doc_type_label: "CNI", original_name: "", content_type: "", size: 10, uploaded_at: "", submitted: true }] };
    const { calls } = admin((url, init) => {
      if (url.pathname.endsWith("/admin/verifications/") ) return { body: page([request]) };
      if (url.pathname.endsWith("/decision/") && init.method === "POST") return { body: {} };
    });
    renderRoute(<RequireAuth><AdminPage /></RequireAuth>, { path: "/admin", route: "/admin?onglet=verifications" });
    const card = (await screen.findByText(/soumise le/)).closest("li")!;
    expect(within(card).getByRole("button", { name: "Rejeter" })).toBeDisabled();
    await userEvent.click(within(card).getByRole("button", { name: "Approuver" }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/decision/"))!.body).toEqual({ approve: true, reason: "" }));
  });

  it("confirme un paiement avec la référence Wave déclarée", async () => {
    const tx = { id: "t1", reference: "EC-1", listing: listing(), amount: 1, amount_kind_label: "Premier mois", fee_amount: 5000, total_amount: 5001, status: "PENDING", status_label: "En attente", is_simulated: false, customer_name: "Awa", created_at: "2026-10-14", attempts: [{ id: 1, provider: "WAVE_LINK", status: "CUSTOMER_DECLARED", status_label: "", provider_reference: "T_ABCDEF12", is_simulated: false, created_at: "" }] };
    const { calls } = admin((url, init) => {
      if (url.pathname.endsWith("/admin/transactions/")) return { body: page([tx]) };
      if (url.pathname.endsWith("/confirm/") && init.method === "POST") return { body: {} };
    });
    renderRoute(<RequireAuth><AdminPage /></RequireAuth>, { path: "/admin", route: "/admin?onglet=paiements" });
    await userEvent.click(await screen.findByRole("button", { name: "Confirmer le paiement" }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/confirm/"))!.body).toEqual({ provider_reference: "T_ABCDEF12" }));
  });

  it("affiche signalements, annonces, comptes, avis et journal", async () => {
    admin((url) => {
      if (url.pathname.endsWith("/admin/reports/")) return { body: page([{ id: 1, listing: ID, listing_title: "Annonce signalée", listing_status: "PUBLISHED", reason_label: "Fraude", details: "Avance demandée", status: "OPEN", reporter_email: "a@b.sn", created_at: "2026-10-14", resolution_note: "" }]) };
      if (url.pathname.endsWith("/admin/listings/")) return { body: page([{ ...listing({ title: "Annonce modérée" }), publication_status: "PUBLISHED", verification_status: "APPROVED", visits_pending: 0, reports_open: 1, created_at: "" }]) };
      if (url.pathname.endsWith("/admin/users/")) return { body: page([{ id: 4, email: "x@y.sn", first_name: "X", last_name: "Y", phone: "", role: "CUSTOMER", is_active: true, date_joined: "2026-10-01", last_login: null }]) };
      if (url.pathname.endsWith("/admin/reviews/")) return { body: page([{ id: 1, rating: 2, comment: "Bof", author_name: "Z", listing_title: "L", status: "PUBLISHED", created_at: "" }]) };
      if (url.pathname.endsWith("/admin/audit-log/")) return { body: page([{ id: 1, actor_email: "admin@x.sn", action: "verification.approved", target_type: "verification.verificationrequest", target_id: "9", metadata: { listing: "abc" }, created_at: "2026-10-14" }]) };
    });
    renderRoute(<RequireAuth><AdminPage /></RequireAuth>, { path: "/admin", route: "/admin?onglet=signalements" });
    expect(await screen.findByText("Avance demandée")).toBeInTheDocument();
    for (const [tab, text] of [["Annonces", "Annonce modérée"], ["Comptes", "x@y.sn"], ["Avis", /Bof/], ["Journal", "verification.approved"]] as const) {
      await userEvent.click(screen.getByRole("tab", { name: tab }));
      expect(await screen.findByText(text)).toBeInTheDocument();
    }
  });
});

describe("Connexion et compte", () => {
  it("connecte puis redirige selon le rôle", async () => {
    mockFetch((url) => (url.pathname.endsWith("/auth/login/") ? { body: { access: "a", user: mkUser("OWNER") } } : undefined));
    const { router } = renderRoute(<LoginPage />, { path: "/connexion", route: "/connexion" });
    await userEvent.type(await screen.findByLabelText("Adresse e-mail"), "owner@test.sn");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/tableau-de-bord"));
  });

  it("refuse une redirection externe après connexion", async () => {
    mockFetch((url) => (url.pathname.endsWith("/auth/login/") ? { body: { access: "a", user: mkUser("CUSTOMER") } } : undefined));
    const { router } = renderRoute(<LoginPage />, { path: "/connexion", route: "/connexion?suite=//evil.example" });
    await userEvent.type(await screen.findByLabelText("Adresse e-mail"), "c@test.sn");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("affiche l'erreur d'identifiants", async () => {
    mockFetch(() => ({ status: 401, body: { code: "not_authenticated", detail: "Adresse e-mail ou mot de passe incorrect." } }));
    renderRoute(<LoginPage />, { path: "/connexion", route: "/connexion" });
    await userEvent.type(await screen.findByLabelText("Adresse e-mail"), "c@test.sn");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "faux");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Adresse e-mail ou mot de passe incorrect.")).toBeInTheDocument();
  });

  it("demande de réinitialisation", async () => {
    mockFetch(() => ({ status: 202, body: { detail: "Si un compte correspond à cette adresse, un lien a été envoyé." } }));
    renderRoute(<ForgotPasswordPage />, { path: "/mdp", route: "/mdp" });
    await userEvent.type(await screen.findByLabelText("Adresse e-mail"), "c@test.sn");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    expect(await screen.findByText(/un lien a été envoyé/)).toBeInTheDocument();
  });

  it("met à jour le profil et liste les notifications", async () => {
    const { calls } = as("OWNER", (url, init) => {
      if (url.pathname.endsWith("/auth/me/") && init.method === "PATCH") return { body: mkUser("OWNER") };
      if (url.pathname.endsWith("/notifications/")) return { body: page([{ id: 1, kind: "x", title: "Visite confirmée", body: "Demain", link: "/visites/1", read_at: null, sms_status: "LOGGED_NOT_SENT", created_at: "2026-10-14" }]) };
    });
    renderRoute(<RequireAuth><ProfilePage /></RequireAuth>, { path: "/profil", route: "/profil" });
    await userEvent.clear(await screen.findByLabelText("Prénom"));
    await userEvent.type(screen.getByLabelText("Prénom"), "Moussa");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Profil enregistré.")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ first_name: "Moussa" });
  });

  it("indique honnêtement qu'un SMS n'a pas été envoyé", async () => {
    as("CUSTOMER", (url) => (url.pathname.endsWith("/notifications/") ? { body: page([{ id: 1, kind: "x", title: "Visite confirmée", body: "Demain", link: "", read_at: null, sms_status: "LOGGED_NOT_SENT", created_at: "2026-10-14" }]) } : undefined));
    renderRoute(<RequireAuth><NotificationsPage /></RequireAuth>, { path: "/notifications", route: "/notifications" });
    expect(await screen.findByText("SMS non envoyé (environnement de développement)")).toBeInTheDocument();
  });
});
