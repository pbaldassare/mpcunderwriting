import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  AlertTriangle,
  MessageSquare,
  Car,
  Building2,
  Calendar,
  Info,
  ExternalLink,
  UserCheck,
  Briefcase,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  canaleId: string;
}

const entitaRoute: Record<string, (id: string) => string> = {
  cliente: (id) => `/archivi/clienti/${id}`,
  titolo: (id) => `/titoli/${id}`,
  sinistro: (id) => `/sinistri/${id}`,
  trattativa: (id) => `/trattative?id=${id}`,
  prospect: (id) => `/archivi/prospect/${id}`,
};

const entitaLabels: Record<string, string> = {
  cliente: "Cliente",
  titolo: "Polizza",
  sinistro: "Sinistro",
  trattativa: "Trattativa",
  prospect: "Prospect",
  argomento: "Argomento",
};

export default function StaffCanaleContextHeader({ canaleId }: Props) {
  const { data: canale } = useQuery({
    queryKey: ["chat_canale_info", canaleId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_canali")
        .select("id, nome, tipo, entita_tipo, entita_id, ambito, visibile_cliente")
        .eq("id", canaleId)
        .maybeSingle();
      return data;
    },
    enabled: !!canaleId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["staff_canale_context_info", canaleId, canale?.entita_tipo, canale?.entita_id],
    queryFn: async () => {
      if (!canale || canale.ambito !== "contestuale") return null;

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
          .select("numero_sinistro, tipo_sinistro, stato, data_evento, targa_veicolo, titoli:titolo_id(numero_titolo)")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "sinistro" as const, canale, sinistro: s };
      }

      if (canale.entita_tipo === "cliente" && canale.entita_id) {
        const { data: c } = await supabase
          .from("clienti")
          .select("nome, cognome, ragione_sociale, codice_cliente")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "cliente" as const, canale, cliente: c };
      }

      if (canale.entita_tipo === "trattativa" && canale.entita_id) {
        const { data: t } = await supabase
          .from("trattative")
          .select("prodotto, stato, clienti:cliente_id(cognome, nome, ragione_sociale)")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "trattativa" as const, canale, trattativa: t };
      }

      return { tipo: canale.entita_tipo, canale };
    },
    enabled: !!canale && canale.ambito === "contestuale",
  });

  const { data: membriCount } = useQuery({
    queryKey: ["chat_canali_membri_count", canaleId],
    queryFn: async () => {
      const { count } = await supabase
        .from("chat_canali_membri")
        .select("id", { count: "exact", head: true })
        .eq("canale_id", canaleId);
      return count ?? 0;
    },
    enabled: !!canaleId,
  });

  if (!canale || canale.ambito !== "contestuale") return null;

  if (isLoading) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-2.5 min-h-[44px] flex items-center">
        <Skeleton className="h-5 w-64" />
      </div>
    );
  }

  const routeFn = canale.entita_tipo ? entitaRoute[canale.entita_tipo] : undefined;
  const detailHref = canale.entita_id && routeFn ? routeFn(canale.entita_id) : null;
  const label = entitaLabels[canale.entita_tipo || ""] || canale.entita_tipo;

  const Wrapper: React.FC<{ children: React.ReactNode; tone?: "primary" | "amber" | "muted" }> = ({
    children,
    tone = "muted",
  }) => (
    <div
      className={`border-b border-border px-4 py-2.5 min-h-[44px] flex items-center gap-2 flex-wrap ${
        tone === "primary"
          ? "bg-primary/5"
          : tone === "amber"
            ? "bg-amber-50 dark:bg-amber-950/20"
            : "bg-muted/30"
      }`}
    >
      {children}
      {canale.visibile_cliente && (
        <Badge variant="outline" className="text-[10px] ml-auto">
          Visibile al cliente
        </Badge>
      )}
      {membriCount != null && membriCount > 0 && (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Users className="h-3 w-3" /> {membriCount} {membriCount === 1 ? "membro" : "membri"}
        </Badge>
      )}
    </div>
  );

  if (data?.tipo === "titolo") {
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
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {detailHref ? (
          <Link to={detailHref} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Badge variant="default" className="font-mono text-[11px] cursor-pointer">
              {t.numero_titolo ? `N° ${t.numero_titolo}` : "Polizza senza numero"}
            </Badge>
            <ExternalLink className="h-3 w-3 text-primary" />
          </Link>
        ) : (
          <Badge variant="default" className="font-mono text-[11px]">
            {t.numero_titolo || "Polizza"}
          </Badge>
        )}
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
      </Wrapper>
    );
  }

  if (data?.tipo === "sinistro") {
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
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {detailHref ? (
          <Link to={detailHref} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Badge variant="default" className="bg-amber-600 hover:bg-amber-700 font-mono text-[11px] cursor-pointer">
              {s.numero_sinistro ? `N° ${s.numero_sinistro}` : "Sinistro"}
            </Badge>
            <ExternalLink className="h-3 w-3 text-amber-700" />
          </Link>
        ) : (
          <Badge variant="default" className="bg-amber-600 font-mono text-[11px]">
            {s.numero_sinistro || "Sinistro"}
          </Badge>
        )}
        {s.data_evento && (
          <Badge variant="outline" className="text-[11px] gap-1">
            <Calendar className="h-3 w-3" /> {format(new Date(s.data_evento), "dd/MM/yyyy")}
          </Badge>
        )}
        {s.stato && <Badge variant="outline" className="text-[11px] capitalize">{s.stato}</Badge>}
      </Wrapper>
    );
  }

  if (data?.tipo === "cliente") {
    const c: any = data.cliente;
    const nome = c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`.trim() || "Cliente";
    return (
      <Wrapper tone="primary">
        <UserCheck className="h-4 w-4 text-primary shrink-0" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {detailHref ? (
          <Link to={detailHref} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Badge variant="default" className="text-[11px] cursor-pointer">{nome}</Badge>
            <ExternalLink className="h-3 w-3 text-primary" />
          </Link>
        ) : (
          <Badge variant="default" className="text-[11px]">{nome}</Badge>
        )}
      </Wrapper>
    );
  }

  if (data?.tipo === "trattativa") {
    const t: any = data.trattativa;
    const cl = t?.clienti?.ragione_sociale || `${t?.clienti?.cognome || ""} ${t?.clienti?.nome || ""}`.trim();
    const title = t?.prodotto || canale.nome || "Trattativa";
    return (
      <Wrapper tone="muted">
        <Briefcase className="h-4 w-4 text-primary shrink-0" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {detailHref ? (
          <Link to={detailHref} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Badge variant="outline" className="text-[11px] cursor-pointer">{title}</Badge>
            <ExternalLink className="h-3 w-3 text-primary" />
          </Link>
        ) : (
          <Badge variant="outline" className="text-[11px]">{title}</Badge>
        )}
        {cl && <span className="text-[11px] text-muted-foreground">• {cl}</span>}
      </Wrapper>
    );
  }

  if (canale.entita_tipo === "argomento") {
    return (
      <Wrapper tone="muted">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground">{canale.nome || "Argomento"}</span>
      </Wrapper>
    );
  }

  return (
    <Wrapper tone="muted">
      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {canale.nome && <span className="text-sm font-medium">{canale.nome}</span>}
    </Wrapper>
  );
}
