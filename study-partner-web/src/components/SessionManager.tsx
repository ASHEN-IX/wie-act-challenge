import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

const SessionManager = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Periodically validate the session by calling /auth/me.
    // If the cookie is expired the server returns 401, triggering the
    // response interceptor refresh flow automatically.
    const checkInterval = setInterval(async () => {
      try {
        const { authAPI } = await import("../services/api");
        await authAPI.getMe();
      } catch {
        // 401 is handled by the response interceptor — nothing to do here.
      }
    }, 5 * 60 * 1000); // every 5 minutes

    return () => clearInterval(checkInterval);
  }, [isAuthenticated]);

  return null;
};

export default SessionManager;
