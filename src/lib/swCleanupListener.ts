/**
 * No-op. In passato ascoltava `CBNET_SW_NAV` dal service worker
 * kill-switch e faceva `window.location.replace(...)`, ma questo causava
 * reload "a sorpresa" che facevano perdere form aperti. I service worker
 * ora si disinstallano in silenzio (vedi `public/sw.js`) e l'unico
 * reload possibile è quello manuale del banner `AppVersionGuard`.
 */
export function installSwCleanupListener(): void {
  // intentionally empty
}
