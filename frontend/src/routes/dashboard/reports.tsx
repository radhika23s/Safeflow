import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, CheckCircle2, Eye, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { listCases, type BackendCase } from "@/lib/api";

export const Route = createFileRoute("/dashboard/reports")({
  component: ReportsPage,
});

const mockReports = [
  {
    id: "REP-2026-0891",
    title: "FIU-IND Suspicious Transaction Report (STR)",
    caseId: "FC-20260815-83D0B1",
    type: "Regulatory Filing (STR)",
    status: "Generated",
    date: "2026-08-20",
    author: "AI Multi-Agent System",
  },
  {
    id: "REP-2026-0888",
    title: "Cross-Border Wire Velocity Analysis",
    caseId: "FC-20260815-8616E2",
    type: "Risk Intelligence",
    status: "Pending Review",
    date: "2026-08-19",
    author: "Sarah Chen",
  },
  {
    id: "REP-2026-0882",
    title: "Quarterly AML Compliance Audit Summary",
    caseId: "FC-20260815-8E916E",
    type: "Audit Log",
    status: "Published",
    date: "2026-08-15",
    author: "Alex Chen",
  },
];

function ReportsPage() {
  const { data: casesData, isLoading, isError } = useQuery({
    queryKey: ["cases"],
    queryFn: () => listCases({ limit: 50 }),
    retry: 1,
    staleTime: 10_000,
  });

  const reports = casesData?.cases && casesData.cases.length > 0
    ? casesData.cases.map((c: BackendCase, idx: number) => ({
        id: `REP-2026-${String(idx + 1).padStart(4, "0")}`,
        title: c.str_draft
          ? `FIU-IND Suspicious Transaction Report (STR)`
          : `Investigation Summary · ${c.recommended_action}`,
        caseId: c.case_id,
        type: c.risk_band === "CRITICAL" || c.risk_band === "HIGH" ? "STR / Regulatory Filing" : "Internal AML Audit",
        status: c.status === "CLOSED" ? "Approved" : c.investigation_report ? "Generated" : "Drafting",
        date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(c.opened_at || Date.now())),
        author: c.analyst_id || "Orchestrator Agent",
      }))
    : mockReports;

  const downloadReport = (reportItem: (typeof reports)[0]) => {
    const textContent = `=====================================================
SAFE FLOW - FINANCIAL CRIME INVESTIGATION REPORT
=====================================================
Report ID: ${reportItem.id}
Case Reference: ${reportItem.caseId}
Type: ${reportItem.type}
Status: ${reportItem.status}
Generated: ${reportItem.date}
Author: ${reportItem.author}
Authority: Financial Intelligence Unit - India (FIU-IND)
Act: Prevention of Money Laundering Act (PMLA), 2002
=====================================================
`;
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportItem.id}_${reportItem.caseId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Reports & Regulatory Filings">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Audit & Filing Repository</h2>
              <p className="text-xs text-muted-foreground">
                Generated investigation reports, FIU-IND STR filings, and compliance documentation.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="gap-2 bg-violet text-white">
            <Link to="/dashboard/cases">
              <FileText className="size-4" />
              View Active Cases
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Loading regulatory filings...</span>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 text-left">Report Title</th>
                  <th className="px-6 py-4 text-left">Case Reference</th>
                  <th className="px-6 py-4 text-left">Type</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Generated Date</th>
                  <th className="px-6 py-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-foreground">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {report.id} · By {report.author}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to="/dashboard/cases/$caseId"
                        params={{ caseId: report.caseId }}
                        className="font-semibold text-violet hover:underline text-xs"
                      >
                        {report.caseId}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-muted-foreground">{report.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                        <CheckCircle2 className="size-3" />
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{report.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                        >
                          <Link to="/dashboard/cases/$caseId" params={{ caseId: report.caseId }}>
                            <Eye className="size-3" />
                            View
                          </Link>
                        </Button>
                        <Button
                          onClick={() => downloadReport(report)}
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1"
                        >
                          <Download className="size-3" />
                          Export
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isError && (
          <p className="text-center text-xs text-muted-foreground">
            ⚠ Backend offline — displaying local demo repository
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
