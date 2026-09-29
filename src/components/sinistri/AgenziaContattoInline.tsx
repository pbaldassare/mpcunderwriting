import { Button } from "@/components/ui/button";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import {
  resolveCompagniaContatto,
  resolveSinistroContattiPratica,
  type CompagniaContattoLike,
  type CompagniaContattoResolved,
  type SinistroContattiPraticaResolved,
} from "@/lib/compagniaDisplay";

type SinistroContattiLike = Parameters<typeof resolveSinistroContattiPratica>[0];

interface Props {
  /** Preferire `sinistro` per risolvere compagnia + agenzia con deduplica. */
  sinistro?: SinistroContattiLike;
  /** Legacy: solo agenzia (senza compagnia assicurativa). */
  agenzia?: CompagniaContattoLike;
  className?: string;
}

function copyValue(value: string) {
  navigator.clipboard.writeText(value);
  toast.success("Copiato");
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        title={`Copia ${label.toLowerCase()}`}
        onClick={() => copyValue(value)}
      >
        <ClipboardCopy className="h-3 w-3" />
      </Button>
    </span>
  );
}

function ContattiRow({
  contatto,
  pecLabel = "PEC",
}: {
  contatto: CompagniaContattoResolved;
  pecLabel?: string;
}) {
  const { telefono, email, pec } = contatto;
  const telNode = telefono ? (
    <ContactItem label="Tel." value={telefono} />
  ) : (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">Tel.</span>
      <span className="font-medium text-foreground">—</span>
    </span>
  );
  if (!telefono && !email && !pec) {
    return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{telNode}</div>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {telNode}
      {email ? <ContactItem label="Email" value={email} /> : null}
      {pec ? <ContactItem label={pecLabel} value={pec} /> : null}
    </div>
  );
}

function ContattiGroup({
  title,
  contatto,
  pecLabel,
  className,
}: {
  title: string;
  contatto: CompagniaContattoResolved;
  pecLabel?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-0.5 ${className ?? ""}`}>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{title}</span>
      <ContattiRow contatto={contatto} pecLabel={pecLabel} />
    </div>
  );
}

function renderContatti(resolved: SinistroContattiPraticaResolved, className?: string) {
  const { agenzia, compagnia, sameEntity } = resolved;

  if (sameEntity) {
    return (
      <ContattiGroup
        title="Agenzia riferimento"
        contatto={agenzia}
        pecLabel="PEC"
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {compagnia && (compagnia.telefono || compagnia.email || compagnia.pec) ? (
        <ContattiGroup title="Compagnia" contatto={compagnia} pecLabel="PEC compagnia" />
      ) : null}
      {agenzia.telefono || agenzia.email || agenzia.pec ? (
        <ContattiGroup title="Agenzia riferimento" contatto={agenzia} pecLabel="PEC agenzia" />
      ) : null}
      {!compagnia?.telefono &&
      !compagnia?.email &&
      !compagnia?.pec &&
      !agenzia.telefono &&
      !agenzia.email &&
      !agenzia.pec ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : null}
    </div>
  );
}

/** Contatti compagnia/agenzia (tel, email, PEC) con copy-to-clipboard. */
export default function AgenziaContattoInline({ sinistro, agenzia, className }: Props) {
  if (sinistro) {
    return renderContatti(resolveSinistroContattiPratica(sinistro), className);
  }

  return (
    <div className={className}>
      <ContattiRow contatto={resolveCompagniaContatto(agenzia)} pecLabel="PEC" />
    </div>
  );
}
