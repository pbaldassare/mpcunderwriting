import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RcaGaranziePicker } from "@/components/rca/RcaGaranziePicker";
import { RcaPageHeader } from "@/components/rca/RcaPageChrome";
import { fetchRcaAnalisiContesto } from "@/lib/rca/fetchAnalisi";
import { applyDanniPacchetto, resolveSelectedCvts, type CvtPacchettoValue, type RcaQuoteKind } from "@/lib/rca/cvt";
import type { CodiceGaranziaAssicurapp } from "@/lib/rca/garanzie";
import {
  INSURANCE_TYPES,
  applyVeicoloEGaranzie,
  emptyPreventivoForm,
  formFromClienteCBnet,
  missingPreventivoFields,
  prodottoLabel,
  snapshotsFromForm,
  type RcaPreventivoForm,
} from "@/lib/rca/preventivi";

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

export default function RcaPreventivoAnalisiPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const targaQ = params.get("targa");
  const clienteQ = params.get("cliente");
  const titoloQ = params.get("titolo");
  const [form, setForm] = useState<RcaPreventivoForm>(emptyPreventivoForm());

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["rca-analisi", targaQ, clienteQ, titoloQ],
    queryFn: () => fetchRcaAnalisiContesto({ targa: targaQ, clienteId: clienteQ, titoloId: titoloQ }),
  });

  useEffect(() => {
    if (!ctx) return;
    let next = emptyPreventivoForm();
    if (ctx.cliente) next = formFromClienteCBnet(ctx.cliente, next);
    next = applyVeicoloEGaranzie({
      form: next,
      targa: ctx.targa || targaQ,
      tipo: ctx.tipo,
      marca: ctx.marca,
      modello: ctx.modello,
      titoloId: ctx.titoloId,
      veicoloId: ctx.veicoloId,
      compagnia: ctx.compagnia,
      scadenzaIso: ctx.scadenzaIso,
      garanzie: ctx.garanzie,
    });
    setForm(next);
  }, [ctx, targaQ]);

  const missing = useMemo(() => missingPreventivoFields(form), [form]);
  const patch = (p: Partial<RcaPreventivoForm>) => setForm((f) => ({ ...f, ...p }));
  const toggleGaranzia = (code: CodiceGaranziaAssicurapp, on: boolean) => {
    setForm((f) => ({
      ...f,
      garanzie: on ? [...new Set([...f.garanzie, code])] : f.garanzie.filter((g) => g !== code),
    }));
  };
  const setQuoteKind = (quoteKind: RcaQuoteKind) => {
    setForm((f) => ({
      ...f,
      quoteKind,
      cvtPacchetto: quoteKind === "cvt" && !f.cvtPacchetto ? "IFE" : f.cvtPacchetto,
    }));
  };
  const setCvtPacchetto = (cvtPacchetto: CvtPacchettoValue) => {
    setForm((f) => ({
      ...f,
      cvtPacchetto,
      garanzie: applyDanniPacchetto(f.garanzie, cvtPacchetto),
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const snaps = snapshotsFromForm(form);
      const payload = {
        cliente_id: form.clienteId,
        titolo_id: form.titoloId,
        veicolo_id: form.veicoloId,
        targa: form.targa.trim().toUpperCase(),
        prodotto_code: form.prodottoCode,
        stato: "pronto",
        insurance_type: form.insuranceType,
        driving_type: form.drivingType,
        fractionation: form.fractionation,
        garanzie_richieste: form.garanzie,
        selected_cvts: resolveSelectedCvts({
          quoteKind: form.quoteKind,
          garanzie: form.garanzie,
          cvtPacchetto: form.cvtPacchetto,
        }),
        bersani_plate: form.bersaniPlate.trim().toUpperCase() || null,
        bersani_cf: form.bersaniCf.trim().toUpperCase() || null,
        client_snapshot: snaps.client_snapshot,
        vehicle_snapshot: snaps.vehicle_snapshot,
        quote_snapshot: snaps.quote_snapshot,
        offerte_snapshot: [],
        note: form.note.trim() || null,
        created_by: user?.id ?? null,
      };
      const { data, error } = await (supabase.from("rca_preventivi") as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Preventivo salvato. Avvio le quotazioni compagnie.");
      navigate(`/rca/preventivi/${id}`);
    },
    onError: (err: Error) => toast.error(err.message || "Errore salvataggio preventivo"),
  });

  const needsBersani = form.insuranceType !== "continuita_assicurativa" && form.insuranceType !== "cu14";
  const actions = (
    <>
      <Button type="button" variant="outline" onClick={() => navigate(-1)}>
        Indietro
      </Button>
      <Button type="button" disabled={save.isPending || missing.length > 0} onClick={() => save.mutate()}>
        {save.isPending ? "Salvataggio…" : "Salva e vai alle offerte"}
      </Button>
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title="Analisi preventivazione"
        subtitle="Scegli prima RCA + accessori oppure un CVT standalone. I dati restano sul preventivo, non sull’anagrafica cliente."
        actions={actions}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{prodottoLabel(form.prodottoCode, form.quoteKind)}</Badge>
        {ctx?.numeroPolizza && <Badge variant="outline">Polizza {ctx.numeroPolizza}</Badge>}
        {form.targa && (
          <Badge variant="outline" className="font-mono">
            {form.targa}
          </Badge>
        )}
        {isLoading && <span className="text-sm text-muted-foreground">Caricamento dati CBnet…</span>}
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Campi da completare</p>
          <p className="mt-1">{missing.join(", ")}. Servono per le compagnie; non aggiorniamo l’anagrafica cliente.</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" value={form.name} onChange={(v) => patch({ name: v.toUpperCase() })} />
            <Field
              label="Cognome / Ragione sociale"
              value={form.surname}
              onChange={(v) => patch({ surname: v.toUpperCase() })}
            />
            <Field
              label="Codice fiscale / P.IVA"
              value={form.cf}
              onChange={(v) => patch({ cf: v.toUpperCase() })}
            />
            <Field label="Sesso (M/F)" value={form.gender} onChange={(v) => patch({ gender: v.toUpperCase() })} />
            <Field label="Cellulare" value={form.phone} onChange={(v) => patch({ phone: v })} />
            <Field label="Email" value={form.email} onChange={(v) => patch({ email: v })} />
            <Field
              label="Via"
              value={form.address}
              onChange={(v) => patch({ address: v.toUpperCase() })}
              className="sm:col-span-2"
            />
            <Field label="Civico" value={form.houseNum} onChange={(v) => patch({ houseNum: v.toUpperCase() })} />
            <Field label="CAP" value={form.zip} onChange={(v) => patch({ zip: v })} />
            <Field label="Comune" value={form.city} onChange={(v) => patch({ city: v })} />
            <Field
              label="Provincia"
              value={form.province}
              onChange={(v) => patch({ province: v.toUpperCase() })}
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Veicolo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Targa" value={form.targa} onChange={(v) => patch({ targa: v.toUpperCase() })} />
              <Field label="Valore veicolo €" value={form.value} onChange={(v) => patch({ value: v })} />
              <Field label="Marca" value={form.brand} onChange={(v) => patch({ brand: v.toUpperCase() })} />
              <Field label="Modello" value={form.model} onChange={(v) => patch({ model: v.toUpperCase() })} />
              <label className="flex items-center gap-2 pt-6 text-sm sm:col-span-2">
                <Checkbox checked={form.sat} onCheckedChange={(v) => patch({ sat: !!v })} id="sat" />
                Antifurto satellitare
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situazione assicurativa</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Tipo"
                value={form.insuranceType}
                onChange={(v) => patch({ insuranceType: v as RcaPreventivoForm["insuranceType"] })}
              >
                {INSURANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Guida"
                value={form.drivingType}
                onChange={(v) => patch({ drivingType: v as "Esperta" | "Libera" })}
              >
                <option value="Esperta">Esperta</option>
                <option value="Libera">Libera</option>
              </SelectField>
              <SelectField
                label="Frazionamento"
                value={form.fractionation}
                onChange={(v) => patch({ fractionation: Number(v) as 1 | 2 })}
              >
                <option value={1}>Annuale</option>
                <option value={2}>Semestrale</option>
              </SelectField>
              <Field
                label="Compagnia attuale"
                value={form.currentProvider}
                onChange={(v) => patch({ currentProvider: v })}
              />
              <Field
                label="Scadenza polizza (GG/MM/AAAA)"
                value={form.insuranceExpire}
                onChange={(v) => patch({ insuranceExpire: v })}
              />
              {needsBersani && (
                <Field
                  label="Targa agevolante"
                  value={form.bersaniPlate}
                  onChange={(v) => patch({ bersaniPlate: v.toUpperCase() })}
                />
              )}
              {form.insuranceType === "bersani_familiare" && (
                <Field
                  label="CF familiare"
                  value={form.bersaniCf}
                  onChange={(v) => patch({ bersaniCf: v.toUpperCase() })}
                />
              )}
              <Field
                label="Note interne"
                value={form.note}
                onChange={(v) => patch({ note: v })}
                className="sm:col-span-2"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cosa quotare</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Le compagnie ricevono già queste scelte. Precompilate dalla polizza CBnet, le puoi cambiare prima di lanciare.
          </p>
        </CardHeader>
        <CardContent>
          <RcaGaranziePicker
            quoteKind={form.quoteKind}
            onQuoteKind={setQuoteKind}
            garanzie={form.garanzie}
            onToggleAccessorio={toggleGaranzia}
            cvtPacchetto={form.cvtPacchetto}
            onCvtPacchetto={setCvtPacchetto}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {actions}
      </div>
    </div>
  );
}
