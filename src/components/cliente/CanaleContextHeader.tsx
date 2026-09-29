import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, AlertTriangle, MessageSquare, Car, Building2, Calendar, Info, ExternalLink } from "lucide-react";
import { format } from "date-fns";


interface Props {
  canaleId: string;
}

export default function CanaleContextHeader({ canaleId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["canale_context_info", canaleId],
    queryFn: async () => {
      const { data: canale } = await supabase
        .from("chat_canali")
        .select("entita_tipo, entita_id, nome")
        .eq("id", canaleId)
        .maybeSingle();
      if (!canale) return null;

      if (canale.entita_tipo === "titolo" && canale.entita_id) {
        const { data: t } = await supabase
          .from("titoli")
          .select("numero_titolo, targa_telaio, prodotto_nome, compagnie:compagnia_id(nome), rami:ramo_id(nome)")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "titolo" as const, canale, titolo: t };
      }

      if (canale.entita_tipo === "sinistro" && canale.entita_id) {
        const { data: s } = await supabase
          .from("sinistri")
          .select("numero_sinistro, numero_sinistro_compagnia, tipo_sinistro, stato, data_evento, targa_veicolo, titoli:titolo_id(numero_titolo)")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "sinistro" as const, canale, sinistro: s };
      }

      return { tipo: canale.entita_tipo, canale };
    },
    enabled: !!canaleId,
  });

  if (isLoading) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-2.5 min-h-[44px] flex items-center">
        <Skeleton className="h-5 w-64" />
      </div>
    );
  }

  if (!data) return null;

  const Wrapper: React.FC<{ children: React.ReactNode; tone?: "primary" | "amber" | "muted" }> = ({ children, tone = "muted" }) => (
    <div
      className={`border-b border-border px-4 py-2.5 min-h-[44px] flex items-center gap-2 flex-wrap ${
        tone === "primary" ? "bg-primary/5" : tone === "amber" ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/30"
      }`}
    >
      {children}
    </div>
  );

  if (data.tipo === "titolo") {
    const t: any = data.titolo;
    if (!t) {
      return (
        <Wrapper tone="muted">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Polizza non più disponibile</span>
        </Wrapper>
      );
    }
    return (
      <Wrapper tone="primary">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <Link to={`/cliente/polizze/${data.canale.entita_id}`} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
          <Badge variant="default" className="font-mono text-[11px] cursor-pointer">
            {t.numero_titolo ? `Polizza N° ${t.numero_titolo}` : "Polizza senza numero"}
          </Badge>
          <ExternalLink className="h-3 w-3 text-primary" />
        </Link>
        {t.targa_telaio && (
          <Badge variant="secondary" className="font-mono text-[11px] gap-1">
            <Car className="h-3 w-3" /> {t.targa_telaio}
          </Badge>
        )}
        {t.compagnie?.nome && (
          <Badge variant="outline" className="text-[11px] gap-1">
            <Building2 className="h-3 w-3" /> {t.compagnie.nome}
          </Badge>
        )}
        {t.rami?.nome && <span className="text-[11px] text-muted-foreground">{t.rami.nome}</span>}
        {t.prodotto_nome && <span className="text-[11px] text-muted-foreground">• {t.prodotto_nome}</span>}
      </Wrapper>
    );
  }


  if (data.tipo === "sinistro") {
    const s: any = data.sinistro;
    if (!s) {
      return (
        <Wrapper tone="muted">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Sinistro non più disponibile</span>
        </Wrapper>
      );
    }
    return (
      <Wrapper tone="amber">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <Link to={`/cliente/sinistri/${data.canale.entita_id}`} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
          <Badge variant="default" className="bg-amber-600 hover:bg-amber-700 font-mono text-[11px] cursor-pointer">
            {s.numero_sinistro ? `Sinistro N° ${s.numero_sinistro}` : "Sinistro senza numero"}
          </Badge>
          <ExternalLink className="h-3 w-3 text-amber-700" />
        </Link>
        {s.targa_veicolo && (
          <Badge variant="secondary" className="font-mono text-[11px] gap-1">
            <Car className="h-3 w-3" /> {s.targa_veicolo}
          </Badge>
        )}
        {s.tipo_sinistro && <Badge variant="outline" className="text-[11px] capitalize">{s.tipo_sinistro}</Badge>}
        {s.data_evento && (
          <Badge variant="outline" className="text-[11px] gap-1">
            <Calendar className="h-3 w-3" /> {format(new Date(s.data_evento), "dd/MM/yyyy")}
          </Badge>
        )}
        {s.titoli?.numero_titolo && (
          <span className="text-[11px] text-muted-foreground">Polizza {s.titoli.numero_titolo}</span>
        )}
        {s.stato && <Badge variant="outline" className="text-[11px] capitalize ml-auto">{s.stato}</Badge>}
      </Wrapper>
    );
  }


  if (data.tipo === "argomento") {
    return (
      <Wrapper tone="muted">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground">{data.canale.nome || "Argomento"}</span>
      </Wrapper>
    );
  }

  return null;
}
