import { Navigate } from "@/navigation";
import { useAuthStore } from "../store/authStore";

const RoleBasedRoute = ({
  children,
  allowedRoles = [],
  requireAuth = true,
}: any) => {
  const { isAuthenticated, user, hasAnyRole } = useAuthStore();

  // Check authentication
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    // Redirect based on user role
    if (user?.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user?.role === "teacher") {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default RoleBasedRoute;
