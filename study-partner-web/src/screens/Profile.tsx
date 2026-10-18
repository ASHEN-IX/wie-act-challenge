'use client';
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@/navigation";
import { profileAPI, gamificationAPI, friendsAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import useGamificationStore from "../store/gamificationStore";
import {
  Camera,
  Edit2,
  Zap,
  Trophy,
  Award,
  Copy,
  Users,
  Palette,
  Lock,
} from "lucide-react";

// Helper to determine avatar src
const getAvatarSrc = (avatarPath: any, userName: any) => {
  if (!avatarPath)
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`;
  if (avatarPath.startsWith("data:")) return avatarPath;
  if (avatarPath.startsWith("http")) return avatarPath;
  // If it's a relative path from our uploads, use relative URL (gateway proxies /uploads)
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  return `${apiBase}${avatarPath}`;
};

const getRankBadgeSrc = (imagePath: any) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("data:")) return imagePath;
  if (imagePath.startsWith("http")) return imagePath;
  return imagePath;
};

const Profile = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { level: userLevel, fetchLevelInfo } = useGamificationStore();
  const [profile, setProfile] = useState<any>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [rankProfile, setRankProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    nickname: "",
    bio: "",
    avatar: "",
    avatarFile: null,
  });
  const [friendCount, setFriendCount] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchGamification();
    fetchRankProfile();
    fetchFriendCount();
    fetchLevelInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await profileAPI.get();
      setProfile(response.data.profile);
      setFormData((prev: any) => ({
        ...prev,
        nickname: response.data.profile.nickname || user.name,
        bio: response.data.profile.bio || "",
        avatar: response.data.profile.avatar || "",
      }));
    } catch (error: any) {
      console.error("Failed to fetch profile", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGamification = async () => {
    try {
      const data = await gamificationAPI.getProfile();
      setGamification(data);
    } catch (error: any) {
      console.error("Failed to fetch gamification data:", error);
      setGamification({
        total_xp: 0,
        level: 1,
        achievements: [],
      });
    }
  };

  const fetchRankProfile = async () => {
    try {
      const data = await gamificationAPI.getRankProfile();
      setRankProfile(data);
    } catch (error: any) {
      console.error("Failed to fetch rank profile:", error);
      setRankProfile(null);
    }
  };

  const fetchFriendCount = async () => {
    try {
      const data = await friendsAPI.getCount();
      setFriendCount(data.total || data.count || 0);
    } catch (error: any) {
      console.error("Failed to fetch friend count:", error);
    }
  };

  const copyFriendCode = () => {
    const code = profile?.friendCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const calculateProgress = () => {
    if (!gamification) return 0;
    const xp = gamification.total_xp || 0;
    const progress = ((xp % 100) / 100) * 100;
    return Math.min(progress, 100);
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append("nickname", formData.nickname);
      data.append("bio", formData.bio);

      // If we have a file, append it as 'avatarFile'
      // If we have a URL string (not file), send as 'avatar'
      if (formData.avatarFile) {
        data.append("avatarFile", formData.avatarFile);
      } else if (formData.avatar) {
        data.append("avatar", formData.avatar);
      }

      await profileAPI.update(data);
      setEditing(false);
      fetchProfile();
    } catch (error: any) {
      console.error("Failed to update profile", error);
      const msg = error.response?.data?.error || error.message;
      alert("Failed to update profile: " + msg);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        LOADING...
      </div>
    );

  return (
    <div className="min-h-screen bg-background pt-24 px-6 md:px-12 text-foreground overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-background rounded-full blur-[150px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Profile Header Card */}
        <div className="relative mb-12">
          {/* Card Container - Glassmorphism Valorant Style */}
          <div className="relative bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl overflow-hidden">
            {/* Decorative Border Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-transparent to-transparent opacity-80" />
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              {/* Avatar Section */}
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden border-4 border-border shadow-xl relative z-10 group-hover:border-primary transition-all duration-300">
                  <img
                    src={
                      editing && formData.avatar
                        ? formData.avatar
                        : getAvatarSrc(profile?.avatar, user?.name)
                    }
                    alt="Profile"
                    className="w-full h-full object-cover bg-background"
                  />
                  {editing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors">
                      <Camera className="w-8 h-8 text-foreground opacity-80" />
                    </div>
                  )}
                </div>
                {/* Level Badge overlapping avatar */}
                <div className="absolute -bottom-3 -right-3 bg-primary w-10 h-10 flex items-center justify-center font-bold text-lg text-primary-foreground rounded-xl shadow-lg border-2 border-card z-20">
                  {profile?.level?.current || 1}
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 w-full text-center md:text-left">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold font-valorant tracking-wider mb-1">
                      {formData.nickname || user?.name}
                    </h1>
                    <p className="text-muted-foreground font-medium tracking-widest text-sm uppercase flex items-center justify-center md:justify-start gap-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      {profile?.level?.title || "Novice Explorer"}
                    </p>

                    {rankProfile?.profile?.rankName && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                        {getRankBadgeSrc(rankProfile?.rankBadge?.imagePath) && (
                          <img
                            src={getRankBadgeSrc(
                              rankProfile.rankBadge.imagePath,
                            )}
                            alt={rankProfile.profile.rankName}
                            className="w-8 h-8 object-contain"
                          />
                        )}
                        <span className="text-xs font-bold uppercase tracking-widest text-primary">
                          {rankProfile.profile.rankName}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setEditing(!editing)}
                    className="mt-4 md:mt-0 px-6 py-2 rounded-lg bg-muted/50 border border-border hover:bg-muted hover:border-primary transition-all flex items-center gap-2 text-sm font-bold tracking-wider"
                  >
                    <Edit2 className="w-4 h-4" />
                    {editing ? "CANCEL" : "EDIT PROFILE"}
                  </button>
                </div>

                {/* Level Progress */}
                <div className="bg-muted rounded-full h-4 w-full mb-2 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/80"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <span>{gamification?.total_xp || 0} XP</span>
                  <span>Next Level: {(gamification?.level || 1) * 100} XP</span>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div className="bg-muted/50 p-3 rounded-xl border border-border text-center">
                    <div className="text-primary mb-1 flex justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="text-xl font-bold">
                      {rankProfile?.profile?.currentStreak || profile?.stats?.currentStreak || 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Streak
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-xl border border-border text-center">
                    <div className="text-[var(--accent-color-dynamic)] mb-1 flex justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="text-xl font-bold">
                      {gamification?.stats?.tasksCompleted || profile?.stats?.completedTasks || 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Tasks
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-xl border border-border text-center">
                    <div className="text-[var(--accent-color-dynamic)] mb-1 flex justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-xl font-bold">{friendCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Friends
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Friend Code Card */}
            {profile?.friendCode && (
              <div className="mt-6 bg-muted/30 border border-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                    Your Friend Code
                  </p>
                  <p className="font-mono font-bold text-primary text-lg tracking-wider">
                    {profile.friendCode}
                  </p>
                </div>
                <button
                  onClick={copyFriendCode}
                  className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Copy className="w-4 h-4" />
                  {codeCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            {/* Appearance Section (MC-3) */}
            <div className="mt-8 pt-8 border-t border-border">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Appearance
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AppearanceCard
                  title="Custom Wallpaper"
                  description="Choose a static background image"
                  requiredLevel={10}
                  currentLevel={userLevel ?? 1}
                  onClick={() => navigate("/customize/wallpaper")}
                />
                <AppearanceCard
                  title="Animated Background"
                  description="Unlock animated particle effects"
                  requiredLevel={20}
                  currentLevel={userLevel ?? 1}
                  onClick={() => navigate("/customize/animated")}
                />
              </div>
            </div>
            {/* Editing Form */}
            {editing && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="mt-8 pt-8 border-t border-border"
                onSubmit={handleUpdate}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Nickname
                    </label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e: any) =>
                        setFormData({ ...formData, nickname: e.target.value })
                      }
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Avatar
                    </label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={formData.avatar}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            avatar: e.target.value,
                            avatarFile: null,
                          })
                        }
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-primary outline-none transition-colors text-sm"
                        placeholder="Enter Image URL or Upload File below..."
                      />
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e: any) => {
                            if (e.target.files[0]) {
                              setFormData({
                                ...formData,
                                avatarFile: e.target.files[0],
                                avatar: "", // Clear URL if file selected
                              });
                            }
                          }}
                          className="block w-full text-sm text-muted-foreground
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-xs file:font-semibold
                                  file:bg-primary file:text-primary-foreground
                                  hover:file:bg-primary/80
                                  cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-6 w-full py-3 bg-primary hover:bg-primary/80 text-primary-foreground font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </motion.form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Helper: Appearance Card ─────────────────────────────────── */
const AppearanceCard = ({
  title,
  description,
  requiredLevel,
  currentLevel,
  onClick,
}: any) => {
  const locked = currentLevel < requiredLevel;
  return (
    <button
      disabled={locked}
      onClick={onClick}
      className={`relative text-left p-4 rounded-xl border transition-all ${
        locked
          ? "border-border bg-muted/20 opacity-60 cursor-not-allowed"
          : "border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer"
      }`}
    >
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {locked && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="w-3 h-3" /> Lvl {requiredLevel}
        </span>
      )}
    </button>
  );
};

export default Profile;
