import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Connexion · norva CRM",
};

export default function LoginPage() {
  return (
    <div className="w-full">
      <div className="bg-[var(--card)] border border-[var(--border)] p-6">
        <h1 className="text-base font-semibold text-foreground mb-1">
          Se connecter
        </h1>
        <p className="text-xs text-muted-foreground mb-6">
          Accédez à votre espace de travail
        </p>

        <LoginForm />

        <div className="mt-5 pt-5 border-t border-[var(--border)] text-center">
          <span className="text-xs text-muted-foreground">
            Pas encore de compte ?{" "}
          </span>
          <Link
            href="/inscription"
            className="text-xs text-accent hover:underline"
          >
            S&apos;inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}
