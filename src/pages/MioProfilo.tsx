import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProfileAvatarUpload from "@/components/utenti/ProfileAvatarUpload";
import ProfileInfoForm from "@/components/utenti/ProfileInfoForm";
import { UserCircle2, Building2, Mail, ShieldCheck } from "lucide-react";
import { ROLE_LABELS } from "@/lib/userLevels";

const MioProfilo = () => {
  const { user, profile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [extra, setExtra] = useState<{ telefono: string; note: string }>({ telefono: "", note: "" });
  const [ufficioName, setUfficioName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, telefono, note, ufficio_id")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setAvatarUrl(data.avatar_url || null);
        setExtra({ telefono: data.telefono || "", note: data.note || "" });
        if (data.ufficio_id) {
          const { data: u } = await supabase
            .from("uffici")
            .select("nome_ufficio")
            .eq("id", data.ufficio_id)
            .maybeSingle();
          setUfficioName(u?.nome_ufficio || "");
        }
      }
    })();
  }, [user]);

  if (!user || !profile) return null;

  const fallback =
    `${(profile.nome || "")[0] || ""}${(profile.cognome || "")[0] || ""}`.toUpperCase() || "U";
  const ruoloLabel = profile.ruolo ? ROLE_LABELS[profile.ruolo] || profile.ruolo : "—";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserCircle2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Il mio profilo</h1>
          <p className="text-sm text-muted-foreground">
            Gestisci i tuoi dati personali e la foto profilo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Foto profilo</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileAvatarUpload
              userId={user.id}
              avatarUrl={avatarUrl}
              fallback={fallback}
              onChange={setAvatarUrl}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Dati personali</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileInfoForm
              userId={user.id}
              mode="self"
              initial={{
                nome: profile.nome || "",
                cognome: profile.cognome || "",
                telefono: extra.telefono,
                note: extra.note,
              }}
              onSaved={(info) => setExtra({ telefono: info.telefono, note: info.note })}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Ruolo</p>
                  <Badge variant="outline">{ruoloLabel}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Sede</p>
                  <p className="font-medium">{ufficioName || "—"}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Email, ruolo e sede sono gestiti dall'amministratore.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MioProfilo;
