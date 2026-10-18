import React, { useState, useEffect } from "react";
import { Link, useLocation } from "@/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  Sun,
  Trophy,
  Target,
  BookOpen,
  Home,
  BarChart3,
  LogOut,
  CheckSquare,
  Brain,
  Search,
  Users,
  Menu,
  X,
  Shield,
  Ticket,
  CreditCard,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { profileAPI } from "@/services/api";
import NotificationBell from "./NotificationBell";
import SubscriptionBadge from "./SubscriptionBadge";

export interface NavbarProps {
  minimal?: boolean;
  topOffset?: number;
  sidebarOpen?: boolean;
  setSidebarOpen?: React.Dispatch<React.SetStateAction<boolean>> | ((open: boolean) => void);
}

const Navbar: React.FC<NavbarProps> = ({
  minimal = false,
  topOffset = 80,
  sidebarOpen: _sidebarOpen,
  setSidebarOpen: _setSidebarOpen,
} = {}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const tier = useAuthStore((s) => s.getTier());
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      profileAPI
        .get()
        .then((res) => setProfile(res.data.profile))
        .catch(console.error);
    }
  }, [user]);

  const isAdmin = user?.role === "admin" || user?.isAdmin;

  const navItems = minimal
    ? []
    : isAdmin
      ? [
          { path: "/admin/dashboard", label: "Dashboard", icon: Shield },
          { path: "/admin/users", label: "Users", icon: Users },
          {
            path: "/admin/subscriptions",
            label: "Subscriptions",
            icon: CreditCard,
          },
          { path: "/admin/coupons", label: "Coupons", icon: Ticket },
          { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        ]
      : [
          { path: "/", label: "Home", icon: Home },
          { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
          { path: "/subjects", label: "Subjects", icon: BookOpen },
          { path: "/tasks", label: "Tasks", icon: CheckSquare },
          { path: "/planner", label: "Study Plans", icon: Target },
          { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
          { path: "/reviews", label: "Reviews", icon: Brain },
          { path: "/friends", label: "Friends", icon: Users },
          { path: "/search", label: "Search", icon: Search },
        ];

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      style={{ top: topOffset - 80 }}
      className="fixed left-0 right-0 z-[100] bg-background/80 backdrop-blur-2xl border-b border-border/40 h-20 shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all"
    >
      {/* Glossy Overlay components... */}
      {/* Floating Particles - Removed for clean top bar look */}

      <div className="relative max-w-7xl mx-auto px-6 h-full">
        <div className="flex justify-between items-center h-full">
          {/* Centered nav - Removed in favor of Sidebar */}
          {/* Left Corner: Logo & Hamburger */}
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="relative z-10 flex items-center space-x-4 group"
            >
              <motion.div
                className="relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transition-all duration-300">
                  <BookOpen className="w-6 h-6 text-foreground" />
                </motion.div>
              </motion.div>

              <div className="hidden sm:block">
                <span className="text-xl font-bold tracking-tight text-foreground/90">
                  StudyPartner
                </span>
              </div>
            </Link>
          </div>

          {/* Right Corner: Actions */}
          <div className="relative z-10 flex items-center gap-3 ml-auto">
            <motion.button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted border border-border flex items-center justify-center transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-[var(--accent-color-dynamic)]" />
              ) : (
                <Moon className="w-5 h-5 text-foreground" />
              )}
            </motion.button>

            {!minimal && user && <NotificationBell />}

            {!minimal && user && (
              <div className="hidden lg:flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold opacity-80 text-foreground">
                    LEVEL {profile?.level?.current || 1}
                  </span>
                </div>
                <SubscriptionBadge user={user} tier={tier} />
              </div>
            )}

            {user ? (
              <>
                <div className="flex items-center gap-4">
                  <Link to="/profile" className="flex items-center gap-3 group">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors tracking-wide">
                        {profile?.nickname || user.name}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs text-primary font-bold tracking-wider">
                        <span>LVL</span>
                        <span className="text-sm">
                          {profile?.level?.current || 1}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-border group-hover:border-primary transition-colors relative shadow-sm">
                      <img
                        src={
                          profile?.avatar
                            ? profile.avatar.startsWith("data:")
                              ? profile.avatar
                              : profile.avatar.startsWith("http")
                                ? profile.avatar
                                : `${process.env.NEXT_PUBLIC_API_URL || ""}${profile.avatar}`
                            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`
                        }
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </Link>

                  <motion.button
                    onClick={logout}
                    className="w-8 h-8 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center hover:bg-destructive/20"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LogOut className="w-4 h-4 text-destructive" />
                  </motion.button>
                </div>
                <motion.button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="w-10 h-10 flex min-[800px]:hidden items-center justify-center rounded-xl bg-muted/40 hover:bg-muted/60 border border-border transition-colors text-foreground ml-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </motion.button>
              </>
            ) : (
              <Link to="/login">
                <motion.button
                  className="rounded-full px-6 py-2.5 bg-foreground text-background font-semibold text-sm shadow-lg hover:bg-primary hover:text-white transition-colors duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  SIGN IN
                </motion.button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Mobile Navigation */}
      {!minimal && user && (
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="min-[800px]:hidden border-t border-border/60 bg-background/95 backdrop-blur-2xl rounded-b-3xl absolute left-0 right-0 z-50 shadow-xl overflow-hidden"
              style={{ top: topOffset }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-6 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
                {navItems.map((item: any, index: any) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all duration-300 ${
                          isActive
                            ? "bg-primary/15 text-primary shadow-lg shadow-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:shadow-md"
                        }`}
                      >
                        <motion.div
                          whileHover={{ rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className="w-5 h-5" />
                        </motion.div>
                        <span className="font-semibold text-base">
                          {item.label}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.nav>
  );
};

export default Navbar;
