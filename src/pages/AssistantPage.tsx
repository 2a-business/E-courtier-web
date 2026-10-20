import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, Info, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ListingCover } from "../components/ListingCard";
import { cn } from "../components/ui/cn";
import { ApiError, api } from "../lib/api";
import { fcfa, priceSuffix } from "../lib/format";
import type { ChatResponse, ListingCard } from "../lib/types";

const STORAGE_KEY = "ec-assistant-conversation";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  results?: ListingCard[];
  alternatives?: ListingCard[];
  relaxed?: string[];
  mode?: string;
  error?: boolean;
}

// Chaque réponse indique comment la demande a été analysée : l'analyse par règles n'est jamais présentée comme de l'IA.
const MODE_LABELS: Record<string, string> = {
  llm: "Critères analysés par l'IA",
  rules: "Analyse simplifiée par règles (sans IA)",
  fallback: "IA indisponible : analyse simplifiée par règles",
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Bonjour, je suis votre assistant de recherche immobilière. Décrivez le logement que vous cherchez : type, quartier, budget en FCFA, nombre de pièces, équipements…",
};

function ResultCard({ listing }: { listing: ListingCard }) {
  return (
    <Link to={`/logements/${listing.id}`} className="block w-60 shrink-0 overflow-hidden rounded-2xl bg-white text-ink shadow-sm transition hover:-translate-y-0.5">
      <div className="h-32"><ListingCover listing={listing} /></div>
      <div className="space-y-0.5 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</p>
        <p className="text-xs text-muted">{listing.property_type_label} · {listing.transaction_type === "RENT" ? "Location" : "Vente"}</p>
        <p className="text-sm font-bold text-brand-700">{fcfa(listing.price)}<span className="text-xs font-normal text-muted">{priceSuffix(listing.transaction_type)}</span></p>
        <p className="text-xs text-muted">{listing.district} · {listing.rooms} p.{listing.surface_m2 ? ` · ${listing.surface_m2} m²` : ""}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {listing.is_verified && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700"><BadgeCheck className="size-3.5" aria-hidden />Vérifiée</span>}
          {listing.is_demo && <span className="text-[11px] font-semibold text-amber-700">Démonstration</span>}
        </div>
      </div>
    </Link>
  );
}

function Cards({ listings, label }: { listings: ListingCard[]; label: string }) {
  return (
    <div className="max-w-full space-y-1">
      <p className="px-1 text-xs font-semibold text-muted">{label}</p>
      <div className="-mx-1 flex max-w-full gap-3 overflow-x-auto px-1 pb-2" aria-label={label}>
        {listings.map((l) => <ResultCard key={l.id} listing={l} />)}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  const results = message.results ?? [];
  const alternatives = message.alternatives ?? [];
  return (
    <li className={cn("flex flex-col gap-2", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "relative max-w-[85%] whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed shadow-sm",
          mine ? "rounded-2xl rounded-tr-sm bg-[#dcf8d4] text-ink" : message.error ? "rounded-2xl rounded-tl-sm bg-red-50 text-red-800" : "rounded-2xl rounded-tl-sm bg-white text-ink",
        )}
      >
        <span className="sr-only">{mine ? "Vous : " : "Assistant : "}</span>
        {message.text}
      </div>
      {!mine && message.mode && <p className="px-1 text-[11px] text-muted">{MODE_LABELS[message.mode] ?? MODE_LABELS.rules}</p>}
      {results.length > 0 && <Cards listings={results} label="Logements correspondant à votre recherche" />}
      {/* Les alternatives ne sont jamais présentées comme des résultats exacts. */}
      {alternatives.length > 0 && (
        <Cards listings={alternatives} label={`Annonces proches${message.relaxed?.length ? ` (critères élargis : ${message.relaxed.join(", ")})` : ""}`} />
      )}
    </li>
  );
}

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const info = useQuery({ queryKey: ["assistant-info"], queryFn: () => api<{ llm_enabled: boolean; suggestions: string[]; max_message_chars: number }>("/assistant/info/") });

  // Restaure la conversation de l'onglet en cours (les annonces non publiées ne sont plus renvoyées).
  useEffect(() => {
    if (!conversationId) return;
    api<{ messages: { id: number; role: "user" | "assistant"; text: string; listing_ids: string[] }[]; listings: ListingCard[] }>(
      `/assistant/conversations/${conversationId}/`,
    )
      .then((data) => {
        const byId = new Map(data.listings.map((l) => [l.id, l]));
        setMessages([
          WELCOME,
          ...data.messages.map((m) => ({
            id: String(m.id),
            role: m.role,
            text: m.text,
            results: m.listing_ids.map((id) => byId.get(id)).filter(Boolean) as ListingCard[],
          })),
        ]);
      })
      .catch(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setConversationId(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages]);

  const chat = useMutation({
    mutationFn: (message: string) => api<ChatResponse>("/assistant/chat/", { body: { message, conversation_id: conversationId } }),
    onSuccess: (data) => {
      setConversationId(data.conversation_id);
      sessionStorage.setItem(STORAGE_KEY, data.conversation_id);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: data.reply, results: data.results, alternatives: data.alternatives, relaxed: data.relaxed, mode: data.mode }]);
    },
    onError: (error) => {
      const text =
        error instanceof ApiError
          ? error.firstMessage
          : "Impossible de joindre l'assistant.";
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text, error: true }]);
    },
  });

  function send(text: string) {
    const value = text.trim();
    if (!value || chat.isPending) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: value }]);
    setInput("");
    chat.mutate(value);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const max = info.data?.max_message_chars ?? 500;

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 pb-28 pt-6 md:pb-10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Sparkles className="text-brand-600" aria-hidden /> Assistant IA</h1>
          <p className="text-sm text-muted">Il comprend votre demande puis cherche uniquement parmi les annonces publiées sur E-Courtier.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setConversationId(null);
            setMessages([WELCOME]);
          }}
          className="shrink-0 rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold"
        >
          Nouvelle conversation
        </button>
      </div>

      <section aria-label="Conversation" className="flex min-h-[55vh] flex-col rounded-[2rem] bg-[#0e7c86] p-3 shadow-lg sm:p-5">
        <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {messages.map((m) => <Bubble key={m.id} message={m} />)}
          {chat.isPending && (
            <li className="flex items-center gap-2 self-start rounded-2xl bg-white/90 px-4 py-3 text-sm text-muted" role="status">
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} className="size-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 120}ms` }} />)}
              </span>
              Recherche en cours…
            </li>
          )}
        </ol>

        {messages.length <= 1 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggestions">
            {(info.data?.suggestions ?? []).map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-white/15 px-3 py-2 text-left text-xs font-medium text-white hover:bg-white/25">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2 rounded-3xl bg-white p-2">
          <label htmlFor="assistant-input" className="sr-only">Votre message</label>
          <textarea
            id="assistant-input"
            rows={1}
            maxLength={max}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ex. : studio meublé à Mermoz, 150 000 FCFA max"
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || chat.isPending}
            aria-label="Envoyer"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white disabled:opacity-40"
          >
            <SendHorizontal className="size-5" aria-hidden />
          </button>
        </form>
      </section>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {info.data && !info.data.llm_enabled
          ? "Mode simplifié : l'IA n'est pas configurée sur cet environnement, votre demande est analysée par des règles."
          : "L'assistant ne crée aucune annonce et n'invente aucun prix : les résultats proviennent de la base E-Courtier."}{" "}
        Ne partagez pas d'informations personnelles sensibles. <Link to="/recherche" className="font-semibold text-brand-700">Recherche avancée</Link>
      </p>
    </div>
  );
}
