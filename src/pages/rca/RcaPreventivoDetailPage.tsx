import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RcaCompagniaLogo } from "@/components/rca/RcaCompagniaLogo";
import { RcaOfferteCards } from "@/components/rca/RcaOfferteCards";
import { RcaPageHeader } from "@/components/rca/RcaPageChrome";
import {
  formatEuroPremio,
  hasPendingAssicurappOffers,
  type AssicurappOffer,
} from "@/lib/rca/assicurapp";
import { quoteKindLabel } from "@/lib/rca/cvt";
import { invokeAssicurappRca } from "@/lib/rca/invokeAssicurapp";
import { offertaKey, selectedOfferFromSnapshot, withSelectedOffer } from "@/lib/rca/offerteUi";
import { labelGaranziaAssicurapp } from "@/lib/rca/garanzie";
import {
  INSURANCE_TYPES,
  prodottoLabel,
  statoPreventivoLabel,
  type RcaPreventivoRow,
} from "@/lib/rca/preventivi";

const POLL_MS = 18_000;
const POLL_MAX = 100;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || "—"}</dd>
    </div>
  );
}

export default function RcaPreventivoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pollCount, setPollCount] = useState(0);
  const startedRef = useRef(false);

  const { data: row, isLoading, error } = useQuery({
    queryKey: ["rca-preventivo", id],
    enabled: !!id,
    queryFn: async (): Promise<RcaPreventivoRow> => {
      const { data, error } = await (supabase.from("rca_preventivi") as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Preventivo non trovato");
      return data as RcaPreventivoRow;
    },
  });

  const refresh = (next: RcaPreventivoRow) => {
    queryClient.setQueryData(["rca-preventivo", id], next);
    queryClient.invalidateQueries({ queryKey: ["rca-preventivi"] });
  };

  const [pickedKey, setPickedKey] = useState<string | null>(null);

  const quota = useMutation({
    mutationFn: async (azione: "quota" | "poll") => {
      if (!id) throw new Error("Preventivo assente");
      return invokeAssicurappRca(azione, id);
    },
    onSuccess: (res) => {
      if (res.preventivo) refresh(res.preventivo);
      if (res.pending) {
        toast.message("Quotazioni in corso: le compagnie rispondono in 15–20 secondi, fino a 30 minuti.");
      } else if ((res.offerte || []).length > 0) {
        toast.success("Offerte aggiornate");
      }
    },
    onError: (err: Error) => toast.error(err.message || "Errore quotazione Assicurapp"),
  });

  const salvaOfferta = useMutation({
    mutationFn: async (offer: AssicurappOffer) => {
      if (!row) throw new Error("Preventivo assente");
      const { data, error } = await (supabase.from("rca_preventivi") as any)
        .update({
          stato: "salvato",
          quote_snapshot: withSelectedOffer(row.quote_snapshot, offer),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as RcaPreventivoRow;
    },
    onSuccess: (next) => {
      refresh(next);
      toast.success("Preventivo salvato con l’offerta scelta.");
    },
    onError: (err: Error) => toast.error(err.message || "Errore salvataggio preventivo"),
  });

  useEffect(() => {
    if (!id || !row || startedRef.current) return;
    if (row.stato === "salvato") return;
    startedRef.current = true;
    quota.mutate(row.quote_uid ? "poll" : "quota");
  }, [id, row]);

  useEffect(() => {
    if (!row?.quote_uid) return;
    const offerte = (Array.isArray(row.offerte_snapshot) ? row.offerte_snapshot : []) as AssicurappOffer[];
    const pending = hasPendingAssicurappOffers(offerte) || row.stato === "in_quotazione";
    if (!pending || pollCount >= POLL_MAX) return;
    const t = window.setTimeout(() => {
      setPollCount((n) => n + 1);
      quota.mutate("poll");
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [row?.quote_uid, row?.stato, row?.offerte_snapshot, pollCount]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-muted-foreground">Caricamento…</p>
      </div>
    );
  }
  if (error || !row) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <p className="text-destructive">Preventivo non trovato.</p>
        <Button variant="outline" onClick={() => navigate("/rca/preventivi")}>
          Torna ai preventivi
        </Button>
      </div>
    );
  }

  const client = row.client_snapshot as Record<string, any>;
  const vehicle = row.vehicle_snapshot as Record<string, any>;
  const quote = row.quote_snapshot as Record<string, any>;
  const offerte = (Array.isArray(row.offerte_snapshot) ? row.offerte_snapshot : []) as AssicurappOffer[];
  const tipoLabel = INSURANCE_TYPES.find((t) => t.value === row.insurance_type)?.label || row.insurance_type;
  const pending = hasPendingAssicurappOffers(offerte) || row.stato === "in_quotazione";
  const quoteKind = String((quote as { quote_kind?: string }).quote_kind || "rca");
  const saved = selectedOfferFromSnapshot(quote);
  const selectedKey =
    pickedKey ||
    (saved ? offertaKey({ id: saved.id ?? undefined, company_slug: saved.company_slug, label: saved.label }) : null);
  const selectedOffer = offerte.find((o, i) => offertaKey(o, i) === selectedKey) || null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title={`Preventivo ${row.targa}`}
        subtitle={`${client.display_name || "—"} · ${prodottoLabel(row.prodotto_code, quoteKind)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/rca/preventivi")}>
              Lista
            </Button>
            {row.titolo_id && (
              <Button variant="outline" onClick={() => navigate(`/titoli/${row.titolo_id}`)}>
                Apri polizza
              </Button>
            )}
            <Button
              type="button"
              disabled={quota.isPending || row.stato === "salvato"}
              onClick={() => quota.mutate(row.quote_uid ? "poll" : "quota")}
            >
              {quota.isPending
                ? "Aggiorno…"
                : row.quote_uid
                  ? "Aggiorna offerte"
                  : "Lancia quotazioni"}
            </Button>
            <Button
              type="button"
              disabled={!selectedOffer || salvaOfferta.isPending}
              onClick={() => selectedOffer && salvaOfferta.mutate(selectedOffer)}
            >
              {salvaOfferta.isPending ? "Salvo…" : row.stato === "salvato" ? "Aggiorna salvataggio" : "Salva preventivo"}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{statoPreventivoLabel(row.stato)}</Badge>
        <Badge variant="outline">{quoteKindLabel(quoteKind)}</Badge>
        <Badge variant="outline">{tipoLabel}</Badge>
        {row.quote_uid && <Badge variant="outline">UID {row.quote_uid}</Badge>}
        {pending && <Badge variant="outline">Polling ogni 18s</Badge>}
      </div>

      {saved && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <RcaCompagniaLogo slug={saved.company_slug} label={saved.label} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Offerta salvata</p>
              <p className="font-semibold">{saved.label}</p>
            </div>
            <p className="text-2xl font-bold">{formatEuroPremio(saved.premio)}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="Nominativo" value={client.display_name || "—"} />
            <InfoRow label="CF / P.IVA" value={client.cf || "—"} />
            <InfoRow label="Telefono" value={client.phone || "—"} />
            <InfoRow label="Email" value={client.email || "—"} />
            <InfoRow label="Indirizzo" value={client.address?.full_address || "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Veicolo e richieste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow
              label="Veicolo"
              value={[vehicle.plate || row.targa, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}
            />
            <InfoRow
              label="Guida"
              value={`${row.driving_type} · ${row.fractionation === 2 ? "Semestrale" : "Annuale"}`}
            />
            <InfoRow label="Compagnia" value={quote.insurance?.current_insurance_provider || "—"} />
            <InfoRow label="Scadenza" value={quote.insurance?.insurance_expire || "—"} />
            <InfoRow
              label="Richieste"
              value={
                [
                  quoteKindLabel(quoteKind),
                  (row.selected_cvts || []).join(" · "),
                  (row.garanzie_richieste || []).map(labelGaranziaAssicurapp).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ") || "solo RCA"
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offerte compagnie</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            {pending
              ? "Le compagnie stanno rispondendo. Scegli un’offerta pronta e salva il preventivo."
              : offerte.length === 0
                ? "Nessuna offerta ancora. Premi «Lancia quotazioni» se il preventivo è pronto."
                : "Clicca un’offerta completata e premi «Salva preventivo» per tenerla in archivio."}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <RcaOfferteCards
            offerte={offerte}
            selectedKey={selectedKey}
            onSelect={(offer) => setPickedKey(offertaKey(offer))}
            emptyLabel={quota.isPending ? "Avvio quotazione Assicurapp…" : "Nessuna offerta."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
