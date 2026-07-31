import React from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import PageLoader from "./PageLoader";
import { useAuth } from "../context/AuthContext";

type Props = {
  required?: number | number[] | string | string[];
  // Pages that create/modify/delete data (as opposed to just viewing it)
  // pass requireEdit in addition to required. A user with View-only access
  // to that page (checked View but not Edit in Access Setup) can still open
  // view/list pages via `required`, but is blocked from write-only pages.
  requireEdit?: number | number[] | string | string[];
  children?: React.ReactNode;
};

const ProtectedRoute: React.FC<Props> = ({ required, requireEdit, children }) => {
  const { user, hasPermission, hasEditPermission } = useAuth();
  const location = useLocation();
  const { initializing } = useAuth();

  // While auth is initializing (restoring session from token), don't
  // redirect — show a loader and keep the current URL so a page refresh
  // doesn't bounce the user back to login/dashboard.
  if (!user) {
    if (initializing) return <PageLoader />;

    // If not initializing and no user, redirect to login (root). Keep
    // the current location in state so login can redirect back after signin.
    //return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (required) {
    const reqs = Array.isArray(required) ? required : [required];

    const allowed = reqs.some((r) => {
      if (typeof r === "number") return hasPermission(r);
      return hasPermission(r as string);
    });

    if (!allowed) return <Navigate to="/not-authorized" replace />;
  }

  if (requireEdit) {
    const editReqs = Array.isArray(requireEdit) ? requireEdit : [requireEdit];

    const editAllowed = editReqs.some((r) => {
      if (typeof r === "number") return hasEditPermission(r);
      return hasEditPermission(r as string);
    });

    if (!editAllowed) return <Navigate to="/not-authorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
