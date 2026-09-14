import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Build autonome : `.next/standalone` embarque un `server.js` et le strict
   * nécessaire de `node_modules`, ce qui évite d'expédier les ~600 paquets de
   * `dependencies` dans l'image. Requis par le Dockerfile multi-étages.
   */
  output: "standalone",

  /**
   * `sharp` est une dépendance native : le traceur de fichiers ne voit pas ses
   * binaires (chargés par `require` dynamique), et ils manqueraient à
   * l'exécution — l'upload d'image échouerait au premier appel, pas au build.
   * Le cas est documenté tel quel dans la doc `output` de Next.
   */
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
  },
};

export default nextConfig;
