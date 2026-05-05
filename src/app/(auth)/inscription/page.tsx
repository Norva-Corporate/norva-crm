import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Inscription · norva CRM",
};

export default function InscriptionPage() {
  return (
    <div className="w-full">
      <div className="bg-[var(--card)] border border-[var(--border)] p-6">
        <h1 className="text-base font-semibold text-foreground mb-1">
          Créer un compte
        </h1>
        <p className="text-xs text-muted-foreground mb-6">
          Rejoignez votre équipe sur norva CRM
        </p>

        <SignupForm />

        <div className="mt-5 pt-5 border-t border-[var(--border)] text-center">
          <span className="text-xs text-muted-foreground">
            Déjà un compte ?{" "}
          </span>
          <Link
            href="/login"
            className="text-xs text-accent hover:underline"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
