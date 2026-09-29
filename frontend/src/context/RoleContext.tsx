import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { login as apiLogin, setAuthToken, getAuthToken } from "@/lib/api";

export type RoleId = "investigator" | "manager" | "administrator";

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  title: string;
  role: RoleId;
}

export const ROLE_PROFILES: Record<RoleId, UserProfile> = {
  investigator: {
    id: "usr-marcus",
    name: "Marcus Johnson",
    email: "marcus.johnson@smarthorizon.ai",
    title: "Senior AML Investigator",
    role: "investigator",
  },
  manager: {
    id: "usr-sarah",
    name: "Sarah Chen",
    email: "sarah.chen@smarthorizon.ai",
    title: "AML Operations Manager",
    role: "manager",
  },
  administrator: {
    id: "usr-admin",
    name: "System Administrator",
    email: "admin@smarthorizon.ai",
    title: "System Administrator",
    role: "administrator",
  },
};

export interface DefenseTierInfo {
  tier: "1st Line" | "2nd Line" | "3rd Line";
  name: string;
  duty: string;
  scope: string;
  badgeClass: string;
}

export const ROLE_DEFENSE_TIERS: Record<RoleId, DefenseTierInfo> = {
  investigator: {
    tier: "1st Line",
    name: "1st Line of Defense (Detection & Evidence)",
    duty: "Detects, triages, builds evidence, and dismisses false positives. Account freezing requires Manager sign-off.",
    scope: "Maker / Triage, Dismiss False Positives & Escalate",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  manager: {
    tier: "2nd Line",
    name: "2nd Line of Defense (Maker-Checker Oversight)",
    duty: "Independent review of investigator evidence. Holds sole authority to approve Block & Report.",
    scope: "Checker / Approves Account Freezes & Regulatory Escalations",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  administrator: {
    tier: "3rd Line",
    name: "3rd Line of Defense (Independent Governance & Audit)",
    duty: "Manages user access and verifies cryptographic audit trails. Zero case-decision authority.",
    scope: "Auditor / System Security & Compliance",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
};

export const ROLE_TITLES: Record<RoleId, string> = {
  investigator: "Investigation Overview",
  manager: "Review & Approvals",
  administrator: "System Administration",
};

interface RoleContextType {
  role: RoleId;
  setRole: (role: RoleId) => void;
  clearRole: () => void;
  user: UserProfile;
  defenseTier: DefenseTierInfo;
  dashboardTitle: string;
  isAuthenticated: boolean;
  loginWithRole: (role: RoleId) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<UserProfile>;
  logout: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const STORAGE_KEY = "smart-horizon-role";
const USER_STORAGE_KEY = "horizon-user";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<RoleId>("investigator");
  const [user, setUserState] = useState<UserProfile>(ROLE_PROFILES.investigator);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRole = sessionStorage.getItem(STORAGE_KEY) as RoleId | null;
      if (
        storedRole &&
        (storedRole === "investigator" || storedRole === "manager" || storedRole === "administrator")
      ) {
        setRoleState(storedRole);
      }

      const storedUser = sessionStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && parsed.role) {
            setUserState(parsed);
            setRoleState(parsed.role);
          }
        } catch {
          // ignore parsing error
        }
      }

      // Check if we have a valid auth token
      const token = getAuthToken();
      if (token) {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const setRole = useCallback(
    (newRole: RoleId) => {
      setRoleState(newRole);
      const profile = ROLE_PROFILES[newRole] || {
        name: newRole.charAt(0).toUpperCase() + newRole.slice(1),
        email: `${newRole}@smarthorizon.ai`,
        title: ROLE_TITLES[newRole] || newRole,
        role: newRole,
      };
      setUserState(profile);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, newRole);
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      }
    },
    [],
  );

  const clearRole = useCallback(() => {
    setRoleState("investigator");
    setUserState(ROLE_PROFILES.investigator);
    setIsAuthenticated(false);
    setAuthToken(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      sessionStorage.removeItem("horizon-auth-token");
    }
  }, []);

  const loginWithCredentials = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      const res = await apiLogin(email, password);
      const userRole = (res.user.role.toLowerCase() as RoleId) || "investigator";
      const userProfile: UserProfile = {
        id: res.user.id || res.user.email,
        name: res.user.name,
        email: res.user.email,
        title: ROLE_TITLES[userRole] || `${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`,
        role: userRole,
      };

      setRoleState(userRole);
      setUserState(userProfile);
      setIsAuthenticated(true);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, userRole);
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userProfile));
      }

      return userProfile;
    },
    [],
  );

  const loginWithRole = useCallback(
    async (targetRole: RoleId) => {
      const profile = ROLE_PROFILES[targetRole];
      try {
        await loginWithCredentials(profile.email, "demo-password");
      } catch (err) {
        console.error("Login failed:", err);
        throw err;
      }
    },
    [loginWithCredentials],
  );

  const logout = useCallback(() => {
    clearRole();
  }, [clearRole]);

  const value: RoleContextType = {
    role,
    setRole,
    clearRole,
    user,
    defenseTier: ROLE_DEFENSE_TIERS[role],
    dashboardTitle: ROLE_TITLES[role] || "Dashboard",
    isAuthenticated,
    loginWithRole,
    loginWithCredentials,
    logout,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextType {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
