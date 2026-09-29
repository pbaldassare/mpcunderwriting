// useEffect non più necessario qui dopo la rimozione del redirect duplicato
import {
  Users, Building2, FileText, BarChart3, TrendingUp, Target, ClipboardList,
  Activity, ArrowUpRight, AlertCircle, DollarSign, FileWarning, Receipt,
  Calendar, MessageSquare, FolderOpen, PieChart as PieChartIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

// ── Shared Components ──

type Variant = "green" | "blue" | "yellow" | "orange" | "teal";

const variantMap: Record<Variant, { bg: string; border: string; icon: string }> = {
  green: { bg: "bg-kpi-green-bg", border: "border-kpi-green-border", icon: "text-kpi-green-text" },
  blue: { bg: "bg-kpi-blue-bg", border: "border-kpi-blue-border", icon: "text-kpi-blue-text" },
  yellow: { bg: "bg-kpi-yellow-bg", border: "border-kpi-yellow-border", icon: "text-kpi-yellow-text" },
  orange: { bg: "bg-kpi-orange-bg", border: "border-kpi-orange-border", icon: "text-kpi-orange-text" },
  teal: { bg: "bg-kpi-teal-bg", border: "border-kpi-teal-border", icon: "text-kpi-teal-text" },
};

const SummaryCard = ({ label, value, sub, icon: Icon, variant, loading, onClick }: {
  label: string; value: string; sub: string; icon: React.ElementType; variant: Variant; loading?: boolean; onClick?: () => void;
}) => (
  <div
    className={`bg-card rounded-lg border border-border p-5 flex items-start justify-between ${onClick ? "cursor-pointer hover:border-primary/50 hover:shadow-md transition-all" : ""}`}
    onClick={onClick}
  >
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold text-foreground">{value}</p>}
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
    <div className={`w-9 h-9 rounded-lg ${variantMap[variant].bg} flex items-center justify-center`}>
      <Icon className={`w-[18px] h-[18px] ${variantMap[variant].icon}`} />
    </div>
  </div>
);

const KpiCard = ({ label, value, sub, variant, icon: Icon, loading, onClick }: {
  label: string; value: string; sub: string; variant: Variant; icon: React.ElementType; loading?: boolean; onClick?: () => void;
}) => (
  <div
    className={`rounded-lg border p-5 ${variantMap[variant].bg} ${variantMap[variant].border} ${onClick ? "cursor-pointer hover:shadow-md transition-all" : ""}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${variantMap[variant].icon}`} />
      <span className={`text-sm font-medium ${variantMap[variant].icon}`}>{label}</span>
    </div>
    {loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-foreground">{value}</p>}
    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
  </div>
);

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "#6366f1", "#f59e0b", "#14b8a6", "#f43f5e", "#8b5cf6"];

const fmt = (n: number) => n >= 1000 ? `€ ${(n / 1000).toFixed(1)}k` : `€ ${n.toLocaleString("it-IT")}`;

// ── Charts ──

const PieChartCard = ({ title, data, loading }: { title: string; data: { name: string; value: number }[]; loading?: boolean }) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center gap-2 mb-3">
      <PieChartIcon className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
    {loading ? (
      <Skeleton className="h-48 w-full" />
    ) : data.length === 0 ? (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Nessun dato disponibile</div>
    ) : (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )}
  </div>
);

const BarChartCard = ({ title, data, dataKey, loading }: { title: string; data: { mese: string; importo: number }[]; dataKey?: string; loading?: boolean }) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center gap-2 mb-3">
      <BarChart3 className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
    {loading ? (
      <Skeleton className="h-48 w-full" />
    ) : data.length === 0 ? (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Nessun dato disponibile</div>
    ) : (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="mese" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <Tooltip formatter={(v: number) => [`€ ${v.toLocaleString("it-IT")}`, "Importo"]} />
          <Bar dataKey={dataKey || "importo"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

const PlaceholderChart = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Nessun dato disponibile</div>
  </div>
);

const PlaceholderList = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <button className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
        Vedi tutto <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
    <div className="text-muted-foreground text-sm py-8 text-center">Nessun dato disponibile</div>
  </div>
);

// ── Role Dashboards ──

const AdminDashboard = ({ loading, data }: { loading: boolean; data: ReturnType<typeof useDashboardData>["admin"] }) => {
  const d = data;
  const navigate = useNavigate();
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Rinnovi del Mese" value={String(d?.rinnoviMeseCount ?? 0)} sub={fmt(d?.rinnoviMeseImporto ?? 0)} icon={Calendar} variant="blue" loading={loading} onClick={() => navigate("/portafoglio/incassi")} />
        <SummaryCard label="Polizze da Mettere a Cassa" value={String(d?.polizzeDaCassaCount ?? 0)} sub={fmt(d?.polizzeDaCassaImporto ?? 0)} icon={FileWarning} variant="yellow" loading={loading} onClick={() => navigate("/portafoglio/incassi?stato=attivo")} />
        <SummaryCard label="Incassi Ieri" value={String(d?.incassiIeriCount ?? 0)} sub={fmt(d?.incassiIeriImporto ?? 0)} icon={DollarSign} variant="orange" loading={loading} onClick={() => navigate("/portafoglio/incassi?stato=incassato")} />
        <SummaryCard label="Incassi del Mese" value={String(d?.incassiMeseCount ?? 0)} sub={fmt(d?.incassiMeseImporto ?? 0)} icon={DollarSign} variant="teal" loading={loading} onClick={() => navigate("/portafoglio/incassi?stato=incassato")} />
      </div>
      {/* Chat Non Risposte */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Chat Non Risposte</h3>
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (d?.chatNonRisposte ?? []).length === 0 ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Nessuna chat in attesa di risposta</div>
        ) : (
          <div className="space-y-2">
            {(d?.chatNonRisposte ?? []).map((chat) => (
              <div
                key={chat.canaleId}
                className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                onClick={() => navigate("/chat")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{chat.canaleNome}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {chat.mittente}: {chat.testo}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {chat.data ? format(new Date(chat.data), "dd MMM HH:mm", { locale: it }) : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const UfficioDashboard = ({ loading, data }: { loading: boolean; data: ReturnType<typeof useDashboardData>["ufficio"] }) => {
  const d = data;
  const navigate = useNavigate();
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Scadenze del Mese" value={String(d?.scadenzeMeseCount ?? 0)} sub={fmt(d?.scadenzeMeseImporto ?? 0)} icon={Calendar} variant="yellow" loading={loading} onClick={() => navigate("/portafoglio/incassi")} />
        <SummaryCard label="Incassi del Mese" value={String(d?.incassiMeseCount ?? 0)} sub={fmt(d?.incassiMeseImporto ?? 0)} icon={DollarSign} variant="green" loading={loading} onClick={() => navigate("/portafoglio/incassi")} />
        <SummaryCard label="Fuori Copertura" value={String(d?.fuoriCoperturaCount ?? 0)} sub={fmt(d?.fuoriCoperturaImporto ?? 0)} icon={AlertCircle} variant="orange" loading={loading} onClick={() => navigate("/portafoglio/incassi")} />
        <SummaryCard label="Rimesse da Inviare" value={String(d?.rimesseDaInviareCount ?? 0)} sub={fmt(d?.rimesseDaInviareImporto ?? 0)} icon={Receipt} variant="orange" loading={loading} onClick={() => navigate("/rimesse")} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard title="Incassi Mensili (ultimi 6 mesi)" data={d?.incassiMensili ?? []} loading={loading} />
        <BarChartCard title="Scadenze prossimi 30gg per Agenzia" data={d?.scadenzePerCompagnia ?? []} loading={loading} />
      </div>
    </>
  );
};

const ProduttoreDashboard = ({ loading, data }: { loading: boolean; data: ReturnType<typeof useDashboardData>["produttore"] }) => {
  const d = data;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Trattative Aperte" value={String(d?.trattativeAperte ?? 0)} sub="In corso" icon={Target} variant="blue" loading={loading} />
        <SummaryCard label="Titoli Creati" value={String(d?.titoliAnno ?? 0)} sub="Anno corrente" icon={FileText} variant="green" loading={loading} />
        <SummaryCard label="Provvigioni Maturate" value={fmt(d?.provvigioniDaLiquidare ?? 0)} sub="Da liquidare" icon={DollarSign} variant="teal" loading={loading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard title="Provvigioni Mensili" data={d?.provvigioniMensili ?? []} loading={loading} />
        <PlaceholderChart title="Andamento Trattative" icon={BarChart3} />
      </div>
    </>
  );
};

const ContabilitaDashboard = ({ loading, data }: { loading: boolean; data: ReturnType<typeof useDashboardData>["contabilita"] }) => {
  const d = data;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Anomalie Incroci" value={String(d?.anomalieIncroci ?? 0)} sub="Da verificare" icon={AlertCircle} variant="orange" loading={loading} />
        <SummaryCard label="Fatture da Verificare" value={String(d?.fattureDaVerificare ?? 0)} sub="In attesa" icon={FileWarning} variant="yellow" loading={loading} />
        <SummaryCard label="Incassi KO" value={String(d?.incassiKO ?? 0)} sub="Da risolvere" icon={Receipt} variant="blue" loading={loading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderChart title="Anomalie per Tipo" icon={PieChartIcon} />
        <PlaceholderChart title="Stato Fatture" icon={BarChart3} />
      </div>
    </>
  );
};

const CfoDashboard = ({ loading, data }: { loading: boolean; data: ReturnType<typeof useDashboardData>["cfo"] }) => {
  const d = data;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Entrate Totali" value={fmt(d?.entrateTotali ?? 0)} sub="Anno corrente" icon={TrendingUp} variant="green" loading={loading} />
        <SummaryCard label="Uscite Totali" value={fmt(d?.usciteTotali ?? 0)} sub="Anno corrente" icon={DollarSign} variant="orange" loading={loading} />
        <SummaryCard label="Redditività" value={`${d?.redditivita ?? 0}%`} sub="Margine netto" icon={BarChart3} variant="teal" loading={loading} />
        <SummaryCard label="Provvigioni da Pagare" value={fmt(d?.provvigioniDaPagare ?? 0)} sub="In attesa" icon={Receipt} variant="yellow" loading={loading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderChart title="Entrate vs Uscite" icon={BarChart3} />
        <PlaceholderChart title="Redditività per Ufficio" icon={PieChartIcon} />
      </div>
    </>
  );
};

const ClienteDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SummaryCard label="Documenti" value="0" sub="Disponibili" icon={FolderOpen} variant="blue" />
      <SummaryCard label="Pratiche" value="0" sub="In corso" icon={ClipboardList} variant="green" />
      <SummaryCard label="Comunicazioni" value="0" sub="Non lette" icon={MessageSquare} variant="yellow" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderList title="Documenti Recenti" icon={FolderOpen} />
      <PlaceholderList title="Stato Pratiche" icon={ClipboardList} />
    </div>
  </>
);

// ── Main Dashboard ──

const ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  ufficio: "Responsabile Ufficio",
  produttore: "Produttore",
  contabilita: "Contabilità",
  cfo: "CFO",
  cliente: "Cliente",
};

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const ruolo = profile?.ruolo || "";
  const displayName = profile
    ? `${profile.nome || ""} ${profile.cognome || ""}`.trim() || profile.email || "Utente"
    : "Utente";
  const roleLabel = ROLE_LABELS[ruolo] || ruolo;
  const { loading, admin, ufficio, produttore, contabilita, cfo } = useDashboardData(ruolo);

  // NOTE: il redirect "no dashboard" è gestito centralmente da AuthGuard via getDefaultRoute().
  // Rimosso il useEffect duplicato che causava doppio redirect / flash di pagina sbagliata.

  const renderDashboard = () => {
    switch (ruolo) {
      case "admin": return <AdminDashboard loading={loading} data={admin} />;
      case "ufficio": return <UfficioDashboard loading={loading} data={ufficio} />;
      case "produttore": return <ProduttoreDashboard loading={loading} data={produttore} />;
      case "contabilita": return <ContabilitaDashboard loading={loading} data={contabilita} />;
      case "cfo": return <CfoDashboard loading={loading} data={cfo} />;
      case "cliente": return <ClienteDashboard />;
      default: return <AdminDashboard loading={loading} data={admin} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Benvenuto, {displayName} • {roleLabel}
            </p>
          </div>
        </div>
      </div>
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;
