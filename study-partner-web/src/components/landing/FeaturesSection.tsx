import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Calendar,
  Eye,
  Bot,
  Trophy,
  Star,
  Zap,
  Target,
  Award,
  Gamepad2,
} from "lucide-react";
import TiltCard from "@/components/ui/TiltCard";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Gamepad2,
    title: "Gamified Learning",
    description:
      "Turn studying into an engaging game with XP, levels, achievements, and leaderboards.",
    color: "text-primary",
    bg: "bg-gradient-to-br from-primary/20 to-[var(--accent-color-dynamic)]/20 border-primary/30",
    badge: "🎮",
    xp: "+50 XP",
  },
  {
    icon: Trophy,
    title: "Achievement System",
    description:
      "Unlock badges and rewards for milestones like study streaks, completed courses, and perfect scores.",
    color: "text-[var(--accent-color-dynamic)]",
    bg: "bg-gradient-to-br from-[var(--accent-color-dynamic)]/20 to-[var(--accent-color-dynamic)]/20 border-[var(--accent-color-dynamic)]/30",
    badge: "🏆",
    xp: "+100 XP",
  },
  {
    icon: Target,
    title: "Quest-Based Tasks",
    description:
      "Complete daily quests and challenges to maintain motivation and track progress.",
    color: "text-primary",
    bg: "bg-gradient-to-br from-primary/20 to-[var(--accent-color-dynamic)]/20 border-primary/30",
    badge: "🎯",
    xp: "+25 XP",
  },
  {
    icon: Calendar,
    title: "Smart Planning",
    description:
      "AI-powered study planning that adapts to your learning style and schedule constraints.",
    color: "text-primary",
    bg: "bg-gradient-to-br from-primary/20 to-[var(--accent-color-dynamic)]/20 border-primary/30",
    badge: "📅",
    xp: "+15 XP",
  },
  {
    icon: Bot,
    title: "AI Study Coach",
    description:
      "Get instant feedback and guidance during study sessions to optimize your learning.",
    color: "text-primary",
    bg: "bg-gradient-to-br from-primary/20 to-[var(--accent-color-dynamic)]/20 border-primary/30",
    badge: "🤖",
    xp: "+30 XP",
  },
  {
    icon: Eye,
    title: "Focus Analytics",
    description:
      "Monitor your attention levels and prevent burnout with intelligent fatigue alerts.",
    color: "text-[var(--accent-color-dynamic)]",
    bg: "bg-gradient-to-br from-[var(--accent-color-dynamic)]/20 to-[var(--accent-color-dynamic)]/20 border-[var(--accent-color-dynamic)]/30",
    badge: "👁️",
    xp: "+20 XP",
  },
];

const FeaturesSection = () => {
  const containerRef = useRef<any>(null);
  const headerRef = useRef<any>(null);
  const cardsRef = useRef<any>(null);
  const achievementRef = useRef<any>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header Animation
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        },
      );

      // Cards Stagger Animation
      gsap.fromTo(
        cardsRef.current.children,
        { opacity: 0, y: 50, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: "back.out(1.5)",
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        },
      );

      // Achievement Banner Animation
      gsap.fromTo(
        achievementRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: achievementRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 px-4 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div ref={headerRef} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-6 py-2 bg-primary/10 border-l-2 border-primary mb-6 animate-pulse">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-primary font-valorant tracking-wider">
              SYSTEM.FEATURES // GAMIFIED
            </span>
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl font-bold font-valorant mb-4 text-gray-900 dark:text-white uppercase tracking-tighter loading-none">
            Level Up Your <span className="text-outline">Learning</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-medium">
            Transform studying into an addictive game with rewards,
            achievements, and progress tracking.
          </p>
        </div>

        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature: any, index: any) => (
            <TiltCard key={index} className="h-full group">
              {/* Glossy sheen overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-50 pointer-events-none rounded-2xl" />

              <div className="h-full p-8 relative overflow-hidden transition-transform duration-300 hover:-translate-y-2">
                {/* XP Badge */}
                <div className="absolute top-0 right-0 px-4 py-1 bg-[var(--accent-color-dynamic)]/10 border-b border-l border-[var(--accent-color-dynamic)]/50 text-xs font-bold text-[var(--accent-color-dynamic)] dark:text-[var(--accent-color-dynamic)] font-valorant tracking-widest">
                  {feature.xp}
                </div>

                {/* Feature Badge - Replaced with tech decoration */}
                <div className="absolute top-4 left-4 text-[10px] font-bold tracking-widest text-primary/30 pointer-events-none select-none font-valorant">
                  {"// "}
                  {feature.badge}
                </div>

                <div
                  className={`w-16 h-16 flex items-center justify-center mb-6 ${feature.bg} relative z-10`}
                  style={{
                    clipPath:
                      "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
                  }}
                >
                  <feature.icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white font-valorant uppercase tracking-wide relative z-10">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed relative z-10 pl-4 border-l-2 border-primary/20">
                  {feature.description}
                </p>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              </div>
            </TiltCard>
          ))}
        </div>

        {/* Achievement Showcase */}
        <div ref={achievementRef} className="mt-16 text-center">
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-gradient-to-r from-[var(--accent-color-dynamic)]/20 to-[var(--accent-color-dynamic)]/20 border border-[var(--accent-color-dynamic)]/30 shadow-[0_0_30px_rgba(234,179,8,0.2)] hover:shadow-[0_0_50px_rgba(234,179,8,0.4)] transition-shadow duration-500">
            <Award className="w-5 h-5 text-[var(--accent-color-dynamic)] animate-bounce" />
            <span className="text-sm font-semibold text-[var(--accent-color-dynamic)] dark:text-[var(--accent-color-dynamic)]">
              🎉 Unlock 50+ unique achievements as you study!
            </span>
            <Award className="w-5 h-5 text-[var(--accent-color-dynamic)] animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
