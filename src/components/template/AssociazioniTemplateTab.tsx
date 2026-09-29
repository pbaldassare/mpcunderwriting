import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyPlus, Edit2, Eye, Plus, Search } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { labelSedeTemplate, sedeToUfficioId } from "@/lib/emailBrandingSede";
import { SedeTemplateSelect, sedeOptions, type UfficioOption } from "./SedeTemplateSelect";

export type TemplateAssociazione = {
  id: string;
  nome: string;
  oggetto: string;
  categoria_id: string;
  ufficio_id: string | null;
  attivo: boolean;
};

type Props = {
  templates: TemplateAssociazione[];
  uffici: UfficioOption[];
  categorie: Record<string, string>;
  onNew: (ufficioId: string | null) => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onDuplicate: (id: string) => void;
  onChangeSede: (id: string, ufficioId: string | null) => void;
  canChangeSede?: boolean;
  lockedUfficioId?: string | null;
  canEditTemplate?: (t: TemplateAssociazione) => boolean;
};

export function AssociazioniTemplateTab({
  templates,
  uffici,
  categorie,
  onNew,
  onEdit,
  onPreview,
  onDuplicate,
  onChangeSede,
  canChangeSede = true,
  lockedUfficioId,
  canEditTemplate,
}: Props) {
  const sedeLocked = lockedUfficioId !== undefined;
  const [filtroSede, setFiltroSede] = useState<string>("__tutte__");
  const [q, setQ] = useState("");

  const ufficiById = useMemo(
    () => Object.fromEntries(uffici.map((u) => [u.id, u.nome_ufficio])),
    [uffici],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (filtroSede !== "__tutte__") {
        const want = sedeToUfficioId(filtroSede);
        if ((t.ufficio_id || null) !== want) return false;
      }
      if (term && !t.nome.toLowerCase().includes(term) && !t.oggetto.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [templates, filtroSede, q]);

  const gruppi = useMemo(() => {
    const map = new Map<string, TemplateAssociazione[]>();
    for (const t of filtered) {
      const key = t.ufficio_id || "__globale__";
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === "__globale__") return -1;
      if (b === "__globale__") return 1;
      return (ufficiById[a] || a).localeCompare(ufficiById[b] || b, "it");
    });
    return keys.map((k) => ({
      key: k,
      label: k === "__globale__" ? "Globale (tutte le sedi)" : ufficiById[k] || "Sede",
      rows: map.get(k) || [],
    }));
  }, [filtered, ufficiById]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {!sedeLocked && (
        <div className="w-[280px]">
          <SearchableSelect
            options={[
              { value: "__tutte__", label: "Tutte le sedi" },
              ...sedeOptions(uffici),
            ]}
            value={filtroSede}
            onValueChange={setFiltroSede}
            placeholder="Filtra sede..."
            searchPlaceholder="Cerca sede..."
          />
        </div>
        )}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca template..."
            className="pl-8 h-9"
          />
        </div>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() =>
            onNew(
              sedeLocked
                ? lockedUfficioId ?? null
                : filtroSede === "__tutte__"
                  ? null
                  : sedeToUfficioId(filtroSede),
            )
          }
        >
          <Plus className="h-4 w-4 mr-1" /> Nuovo template
        </Button>
      </div>

      {gruppi.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nessun template associato a questo filtro.
          </CardContent>
        </Card>
      ) : (
        gruppi.map((g) => (
          <Card key={g.key}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">{g.label}</h3>
                <Badge variant="secondary">{g.rows.length}</Badge>
              </div>
              {(!sedeLocked || g.key !== "__globale__") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onNew(sedeLocked ? lockedUfficioId ?? null : g.key === "__globale__" ? null : g.key)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi qui
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="w-[260px]">Sede</TableHead>
                  <TableHead className="text-center">Attivo</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.nome}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">{t.oggetto}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{categorie[t.categoria_id] || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      {canChangeSede ? (
                        <SedeTemplateSelect
                          uffici={uffici}
                          value={t.ufficio_id}
                          onChange={(id) => onChangeSede(t.id, id)}
                        />
                      ) : (
                        <Badge variant="outline">{labelSedeTemplate(t.ufficio_id, ufficiById)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {t.attivo ? "Sì" : "No"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => onPreview(t.id)} title="Anteprima">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDuplicate(t.id)} title="Duplica">
                          <CopyPlus className="h-4 w-4" />
                        </Button>
                        {(!canEditTemplate || canEditTemplate(t)) && (
                          <Button variant="ghost" size="icon" onClick={() => onEdit(t.id)} title="Modifica">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        La sede del template decide quale branding email usare in invio (con fallback al branding globale).
        Attuale associazione: {filtered.length} template
        {filtroSede !== "__tutte__"
          ? ` · filtro ${labelSedeTemplate(sedeToUfficioId(filtroSede), ufficiById)}`
          : ""}
        .
      </p>
    </div>
  );
}
