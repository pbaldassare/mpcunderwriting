import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Se valorizzato, sostituisce il layout eventColumn + editorColumn. */
  body?: ReactNode;
  eventColumn?: ReactNode;
  editorColumn?: ReactNode;
  footer: ReactNode;
  /** md = 2xl (default), lg = 4xl per editor premi. */
  size?: "md" | "lg";
  footerStart?: ReactNode;
}

/** Layout dialog operazioni polizza: header/footer fissi, corpo scrollabile. */
export function OperazionePolizzaDialogShell({
  open,
  onOpenChange,
  title,
  description,
  body,
  eventColumn,
  editorColumn,
  footer,
  size = "md",
  footerStart,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden",
          size === "lg" ? "max-w-4xl w-[95vw]" : "max-w-2xl w-full",
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 space-y-1">
          <DialogTitle>{title}</DialogTitle>
          {description != null && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-2 min-h-0">
          {body != null ? (
            body
          ) : (
            <div className="space-y-6 pb-2">
              {eventColumn}
              {editorColumn != null && <div className="border-t pt-4">{editorColumn}</div>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3 px-6 py-4 border-t shrink-0 bg-background flex-row flex-wrap sm:justify-between items-center">
          {footerStart != null && <div className="flex-1 min-w-0 text-sm">{footerStart}</div>}
          <div className="flex gap-2 sm:ml-auto">{footer}</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
