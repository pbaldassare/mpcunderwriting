import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CfoFiltersProvider, useCfoFilters } from "@/hooks/useCfoFilters";
import { CfoGlobalFilters } from "@/components/cfo/CfoGlobalFilters";
import { CfoKpiBar } from "@/components/cfo/CfoKpiBar";
import { CfoExplorer } from "@/components/cfo/CfoExplorer";
import { CfoAnalystChat } from "@/components/cfo/CfoAnalystChat";
import { CfoReportPanel } from "@/components/cfo/CfoReportPanel";
import { format } from "date-fns";

const TAB_VALUES = ["esplora", "analista", "report"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isValidTab(t: string | null): t is TabValue {
  return TAB_VALUES.includes(t as TabValue);
}

function CruscottoContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = isValidTab(tabParam) ? tabParam : "esplora";
  const { filters, rpcParams } = useCfoFilters();

  const reportInitialFiltri = {
    _data_da: rpcParams._data_da,
    _data_a: rpcParams._data_a,
    ...(rpcParams._ufficio_id ? { _ufficio_id: rpcParams._ufficio_id } : {}),
    ...(rpcParams._compagnia_id ? { _compagnia_id: rpcParams._compagnia_id } : {}),
  };

  const setTab = (v: string) => {
    setSearchParams({ tab: v }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cruscotto Direzione</h1>
        <p className="text-muted-foreground text-sm">
          KPI, esplorazione dati, analista AI e report per il Consiglio di Amministrazione
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-1 px-1 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b space-y-3">
        <CfoGlobalFilters />
        <CfoKpiBar />
        <p className="text-[11px] text-muted-foreground">
          Periodo: {format(filters.dataDa, "dd/MM/yyyy")} – {format(filters.dataA, "dd/MM/yyyy")}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="esplora">Esplora</TabsTrigger>
          <TabsTrigger value="analista">Analista AI</TabsTrigger>
          <TabsTrigger value="report">Report CDA</TabsTrigger>
        </TabsList>

        <TabsContent value="esplora" className="mt-4">
          <CfoExplorer />
        </TabsContent>

        <TabsContent value="analista" className="mt-4">
          <CfoAnalystChat />
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <CfoReportPanel
            key={`${rpcParams._data_da}-${rpcParams._data_a}-${rpcParams._ufficio_id}-${rpcParams._compagnia_id}`}
            embedded
            initialFiltri={reportInitialFiltri}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CruscottoDirezionePage() {
  return (
    <CfoFiltersProvider>
      <CruscottoContent />
    </CfoFiltersProvider>
  );
}
