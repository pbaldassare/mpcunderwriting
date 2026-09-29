import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Upload, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  inputId?: string;
  className?: string;
  /** Riga secondaria sotto il testo principale */
  hint?: string;
  emptyLabel?: string;
  selectedFiles?: File[];
  icon?: LucideIcon;
  size?: "default" | "sm";
}

export function FileDropzone({
  onFilesSelected,
  accept,
  multiple = false,
  disabled = false,
  inputId,
  className,
  hint,
  emptyLabel = "Trascina qui o clicca per selezionare",
  selectedFiles,
  icon: Icon = Upload,
  size = "default",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const pickFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const files = Array.from(fileList);
      onFilesSelected(multiple ? files : [files[0]]);
    },
    [multiple, onFilesSelected],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragDepth.current += 1;
      setDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragOver(false);
      if (disabled) return;
      pickFiles(e.dataTransfer.files);
    },
    [disabled, pickFiles],
  );

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      openPicker();
    }
  };

  const hasFiles = selectedFiles && selectedFiles.length > 0;
  const padding = size === "sm" ? "p-4" : "p-6";
  const iconSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer",
        padding,
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/40",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <Icon className={cn("mx-auto text-muted-foreground mb-2", iconSize)} />
      {hasFiles ? (
        <div className="space-y-1">
          {selectedFiles!.map((f) => (
            <p key={`${f.name}-${f.size}-${f.lastModified}`} className="text-sm font-medium">
              {f.name} ({formatFileSize(f.size)})
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          pickFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
