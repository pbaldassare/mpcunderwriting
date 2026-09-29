import { supabase } from "@/integrations/supabase/client";
import type { LibroMatricolaRiga } from "@/components/polizze/LibroMatricolaDialog";

export type LibroMatricolaOpTipo =
  | "inclusione"
  | "esclusione"
  | "modifica"
  | "import"
  | "creazione"
  | "eliminazione";

async function nextNOperazione(titoloId: string): Promise<number> {
  const { data } = await supabase
    .from("libro_matricola_operazioni" as any)
    .select("n_operazione")
    .eq("titolo_id", titoloId)
    .order("n_operazione", { ascending: false })
    .limit(1);
  const max = (data as { n_operazione?: number }[] | null)?.[0]?.n_operazione ?? 0;
  return max + 1;
}

export async function insertLibroMatricolaOperazioni(
  titoloId: string,
  ops: Array<{
    tipo: LibroMatricolaOpTipo;
    mezzo_id?: string | null;
    targa?: string | null;
    data_evento?: string | null;
    note?: string | null;
  }>,
  createdBy?: string | null,
) {
  if (!ops.length) return;
  let n = await nextNOperazione(titoloId);
  const rows = ops.map((op) => ({
    titolo_id: titoloId,
    mezzo_id: op.mezzo_id || null,
    n_operazione: n++,
    tipo: op.tipo,
    data_evento: op.data_evento || null,
    targa: op.targa || null,
    note: op.note || null,
    created_by: createdBy || null,
  }));
  const { error } = await supabase.from("libro_matricola_operazioni" as any).insert(rows);
  if (error) throw error;
}

type DbMezzo = {
  id: string;
  targa?: string | null;
  tipologia?: string | null;
  descrizione?: string | null;
  uso_id?: string | null;
  data_immatricolazione?: string | null;
  data_inclusione?: string | null;
  data_esclusione?: string | null;
  note?: string | null;
  n_progressivo?: number | null;
};

function changed(a: string | null | undefined, b: string | null | undefined) {
  return (a || "") !== (b || "");
}

/** Confronta stato DB vs griglia e genera operazioni (create/update/delete + inclusione/esclusione). */
export function buildLibroMatricolaOperazioniDiff(
  existing: DbMezzo[],
  next: LibroMatricolaRiga[],
  deletedIds: string[],
): Array<{
  tipo: LibroMatricolaOpTipo;
  mezzo_id?: string | null;
  targa?: string | null;
  data_evento?: string | null;
  note?: string | null;
}> {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const ops: ReturnType<typeof buildLibroMatricolaOperazioniDiff> = [];

  for (const id of deletedIds) {
    const old = byId.get(id);
    ops.push({
      tipo: "eliminazione",
      mezzo_id: id,
      targa: old?.targa || null,
      data_evento: new Date().toISOString().slice(0, 10),
      note: old?.n_progressivo != null ? `N° ${old.n_progressivo}` : null,
    });
  }

  for (const r of next) {
    if (!r.id || !byId.has(r.id)) {
      ops.push({
        tipo: "creazione",
        mezzo_id: r.id || null,
        targa: r.targa || null,
        data_evento: r.data_inclusione || new Date().toISOString().slice(0, 10),
        note: r.n_progressivo != null ? `N° ${r.n_progressivo}` : null,
      });
      if (r.data_inclusione) {
        ops.push({
          tipo: "inclusione",
          mezzo_id: r.id || null,
          targa: r.targa || null,
          data_evento: r.data_inclusione,
        });
      }
      continue;
    }

    const old = byId.get(r.id)!;
    const fieldsChanged =
      changed(old.targa, r.targa) ||
      changed(old.tipologia, r.tipologia) ||
      changed(old.descrizione, r.descrizione) ||
      changed(old.uso_id, r.usoId) ||
      changed(old.data_immatricolazione, r.data_immatricolazione) ||
      changed(old.note, r.note) ||
      (old.n_progressivo || 0) !== (r.n_progressivo || 0);

    if (changed(old.data_inclusione, r.data_inclusione) && r.data_inclusione) {
      ops.push({
        tipo: "inclusione",
        mezzo_id: r.id,
        targa: r.targa || null,
        data_evento: r.data_inclusione,
      });
    }
    if (changed(old.data_esclusione, r.data_esclusione) && r.data_esclusione) {
      ops.push({
        tipo: "esclusione",
        mezzo_id: r.id,
        targa: r.targa || null,
        data_evento: r.data_esclusione,
      });
    } else if (
      fieldsChanged ||
      changed(old.data_inclusione, r.data_inclusione) ||
      changed(old.data_esclusione, r.data_esclusione)
    ) {
      ops.push({
        tipo: "modifica",
        mezzo_id: r.id,
        targa: r.targa || null,
        data_evento: new Date().toISOString().slice(0, 10),
        note: r.n_progressivo != null ? `N° ${r.n_progressivo}` : null,
      });
    }
  }

  return ops;
}
