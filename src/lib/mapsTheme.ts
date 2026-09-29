/**
 * Stile centralizzato per le tendine di autocompletamento Google Maps.
 *
 * Regola: nessun riempimento col token `accent` (verde petrolio del brand).
 * L'elemento sotto cursore/focus viene solo "bordato" con un anello neutro
 * e un velo molto leggero del colore `muted`.
 *
 * Riusare questo costante in OGNI componente che renderizza una lista di
 * suggerimenti Maps (predizioni, place details, geocoder fallback, ecc.).
 */
export const MAPS_SUGGESTION_ITEM_CLASS =
  "w-full px-3 py-2 text-left text-sm bg-popover text-popover-foreground " +
  "hover:bg-muted/40 hover:ring-1 hover:ring-border hover:ring-inset " +
  "focus:bg-muted/40 focus:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset";

/** Container del dropdown predizioni (popover, ombra, bordo neutro). */
export const MAPS_SUGGESTION_LIST_CLASS =
  "absolute z-[70] mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md";
