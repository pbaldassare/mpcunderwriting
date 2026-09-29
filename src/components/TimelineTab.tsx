import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertCircle, Info, CopyMinus, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TimelineTabProps {
  entitaTipo: string;
  entitaId: string;
  /** Extra entity types/ids to include (e.g. trattative logs for a prospect) */
  extraEntities?: { tipo: string; ids: string[] }[];
}

const ENTITA_LABEL: Record<string, string> = {
  cliente: "Cliente",
  titolo: "Polizza",
  sinistro: "Sinistro",
  trattativa: "Trattativa",
  compagnia: "Agenzia",
  prospect: "Prospect",
};

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { icon: Info, color: "text-primary", badge: "secondary" },
  warning: { icon: AlertTriangle, color: "text-amber-500", badge: "outline" },
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" },
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sì" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

function humanizeField(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

interface FieldChange { old: unknown; new: unknown; }

function extractChanges(details: Record<string, unknown> | null): Record<string, FieldChange> | null {
  if (!details) return null;
  const c = details.changes as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return null;
  const cleaned: Record<string, FieldChange> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v && typeof v === "object") {
      const fc = v as { old?: unknown; new?: unknown };
      cleaned[k] = { old: fc.old ?? null, new: fc.new ?? null };
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function formatDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  if (details.stato_precedente && details.nuovo_stato) {
    return `${details.stato_precedente} → ${details.nuovo_stato}`;
  }
  if (details.descrizione && typeof details.descrizione === "string") {
    return details.descrizione;
  }
  const entries = Object.entries(details).filter(
    ([k, v]) => v != null && v !== "" && !["changes", "op"].includes(k)
  );
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
}

export default function TimelineTab({ entitaTipo, entitaId, extraEntities }: TimelineTabProps) {
  const [filterUser, setFilterUser] = useState("");
  const [filterEntita, setFilterEntita] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["timeline", entitaTipo, entitaId, extraEntities],
    queryFn: async () => {
      const { data: main, error } = await supabase
        .from("log_attivita")
        .select("*, profiles:user_id(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .eq("entita_id", entitaId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      let all = main || [];

      if (extraEntities?.length) {
        for (const extra of extraEntities) {
          if (!extra.ids.length) continue;
          const { data: extraLogs } = await supabase
            .from("log_attivita")
            .select("*, profiles:user_id(nome, cognome)")
            .eq("entita_tipo", extra.tipo)
            .in("entita_id", extra.ids)
            .order("created_at", { ascending: false })
            .limit(100);
          if (extraLogs) all = [...all, ...extraLogs];
        }
      }

      all.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
      return all;
    },
  });

  const entitaTipiPresenti = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l: any) => l.entita_tipo && s.add(l.entita_tipo));
    return Array.from(s);
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((log: any) => {
      if (hideDuplicates && log.is_duplicate) return false;
      if (filterEntita !== "all" && log.entita_tipo !== filterEntita) return false;
      if (filterUser.trim()) {
        const p = log.profiles as any;
        const name = `${p?.nome || ""} ${p?.cognome || ""}`.toLowerCase();
        if (!name.includes(filterUser.toLowerCase())) return false;
      }
      if (dateFrom && new Date(log.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(log.created_at) > end) return false;
      }
      return true;
    });
  }, [logs, hideDuplicates, filterEntita, filterUser, dateFrom, dateTo]);

  const hasActiveFilters = filterUser || filterEntita !== "all" || dateFrom || dateTo || !hideDuplicates;

  if (isLoading) return <p className="text-center py-6 text-muted-foreground text-sm">Caricamento Log Attività…</p>;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5 h-8">
          <Filter className="w-3.5 h-3.5" />
          Filtri
          {hasActiveFilters && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">attivi</Badge>}
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} di {logs.length} eventi
        </span>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-xs">Utente</Label>
            <Input
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="nome o cognome"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Entità</Label>
            <Select value={filterEntita} onValueChange={setFilterEntita}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                {entitaTipiPresenti.map((t) => (
                  <SelectItem key={t} value={t}>{ENTITA_LABEL[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Da</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">A</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Switch id="hide-dup" checked={hideDuplicates} onCheckedChange={setHideDuplicates} />
            <Label htmlFor="hide-dup" className="text-xs cursor-pointer">Nascondi eventi duplicati</Label>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => { setFilterUser(""); setFilterEntita("all"); setDateFrom(""); setDateTo(""); setHideDuplicates(true); }}
            >
              <X className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>
      )}

      {!filtered.length ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Nessuna attività registrata</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((log: any, i: number) => {
            const severity = log.severity || "info";
            const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            const details = log.dettagli_json as Record<string, unknown> | null;
            const changes = extractChanges(details);
            const formattedDetails = formatDetails(details);
            const profile = log.profiles as any;
            const userName = profile ? `${profile.nome || ""} ${profile.cognome || ""}`.trim() : "Sistema";
            const entitaLabel = ENTITA_LABEL[log.entita_tipo] || log.entita_tipo;

            return (
              <div key={log.id} className={`flex gap-3 py-3 relative ${log.is_duplicate ? "opacity-60" : ""}`}>
                {i < filtered.length - 1 && (
                  <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border" />
                )}
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10">
                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Header compatto: Chi · Cosa · Su quale */}
                  <div className="flex items-baseline gap-1.5 flex-wrap text-sm">
                    <span className="font-semibold text-foreground">{userName}</span>
                    <span className="text-muted-foreground">ha</span>
                    <span className="text-foreground">
                      {log.azione?.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entitaLabel}</Badge>
                    {severity !== "info" && (
                      <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0">{severity}</Badge>
                    )}
                    {changes && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {Object.keys(changes).length} {Object.keys(changes).length === 1 ? "campo" : "campi"}
                      </Badge>
                    )}
                    {log.is_duplicate && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-amber-500/50 text-amber-600 dark:text-amber-400">
                        <CopyMinus className="w-3 h-3" /> duplicato
                      </Badge>
                    )}
                  </div>
                  {changes ? (
                    <ul className="mt-1.5 space-y-0.5 text-xs bg-muted/40 rounded px-2 py-1.5">
                      {Object.entries(changes).map(([field, ch]) => (
                        <li key={field} className="flex flex-wrap items-baseline gap-1">
                          <span className="font-medium text-foreground">{humanizeField(field)}:</span>
                          <span className="line-through text-muted-foreground/70">{fmtVal(ch.old)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-foreground font-medium">{fmtVal(ch.new)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : formattedDetails ? (
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {formattedDetails}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    {log.created_at ? format(new Date(log.created_at), "dd MMM yyyy · HH:mm:ss", { locale: it }) : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
