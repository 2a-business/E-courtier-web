/**
 * Client HTTP de l'API E-Courtier.
 * - Le jeton d'accès (courte durée) reste en mémoire : jamais dans localStorage.
 * - Le jeton de rafraîchissement est un cookie HttpOnly géré par le navigateur.
 */

export const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

export class ApiError extends Error {
  status: number;
  code: string;
  errors?: Record<string, string[] | string>;

  constructor(status: number, code: string, message: string, errors?: Record<string, string[] | string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  /** Premier message d'erreur de champ, sinon message général. */
  get firstMessage(): string {
    if (this.errors) {
      const first = Object.values(this.errors)[0];
      const value = Array.isArray(first) ? first[0] : first;
      if (typeof value === "string") return value;
    }
    return this.message;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

/**
 * Renvoie le nouveau jeton, `null` si la session est réellement expirée (401/403),
 * et lève une ApiError pour une erreur temporaire (réseau, 429, 5xx) : la session n'est alors pas perdue.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .catch(() => {
        throw new ApiError(0, "network_error", "Connexion impossible.");
      })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return null;
        if (!res.ok) throw new ApiError(res.status, "refresh_failed", "Session momentanément indisponible.");
        const data = (await res.json()) as { access: string };
        accessToken = data.access;
        return data.access;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function send(path: string, options: RequestOptions, retry: boolean): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.params), {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      credentials: "include",
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Connexion impossible. Vérifiez votre réseau puis réessayez.");
  }
  if (res.status === 401 && retry && accessToken) {
    let token: string | null;
    try {
      token = await refreshAccessToken();
    } catch {
      return res; // erreur temporaire : on ne déconnecte pas l'utilisateur
    }
    if (token) return send(path, options, false);
    accessToken = null;
    onSessionExpired?.();
  }
  return res;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options, true);
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const fallback =
      res.status >= 500 ? "Le service rencontre un problème. Réessayez dans un instant." : "La requête a échoué.";
    throw new ApiError(res.status, data?.code ?? "error", data?.detail ?? fallback, data?.errors);
  }
  // Un succès sans JSON (ex. page HTML renvoyée par un proxy, ou VITE_API_URL absente au build) ne doit pas
  // se transformer en `null` silencieux qui ferait planter les écrans (`data.results` sur null).
  if (data === null) throw new ApiError(res.status, "invalid_response", "Réponse inattendue du serveur. Réessayez dans un instant.");
  return data as T;
}

/** Téléchargement authentifié d'un fichier privé (justificatif, contrat). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await send(path, {}, true);
  if (!res.ok) throw new ApiError(res.status, "download_failed", "Téléchargement impossible.");
  return res.blob();
}
