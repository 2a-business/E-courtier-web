import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "../auth/RequireAuth";
import { listing, mockFetch, renderRoute } from "../test/utils";
import AssistantPage from "./AssistantPage";
import { RegisterPage } from "./AuthPages";
import PaymentPage from "./PaymentPage";
import SearchPage from "./SearchPage";
import VisitNewPage from "./VisitNewPage";

vi.mock("../components/MapView", () => ({ ResultsMap: () => <div>carte</div>, ApproxLocationMap: () => <div>carte</div> }));

const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const user = { id: 1, email: "client@test.sn", first_name: "Awa", last_name: "Diop", full_name: "Awa Diop", phone: "", role: "CUSTOMER", date_joined: "2026-01-01" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function loggedIn(handler: Parameters<typeof mockFetch>[0]) {
  localStorage.setItem("ec-has-session", "1");
  return mockFetch((url, init) => {
    if (url.pathname.endsWith("/auth/refresh/")) return { body: { access: "jeton" } };
    if (url.pathname.endsWith("/auth/me/")) return { body: user };
    return handler(url, init);
  });
}

describe("Inscription", () => {
  it("valide les champs et ne propose jamais le rôle administrateur", async () => {
    mockFetch(() => undefined);
    renderRoute(<RegisterPage />, { path: "/inscription", route: "/inscription" });
    expect(await screen.findByText("Je cherche un logement")).toBeInTheDocument();
    expect(screen.queryByText(/administrateur/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByText("Prénom requis.")).toBeInTheDocument();
    expect(screen.getByText("Vous devez accepter les conditions d'utilisation.")).toBeInTheDocument();
  });

  it("envoie le rôle choisi et affiche l'erreur serveur", async () => {
    const { calls } = mockFetch((url) => url.pathname.endsWith("/auth/register/")
      ? { status: 400, body: { code: "email_taken", detail: "Un compte existe déjà avec cette adresse e-mail." } }
      : undefined);
    renderRoute(<RegisterPage />, { path: "/inscription", route: "/inscription?role=OWNER" });
    await userEvent.type(await screen.findByLabelText("Prénom"), "Awa");
    await userEvent.type(screen.getByLabelText("Nom"), "Diop");
    await userEvent.type(screen.getByLabelText("Adresse e-mail"), "awa@test.sn");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "Teranga-2026");
    await userEvent.type(screen.getByLabelText("Confirmer le mot de passe"), "Teranga-2026");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(await screen.findByText("Un compte existe déjà avec cette adresse e-mail.")).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/auth/register/"))!.body).toMatchObject({ role: "OWNER", email: "awa@test.sn" });
  });
});

describe("Garde de navigation", () => {
  it("redirige un visiteur anonyme vers la connexion", async () => {
    mockFetch(() => undefined);
    renderRoute(<RequireAuth><p>Secret</p></RequireAuth>, { path: "/tableau-de-bord", route: "/tableau-de-bord" });
    expect(await screen.findByText("Autre page")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });
  it("refuse un rôle non autorisé", async () => {
    loggedIn(() => undefined);
    renderRoute(<RequireAuth roles={["ADMIN"]}><p>Admin</p></RequireAuth>, { path: "/admin", route: "/admin" });
    expect(await screen.findByText("Accès non autorisé")).toBeInTheDocument();
  });
});

describe("Recherche", () => {
  it("affiche les résultats de l'API et l'état vide", async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith("/amenities/")) return { body: [] };
      if (url.pathname.endsWith("/search/listings/")) {
        return url.searchParams.get("district") === "Nulle-part"
          ? { body: { count: 0, next: null, previous: null, results: [] } }
          : { body: { count: 1, next: null, previous: null, results: [listing()] } };
      }
    });
    renderRoute(<SearchPage />, { path: "/recherche", route: "/recherche?transaction_type=RENT" });
    expect(await screen.findByText("1 résultat")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Logements à louer/ })).toBeInTheDocument();
  });
  it("affiche une erreur compréhensible", async () => {
    mockFetch((url) => (url.pathname.endsWith("/search/listings/") ? { status: 400, body: { code: "validation_error", detail: "x", errors: { price_max: ["Le prix maximum doit être supérieur au minimum."] } } } : { body: [] }));
    renderRoute(<SearchPage />, { path: "/recherche", route: "/recherche?price_min=9&price_max=1" });
    expect(await screen.findByText("Le prix maximum doit être supérieur au minimum.")).toBeInTheDocument();
  });
});

describe("Assistant", () => {
  it("affiche la réponse et uniquement les annonces renvoyées par l'API", async () => {
    const { calls } = mockFetch((url) => {
      if (url.pathname.endsWith("/assistant/info/")) return { body: { llm_enabled: false, suggestions: ["Studio à Mermoz"], max_message_chars: 500 } };
      if (url.pathname.endsWith("/assistant/chat/")) {
        return { body: { conversation_id: "c1", reply: "Voici 1 logement publié correspondant.", criteria: {}, results: [listing()], alternatives: [], mode: "rules", remaining_today: 9 } };
      }
    });
    renderRoute(<AssistantPage />, { path: "/assistant", route: "/assistant" });
    await userEvent.type(screen.getByLabelText("Votre message"), "F3 Fann Hock");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Voici 1 logement publié correspondant.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Appartement 3 pièces à Fann Hock/ })).toHaveAttribute("href", `/logements/${LISTING_ID}`);
    expect(calls.find((c) => c.path.endsWith("/assistant/chat/"))!.body).toMatchObject({ message: "F3 Fann Hock" });
    expect(screen.getByText(/Mode simplifié/)).toBeInTheDocument();
    expect(screen.getByText("Analyse simplifiée par règles (sans IA)")).toBeInTheDocument();
  });
  it("n'attribue à l'IA que les réponses réellement analysées par le fournisseur", async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith("/assistant/info/")) return { body: { llm_enabled: true, provider: "gemini", suggestions: [], max_message_chars: 500 } };
      if (url.pathname.endsWith("/assistant/chat/")) {
        return { body: { conversation_id: "c1", reply: "Aucune annonce. (Assistant IA momentanément indisponible : analyse simplifiée de votre demande.)", criteria: {}, results: [], alternatives: [], mode: "fallback", remaining_today: 9 } };
      }
    });
    renderRoute(<AssistantPage />, { path: "/assistant", route: "/assistant" });
    await userEvent.type(screen.getByLabelText("Votre message"), "villa{enter}");
    expect(await screen.findByText("IA indisponible : analyse simplifiée par règles")).toBeInTheDocument();
    expect(screen.queryByText("Critères analysés par l'IA")).not.toBeInTheDocument();
  });
  it("explique le dépassement de quota", async () => {
    mockFetch((url) => url.pathname.endsWith("/assistant/chat/")
      ? { status: 429, body: { code: "assistant_quota_exceeded", detail: "Vous avez atteint la limite quotidienne de l'assistant." } }
      : { body: { llm_enabled: true, suggestions: [], max_message_chars: 500 } });
    renderRoute(<AssistantPage />, { path: "/assistant", route: "/assistant" });
    await userEvent.type(screen.getByLabelText("Votre message"), "villa{enter}");
    expect(await screen.findByText(/limite quotidienne/)).toBeInTheDocument();
  });
});

describe("Réservation de visite", () => {
  const slot = { id: 7, starts_at: "2026-10-20T15:00:00Z", ends_at: "2026-10-20T15:45:00Z" };
  const detail = { ...listing(), description: "", address_public: "", address_private: null, amenities: [], photos: [], owner: { id: 2, name: "Moussa N.", role: "OWNER", date_joined: "2026-01-01", agency_name: "" }, publication_status: "PUBLISHED", verification_status: "NOT_SUBMITTED", verification: { label: null, disclaimer: null }, rating: { average: null, count: 0 }, can_manage: false, created_at: "", updated_at: "" };

  it("réserve un créneau et affiche la confirmation", async () => {
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith(`/listings/${LISTING_ID}/`)) return { body: detail };
      if (url.pathname.endsWith("/visits/slots/")) return { body: [slot] };
      if (url.pathname.endsWith("/visits/") && init.method === "POST") {
        return { status: 201, body: { id: 3, listing: listing(), slot, status: "PENDING", status_label: "En attente de confirmation", message: "", customer_name: "Awa D.", host_name: "Moussa N.", address: null, contact_phone: null, my_role: "customer" } };
      }
    });
    renderRoute(<VisitNewPage />, { path: "/visites/nouveau", route: `/visites/nouveau?logement=${LISTING_ID}` });
    const confirm = await screen.findByRole("button", { name: /Confirmer la réservation/ });
    expect(confirm).toBeDisabled();
    await userEvent.click(await screen.findByRole("button", { name: "15:00" }));
    await userEvent.click(confirm);
    expect(await screen.findByRole("heading", { name: "Demande envoyée !" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/visits/"))!.body).toMatchObject({ slot_id: 7 });
  });

  it("rafraîchit les créneaux si le créneau vient d'être pris", async () => {
    let slotCalls = 0;
    loggedIn((url, init) => {
      if (url.pathname.endsWith(`/listings/${LISTING_ID}/`)) return { body: detail };
      if (url.pathname.endsWith("/visits/slots/")) {
        slotCalls += 1;
        return { body: [slot] };
      }
      if (url.pathname.endsWith("/visits/") && init.method === "POST") return { status: 409, body: { code: "slot_taken", detail: "Ce créneau vient d'être réservé. Choisissez-en un autre." } };
    });
    renderRoute(<VisitNewPage />, { path: "/visites/nouveau", route: `/visites/nouveau?logement=${LISTING_ID}` });
    await userEvent.click(await screen.findByRole("button", { name: "15:00" }));
    await userEvent.click(screen.getByRole("button", { name: /Confirmer la réservation/ }));
    expect(await screen.findByText(/vient d'être réservé/)).toBeInTheDocument();
    await waitFor(() => expect(slotCalls).toBe(2));
  });
});

describe("Paiement", () => {
  const tx = (over: object) => ({
    id: "t1", reference: "EC-261014-ABC123", listing: listing(), amount: 280000, amount_kind: "FIRST_MONTH_RENT", amount_kind_label: "Premier mois de loyer",
    fee_amount: 5000, total_amount: 285000, currency: "XOF", status: "PENDING", status_label: "En attente de paiement", provider: "WAVE_LINK",
    provider_label: "Wave", is_simulated: false, customer_name: "Awa Diop", paid_at: null, created_at: "2026-10-14T10:00:00Z", contract: null, events: [], attempts: [], ...over,
  });
  const config = { wave_configured: true, simulation_enabled: true, dossier_fee: 5000, escrow_supported: false };

  it("affiche les frais séparément et l'état en attente (non payé)", async () => {
    loggedIn((url) => (url.pathname.endsWith("/transactions/config/") ? { body: config } : url.pathname.endsWith("/transactions/t1/") ? { body: tx({}) } : undefined));
    renderRoute(<PaymentPage />, { path: "/paiement/:id", route: "/paiement/t1" });
    expect(await screen.findByText("En attente — non payé.")).toBeInTheDocument();
    expect(screen.getByText("280 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("5 000 FCFA")).toBeInTheDocument();
    expect(screen.getAllByText("285 000 FCFA").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Payer avec Wave/ })).toBeInTheDocument();
    expect(screen.getByText(/ne vous demandera jamais votre code secret/)).toBeInTheDocument();
    // Tant que Wave n'a pas été ouvert, aucune déclaration de paiement n'est proposée.
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).not.toBeInTheDocument();
    expect(screen.getByText(/Après avoir payé dans Wave/)).toBeInTheDocument();
  });

  it("propose la déclaration une fois le paiement Wave démarré", async () => {
    const started = tx({ attempts: [{ id: 1, provider: "WAVE_LINK", status: "INITIATED", status_label: "Redirigé", provider_reference: "", is_simulated: false, created_at: "2026-10-14T10:05:00Z" }] });
    loggedIn((url) => (url.pathname.endsWith("/transactions/config/") ? { body: config } : url.pathname.endsWith("/transactions/t1/") ? { body: started } : undefined));
    renderRoute(<PaymentPage />, { path: "/paiement/:id", route: "/paiement/t1" });
    expect(await screen.findByRole("button", { name: "Déclarer mon paiement" })).toBeInTheDocument();
  });

  it("n'offre ni paiement ni déclaration sans lien marchand", async () => {
    loggedIn((url) => (url.pathname.endsWith("/transactions/config/") ? { body: { ...config, wave_configured: false, simulation_enabled: false } } : url.pathname.endsWith("/transactions/t1/") ? { body: tx({}) } : undefined));
    renderRoute(<PaymentPage />, { path: "/paiement/:id", route: "/paiement/t1" });
    expect(await screen.findByText(/n'est pas configuré sur cet environnement/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Payer avec Wave/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Déclarer mon paiement" })).not.toBeInTheDocument();
  });

  it("distingue clairement un paiement simulé", async () => {
    const simulated = tx({ status: "PAID", status_label: "Payée", is_simulated: true, provider: "SIMULATION", paid_at: "2026-10-14T11:00:00Z" });
    loggedIn((url, init) => {
      if (url.pathname.endsWith("/transactions/config/")) return { body: config };
      if (url.pathname.endsWith("/transactions/t1/simulate/") && init.method === "POST") return { body: simulated };
      if (url.pathname.endsWith("/transactions/t1/")) return { body: tx({}) };
    });
    renderRoute(<PaymentPage />, { path: "/paiement/:id", route: "/paiement/t1" });
    await userEvent.click(await screen.findByRole("button", { name: "Simuler le paiement" }));
    expect(await screen.findByText("Paiement SIMULÉ")).toBeInTheDocument();
    expect(screen.getByText(/aucun argent n'a circulé/)).toBeInTheDocument();
    expect(screen.getByText("Payée (simulation)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Payer avec Wave/ })).not.toBeInTheDocument();
  });
});
