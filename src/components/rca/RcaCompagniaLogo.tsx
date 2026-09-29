import { useState } from "react";
import { inizialiCompagnia, urlLogoCompagnia } from "@/lib/rca/compagnieLoghi";
import { cn } from "@/lib/utils";

export function RcaCompagniaLogo({
  slug,
  label,
  className,
}: {
  slug?: string | null;
  label?: string | null;
  className?: string;
}) {
  const src = urlLogoCompagnia(slug, label);
  const [broken, setBroken] = useState(false);
  const initials = inizialiCompagnia(label, slug);

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm",
        className,
      )}
    >
      {src && !broken ? (
        <img
          src={src}
          alt={label || slug || "Compagnia"}
          className="h-8 w-8 object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-xs font-semibold tracking-wide text-primary">{initials}</span>
      )}
    </div>
  );
}
