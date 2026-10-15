import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { listing } from "../test/utils";
import { Calendar } from "./Calendar";
import { ListingCard } from "./ListingCard";
import { Stepper } from "./Stepper";
import { StatusBadge } from "./ui/Badge";

describe("ListingCard", () => {
  it("affiche le prix en FCFA, le lien et pas de badge si non vérifiée", () => {
    render(<MemoryRouter><ListingCard listing={listing()} /></MemoryRouter>);
    expect(screen.getByText("280 000 FCFA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fann Hock/ })).toHaveAttribute("href", "/logements/11111111-1111-1111-1111-111111111111");
    expect(screen.queryByText("Annonce vérifiée")).not.toBeInTheDocument();
  });
  it("affiche les badges vérifiée et démonstration", () => {
    render(<MemoryRouter><ListingCard listing={listing({ is_verified: true, is_demo: true })} /></MemoryRouter>);
    expect(screen.getByText("Annonce vérifiée")).toBeInTheDocument();
    expect(screen.getByText("Démonstration")).toBeInTheDocument();
  });
});

describe("Calendar", () => {
  it("ne permet de choisir que les jours disponibles", async () => {
    const onSelect = vi.fn();
    render(<Calendar available={new Set(["2026-10-15"])} selected={null} onSelect={onSelect} />);
    const day15 = screen.getByRole("button", { name: /15 octobre, créneaux disponibles/ });
    const day16 = screen.getByRole("button", { name: /16 octobre, indisponible/ });
    expect(day16).toBeDisabled();
    await userEvent.click(day15);
    expect(onSelect).toHaveBeenCalledWith("2026-10-15");
  });
});

describe("Stepper et statuts", () => {
  it("indique l'étape courante", () => {
    render(<Stepper steps={["Demande", "Confirmation", "Visite"]} current={1} />);
    expect(screen.getByText("Confirmation").closest("li")).toHaveAttribute("aria-current", "step");
  });
  it("traduit les statuts", () => {
    render(<StatusBadge status="PENDING_SIGNATURE" />);
    expect(screen.getByText("À signer")).toBeInTheDocument();
  });
});
