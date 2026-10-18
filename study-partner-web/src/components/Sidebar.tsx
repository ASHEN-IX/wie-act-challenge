import React from "react";
import { Link, useLocation } from "@/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BarChart3,
  BookOpen,
  CheckSquare,
  Target,
  Trophy,
  Users,
  Search,
  Shield,
  Ticket,
  CreditCard,
  LayoutDashboard,
  Radar,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
const Sidebar = ({ topOffset = 80 }: any) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isHovered, setIsHovered] = React.useState(false);
  const [hasFocus, setHasFocus] = React.useState(false);
  const activeToggle = isHovered || hasFocus;
  const isAdmin = user?.role === "admin" || user?.isAdmin;
  const studentNavGroups = [
    {
      title: "Main",
      items: [
        {
          path: "/dashboard",
          label: "Dashboard",
          icon: BarChart3,
        },
        {
          path: "/analytics",
          label: "Analytics",
          icon: Home,
        },
        {
          path: "/search",
          label: "AI Search",
          icon: Search,
        },
      ],
    },
    {
      title: "Study",
      items: [
        {
          path: "/subjects",
          label: "Subjects",
          icon: BookOpen,
        },
        {
          path: "/tasks",
          label: "Tasks",
          icon: CheckSquare,
        },
        {
          path: "/planner",
          label: "Study Plans",
          icon: Target,
        },
      ],
    },
    {
      title: "Social & Progress",
      items: [
        {
          path: "/leaderboard",
          label: "Leaderboard",
          icon: Trophy,
        },
        {
          path: "/friends",
          label: "Friends",
          icon: Users,
        },
        {
          path: "/competency",
          label: "Competency",
          icon: Radar,
        },
      ],
    },
  ];
  const adminNavGroups = [
    {
      title: "Admin",
      items: [
        {
          path: "/admin/dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
        },
        {
          path: "/admin/users",
          label: "Users",
          icon: Shield,
        },
        {
          path: "/admin/subscriptions",
          label: "Subscriptions",
          icon: CreditCard,
        },
        {
          path: "/admin/coupons",
          label: "Coupons",
          icon: Ticket,
        },
        {
          path: "/admin/analytics",
          label: "Analytics",
          icon: BarChart3,
        },
      ],
    },
  ];
  const navGroups = isAdmin ? adminNavGroups : studentNavGroups;
  if (!user) return null;
  return (
    <motion.aside
      initial={false}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false); }}
      transition={{
        duration: 0.3,
        ease: "easeInOut",
      }}
      className="max-[800px]:hidden flex flex-col fixed left-0 bottom-0 border-r border-border shadow-2xl overflow-hidden bg-background/95 backdrop-blur-2xl transition-all"
      style={{
        top: topOffset,
        width: activeToggle ? "240px" : "72px",
        height: `calc(100vh - ${topOffset}px)`,
        zIndex: 90,
      }}
    >
      <div className="flex-1 overflow-y-auto py-8 flex flex-col gap-8 scrollbar-hide">
        {navGroups.map((group: any, groupIdx: any) => (
          <div key={groupIdx} className="px-3">
            <AnimatePresence>
              {activeToggle && (
                <motion.h3
                  initial={{
                    opacity: 0,
                    height: 0,
                  }}
                  animate={{
                    opacity: 1,
                    height: "auto",
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                  }}
                  className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3 px-3"
                >
                  {group.title}
                </motion.h3>
              )}
            </AnimatePresence>
            <div className="space-y-1.5">
              {group.items.map((item: any) => {
                const isActive = location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link key={item.path} to={item.path}>
                    <motion.div
                      whileHover={{
                        x: 4,
                      }}
                      whileTap={{
                        scale: 0.98,
                      }}
                      className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 ${isActive ? "bg-primary/10 text-primary font-semibold shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"}`}
                    >
                      <Icon
                        className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`}
                      />
                      <AnimatePresence>
                        {activeToggle && (
                          <motion.span
                            initial={{
                              opacity: 0,
                              width: 0,
                              marginLeft: 0,
                            }}
                            animate={{
                              opacity: 1,
                              width: "auto",
                              marginLeft: 4,
                            }}
                            exit={{
                              opacity: 0,
                              width: 0,
                              marginLeft: 0,
                            }}
                            className="whitespace-nowrap overflow-hidden text-[15px]"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.aside>
  );
};
export default Sidebar;
