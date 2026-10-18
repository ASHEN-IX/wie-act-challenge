// Permission definitions and utilities
export const PERMISSIONS = {
  // User management
  USER_CREATE: "user.create",
  USER_READ: "user.read",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",

  // Study management
  STUDY_CREATE: "study.create",
  STUDY_READ: "study.read",
  STUDY_UPDATE: "study.update",
  STUDY_DELETE: "study.delete",

  // Analytics
  ANALYTICS_READ: "analytics.read",

  // System admin
  SYSTEM_ADMIN: "system.admin",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role-based permission mappings
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.STUDY_CREATE,
    PERMISSIONS.STUDY_READ,
    PERMISSIONS.STUDY_UPDATE,
    PERMISSIONS.STUDY_DELETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.SYSTEM_ADMIN,
  ],
  teacher: [
    PERMISSIONS.STUDY_CREATE,
    PERMISSIONS.STUDY_READ,
    PERMISSIONS.STUDY_UPDATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  student: [
    PERMISSIONS.STUDY_READ,
    PERMISSIONS.STUDY_CREATE,
    PERMISSIONS.STUDY_UPDATE,
    PERMISSIONS.USER_READ,
  ],
};

// Permission checking utilities
export const checkPermission = (userRole?: string | null, permission?: string): boolean => {
  if (!userRole || !permission) return false;
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

export const checkAnyPermission = (userRole?: string | null, permissions?: string[]): boolean => {
  if (!userRole || !permissions || permissions.length === 0) return false;
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.some((permission) => userPermissions.includes(permission));
};

export const checkAllPermissions = (userRole?: string | null, permissions?: string[]): boolean => {
  if (!userRole || !permissions || permissions.length === 0) return false;
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.every((permission) =>
    userPermissions.includes(permission),
  );
};

// Resource-based permission checking
export const canAccessResource = (userRole?: string | null, resource?: string, action: string = "read"): boolean => {
  return checkPermission(userRole, `${resource}.${action}`);
};

// Common permission checks
export const canManageUsers = (userRole?: string | null): boolean => {
  return checkAnyPermission(userRole, [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
  ]);
};

export const canViewAnalytics = (userRole?: string | null): boolean => {
  return checkPermission(userRole, PERMISSIONS.ANALYTICS_READ);
};

export const canManageStudyContent = (userRole?: string | null): boolean => {
  return checkAnyPermission(userRole, [
    PERMISSIONS.STUDY_CREATE,
    PERMISSIONS.STUDY_UPDATE,
    PERMISSIONS.STUDY_DELETE,
  ]);
};

export const isAdmin = (userRole?: string | null): boolean => {
  return userRole === "admin";
};

export const isTeacher = (userRole?: string | null): boolean => {
  return userRole === "teacher";
};

export const isStudent = (userRole?: string | null): boolean => {
  return userRole === "student";
};
