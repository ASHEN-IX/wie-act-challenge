'use client';
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Film,
  Lock,
  Check,
  EyeOff,
  Play,
  Pause,
  Sun,
  Droplets,
  Gauge,
  RefreshCw,
  Palette,
  Upload,
  X,
} from "lucide-react";
import useGamificationStore from "../store/gamificationStore";

const AnimatedBackgroundCustomizer = () => {
  const navigate = useNavigate();
  const {
    level,
    animatedBackgroundSettings,
    animatedPresets,
    fetchAnimatedPresets,
    fetchBackgroundSettings,
    applyAnimatedBackground,
    uploadAnimatedBackground,
    disableAnimatedBackground,
    hasFeature,
    loading,
  } = useGamificationStore();

  const [activeTab, setActiveTab] = useState("presets");
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<any>(null);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const fileInputRef = useRef<any>(null);
  const [localSettings, setLocalSettings] = useState({
    opacity: 0.12,
    brightness: 0,
    saturation: 80,
    speed: 1,
    loop: true,
  });

  const unlocked = hasFeature("animated_background");

  useEffect(() => {
    fetchAnimatedPresets();
    fetchBackgroundSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (animatedBackgroundSettings) {
      setLocalSettings({
        opacity: animatedBackgroundSettings.opacity || 0.12,
        brightness: animatedBackgroundSettings.brightness || 0,
        saturation: animatedBackgroundSettings.saturation || 80,
        speed: animatedBackgroundSettings.speed || 1,
        loop: animatedBackgroundSettings.loop !== false,
      });
    }
  }, [animatedBackgroundSettings]);

  const handleApply = async () => {
    const Video = uploadFile ? uploadPreview : selectedPreset?.url;
    if (!Video) return;
    await applyAnimatedBackground({
      videoUrl: Video,
      type: uploadFile ? "uploaded" : selectedPreset?.type || "preset",
      opacity: localSettings.opacity,
      brightness: localSettings.brightness,
      saturation: localSettings.saturation,
      speed: localSettings.speed,
      loop: localSettings.loop,
      enabled: true,
    });
  };

  const handleUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadApply = async () => {
    if (!uploadFile) return;
    // Upload the video file and get the new settings with videoUrl
    const uploadResult = await uploadAnimatedBackground(uploadFile);
    const newVideoUrl =
      uploadResult?.animatedBackgroundSettings?.videoUrl || uploadPreview;

    // Then apply the settings with the new videoUrl
    await applyAnimatedBackground({
      videoUrl: newVideoUrl,
      type: "uploaded",
      opacity: localSettings.opacity,
      brightness: localSettings.brightness,
      saturation: localSettings.saturation,
      speed: localSettings.speed,
      loop: localSettings.loop,
      enabled: true,
    });

    // Clear upload state after successful apply
    setUploadFile(null);
    setUploadPreview(null);
  };

  const handleDisable = async () => {
    await disableAnimatedBackground();
    setSelectedPreset(null);
    setUploadFile(null);
    setUploadPreview(null);
  };

  // ── Locked state ───────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-10">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[200px]"
            style={{
              backgroundColor: "var(--accent-color-dynamic)",
            }}
          />
        </div>
        <div className="relative z-10 text-center max-w-md p-8">
          <Lock size={64} className="mx-auto text-gray-600 mb-6" />
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-3">
            LOCKED
          </h1>
          <p className="text-gray-400 mb-4">
            Animated backgrounds unlock at{" "}
            <span
              className="font-bold"
              style={{
                color: "var(--accent-color-dynamic)",
              }}
            >
              Level 20
            </span>
            .
          </p>
          <p className="text-gray-500 text-sm mb-8">
            You are currently{" "}
            <span className="text-white font-bold">Level {level}</span>. Keep
            pushing to unlock this premium feature!
          </p>
          <div className="w-full h-3 bg-[#1a2633] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]/50 rounded-full"
              style={{ width: `${Math.min((level / 20) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600">{level}/20 levels</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-8 px-6 py-3 bg-[#1a2633] border border-[#ffffff10] text-white font-bold tracking-wider uppercase rounded-lg hover:bg-[#ffffff10] transition-all"
          >
            GO BACK
          </button>
        </div>
      </div>
    );
  }

  // ── Main customizer ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1923] text-white">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-[#ffffff10] bg-[#0f1923]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <Film size={18} className="text-[var(--accent-color-dynamic)]" />
          <span className="font-bold tracking-wider uppercase text-sm">
            Animated Backgrounds
          </span>
        </div>
        <div className="flex items-center gap-3">
          {animatedBackgroundSettings?.enabled && (
            <button
              onClick={handleDisable}
              className="px-4 py-2 text-xs font-bold tracking-wider uppercase bg-[#1a2633] border border-[#ffffff10] text-gray-400 rounded hover:text-white transition-colors flex items-center gap-1"
            >
              <EyeOff size={14} /> Disable
            </button>
          )}
          <button
            onClick={uploadFile ? handleUploadApply : handleApply}
            disabled={(!selectedPreset && !uploadFile) || loading}
            className="px-6 py-2 bg-[var(--accent-color-dynamic)] text-white text-xs font-bold tracking-wider uppercase rounded hover:bg-[var(--accent-color-dynamic)]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Check size={14} /> {loading ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar — Presets + Settings */}
        <div className="w-80 border-r border-[#ffffff10] bg-[#0f1923] flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-[#ffffff10]">
            <button
              onClick={() => {
                setActiveTab("presets");
                setUploadFile(null);
                setUploadPreview(null);
              }}
              className={`flex-1 px-4 py-3 text-xs font-bold tracking-wider uppercase transition-colors ${
                activeTab === "presets"
                  ? "bg-[var(--accent-color-dynamic)] text-white border-b-2 border-[var(--accent-color-dynamic)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => {
                setActiveTab("upload");
                setSelectedPreset(null);
              }}
              className={`flex-1 px-4 py-3 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1 ${
                activeTab === "upload"
                  ? "bg-[var(--accent-color-dynamic)] text-white border-b-2 border-[var(--accent-color-dynamic)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Upload size={12} /> Upload
            </button>
          </div>

          {/* Presets Tab */}
          {activeTab === "presets" && (
            <div className="p-4 border-b border-[#ffffff10]">
              <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-3">
                Presets
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {animatedPresets.map((preset: any, idx: any) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedPreset(preset)}
                    className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-colors ${
                      selectedPreset?.url === preset.url
                        ? "border-[var(--accent-color-dynamic)]"
                        : "border-transparent hover:border-[#ffffff20]"
                    }`}
                  >
                    {/* Thumbnail — use poster or gradient fallback */}
                    <div className="w-full h-full bg-gradient-to-br from-[#1a2633] to-[#0f1923] flex items-center justify-center">
                      {preset.thumbnail ? (
                        <img
                          src={preset.thumbnail}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film size={20} className="text-gray-600" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white/80">
                      {preset.name}
                    </span>
                    {selectedPreset?.url === preset.url && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-[var(--accent-color-dynamic)] rounded-full flex items-center justify-center">
                        <Check size={12} />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div className="p-4 border-b border-[#ffffff10] flex flex-col items-center justify-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept="video/*"
                className="hidden"
              />
              {!uploadFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-square bg-[#1a2633] border-2 border-dashed border-[var(--accent-color-dynamic)]/50 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic)]/5 transition-all"
                >
                  <Upload
                    size={32}
                    className="text-[var(--accent-color-dynamic)]"
                  />
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-400">
                      Click to upload
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      MP4, WebM, MOV (max 50MB)
                    </p>
                  </div>
                </button>
              ) : (
                <div className="w-full space-y-2">
                  <div className="w-full bg-[#1a2633] rounded-lg p-2 flex items-center justify-between">
                    <p className="text-xs text-gray-300 truncate">
                      {uploadFile.name}
                    </p>
                    <button
                      onClick={() => {
                        setUploadFile(null);
                        setUploadPreview(null);
                      }}
                      className="p-1 hover:bg-[#ffffff10] rounded transition-colors"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)}MB
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Settings
            </h3>

            <div>
              <label className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1 mb-2">
                <Droplets size={12} /> Opacity —{" "}
                {(localSettings.opacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={localSettings.opacity * 100}
                onChange={(e: any) =>
                  setLocalSettings((p) => ({
                    ...p,
                    opacity: parseInt(e.target.value) / 100,
                  }))
                }
                className="w-full accent-[var(--accent-color-dynamic)]"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1 mb-2">
                <Sun size={12} /> Brightness — {localSettings.brightness}
              </label>
              <input
                type="range"
                min="-50"
                max="50"
                value={localSettings.brightness}
                onChange={(e: any) =>
                  setLocalSettings((p) => ({
                    ...p,
                    brightness: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-[var(--accent-color-dynamic)]"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1 mb-2">
                <Palette size={12} /> Saturation — {localSettings.saturation}%
              </label>
              <input
                type="range"
                min="0"
                max="150"
                value={localSettings.saturation}
                onChange={(e: any) =>
                  setLocalSettings((p) => ({
                    ...p,
                    saturation: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-[var(--accent-color-dynamic)]"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1 mb-2">
                <Gauge size={12} /> Speed — {localSettings.speed}x
              </label>
              <input
                type="range"
                min="50"
                max="200"
                value={localSettings.speed * 100}
                onChange={(e: any) =>
                  setLocalSettings((p) => ({
                    ...p,
                    speed: parseInt(e.target.value) / 100,
                  }))
                }
                className="w-full accent-[var(--accent-color-dynamic)]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400 font-bold tracking-wider flex items-center gap-1">
                <RefreshCw size={12} /> Loop
              </label>
              <button
                onClick={() =>
                  setLocalSettings((p) => ({ ...p, loop: !p.loop }))
                }
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  localSettings.loop
                    ? "bg-[var(--accent-color-dynamic)]"
                    : "bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    localSettings.loop ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 relative flex items-center justify-center bg-[#0a1018] overflow-hidden">
          {selectedPreset || uploadPreview ? (
            <>
              <video
                key={selectedPreset?.url || uploadPreview}
                autoPlay={previewPlaying}
                muted
                loop={localSettings.loop}
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  opacity: localSettings.opacity,
                  filter: `brightness(${100 + localSettings.brightness}%) saturate(${localSettings.saturation}%)`,
                  // playbackRate: localSettings.speed,
                }}
                ref={(el) => {
                  if (el) el.playbackRate = localSettings.speed;
                }}
              >
                <source
                  src={selectedPreset?.url || uploadPreview}
                  type="video/mp4"
                />
              </video>
              <div className="absolute inset-0 bg-[#0f1923]/60" />

              {/* Play/Pause toggle */}
              <button
                onClick={() => setPreviewPlaying(!previewPlaying)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                {previewPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              {/* Mock content overlay */}
              <div className="relative z-10 w-[80%] max-w-2xl">
                <div className="bg-[#1a2633]/80 backdrop-blur-md border border-[#ffffff10] rounded-2xl p-8 text-center">
                  <Film
                    size={32}
                    className="mx-auto text-[var(--accent-color-dynamic)] mb-4"
                  />
                  <h2 className="text-2xl font-black tracking-tighter uppercase mb-2">
                    LIVE PREVIEW
                  </h2>
                  <p className="text-gray-400 text-sm">
                    This is how the animated background will appear behind app
                    content. Adjust settings in the sidebar.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <Film size={48} className="mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500">
                Select a preset to preview the animation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimatedBackgroundCustomizer;
