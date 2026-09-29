import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Plus, Trash2, Library } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  addCbBotFonteSito,
  applyFontiUfficiali,
  seedFontiUfficialiSeVuoto,
  removeCbBotFonteSito,
  type CbBotFonteSito,
} from "@/lib/cbBotFontiSiti";

const CbBotFontiSitiPage = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<CbBotFonteSito[]>(() => seedFontiUfficialiSeVuoto());

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const res = addCbBotFonteSito(url);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows(res.rows);
    setUrl("");
    toast.success("Sito aggiunto. L’estrazione dati arriverà dopo.");
  };

  const onSeedOfficial = () => {
    const { rows: next, added } = applyFontiUfficiali();
    setRows(next);
    if (added === 0) toast.info("Le fonti ufficiali sono già tutte in elenco.");
    else toast.success(`Aggiunte ${added} fonti ufficiali.`);
  };

  const onRemove = (id: string) => {
    setRows(removeCbBotFonteSito(id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cb-bot")} title="Torna a Cb Bot">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Fonti siti</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Elenco dei siti da cui alimentare l’Assistente Web. Per ora si salvano gli URL; lo scarico automatico non è ancora attivo.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onSeedOfficial}>
            <Library className="h-4 w-4 mr-1" />
            Carica fonti ufficiali
          </Button>
        </div>
      </div>

      <form onSubmit={onAdd} className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Label htmlFor="fonte-url">URL del sito</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="fonte-url"
            type="url"
            placeholder="https://www.ivass.it/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nessun sito. Usa “Carica fonti ufficiali” o aggiungi un URL.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.gruppo ? (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {r.gruppo}
                    </Badge>
                  ) : null}
                  <span className="text-sm font-medium text-foreground truncate">
                    {r.titolo || r.url}
                  </span>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-muted-foreground truncate hover:underline block"
                >
                  {r.url}
                </a>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(r.id)} title="Rimuovi">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CbBotFontiSitiPage;
