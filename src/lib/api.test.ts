import { mockFetch } from "../test/utils";
import { ApiError, api, setAccessToken } from "./api";

describe("client API", () => {
  afterEach(() => setAccessToken(null));

  it("ajoute le jeton et renouvelle une fois sur 401", async () => {
    setAccessToken("ancien");
    let attempts = 0;
    const { calls } = mockFetch((url, init) => {
      if (url.pathname.endsWith("/auth/refresh/")) return { body: { access: "nouveau" } };
      attempts += 1;
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer nouveau" ? { body: { ok: true } } : { status: 401, body: { code: "not_authenticated", detail: "x" } };
    });
    await expect(api("/auth/me/")).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
    const refresh = calls.find((c) => c.path.endsWith("/auth/refresh/"))!;
    expect(refresh.headers["X-Requested-With"]).toBe("XMLHttpRequest");
  });

  it("convertit les erreurs de validation", async () => {
    mockFetch(() => ({ status: 400, body: { code: "validation_error", detail: "Certaines données sont invalides.", errors: { email: ["Adresse invalide."] } } }));
    const error = (await api("/auth/register/", { body: {} }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.firstMessage).toBe("Adresse invalide.");
  });

  it("signale une coupure réseau en français", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = (await api("/search/listings/").catch((e) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Connexion impossible/);
  });

  it("ne déconnecte pas sur une erreur temporaire de renouvellement", async () => {
    setAccessToken("ancien");
    mockFetch((url) => (url.pathname.endsWith("/auth/refresh/") ? { status: 429, body: {} } : { status: 401, body: { code: "not_authenticated", detail: "Expiré" } }));
    await expect(api("/auth/me/")).rejects.toMatchObject({ status: 401 });
  });
});
