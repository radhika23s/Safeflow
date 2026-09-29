import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, AlertCircle, Info, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/context/RoleContext";
import { Logo } from "@/components/Logo";

interface DemoAccount {
  email: string;
  password: string;
  label: string;
  badge: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@smarthorizon.ai",
    password: "demo-password",
    label: "Administrator",
    badge: "User Management & System Access",
  },
  {
    email: "sarah.chen@smarthorizon.ai",
    password: "demo-password",
    label: "Compliance Manager",
    badge: "Signatory & SAR Approvals",
  },
  {
    email: "marcus.johnson@smarthorizon.ai",
    password: "demo-password",
    label: "Senior Investigator",
    badge: "Graph Analysis & AI Briefs",
  },
];

export const Route = createFileRoute("/sign-in")({ component: SignInPage });

function SignInPage() {
  const { loginWithCredentials } = useRole();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [infoNotice, setInfoNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fillAccount = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setEmailError("");
    setPasswordError("");
    setGeneralError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError("");
    setPasswordError("");
    setGeneralError("");
    setInfoNotice("");

    const normalizedEmail = email.trim().toLowerCase();
    let hasError = false;
    if (!normalizedEmail) {
      setEmailError("Work email is required.");
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setEmailError("Please enter a valid work email address.");
      hasError = true;
    }
    if (!password) {
      setPasswordError("Password is required.");
      hasError = true;
    }
    if (hasError) return;

    setIsSubmitting(true);
    try {
      const user = await loginWithCredentials(normalizedEmail, password);
      const roleLabel =
        user.role === "administrator"
          ? "System Administrator"
          : user.role === "manager"
          ? "Compliance Manager"
          : "Financial Crime Investigator";

      setInfoNotice(`Identity verified. Welcome back, ${user.name} (${roleLabel}).`);
      await new Promise((resolve) => setTimeout(resolve, 350));
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const errMsg =
        err?.message?.replace("API 401: ", "")?.replace("API 403: ", "") ||
        "Invalid work email or password. Please verify your credentials.";
      setGeneralError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-offwhite p-3 md:p-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-border bg-background shadow-[var(--shadow-float)]">
        <div className="grid min-h-[calc(100vh-2rem)] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative hidden h-full min-h-[calc(100vh-2rem)] overflow-hidden bg-black lg:block">
            <img
              src="/login.png"
              alt="Safe Flow security workspace"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
            <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-md">
              <div className="flex items-center gap-2 text-white">
                <ShieldCheck className="size-5 text-teal" />
                <span className="text-sm font-semibold tracking-wide">Multi-Role Governance Protocol</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Role-gated workspaces ensure strict maker-checker segregation between AML Investigators,
                Compliance Signatories, and Platform Administrators.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-background px-4 py-8 sm:px-6 lg:px-10 xl:px-14">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
                <Logo size="md" rounded="lg" />
                <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Back to home
                </Link>
              </div>

              <div className="hidden items-center justify-between gap-3 border-b border-border pb-5 lg:flex">
                <div>
                  <p className="text-sm font-semibold tracking-[0.16em] text-foreground">Safe Flow</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Autonomous Financial Crime Defense</p>
                </div>
                <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Back to home
                </Link>
              </div>

              <div className="mt-8">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter your assigned work email and security passphrase to access your workspace.
                </p>
              </div>

              {/* Demo Account Quick-Fill Buttons */}
              <div className="mt-6 rounded-2xl border border-border/80 bg-muted/30 p-3.5">
                <p className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
                  Quick Demo Access
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillAccount(acc)}
                      className="group flex flex-1 min-w-[100px] flex-col items-start rounded-xl border border-border bg-background px-3 py-2 text-left text-xs transition-all hover:border-primary/50 hover:bg-muted/50"
                    >
                      <span className="font-medium text-foreground group-hover:text-primary">{acc.label}</span>
                      <span className="text-[10px] text-muted-foreground truncate w-full">{acc.email.split("@")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {generalError && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-risk-high/30 bg-risk-high/10 p-3 text-xs text-risk-high">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              {infoNotice && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-teal/30 bg-teal/10 p-3 text-xs text-teal">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>{infoNotice}</span>
                </div>
              )}

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Work Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError("");
                      setGeneralError("");
                    }}
                    placeholder="name@smarthorizon.ai"
                    className={`w-full rounded-xl border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 ${
                      emailError ? "border-risk-high focus:border-risk-high" : "border-border focus:border-primary"
                    }`}
                  />
                  {emailError && <p className="text-xs text-risk-high">{emailError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setPasswordError("");
                        setGeneralError("");
                      }}
                      placeholder="Enter your security password"
                      className={`w-full rounded-xl border bg-background px-3.5 py-3 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 ${
                        passwordError ? "border-risk-high focus:border-risk-high" : "border-border focus:border-primary"
                      }`}
                    />
                    <LockKeyhole
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  {passwordError && <p className="text-xs text-risk-high">{passwordError}</p>}
                </div>

                <Button type="submit" className="w-full rounded-xl mt-2" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Authenticating with Safe Flow…" : "Sign In"}
                  {!isSubmitting && <ArrowRight className="size-4 ml-2" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
