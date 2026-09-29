/** Tipologie documento caricabili manualmente su anagrafica cliente (backoffice). */
export const TIPI_DOCUMENTO_CLIENTE_STAFF: { value: string; label: string }[] = [
  { value: "incarico", label: "Incarico" },
  { value: "mandato", label: "Mandato" },
  { value: "lettera_incarico", label: "Lettera d'incarico" },
  { value: "contratto_brokeraggio", label: "Contratto di brokeraggio" },
  { value: "privacy_gdpr", label: "Privacy / GDPR" },
  { value: "documento_identita", label: "Documento identità" },
  { value: "visura", label: "Visura / camerale" },
  { value: "quietanza", label: "Quietanza" },
  { value: "appendice", label: "Appendice" },
  { value: "comunicazione_compagnia", label: "Comunicazione compagnia" },
  { value: "notifica_messa_cassa", label: "Avviso incasso agenzia (email)" },
  { value: "ec_cliente_email", label: "E/C Cliente inviato (email)" },
  { value: "documento_inviato_email", label: "Documento inviato (email)" },
  { value: "EC Cliente", label: "E/C Cliente" },
  { value: "altro", label: "Altro" },
];

export function labelTipoDocumento(categoria: string | null | undefined): string {
  if (!categoria) return "—";
  const hit = TIPI_DOCUMENTO_CLIENTE_STAFF.find((t) => t.value === categoria);
  if (hit) return hit.label;
  return categoria.replace(/_/g, " ");
}
