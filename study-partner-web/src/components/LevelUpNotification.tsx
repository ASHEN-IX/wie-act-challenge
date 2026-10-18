import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Image, Film, X } from "lucide-react";
import useGamificationStore from "../store/gamificationStore";

const FEATURE_INFO = {
  wallpaper: {
    icon: Image,
    title: "Custom Wallpapers Unlocked!",
    description:
      "You can now customize your app background with preset or uploaded wallpapers.",
    color: "var(--accent-color-dynamic)",
    link: "/customize/wallpaper",
  },
  animated_background: {
    icon: Film,
    title: "Animated Backgrounds Unlocked!",
    description:
      "Premium animated backgrounds are now available. Make your study space truly yours.",
    color: "var(--accent-color-dynamic)",
    link: "/customize/animated",
  },
};

const LevelUpNotification = () => {
  const { showLevelUpNotification, levelUpData, dismissLevelUp } =
    useGamificationStore();

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (showLevelUpNotification) {
      const timer = setTimeout(() => dismissLevelUp(), 8000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLevelUpNotification]);

  if (!showLevelUpNotification || !levelUpData) return null;

  const featureUnlock = levelUpData.unlockedFeature
    ? (FEATURE_INFO as any)[levelUpData.unlockedFeature]
    : null;

  // Resolve dynamic color to actual value
  const accentColor =
    featureUnlock?.color === "var(--accent-color-dynamic)"
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--accent-color-dynamic")
          .trim() || "#4fb8ce"
      : featureUnlock?.color || "var(--accent-color-dynamic)";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -80, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full mx-4"
      >
        <div className="relative bg-[#1a2633] border border-[#ffffff15] rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
          {/* Top accent bar */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${accentColor}, transparent)`,
            }}
          />

          {/* Glow effect */}
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-[80px] opacity-30"
            style={{ backgroundColor: accentColor }}
          />

          <div className="relative p-5">
            {/* Close button */}
            <button
              onClick={dismissLevelUp}
              className="absolute top-3 right-3 p-1 hover:bg-[#ffffff10] rounded-full transition-colors text-gray-500"
            >
              <X size={14} />
            </button>

            {/* Level badge */}
            <div className="flex items-center gap-4 mb-3">
              <motion.div
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}40)`,
                }}
              >
                <Trophy size={28} style={{ color: accentColor }} />
              </motion.div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                  Level Up!
                </p>
                <p className="text-2xl font-black text-white tracking-tight">
                  Level {levelUpData.level}
                </p>
              </div>
            </div>

            {/* Feature unlock banner */}
            {featureUnlock && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-3 rounded-xl border flex items-center gap-3"
                style={{
                  backgroundColor: `${accentColor}10`,
                  borderColor: `${accentColor}30`,
                }}
              >
                <featureUnlock.icon size={20} style={{ color: accentColor }} />
                <div>
                  <p
                    className="text-sm font-bold"
                    style={{ color: accentColor }}
                  >
                    {featureUnlock.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {featureUnlock.description}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Sparkle particles */}
            <div className="absolute top-2 left-8 flex gap-1">
              {[...Array(3)].map((_: any, i: any) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: -20 }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 1 }}
                >
                  <Star
                    size={10}
                    className="text-[var(--accent-color-dynamic)]"
                    fill="currentColor"
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Auto-close progress bar */}
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 8, ease: "linear" }}
            className="h-0.5"
            style={{
              backgroundColor:
                featureUnlock?.color || "var(--accent-color-dynamic)",
            }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LevelUpNotification;
