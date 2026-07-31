import React, { createContext, useContext, useEffect, useRef } from "react";
import { validateUser, User } from "../api/userApi";
import { getSecurityRole } from "../api/AccessSetup/AccessSetupApi";
import PERMISSION_ID_MAP from "../permissions/map";
import { useAuthStore } from "../store/authStore";

type AuthContextType = {
  user: User | null;
  permissions: Set<number>;
  hasPermission: (idOrName: number | string) => boolean;
  hasEditPermission: (idOrName: number | string) => boolean;
  reloadPermissions: () => Promise<void>;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  permissions: new Set<number>(),
  hasPermission: () => false,
  hasEditPermission: () => false,
  reloadPermissions: async () => {},
  initializing: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const permissionIds = useAuthStore((s) => s.permissionIds);
  const editPermissionIds = useAuthStore((s) => s.editPermissionIds);
  const initializing = useAuthStore((s) => s.initializing);
  const setUser = useAuthStore((s) => s.setUser);
  const setPermissionIds = useAuthStore((s) => s.setPermissionIds);
  const setEditPermissionIds = useAuthStore((s) => s.setEditPermissionIds);
  const setInitializing = useAuthStore((s) => s.setInitializing);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const loadingRef = useRef(false);
  const permissions = new Set(permissionIds);
  const editPermissions = new Set(editPermissionIds);

  const parseIds = (s?: string | null) => {
    if (!s) return [] as number[];
    return s
      .split(";")
      .map((x) => Number(x))
      .filter((n) => !Number.isNaN(n));
  };

  const loadFromRoleId = async (roleId: string | number) => {
    try {
      const role = await getSecurityRole(roleId);
      const sections = parseIds(role?.sections);
      const areas = parseIds(role?.areas);
      setPermissionIds(sections);
      setEditPermissionIds(areas);
    } catch (err) {
      console.error("Failed to load role permissions", err);
      setPermissionIds([]);
      setEditPermissionIds([]);
    }
  };

  const reloadPermissions = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setInitializing(true);
    try {
      // Check if token exists before making API call
      const token = localStorage.getItem("token");
      if (!token) {
        clearAuth();
        return;
      }

        const u = await validateUser();
        setUser(u || null);

  if ((u as any)?.sections || (u as any)?.areas) {
            // sections = pages the user can view; areas = pages within that
            // set the user can also edit (checked "Edit" alongside "View")
            const parseArr = (arr?: (string|number)[]) =>
                (arr || []).map((x) => Number(x)).filter((n) => !Number.isNaN(n));

            const sections = parseArr((u as any).sections);
            const areas = parseArr((u as any).areas);
            setPermissionIds(sections);
            setEditPermissionIds(areas);
        } else {
            // fallback: if role_id present but no sections returned, fetch role
            const roleId = (u as any)?.role_id || (u as any)?.roleId || (u as any)?.role;
            if (roleId) {
                await loadFromRoleId(roleId);
            } else {
                setPermissionIds([]);
                setEditPermissionIds([]);
            }
        }
    } catch (err) {
      // If the token is missing/invalid, the backend returns 401. Handle that
      // gracefully: remove stored token and clear user state without noisy stack.
      const status = (err as any)?.response?.status;
      if (status === 401) {
        try {
          localStorage.removeItem("token");
        } catch {}
        clearAuth();
        return;
      }

      // For other errors, log a concise message and clear user state.
      console.error("reloadPermissions error", (err as any)?.message || err);
      clearAuth();
    } finally {
      loadingRef.current = false;
      setInitializing(false);
    }
  };

  useEffect(() => {
    reloadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = (idOrName: number | string) => {
    // Accounts created before per-user/role access enforcement was added stay
    // ungated (their pre-existing behaviour is preserved); only accounts
    // created after that point have `strict_access` and are actually checked.
    if (!(user as any)?.strict_access) return true;

    // if user has an admin role string, allow all
    const roleStr = (user as any)?.role;
    if (roleStr === "Admin" || (user as any)?.is_admin) return true;

    if (typeof idOrName === "number") return permissions.has(idOrName);
    // name provided -> map to id(s)
    const id = PERMISSION_ID_MAP[idOrName];
    if (id) return permissions.has(id);
    return false;
  };

  // Whether the user can perform add/edit/delete actions on a page, as
  // opposed to only viewing it. A page only ever appears here if it's also
  // in `permissions` (View is a prerequisite for Edit in the Access Setup UI).
  const hasEditPermission = (idOrName: number | string) => {
    if (!(user as any)?.strict_access) return true;

    const roleStr = (user as any)?.role;
    if (roleStr === "Admin" || (user as any)?.is_admin) return true;

    if (typeof idOrName === "number") return editPermissions.has(idOrName);
    const id = PERMISSION_ID_MAP[idOrName];
    if (id) return editPermissions.has(id);
    return false;
  };

  return (
    <AuthContext.Provider
      value={{ user, permissions, hasPermission, hasEditPermission, reloadPermissions, initializing }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
