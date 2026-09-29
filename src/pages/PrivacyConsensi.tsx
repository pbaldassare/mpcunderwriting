import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, FileText, Users, CheckCircle, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";
import { matchesSearchFields } from "@/lib/searchNoEmail";

const tipiConsenso = ["obbligatorio", "marketing", "profilazione", "comunicazioni"];
const fontiConsenso = ["digitale", "cartaceo", "legacy"];

export default function PrivacyConsensi() {
  const qc = useQueryClient();
  const [infoDialog, setInfoDialog] = useState(false);
  const [consensoDialog, setConsensoDialog] = useState(false);
  const [searchClienti, setSearchClienti] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [newInfo, setNewInfo] = useState({ titolo: "", versione: "", contenuto: "" });
  const [newConsenso, setNewConsenso] = useState({ cliente_id: "", informativa_id: "", tipo_consenso: "", fonte: "digitale" });

  // Informative
  const { data: informative } = useQuery({
    queryKey: ["privacy-informative"],
    queryFn: async () => {
      const { data } = await supabase.from("privacy_informative").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Consensi
  const { data: consensi } = useQuery({
    queryKey: ["privacy-consensi", selectedCliente],
    queryFn: async () => {
      let q = supabase.from("privacy_consensi").select("*, privacy_informative(titolo, versione), profiles!privacy_consensi_cliente_id_fkey(nome, cognome, email)");
      if (selectedCliente) q = q.eq("cliente_id", selectedCliente);
      const { data } = await q.order("data_consenso", { ascending: false });
      return data || [];
    },
  });

  // Clienti per select
  const { data: clienti } = useQuery({
    queryKey: ["clienti-privacy"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome, email").eq("ruolo", "cliente");
      return data || [];
    },
  });

  // Stats
  const totConsensi = consensi?.length || 0;
  const totDati = consensi?.filter((c: any) => c.stato === "dato").length || 0;
  const totRevocati = consensi?.filter((c: any) => c.stato === "revocato").length || 0;

  const creaInformativa = async () => {
    const { error } = await supabase.from("privacy_informative").insert(newInfo);
    if (error) { toast.error(error.message); return; }
    toast.success("Informativa creata");
    setInfoDialog(false);
    setNewInfo({ titolo: "", versione: "", contenuto: "" });
    qc.invalidateQueries({ queryKey: ["privacy-informative"] });
  };

  const toggleInformativa = async (id: string, attiva: boolean) => {
    await supabase.from("privacy_informative").update({ attiva: !attiva }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["privacy-informative"] });
  };

  const registraConsenso = async () => {
    const { error } = await supabase.from("privacy_consensi").insert({
      cliente_id: newConsenso.cliente_id,
      informativa_id: newConsenso.informativa_id || null,
      tipo_consenso: newConsenso.tipo_consenso,
      stato: "dato",
      fonte: newConsenso.fonte,
      data_consenso: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    await logAttivita({ azione: "registrazione_consenso", entita_tipo: "privacy", entita_id: newConsenso.cliente_id, dettagli_json: { tipo: newConsenso.tipo_consenso } });
    toast.success("Consenso registrato");
    setConsensoDialog(false);
    setNewConsenso({ cliente_id: "", informativa_id: "", tipo_consenso: "", fonte: "digitale" });
    qc.invalidateQueries({ queryKey: ["privacy-consensi"] });
  };

  const revocaConsenso = async (consenso: any) => {
    // Insert new row with stato = revocato
    const { error } = await supabase.from("privacy_consensi").insert({
      cliente_id: consenso.cliente_id,
      informativa_id: consenso.informativa_id,
      tipo_consenso: consenso.tipo_consenso,
      stato: "revocato",
      fonte: "digitale",
      data_consenso: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    await logAttivita({ azione: "revoca_consenso", entita_tipo: "privacy", entita_id: consenso.cliente_id, dettagli_json: { tipo: consenso.tipo_consenso } });
    toast.success("Consenso revocato");
    qc.invalidateQueries({ queryKey: ["privacy-consensi"] });
  };

  const filteredClienti = clienti?.filter((c: any) =>
    matchesSearchFields(searchClienti, [c.nome, c.cognome]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Privacy & Consensi</h1>
          <p className="text-muted-foreground">Gestione informative privacy e consensi clienti</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Informative Attive</p><p className="text-2xl font-bold">{informative?.filter((i: any) => i.attiva).length || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Totale Consensi</p><p className="text-2xl font-bold">{totConsensi}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> Dati</p><p className="text-2xl font-bold text-green-600">{totDati}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><XCircle className="h-4 w-4 text-red-500" /> Revocati</p><p className="text-2xl font-bold text-red-600">{totRevocati}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="informative">
        <TabsList>
          <TabsTrigger value="informative"><FileText className="h-4 w-4 mr-1" /> Informative</TabsTrigger>
          <TabsTrigger value="consensi"><Users className="h-4 w-4 mr-1" /> Consensi</TabsTrigger>
        </TabsList>

        {/* TAB INFORMATIVE */}
        <TabsContent value="informative" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={infoDialog} onOpenChange={setInfoDialog}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nuova Informativa</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuova Informativa Privacy</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Titolo</Label><Input value={newInfo.titolo} onChange={e => setNewInfo({ ...newInfo, titolo: e.target.value })} /></div>
                  <div><Label>Versione</Label><Input value={newInfo.versione} onChange={e => setNewInfo({ ...newInfo, versione: e.target.value })} placeholder="es: 1.0" /></div>
                  <div><Label>Contenuto</Label><Textarea value={newInfo.contenuto} onChange={e => setNewInfo({ ...newInfo, contenuto: e.target.value })} rows={6} /></div>
                  <Button onClick={creaInformativa} className="w-full">Crea Informativa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Versione</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Creata il</TableHead>
                  <TableHead>Attiva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {informative?.map((info: any) => (
                  <TableRow key={info.id}>
                    <TableCell className="font-medium">{info.titolo}</TableCell>
                    <TableCell>{info.versione}</TableCell>
                    <TableCell><Badge className={info.attiva ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{info.attiva ? "Attiva" : "Disattiva"}</Badge></TableCell>
                    <TableCell>{format(new Date(info.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell><Switch checked={info.attiva} onCheckedChange={() => toggleInformativa(info.id, info.attiva)} /></TableCell>
                  </TableRow>
                ))}
                {!informative?.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessuna informativa</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB CONSENSI */}
        <TabsContent value="consensi" className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca cliente..." value={searchClienti} onChange={e => setSearchClienti(e.target.value)} className="pl-9" />
            </div>
            <Select value={selectedCliente || "tutti"} onValueChange={v => setSelectedCliente(v === "tutti" ? null : v)}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Filtra per cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti i clienti</SelectItem>
                {filteredClienti?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} {c.cognome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={consensoDialog} onOpenChange={setConsensoDialog}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Registra Consenso</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registra Consenso</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Cliente</Label>
                    <Select value={newConsenso.cliente_id} onValueChange={v => setNewConsenso({ ...newConsenso, cliente_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                      <SelectContent>{clienti?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} {c.cognome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Informativa</Label>
                    <Select value={newConsenso.informativa_id} onValueChange={v => setNewConsenso({ ...newConsenso, informativa_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona informativa" /></SelectTrigger>
                      <SelectContent>{informative?.filter((i: any) => i.attiva).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.titolo} v{i.versione}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Tipo Consenso</Label>
                    <Select value={newConsenso.tipo_consenso} onValueChange={v => setNewConsenso({ ...newConsenso, tipo_consenso: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                      <SelectContent>{tipiConsenso.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Fonte</Label>
                    <Select value={newConsenso.fonte} onValueChange={v => setNewConsenso({ ...newConsenso, fonte: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{fontiConsenso.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={registraConsenso} className="w-full">Registra</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Informativa</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consensi?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.profiles ? `${c.profiles.nome} ${c.profiles.cognome}` : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.tipo_consenso}</Badge></TableCell>
                    <TableCell>
                      <Badge className={c.stato === "dato" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {c.stato === "dato" ? <><CheckCircle className="h-3 w-3 mr-1" /> Dato</> : <><XCircle className="h-3 w-3 mr-1" /> Revocato</>}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.privacy_informative ? `${c.privacy_informative.titolo} v${c.privacy_informative.versione}` : "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{c.fonte || "—"}</Badge></TableCell>
                    <TableCell>{format(new Date(c.data_consenso), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      {c.stato === "dato" && (
                        <Button size="sm" variant="destructive" onClick={() => revocaConsenso(c)}>Revoca</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!consensi?.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun consenso registrato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
