'use client';
import React, { useEffect, useState } from "react";
import { useLocation } from "@/navigation";
import { useAuthStore } from "@/store/authStore";
import { profileAPI } from "@/services/api";
import {
  extractDominantColor,
  extractColorFromVideo,
} from "@/utils/colorExtractor";
import Navbar from "./components/Navbar";
import SessionManager from "./components/SessionManager";
import NotificationCenter from "./components/NotificationCenter";
import UpgradePrompt from "./components/UpgradePrompt";
import TrialBanner from "./components/TrialBanner";
import Sidebar from "./components/Sidebar";
import { ErrorBoundary } from "./components/shared";
import LevelUpNotification from "./components/LevelUpNotification";
import SessionInvitePopup from "./components/SessionInvitePopup";
import useGamificationStore from "./store/gamificationStore";
import useNotificationStore from "./store/notificationStore";

const hexToRgb = (hex: string) => {
  const normalized = (hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};
const rgbToHslCss = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};
function App({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const { startPolling, stopPolling } = useNotificationStore();
  const isLandingPage = location.pathname === "/";
  const isFullscreenPage = ["/team-lobby"].includes(location.pathname);
  const {
    fetchLevelInfo,
    fetchBackgroundSettings,
    backgroundSettings,
    animatedBackgroundSettings,
  } = useGamificationStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accentColor, setAccentColor] = useState("#4fb8ce");
  const tier = useAuthStore((s) => s.getTier());
  const trialVisible = tier === "trial";
  const PAID_BANNER_NEAR_END_DAYS = 5;
  const subscriptionVisible =
    ["vip", "vip_plus"].includes(tier) &&
    Number(user?.daysRemaining || 0) > 0 &&
    Number(user?.daysRemaining || 0) <= PAID_BANNER_NEAR_END_DAYS;
  const bannerVisible = trialVisible || subscriptionVisible;
  // heights in px: trial banner = 40, navbar = 80
  const TRIAL_BANNER_HEIGHT = bannerVisible ? 40 : 0;
  const NAVBAR_HEIGHT = 80;
  const topOffsetPx = NAVBAR_HEIGHT + TRIAL_BANNER_HEIGHT;

  // Fetch gamification data when authenticated
  useEffect(() => {
    if (user?._id) {
      fetchLevelInfo();
      fetchBackgroundSettings();
    }
  }, [user?._id, fetchBackgroundSettings, fetchLevelInfo]);

  // Extract and apply dominant color from background
  useEffect(() => {
    const extractColor = async () => {
      try {
        let color = "#4fb8ce"; // default

        const hasStaticBackground =
          backgroundSettings?.enabled && backgroundSettings?.imageUrl;
        const hasAnimatedBackground =
          animatedBackgroundSettings?.enabled &&
          animatedBackgroundSettings?.videoUrl;

        // Keep extraction source aligned with render priority: static > animated.
        if (hasStaticBackground) {
          color = await extractDominantColor(backgroundSettings.imageUrl);
        } else if (hasAnimatedBackground) {
          color = await extractColorFromVideo(
            animatedBackgroundSettings.videoUrl,
          );
        }
        setAccentColor(color);
        // Apply dynamic accent and map core theme tokens to the same hue.
        document.documentElement.style.setProperty(
          "--accent-color-dynamic",
          color,
        );
        const rgb = hexToRgb(color);
        if (rgb) {
          document.documentElement.style.setProperty(
            "--primary-rgb",
            `${rgb.r}, ${rgb.g}, ${rgb.b}`,
          );
          const hsl = rgbToHslCss(rgb);
          document.documentElement.style.setProperty("--primary", hsl);
          document.documentElement.style.setProperty("--ring", hsl);
        }
      } catch (err) {
        console.error("Error extracting background color:", err);
      }
    };
    extractColor();
  }, [
    backgroundSettings?.imageUrl,
    animatedBackgroundSettings?.videoUrl,
    backgroundSettings?.enabled,
    animatedBackgroundSettings?.enabled,
  ]);

  // Show full navbar on landing page if user is logged in
  const minimalNav = isLandingPage && !user;

  // Start/stop notification polling based on authentication
  useEffect(() => {
    if (user?._id) {
      const cleanup = startPolling(user._id);
      return cleanup;
    } else {
      stopPolling();
    }
  }, [user?._id, startPolling, stopPolling]);

  // Presence updates for online/offline status in social features.
  useEffect(() => {
    if (!user?._id) return;
    let isMounted = true;
    const sendStatus = async (status: string) => {
      if (!isMounted) return;
      try {
        await profileAPI.updateOnlineStatus(status);
      } catch {
        // non-blocking status update
      }
    };
    const handleVisibilityChange = () => {
      sendStatus(document.hidden ? "offline" : "online");
    };
    const handleBeforeUnload = () => {
      sendStatus("offline");
    };
    sendStatus("online");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendStatus("offline");
    };
  }, [user?._id]);

  // Show sidebar for any authenticated user on all pages except the lobby / fullscreen pages
  const showSidebar = user && !isFullscreenPage;
  return (
    <ErrorBoundary>
      {/* Background layers — Static takes priority over Animated */}
      {!isLandingPage &&
      backgroundSettings?.enabled &&
      backgroundSettings?.imageUrl ? (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${backgroundSettings.imageUrl})`,
            backgroundSize:
              backgroundSettings.position === "repeat"
                ? "auto"
                : backgroundSettings.position || "cover",
            backgroundPosition: "center",
            backgroundRepeat:
              backgroundSettings.position === "repeat" ? "repeat" : "no-repeat",
            opacity: backgroundSettings.opacity || 0.15,
            filter: `blur(${backgroundSettings.blur || 2}px)`,
          }}
        />
      ) : !isLandingPage &&
        animatedBackgroundSettings?.enabled &&
        animatedBackgroundSettings?.videoUrl ? (
        <video
          autoPlay
          muted
          loop={animatedBackgroundSettings.loop !== false}
          playsInline
          className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
          style={{
            opacity: animatedBackgroundSettings.opacity || 0.12,
            filter: `brightness(${100 + (animatedBackgroundSettings.brightness || 0)}%) saturate(${animatedBackgroundSettings.saturation || 80}%)`,
          }}
        >
          <source src={animatedBackgroundSettings.videoUrl} type="video/mp4" />
        </video>
      ) : null}

      {/* Ambient glow layer — adapts to extracted background color */}
      {!isLandingPage &&
        (backgroundSettings?.enabled ||
          animatedBackgroundSettings?.enabled) && (
          <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
            <div
              className="absolute top-[-10%] left-[-5%] w-[60vw] h-[60vh] rounded-full blur-[150px] opacity-20"
              style={{
                backgroundColor: accentColor,
              }}
            />
            <div
              className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vh] rounded-full blur-[150px] opacity-15"
              style={{
                backgroundColor: accentColor,
              }}
            />
          </div>
        )}

      <SessionManager />
      <NotificationCenter />
      <LevelUpNotification />
      <SessionInvitePopup />
      <UpgradePrompt />
      <TrialBanner />
      <Navbar
        minimal={minimalNav}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        topOffset={topOffsetPx}
      />

      {showSidebar && <Sidebar topOffset={topOffsetPx} />}

      <main id="main-content"
        className={`relative z-10 w-full min-h-screen transition-all duration-300 ${showSidebar ? "min-[800px]:pl-[72px]" : ""}`}
        style={{
          paddingTop: isLandingPage ? topOffsetPx : topOffsetPx,
        }}
      >
        {children}
      </main>
    </ErrorBoundary>
  );
}
export default App;
