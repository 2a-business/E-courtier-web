import { Link } from "react-router";
import { Button } from "../components/ui/Button";

export default function NotFoundPage({ title = "Page introuvable", text = "Le lien est peut-être erroné ou la page a été déplacée." }: { title?: string; text?: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-6xl font-extrabold text-brand-200">404</p>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/"><Button>Accueil</Button></Link>
        <Link to="/recherche"><Button variant="secondary">Rechercher</Button></Link>
      </div>
    </div>
  );
}
