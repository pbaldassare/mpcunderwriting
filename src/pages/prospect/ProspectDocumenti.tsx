import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Documento {
  id: string;
  nome_file: string;
  categoria: string | null;
  created_at: string | null;
  path_storage: string;
  bucket_name: string;
}

const ProspectDocumenti = () => {
  const { user } = useAuth();
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prospect } = await supabase
        .from("prospect")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prospect) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("documenti")
        .select("id, nome_file, categoria, created_at, path_storage, bucket_name")
        .eq("entita_tipo", "prospect")
        .eq("entita_id", prospect.id)
        .eq("visibile_al_cliente", true)
        .order("created_at", { ascending: false });

      setDocumenti((data as Documento[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleDownload = async (doc: Documento) => {
    const { data, error } = await supabase.storage
      .from(doc.bucket_name)
      .download(doc.path_storage);

    if (error || !data) {
      toast.error("Errore nel download");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome_file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">I miei Documenti</h1>
        <p className="text-sm text-muted-foreground mt-1">Documenti relativi alle tue trattative.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      ) : documenti.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nessun documento disponibile.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documenti.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.nome_file}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.categoria && <Badge variant="secondary" className="text-[10px]">{doc.categoria}</Badge>}
                      {doc.created_at && (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString("it-IT")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProspectDocumenti;
