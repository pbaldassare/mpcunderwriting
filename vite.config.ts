import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { APP_RELEASE_VERSION } from "./src/lib/appRelease";

// Versione STABILE condivisa fra VITE_APP_VERSION (embedded nel bundle) e
// public/version.json (servito statico). Deve restare identica fra build
// successive con lo stesso APP_RELEASE_VERSION, altrimenti il client va in
// loop di reload per mismatch versione.
const APP_VERSION = APP_RELEASE_VERSION;

/** Scrive version.json solo se il contenuto cambia (evita restart/HMR inutili in watch). */
function writeFileIfChanged(filePath: string, payload: string) {
  try {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === payload) return;
    fs.writeFileSync(filePath, payload);
  } catch (err) {
    console.warn(`[writeVersionJson] cannot write ${filePath}:`, err);
  }
}

/**
 * Plugin che scrive `version.json` sia in `public/` (per dev server)
 * sia in `dist/` (per produzione) con la stessa versione del bundle.
 */
function writeVersionJson(): Plugin {
  const payload = JSON.stringify({ version: APP_VERSION }, null, 2);
  return {
    name: "write-version-json",
    apply: () => true,
    buildStart() {
      const publicDir = path.resolve(__dirname, "public");
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      writeFileIfChanged(path.join(publicDir, "version.json"), payload);
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
      writeFileIfChanged(path.join(distDir, "version.json"), payload);
    },
  };
}

function devServerStartupLog(port: number, projectName: string): Plugin {
  return {
    name: "dev-server-startup-log",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const activePort =
          typeof addr === "object" && addr && "port" in addr ? addr.port : port;
        console.log("");
        console.log(`  \x1b[36m${projectName}\x1b[0m dev server → \x1b[32mhttp://localhost:${activePort}/login\x1b[0m`);
        console.log(`  Porta: \x1b[33m${activePort}\x1b[0m (VITE_DEV_PORT)`);
        console.log("");
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(env.VITE_DEV_PORT || process.env.VITE_DEV_PORT || 5175);
  const projectName = "CBnet";

  return {
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  server: {
    // "::" = dual stack: http://localhost:5175 (IPv6) e 127.0.0.1 (IPv4)
    host: "::",
    port: devPort,
    strictPort: true,
    // Accesso dalla macchina virtuale per IP / hostname (altrimenti Vite risponde 403)
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    hmr: {
      overlay: false,
    },
    // Evita che riscritture di version.json facciano ripartire il watcher
    watch: {
      ignored: ["**/public/version.json"],
    },
  },
  plugins: [
    react(),
    writeVersionJson(),
    devServerStartupLog(devPort, projectName),
    // HMR standard (niente full-reload su ogni save)
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
