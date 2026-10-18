import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "@/navigation";
import {
  ArrowRight,
  Sparkles,
  Trophy,
  Star,
  Zap,
  Gift,
  Crown,
  Rocket,
} from "lucide-react";
import TiltCard from "@/components/ui/TiltCard";

gsap.registerPlugin(ScrollTrigger);

const CTASection = () => {
  const containerRef = useRef<any>(null);
  const cardRef = useRef<any>(null);
  const badgeRef = useRef<any>(null);
  const titleRef = useRef<any>(null);
  const descriptionRef = useRef<any>(null);
  const rewardsRef = useRef<any>(null);
  const ctaButtonRef = useRef<any>(null);
  const footerRef = useRef<any>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 60%",
        },
      });

      tl.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" },
      )
        .fromTo(
          badgeRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.7)" },
          "-=0.4",
        )
        .fromTo(
          titleRef.current,
          { opacity: 0, y: 30 },
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
          rewardsRef.current.children,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
          },
          "-=0.4",
        )
        .fromTo(
          ctaButtonRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" },
          "-=0.2",
        )
        .fromTo(
          footerRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.8 },
          "-=0.4",
        );

      // Continuous floating animation for badge icons
      gsap.to(".floating-icon-1", {
        rotation: 10,
        y: -5,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".floating-icon-2", {
        rotation: -10,
        y: 5,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 0.5,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const rewards = [
    {
      icon: Star,
      text: "Earn 500 XP on signup",
      color: "text-[var(--accent-color-dynamic)]",
      glow: "shadow-yellow-500/50",
    },
    {
      icon: Trophy,
      text: "Unlock welcome badge",
      color: "text-primary",
      glow: "shadow-primary/50",
    },
    {
      icon: Gift,
      text: "Get free study templates",
      color: "text-[var(--accent-color-dynamic)]",
      glow: "shadow-[0_0_18px_var(--accent-color-dynamic-shadow-50)]",
    },
    {
      icon: Zap,
      text: "Start your first quest",
      color: "text-primary",
      glow: "shadow-primary/50",
    },
  ];

  return (
    <section
      ref={containerRef}
      className="relative min-h-[calc(100vh-5rem)] w-full px-0 overflow-hidden flex items-center overflow-x-hidden"
    >
      {/* Light rays removed */}

      <div className="relative w-full z-10">
        <TiltCard className="relative overflow-hidden group p-0 md:p-0 text-center w-full rect-card min-h-[80vh] flex items-center !bg-transparent !border-transparent !shadow-none !backdrop-blur-none">
          <div
            ref={cardRef}
            className="w-full flex flex-col justify-center items-center h-full"
          >
            {/* Enhanced Badge */}
            <div
              ref={badgeRef}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-primary/20 to-accent-purple/20 border border-primary/30 mb-8 shadow-lg transition-transform hover:scale-105 duration-300"
            >
              <div className="floating-icon-1">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <span className="font-bold text-primary tracking-wide uppercase text-sm">
                🎮 Ready to Level Up?
              </span>
              <div className="floating-icon-2">
                <Trophy className="w-5 h-5 text-primary animate-pulse" />
              </div>
            </div>

            {/* Enhanced Title */}
            <h2
              ref={titleRef}
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-gray-900 dark:text-white font-display tracking-tight cta-title"
            >
              Join the Study <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)] animate-pulse">
                Revolution
              </span>
            </h2>
            {/* Enhanced Description */}
            <p
              ref={descriptionRef}
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Start your gamified learning journey today and unlock your full
              academic potential. Join thousands of students already leveling up
              their grades!
            </p>

            {/* Enhanced Reward Grid */}
            <div
              ref={rewardsRef}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 max-w-5xl mx-auto"
            >
              {rewards.map((reward: any, index: any) => {
                const Icon = reward.icon;
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center p-6 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 hover:border-white/40 transition-all duration-300 group/reward hover:-translate-y-1 hover:scale-105 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]"
                  >
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/10 mb-4 ${reward.glow} transition-transform duration-500 group-hover/reward:rotate-12`}
                    >
                      <Icon className={`w-8 h-8 ${reward.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white text-center leading-tight">
                      {reward.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Enhanced CTA Button */}
            <div ref={ctaButtonRef} className="mb-8">
              <Link to="/register">
                <button className="group relative inline-flex items-center px-10 py-5 text-xl font-bold text-white valo-btn bg-primary hover:bg-primary/90 shadow-2xl hover:shadow-primary/50 transition-all duration-500 overflow-hidden transform hover:scale-105 active:scale-98">
                  {/* Button Background Animation */}
                  <div className="absolute inset-0 bg-primary/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

                  {/* Button Content */}
                  <div className="relative flex items-center">
                    <div className="floating-icon-1 mr-3">
                      <Zap className="w-6 h-6" />
                    </div>
                    <span>Start Free Trial</span>
                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </button>
              </Link>
            </div>

            {/* Enhanced Footer Text */}
            <div
              ref={footerRef}
              className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-500 dark:text-gray-400"
            >
              <span className="flex items-center gap-2 transition-transform hover:scale-105">
                <Crown className="w-4 h-4 text-[var(--accent-color-dynamic)]" />
                No credit card required
              </span>
              <span className="flex items-center gap-2 transition-transform hover:scale-105">
                <Rocket className="w-4 h-4 text-primary" />
                14-day free trial
              </span>
              <span className="flex items-center gap-2 transition-transform hover:scale-105">
                <Star className="w-4 h-4 text-primary" />
                Cancel anytime
              </span>
            </div>
          </div>
        </TiltCard>
      </div>
    </section>
  );
};

export default CTASection;
