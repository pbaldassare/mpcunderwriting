import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import {
  FORMA_COPERTURA_LABEL,
  TIPO_BENE_LABEL,
  buildEstrazioneTecnicaDrafts,
  type EstrazioneTecnicaExtracted,
  type FormaCopertura,
  type TipoBene,
} from "@/lib/polizzaEstrazioneTecnica";

const fmtEur = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString("it-IT", { style: "currency", currency: "EUR" }) : "—";

type Props = { extracted: EstrazioneTecnicaExtracted };

export default function EstrazioneTecnicaPreview({ extracted }: Props) {
  const d = buildEstrazioneTecnicaDrafts(extracted);
  const hasAny =
    d.forma_copertura
    || d.partite.length
    || d.beni_esclusi.length
    || d.esclusioni.length
    || d.sottolimiti.length
    || d.premio_calcolo.length;
  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      {(d.forma_copertura || d.forma_copertura_note) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Forma di copertura</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <b>{d.forma_copertura ? FORMA_COPERTURA_LABEL[d.forma_copertura as FormaCopertura] : "—"}</b>
            </div>
            {d.forma_copertura_note && (
              <p className="text-xs text-muted-foreground">{d.forma_copertura_note}</p>
            )}
          </CardContent>
        </Card>
      )}

      {d.partite.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Partite e somme assicurate</CardTitle></CardHeader>
          <CardContent>
            <TableScrollArea>
            <table className="w-full min-w-max text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th>N.</th><th>Descrizione</th><th>Tipo</th><th>Somma</th><th>Forma</th>
                </tr>
              </thead>
              <tbody>
                {d.partite.map((p) => (
                  <tr key={p.numero} className="odd:bg-muted/30">
                    <td>{p.numero}</td>
                    <td>
                      {p.descrizione}
                      {p.ubicazione && <div className="text-muted-foreground">{p.ubicazione}</div>}
                    </td>
                    <td>{TIPO_BENE_LABEL[p.tipo_bene as TipoBene]}</td>
                    <td>{fmtEur(p.somma_assicurata)}</td>
                    <td>{p.forma_assicurazione?.replace(/_/g, " ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScrollArea>
          </CardContent>
        </Card>
      )}

      {d.beni_esclusi.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Beni esclusi</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {d.beni_esclusi.map((b, i) => (
              <div key={i}>
                {b.partita_numero != null && <span className="text-muted-foreground">P{b.partita_numero} · </span>}
                {b.descrizione}
                {b.motivo && <span className="text-muted-foreground"> — {b.motivo}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {d.esclusioni.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Esclusioni</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-2">
            {d.esclusioni.map((e, i) => (
              <div key={i}>
                <div className="font-medium">
                  {[e.articolo, e.titolo].filter(Boolean).join(" · ") || e.livello}
                </div>
                <div className="text-muted-foreground">{e.testo}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {d.sottolimiti.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Sottolimiti di indennizzo</CardTitle></CardHeader>
          <CardContent>
            <TableScrollArea>
            <table className="w-full min-w-max text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th>Voce</th><th>Importo</th><th>%</th><th>Per</th>
                </tr>
              </thead>
              <tbody>
                {d.sottolimiti.map((s, i) => (
                  <tr key={i} className="odd:bg-muted/30">
                    <td>{s.voce}</td>
                    <td>{fmtEur(s.importo)}</td>
                    <td>{s.percentuale ?? "—"}</td>
                    <td>{s.per ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScrollArea>
          </CardContent>
        </Card>
      )}

      {d.premio_calcolo.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Calcolo del premio</CardTitle></CardHeader>
          <CardContent>
            <TableScrollArea>
            <table className="w-full min-w-max text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th>Garanzia</th><th>Base</th><th>Tasso</th><th>Imponibile</th><th>Lordo</th>
                </tr>
              </thead>
              <tbody>
                {d.premio_calcolo.map((r, i) => (
                  <tr key={i} className="odd:bg-muted/30">
                    <td>
                      {r.garanzia ?? "—"}
                      {r.formula_fonte && <div className="text-muted-foreground">{r.formula_fonte}</div>}
                    </td>
                    <td>{fmtEur(r.base_imponibile)}</td>
                    <td>{r.tasso != null ? `${r.tasso} ${r.tasso_unita === "percento" ? "%" : "‰"}` : "—"}</td>
                    <td>{fmtEur(r.premio_imponibile)}</td>
                    <td>{fmtEur(r.premio_lordo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
