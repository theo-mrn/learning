import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Connexion · Notes" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-medium text-foreground">
            Content de te revoir
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connecte-toi pour retrouver tes cours.
          </p>
        </div>

        <LoginForm />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
