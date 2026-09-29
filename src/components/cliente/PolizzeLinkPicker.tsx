import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Link2, Car } from "lucide-react";

interface Props {
  clienteIds: string[];
  onPick: (titolo: { id: string; numero_titolo: string | null; targa_telaio: string | null; prodotto_nome: string | null }) => void;
}

export default function PolizzeLinkPicker({ clienteIds, onPick }: Props) {
  const [open, setOpen] = useState(false);

  const { data: polizze } = useQuery({
    queryKey: ["polizze_link_picker", clienteIds],
    queryFn: async () => {
      if (!clienteIds?.length) return [];
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, targa_telaio, prodotto_nome, stato")
        .in("cliente_anagrafica_id", clienteIds)
        .order("numero_titolo");
      return data || [];
    },
    enabled: open && !!clienteIds?.length,
  });

  if (!clienteIds?.length) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Link2 className="h-3.5 w-3.5" />
          Collega polizza
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca per numero, targa, prodotto..." />
          <CommandList>
            <CommandEmpty>Nessuna polizza trovata</CommandEmpty>
            <CommandGroup heading="Le tue polizze">
              {(polizze || []).map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={`${p.numero_titolo || ""} ${p.targa_telaio || ""} ${p.prodotto_nome || ""}`}
                  onSelect={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="flex items-center gap-2 flex-wrap w-full">
                    <span className="font-mono text-xs font-medium">{p.numero_titolo || "—"}</span>
                    {p.targa_telaio && (
                      <Badge variant="secondary" className="font-mono text-[10px] gap-1">
                        <Car className="h-3 w-3" /> {p.targa_telaio}
                      </Badge>
                    )}
                    {p.stato && <Badge variant="outline" className="text-[10px] capitalize">{p.stato}</Badge>}
                  </div>
                  {p.prodotto_nome && (
                    <span className="text-[10px] text-muted-foreground">{p.prodotto_nome}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
