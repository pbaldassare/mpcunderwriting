#!/usr/bin/env bash
# Apre CBnet in locale sulla porta del workspace (mai 8080).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="$(grep -E '^VITE_DEV_PORT=' "$ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"[:space:]')"
PORT="${PORT:-5175}"
URL="http://localhost:${PORT}/login"

CHROME_CANDIDATES=(
  /usr/local/bin/chromium-cbnet
  /root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome
  /usr/bin/google-chrome
  /usr/bin/chromium-browser
  /usr/bin/chromium
)

chrome=""
for c in "${CHROME_CANDIDATES[@]}"; do
  if [[ -x "$c" ]]; then
    chrome="$c"
    break
  fi
done

if ! curl -sf -o /dev/null --max-time 3 "$URL"; then
  echo "CBnet non risponde su $URL — avvia il dev server (npm run dev / bun run dev)." >&2
  exit 1
fi

echo "Apro $URL"

# Cursor / VS Code: apre nel browser del client (funziona anche da remoto).
if command -v cursor >/dev/null 2>&1; then
  cursor --open-url "$URL" >/tmp/cbnet-browser.log 2>&1 && exit 0 || true
fi
if command -v code >/dev/null 2>&1; then
  code --open-url "$URL" >/tmp/cbnet-browser.log 2>&1 && exit 0 || true
fi

launch() {
  if [[ -t 1 ]]; then
    exec "$@"
  fi
  nohup "$@" >/tmp/cbnet-browser.log 2>&1 &
  echo "Browser avviato (pid $!)"
}

if [[ -n "${DISPLAY:-}" && -n "$chrome" ]]; then
  launch "$chrome" --no-sandbox --disable-gpu --disable-dev-shm-usage "$URL"
  exit 0
fi

if command -v xdg-open >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  launch xdg-open "$URL"
  exit 0
fi

# Macchina headless: display virtuale + Chromium già in cache Playwright.
if [[ -z "${DISPLAY:-}" ]]; then
  export DISPLAY=:99
  if ! xdpyinfo -display :99 >/dev/null 2>&1; then
    if ! command -v Xvfb >/dev/null 2>&1; then
      echo "Niente DISPLAY e niente Xvfb. Installa xvfb oppure apri $URL da Cursor (porta ${PORT})." >&2
      exit 1
    fi
    Xvfb :99 -screen 0 1400x900x24 >/tmp/cbnet-xvfb.log 2>&1 &
    sleep 0.4
  fi
fi

if [[ -z "$chrome" ]]; then
  echo "Nessun browser trovato. Apri $URL da Cursor (forward porta ${PORT})." >&2
  exit 1
fi

launch "$chrome" --no-sandbox --disable-gpu --disable-dev-shm-usage --start-maximized "$URL"
