import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import Topbar from "./Topbar";
import PageBreadcrumb from "./PageBreadcrumb";
import CommandPalette from "./CommandPalette";
import RecentEntitiesTracker from "./RecentEntitiesTracker";
import GlobalShortcuts from "./GlobalShortcuts";
import SinistroReminderPopupGate from "./sinistri/SinistroReminderPopupGate";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useNavigationHistoryTracker } from "@/hooks/useNavigationHistory";

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  useInactivityTimeout();
  useNavigationHistoryTracker();

  return (
    <div className="min-h-screen bg-background">
      <CommandPalette />
      <RecentEntitiesTracker />
      <GlobalShortcuts />
      <SinistroReminderPopupGate />

      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div
        className={`transition-all duration-200 ${
          collapsed ? "ml-16" : "ml-60"
        }`}
      >
        <Topbar onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main className="p-6">
          <PageBreadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
