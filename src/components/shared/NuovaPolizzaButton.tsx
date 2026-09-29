import { Button, type ButtonProps } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface NuovaPolizzaButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Se valorizzato, l'immissione si apre con il cliente già selezionato. */
  clienteId?: string | null;
  /** Etichetta personalizzata (default: "Nuova Polizza"). */
  label?: string;
}

/**
 * CTA condivisa per creare una nuova polizza.
 * Centralizza la navigazione verso `/portafoglio/immissione`, opzionalmente
 * con `?clienteId=...` per pre-collegare la polizza a un cliente esistente.
 */
export function NuovaPolizzaButton({
  clienteId,
  label = "Nuova Polizza",
  className,
  ...rest
}: NuovaPolizzaButtonProps) {
  const navigate = useNavigate();
  const target = clienteId
    ? `/portafoglio/immissione?clienteId=${clienteId}`
    : "/portafoglio/immissione";
  return (
    <Button
      onClick={() => navigate(target)}
      className={["gap-2", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  );
}
