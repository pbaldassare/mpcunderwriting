import { useNavigate } from "react-router-dom";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RcaTableCard } from "@/components/rca/RcaPageChrome";
import { formatScadenzaRca, type RcaClientelaRow } from "@/lib/rca/clientela";
import { preventivaPath, urgenzaScadenzaRca, type UrgenzaScadenzaRca } from "@/lib/rca/scadenze";
import { cn } from "@/lib/utils";

const URGENZA_CLASS: Record<UrgenzaScadenzaRca, string> = {
  scaduta: "text-destructive font-medium",
  "30": "text-orange-600 font-medium",
  "60": "text-amber-700",
  "90": "",
  oltre: "text-muted-foreground",
  sconosciuta: "text-muted-foreground",
};

type Props = {
  rows: RcaClientelaRow[];
  isLoading?: boolean;
  today: string;
  emptyText?: string;
  showPreventiva?: boolean;
};

export function RcaVeicoliTable({
  rows,
  isLoading,
  today,
  emptyText = "Nessun veicolo nei filtri attuali",
  showPreventiva = true,
}: Props) {
  const navigate = useNavigate();
  const colSpan = showPreventiva ? 6 : 5;

  const openCliente = (row: RcaClientelaRow) => {
    if (row.clienteId) navigate(`/archivi/clienti/${row.clienteId}`);
    else if (row.titoloId) navigate(`/titoli/${row.titoloId}`);
  };

  return (
    <RcaTableCard>
      <Table className="w-full min-w-0 table-fixed" containerClassName="overflow-x-hidden">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[28%]" />
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
          {showPreventiva && <col className="w-[12%]" />}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead className="px-3">Targa</TableHead>
            <TableHead className="px-3">Cliente</TableHead>
            <TableHead className="px-3">Tipo</TableHead>
            <TableHead className="px-3">N° polizza</TableHead>
            <TableHead className="px-3">Scadenza</TableHead>
            {showPreventiva && <TableHead className="px-3 text-right">Azioni</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="px-3 py-10 text-center text-muted-foreground">
                Caricamento…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="px-3 py-10 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const urgenza = urgenzaScadenzaRca(row.scadenza, today);
              return (
                <TableRow key={row.veicoloId} className="cursor-pointer" onClick={() => openCliente(row)}>
                  <TableCell className="px-3 py-2.5 font-mono font-medium tracking-wide">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{row.targa}</span>
                    </span>
                  </TableCell>
                  <TableCell className="truncate px-3 py-2.5" title={row.clienteNome}>
                    {row.clienteNome}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Badge variant="secondary">{row.tipoLabel}</Badge>
                  </TableCell>
                  <TableCell
                    className="truncate px-3 py-2.5 text-primary"
                    onClick={(e) => {
                      if (!row.titoloId) return;
                      e.stopPropagation();
                      navigate(`/titoli/${row.titoloId}`);
                    }}
                  >
                    {row.numeroPolizza || "—"}
                  </TableCell>
                  <TableCell className={cn("whitespace-nowrap px-3 py-2.5", URGENZA_CLASS[urgenza])}>
                    {formatScadenzaRca(row.scadenza)}
                  </TableCell>
                  {showPreventiva && (
                    <TableCell className="px-3 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(preventivaPath(row));
                        }}
                      >
                        Preventiva
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </RcaTableCard>
  );
}
