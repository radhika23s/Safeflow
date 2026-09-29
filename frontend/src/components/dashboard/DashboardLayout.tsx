import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { cn } from "@/lib/utils";
import { useRole, type RoleId } from "@/context/RoleContext";

export interface DashboardLayoutProps {
  title?: string;
  userRole?: string;
  userName?: string;
  children?: React.ReactNode;
}

export function DashboardLayout({
  title,
  userRole,
  userName,
  children,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { role, user, dashboardTitle } = useRole();

  const activeRole = (userRole as RoleId) || role;
  const activeTitle = title || dashboardTitle;
  const activeUserName = userName || user.name;

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} userRole={activeRole} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <DashboardHeader title={activeTitle} userRole={activeRole} userName={activeUserName} />

        {/* Main Content Viewport */}
        <main className={cn("flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto space-y-6")}>
          {children}
        </main>
      </div>
    </div>
  );
}
