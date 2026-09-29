import { ChevronLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useGoBack } from "@/hooks/useGoBack";

const NO_BACK = new Set(["/", "/login", "/cliente", "/prospect"]);

type Props = {
  fallback?: string;
  className?: string;
  /** Mostra anche sulle route di atterraggio (home). */
  force?: boolean;
};

/** Indietro globale: storia del browser, visibile ovunque non sia la home. */
export default function HistoryBackButton({ fallback = "/", className, force }: Props) {
  const { pathname } = useLocation();
  const goBack = useGoBack(fallback);

  if (!force && NO_BACK.has(pathname)) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={goBack}
      className={className ?? "h-8 px-2 shrink-0 text-muted-foreground hover:text-foreground"}
      title="Torna al punto precedente"
      aria-label="Indietro"
    >
      <ChevronLeft className="w-4 h-4 mr-0.5" />
      Indietro
    </Button>
  );
}
