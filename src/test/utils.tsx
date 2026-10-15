import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import type { ListingCard } from "../lib/types";

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined;

/** Remplace fetch : chaque appel est routé vers `handler` (méthode + chemin). */
export function mockFetch(handler: Handler) {
  const calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ method: init.method ?? "GET", path: url.pathname, body, headers: (init.headers ?? {}) as Record<string, string> });
    const res = handler(url, init) ?? { status: 404, body: { code: "not_found", detail: "Introuvable" } };
    const status = res.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(res.body ?? {}), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

export function renderRoute(element: ReactElement, { path = "/", route = "/" }: { path?: string; route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path, element },
      { path: "*", element: <p>Autre page</p> },
    ],
    { initialEntries: [route] },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

export const listing = (over: Partial<ListingCard> = {}): ListingCard => ({
  id: "11111111-1111-1111-1111-111111111111",
  title: "Appartement 3 pièces à Fann Hock",
  property_type: "APARTMENT",
  property_type_label: "Appartement",
  transaction_type: "RENT",
  price: 280000,
  currency: "XOF",
  surface_m2: 85,
  rooms: 3,
  bedrooms: 2,
  bathrooms: 1,
  is_furnished: false,
  city: "Dakar",
  district: "Fann Hock",
  latitude: 14.686,
  longitude: -17.465,
  is_verified: false,
  is_featured: false,
  is_demo: false,
  cover: null,
  published_at: "2026-10-14T10:00:00Z",
  ...over,
});
