import { create } from "zustand";
import { backgroundAPI } from "../services/api";

const MAX_BACKGROUND_SIZE_LABEL = "5MB";

const normalizeUploadErrorMessage = (err: any, fallbackMessage: any) => {
  const backendError = err?.response?.data?.error;
  if (backendError === "File is too large") {
    return `File is too large. Maximum allowed size is ${MAX_BACKGROUND_SIZE_LABEL}.`;
  }
  return backendError || fallbackMessage;
};

// Local persistence helpers (for localhost/dev use)
const LOCAL_BG_KEY = "localBackgroundProfile";

const isLocalhost = () => {
  try {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch (e) {
    return false;
  }
};

const fileToDataUrl = (file: any) =>
  new Promise((resolve: any, reject: any) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e: any) => reject(e);
    reader.readAsDataURL(file);
  });

const saveLocalProfile = (profile: any) => {
  try {
    localStorage.setItem(LOCAL_BG_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("Failed to save local background profile:", e);
  }
};

const loadLocalProfile = () => {
  try {
    const raw = localStorage.getItem(LOCAL_BG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse local background profile:", e);
    return null;
  }
};

export interface GamificationState {
  userStats: any;
  levelInfo: any;
  quests: any[];
  dailyQuests: any[];
  weeklyQuests: any[];
  rankInfo: any;
  leaderboard: any[];
  userRank: any;
  badges: any[];
  recentRewards: any[];
  backgroundSettings: any;
  animatedBackgroundSettings: any;
  loading: boolean;
  error: string | null;
  [key: string]: any;
}

export type UseGamificationStore = {
  (): GamificationState;
  <U>(selector: (state: GamificationState) => U): U;
  getState: () => GamificationState;
  setState: any;
  subscribe: any;
};
export const useGamificationStore = create<any>((set: any, get: any) => ({
  // Level & XP
  level: 1,
  totalXP: 0,
  nextLevelXP: 100,
  xpProgress: 0,
  unlockedFeatures: [],

  // Background settings
  backgroundSettings: null,
  animatedBackgroundSettings: null,
  backgroundPresets: [],
  animatedPresets: [],

  // UI state
  showLevelUpNotification: false,
  levelUpData: null,
  loading: false,
  error: null,

  // Fetch level info
  fetchLevelInfo: async () => {
    try {
      const data = await backgroundAPI.getLevelInfo();
      set({
        level: data.level,
        totalXP: data.totalXP,
        nextLevelXP: data.nextLevelXP,
        xpProgress: data.xpProgress,
        unlockedFeatures: data.unlockedFeatures || [],
      });
    } catch (err: any) {
      // Silently fail for unimplemented endpoints
      if (err.response?.status !== 404) {
        console.error("Failed to fetch level info:", err);
      }
    }
  },

  // Fetch background settings (supports localStorage on localhost)
  fetchBackgroundSettings: async () => {
    try {
      // Prefer local profile when developing on localhost
      if (isLocalhost()) {
        const local = loadLocalProfile();
        if (local) {
          set({
            backgroundSettings: local.backgroundSettings ?? null,
            animatedBackgroundSettings:
              local.animatedBackgroundSettings ?? null,
          });
          return local;
        }
      }

      const data = await backgroundAPI.getSettings();
      set({
        backgroundSettings: data.backgroundSettings,
        animatedBackgroundSettings: data.animatedBackgroundSettings,
      });
      return data;
    } catch (err: any) {
      // Silently fail for unimplemented endpoints
      if (err.response?.status !== 404) {
        console.error("Failed to fetch background settings:", err);
      }
    }
  },

  // Fetch preset galleries
  fetchBackgroundPresets: async () => {
    try {
      const data = await backgroundAPI.getPresets();
      set({ backgroundPresets: data.presets || [] });
    } catch (err: any) {
      console.error("Failed to fetch background presets:", err);
    }
  },

  fetchAnimatedPresets: async () => {
    try {
      const data = await backgroundAPI.getAnimatedPresets();
      set({ animatedPresets: data.presets || [] });
    } catch (err: any) {
      console.error("Failed to fetch animated presets:", err);
    }
  },

  // Apply static background (supports local-only save when on localhost or when (options as any).localOnly)
  applyBackground: async (settings: any, options: any = {}) => {
    set({ loading: true });
    const localOnly = (options as any).localOnly === true || isLocalhost();
    try {
      if (localOnly) {
        const local = loadLocalProfile() || {};
        local.backgroundSettings = {
          ...local.backgroundSettings,
          ...settings,
          enabled: settings.enabled !== undefined ? settings.enabled : true,
          uploadedAt:
            settings.type === "uploaded"
              ? new Date().toISOString()
              : local.backgroundSettings?.uploadedAt,
        };

        // Enforce exclusivity
        if (local.backgroundSettings.enabled) {
          local.animatedBackgroundSettings = {
            ...(local.animatedBackgroundSettings || {}),
            enabled: false,
            videoUrl: null,
          };
        }

        saveLocalProfile(local);
        set({
          backgroundSettings: local.backgroundSettings,
          animatedBackgroundSettings: local.animatedBackgroundSettings,
          loading: false,
        });
        return {
          backgroundSettings: local.backgroundSettings,
          animatedBackgroundSettings: local.animatedBackgroundSettings,
          message: "Background applied (local)",
        };
      }

      const data = await backgroundAPI.applyBackground(settings);
      set((state: any) => ({
        backgroundSettings: data.backgroundSettings ?? state.backgroundSettings,
        animatedBackgroundSettings:
          data.animatedBackgroundSettings ?? state.animatedBackgroundSettings,
        loading: false,
      }));
      return data;
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to apply background",
        loading: false,
      });
      throw err;
    }
  },

  // Upload custom background (supports local-only storage for images)
  uploadBackground: async (file: any, options: any = {}) => {
    set({ loading: true, error: null });
    const localOnly = (options as any).localOnly === true || isLocalhost();
    try {
      if (localOnly) {
        // Convert file to data URL and store locally
        const dataUrl = await fileToDataUrl(file);
        const local = loadLocalProfile() || {};
        local.backgroundSettings = {
          ...(local.backgroundSettings || {}),
          enabled: true,
          type: "uploaded",
          imageUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        };

        // Uploading static background deactivates animated mode.
        local.animatedBackgroundSettings = {
          ...(local.animatedBackgroundSettings || {}),
          enabled: false,
          videoUrl: null,
        };

        saveLocalProfile(local);
        set({
          backgroundSettings: local.backgroundSettings,
          animatedBackgroundSettings: local.animatedBackgroundSettings,
          loading: false,
        });
        return {
          backgroundSettings: local.backgroundSettings,
          animatedBackgroundSettings: local.animatedBackgroundSettings,
          message: "Background uploaded (local)",
        };
      }

      const formData = new FormData();
      formData.append("backgroundImage", file);
      const data = await backgroundAPI.uploadBackground(formData);
      set((state: any) => ({
        backgroundSettings: data.backgroundSettings ?? state.backgroundSettings,
        animatedBackgroundSettings:
          data.animatedBackgroundSettings ?? state.animatedBackgroundSettings,
        loading: false,
      }));
      return data;
    } catch (err: any) {
      const errorMessage = normalizeUploadErrorMessage(
        err,
        "Failed to upload background",
      );
      set({
        error: errorMessage,
        loading: false,
      });
      throw err;
    }
  },

  // Upload custom animated background video (local-only storage for small videos — use with caution)
  uploadAnimatedBackground: async (file: any, options: any = {}) => {
    set({ loading: true });
    const localOnly = (options as any).localOnly === true || isLocalhost();
    try {
      if (localOnly) {
        // Guard: localStorage has limited space — reject large videos
        if (file.size && file.size > 2 * 1024 * 1024) {
          const msg =
            "Video too large to save locally. Upload to server instead.";
          set({ error: msg, loading: false });
          throw new Error(msg);
        }
        const dataUrl = await fileToDataUrl(file);
        const local = loadLocalProfile() || {};
        local.animatedBackgroundSettings = {
          ...(local.animatedBackgroundSettings || {}),
          enabled: true,
          type: "uploaded",
          videoUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        };

        // Uploading animated background deactivates static mode.
        local.backgroundSettings = {
          ...(local.backgroundSettings || {}),
          enabled: false,
          imageUrl: null,
        };

        saveLocalProfile(local);
        set({
          animatedBackgroundSettings: local.animatedBackgroundSettings,
          backgroundSettings: local.backgroundSettings,
          loading: false,
        });
        return {
          animatedBackgroundSettings: local.animatedBackgroundSettings,
          backgroundSettings: local.backgroundSettings,
          message: "Animated background uploaded (local)",
        };
      }

      const formData = new FormData();
      formData.append("animatedVideo", file);
      const data = await backgroundAPI.uploadAnimatedBackground(formData);
      set((state: any) => ({
        animatedBackgroundSettings:
          data.animatedBackgroundSettings ?? state.animatedBackgroundSettings,
        backgroundSettings: data.backgroundSettings ?? state.backgroundSettings,
        loading: false,
      }));
      return data;
    } catch (err: any) {
      set({
        error:
          err.response?.data?.error || "Failed to upload animated background",
        loading: false,
      });
      throw err;
    }
  },

  // Apply animated background
  applyAnimatedBackground: async (settings: any) => {
    set({ loading: true });
    try {
      const data = await backgroundAPI.applyAnimatedBackground(settings);
      set((state: any) => ({
        animatedBackgroundSettings:
          data.animatedBackgroundSettings ?? state.animatedBackgroundSettings,
        backgroundSettings: data.backgroundSettings ?? state.backgroundSettings,
        loading: false,
      }));
      return data;
    } catch (err: any) {
      set({
        error:
          err.response?.data?.error || "Failed to apply animated background",
        loading: false,
      });
      throw err;
    }
  },

  // Disable backgrounds
  disableBackground: async () => {
    try {
      if (isLocalhost()) {
        const local = loadLocalProfile() || {};
        local.backgroundSettings = {
          ...(local.backgroundSettings || {}),
          enabled: false,
        };
        saveLocalProfile(local);
        set((s: any) => ({ backgroundSettings: local.backgroundSettings }));
        return;
      }
      await backgroundAPI.applyBackground({ enabled: false });
      set((s: any) => ({
        backgroundSettings: {
          ...s.backgroundSettings,
          enabled: false,
        },
      }));
    } catch (err: any) {
      console.error("Failed to disable background:", err);
    }
  },

  disableAnimatedBackground: async () => {
    try {
      if (isLocalhost()) {
        const local = loadLocalProfile() || {};
        local.animatedBackgroundSettings = {
          ...(local.animatedBackgroundSettings || {}),
          enabled: false,
        };
        saveLocalProfile(local);
        set((s: any) => ({
          animatedBackgroundSettings: local.animatedBackgroundSettings,
        }));
        return;
      }
      await backgroundAPI.applyAnimatedBackground({ enabled: false });
      set((s: any) => ({
        animatedBackgroundSettings: {
          ...s.animatedBackgroundSettings,
          enabled: false,
        },
      }));
    } catch (err: any) {
      console.error("Failed to disable animated background:", err);
    }
  },

  // Level up notification
  triggerLevelUp: (data: any) =>
    set({
      showLevelUpNotification: true,
      levelUpData: data,
    }),

  dismissLevelUp: () =>
    set({
      showLevelUpNotification: false,
      levelUpData: null,
    }),

  // Check if feature is unlocked
  hasFeature: (feature: any) => get().unlockedFeatures.includes(feature),

  clearError: () => set({ error: null }),
}));



export default useGamificationStore as unknown as UseGamificationStore;
