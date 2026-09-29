import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Download, Trash2, FileText, FileSpreadsheet, FileImage, File } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface DocumentCardProps {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  description: string | null;
  tags: string[];
  uploadedAt: string;
  isAdmin?: boolean;
  onDownload: () => void;
  onDelete?: () => void;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="h-8 w-8 text-muted-foreground" />;
  if (fileType.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
  if (fileType.includes("word") || fileType.includes("doc")) return <FileText className="h-8 w-8 text-blue-500" />;
  if (fileType.includes("sheet") || fileType.includes("excel") || fileType.includes("xls")) return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
  if (fileType.includes("image")) return <FileImage className="h-8 w-8 text-purple-500" />;
  return <File className="h-8 w-8 text-muted-foreground" />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function DocumentCard({ fileName, fileType, fileSize, description, tags, uploadedAt, isAdmin, onDownload, onDelete }: DocumentCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow group relative">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{getFileIcon(fileType)}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{fileName}</h3>
          {description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{description}</p>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {fileSize && <span className="text-[10px] text-muted-foreground">{formatSize(fileSize)}</span>}
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(uploadedAt), "dd MMM yyyy", { locale: it })}
            </span>
            {tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" /> Scarica
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Elimina
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
