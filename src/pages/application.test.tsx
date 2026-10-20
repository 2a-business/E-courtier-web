import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApplicationFee, RentalApplication } from "../lib/types";
import { listing, mockFetch, renderRoute } from "../test/utils";
import AdminPage from "./admin/AdminPage";
import ApplicationPage from "./ApplicationPage";
import VisitDetailPage from "./VisitDetailPage";

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

function fee(over: Partial<ApplicationFee> = {}): ApplicationFee {
  return {
    status: "PENDING", status_label: "À payer", amount: 5000, currency: "XOF", reference: "DL-1A2B3C4D", provider_reference: "",
    declared_at: null, confirmed_at: null, failure_reason: "", started: false, can_pay: true, payment_problem: null, ...over,
  };
}

function application(over: Partial<RentalApplication> = {}): RentalApplication {
  return {
    id: "a1", listing: listing(), visit: 7, status: "DRAFT", status_label: "Brouillon", state: "INCOMPLETE", customer_name: "Awa D.",
    submitted_at: null, decided_at: null, updated_at: "2026-10-19T10:00:00Z",
    profession: "", employer: "", monthly_income_xof: null, household_size: null, move_in_date: null, has_guarantor: false,
    guarantor_name: "", message: "", consent_accepted_at: null, first_submitted_at: null, info_request_message: "", decision_reason: "",
    documents: [], events: [{ event: "created", from_status: "", to_status: "DRAFT", note: "", actor_name: "Awa D.", created_at: "2026-10-19T10:00:00Z" }],
    requirements: {
      required_documents: [{ types: ["ID_CARD", "PASSPORT"], label: "Carte nationale d'identité ou Passeport", satisfied: false }],
      optional_documents: [{ type: "INCOME_PROOF", label: "Justificatif de revenus", provided: false }],
      missing_documents: ["Carte nationale d'identité ou Passeport"], missing_fields: ["Profession"], is_complete: false,
      accepted_formats: ["PDF", "JPEG", "PNG"], max_document_size_mb: 8,
    },
    payment: { fee_amount: 5000, currency: "XOF", wave_configured: true, fee: fee({ status: "NOT_STARTED", status_label: "Dû après la transmission du dossier", reference: null }), transaction: null },
    my_role: "customer", internal_notes: null, can_edit: true,
    responsible: { name: "Moussa S.", role: "AGENT", role_label: "Agent immobilier", agency_name: "Teranga Immo" },
    visit_starts_at: "2026-10-18T10:00:00Z",
    ...over,
  };
}

const complete = (over: Partial<RentalApplication> = {}) => application({
  state: "READY", profession: "Comptable", monthly_income_xof: 650000, household_size: 2, move_in_date: "2026-12-01",
  documents: [{ id: 3, doc_type: "ID_CARD", doc_type_label: "Carte nationale d'identité", original_name: "cni.pdf", content_type: "application/pdf", size: 2048, uploaded_at: "2026-10-19T10:05:00Z", submitted: false }],
  requirements: { ...application().requirements, required_documents: [{ types: ["ID_CARD", "PASSPORT"], label: "Carte nationale d'identité ou Passeport", satisfied: true }], missing_documents: [], missing_fields: [], is_complete: true },
  ...over,
});

describe("Dossier locatif — candidat", () => {
  it("empêche la transmission d'un dossier incomplet et indique ce qui manque", async () => {
    loggedIn((url) => (url.pathname.endsWith("/applications/a1/") ? { body: application() } : undefined));
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect(await screen.findByText(/Dossier incomplet. À compléter : Carte nationale d'identité ou Passeport, Profession/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /J'accepte que mes informations/ }));
    expect(screen.getByRole("button", { name: "Transmettre au propriétaire ou à l'agent" })).toBeDisabled();
    expect(screen.getByText(/Brouillon privé/)).toBeInTheDocument();
  });

  it("exige le consentement puis transmet explicitement le dossier", async () => {
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith("/applications/a1/submit/") && init.method === "POST") {
        return { body: complete({ status: "SUBMITTED", status_label: "Transmis", state: "SUBMITTED", can_edit: false, submitted_at: "2026-10-19T11:00:00Z" }) };
      }
      if (url.pathname.endsWith("/applications/a1/")) return { body: complete() };
    });
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    const send = await screen.findByRole("button", { name: "Transmettre au propriétaire ou à l'agent" });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /J'accepte que mes informations/ }));
    await userEvent.click(send);
    expect(await screen.findByText(/Transmis le/)).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/submit/"))!.body).toEqual({ consent: true });
    expect(screen.queryByRole("button", { name: /Transmettre/ })).not.toBeInTheDocument();
  });

  it("affiche la demande de complément et l'état réel du paiement", async () => {
    loggedIn((url) => (url.pathname.endsWith("/applications/a1/") ? {
      body: complete({
        status: "INFO_REQUESTED", status_label: "Complément demandé", state: "INFO_REQUESTED", info_request_message: "Ajoutez un justificatif de revenus.",
        payment: {
          fee_amount: 5000, currency: "XOF", wave_configured: false,
          fee: fee({ can_pay: false, payment_problem: "Le paiement Wave n'est pas configuré sur cet environnement." }),
          transaction: { id: "t1", reference: "EC-1", status: "PENDING", status_label: "En attente de paiement", total_amount: 280000, fee_amount: 0, is_simulated: false, paid_at: null },
        },
      }),
    } : undefined));
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect(await screen.findByText("Ajoutez un justificatif de revenus.")).toBeInTheDocument();
    expect(screen.getByText(/Non payé tant que E-Courtier n'a pas vérifié le paiement/)).toBeInTheDocument();
    expect(screen.getByText(/Le paiement Wave n'est pas configuré/)).toBeInTheDocument();
    expect(screen.getByText("Transmettre le complément")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transmettre au propriétaire ou à l'agent" })).toBeInTheDocument();
  });
});

describe("Dossier locatif — propriétaire ou agent", () => {
  it("affiche le dossier transmis, les notes internes et les décisions", async () => {
    const received = complete({ status: "SUBMITTED", status_label: "Transmis", state: "SUBMITTED", my_role: "responsible", can_edit: false, internal_notes: [], submitted_at: "2026-10-19T11:00:00Z" });
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith("/applications/a1/decision/") && init.method === "POST") {
        return { body: { ...received, status: "REJECTED", status_label: "Refusé", state: "REJECTED", decision_reason: "Revenus insuffisants", decided_at: "2026-10-19T12:00:00Z" } };
      }
      if (url.pathname.endsWith("/applications/a1/")) return { body: received };
    });
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect(await screen.findByText("Candidat : Awa D.")).toBeInTheDocument();
    expect(screen.getByText("Notes internes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Déposer/ })).not.toBeInTheDocument();
    const reject = screen.getByRole("button", { name: "Refuser le dossier" });
    expect(reject).toBeDisabled(); // motif obligatoire
    await userEvent.type(screen.getByLabelText(/Motif de la décision/), "Revenus insuffisants");
    await userEvent.click(reject);
    expect(await screen.findByText(/Dossier refusé — motif : Revenus insuffisants/)).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/decision/"))!.body).toEqual({ decision: "REJECTED", reason: "Revenus insuffisants" });
  });
});

describe("Visite confirmée → dossier", () => {
  it("ouvre le dossier locatif lié à la visite", async () => {
    const visit = {
      id: 7, listing: listing(), slot: { id: 1, starts_at: "2030-01-10T10:00:00Z", ends_at: "2030-01-10T10:45:00Z" }, status: "CONFIRMED", status_label: "Confirmée",
      my_role: "customer", customer_name: "Awa D.", host_name: "Moussa S.", address: "Rue 10", contact_phone: null, message: "", cancelled_at: null, cancel_reason: "",
    };
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith("/visits/7/")) return { body: visit };
      if (url.pathname.endsWith("/applications/") && init.method === "POST") return { status: 201, body: application() };
    });
    renderRoute(<VisitDetailPage />, { path: "/visites/:id", route: "/visites/7" });
    await userEvent.click(await screen.findByRole("button", { name: "Constituer mon dossier" }));
    await waitFor(() => expect(screen.getByText("Autre page")).toBeInTheDocument());
    expect(calls.find((c) => c.path.endsWith("/applications/") && c.method === "POST")!.body).toEqual({ visit: 7 });
  });
});

describe("Constitution du dossier — pièces", () => {
  it("affiche le fichier choisi, permet de le changer puis l'envoie", async () => {
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith("/applications/a1/documents/") && init.method === "POST") return { status: 201, body: {} };
      if (url.pathname.endsWith("/applications/a1/")) return { body: application() };
    });
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    const input = await screen.findByLabelText(/Fichier \(PDF, JPEG, PNG — 8 Mo max\.\)/);
    expect(screen.getByText(/Destinataire :/)).toHaveTextContent("Moussa S. (agent immobilier · Teranga Immo)");
    await userEvent.upload(input, new File(["%PDF-1.4"], "mauvais.pdf", { type: "application/pdf" }));
    expect(screen.getByText("mauvais.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Changer de fichier" }));
    expect(screen.queryByText("mauvais.pdf")).not.toBeInTheDocument();
    await userEvent.upload(await screen.findByLabelText(/Fichier \(PDF/), new File(["%PDF-1.4"], "cni.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la pièce" }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith("/applications/a1/documents/") && c.method === "POST")).toBe(true));
    const form = calls.find((c) => c.path.endsWith("/documents/"))!.body as FormData;
    expect(form.get("doc_type")).toBe("ID_CARD");
    expect((form.get("file") as File).name).toBe("cni.pdf");
  });

  it("refuse avant envoi un fichier trop lourd ou d'un format non accepté", async () => {
    const { calls } = loggedIn((url) => (url.pathname.endsWith("/applications/a1/") ? { body: application() } : undefined));
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    const input = await screen.findByLabelText(/Fichier \(PDF/);
    const big = new File(["x"], "gros.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 9 * 1024 * 1024 });
    await userEvent.upload(input, big);
    expect(screen.getByRole("alert")).toHaveTextContent("8 Mo maximum");
    expect(screen.getByRole("button", { name: "Envoyer la pièce" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Changer de fichier" }));
    await userEvent.upload(await screen.findByLabelText(/Fichier \(PDF/), new File(["x"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Format non accepté");
    expect(calls.some((c) => c.path.endsWith("/documents/"))).toBe(false);
  });
});

describe("Frais de dossier — Wave", () => {
  const submitted = (feeOver: Partial<ApplicationFee> = {}, over: Partial<RentalApplication> = {}) => complete({
    status: "SUBMITTED", status_label: "Transmis", state: "SUBMITTED", can_edit: false, submitted_at: "2026-10-19T11:00:00Z",
    payment: { fee_amount: 5000, currency: "XOF", wave_configured: true, fee: fee(feeOver), transaction: null }, ...over,
  });

  it("ouvre le lien fourni par le serveur puis propose la déclaration, sans confirmer le paiement", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const started = submitted({ started: true });
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith("/applications/a1/fee/start/") && init.method === "POST") {
        return { body: { checkout: { url: "https://pay.wave.com/m/M_test/c/sn/?amount=5000", instructions: "Le montant est déjà renseigné dans Wave." }, application: started } };
      }
      if (url.pathname.endsWith("/applications/a1/fee/declare/") && init.method === "POST") {
        return { body: submitted({ started: true, status: "AWAITING_VERIFICATION", status_label: "Paiement en attente de vérification", provider_reference: "T_ABCDEF12", can_pay: true }) };
      }
      if (url.pathname.endsWith("/applications/a1/")) return { body: submitted() };
    });
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect((await screen.findByText(/Montant dû/)).closest("p")).toHaveTextContent("Montant dû : 5 000 FCFA · référence à indiquer : DL-1A2B3C4D");
    expect(screen.queryByLabelText(/J'ai payé/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Payer 5 000 FCFA avec Wave/ }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://pay.wave.com/m/M_test/c/sn/?amount=5000", "_blank", "noopener,noreferrer"));
    expect(calls.find((c) => c.path.endsWith("/fee/start/"))!.body).toBeUndefined(); // aucun montant envoyé par le navigateur
    await userEvent.type(screen.getByLabelText(/J'ai payé/), "T_ABCDEF12");
    await userEvent.click(screen.getByRole("button", { name: "Déclarer mon paiement" }));
    expect(await screen.findByText(/E-Courtier le rapproche dans Wave Business avant confirmation/)).toBeInTheDocument();
    expect(screen.queryByText("Paiement confirmé")).not.toBeInTheDocument();
    open.mockRestore();
  });

  it("explique un lien Wave incohérent et masque le bouton de paiement", async () => {
    loggedIn((url) => (url.pathname.endsWith("/applications/a1/") ? {
      body: submitted({ can_pay: false, payment_problem: "Le lien Wave configuré est fixé à 7 500 FCFA alors que le montant dû est de 5 000 FCFA : paiement désactivé jusqu'à la correction du lien par E-Courtier." }),
    } : undefined));
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect(await screen.findByText(/fixé à 7 500 FCFA alors que le montant dû est de 5 000 FCFA/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /avec Wave/ })).not.toBeInTheDocument();
  });

  it("affiche le message précis de l'API en cas d'échec du démarrage", async () => {
    vi.spyOn(window, "open").mockImplementation(() => null);
    loggedIn((url, init) => {
      if (url.pathname.endsWith("/fee/start/") && init.method === "POST") return { status: 503, body: { code: "payment_not_configured", detail: "Le paiement Wave n'est pas configuré sur cet environnement." } };
      if (url.pathname.endsWith("/applications/a1/")) return { body: submitted() };
    });
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    await userEvent.click(await screen.findByRole("button", { name: /avec Wave/ }));
    expect(await screen.findByText("Le paiement Wave n'est pas configuré sur cet environnement.")).toBeInTheDocument();
  });

  it("le responsable ne peut accepter qu'après confirmation des frais", async () => {
    const pending = submitted({ status: "AWAITING_VERIFICATION", status_label: "Paiement en attente de vérification" }, { my_role: "responsible", internal_notes: [] });
    loggedIn((url) => (url.pathname.endsWith("/applications/a1/") ? { body: pending } : undefined));
    const view = renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect(await screen.findByRole("button", { name: "Accepter le dossier" })).toBeDisabled();
    expect(screen.getByText(/Acceptation possible après la confirmation des frais/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /avec Wave/ })).not.toBeInTheDocument();
    view.unmount();
    loggedIn((url) => (url.pathname.endsWith("/applications/a1/") ? { body: { ...pending, payment: { ...pending.payment, fee: fee({ status: "CONFIRMED", status_label: "Paiement confirmé" }) } } } : undefined));
    renderRoute(<ApplicationPage />, { path: "/dossiers/:id", route: "/dossiers/a1" });
    expect(await screen.findByRole("button", { name: "Accepter le dossier" })).toBeEnabled();
  });
});

describe("Administration — rapprochement des frais", () => {
  it("liste les frais à vérifier et confirme avec la référence Wave vérifiée", async () => {
    const item = {
      id: 9, amount: 5000, status: "AWAITING_VERIFICATION", status_label: "Paiement en attente de vérification", reference: "DL-1A2B3C4D",
      provider_reference: "T_ABCDEF12", checkout_started_at: "2026-10-19T11:05:00Z", declared_at: "2026-10-19T11:10:00Z", confirmed_at: null,
      failure_reason: "", application_id: "a1", application_status: "SUBMITTED", listing_title: "Appartement à Kenya", customer_name: "Awa Diop", created_at: "2026-10-19T11:00:00Z",
    };
    const { calls } = loggedIn((url, init) => {
      if (url.pathname.endsWith("/admin/application-fees/9/confirm/") && init.method === "POST") return { body: { ...item, status: "CONFIRMED" } };
      if (url.pathname.endsWith("/admin/application-fees/")) return { body: { count: 1, next: null, previous: null, results: [item] } };
    });
    renderRoute(<AdminPage />, { path: "/admin", route: "/admin?onglet=frais" });
    expect(await screen.findByText(/DL-1A2B3C4D/)).toBeInTheDocument();
    expect(screen.getByText(/Ni le clic, ni le retour du client, ni sa déclaration ne prouvent le paiement/)).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith("/admin/application-fees/"))!.path).toBe("/api/v1/admin/application-fees/");
    await userEvent.click(screen.getByRole("button", { name: "Confirmer les frais" }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith("/9/confirm/"))!.body).toEqual({ provider_reference: "T_ABCDEF12" }));
  });
});

