import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Créer un compte · Notes" };

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-medium text-foreground">
            Créer un compte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Un espace de travail est créé automatiquement.
          </p>
        </div>

        <SignupForm />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
