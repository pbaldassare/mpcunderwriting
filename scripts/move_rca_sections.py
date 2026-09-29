"""Extract RCA Auto sections from ImmissionePolizzaPage and reposition under Tipo Polizza."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page_path = ROOT / "src/pages/ImmissionePolizzaPage.tsx"
out_path = ROOT / "src/components/polizze/immissione/RcaAutoImmissioneSections.tsx"
out_path.parent.mkdir(parents=True, exist_ok=True)

text = page_path.read_text(encoding="utf-8")
start_marker = "      {/* === SEZIONI RCA AUTO === */}"
end_marker = "      {/* ACTIONS */}"
start = text.index(start_marker)
end = text.index(end_marker)
block = text[start:end]

# Strip outer wrapper: {isRCA && (() => { ... return (...); })()}
prefix = "      {/* === SEZIONI RCA AUTO === */}\n      {isRCA && (() => {\n"
suffix = "      })()}\n\n"
assert block.startswith(prefix), "unexpected block prefix"
assert block.endswith(suffix), "unexpected block suffix"
inner = block[len(prefix) : -len(suffix)]

props = [
    ("isRCA", "boolean"),
    ("aiPrefilled", "Set<string>"),
    ("clearAiPrefilled", "(key: string) => void"),
    ("clienteDettaglio", "unknown"),
    ("rcaUsi", "{ value: string; label: string }[] | undefined"),
    ("kwCvLocked", 'null | "cv" | "kw"'),
    ("setKwCvLocked", 'React.Dispatch<React.SetStateAction<null | "cv" | "kw">>>'),
    ("conducenteUgualeContraente", "boolean"),
    ("setConducenteUgualeContraente", "React.Dispatch<React.SetStateAction<boolean>>"),
    ("vSettore", "string"),
    ("setVSettore", "React.Dispatch<React.SetStateAction<string>>"),
    ("vTipoVeicolo", "string"),
    ("setVTipoVeicolo", "React.Dispatch<React.SetStateAction<string>>"),
    ("vUso", "string"),
    ("setVUso", "React.Dispatch<React.SetStateAction<string>>"),
    ("vMarca", "string"),
    ("setVMarca", "React.Dispatch<React.SetStateAction<string>>"),
    ("vModello", "string"),
    ("setVModello", "React.Dispatch<React.SetStateAction<string>>"),
    ("vVersione", "string"),
    ("setVVersione", "React.Dispatch<React.SetStateAction<string>>"),
    ("vTarga", "string"),
    ("setVTarga", "React.Dispatch<React.SetStateAction<string>>"),
    ("vTelaio", "string"),
    ("setVTelaio", "React.Dispatch<React.SetStateAction<string>>"),
    ("vDescrizione", "string"),
    ("setVDescrizione", "React.Dispatch<React.SetStateAction<string>>"),
    ("vDataImmatricolazione", "string"),
    ("setVDataImmatricolazione", "React.Dispatch<React.SetStateAction<string>>"),
    ("vAnnoAcquisto", "string"),
    ("setVAnnoAcquisto", "React.Dispatch<React.SetStateAction<string>>"),
    ("vProvinciaCircolazione", "string"),
    ("setVProvinciaCircolazione", "React.Dispatch<React.SetStateAction<string>>"),
    ("vClasseBm", "string"),
    ("setVClasseBm", "React.Dispatch<React.SetStateAction<string>>"),
    ("vMass1", "string"),
    ("setVMass1", "React.Dispatch<React.SetStateAction<string>>"),
    ("vMass2", "string"),
    ("setVMass2", "React.Dispatch<React.SetStateAction<string>>"),
    ("vMass3", "string"),
    ("setVMass3", "React.Dispatch<React.SetStateAction<string>>"),
    ("vPeius", "boolean"),
    ("setVPeius", "React.Dispatch<React.SetStateAction<boolean>>"),
    ("vFranchigia", "string"),
    ("setVFranchigia", "React.Dispatch<React.SetStateAction<string>>"),
    ("vTemporanea", "boolean"),
    ("setVTemporanea", "React.Dispatch<React.SetStateAction<boolean>>"),
    ("vCaricoScarico", "boolean"),
    ("setVCaricoScarico", "React.Dispatch<React.SetStateAction<boolean>>"),
    ("vCompetizione", "boolean"),
    ("setVCompetizione", "React.Dispatch<React.SetStateAction<boolean>>"),
    ("vRimorchio", "boolean"),
    ("setVRimorchio", "React.Dispatch<React.SetStateAction<boolean>>"),
    ("vCv", "string"),
    ("setVCv", "React.Dispatch<React.SetStateAction<string>>"),
    ("vKw", "string"),
    ("setVKw", "React.Dispatch<React.SetStateAction<string>>"),
    ("vCc", "string"),
    ("setVCc", "React.Dispatch<React.SetStateAction<string>>"),
    ("vPosti", "string"),
    ("setVPosti", "React.Dispatch<React.SetStateAction<string>>"),
    ("vPesoMotrice", "string"),
    ("setVPesoMotrice", "React.Dispatch<React.SetStateAction<string>>"),
    ("vPesoRimorchio", "string"),
    ("setVPesoRimorchio", "React.Dispatch<React.SetStateAction<string>>"),
    ("vPesoTotale", "string"),
    ("setVPesoTotale", "React.Dispatch<React.SetStateAction<string>>"),
    ("vTipologiaGuida", "string"),
    ("setVTipologiaGuida", "React.Dispatch<React.SetStateAction<string>>"),
    ("vTipoAlimentazione", "string"),
    ("setVTipoAlimentazione", "React.Dispatch<React.SetStateAction<string>>"),
    ("cNome", "string"),
    ("setCNome", "React.Dispatch<React.SetStateAction<string>>"),
    ("cCognome", "string"),
    ("setCCognome", "React.Dispatch<React.SetStateAction<string>>"),
    ("cIndirizzo", "string"),
    ("setCIndirizzo", "React.Dispatch<React.SetStateAction<string>>"),
    ("cCap", "string"),
    ("setCCap", "React.Dispatch<React.SetStateAction<string>>"),
    ("cCitta", "string"),
    ("setCCitta", "React.Dispatch<React.SetStateAction<string>>"),
    ("cProvincia", "string"),
    ("setCProvincia", "React.Dispatch<React.SetStateAction<string>>"),
    ("cDataNascita", "string"),
    ("setCDataNascita", "React.Dispatch<React.SetStateAction<string>>"),
    ("cTipoPatente", "string"),
    ("setCTipoPatente", "React.Dispatch<React.SetStateAction<string>>"),
    ("cDataRilascioPatente", "string"),
    ("setCDataRilascioPatente", "React.Dispatch<React.SetStateAction<string>>"),
    ("cNote", "string"),
    ("setCNote", "React.Dispatch<React.SetStateAction<string>>"),
]

iface_lines = ["export interface RcaAutoImmissioneSectionsProps {"]
for name, typ in props:
    iface_lines.append(f"  {name}: {typ};")
iface_lines.append("}")

destructure = ",\n    ".join(name for name, _ in props)

component_header = '''import type React from "react";
import { Car, Sparkles, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/SearchableSelect";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { MarcaCombobox, ModelloCombobox } from "@/components/rca/MarcaModelloCombobox";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import {
  CLASSI_MERITO,
  TIPI_VEICOLO,
  PROVINCE_IT,
  TIPI_PATENTE,
  defaultPatenteForVeicolo,
  isTargaItValid,
} from "@/lib/rcaConstants";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";

'''

component = (
    component_header
    + "\n".join(iface_lines)
    + "\n\nexport function RcaAutoImmissioneSections(props: RcaAutoImmissioneSectionsProps) {\n  const {\n    "
    + destructure
    + ",\n  } = props;\n\n"
    + inner
    + "\n}\n"
)

# Fix return: inner has "return (" at start - change to direct return
component = component.replace(
    "        return (\n        <>",
    "  return (\n    <>",
    1,
)
# Fix indentation of JSX (reduce 8 spaces to 4 for top level inside return)
lines = component.split("\n")
fixed = []
in_return = False
for line in lines:
    if line.strip() == "return (":
        in_return = True
        fixed.append(line)
        continue
    if in_return and line.strip() == ");":
        in_return = False
        fixed.append("  );")
        continue
    if in_return and line.startswith("        "):
        fixed.append(line[4:])  # 8 -> 4
    elif in_return and line.startswith("          "):
        fixed.append(line[4:])
    else:
        fixed.append(line)
component = "\n".join(fixed)

out_path.write_text(component, encoding="utf-8")

# Update page: remove block, insert component usage, remove hint
text = text[:start] + text[end:]

insert_marker = "      </PolizzaSection>\n\n      {/* CONTRATTO */}"
props_jsx = "\n".join(f"          {name}={{{name}}}" for name, _ in props)
insert_block = f"""      </PolizzaSection>

      {{isRCA && (
        <RcaAutoImmissioneSections
{props_jsx}
        />
      )}}

      {{/* CONTRATTO */}}"""
if insert_marker not in text:
    raise SystemExit("insert marker not found")
text = text.replace(insert_marker, insert_block, 1)

hint = """            {isRCA && (
              <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" />
                Ramo RCA rilevato: in fondo alla pagina troverai le sezioni Veicolo, Garanzie e Conducente.
              </p>
            )}

"""
text = text.replace(hint, "")

import_line = 'import { RcaAutoImmissioneSections } from "@/components/polizze/immissione/RcaAutoImmissioneSections";\n'
if import_line not in text:
    anchor = 'import { CoassicurazioneImportiBreakdown } from "@/components/polizze/CoassicurazioneImportiBreakdown";\n'
    text = text.replace(anchor, anchor + import_line)

page_path.write_text(text, encoding="utf-8")
print("Done:", out_path, page_path)
