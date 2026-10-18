import { create } from 'zustand';
import { authAPI } from '../services/api';

// Tier permission definitions
export const TIER_PERMISSIONS: Record<string, Record<string, boolean>> = {
  trial: {
    aiCourseUpload: true,
    manualCourse: true,
    aiPlanner: true,
    aiScheduler: true,
    aiCoach: true,
    signalProcessing: true,
    aiSearch: true,
    reviews: true,
    focusTracking: true,
  },
  normal: {
    aiCourseUpload: false,
    manualCourse: true,
    aiPlanner: false,
    aiScheduler: false,
    aiCoach: false,
    signalProcessing: false,
    aiSearch: false,
    reviews: false,
    focusTracking: false,
  },
  vip: {
    aiCourseUpload: true,
    manualCourse: true,
    aiPlanner: true,
    aiScheduler: true,
    aiCoach: false,
    signalProcessing: false,
    aiSearch: true,
    reviews: true,
    focusTracking: false,
  },
  vip_plus: {
    aiCourseUpload: true,
    manualCourse: true,
    aiPlanner: true,
    aiScheduler: true,
    aiCoach: true,
    signalProcessing: true,
    aiSearch: true,
    reviews: true,
    focusTracking: true,
  },
};

export interface AuthState {
  user: any;
  isAuthenticated: boolean;
  initialized: boolean;
  initializeAuth: () => Promise<void>;
  login: (user: any) => void;
  logout: () => Promise<void>;
  updateUser: (user: any) => void;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: () => boolean;
  isStudent: () => boolean;
  isTeacher: () => boolean;
  hasPermission: (permission: string) => boolean;
  canAccess: (resource: string, action?: string) => boolean;
  getTier: () => string;
  isTrialExpired: () => boolean;
  getTrialDaysRemaining: () => number;
  getTierPermissions: () => Record<string, boolean>;
  hasTierPermission: (permission: string) => boolean;
}

const useAuthStore = create<AuthState>((set: any, get: any) => ({
  user: null,
  isAuthenticated: false,
  initialized: false,
  initializeAuth: async () => {
    try {
      const response = await authAPI.getMe();
      set({ user: response.data.user, isAuthenticated: true, initialized: true });
    } catch {
      set({ user: null, isAuthenticated: false, initialized: true });
    }
  },
  login: (user: any) => set({ user, isAuthenticated: true, initialized: true }),
  logout: async () => {
    await authAPI.logout();
    set({ user: null, isAuthenticated: false, initialized: true });
  },
  updateUser: (user: any) => set({ user }),
  // Role-based access control methods
  hasRole: (role: string) => {
    const { user } = get();
    return user?.role === role;
  },

  hasAnyRole: (roles: string[]) => {
    const { user } = get();
    return roles.includes(user?.role);
  },

  isAdmin: () => {
    return get().hasRole("admin");
  },

  isStudent: () => {
    return get().hasRole("student");
  },

  isTeacher: () => {
    return get().hasRole("teacher");
  },

  // Permission-based access control
  hasPermission: (permission: string) => {
    const { user } = get();
    if (!user) return false;

    // Define permissions based on roles
    const rolePermissions: Record<string, string[]> = {
      admin: [
        "user.create",
        "user.read",
        "user.update",
        "user.delete",
        "study.create",
        "study.read",
        "study.update",
        "study.delete",
        "analytics.read",
        "system.admin",
      ],
      teacher: [
        "study.create",
        "study.read",
        "study.update",
        "user.read",
        "analytics.read",
      ],
      student: ["study.read", "study.create", "study.update", "user.read"],
    };

    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes(permission);
  },

  // Check if user can access a resource
  canAccess: (resource: string, action = "read") => {
    return get().hasPermission(`${resource}.${action}`);
  },

  // --- Tier-based access control ---
  getTier: () => {
    const { user } = get();
    return user?.tier || "normal";
  },

  isTrialExpired: () => {
    const { user } = get();
    if (user?.tier !== "trial") return false;
    if (!user?.trialExpiresAt) return false;
    return new Date(user.trialExpiresAt) < new Date();
  },

  getTrialDaysRemaining: () => {
    const { user } = get();
    if (user?.tier !== "trial" || !user?.trialExpiresAt) return 0;
    const diff = new Date(user.trialExpiresAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },

  getTierPermissions: () => {
    const tier = get().getTier();
    return TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.normal;
  },

  hasTierPermission: (permission: string) => {
    const perms = get().getTierPermissions();
    return !!perms[permission];
  },
}));

export { useAuthStore };
