import { dayKey, fcfa, fileSize, formatTime, priceSuffix } from "./format";

describe("formatage", () => {
  it("affiche les montants en FCFA avec séparateurs", () => {
    expect(fcfa(280000)).toBe("280 000 FCFA");
    expect(fcfa(5000)).toBe("5 000 FCFA");
    expect(fcfa(null)).toBe("—");
  });
  it("suffixe mensuel uniquement pour la location", () => {
    expect(priceSuffix("RENT")).toBe(" / mois");
    expect(priceSuffix("SALE")).toBe("");
  });
  it("utilise le fuseau de Dakar (UTC+0)", () => {
    expect(formatTime("2026-10-15T09:30:00Z")).toBe("09:30");
    expect(dayKey("2026-10-15T23:30:00Z")).toBe("2026-10-15");
  });
  it("formate les tailles de fichiers", () => {
    expect(fileSize(2048)).toBe("2 Ko");
    expect(fileSize(3 * 1024 * 1024)).toBe("3,0 Mo");
  });
});
