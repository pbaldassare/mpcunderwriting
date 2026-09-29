import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, MapPin, FileText, Globe, Pencil, Clock, CheckCircle2, XCircle, Users } from "lucide-react";
import RichiestaModificaDialog from "@/components/cliente/RichiestaModificaDialog";

const ClienteAnagrafica = () => {
  const { user } = useAuth();
  const [cliente, setCliente] = useState<any>(null);
  const [referenti, setReferenti] = useState<any[]>([]);
  const [richieste, setRichieste] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ campo: string; label: string; valore: string | null } | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("clienti").select("*").eq("user_id", user.id).maybeSingle();
    setCliente(data);
    if (data?.id) {
      const { data: req } = await supabase
        .from("richieste_modifica_cliente")
        .select("*")
        .eq("cliente_id", data.id)
        .order("created_at", { ascending: false });
      setReferenti([]);
      setRichieste(req ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Caricamento...</div>;
  if (!cliente) return <div className="text-center py-12 text-muted-foreground">Nessun dato trovato.</div>;

  const sede = [cliente.indirizzo_sede, cliente.cap_sede, cliente.citta_sede, cliente.provincia_sede ? `(${cliente.provincia_sede})` : null].filter(Boolean).join(", ");

  const fields: Array<{ campo: string; label: string; icon: any; value: any; editable?: boolean }> = [
    { campo: "ragione_sociale", label: "Ragione Sociale", icon: Building2, value: cliente.ragione_sociale },
    { campo: "tipo_cliente", label: "Tipo", icon: FileText, value: cliente.tipo_cliente?.toUpperCase() },
    { campo: "partita_iva", label: "P.IVA", icon: FileText, value: cliente.partita_iva },
    { campo: "codice_fiscale_azienda", label: "Codice Fiscale", icon: FileText, value: cliente.codice_fiscale_azienda || cliente.codice_fiscale },
    { campo: "codice_sdi", label: "Codice SDI", icon: FileText, value: cliente.codice_sdi, editable: true },
    { campo: "codice_cig", label: "Codice CIG", icon: FileText, value: cliente.codice_cig, editable: true },
    { campo: "indirizzo_sede", label: "Sede", icon: MapPin, value: sede, editable: true },
    { campo: "email", label: "Email", icon: Mail, value: cliente.email, editable: true },
    { campo: "pec", label: "PEC", icon: Mail, value: cliente.pec, editable: true },
    { campo: "telefono", label: "Telefono", icon: Phone, value: cliente.telefono, editable: true },
    { campo: "nazione", label: "Nazione", icon: Globe, value: cliente.nazione },
    { campo: "settore", label: "Settore", icon: Building2, value: cliente.settore },
  ];

  const pendenti = richieste.filter(r => r.stato === "in_attesa");

  const statoBadge = (s: string) => {
    if (s === "in_attesa") return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />In attesa</Badge>;
    if (s === "approvata") return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Approvata</Badge>;
    if (s === "rifiutata") return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rifiutata</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <div data-tour="cl-anag-page" className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dati Ente</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Anagrafica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f, i) => f.value ? (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 group">
                <f.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-medium text-foreground break-words">{f.value}</p>
                </div>
                {f.editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                    onClick={() => setEditing({ campo: f.campo, label: f.label, valore: String(f.value) })}
                    title="Richiedi modifica"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : null)}
          </div>
        </CardContent>
      </Card>

      {/* Referenti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Referenti ({referenti.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referenti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun referente censito</p>
          ) : (
            <div className="space-y-2">
              {referenti.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="text-sm">
                    <span className="font-medium">{r.nome} {r.cognome}</span>
                    {r.ruolo && <span className="text-muted-foreground"> — {r.ruolo}</span>}
                    <div className="text-xs text-muted-foreground">{[r.email, r.telefono].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Richieste */}
      {richieste.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4 text-primary" /> Richieste di modifica
              {pendenti.length > 0 && <Badge className="bg-yellow-100 text-yellow-800">{pendenti.length} in attesa</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {richieste.slice(0, 10).map(r => (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded bg-muted/30 border border-border/50">
                  <div className="text-sm flex-1 min-w-0">
                    <div className="font-medium">{r.campo_label || r.campo}</div>
                    <div className="text-xs text-muted-foreground line-through truncate">{r.valore_attuale || "—"}</div>
                    <div className="text-xs text-foreground truncate">→ {r.valore_proposto}</div>
                    {r.note_agenzia && <div className="text-xs text-muted-foreground italic mt-1">Note agenzia: {r.note_agenzia}</div>}
                  </div>
                  {statoBadge(r.stato)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <RichiestaModificaDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          clienteId={cliente.id}
          campo={editing.campo}
          campoLabel={editing.label}
          valoreAttuale={editing.valore}
          onCreated={load}
        />
      )}
    </div>
  );
};

export default ClienteAnagrafica;
