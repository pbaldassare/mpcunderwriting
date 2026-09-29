import { CfoReportPanel } from "@/components/cfo/CfoReportPanel";

export { REPORT_CONFIGS, type ReportConfig } from "@/lib/reportConfigs";

const ReportPage = () => <CfoReportPanel embedded={false} />;

export default ReportPage;
