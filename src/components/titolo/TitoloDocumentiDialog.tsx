import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DocumentiTab from "@/components/DocumentiTab";
import { resolveTitoloDocumentiReadIds } from "@/lib/titoloDocumenti";
import type { AppendicePolizzaRow } from "@/lib/appendiciPolizza";

interface Props {
  titoloId: string;
  chainIds?: string[];
  appendiciPolizza?: AppendicePolizzaRow[];
  isAppendiceView?: boolean;
}

export function TitoloDocumentiTrigger({
  titoloId,
  chainIds,
  appendiciPolizza = [],
  isAppendiceView = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const documentiIdsForRead = useMemo(
    () => resolveTitoloDocumentiReadIds({ titoloId, chainIds, isAppendiceView }),
    [titoloId, chainIds, isAppendiceView],
  );

  const isMadreView = !isAppendiceView && titoloId === (chainIds?.[0] ?? titoloId);
  const appendiciAllegati = useMemo(
    () => (isMadreView ? appendiciPolizza.filter((a) => a.file_path && a.nome_file) : []),
    [appendiciPolizza, isMadreView],
  );

  const documentiIdsKey = [...documentiIdsForRead].sort().join(",");
  const { data: documentiList } = useQuery({
    queryKey: ["documenti", "titolo", "count", documentiIdsKey],
    queryFn: async () => {
      const { data: main } = await supabase
        .from("documenti")
        .select("id")
        .eq("entita_tipo", "titolo")
        .in("entita_id", documentiIdsForRead)
        .order("created_at", { ascending: false });
      return main ?? [];
    },
  });
  const documentiCount = (documentiList?.length ?? 0) + appendiciAllegati.length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <FileText className="w-4 h-4 mr-1.5" />
        Documenti ({documentiCount})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documenti della polizza</DialogTitle>
          </DialogHeader>
          <DocumentiTab
            entitaTipo="titolo"
            entitaId={titoloId}
            entitaIds={documentiIdsForRead}
            bucketName="documenti_titoli"
            showPreview
            appendiciAllegati={appendiciAllegati}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
