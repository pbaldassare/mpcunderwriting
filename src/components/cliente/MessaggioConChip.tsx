import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link as LinkIcon, Car } from "lucide-react";
import { Link } from "react-router-dom";

const POLIZZA_RE = /\[POLIZZA:([0-9a-f-]{36})\]/gi;

interface Props {
  text: string;
}

export default function MessaggioConChip({ text }: Props) {
  // Estrai gli UUID delle polizze citate
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(POLIZZA_RE);
  while ((m = re.exec(text)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }

  const { data: polizzeMap } = useQuery({
    queryKey: ["chip_titoli", ids.sort().join(",")],
    queryFn: async () => {
      if (!ids.length) return new Map<string, any>();
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, targa_telaio")
        .in("id", ids);
      const map = new Map<string, any>();
      (data || []).forEach((t: any) => map.set(t.id, t));
      return map;
    },
    enabled: ids.length > 0,
  });

  if (!ids.length) return <>{text}</>;

  // Split text e intersperse con chip
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const re2 = new RegExp(POLIZZA_RE);
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re2.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${key++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    const id = match[1];
    const t = polizzeMap?.get(id);
    parts.push(
      <Link
        key={`c-${key++}`}
        to={`/cliente/polizze/${id}`}
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-medium align-baseline transition-colors"
      >
        <LinkIcon className="h-3 w-3" />
        {t ? (
          <>
            <span className="font-mono">{t.numero_titolo || "Polizza"}</span>
            {t.targa_telaio && (
              <span className="inline-flex items-center gap-0.5 ml-1 opacity-80">
                <Car className="h-3 w-3" />
                {t.targa_telaio}
              </span>
            )}
          </>
        ) : (
          <span>Polizza</span>
        )}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(<span key={`t-${key++}`}>{text.slice(lastIndex)}</span>);

  return <>{parts}</>;
}
