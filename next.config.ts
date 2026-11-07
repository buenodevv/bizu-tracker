import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  /**
   * `pdf-parse` carrega `pdf.worker.mjs` em runtime por caminho relativo ao
   * próprio pacote. Se o bundler empacotar a lib, o worker não é copiado e a
   * extração falha com "Setting up fake worker failed". Mantendo o pacote
   * externo, o Node resolve direto de node_modules.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],

  turbopack: {
    // Define a raiz do workspace para o Turbopack (evita detectar lockfiles
    // de diretórios acima deste projeto).
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
