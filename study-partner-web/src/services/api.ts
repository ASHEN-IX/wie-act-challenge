import { authClient, authResult } from './authClient';
import axios from "axios";
import { waitForJob } from './aiJobs';

// Use relative URLs in development so Vite proxy can intercept /api/* requests
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Create axios instance (no default Content-Type so FormData can set boundary)
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // Increased timeout for complex operations like study plan creation (3 mins)
  withCredentials: true, // Send cookies (httpOnly accessToken/refreshToken) on every request
});

api.interceptors.response.use((response: any) => response, async (error: any) => {
  if (error.response?.status === 403) {
    const { code, requiredTier, currentTier } = error.response.data || {};
    if (code === 'TIER_REQUIRED' || code === 'TRIAL_EXPIRED') window.dispatchEvent(new CustomEvent('tier-upgrade-required', { detail: { code, requiredTier, currentTier } }));
  }
  return Promise.reject(error);
});

// Auth API — login/register now return user only (tokens in httpOnly cookies)
export const authAPI = {
  register: async ({ name, email, password, onboarding }: { name?: string; email?: string; password?: string; onboarding?: any }) => {
    await authResult(await (authClient.signUp.email as any)({ name, email, password, onboarding, callbackURL: '/verify-email?verified=true' }));
    return { data: { requiresVerification: true } };
  },
  login: async (data: any) => {
    await authResult(await authClient.signIn.email(data));
    return api.get('/api/v1/auth/me');
  },
    getMe: () => api.get("/api/v1/auth/me"),
  updateTier: (tier: any) => api.put("/api/v1/auth/tier", { tier }),
  getStripeConfig: () => api.get("/api/v1/auth/stripe/config"),
  subscribe: (tier: any, durationMonths: any = 1) =>
    api.post("/api/v1/auth/stripe/subscribe", { tier, durationMonths }),
  confirmCheckout: (sessionId: any) =>
    api.post("/api/v1/auth/stripe/confirm", { sessionId }),
  verifyEmail: async (token: any) => authResult(await authClient.verifyEmail({ query: { token } })),
  verifyOtp: (email: any, otp: any) =>
    authClient.emailOtp.verifyEmail({ email, otp }).then(authResult),
  resendVerification: (email: any) =>
    authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }).then(authResult),
  forgotPassword: (email: any) =>
    ((authClient as any).requestPasswordReset || (authClient as any).forgetPassword)({ email, redirectTo: "/reset-password" }).then(authResult),
  resetPassword: (token: any, newPassword: any) =>
    authClient.resetPassword({ token, newPassword }).then(authResult),
  logout: () => authClient.signOut().then(authResult),
  redeemCoupon: (coupon: any, expectedTier: any) =>
    api.post("/api/v1/auth/coupon/redeem", { coupon, expectedTier }),
  listCoupons: () => api.get("/api/v1/auth/coupon/list"),
  changePlan: (newTier: any, durationMonths: any = 1) =>
    api.post("/api/v1/auth/plan/change", { newTier, durationMonths }),
};

export const adminAPI = {
  getUsers: (params = {}) => api.get("/api/v1/auth/admin/users", { params }),
  getUserById: (userId: any) => api.get(`/api/v1/auth/admin/users/${userId}`),
  updateUser: (userId: any, data: any) =>
    api.put(`/api/v1/auth/admin/users/${userId}`, data),
  deactivateUser: (userId: any) => api.delete(`/api/v1/auth/admin/users/${userId}`),
  getStats: () => api.get("/api/v1/auth/admin/stats"),
  getRevenueAnalytics: () => api.get("/api/v1/auth/admin/analytics/revenue"),
  getSubscriptions: (params = {}) =>
    api.get("/api/v1/auth/admin/subscriptions", { params }),
  cancelSubscription: (paymentId: any) =>
    api.put(`/api/v1/auth/admin/subscriptions/${paymentId}/cancel`),
  getCoupons: () => api.get("/api/v1/auth/admin/coupons"),
  createCoupon: (data: any) => api.post("/api/v1/auth/admin/coupons", data),
  updateCoupon: (couponId: any, data: any) =>
    api.put(`/api/v1/auth/admin/coupons/${couponId}`, data),
  deactivateCoupon: (couponId: any) =>
    api.delete(`/api/v1/auth/admin/coupons/${couponId}`),
  getCouponUsage: (couponId: any) =>
    api.get(`/api/v1/auth/admin/coupons/${couponId}/usage`),
};

// Profile API
export const profileAPI = {
  get: () => api.get("/api/v1/users/profile"),
  update: (data: any) => api.put("/api/v1/users/profile", data),
  updateOnlineStatus: (onlineStatus: any) =>
    api.put("/api/v1/users/profile/online-status", { onlineStatus }),
  getOnlineStatusBatch: (userIds = []) =>
    api.get("/api/v1/users/profile/online-status/batch", {
      params: { userIds: userIds.join(",") },
    }),
  getStats: () => api.get("/api/v1/users/profile/stats"),
  updateStats: (data: any) =>
    api.patch("/api/v1/users/profile/stats", data).then((res: any) => res.data),
};

// Subject & Course Management (through main backend)
export const subjectAPI = {
  list: () => api.get("/api/v1/study/subjects"),
  create: (formData: any) => api.post("/api/v1/study/subjects", formData),
  get: (subjectId: any) => api.get(`/api/v1/study/subjects/${subjectId}`),
  update: (subjectId: any, formData: any) =>
    api.put(`/api/v1/study/subjects/${subjectId}`, formData),
  delete: (subjectId: any) => api.delete(`/api/v1/study/subjects/${subjectId}`),
};

export const courseAPI = {
  list: (subjectId = null) =>
    api.get("/api/v1/study/courses", {
      params: subjectId ? { subject_id: subjectId } : {},
    }),
  create: (formData: any) => api.post("/api/v1/study/courses", formData),
  createManual: (data: any) => api.post("/api/v1/study/courses/manual", data),
  get: (courseId: any) => api.get(`/api/v1/study/courses/${courseId}`),
  addFiles: (courseId: any, formData: any) =>
    api.post(`/api/v1/study/courses/${courseId}/files`, formData),
  delete: (courseId: any) => api.delete(`/api/v1/study/courses/${courseId}`),
};

// AI Services API (all routed through API Gateway → ai-orchestrator → Python AI)
export const aiAPI = {
  // Job polling (PLAN-09)
  getJobStatus: (jobId: any) => api.get(`/api/v1/ai/jobs/${jobId}`),

  // Study Planning
  createStudyPlan: (data: any) => api.post("/api/v1/ai/plan/create", data),
  getUserPlans: () => api.get("/api/v1/ai/plan/list"),

  // Coaching
  getCoachDecision: async (data: any, signal?: AbortSignal) => {
    const { user_id: _actor, ...payload } = data;
    const submitted = await api.post('/api/v1/coach/nudge', payload, { signal });
    const result = await waitForJob(api, `/api/v1/coach/jobs/${submitted.data.jobId}`, signal);
    return { data: { coach_action: result.coach_action || result.action || result } };
  },
  getCoachHistory: (userId: any, limit: any = 20) =>
    api.get(`/api/v1/ai/coach/history/${userId}`, { params: { limit } }),
  applyCoachActionToSchedule: (coachAction: any) =>
    api.post("/api/v1/ai/schedule/apply-coach-action", {
      coach_action: coachAction,
    }),

  // Schedule Orchestrator
  getScheduleStatus: () => api.get("/api/v1/ai/schedule/status"),
  optimizeSchedule: (reason = "manual_optimize") =>
    api.put("/api/v1/ai/schedule/optimize", { reason }),
  reschedule: (reason = "manual") =>
    api.post("/api/v1/ai/schedule/reschedule", { reason }),
  evaluateSession: async (payload: any) => {
    const submitted = await api.post('/api/v1/eval/step', {
      sessionId: payload.sessionId || crypto.randomUUID(), step: 1,
      contextId: 'session-reflection', studentAnswer: JSON.stringify(payload),
      taskDescription: 'Reflect on the completed study session using the supplied evidence.', maxAttempts: 1
    });
    const result = await waitForJob(api, `/api/v1/eval/jobs/${submitted.data.jobId}`);
    return { data: { evaluation: result.evaluation_output || result } };
  },
  getVectorIndexStatus: (courseId: any) =>
    api.get(`/api/v1/ai/vector/status/${courseId}`),
  rebuildVectorIndex: (courseId: any) =>
    api.post(`/api/v1/ai/vector/rebuild/${courseId}`),

  // Signal Processing
  getCurrentSignals: (userId: any) =>
    api.get(`/api/v1/ai/signals/current/${userId}`),
  getSignalHistory: (userId: any, limit: any = 50) =>
    api.get(`/api/v1/ai/signals/history/${userId}`, { params: { limit } }),
  processSignals: (userId: any) =>
    api.post("/api/v1/ai/signals/process", { user_id: userId }),
  analyzeFrame: (formData: any) =>
    api.post("/api/v1/ai/signals/analyze-frame", formData, {
      timeout: 30000,
    }),
  getLatestSignals: (userId: any, limit: any = 10) =>
    api.get(`/api/v1/ai/signals/latest/${userId}`, { params: { limit } }),
  resetFatigue: (userId: any) =>
    api.post("/api/v1/ai/signals/fatigue/reset", { user_id: userId }),

  // Socratic Evaluation (async job API — EVAL-09)
  submitEvalStep: (payload: any) => api.post("/api/v1/eval/step", payload),
  getEvalJob: (jobId: any) => api.get(`/api/v1/eval/jobs/${jobId}`),

  // Socratic Evaluation (legacy sync endpoints)
  socraticStart: (data: any) =>
    api.post("/api/v1/ai/evaluator/socratic/start", data),
  socraticAnswer: (data: any) =>
    api.post("/api/v1/ai/evaluator/socratic/answer", data),

  // AI Search (F05 / SEARCH-07): async job creation + polling
  search: (data: any = {}) => {
    const payload: any = {
      query: data.query ?? data.question ?? "",
    };
    if (data.maxResults != null) payload.maxResults = data.maxResults;
    if (data.voiceMode != null) payload.voiceMode = data.voiceMode;
    if (data.sessionId || data.session_id) {
      payload.sessionId = data.sessionId ?? data.session_id;
    }
    // userId comes from the authenticated context server-side — never in the body.
    return api.post("/api/v1/search/query", payload);
  },
  searchJob: (jobId: any) => api.get(`/api/v1/search/jobs/${jobId}`),
  searchHistory: (userId: any, limit: any = 20) =>
    api.get(`/api/v1/ai/search/history/${userId}`, { params: { limit } }),

  // Health check
  healthCheck: () => api.get("/api/v1/ai/status"),
  getStats: () => api.get("/api/v1/users/profile/stats"),
  updateStats: (data: any) => api.patch("/api/v1/users/profile/stats", data),
  getGoals: () => api.get("/api/v1/users/profile/goals"),
  addGoal: (data: any) => api.post("/api/v1/users/profile/goals", data),
  updateGoal: (goalId: any, data: any) =>
    api.patch(`/api/v1/users/profile/goals/${goalId}`, data),
  deleteGoal: (goalId: any) => api.delete(`/api/v1/users/profile/goals/${goalId}`),
};

// Tasks API
export const tasksAPI = {
  getAll: (params?: any) => api.get("/api/v1/study/tasks", { params }),
  getById: (taskId: any) => api.get(`/api/v1/study/tasks/${taskId}`),
  create: (data: any) => api.post("/api/v1/study/tasks", data),
  update: (taskId: any, data: any) => api.put(`/api/v1/study/tasks/${taskId}`, data),
  delete: (taskId: any) => api.delete(`/api/v1/study/tasks/${taskId}`),
};

// Study Plans API (replaces old task generation)
export const studyPlanAPI = {
  create: (data: any) => api.post("/api/v1/study/plans/create", data),
  finalize: (correlationId: any) =>
    api.post("/api/v1/study/plans/create-status", { correlationId }),
  getAll: (params?: any) => api.get("/api/v1/study/plans", { params }),
  getById: (planId: any) => api.get(`/api/v1/study/plans/${planId}`),
  schedule: (planId: any, contextData?: any) =>
    api.post(`/api/v1/study/plans/${planId}/schedule`, contextData),
  getSchedule: (planId: any) => api.get(`/api/v1/study/plans/${planId}/schedule`),
  delete: (planId: any) => api.delete(`/api/v1/study/plans/${planId}`),
  scheduleTasks: (data: any) => api.post("/api/v1/study/plans/schedule-tasks", data),
  getCalendar: (params: any) => api.get("/api/v1/study/plans/calendar", { params }),
};

// Availability API (Weekly Calendar) - Goes through Node.js backend
export const availabilityAPI = {
  get: () => api.get("/api/v1/users/availability").then((res: any) => res.data),
  save: (data: any) =>
    api.post("/api/v1/users/availability", data).then((res: any) => res.data),
  delete: (id: any) =>
    api.delete(`/api/v1/users/availability/${id}`).then((res: any) => res.data),
  getFreeSlots: (params: any) =>
    api
      .get("/api/v1/users/availability/free-slots", { params })
      .then((res: any) => res.data),
};

// Gamification API - Goes through Node.js backend
export const gamificationAPI = {
  getProfile: () =>
    api.get("/api/v1/users/gamification").then((res: any) => res.data),
  awardXP: (data: any) =>
    api
      .post("/api/v1/users/gamification/award-xp", data)
      .then((res: any) => res.data),
  getLeaderboard: (limit = 10) =>
    api
      .get("/api/v1/users/gamification/leaderboard", { params: { limit } })
      .then((res: any) => res.data),
  getRankProfile: () =>
    api.get("/api/v1/users/gamification/rank/profile").then((res: any) => res.data),
  getRankLeaderboard: (params = {}) =>
    api
      .get("/api/v1/users/gamification/rank/leaderboard", { params })
      .then((res: any) => res.data),
  getCurrentSeason: () =>
    api
      .get("/api/v1/users/gamification/rank/seasons/current")
      .then((res: any) => res.data),
  getRankHistory: (limit = 20) =>
    api
      .get("/api/v1/users/gamification/rank/history", { params: { limit } })
      .then((res: any) => res.data),
  getRankProgress: () =>
    api.get("/api/v1/users/gamification/rank/progress").then((res: any) => res.data),
  getRankSessionResult: (sessionId: any) =>
    api
      .get("/api/v1/users/gamification/rank/session-result", {
        params: sessionId ? { sessionId } : {},
      })
      .then((res: any) => res.data),
};

// Topics API
export const topicsAPI = {
  getAll: () => api.get("/api/v1/study/topics"),
  getById: (topicId: any) => api.get(`/api/v1/study/topics/${topicId}`),
  create: (data: any) => api.post("/api/v1/study/topics", data),
  update: (topicId: any, data: any) => api.put(`/api/v1/study/topics/${topicId}`, data),
  delete: (topicId: any) => api.delete(`/api/v1/study/topics/${topicId}`),
};

// Sessions API
export const sessionsAPI = {
  getAll: (params?: any) => api.get("/api/v1/study/sessions", { params }),
  getById: (sessionId: any) => api.get(`/api/v1/study/sessions/${sessionId}`),
  create: (data: any) => api.post("/api/v1/study/sessions", data),
  update: (sessionId: any, data: any) =>
    api.put(`/api/v1/study/sessions/${sessionId}`, data),
  endSession: (sessionId: any) =>
    api.put(`/api/v1/study/sessions/${sessionId}`, { status: "completed" }),
  getStats: (params: any) =>
    api.get("/api/v1/study/sessions/stats/summary", { params }),
};

// Focus Tracking API
export const focusAPI = {
  startSession: (data: any) => api.post("/api/v1/signals/focus/start", data),
  addDataPoint: (sessionId: any, data: any) =>
    api.post(`/api/v1/signals/focus/${sessionId}/data`, data),
  endSession: (sessionId: any) => api.post(`/api/v1/signals/focus/${sessionId}/end`),
  getSession: (sessionId: any) => api.get(`/api/v1/signals/focus/${sessionId}`),
  getAllSessions: (params: any) => api.get("/api/v1/signals/focus", { params }),
  getStats: (params: any) =>
    api.get("/api/v1/signals/focus/stats/summary", { params }),
};

// Analytics API
export const analyticsAPI = {
  trackEvent: (data: any) => api.post("/api/v1/analytics/track", data),
  getTimeline: (params: any) => api.get("/api/v1/analytics/timeline", { params }),
  getSummary: (params: any) => api.get("/api/v1/analytics/summary", { params }),
  getStatsByType: (eventType: any, params: any) =>
    api.get(`/api/v1/analytics/stats/${eventType}`, { params }),
  getInsights: (params: any) => api.get("/api/v1/analytics/insights", { params }),
  getDailyActivity: (params: any) =>
    api.get("/api/v1/analytics/daily-activity", { params }),
};

// Competency API (F14 BLOOM-09/BLOOM-11) — study service.
export const competencyAPI = {
  getCompetencyMap: (params?: any) =>
    api.get("/api/v1/competencies", { params }).then((res: any) => res.data),
  getTopicDetail: (topicId: any) =>
    api.get(`/api/v1/competencies/topics/${topicId}`).then((res: any) => res.data),
};

// Review / Spaced Repetition API - Goes through AI Orchestrator
export const reviewAPI = {
  scheduleReview: (data: any) =>
    api.post("/api/v1/ai/reviews/schedule", data).then((res: any) => res.data),
  recordResult: (data: any) =>
    api.post("/api/v1/ai/reviews/record-result", data).then((res: any) => res.data),
  getPending: (userId: any, limit: any = 20) =>
    api
      .get(`/api/v1/ai/reviews/pending/${userId}`, { params: { limit } })
      .then((res: any) => res.data),
  getStats: (userId: any) =>
    api.get(`/api/v1/ai/reviews/stats/${userId}`).then((res: any) => res.data),
};

// Notification API
export const notificationAPI = {
  getAll: (params: any) =>
    api
      .get("/api/v1/notifications", { params, timeout: 15000 })
      .then((res: any) => res.data),
  create: (data: any) =>
    api
      .post("/api/v1/notifications", data, { timeout: 15000 })
      .then((res: any) => res.data),
  markRead: (id: any) =>
    api
      .patch(`/api/v1/notifications/${id}/read`, null, { timeout: 15000 })
      .then((res: any) => res.data),
  markAllRead: (userId: any) =>
    api
      .patch("/api/v1/notifications/read-all", null, {
        params: { userId },
        timeout: 15000,
      })
      .then((res: any) => res.data),
  delete: (id: any) =>
    api
      .delete(`/api/v1/notifications/${id}`, { timeout: 15000 })
      .then((res: any) => res.data),
};

export const sessionChatAPI = {
  getHistory: (sessionId: any, params: any = {}) =>
    api.get(`/api/v1/session-chat/${sessionId}/history`, { params }),
  query: (sessionId: any, query: any) =>
    api.post(`/api/v1/session-chat/${sessionId}/query`, { query }),
  deleteMessage: (sessionId: any, messageId: any) =>
    api.delete(`/api/v1/session-chat/${sessionId}/${messageId}`),
};

export const voiceAPI = {
  start: (sessionId: any) => api.post(`/api/v1/voice/${sessionId}/start`),
  end: (sessionId: any) => api.post(`/api/v1/voice/${sessionId}/end`),
  status: (sessionId: any) => api.get(`/api/v1/voice/${sessionId}/status`),
  join: (sessionId: any, peerId: any = "") =>
    api.post(`/api/v1/voice/${sessionId}/participant`, { peerId }),
  leave: (sessionId: any) => api.delete(`/api/v1/voice/${sessionId}/participant`),
  mute: (sessionId: any, isMuted: any) =>
    api.patch(`/api/v1/voice/${sessionId}/mute`, { isMuted }),
};

// Quest API
export const questAPI = {
  getAll: () => api.get("/api/v1/users/quests").then((res: any) => res.data),
  progress: (action: any) =>
    api
      .post("/api/v1/users/quests/progress", { action })
      .then((res: any) => res.data),
};

// Friends API
export const friendsAPI = {
  getAll: () => api.get("/api/v1/users/friends").then((r: any) => r.data),
  getIncoming: () =>
    api.get("/api/v1/users/friends/requests/incoming").then((r: any) => r.data),
  getOutgoing: () =>
    api.get("/api/v1/users/friends/requests/outgoing").then((r: any) => r.data),
  sendRequest: (data: any) =>
    api.post("/api/v1/users/friends/request", data).then((r: any) => r.data),
  acceptRequest: (id: any) =>
    api.put(`/api/v1/users/friends/request/${id}/accept`).then((r: any) => r.data),
  rejectRequest: (id: any) =>
    api.put(`/api/v1/users/friends/request/${id}/reject`).then((r: any) => r.data),
  cancelRequest: (id: any) =>
    api.delete(`/api/v1/users/friends/request/${id}`).then((r: any) => r.data),
  removeFriend: (friendId: any) =>
    api.delete(`/api/v1/users/friends/${friendId}`).then((r: any) => r.data),
  blockUser: (userId: any) =>
    api.post(`/api/v1/users/friends/block/${userId}`).then((r: any) => r.data),
  unblockUser: (userId: any) =>
    api.delete(`/api/v1/users/friends/block/${userId}`).then((r: any) => r.data),
  getBlocked: () =>
    api.get("/api/v1/users/friends/blocked").then((r: any) => r.data),
  search: (query: any) =>
    api
      .get("/api/v1/users/friends/search", { params: { q: query } })
      .then((r: any) => r.data),
  getProfile: (friendId: any) =>
    api.get(`/api/v1/users/friends/${friendId}/profile`).then((r: any) => r.data),
  getOnline: () => api.get("/api/v1/users/friends/online").then((r: any) => r.data),
  getCount: () => api.get("/api/v1/users/friends/count").then((r: any) => r.data),
};

// Team Sessions API
export const teamSessionsAPI = {
  create: (data: any) =>
    api.post("/api/v1/study/sessions/team", data).then((r: any) => r.data),
  join: (sessionId: any, inviteCode: any) =>
    api
      .post(`/api/v1/study/sessions/team/${sessionId}/join`, { inviteCode })
      .then((r: any) => r.data),
  joinByCode: (inviteCode: any) =>
    api
      .post("/api/v1/study/sessions/team/join-by-code", { inviteCode })
      .then((r: any) => r.data),
  start: (sessionId: any) =>
    api
      .put(`/api/v1/study/sessions/team/${sessionId}/start`)
      .then((r: any) => r.data),
  leave: (sessionId: any) =>
    api
      .post(`/api/v1/study/sessions/team/${sessionId}/leave`)
      .then((r: any) => r.data),
  invite: (sessionId: any, friendId: any) =>
    api
      .post(`/api/v1/study/sessions/team/${sessionId}/invite`, { friendId })
      .then((r: any) => r.data),
  getParticipants: (sessionId: any) =>
    api
      .get(`/api/v1/study/sessions/team/${sessionId}/participants`)
      .then((r: any) => r.data),
  end: (sessionId: any) =>
    api.put(`/api/v1/study/sessions/team/${sessionId}/end`).then((r: any) => r.data),
};

export const challengeSessionsAPI = {
  start: (data: any) =>
    api
      .post("/api/v1/study/sessions/challenge/start", data)
      .then((r: any) => r.data),
  get: (sessionId: any) =>
    api
      .get(`/api/v1/study/sessions/challenge/${sessionId}`)
      .then((r: any) => r.data),
  complete: (sessionId: any, data: any = {}) =>
    api
      .put(`/api/v1/study/sessions/challenge/${sessionId}/complete`, data)
      .then((r: any) => r.data),
};

// Session Setup & Task Progression API
export const sessionSetupAPI = {
  setup: (data: any) =>
    api.post("/api/v1/study/sessions/setup", data).then((r: any) => r.data),
  completeTask: (sessionId: any) =>
    api
      .post(`/api/v1/study/sessions/${sessionId}/task/complete`)
      .then((r: any) => r.data),
  skipTask: (sessionId: any) =>
    api
      .post(`/api/v1/study/sessions/${sessionId}/task/skip`)
      .then((r: any) => r.data),
};

// Background Customization API
export const backgroundAPI = {
  getSettings: () =>
    api.get("/api/v1/users/profile/background").then((r: any) => r.data),
  applyBackground: (data: any) =>
    api
      .post("/api/v1/users/profile/background/apply", data)
      .then((r: any) => r.data),
  uploadBackground: (formData: any) =>
    api
      .post("/api/v1/users/profile/background/upload", formData)
      .then((r: any) => r.data),
  uploadAnimatedBackground: (formData: any) =>
    api
      .post("/api/v1/users/profile/animated-background/upload", formData)
      .then((r: any) => r.data),
  getPresets: () =>
    api.get("/api/v1/users/profile/background/presets").then((r: any) => r.data),
  applyAnimatedBackground: (data: any) =>
    api
      .post("/api/v1/users/profile/animated-background/apply", data)
      .then((r: any) => r.data),
  getAnimatedPresets: () =>
    api
      .get("/api/v1/users/profile/animated-background/presets")
      .then((r: any) => r.data),
  getLevelInfo: () =>
    api.get("/api/v1/users/profile/level").then((r: any) => r.data),
};

// Legacy support - maintain backward compatibility
export const login = (credentials: any) => authAPI.login(credentials);
export const register = (userData: any) => authAPI.register(userData);
export const validateToken = () => authAPI.getMe();
export const getTasks = (params?: any) => tasksAPI.getAll(params);
export const getTask = (id: any) => tasksAPI.getById(id);
export const createTask = (task: any) => tasksAPI.create(task);
export const updateTask = (id: any, task: any) => tasksAPI.update(id, task);
export const deleteTask = (id: any) => tasksAPI.delete(id);

// Session endpoints (fixed to use correct route prefix)
export const getSessions = () => api.get("/api/v1/study/sessions");
export const getSession = (id: any) => api.get(`/api/v1/study/sessions/${id}`);
export const createSession = (session: any) =>
  api.post("/api/v1/study/sessions", session);
export const endSession = (id: any) => api.patch(`/api/v1/study/sessions/${id}/end`);

export default api;
