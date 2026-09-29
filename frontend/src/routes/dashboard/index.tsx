import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InvestigatorDashboard } from "@/components/dashboard/InvestigatorDashboard";
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { useRole } from "@/context/RoleContext";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user, dashboardTitle } = useRole();

  return (
    <DashboardLayout
      title={dashboardTitle}
      userRole={role}
      userName={user.name}
    >
      {role === "investigator" && <InvestigatorDashboard userRole={role} />}
      {role === "manager" && <ManagerDashboard userRole={role} />}
      {role === "administrator" && <AdminDashboard userRole={role} />}
    </DashboardLayout>
  );
}
