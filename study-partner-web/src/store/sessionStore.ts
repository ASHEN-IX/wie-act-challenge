import { create } from "zustand";
import {
  sessionSetupAPI,
  sessionsAPI,
  teamSessionsAPI,
  courseAPI,
} from "../services/api";
export interface SessionState {
  step: string;
  mode: string;
  sessionMode: string;
  error: string | null;
  selectedCourse: any;
  activeSession: any;
  taskProgress: any;
  teamSession: any;
  alreadyCompleted: boolean;
  completionRewards: any;
  kpResult: any;
  [key: string]: any;
}

export type UseSessionStore = {
  (): SessionState;
  <U>(selector: (state: SessionState) => U): U;
  getState: () => SessionState;
  setState: any;
  subscribe: any;
};
export const useSessionStore = create<any>((set: any, get: any) => ({
  // Session flow state
  step: "select",
  // 'select' | 'lobby' | 'session' | 'summary'
  mode: null,
  // 'solo' | 'team'
  sessionMode: "focus",
  // 'focus' | 'pomodoro' | 'exam'

  // Course selection
  courses: [],
  selectedCourse: null,
  coursesLoading: false,
  // Active session
  activeSession: null,
  sessionLoading: false,
  // Task progression
  taskProgress: null,
  currentTask: null,
  // Team state
  teamSession: null,
  inviteCode: null,
  // Summary
  sessionSummary: null,
  // Loading & errors
  loading: false,
  error: null,
  // Actions
  setStep: (step: any) =>
    set({
      step,
    }),
  setMode: (mode: any) =>
    set({
      mode,
    }),
  setSessionMode: (sessionMode: any) =>
    set({
      sessionMode,
    }),
  setError: (error: any) =>
    set({
      error,
    }),
  clearError: () =>
    set({
      error: null,
    }),
  // Fetch available courses
  fetchCourses: async () => {
    set({
      coursesLoading: true,
    });
    try {
      const res = await courseAPI.list();
      const courses = res.data?.courses || res.data || [];
      set({
        courses,
        coursesLoading: false,
      });
    } catch (err: any) {
      set({
        error: "Failed to load courses",
        coursesLoading: false,
      });
    }
  },
  // Select a course
  selectCourse: (course: any) =>
    set({
      selectedCourse: course,
    }),
  // Setup solo session
  setupSoloSession: async () => {
    const { selectedCourse, sessionMode } = get();
    if (!selectedCourse) return;
    set({
      sessionLoading: true,
      error: null,
    });
    try {
      const result = await sessionSetupAPI.setup({
        courseId: selectedCourse._id || selectedCourse.id,
        mode: sessionMode,
      });
      const session = result.session;
      const tasks = session.taskProgress?.tasks || [];

      // Mark first task as in-progress
      if (tasks.length > 0 && tasks[0].status === "pending") {
        tasks[0].status = "in-progress";
        tasks[0].startedAt = new Date().toISOString();
      }
      set({
        activeSession: session,
        taskProgress: session.taskProgress,
        currentTask: tasks[0] || null,
        step: "session",
        sessionLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to setup session",
        sessionLoading: false,
      });
    }
  },
  // Setup team session
  setupTeamSession: async () => {
    const { selectedCourse, sessionMode } = get();
    if (!selectedCourse) return null;
    set({
      sessionLoading: true,
      error: null,
    });
    try {
      const result = await teamSessionsAPI.create({
        courseId: selectedCourse._id || selectedCourse.id,
        mode: sessionMode,
        maxParticipants: 4,
      });
      const session = result.session;
      set({
        teamSession: session,
        inviteCode: result.inviteCode || session.inviteCode,
        activeSession: session,
        step: "lobby",
        sessionLoading: false,
      });
      return session;
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to create team session",
        sessionLoading: false,
      });
      return null;
    }
  },
  // Start team session (transition from lobby to session)
  startTeamSession: () => {
    const { teamSession } = get();
    if (!teamSession) return;
    const tasks = teamSession.taskProgress?.tasks || [];
    if (tasks.length > 0 && tasks[0].status === "pending") {
      tasks[0].status = "in-progress";
      tasks[0].startedAt = new Date().toISOString();
    }
    set({
      taskProgress: teamSession.taskProgress,
      currentTask: tasks[0] || null,
      step: "session",
    });
  },
  // Complete current task
  completeTask: async () => {
    const { activeSession, taskProgress } = get();
    if (!activeSession) return;
    set({
      loading: true,
    });
    try {
      const result = await sessionSetupAPI.completeTask(activeSession._id);
      const updatedTasks = [...(taskProgress?.tasks || [])];
      const currentIdx = taskProgress?.currentTaskIndex || 0;
      if (updatedTasks[currentIdx]) {
        updatedTasks[currentIdx] = {
          ...updatedTasks[currentIdx],
          status: "completed",
          completedAt: new Date().toISOString(),
          xpEarned: result.xpEarned,
        };
      }
      if (result.nextTask && updatedTasks[result.currentTaskIndex]) {
        updatedTasks[result.currentTaskIndex] = {
          ...updatedTasks[result.currentTaskIndex],
          status: "in-progress",
          startedAt: new Date().toISOString(),
        };
      }
      const newProgress = {
        ...taskProgress,
        currentTaskIndex: result.currentTaskIndex,
        completedTasks: result.completedTasks,
        tasks: updatedTasks,
      };
      set({
        taskProgress: newProgress,
        currentTask: result.allTasksComplete
          ? null
          : updatedTasks[result.currentTaskIndex],
        loading: false,
      });
      if (result.allTasksComplete) {
        get().finishSession();
      }
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to complete task",
        loading: false,
      });
      throw err;
    }
  },
  // Skip current task
  skipTask: async () => {
    const { activeSession, taskProgress } = get();
    if (!activeSession) return;
    set({
      loading: true,
    });
    try {
      const result = await sessionSetupAPI.skipTask(activeSession._id);
      const updatedTasks = [...(taskProgress?.tasks || [])];
      const currentIdx = taskProgress?.currentTaskIndex || 0;
      if (updatedTasks[currentIdx]) {
        updatedTasks[currentIdx] = {
          ...updatedTasks[currentIdx],
          status: "skipped",
          completedAt: new Date().toISOString(),
        };
      }
      if (result.nextTask && updatedTasks[result.currentTaskIndex]) {
        updatedTasks[result.currentTaskIndex] = {
          ...updatedTasks[result.currentTaskIndex],
          status: "in-progress",
          startedAt: new Date().toISOString(),
        };
      }
      const newProgress = {
        ...taskProgress,
        currentTaskIndex: result.currentTaskIndex,
        tasks: updatedTasks,
      };
      set({
        taskProgress: newProgress,
        currentTask: result.allTasksComplete
          ? null
          : updatedTasks[result.currentTaskIndex],
        loading: false,
      });
      if (result.allTasksComplete) {
        get().finishSession();
      }
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to skip task",
        loading: false,
      });
    }
  },
  // Finish session and show summary
  finishSession: async (options: any = {}) => {
    const { activeSession, taskProgress } = get();
    if (!activeSession) return;
    const { alreadyCompleted = false, completionRewards = null } = (options || {}) as any;
    let completionRewardsData = completionRewards;
    if (!alreadyCompleted) {
      try {
        const sessionUpdateResult = await sessionsAPI.update(
          activeSession._id,
          {
            status: "completed",
            endTime: new Date().toISOString(),
          },
        );
        completionRewardsData =
          sessionUpdateResult?.data?.completionRewards || completionRewardsData;
      } catch (err: any) {
        console.error("Failed to end session:", err);
      }
    }
    const tasks = taskProgress?.tasks || [];
    const completedCount = tasks.filter((t: any) => t.status === "completed").length;
    const skippedCount = tasks.filter((t: any) => t.status === "skipped").length;
    const taskBasedXP = tasks.reduce((sum: any, t: any) => sum + (t.xpEarned || 0), 0);
    const awardedXP = Number(completionRewardsData?.awardedXP);
    const totalXP =
      Number.isFinite(awardedXP) && awardedXP > 0 ? awardedXP : taskBasedXP;
    const kpResult = (options as any)?.kpResult || null;
    set({
      step: "summary",
      sessionSummary: {
        totalTasks: tasks.length,
        completedTasks: completedCount,
        skippedTasks: skippedCount,
        totalXP,
        totalKP: kpResult?.totalKP || 0,
        kpResult,
        completionRewards: completionRewardsData,
        xpMultiplier: activeSession.xpMultiplier || 1.0,
        duration: activeSession.duration || 0,
        courseTitle: get().selectedCourse?.title || "Study Session",
      },
    });
  },
  // Reset everything
  resetSession: () =>
    set({
      step: "select",
      mode: null,
      sessionMode: "focus",
      selectedCourse: null,
      activeSession: null,
      taskProgress: null,
      currentTask: null,
      teamSession: null,
      inviteCode: null,
      sessionSummary: null,
      loading: false,
      error: null,
      sessionLoading: false,
    }),
  // Join a team session from an invite notification
  // Join a session using only the invite code (no sessionId needed)
  joinTeamSessionByCode: async (inviteCode: any) => {
    set({
      sessionLoading: true,
      error: null,
    });
    try {
      const result = await teamSessionsAPI.joinByCode(inviteCode.toUpperCase());
      const session = result.session || result;
      let selectedCourse = null;
      if (session.courseId) {
        try {
          const courseRes = await courseAPI.get(session.courseId);
          selectedCourse = courseRes.data?.course || courseRes.data;
        } catch {
          /* optional */
        }
      }
      set({
        teamSession: session,
        inviteCode: result.inviteCode || inviteCode,
        activeSession: session,
        selectedCourse,
        mode: "team",
        step: "lobby",
        sessionLoading: false,
      });
      return session;
    } catch (err: any) {
      set({
        error:
          err.response?.data?.error ||
          "Invalid invite code or session not found",
        sessionLoading: false,
      });
      throw err;
    }
  },
  joinTeamSessionFromInvite: async (sessionId: any, inviteCode: any) => {
    set({
      sessionLoading: true,
      error: null,
    });
    try {
      const result = await teamSessionsAPI.join(sessionId, inviteCode);
      const session = result.session || result;

      // Try to load the course for selectedCourse
      let selectedCourse = null;
      if (session.courseId) {
        try {
          const courseRes = await courseAPI.get(session.courseId);
          selectedCourse = courseRes.data?.course || courseRes.data;
        } catch {
          // Course lookup is optional
        }
      }
      set({
        teamSession: session,
        inviteCode: inviteCode,
        activeSession: session,
        selectedCourse,
        mode: "team",
        step: "lobby",
        sessionLoading: false,
      });
      return session;
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to join team session",
        sessionLoading: false,
      });
      throw err;
    }
  },
}));


export default useSessionStore as unknown as UseSessionStore;
