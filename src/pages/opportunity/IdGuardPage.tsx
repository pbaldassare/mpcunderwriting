import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatDateTimeIT,
  isVerifyBlocked,
  resolveClienteDisplayName,
  resolveIdGuardTarget,
  type IdGuardClienteInput,
} from "@/lib/idGuard";
import { buildIlikeOr, IDGUARD_CLIENTI_SEARCH_COLUMNS } from "@/lib/searchNoEmail";

type TipoFiltro = "tutti" | "privato" | "azienda";

type ClienteRow = IdGuardClienteInput & {
  id: string;
  attivo?: boolean | null;
};

type VerificaRow = {
  id: string;
  cliente_id: string;
  tipo: "email" | "domain";
  target: string;
  stato: "in_corso" | "completata" | "errore";
  chiamata_at: string;
  prossima_verifica_at: string;
  is_pwned: boolean | null;
  mail_esposte: number | null;
  password_esposte: number | null;
  error_message: string | null;
};

const IdGuardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("tutti");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debouncedSearch, tipoFiltro]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientiResult, isLoading } = useQuery({
    queryKey: ["idguard-clienti", debouncedSearch, tipoFiltro, page, pageSize],
    queryFn: async () => {
      let q = supabase
        .from("clienti")
        .select(
          "id, tipo_cliente, nome, cognome, ragione_sociale, email, pec, referente_email, attivo",
          { count: "exact" },
        )
        .is("merged_into", null);

      if (tipoFiltro === "privato") q = q.eq("tipo_cliente", "privato");
      if (tipoFiltro === "azienda") q = q.in("tipo_cliente", ["azienda", "ente"]);

      const searchOr = buildIlikeOr([...IDGUARD_CLIENTI_SEARCH_COLUMNS], debouncedSearch);
      if (searchOr) q = q.or(searchOr);

      const { data, error, count } = await q
        .order("cognome", { ascending: true, nullsFirst: false })
        .order("ragione_sociale", { ascending: true, nullsFirst: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: (data || []) as ClienteRow[], totalCount: count || 0 };
    },
  });

  const clienti = clientiResult?.data || [];
  const totalCount = clientiResult?.totalCount || 0;
  const clienteIds = useMemo(() => clienti.map((c) => c.id), [clienti]);

  const { data: verificheMap = {} } = useQuery({
    queryKey: ["idguard-verifiche", clienteIds],
    enabled: clienteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("idguard_verifiche") as any)
        .select(
          "id, cliente_id, tipo, target, stato, chiamata_at, prossima_verifica_at, is_pwned, mail_esposte, password_esposte, error_message",
        )
        .in("cliente_id", clienteIds);
      if (error) throw error;
      const map: Record<string, VerificaRow> = {};
      for (const row of (data || []) as VerificaRow[]) {
        map[row.cliente_id] = row;
      }
      return map;
    },
  });

  const verificaMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { data, error } = await supabase.functions.invoke("idguard-check", {
        body: { cliente_id: clienteId },
      });
      if (error) {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        let payload: any = data;
        try {
          payload = ctx && typeof ctx.json === "function" ? await ctx.json() : data;
        } catch {
          payload = data;
        }
        const msg = payload?.error || error.message || "Verifica ID Guard non riuscita";
        const err = new Error(msg) as Error & { payload?: any };
        err.payload = payload;
        throw err;
      }
      if (data?.error) {
        const err = new Error(data.error) as Error & { payload?: any };
        err.payload = data;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idguard-verifiche"] });
      toast.success("Verifica ID Guard completata");
    },
    onError: (err: Error & { payload?: any }) => {
      queryClient.invalidateQueries({ queryKey: ["idguard-verifiche"] });
      if (err.payload?.code === "cooldown") {
        toast.error("Verifica già eseguita, ne potrai fare un'altra domani");
        return;
      }
      toast.error(err.message || "Verifica ID Guard non riuscita");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/opportunity")} title="Torna a Opportunity">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">ID Guard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin
                ? "Verifica se le email (privati) e dominio (aziende/enti) sono finite in una fuga di dati. Come amministratore puoi ripetere le verifiche senza limite giornaliero."
                : "Verifica se le email (privati) e dominio (aziende/enti) sono finite in una fuga di dati. Premi su verifica per controllare, limite massimo di una verifica al giorno."}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Clienti ({totalCount})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border overflow-hidden">
                {([
                  ["tutti", "Tutti"],
                  ["privato", "Privati"],
                  ["azienda", "Aziende / enti"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipoFiltro(value)}
                    className={`px-3 py-1.5 text-xs ${
                      tipoFiltro === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, ragione sociale, CF, P.IVA..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Caricamento...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Email / dominio</TableHead>
                    <TableHead>Esito</TableHead>
                    <TableHead className="text-right">Mail esposte</TableHead>
                    <TableHead className="text-right">Password esposte</TableHead>
                    <TableHead>Data chiamata</TableHead>
                    <TableHead className="text-right">Azione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clienti.map((c) => {
                    const target = resolveIdGuardTarget(c);
                    const verifica = verificheMap[c.id];
                    const cooling = isVerifyBlocked(verifica?.prossima_verifica_at, { isAdmin });
                    const verifying = verificaMutation.isPending && verificaMutation.variables === c.id;
                    const canVerify = target.ok && !cooling && !verifying;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{resolveClienteDisplayName(c)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.tipo_cliente || "—"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {target.ok ? target.target : (
                            <span className="text-muted-foreground">
                              {target.missing === "email" ? "Manca email" : "Manca dominio"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!verifica ? (
                            <span className="text-muted-foreground">—</span>
                          ) : verifica.stato === "in_corso" ? (
                            <Badge variant="secondary">In corso</Badge>
                          ) : verifica.stato === "errore" ? (
                            <Badge variant="destructive" title={verifica.error_message || undefined}>
                              Errore
                            </Badge>
                          ) : verifica.is_pwned ? (
                            <Badge variant="destructive">Esposto</Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              Pulito
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {verifica?.mail_esposte != null ? verifica.mail_esposte : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {verifica?.password_esposte != null ? verifica.password_esposte : "—"}
                        </TableCell>
                        <TableCell>{formatDateTimeIT(verifica?.chiamata_at)}</TableCell>
                        <TableCell className="text-right">
                          {cooling ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button size="sm" variant="outline" disabled>
                                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                                    Verifica
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Verifica già eseguita, ne potrai fare un'altra domani</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canVerify}
                              title={
                                !target.ok
                                  ? target.missing === "email"
                                    ? "Manca l'email del cliente"
                                    : "Manca il dominio del cliente"
                                  : undefined
                              }
                              onClick={() => verificaMutation.mutate(c.id)}
                            >
                              {verifying ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShieldCheck className="h-4 w-4 mr-1.5" />
                              )}
                              Verifica
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {clienti.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nessun cliente trovato
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IdGuardPage;
