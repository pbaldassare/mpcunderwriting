function fallbackId(): string {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** UUID anche fuori da contesto sicuro (HTTP su IP della VM). */
export function safeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // crypto.randomUUID può lanciare su HTTP non-localhost
  }
  return fallbackId();
}

/**
 * Imposta un fallback su `crypto.randomUUID` se manca o lancia
 * (HTTP su IP, browser vecchi). Da chiamare all'avvio dell'app.
 */
export function installSafeRandomUUID() {
  if (typeof globalThis.crypto === "undefined") return;
  const c = globalThis.crypto as Crypto & { randomUUID?: () => `${string}-${string}-${string}-${string}-${string}` };
  const original = typeof c.randomUUID === "function" ? c.randomUUID.bind(c) : null;
  const wrapped = () => {
    try {
      if (original) return original();
    } catch {
      // Secure context assente
    }
    return fallbackId() as `${string}-${string}-${string}-${string}-${string}`;
  };
  try {
    Object.defineProperty(c, "randomUUID", { configurable: true, writable: true, value: wrapped });
  } catch {
    try {
      c.randomUUID = wrapped;
    } catch {
      /* ignore */
    }
  }
}
