import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { appendiceTipoLabel, isAppendice } from "@/lib/quietanze";

interface PolizzaHeaderCardProps {
  /** Titolo già caricato (preferito quando disponibile). */
  titolo?: any;
  /** In alternativa, ID titolo da fetchare. */
  titoloId?: string | null;
  /** Titolo della pagina (es. "Sospensione Polizza"). Se omesso usa "Polizza/Appendice {numero}". */
  pageTitle?: string;
  /** Sottotitolo descrittivo della pagina. */
  pageSubtitle?: string;
  /** Path di ritorno per il pulsante back. Se omesso, il bottone non viene mostrato. */
  backTo?: string;
  /** Callback custom per il back (sovrascrive backTo). */
  onBack?: () => void;
  /** Mostra il badge di stato titolo (default true se titolo presente). */
  showStato?: boolean;
}

/**
 * Header polizza unificato — usato su TitoloDetail e su tutte le pagine
 * di operazione (sospensione/riattivazione/storno/duplicazione/rinnovo/appendici/...).
 *
 * Layout: back button · titolo pagina · meta secondaria (prodotto · compagnia)
 *         + chip Cliente · Sede · Importo Firma + badge stato.
 */
export function PolizzaHeaderCard({
  titolo: titoloProp,
  titoloId,
  pageTitle,
  pageSubtitle,
  backTo,
  onBack,
  showStato,
}: PolizzaHeaderCardProps) {
  const navigate = useNavigate();

  const { data: titoloFetched } = useQuery({
    queryKey: ["polizza-header-titolo", titoloId],
    queryFn: async () => {
      if (!titoloId) return null;
      const { data } = await supabase
        .from("titoli")
        .select(
          "id, numero_titolo, stato, premio_lordo, prodotto_nome, " +
            "is_appendice_modifica, is_proroga, is_regolazione, sostituisce_polizza, " +
            "cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale), " +
            "uffici(nome_ufficio), " +
            "prodotti(nome_prodotto, compagnie(nome)), " +
            "compagnia_diretta:compagnie!titoli_compagnia_id_fkey(nome)",
        )
        .eq("id", titoloId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!titoloId && !titoloProp,
  });

  const t: any = titoloProp || titoloFetched;
  const showStatoBadge = showStato ?? !!t;

  const clienteLabel = t?.cliente_anagrafica
    ? t.cliente_anagrafica.tipo_cliente === "privato"
      ? `${t.cliente_anagrafica.cognome || ""} ${t.cliente_anagrafica.nome || ""}`.trim() || "—"
      : t.cliente_anagrafica.ragione_sociale || "—"
    : "—";

  const defaultEntityLabel = (() => {
    if (!t) return "Polizza";
    if (isAppendice(t)) {
      const sub = appendiceTipoLabel(t);
      return sub ? `Appendice ${sub}` : "Appendice";
    }
    if (t.sostituisce_polizza) return "Quietanza";
    return "Polizza";
  })();

  const titleText =
    pageTitle ||
    (t?.numero_titolo
      ? `${defaultEntityLabel} ${t.numero_titolo}`
      : t?.id
        ? `${defaultEntityLabel} ${String(t.id).slice(0, 8)}`
        : defaultEntityLabel);

  const importoLabel = isAppendice(t || {})
    ? "Importo Appendice"
    : t?.sostituisce_polizza
      ? "Importo Rata"
      : "Importo Firma";

  const subtitleText =
    pageSubtitle ||
    (t
      ? `${t.prodotto_nome || t.prodotti?.nome_prodotto || ""}${
          (t.compagnia_diretta?.nome || t.prodotti?.compagnie?.nome)
            ? ` — ${t.compagnia_diretta?.nome || t.prodotti?.compagnie?.nome}`
            : ""
        }`
      : "");

  const handleBack = () => {
    if (onBack) return onBack();
    if (backTo) navigate(backTo);
  };

  return (
    <div className="flex items-start gap-4">
      {(backTo || onBack) && (
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Indietro">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-foreground">{titleText}</h1>
        {subtitleText && <p className="text-muted-foreground text-sm">{subtitleText}</p>}

        {t && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Cliente:</span>
              <span className="font-medium text-foreground">{clienteLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Sede:</span>
              <span className="font-medium text-foreground">{t.uffici?.nome_ufficio || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{importoLabel}:</span>
              <span className="font-semibold text-teal-700 tabular-nums">{fmtEuro(t.premio_lordo)}</span>
            </div>
          </div>
        )}
      </div>

      {showStatoBadge && t?.stato && (
        t.stato === "in_attesa_rinnovo" ? (
          <Badge className="text-sm bg-orange-500 hover:bg-orange-600 text-white shrink-0">
            In attesa rinnovo
          </Badge>
        ) : (
          <Badge
            variant={
              t.stato === "incassato"
                ? "default"
                : t.stato === "stornato" || t.stato === "annullato"
                  ? "destructive"
                  : "secondary"
            }
            className="text-sm shrink-0"
          >
            {t.stato}
          </Badge>
        )
      )}
    </div>
  );
}

export default PolizzaHeaderCard;
