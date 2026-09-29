import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Trash2, Loader2 } from "lucide-react";

interface Props {
  userId: string;
  avatarUrl: string | null;
  fallback: string;
  onChange: (url: string | null) => void;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const ProfileAvatarUpload = ({ userId, avatarUrl, fallback, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato non valido", { description: "Usa JPG, PNG o WEBP" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File troppo grande", { description: "Max 2 MB" });
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (dbErr) throw dbErr;

      onChange(url);
      toast.success("Foto profilo aggiornata");
    } catch (e: any) {
      toast.error("Errore upload", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      // Tenta di rimuovere file dallo storage (ignora errori, potrebbe non esistere)
      const { data: list } = await supabase.storage.from("avatars").list(userId);
      if (list?.length) {
        await supabase.storage.from("avatars").remove(list.map((f) => `${userId}/${f.name}`));
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      onChange(null);
      toast.success("Foto profilo rimossa");
    } catch (e: any) {
      toast.error("Errore rimozione", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="w-20 h-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
        <AvatarFallback className="text-lg bg-primary text-primary-foreground">
          {fallback}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
          {avatarUrl ? "Cambia foto" : "Carica foto"}
        </Button>
        {avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Rimuovi
          </Button>
        )}
        <p className="text-xs text-muted-foreground">JPG, PNG o WEBP · max 2 MB</p>
      </div>
    </div>
  );
};

export default ProfileAvatarUpload;
