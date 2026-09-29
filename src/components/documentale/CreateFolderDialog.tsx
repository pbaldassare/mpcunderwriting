import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; folder_type: string; icon: string; description: string }) => void;
  loading?: boolean;
}

export default function CreateFolderDialog({ open, onOpenChange, onSubmit, loading }: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [folderType, setFolderType] = useState("generale");
  const [icon, setIcon] = useState("📁");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), folder_type: folderType, icon, description: description.trim() });
    setName(""); setFolderType("generale"); setIcon("📁"); setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuova Cartella</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome cartella" maxLength={100} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={folderType} onValueChange={setFolderType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="generale">Generale</SelectItem>
                <SelectItem value="agenzia">Agenzia</SelectItem>
                <SelectItem value="prodotto">Prodotto</SelectItem>
                <SelectItem value="sottoprodotto">Sottocategoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Icona (emoji)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-20" maxLength={4} />
          </div>
          <div>
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrizione opzionale" maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || loading}>{loading ? "Creazione..." : "Crea"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
