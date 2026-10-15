import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Layout";
import { Button } from "../components/ui/Button";
import { cn } from "../components/ui/cn";
import { Checkbox, Input } from "../components/ui/Field";
import { InlineError, Notice } from "../components/ui/States";
import { ApiError, api } from "../lib/api";
import { loginSchema, registerSchema } from "../lib/schemas";
import type { User } from "../lib/types";

/** Destination après connexion : uniquement un chemin interne (pas de redirection ouverte). */
function safeNext(raw: string | null, user: User) {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return user.role === "ADMIN" ? "/admin" : user.role === "CUSTOMER" ? "/" : "/tableau-de-bord";
}

function applyServerErrors(error: unknown, setError: (name: never, e: { message: string }) => void) {
  if (error instanceof ApiError && error.errors) {
    Object.entries(error.errors).forEach(([field, msgs]) => setError(field as never, { message: Array.isArray(msgs) ? msgs[0] : String(msgs) }));
  }
}

function AuthShell({ tab, children }: { tab?: "login" | "register"; children: ReactNode }) {
  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
      <img src="/hero-dakar.jpg" alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/10 via-ink/20 to-ink/60" />
      <div className="relative mx-auto flex max-w-md flex-col items-center px-4 pb-28 pt-10 md:pb-12">
        <div className="mb-6 rounded-2xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur"><Logo /></div>
        <div className="w-full rounded-[2rem] bg-white p-5 shadow-2xl sm:p-7">
          {tab && (
            <nav className="mb-6 grid grid-cols-2 rounded-2xl bg-surface p-1" aria-label="Connexion ou inscription">
              <Link to="/connexion" aria-current={tab === "login" ? "page" : undefined} className={cn("rounded-xl py-2.5 text-center text-sm font-bold", tab === "login" ? "bg-white shadow-sm" : "text-muted")}>Connexion</Link>
              <Link to="/inscription" aria-current={tab === "register" ? "page" : undefined} className={cn("rounded-xl py-2.5 text-center text-sm font-bold", tab === "register" ? "bg-white shadow-sm" : "text-muted")}>Inscription</Link>
            </nav>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const [error, setErr] = useState<unknown>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setErr(null);
    try {
      const user = await login(values.email, values.password);
      navigate(safeNext(params.get("suite"), user), { replace: true });
    } catch (e) {
      setErr(e);
    }
  });

  return (
    <AuthShell tab="login">
      <h1 className="sr-only">Connexion</h1>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Adresse e-mail" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <Input label="Mot de passe" type="password" autoComplete="current-password" error={errors.password?.message} {...form.register("password")} />
        <div className="text-right"><Link to="/mot-de-passe-oublie" className="text-sm font-semibold text-brand-700">Mot de passe oublié ?</Link></div>
        <InlineError error={error} />
        <Button type="submit" size="lg" block loading={isSubmitting}>Se connecter</Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: params.get("role") === "OWNER" ? "OWNER" : "CUSTOMER", phone: "" },
  });
  const [error, setErr] = useState<unknown>(null);
  const { errors, isSubmitting } = form.formState;
  const role = form.watch("role");

  const onSubmit = form.handleSubmit(async (values) => {
    setErr(null);
    try {
      const user = await signup({
        email: values.email, password: values.password, first_name: values.first_name, last_name: values.last_name,
        phone: values.phone || "", role: values.role,
      });
      navigate(safeNext(params.get("suite"), user), { replace: true });
    } catch (e) {
      applyServerErrors(e, form.setError as never);
      setErr(e);
    }
  });

  return (
    <AuthShell tab="register">
      <h1 className="sr-only">Inscription</h1>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Je suis</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["CUSTOMER", "Je cherche un logement"], ["OWNER", "Je propose un bien"]] as const).map(([value, label]) => (
              <label key={value} className={cn("cursor-pointer rounded-2xl border p-3 text-sm font-semibold", role === value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line")}>
                <input type="radio" value={value} className="sr-only" {...form.register("role")} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Agents immobiliers : inscrivez-vous comme propriétaire puis demandez le statut d'agent à l'équipe E-Courtier.</p>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" autoComplete="given-name" error={errors.first_name?.message} {...form.register("first_name")} />
          <Input label="Nom" autoComplete="family-name" error={errors.last_name?.message} {...form.register("last_name")} />
        </div>
        <Input label="Adresse e-mail" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <Input label="Téléphone (facultatif)" type="tel" autoComplete="tel" placeholder="+221 77 123 45 67" hint="Pour les rappels de visite. Jamais affiché publiquement." error={errors.phone?.message} {...form.register("phone")} />
        <Input label="Mot de passe" type="password" autoComplete="new-password" hint="8 caractères minimum, pas uniquement des chiffres." error={errors.password?.message} {...form.register("password")} />
        <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" error={errors.confirm?.message} {...form.register("confirm")} />
        <Checkbox label="J'accepte les conditions d'utilisation et la politique de confidentialité d'E-Courtier." {...form.register("terms")} />
        {errors.terms && <p role="alert" className="text-xs font-medium text-red-600">{errors.terms.message}</p>}
        <InlineError error={error} />
        <Button type="submit" size="lg" block loading={isSubmitting}>Créer mon compte</Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const request = useMutation({ mutationFn: () => api<{ detail: string }>("/auth/password-reset/", { body: { email } }) });
  return (
    <AuthShell>
      <h1 className="text-xl font-extrabold">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-muted">Indiquez votre adresse : si un compte existe, vous recevrez un lien de réinitialisation.</p>
      {request.isSuccess ? (
        <div className="mt-4 space-y-4"><Notice tone="success">{request.data.detail}</Notice><Link to="/connexion"><Button block>Retour à la connexion</Button></Link></div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); request.mutate(); }}>
          <Input label="Adresse e-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <InlineError error={request.error} />
          <Button type="submit" block loading={request.isPending}>Envoyer le lien</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const confirm = useMutation({
    mutationFn: () => api<{ detail: string }>("/auth/password-reset/confirm/", { body: { uid: params.get("uid"), token: params.get("token"), new_password: password } }),
  });
  return (
    <AuthShell>
      <h1 className="text-xl font-extrabold">Nouveau mot de passe</h1>
      {confirm.isSuccess ? (
        <div className="mt-4 space-y-4"><Notice tone="success">{confirm.data.detail}</Notice><Link to="/connexion"><Button block>Se connecter</Button></Link></div>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); confirm.mutate(); }}>
          <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <InlineError error={confirm.error} />
          <Button type="submit" block loading={confirm.isPending}>Enregistrer</Button>
        </form>
      )}
    </AuthShell>
  );
}
