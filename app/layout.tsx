import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { InlineScript } from "@/components/inline-script";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Le serif éditorial de la DA : titres de page, titres de document et
 * grands nombres. Une seule graisse suffit, le serif porte la hiérarchie. */
const editorialSerif = Instrument_Serif({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Notes",
  description: "Un clone de Notion pour prendre ses cours",
};

/** Applique le thème avant le premier paint pour éviter le flash blanc :
 * le choix explicite de l'utilisateur gagne, sinon on tombe sur le sombre
 * (le défaut de l'app). Inline dans <head> parce qu'il doit tourner avant
 * que React hydrate. */
const THEME_INIT_SCRIPT = `
try {
  var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (stored !== "light") document.documentElement.classList.add("dark");
} catch (e) {
  document.documentElement.classList.add("dark");
}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${editorialSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider delay={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
