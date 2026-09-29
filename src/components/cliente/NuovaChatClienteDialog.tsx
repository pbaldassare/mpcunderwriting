import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, FileText, AlertTriangle, Loader2, Car } from "lucide-react";
import { findAllRelatedUsers } from "@/lib/findRelatedUsers";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (canaleId: string) => void;
}

export default function NuovaChatClienteDialog({ open, onClose, onCreated }: Props) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"argomento" | "polizza" | "sinistro">("argomento");
  const [oggetto, setOggetto] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [selTitoloId, setSelTitoloId] = useState<string>("");
  const [selSinistroId, setSelSinistroId] = useState<string>("");
  const [search, setSearch] = useState("");

  // Cliente IDs collegati all'utente loggato
  const { data: clienteIds } = useQuery({
    queryKey: ["my_cliente_ids", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_cliente_ids");
      const arr: any[] = data || [];
      return arr.map((x) => (typeof x === "string" ? x : x.get_my_cliente_ids ?? x.id ?? x)).filter(Boolean) as string[];
    },
    enabled: open && !!user?.id,
  });

  const { data: polizze } = useQuery({
    queryKey: ["cliente_titoli_chat", clienteIds],
    queryFn: async () => {
      if (!clienteIds?.length) return [];
      const [titoliRes, cgaRes] = await Promise.all([
        supabase
          .from("titoli")
          .select("id, numero_titolo, targa_telaio, prodotto_nome, stato, compagnie:compagnia_id(nome), rami:ramo_id(nome)")
          .in("cliente_anagrafica_id", clienteIds)
          .order("numero_titolo"),
        supabase
          .from("polizza_cga")
          .select("id, numero_polizza, stato, prodotti_cga(nome_prodotto, compagnia, ramo)")
          .in("cliente_id", clienteIds)
          .eq("stato", "approvato"),
      ]);
      const fromTitoli = (titoliRes.data || []).map((t: any) => ({ ...t, _source: "titoli" }));
      const fromCga = (cgaRes.data || []).map((p: any) => ({
        id: p.id,
        numero_titolo: p.numero_polizza,
        targa_telaio: null,
        prodotto_nome: p.prodotti_cga?.nome_prodotto ?? p.prodotti_cga?.ramo ?? null,
        stato: p.stato,
        compagnie: p.prodotti_cga?.compagnia ? { nome: p.prodotti_cga.compagnia } : null,
        rami: p.prodotti_cga?.ramo ? { nome: p.prodotti_cga.ramo } : null,
        _source: "cga",
      }));
      return [...fromTitoli, ...fromCga];
    },
    enabled: open && tab === "polizza" && !!clienteIds?.length,
  });


  const { data: sinistri } = useQuery({
    queryKey: ["cliente_sinistri_chat", clienteIds],
    queryFn: async () => {
      if (!clienteIds?.length) return [];
      const { data } = await supabase
        .from("sinistri")
        .select("id, numero_sinistro, tipo_sinistro, stato, data_evento, targa_veicolo")
        .in("cliente_anagrafica_id", clienteIds)
        .neq("stato", "archiviato")
        .order("data_evento", { ascending: false });
      return data || [];
    },
    enabled: open && tab === "sinistro" && !!clienteIds?.length,
  });

  const polizzeFiltrate = (polizze || []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.numero_titolo || "").toLowerCase().includes(q) ||
      (p.targa_telaio || "").toLowerCase().includes(q) ||
      (p.prodotto_nome || "").toLowerCase().includes(q) ||
      (p.compagnie?.nome || "").toLowerCase().includes(q)
    );
  });

  const sinistriFiltrati = (sinistri || []).filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.numero_sinistro || "").toLowerCase().includes(q) ||
      (s.tipo_sinistro || "").toLowerCase().includes(q) ||
      (s.targa_veicolo || "").toLowerCase().includes(q)
    );
  });

  const reset = () => {
    setTab("argomento");
    setOggetto("");
    setMessaggio("");
    setSelTitoloId("");
    setSelSinistroId("");
    setSearch("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !clienteIds?.length) throw new Error("Sessione non valida");

      let entitaTipo: string;
      let entitaId: string | null = null;
      let nome: string;

      if (tab === "argomento") {
        if (!oggetto.trim()) throw new Error("Inserisci l'oggetto della richiesta");
        entitaTipo = "argomento";
        entitaId = clienteIds[0]; // ancora il canale al cliente per discovery membri
        nome = oggetto.trim();
      } else if (tab === "polizza") {
        if (!selTitoloId) throw new Error("Seleziona una polizza");
        const p: any = (polizze || []).find((x: any) => x.id === selTitoloId);
        entitaTipo = "titolo";
        entitaId = selTitoloId;
        nome = `Polizza ${p?.numero_titolo || ""}${p?.prodotto_nome ? ` — ${p.prodotto_nome}` : ""}`.trim();
      } else {
        if (!selSinistroId) throw new Error("Seleziona un sinistro");
        const s: any = (sinistri || []).find((x: any) => x.id === selSinistroId);
        entitaTipo = "sinistro";
        entitaId = selSinistroId;
        nome = `Sinistro ${s?.numero_sinistro || ""}`.trim();
      }

      // Crea canale
      const { data: canale, error } = await supabase
        .from("chat_canali")
        .insert({
          nome,
          tipo: "gruppo",
          ambito: "contestuale",
          entita_tipo: entitaTipo,
          entita_id: entitaId,
          visibile_cliente: true,
          creato_da: profile.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Trova membri collegati
      const lookupTipo = tab === "argomento" ? "cliente" : entitaTipo;
      const lookupId = tab === "argomento" ? clienteIds[0] : entitaId!;
      const related = await findAllRelatedUsers(lookupTipo, lookupId);

      const membriIds = Array.from(new Set([profile.id, ...related.map((r) => r.userId)]));
      const { error: membriErr } = await supabase.from("chat_canali_membri").insert(
        membriIds.map((uid) => ({
          canale_id: canale.id,
          user_id: uid,
          ruolo_canale: uid === profile.id ? "admin" : "membro",
        }))
      );
      if (membriErr) throw membriErr;

      // Primo messaggio opzionale
      if (messaggio.trim()) {
        await supabase.from("chat_messaggi_interni").insert({
          canale_id: canale.id,
          mittente_id: profile.id,
          messaggio: messaggio.trim(),
        });
      }

      return canale.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chat_canali_cliente"] });
      toast.success("Conversazione creata");
      onCreated(id);
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Errore creazione conversazione"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova conversazione</DialogTitle>
          <DialogDescription>
            Scegli il contesto della tua richiesta. La conversazione verrà inoltrata ai referenti collegati.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSearch(""); }}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="argomento" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Argomento
            </TabsTrigger>
            <TabsTrigger value="polizza" className="gap-2">
              <FileText className="h-4 w-4" /> Polizza
            </TabsTrigger>
            <TabsTrigger value="sinistro" className="gap-2">
              <AlertTriangle className="h-4 w-4" /> Sinistro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="argomento" className="space-y-3 mt-4">
            <div>
              <Label htmlFor="oggetto">Oggetto della richiesta *</Label>
              <Input
                id="oggetto"
                value={oggetto}
                onChange={(e) => setOggetto(e.target.value)}
                placeholder="Es. Richiesta preventivo casa"
              />
            </div>
          </TabsContent>

          <TabsContent value="polizza" className="space-y-3 mt-4">
            <Input
              placeholder="Cerca per numero, targa, prodotto o compagnia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-1">
                {polizzeFiltrate.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelTitoloId(p.id)}
                    className={`w-full text-left p-2.5 rounded-md text-sm transition-colors ${
                      selTitoloId === p.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium">{p.numero_titolo || "—"}</span>
                      {p.targa_telaio && (
                        <Badge variant="secondary" className="font-mono text-[10px] gap-1">
                          <Car className="h-3 w-3" /> {p.targa_telaio}
                        </Badge>
                      )}
                      {p.stato && <Badge variant="outline" className="text-[10px] capitalize">{p.stato}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.compagnie?.nome}{p.rami?.nome ? ` • ${p.rami.nome}` : ""}{p.prodotto_nome ? ` • ${p.prodotto_nome}` : ""}
                    </div>
                  </button>
                ))}
                {!polizzeFiltrate.length && (
                  <p className="text-center text-xs text-muted-foreground py-6">Nessuna polizza trovata</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sinistro" className="space-y-3 mt-4">
            <Input
              placeholder="Cerca per numero, tipo o targa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-1">
                {sinistriFiltrati.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setSelSinistroId(s.id)}
                    className={`w-full text-left p-2.5 rounded-md text-sm transition-colors ${
                      selSinistroId === s.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium">{s.numero_sinistro || "—"}</span>
                      {s.targa_veicolo && (
                        <Badge variant="secondary" className="font-mono text-[10px] gap-1">
                          <Car className="h-3 w-3" /> {s.targa_veicolo}
                        </Badge>
                      )}
                      {s.stato && <Badge variant="outline" className="text-[10px] capitalize">{s.stato}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.tipo_sinistro}{s.data_evento ? ` • ${new Date(s.data_evento).toLocaleDateString("it-IT")}` : ""}
                    </div>
                  </button>
                ))}
                {!sinistriFiltrati.length && (
                  <p className="text-center text-xs text-muted-foreground py-6">Nessun sinistro trovato</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="msg">Messaggio iniziale (opzionale)</Label>
          <Input
            id="msg"
            value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)}
            placeholder="Scrivi qui la tua richiesta..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Annulla</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending ||
              (tab === "argomento" && !oggetto.trim()) ||
              (tab === "polizza" && !selTitoloId) ||
              (tab === "sinistro" && !selSinistroId)}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Avvia conversazione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
