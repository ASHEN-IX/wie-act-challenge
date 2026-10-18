import React from "react";
import { Navigate } from "@/navigation";
import { useAuthStore } from "../store/authStore";

const AuthorizationGate = ({
  children,
  requireAdmin = false,
  requireStudent = false,
}: any) => {
  const { isAuthenticated, initialized, user } = useAuthStore();
  if (!initialized) return <div role="status">Loading session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user && user.isVerified === false) {
    const email = user.email ? encodeURIComponent(user.email) : "";
    return (
      <Navigate to={`/verify-email${email ? `?email=${email}` : ""}`} replace />
    );
  }

  if (requireAdmin && user?.role !== "admin" && !user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Admin users should not access student-only pages
  if (requireStudent && (user?.role === "admin" || user?.isAdmin)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default AuthorizationGate;
