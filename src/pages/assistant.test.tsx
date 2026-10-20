import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { listing, mockFetch, renderRoute } from "../test/utils";
import AssistantPage from "./AssistantPage";

const KENYA_ID = "a8c6c687-327f-4825-b252-720ab9f3ae36";
const kenya = () => listing({
  id: KENYA_ID, title: "Appartement à Kenya", price: 120000, transaction_type: "RENT", city: "Ziguinchor", district: "Kenia",
  property_type: "APARTMENT", property_type_label: "Appartement", cover: "https://api.exemple.sn/media/listings/x/photo.jpg",
});

beforeEach(() => sessionStorage.clear());

function chat(body: object, status = 200) {
  return mockFetch((url) => {
    if (url.pathname.endsWith("/assistant/info/")) return { body: { llm_enabled: true, provider: "gemini", suggestions: [], max_message_chars: 500 } };
    if (url.pathname.endsWith("/assistant/chat/")) return { status, body };
  });
}

async function send(text: string) {
  renderRoute(<AssistantPage />, { path: "/assistant", route: "/assistant" });
  await userEvent.type(screen.getByLabelText("Votre message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
}

describe("Assistant — résultats réels", () => {
  it("affiche les annonces trouvées avec prix, lieu, type, photo et lien vers le détail", async () => {
    chat({ conversation_id: "c1", reply: "J'ai trouvé 1 annonce publiée pour : appartement.", criteria: {}, results: [kenya()], total: 1, alternatives: [], relaxed: [], mode: "llm", remaining_today: 9 });
    await send("donne-moi les apparts du site web");
    expect(await screen.findByText("J'ai trouvé 1 annonce publiée pour : appartement.")).toBeInTheDocument();
    const card = screen.getByRole("link", { name: /Appartement à Kenya/ });
    expect(card).toHaveAttribute("href", `/logements/${KENYA_ID}`);
    expect(card).toHaveTextContent("120 000 FCFA");
    expect(card).toHaveTextContent("Kenia");
    expect(card).toHaveTextContent("Appartement · Location");
    expect(card.querySelector("img")).toHaveAttribute("src", "https://api.exemple.sn/media/listings/x/photo.jpg");
    expect(screen.getByText("Logements correspondant à votre recherche")).toBeInTheDocument();
    expect(screen.getByText("Critères analysés par l'IA")).toBeInTheDocument();
  });

  it("présente les alternatives comme proches, jamais comme des résultats exacts", async () => {
    chat({
      conversation_id: "c1", reply: "Aucune annonce publiée ne correspond exactement à : appartement, jusqu'à 100 000 FCFA. En élargissant (budget augmenté de 20 %), voici 1 annonce proche.",
      criteria: {}, results: [], total: 0, alternatives: [kenya()], relaxed: ["budget augmenté de 20 %"], mode: "rules", remaining_today: 9,
    });
    await send("appart moins de 100 000");
    expect(await screen.findByText("Annonces proches (critères élargis : budget augmenté de 20 %)")).toBeInTheDocument();
    expect(screen.queryByText("Logements correspondant à votre recherche")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Appartement à Kenya/ })).toHaveAttribute("href", `/logements/${KENYA_ID}`);
  });

  it("une panne de recherche n'est jamais affichée comme une absence d'annonces", async () => {
    chat({ code: "search_unavailable", detail: "La recherche d'annonces est momentanément indisponible. Réessayez dans un instant : cela ne signifie pas qu'aucune annonce ne correspond." }, 503);
    await send("donne-moi les apparts du site web");
    expect(await screen.findByText(/cela ne signifie pas qu'aucune annonce ne correspond/)).toBeInTheDocument();
    expect(screen.queryByText(/Aucune annonce/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Appartement/ })).not.toBeInTheDocument();
  });

  it("affiche une comparaison sur plusieurs lignes sans la fusionner", async () => {
    const reply = "Comparaison des annonces affichées (données des annonces publiées) :\n1. « Appartement à Kenya » — 120 000 FCFA / mois\n2. « Appartement Boucotte » — 180 000 FCFA / mois";
    chat({ conversation_id: "c1", reply, criteria: {}, results: [kenya()], total: 1, alternatives: [], relaxed: [], mode: "rules", remaining_today: 9 });
    await send("compare-les");
    const bubble = await screen.findByText(/Comparaison des annonces affichées/);
    expect(bubble.className).toContain("whitespace-pre-line");
  });
});
