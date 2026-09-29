import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

interface ResendRecord {
  record: string;
  name: string;
  type: string;
  ttl: string | number;
  status: string;
  value: string;
  priority?: number;
}

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  region?: string;
  created_at?: string;
  records?: ResendRecord[];
  _detail_error?: any;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "verified") return <Badge className="bg-emerald-600 hover:bg-emerald-600">✓ Verified</Badge>;
  if (s === "pending" || s === "not_started" || s === "temporary_failure")
    return <Badge variant="secondary" className="bg-amber-100 text-amber-900">⏳ {status}</Badge>;
  if (s === "failure" || s === "failed") return <Badge variant="destructive">✗ {status}</Badge>;
  return <Badge variant="outline">{status || "unknown"}</Badge>;
}

function recordStatusIcon(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "verified") return <span className="text-emerald-600">✓</span>;
  if (s === "pending" || s === "not_started") return <span className="text-amber-600">⏳</span>;
  return <span className="text-destructive">✗</span>;
}

export function ResendDomainStatus() {
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<ResendDomain[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("check-resend-domain", { body: {} });
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(`${data.error}${data.details ? ": " + JSON.stringify(data.details) : ""}`);
        setDomains([]);
      } else {
        setDomains(data?.domains || []);
      }
    } catch (e: any) {
      setError(e?.message || "Errore chiamata diagnostica");
    } finally {
      setLoading(false);
    }
  }

  function copyVal(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("Copiato");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Stato dominio Resend
          </span>
          <Button size="sm" variant="outline" onClick={check} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Verifica
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!domains && !error && (
          <p className="text-sm text-muted-foreground">
            Clicca "Verifica" per leggere lo stato reale dei domini configurati su Resend e i record DNS richiesti.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertTitle>Errore diagnostica</AlertTitle>
            <AlertDescription className="text-xs break-all">{error}</AlertDescription>
          </Alert>
        )}

        {domains && domains.length === 0 && !error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Nessun dominio configurato su Resend</AlertTitle>
            <AlertDescription>
              La API key non vede alcun dominio. Devi aggiungere <code>iaconnect.it</code> dalla dashboard Resend.
              <a
                href="https://resend.com/domains"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 ml-2 underline"
              >
                Apri Resend <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        )}

        {domains?.map((d) => (
          <div key={d.id} className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{d.name}</div>
                <div className="text-xs text-muted-foreground">{d.region || "—"} · creato {d.created_at?.slice(0, 10)}</div>
              </div>
              {statusBadge(d.status)}
            </div>

            {d.status?.toLowerCase() !== "verified" && (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="text-sm">Dominio non verificato</AlertTitle>
                <AlertDescription className="text-xs">
                  Aggiungi i record DNS qui sotto sul tuo provider DNS (es. Aruba, Cloudflare, Register.it). Dopo
                  qualche minuto Resend li rileverà automaticamente.
                </AlertDescription>
              </Alert>
            )}

            {d.records && d.records.length > 0 && (
              <TableScrollArea className="">
          <table className="w-full min-w-max text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Stato</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Value</th>
                      <th className="text-left p-2 font-medium">TTL</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.records.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{recordStatusIcon(r.status)}</td>
                        <td className="p-2 font-mono">{r.type}</td>
                        <td className="p-2 font-mono break-all">{r.name}</td>
                        <td className="p-2 font-mono break-all max-w-[280px]">{r.value}</td>
                        <td className="p-2">{r.ttl}</td>
                        <td className="p-2">
                          <Button size="icon" variant="ghost" onClick={() => copyVal(r.value)} className="h-6 w-6">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollArea>
            )}

            {d._detail_error && (
              <p className="text-xs text-destructive">Dettaglio non disponibile: {JSON.stringify(d._detail_error)}</p>
            )}
          </div>
        ))}

        {domains && domains.length > 0 && (
          <a
            href="https://resend.com/emails"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Vai al log invii su Resend
          </a>
        )}
      </CardContent>
    </Card>
  );
}
