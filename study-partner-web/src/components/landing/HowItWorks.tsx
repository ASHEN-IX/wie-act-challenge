import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Upload, Calendar, BookOpen, TrendingUp } from "lucide-react";
import TiltCard from "@/components/ui/TiltCard";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    icon: Upload,
    title: "Upload Your Course",
    description:
      "Import your course materials and let AI analyze the content structure.",
  },
  {
    icon: Calendar,
    title: "Generate Study Plan",
    description:
      "Receive a personalized study schedule optimized for your goals and availability.",
  },
  {
    icon: BookOpen,
    title: "Study with AI Coach",
    description:
      "Engage in focused sessions with real-time guidance and adaptive support.",
  },
  {
    icon: TrendingUp,
    title: "Improve with Feedback",
    description:
      "Track progress and refine your learning strategy based on performance data.",
  },
];

const HowItWorks = () => {
  const containerRef = useRef<any>(null);
  const headerRef = useRef<any>(null);
  const stepsRef = useRef<any>(null);
  const lineRef = useRef<any>(null);

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

      // Line Drawing Animation
      gsap.fromTo(
        lineRef.current,
        { height: "0%" },
        {
          height: "100%",
          scrollTrigger: {
            trigger: stepsRef.current,
            start: "top 60%",
            end: "bottom 80%",
            scrub: 1,
          },
        },
      );

      // Steps Stagger Animation
      const stepElements = stepsRef.current.children;
      Array.from(stepElements).forEach((step: any, index: any) => {
        // Skip the line element which is absolute
        if (step.classList.contains("absolute")) return;

        gsap.fromTo(
          step,
          { opacity: 0, x: -50 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: step,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 px-4 relative">
      <div className="max-w-4xl mx-auto">
        <h2
          ref={headerRef}
          className="text-4xl md:text-6xl font-bold text-center mb-16 text-gray-900 dark:text-white font-valorant uppercase tracking-tighter"
        >
          How It <span className="text-outline">Works</span>
        </h2>
        <div ref={stepsRef} className="relative">
          {/* Timeline line - Tech style */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-primary/30 opacity-20"></div>
          <div
            ref={lineRef}
            className="absolute left-8 top-0 w-px bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)] z-0"
          ></div>

          {steps.map((step: any, index: any) => (
            <div key={index} className="flex items-start mb-16 relative">
              {/* Timeline Node - Diamond shape */}
              <div className="absolute left-8 top-8 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 border-primary rotate-45 z-10 shadow-[0_0_15px_rgba(var(--primary),0.5)] flex items-center justify-center transition-transform hover:scale-125 duration-300">
                <div className="w-1.5 h-1.5 bg-primary" />
              </div>

              <TiltCard className="w-full card-valorant ml-16 md:ml-20">
                <div className="p-6 md:p-8 relative w-full">
                  {/* Glossy sheen overlay */}
                  <div className="card-inner-sheen" />

                  <div className="flex items-center gap-4 mb-4 relative z-10 border-b border-primary/10 pb-4">
                    <div
                      className="p-3 bg-primary/5 border border-primary/20 relative"
                      style={{
                        clipPath:
                          "polygon(0 0, 100% 0, 100% 100%, 20% 100%, 0 80%)",
                      }}
                    >
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-valorant uppercase tracking-wide howitworks-title">
                      {"// "}
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-muted leading-relaxed text-lg relative z-10 font-medium">
                    {step.description}
                  </p>
                </div>
              </TiltCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
