import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Phone, Mail, Clock, Users, Scale, Shield, Briefcase, HeadphonesIcon, User } from "lucide-react";

interface TeamMember {
  nome: string;
  ruolo: string;
  email: string;
}

interface TeamSection {
  titolo: string;
  icon: React.ElementType;
  membri: TeamMember[];
}

const teamData: TeamSection[] = [
  {
    titolo: "Broker",
    icon: Shield,
    membri: [
      { nome: "Maria Midena", ruolo: "Responsabile di sede e Responsabile di Intermediazione", email: "mmidena@consulbrokers.it" },
      { nome: "Ilenia Barbassa", ruolo: "Broker e Direttore Tecnico", email: "ibarbassa@consulbrokers.it" },
    ],
  },
  {
    titolo: "Team Gestione Polizze",
    icon: Briefcase,
    membri: [
      { nome: "Emanuele Marian", ruolo: "Gestione Polizze", email: "emanuelemarian@consulbrokers.it" },
      { nome: "Paola Sforzin", ruolo: "Gestione Polizze", email: "psforzin@consulbrokers.it" },
      { nome: "Claudia Venturato", ruolo: "Gestione Polizze", email: "cventurato@consulbrokers.it" },
      { nome: "Francesca Gusmatti", ruolo: "Gestione Polizze", email: "fgusmatti@consulbrokers.it" },
      { nome: "Stefania Degiovanni", ruolo: "Gestione Polizze", email: "sdegiovanni@consulbrokers.it" },
    ],
  },
  {
    titolo: "Gestione Sinistri",
    icon: HeadphonesIcon,
    membri: [
      { nome: "Anna Pellicani", ruolo: "Gestione Sinistri", email: "apellicani@consulbrokers.it" },
      { nome: "Eleonora Marian", ruolo: "Gestione Sinistri", email: "eleonoramarian@consulbrokers.it" },
      { nome: "Melania Di Lorenzo", ruolo: "Gestione Sinistri", email: "mdilorenzo@consulbrokers.it" },
    ],
  },
  {
    titolo: "Team Commerciale",
    icon: Users,
    membri: [
      { nome: "Sergio Patera", ruolo: "Commerciale", email: "spatera@consulbrokers.it" },
      { nome: "Alessandra Masiero", ruolo: "Commerciale", email: "amasiero@consulbrokers.it" },
      { nome: "Laura Canali", ruolo: "Commerciale", email: "lcanali@consulbrokers.it" },
    ],
  },
  {
    titolo: "Legal",
    icon: Scale,
    membri: [
      { nome: "Enrico Rizzetto", ruolo: "Legal", email: "erizzetto@consulbrokers.it" },
    ],
  },
  {
    titolo: "Loss Adjuster",
    icon: Shield,
    membri: [
      { nome: "Carmaquadro srl", ruolo: "Loss Adjuster", email: "" },
    ],
  },
];

const pecContacts = [
  { label: "PEC Direzione", value: "consulbrokerssandona@pec-mail.it" },
  { label: "PEC Amministrazione", value: "amministrazionecbsandona@pec-mail.it" },
  { label: "PEC Sinistri", value: "uffsinistricbsandona@pec-mail.it" },
];

const ClienteUfficio = () => {
  const { user } = useAuth();
  const [ufficio, setUfficio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cliente } = await supabase
        .from("clienti")
        .select("id, ufficio_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cliente?.ufficio_id) {
        const { data: uf } = await supabase
          .from("uffici")
          .select("*")
          .eq("id", cliente.ufficio_id)
          .maybeSingle();
        setUfficio(uf);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Caricamento...</div>;

  return (
    <div data-tour="cl-uff-page" className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Info e Contatti</h2>

      {/* Sede info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            {ufficio?.nome_ufficio || "Sede operativa di San Donà di Piave"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Indirizzo</p>
                <p className="text-sm font-medium">Via Giobatta dall'Armi 3/2</p>
                <p className="text-sm font-medium">30027 San Donà di Piave (VE)</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Centralino</p>
                <p className="text-sm font-medium">0421 307800</p>
                <p className="text-xs text-muted-foreground mt-1">
                  1-Amministrazione · 2-Tecnico · 3-Sinistri · 4-Contabilità
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Orari</p>
                <p className="text-sm font-medium">Lun — Gio: 8:30–13:30 / 14:30–18:00</p>
                <p className="text-sm font-medium">Venerdì: 8:30–14:30</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Indirizzi PEC</p>
                {pecContacts.map((pec) => (
                  <div key={pec.label} className="mt-1">
                    <p className="text-xs text-muted-foreground">{pec.label}</p>
                    <p className="text-sm font-medium">{pec.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team sections */}
      {teamData.map((section) => (
        <Card key={section.titolo}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <section.icon className="h-4 w-4 text-primary" />
              {section.titolo}
              <Badge variant="secondary" className="ml-auto text-xs">{section.membri.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.membri.map((m) => (
                <div key={m.nome} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{m.ruolo}</p>
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="text-xs text-primary hover:underline break-all">
                        {m.email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ClienteUfficio;
