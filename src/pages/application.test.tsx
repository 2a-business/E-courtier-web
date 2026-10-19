import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RentalApplication } from "../lib/types";
import { listing, mockFetch, renderRoute } from "../test/utils";
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
    },
    payment: { fee_amount: 5000, currency: "XOF", wave_configured: true, transaction: null },
    my_role: "customer", internal_notes: null, can_edit: true,
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
        payment: { fee_amount: 5000, currency: "XOF", wave_configured: false, transaction: { id: "t1", reference: "EC-1", status: "PENDING", status_label: "En attente de paiement", total_amount: 285000, fee_amount: 5000, is_simulated: false, paid_at: null } },
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
