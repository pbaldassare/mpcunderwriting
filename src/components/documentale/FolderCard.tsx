import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

interface FolderCardProps {
  id: string;
  name: string;
  icon: string;
  folderType: string;
  documentCount: number;
  onClick: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const typeLabels: Record<string, string> = {
  compagnia: "Agenzia",
  prodotto: "Prodotto",
  sottoprodotto: "Categoria",
  generale: "Generale",
};

export default function FolderCard({ name, icon, folderType, documentCount, onClick, isAdmin, onEdit, onDelete }: FolderCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group relative"
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
        {isAdmin && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Modifica
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
                  <Trash2 className="mr-2 h-4 w-4" /> Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <span className="text-3xl">{icon || "📁"}</span>
        <h3 className="font-medium text-sm leading-tight line-clamp-2">{name}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{typeLabels[folderType] || folderType}</Badge>
          <span className="text-xs text-muted-foreground">{documentCount} doc</span>
        </div>
      </CardContent>
    </Card>
  );
}
