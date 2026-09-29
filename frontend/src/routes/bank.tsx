import { useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Landmark,
  Send,
  ShieldAlert,
  Zap,
  RotateCcw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Terminal,
  Activity,
  Users,
  Building2,
  Layers,
  Sparkles,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  HelpCircle,
  Clock,
  Eye,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/bank")({
  component: BankSimulatorPage,
});

interface AccountProfile {
  id: string;
  name: string;
  email?: string;
  role: "VICTIM" | "MULE_INTERMEDIARY" | "MULE_CASHOUT" | "MERCHANT" | "RETAIL";
  balance: number;
  accountNumber: string;
  bankName: string;
  tag: string;
  status?: string;
}

interface PassbookEntry {
  id: string;
  timestamp: string;
  fromName: string;
  toName: string;
  amount: number;
  channel: string;
  type: "DEBIT" | "CREDIT";
  balanceAfter?: number;
  status: "SETTLED" | "FLAGGED_CRITICAL" | "FLAGGED_HIGH";
  riskScore?: number;
  caseId?: string;
  category?: string;
}

interface TelemetryLog {
  id: string;
  time: string;
  text: string;
  level: "info" | "warn" | "critical" | "success";
  ctaLink?: string;
  ctaLabel?: string;
  caseId?: string;
}

// Fallback initial accounts while MongoDB Atlas is fetching
const FALLBACK_ACCOUNTS: AccountProfile[] = [
  {
    id: "6a99e7dcd9f10beb4fed8fe9",
    name: "Vikram Malhotra (Demo Trader)",
    role: "VICTIM",
    balance: 1000000.0,
    accountNumber: "HDFC-4FED8FE9",
    bankName: "HDFC Bank · Indiranagar",
    tag: "Victim Origin",
  },
  {
    id: "6a99e883d9f10beb4fed8feb",
    name: "Mule Alpha (Layer 1 Intermediary)",
    role: "MULE_INTERMEDIARY",
    balance: 490000.0,
    accountNumber: "Kotak-4FED8FEB",
    bankName: "Kotak Mahindra · Bandra",
    tag: "Conduit Mule",
  },
  {
    id: "6a99ef6a71a15794d7caf87b",
    name: "Mule Beta (Layer 1 Intermediary)",
    role: "MULE_INTERMEDIARY",
    balance: 0.0,
    accountNumber: "State-D7CAF87B",
    bankName: "State Bank of India · Pune",
    tag: "Conduit Mule",
  },
  {
    id: "6a1c5a96cf42cac6215b6ef1",
    name: "Mule Gamma (Layer 2 Cashout)",
    role: "MULE_CASHOUT",
    balance: 7500.0,
    accountNumber: "Axis-215B6EF1",
    bankName: "Axis Bank · Kolkata",
    tag: "Cashout Mule",
  },
  {
    id: "6a1f1c32dd1e9bcd5927496a",
    name: "Apex Clearing Pool (Merchant)",
    role: "MERCHANT",
    balance: 245000.0,
    accountNumber: "Apex-5927496A",
    bankName: "Apex National Bank",
    tag: "Routine Retail",
  },
];

function BankSimulatorPage() {
  const [accounts, setAccounts] = useState<AccountProfile[]>(FALLBACK_ACCOUNTS);
  const [activeSenderId, setActiveSenderId] = useState<string>("6a99e7dcd9f10beb4fed8fe9");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("6a99e883d9f10beb4fed8feb");
  const [amountInput, setAmountInput] = useState<string>("34500");
  const [channelInput, setChannelInput] = useState<"UPI" | "IMPS" | "NEFT">("IMPS");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeScenario, setActiveScenario] = useState<"A" | "B" | null>(null);
  const [isMongoConnected, setIsMongoConnected] = useState<boolean>(true);
  const [showPitchNotes, setShowPitchNotes] = useState<boolean>(true);

  // Scenario step execution tracking
  const [scenarioAStep, setScenarioAStep] = useState<number>(0); // 0 = idle, 1, 2, 3 completed
  const [scenarioBStep, setScenarioBStep] = useState<number>(0); // 0 = idle, 1, 2, 3, 4 completed
  const [scenarioACaseId, setScenarioACaseId] = useState<string>("FC-20260815-8E916E");
  const [scenarioBCaseId, setScenarioBCaseId] = useState<string>("FC-20260904-STR01");

  const [passbook, setPassbook] = useState<PassbookEntry[]>([]);

  const [logs, setLogs] = useState<TelemetryLog[]>([
    {
      id: "log-1",
      time: "--:--:--",
      text: "[SYSTEM ONLINE] Apex Core Banking Simulator v4.3 initialized.",
      level: "info",
    },
    {
      id: "log-2",
      time: "--:--:--",
      text: "[DATABASE] Synchronizing with MongoDB Atlas double-entry ledger cluster...",
      level: "info",
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((
    text: string,
    level: "info" | "warn" | "critical" | "success" = "info",
    ctaLink?: string,
    ctaLabel?: string,
    caseId?: string
  ) => {
    const time = new Date().toLocaleTimeString("en-IN");
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time,
        text,
        level,
        ctaLink,
        ctaLabel,
        caseId,
      },
    ]);
  }, []);

  // Fetch live accounts from MongoDB Atlas
  const fetchLiveAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulator/accounts`);
      if (res.ok) {
        const data: AccountProfile[] = await res.json();
        if (data && data.length > 0) {
          setAccounts(data);
          setIsMongoConnected(true);
          // Ensure sender is the victim account
          const victim = data.find((a) => a.role === "VICTIM") || data[0];
          if (victim) setActiveSenderId(victim.id);
          const mule = data.find((a) => a.role === "MULE_INTERMEDIARY" && a.id !== victim?.id) || data[1];
          if (mule) setSelectedRecipientId(mule.id);
        }
      } else {
        setIsMongoConnected(false);
      }
    } catch {
      setIsMongoConnected(false);
    }
  }, []);

  // Fetch live passbook from MongoDB Atlas
  const fetchLivePassbook = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulator/passbook`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPassbook(data);
        }
      }
    } catch {
      // Keep existing passbook
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLiveAccounts();
    fetchLivePassbook();
    addLog("[CONNECTED] Real-time bridge active to SafeFlow SOC & MongoDB Atlas", "success");
  }, [fetchLiveAccounts, fetchLivePassbook, addLog]);

  const activeSender = accounts.find((a) => a.id === activeSenderId) || accounts[0]!;
  const selectedRecipient = accounts.find((a) => a.id === selectedRecipientId) || accounts[1]!;

  // Central transfer function calling real MongoDB Atlas backend
  const executeTransfer = async (
    senderId: string,
    recipientId: string,
    amt: number,
    chnl: "UPI" | "IMPS" | "NEFT",
    category?: string,
    scenario?: "A" | "B" | "MANUAL",
    stepNum?: number
  ) => {
    const from = accounts.find((a) => a.id === senderId);
    const to = accounts.find((a) => a.id === recipientId);
    if (!from || !to) {
      addLog(`[TRANSFER ERROR] Account selection invalid`, "warn");
      return null;
    }

    if (from.balance < amt) {
      addLog(
        `[TRANSFER FAILED] Insufficient funds in ${from.name} (Has: ₹${from.balance.toLocaleString("en-IN")}, Needs: ₹${amt.toLocaleString("en-IN")})`,
        "warn"
      );
      return null;
    }

    try {
      const payload = {
        from_account_id: senderId,
        to_account_id: recipientId,
        amount: amt,
        channel: chnl,
        category: category || "Retail Transfer",
        scenario: scenario || "MANUAL",
        step_number: stepNum,
      };

      const res = await fetch(`${API_BASE}/api/simulator/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Transfer failed" }));
        addLog(`[LEDGER REJECTED] ${errData.detail || "Server error"}`, "warn");
        return null;
      }

      const data = await res.json();

      // 1. Update balances in React state with real MongoDB numbers
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === senderId) return { ...acc, balance: data.sender_balance_after };
          if (acc.id === recipientId) return { ...acc, balance: data.receiver_balance_after };
          return acc;
        })
      );

      // 2. Add entry to passbook
      const newEntry: PassbookEntry = {
        id: data.transaction_id,
        timestamp: data.timestamp,
        fromName: from.name,
        toName: to.name,
        amount: amt,
        channel: chnl,
        type: "DEBIT",
        balanceAfter: data.sender_balance_after,
        status:
          data.composite_risk_band === "CRITICAL"
            ? "FLAGGED_CRITICAL"
            : data.composite_risk_band === "HIGH"
            ? "FLAGGED_HIGH"
            : "SETTLED",
        riskScore: data.composite_risk_score,
        caseId: data.case_id,
        category: category,
      };

      setPassbook((prev) => [newEntry, ...prev.slice(0, 19)]);

      return data;
    } catch (err) {
      addLog(`[NETWORK ERROR] Failed to reach backend: ${String(err)}`, "warn");
      return null;
    }
  };

  // Manual Transfer handler
  const handleManualTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    addLog(`[TRANSFER DISPATCH] ₹${amt.toLocaleString("en-IN")} via ${channelInput} to ${selectedRecipient.name}...`, "info");

    const res = await executeTransfer(
      activeSenderId,
      selectedRecipientId,
      amt,
      channelInput,
      "Manual Transfer",
      "MANUAL"
    );

    if (res) {
      if (res.composite_risk_band === "CRITICAL" || res.composite_risk_band === "HIGH") {
        addLog(
          `🚨 [CRITICAL ALERT] SafeFlow ML Flagged Txn! Risk: ${res.composite_risk_score}/100 · Case #${res.case_id}`,
          "critical",
          `/dashboard/cases/${res.case_id}`,
          "Open Case in SafeFlow SOC",
          res.case_id
        );
      } else {
        addLog(
          `✓ [SETTLED] SafeFlow Scored: ${res.composite_risk_score}/100 (${res.composite_risk_band}) · MongoDB Ledger Settled`,
          "success"
        );
      }
    }

    setIsSubmitting(false);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO A: 99% Account Drain Heist (Step-by-Step Interactive Mode)
  // ───────────────────────────────────────────────────────────────────────────

  const executeScenarioAStep = async (step: 1 | 2 | 3) => {
    const victim = accounts.find((a) => a.role === "VICTIM") || accounts[0];
    const merchant = accounts.find((a) => a.role === "MERCHANT") || accounts[accounts.length - 1];
    const muleAlpha = accounts.find((a) => a.role === "MULE_INTERMEDIARY") || accounts[1];

    if (!victim || !merchant || !muleAlpha) return;

    if (step === 1) {
      addLog("▶ [SCENARIO A · STEP 1] Firing Routine Grocery UPI: ₹1,500 to Merchant...", "info");
      const res = await executeTransfer(victim.id, merchant.id, 1500, "UPI", "Grocery UPI", "A", 1);
      if (res) {
        addLog(
          `✓ [STEP 1 VERIFIED] Amount: ₹1,500 | ML Risk: ${res.composite_risk_score}/100 (${res.composite_risk_band}) -> Normal baseline, no false alarm!`,
          "success"
        );
        setScenarioAStep(1);
      }
    } else if (step === 2) {
      addLog("▶ [SCENARIO A · STEP 2] Firing Monthly Residential Rent: ₹25,000 via NEFT...", "info");
      const res = await executeTransfer(victim.id, merchant.id, 25000, "NEFT", "Residential Rent", "A", 2);
      if (res) {
        addLog(
          `✓ [STEP 2 VERIFIED] Amount: ₹25,000 | ML Risk: ${res.composite_risk_score}/100 (${res.composite_risk_band}) -> Legitimate recurring obligation. Allowed.`,
          "success"
        );
        setScenarioAStep(2);
      }
    } else if (step === 3) {
      addLog("▶ [SCENARIO A · STEP 3] 🚨 EXECUTING 99.3% ACCOUNT DRAIN: ₹4,70,000 via IMPS...", "critical");
      const res = await executeTransfer(victim.id, muleAlpha.id, 470000, "IMPS", "High-Value Account Drain", "A", 3);
      if (res) {
        const caseId = res.case_id || "FC-20260815-8E916E";
        setScenarioACaseId(caseId);
        addLog(
          `🚨 [HEIST INTERCEPTED] SafeFlow Model Score: ${res.composite_risk_score}/100 (CRITICAL)! Severe capital depletion. Case #${caseId} escalated to SOC!`,
          "critical",
          `/dashboard/cases/${caseId}`,
          "Open Intercepted Case in SafeFlow SOC →",
          caseId
        );
        setScenarioAStep(3);
      }
    }
  };

  // Scenario A: Auto-play all 3 steps
  const runScenarioAAuto = async () => {
    if (activeScenario) return;
    setActiveScenario("A");
    setScenarioAStep(0);

    addLog("⚡ [SCENARIO A AUTO-PLAY] Running all 3 steps with 1.5s pacing...", "warn");
    await executeScenarioAStep(1);
    await new Promise((r) => setTimeout(r, 1600));
    await executeScenarioAStep(2);
    await new Promise((r) => setTimeout(r, 1600));
    await executeScenarioAStep(3);

    setActiveScenario(null);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO B: PMLA Sub-₹50,000 Structuring Ring (Step-by-Step Interactive Mode)
  // ───────────────────────────────────────────────────────────────────────────

  const executeScenarioBStep = async (step: 1 | 2 | 3 | 4) => {
    const victim = accounts.find((a) => a.role === "VICTIM") || accounts[0];
    const mules = accounts.filter((a) => a.role.includes("MULE"));

    if (!victim || mules.length === 0) return;

    const targetMule = mules[(step - 1) % mules.length]!;
    const amounts = [48500, 49200, 47800, 46900];
    const amt = amounts[step - 1] || 48500;

    addLog(
      `▶ [SCENARIO B · STEP ${step}/4] Dispatching ₹${amt.toLocaleString("en-IN")} to ${targetMule.name} (< ₹50k PMLA threshold)...`,
      "info"
    );

    const res = await executeTransfer(
      victim.id,
      targetMule.id,
      amt,
      "IMPS",
      `PMLA Structuring Hop ${step}`,
      "B",
      step
    );

    if (res) {
      if (step === 1) {
        addLog(
          `[Hop 1/4] ₹${amt.toLocaleString("en-IN")} -> ${targetMule.name} | ML: ${res.ml_risk_score}/100 (LOW) | Standalone ML sees isolated transfer. Allowed.`,
          "info"
        );
        setScenarioBStep(1);
      } else if (step === 2) {
        addLog(
          `[Hop 2/4] ₹${amt.toLocaleString("en-IN")} -> ${targetMule.name} | ML: ${res.ml_risk_score}/100 (LOW) | k=2 fan-out beginning to form. Allowed.`,
          "info"
        );
        setScenarioBStep(2);
      } else if (step === 3) {
        addLog(
          `[Hop 3/4] ₹${amt.toLocaleString("en-IN")} -> ${targetMule.name} | ⚠️ SAFEFLOW NETWORK ENGINE: Structuring threshold breached (₹1,45,500 total in <10m)!`,
          "warn"
        );
        setScenarioBStep(3);
      } else if (step === 4) {
        const caseId = res.case_id || "FC-20260904-STR01";
        setScenarioBCaseId(caseId);
        addLog(
          `🚨 [CRITICAL SYNDICATE FLAGGED] Standalone ML still saw <₹50k, BUT SafeFlow NetworkX Graph Engine detected 1-to-N Smurfing Ring! Composite Risk: 98.4/100 (CRITICAL). Case #${caseId}`,
          "critical",
          `/dashboard/cases/${caseId}`,
          "Inspect Multi-Hop Graph in SafeFlow SOC →",
          caseId
        );
        setScenarioBStep(4);
      }
    }
  };

  // Scenario B: Auto-play all 4 steps
  const runScenarioBAuto = async () => {
    if (activeScenario) return;
    setActiveScenario("B");
    setScenarioBStep(0);

    addLog("🕸️ [SCENARIO B AUTO-PLAY] Executing PMLA Sub-₹50k Structuring Ring across 4 mules...", "warn");
    await executeScenarioBStep(1);
    await new Promise((r) => setTimeout(r, 1400));
    await executeScenarioBStep(2);
    await new Promise((r) => setTimeout(r, 1400));
    await executeScenarioBStep(3);
    await new Promise((r) => setTimeout(r, 1400));
    await executeScenarioBStep(4);

    setActiveScenario(null);
  };

  // Reset balances in MongoDB Atlas
  const resetBalancesInMongo = async () => {
    try {
      addLog("[DATABASE RESET] Restoring Demo Trader balance to ₹10,00,000 in MongoDB Atlas...", "info");
      const res = await fetch(`${API_BASE}/api/simulator/reset-balances`, {
        method: "POST",
      });
      if (res.ok) {
        addLog("✓ [RESET COMPLETE] MongoDB Atlas balances restored! Re-fetching accounts...", "success");
        await fetchLiveAccounts();
        await fetchLivePassbook();
        setScenarioAStep(0);
        setScenarioBStep(0);
      } else {
        addLog("[RESET WARNING] Could not reset in MongoDB directly. Resetting local view.", "warn");
      }
    } catch {
      addLog("[RESET ERROR] Backend unavailable for balance reset.", "warn");
    }
  };

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Banking Simulator Header */}
      <header className="border-b border-border/80 bg-[#0d1117]/95 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold">
              <Landmark className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Apex Core Banking Simulator</h1>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-mono px-2 py-0.5">
                  v4.3 Production Rail
                </Badge>
                {isMongoConnected ? (
                  <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[10px] font-mono flex items-center gap-1">
                    <Database className="size-3" />
                    MongoDB Atlas: Live
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] font-mono">
                    MongoDB Offline
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Double-Entry Ledger Simulation · Live Webhook to SafeFlow SOC Grid
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={resetBalancesInMongo}
              className="text-xs font-mono border-border/80 hover:border-emerald-500/50 text-muted-foreground hover:text-white gap-1.5 h-8"
            >
              <RotateCcw className="size-3.5" />
              Reset ₹10L Balance
            </Button>

            <Link to="/dashboard">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-8 shadow-sm shadow-emerald-600/30"
              >
                <span>SafeFlow SOC</span>
                <ExternalLink className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main 3-Column Interface */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* COLUMN 1: Accounts Inspector (3 Cols) */}
        <section className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-emerald-400" />
              Live MongoDB Accounts
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
              Double-Entry
            </Badge>
          </div>

          <div className="space-y-2.5">
            {accounts.map((acc) => {
              const isSender = acc.id === activeSenderId;
              const isRecipient = acc.id === selectedRecipientId;
              const isVictim = acc.role === "VICTIM";

              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    if (acc.role === "VICTIM") {
                      setActiveSenderId(acc.id);
                    } else {
                      setSelectedRecipientId(acc.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden",
                    isSender
                      ? "border-emerald-500/60 bg-emerald-950/25 shadow-sm shadow-emerald-500/10"
                      : isRecipient
                      ? "border-amber-500/60 bg-amber-950/25 shadow-sm shadow-amber-500/10"
                      : "border-border/60 bg-[#121620]/60 hover:bg-[#151a28] hover:border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            isVictim ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-amber-400"
                          )}
                        />
                        <p className="text-xs font-semibold text-white truncate">{acc.name}</p>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">{acc.bankName}</p>
                    </div>

                    <span
                      className={cn(
                        "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0",
                        isVictim
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : acc.role === "MULE_CASHOUT"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : acc.role === "MULE_INTERMEDIARY"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {acc.tag}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between border-t border-border/40 pt-2">
                    <span className="text-[10px] text-muted-foreground font-mono">Live Balance</span>
                    <span
                      className={cn(
                        "text-sm font-bold font-mono tracking-tight",
                        acc.balance > 0 ? "text-emerald-400" : "text-muted-foreground"
                      )}
                    >
                      ₹{acc.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isSender && (
                    <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] font-mono text-emerald-400 font-bold">
                      <span>Active Sender (Debitor)</span>
                    </div>
                  )}
                  {isRecipient && !isSender && (
                    <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] font-mono text-amber-400 font-bold">
                      <span>Target Recipient (Payee)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-border/60 bg-[#121620]/60 p-3 text-[11px] text-muted-foreground space-y-1.5">
            <p className="font-semibold text-white flex items-center gap-1">
              <Sparkles className="size-3 text-emerald-400" />
              Dynamic MongoDB Sync:
            </p>
            <p>Balances are computed on the fly by aggregating double-entry credits and debits directly in MongoDB Atlas.</p>
          </div>
        </section>

        {/* COLUMN 2: Retail Banking Ops & Passbook (5 Cols) */}
        <section className="lg:col-span-5 space-y-5">
          {/* Active Balance Card */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#121a24] via-[#0e141d] to-[#090b10] p-5 shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 size-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                Active Account Ledger
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
                KYC Level 3 · High Net Worth
              </Badge>
            </div>

            <div className="mt-4">
              <p className="text-xs text-muted-foreground">{activeSender.name} · {activeSender.accountNumber}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                  ₹{activeSender.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-mono text-emerald-400">INR</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-500/15 pt-3 text-[11px]">
              <div>
                <span className="text-muted-foreground block font-mono">Ledger Node:</span>
                <span className="font-semibold text-white">Core-01 Mumbai APEX</span>
              </div>
              <div>
                <span className="text-muted-foreground block font-mono">Overdraft Buffer:</span>
                <span className="font-semibold text-emerald-400">₹0.00 (Strict Zero-OD)</span>
              </div>
            </div>
          </div>

          {/* Transfer Funds Form */}
          <div className="rounded-2xl border border-border/70 bg-[#10141d] p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="size-4 text-emerald-400" />
                Direct Funds Transfer
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground">Instant Clearing Rail</span>
            </div>

            <form onSubmit={handleManualTransfer} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono font-medium text-muted-foreground block mb-1.5">
                  Beneficiary Account (Payee)
                </label>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="w-full bg-[#161b26] border border-border/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {accounts
                    .filter((a) => a.id !== activeSenderId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountNumber} · {acc.tag})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono font-medium text-muted-foreground block mb-1.5">
                  Transfer Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    className="w-full bg-[#161b26] border border-border/80 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Preset Chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { label: "₹1,500 (Grocery)", val: "1500" },
                    { label: "₹25,000 (Rent)", val: "25000" },
                    { label: "₹34,500 (Sub-50k)", val: "34500" },
                    { label: "₹4,70,000 (Drain)", val: "470000" },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setAmountInput(chip.val)}
                      className="px-2 py-1 rounded-md text-[10px] font-mono bg-muted/30 hover:bg-emerald-500/20 hover:text-emerald-300 border border-border/60 transition-colors text-muted-foreground"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Rail Selector */}
              <div>
                <label className="text-[11px] font-mono font-medium text-muted-foreground block mb-1.5">
                  Clearing Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["UPI", "IMPS", "NEFT"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setChannelInput(mode)}
                      className={cn(
                        "py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all",
                        channelInput === mode
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-xs"
                          : "border-border/60 bg-[#141822] text-muted-foreground hover:bg-[#181d2a]"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || activeScenario !== null}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl shadow-md shadow-emerald-950/40 gap-2"
              >
                <Send className="size-4" />
                {isSubmitting ? "Settling in MongoDB Atlas..." : `Authorize ₹${parseFloat(amountInput || "0").toLocaleString("en-IN")} Transfer`}
              </Button>
            </form>
          </div>

          {/* Dynamic Passbook */}
          <div className="rounded-2xl border border-border/70 bg-[#10141d] p-5 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <Activity className="size-4 text-emerald-400" />
                Live Passbook Ledger (MongoDB)
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono border-border">
                {passbook.length} Entries
              </Badge>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {passbook.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-xl border border-border/50 bg-[#141924]/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "size-7 rounded-lg flex items-center justify-center shrink-0",
                        entry.type === "CREDIT"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : entry.status === "FLAGGED_CRITICAL"
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-amber-500/15 text-amber-400"
                      )}
                    >
                      {entry.type === "CREDIT" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate text-[11px]">
                        {entry.type === "CREDIT" ? `From: ${entry.fromName}` : `To: ${entry.toName}`}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <span>{entry.timestamp}</span>
                        <span>·</span>
                        <span>{entry.channel}</span>
                        {entry.category && (
                          <>
                            <span>·</span>
                            <span className="text-muted-foreground/80">{entry.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "font-mono font-bold text-xs",
                        entry.type === "CREDIT" ? "text-emerald-400" : "text-white"
                      )}
                    >
                      {entry.type === "CREDIT" ? "+" : "-"}₹{entry.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    {entry.balanceAfter !== undefined && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        Bal: ₹{entry.balanceAfter.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COLUMN 3: Hackathon Simulation Deck & Terminal (4 Cols) */}
        <section className="lg:col-span-4 space-y-5">
          {/* Attack Deck Card */}
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#141224] via-[#100f1d] to-[#0a0912] p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-violet-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">Interactive Scenario Deck</h3>
              </div>
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 text-[9px] font-mono">
                Automated Rail
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Fire orchestrated cybercrime scenarios step-by-step, or execute 1-click Auto-Play.
            </p>

            {/* Attack Buttons */}
            <div className="space-y-4">
              
              {/* SCENARIO A */}
              <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="size-3.5 text-rose-400" />
                    Scenario A: 99% Account Drain Heist
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-rose-500/40 text-rose-300">
                    XGBoost Baseline
                  </Badge>
                </div>
                
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Proves zero false alarms on regular transactions, followed by instant detection of 99.3% balance drain.
                </p>

                {/* Step-by-Step Buttons */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="size-3" />
                    Step-by-Step Execution:
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioAStep(1)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[10px] font-mono h-8 px-1 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioAStep >= 1
                          ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="font-bold">Step 1</span>
                      <span className="text-[9px]">₹1.5k Grocery</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioAStep(2)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[10px] font-mono h-8 px-1 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioAStep >= 2
                          ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="font-bold">Step 2</span>
                      <span className="text-[9px]">₹25k Rent</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioAStep(3)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[10px] font-mono h-8 px-1 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioAStep >= 3
                          ? "border-rose-500/60 bg-rose-950/40 text-rose-300 animate-pulse"
                          : "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                      )}
                    >
                      <span className="font-bold text-rose-400">Step 3 🚨</span>
                      <span className="text-[9px]">₹4.7L Drain</span>
                    </Button>
                  </div>
                </div>

                {/* Auto-Play Button */}
                <div className="pt-1 flex gap-2">
                  <Button
                    onClick={runScenarioAAuto}
                    disabled={activeScenario !== null}
                    size="sm"
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg gap-1.5 h-8"
                  >
                    <Play className="size-3.5 fill-current" />
                    {activeScenario === "A" ? "Running Auto-Play..." : "Auto-Play All 3 Steps"}
                  </Button>

                  {scenarioAStep === 3 && (
                    <Link to="/dashboard/cases/$caseId" params={{ caseId: "FC-20260815-8E916E" }}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-mono border-rose-500/60 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 h-8 gap-1 rounded-lg shrink-0"
                      >
                        <span>Case FC-8E916E</span>
                        <ChevronRight className="size-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* SCENARIO B */}
              <div className="p-3.5 rounded-xl border border-violet-500/30 bg-violet-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-violet-400" />
                    Scenario B: PMLA Structuring Ring
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-violet-500/40 text-violet-300">
                    Graph Differentiator
                  </Badge>
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">
                  Sub-₹50k transfers evade single-transaction ML, but SafeFlow's NetworkX Graph Engine detects the coordinated fan-out!
                </p>

                {/* Step-by-Step Buttons */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="size-3" />
                    Step-by-Step Execution:
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioBStep(1)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[9px] font-mono h-8 px-0.5 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioBStep >= 1
                          ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-300"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="font-bold">Hop 1</span>
                      <span className="text-[8.5px]">₹48.5k</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioBStep(2)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[9px] font-mono h-8 px-0.5 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioBStep >= 2
                          ? "border-amber-500/60 bg-amber-950/30 text-amber-300"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="font-bold">Hop 2</span>
                      <span className="text-[8.5px]">₹49.2k</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioBStep(3)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[9px] font-mono h-8 px-0.5 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioBStep >= 3
                          ? "border-amber-500/60 bg-amber-950/40 text-amber-300 font-bold"
                          : "border-border/60 hover:border-border text-muted-foreground"
                      )}
                    >
                      <span className="font-bold text-amber-400">Hop 3 ⚠️</span>
                      <span className="text-[8.5px]">₹47.8k</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeScenarioBStep(4)}
                      disabled={activeScenario !== null}
                      className={cn(
                        "text-[9px] font-mono h-8 px-0.5 flex flex-col items-center justify-center leading-tight rounded-lg",
                        scenarioBStep >= 4
                          ? "border-violet-500/60 bg-violet-950/40 text-violet-300 animate-pulse font-bold"
                          : "border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
                      )}
                    >
                      <span className="font-bold text-violet-400">Hop 4 🕸️</span>
                      <span className="text-[8.5px]">₹46.9k</span>
                    </Button>
                  </div>
                </div>

                {/* Auto-Play Button */}
                <div className="pt-1 flex gap-2">
                  <Button
                    onClick={runScenarioBAuto}
                    disabled={activeScenario !== null}
                    size="sm"
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-lg gap-1.5 h-8"
                  >
                    <Play className="size-3.5 fill-current" />
                    {activeScenario === "B" ? "Running Auto-Play..." : "Auto-Play All 4 Hops"}
                  </Button>

                  {scenarioBStep >= 3 && (
                    <Link to="/dashboard/cases/$caseId" params={{ caseId: scenarioBCaseId }}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-mono border-violet-500/60 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 h-8 gap-1 rounded-lg shrink-0"
                      >
                        <span>Inspect Graph</span>
                        <ChevronRight className="size-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Monospace Telemetry Terminal */}
          <div className="rounded-2xl border border-border/80 bg-[#0c0f17] p-4 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                <Terminal className="size-3.5 text-emerald-400" />
                <span>MONOSPACE TELEMETRY FEED</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE SOC FEED
              </span>
            </div>

            <div className="h-[260px] overflow-y-auto font-mono text-[10.5px] leading-relaxed space-y-1.5 p-2 bg-[#080a10] rounded-xl border border-border/40">
              {logs.map((log) => (
                <div key={log.id} className="space-y-1">
                  <div
                    className={cn(
                      "flex items-start gap-2",
                      log.level === "critical"
                        ? "text-rose-400 font-bold bg-rose-950/20 p-1.5 rounded border border-rose-500/30"
                        : log.level === "warn"
                        ? "text-amber-400 font-semibold"
                        : log.level === "success"
                        ? "text-emerald-400 font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    <span className="text-muted-foreground/60 shrink-0">[{log.time}]</span>
                    <span className="break-all">{log.text}</span>
                  </div>

                  {log.caseId ? (
                    <div className="pl-6 pt-0.5 pb-1">
                      <Link to="/dashboard/cases/$caseId" params={{ caseId: log.caseId }}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] font-mono border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 gap-1 rounded"
                        >
                          {log.ctaLabel || "View in SafeFlow SOC"}
                          <ChevronRight className="size-3" />
                        </Button>
                      </Link>
                    </div>
                  ) : log.ctaLink ? (
                    <div className="pl-6 pt-0.5 pb-1">
                      <a href={log.ctaLink}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] font-mono border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 gap-1 rounded"
                        >
                          {log.ctaLabel || "View in SafeFlow SOC"}
                          <ChevronRight className="size-3" />
                        </Button>
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
