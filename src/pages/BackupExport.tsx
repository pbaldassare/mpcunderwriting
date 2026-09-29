import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileCode, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { toast } from "sonner";

interface ExportDef {
  label: string;
  table: "titoli" | "sinistri" | "movimenti_contabili" | "rimessa_premi";
  columns: string;
}

const EXPORTS: ExportDef[] = [
  { label: "Titoli", table: "titoli", columns: "id,numero_titolo,stato,premio_lordo,importo_incassato,data_incasso,created_at" },
  { label: "Sinistri", table: "sinistri", columns: "id,numero_sinistro,stato,data_apertura,data_chiusura,descrizione,created_at" },
  { label: "Movimenti Contabili", table: "movimenti_contabili", columns: "id,data_movimento,tipo,importo,categoria,descrizione,stato,created_at" },
  { label: "Rimesse Premi", table: "rimessa_premi", columns: "id,stato,totale_importi,data_creazione,created_at" },
];

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const v = row[h];
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
  return lines.join("\n");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function toXml(rows: Record<string, unknown>[], tableName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<export table="${tableName}" date="${date}" count="${rows.length}">`];
  for (const row of rows) {
    lines.push("  <row>");
    for (const [key, val] of Object.entries(row)) {
      const s = val == null ? "" : String(val);
      lines.push(`    <${key}>${escapeXml(s)}</${key}>`);
    }
    lines.push("  </row>");
  }
  lines.push("</export>");
  return lines.join("\n");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const bom = mimeType.includes("csv") ? "\uFEFF" : "";
  const blob = new Blob([bom + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Format = "csv" | "xml";

const BackupExport = () => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (def: ExportDef, format: Format) => {
    const key = `${def.table}_${format}`;
    setLoading(key);
    try {
      const { data, error } = await supabase.from(def.table).select(def.columns).limit(10000);
      if (error) throw error;
      if (!data?.length) {
        toast.success("Nessun dato", { description: `La tabella ${def.label} è vuota.` });
        return;
      }
      const rows = data as unknown as Record<string, unknown>[];
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        downloadBlob(toCsv(rows), `${def.table}_${dateStr}.csv`, "text/csv");
      } else {
        downloadBlob(toXml(rows, def.table), `${def.table}_${dateStr}.xml`, "application/xml");
      }
      await logAttivita({
        azione: "export_dati",
        entita_tipo: def.table,
        entita_id: "00000000-0000-0000-0000-000000000000",
        dettagli_json: { righe: data.length, formato: format },
      });
      toast.success("Export completato", { description: `${data.length} righe esportate in ${format.toUpperCase()}.` });
    } catch (e: any) {
      toast.error("Errore export");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Backup & Export</h1>
      <p className="text-muted-foreground text-sm">
        Il backup del database è gestito automaticamente da Supabase. Qui puoi esportare i dati delle tabelle critiche in formato CSV o XML.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {EXPORTS.map((def) => (
          <Card key={def.table}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{def.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Tabella: <code className="bg-muted px-1 rounded">{def.table}</code>
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleExport(def, "csv")}
                  disabled={!!loading}
                >
                  {loading === `${def.table}_csv` ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  Esporta CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport(def, "xml")}
                  disabled={!!loading}
                >
                  {loading === `${def.table}_xml` ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <FileCode className="w-4 h-4 mr-1" />
                  )}
                  Esporta XML
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BackupExport;
