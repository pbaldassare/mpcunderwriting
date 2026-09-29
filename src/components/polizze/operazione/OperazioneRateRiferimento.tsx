export type RataRiferimentoRow = {
  id: string;
  riga?: number | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  premio_lordo?: number | null;
  stato?: string | null;
  data_messa_cassa?: string | null;
};

interface Props {
  rate: RataRiferimentoRow[];
  loading?: boolean;
  title?: string;
  hint?: string;
  emptyMessage?: string;
}

export function OperazioneRateRiferimento({
  rate,
  loading = false,
  title = "Rate del contratto (riferimento)",
  hint = "Le quietanze esistenti restano invariate. Eventuali differenze di premio sono raccolte nel titolo di conguaglio.",
  emptyMessage = "Nessuna rata trovata.",
}: Props) {
  return (
    <div className="border rounded-md p-3 bg-muted/30">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Caricamento…</div>
      ) : rate.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyMessage}</div>
      ) : (
        <ul className="text-xs space-y-1 tabular-nums">
          {rate.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span>
                Riga {r.riga} · {r.garanzia_da} → {r.garanzia_a}
                {r.stato === "incassato" ? " · INCASSATA" : ""}
                {r.stato === "sospeso" ? " · SOSPESA" : ""}
              </span>
              <span className="font-medium">{Number(r.premio_lordo || 0).toFixed(2)} €</span>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}
