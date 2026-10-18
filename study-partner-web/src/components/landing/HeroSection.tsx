import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ChevronRight,
  Sparkles,
  Trophy,
  Star,
  Zap,
  Target,
  Users,
  TrendingUp,
} from "lucide-react";
import { Link } from "@/navigation";
import TiltCard from "@/components/ui/TiltCard";
import DecryptedText from "@/components/ui/DecryptedText";

gsap.registerPlugin(ScrollTrigger);

const HeroSection = () => {
  const containerRef = useRef<any>(null);
  const badgeRef = useRef<any>(null);
  const titleRef = useRef<any>(null);
  const descriptionRef = useRef<any>(null);
  const buttonsRef = useRef<any>(null);
  const statsRef = useRef<any>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" },
      )
        .fromTo(
          titleRef.current,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
          "-=0.4",
        )
        .fromTo(
          descriptionRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
          "-=0.6",
        )
        .fromTo(
          buttonsRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
          "-=0.6",
        )
        .fromTo(
          statsRef.current.children,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
          },
          "-=0.4",
        );

      // Parallax effect on scroll
      gsap.to(titleRef.current, {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
        y: -50,
        // Removed opacity: 0 to prevent conflict with entrance animation
      });

      gsap.to(statsRef.current, {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 2,
        },
        y: -100,
        // Removed opacity fade out to be safe
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const stats = [
    {
      icon: Users,
      value: "10K+",
      label: "Active Learners",
      color: "text-primary",
    },
    {
      icon: Trophy,
      value: "50K+",
      label: "Achievements Earned",
      color: "text-[var(--accent-color-dynamic)]",
    },
    {
      icon: TrendingUp,
      value: "85%",
      label: "Success Rate",
      color: "text-[var(--accent-color-dynamic)]",
    },
    {
      icon: Star,
      value: "4.9/5",
      label: "User Rating",
      color: "text-[var(--accent-color-dynamic)]",
    },
  ];

  return (
    <section
      ref={containerRef}
      className="relative min-h-[calc(100vh-80px)] w-full flex items-center justify-center p-0 md:p-0 overflow-hidden overflow-x-hidden pt-0 mt-0"
    >
      <div className="relative w-full z-10 h-full flex items-center">
        <TiltCard className="w-full min-h-[80vh] p-0 !bg-transparent !border-transparent !shadow-none !backdrop-blur-none">
          <div className="relative z-10 text-center p-6 md:p-12 flex flex-col justify-center items-center h-full min-h-[80vh]">
            <div
              ref={badgeRef}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-background/40 backdrop-blur-md border border-primary/20 text-primary text-sm font-semibold mb-6 shadow-[0_4px_20px_var(--accent-color-dynamic-shadow-15)] ring-1 ring-white/10"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>🎮 Gamified Learning Experience</span>
              <Zap className="w-4 h-4 animate-pulse" />
            </div>

            <h1
              ref={titleRef}
              className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-12 font-display bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-primary to-gray-900 dark:from-white dark:via-primary dark:to-white"
            >
              Level Up Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)] animate-pulse">
                Study Game
              </span>
            </h1>

            <div
              ref={descriptionRef}
              className="text-lg md:text-2xl text-muted mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              <DecryptedText
                text="Level up your learning with AI-powered gamification, earn XP, unlock achievements, and turn studying into a fun, personalized adventure."
                animateOn="view"
                revealDirection="start"
                sequential={true}
                speed={50}
                maxIterations={10}
                useOriginalCharsOnly={false}
                encryptedClassName="text-primary"
              />
            </div>

            <div
              ref={buttonsRef}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
            >
              <Link to="/register">
                <button className="valo-btn inline-flex items-center bg-primary/90 backdrop-blur-md border border-white/20 hover:bg-primary text-white shadow-xl shadow-primary/20 rounded-xl px-8 py-4 transition-transform hover:scale-105 active:scale-95">
                  Start Your Journey <ChevronRight className="ml-3 w-6 h-6" />
                </button>
              </Link>
              <button className="valo-btn inline-flex items-center border border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10 text-foreground shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-xl px-8 py-4 transition-transform hover:scale-105 active:scale-95">
                <Target className="mr-2 w-6 h-6" />
                View Demo
              </button>
            </div>

            {/* Stats Grid */}
            <div
              ref={statsRef}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto mt-8"
            >
              {stats.map((stat: any, index: any) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={index}
                    className="text-center p-5 valo-card-sm !bg-background/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-white/5 transition-transform hover:-translate-y-1 hover:scale-105 duration-300"
                  >
                    <Icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1 font-valorant">
                      {stat.value}
                    </div>
                    <div className="text-xs uppercase tracking-wider font-bold text-muted">
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TiltCard>
      </div>
    </section>
  );
};

export default HeroSection;
