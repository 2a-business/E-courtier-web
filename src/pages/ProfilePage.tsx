import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Field";
import { InlineError, Notice } from "../components/ui/States";
import { api } from "../lib/api";
import { ROLE_LABELS } from "../lib/format";
import type { User } from "../lib/types";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: user!.first_name, last_name: user!.last_name, phone: user!.phone,
    agency_name: user!.profile?.agency_name ?? "", bio: user!.profile?.bio ?? "",
  });
  const save = useMutation({
    mutationFn: () => api<User>("/auth/me/", { method: "PATCH", body: { first_name: form.first_name, last_name: form.last_name, phone: form.phone, profile: { agency_name: form.agency_name, bio: form.bio } } }),
    onSuccess: setUser,
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Mon profil</h1>
        <Badge tone="brand">{ROLE_LABELS[user!.role]}</Badge>
      </div>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">{user!.email}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" value={form.first_name} onChange={set("first_name")} />
            <Input label="Nom" value={form.last_name} onChange={set("last_name")} />
          </div>
          <Input label="Téléphone" type="tel" value={form.phone} onChange={set("phone")} hint="Communiqué uniquement aux parties d'une visite confirmée." />
          {user!.role !== "CUSTOMER" && (
            <>
              <Input label="Agence (facultatif)" value={form.agency_name} onChange={set("agency_name")} />
              <Textarea label="Présentation" value={form.bio} onChange={set("bio")} maxLength={600} />
            </>
          )}
          <InlineError error={save.error} />
          {save.isSuccess && <Notice tone="success">Profil enregistré.</Notice>}
          <Button type="submit" loading={save.isPending}>Enregistrer</Button>
        </form>
      </Card>
      <Button variant="secondary" block onClick={async () => { await logout(); navigate("/"); }}>Se déconnecter</Button>
    </div>
  );
}
