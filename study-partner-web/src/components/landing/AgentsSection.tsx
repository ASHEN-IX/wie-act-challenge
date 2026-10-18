import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import TiltCard from "@/components/ui/TiltCard";
import { Bot, Brain, Clock, BarChart } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const agents = [
  {
    icon: Bot,
    name: "Orchestrator Agent",
    role: "System Manager",
    description:
      "Coordinates all other agents and manages complex workflows to ensure seamless learning experiences.",
    color: "text-primary",
    gradient: "from-primary/20 to-neutral-500/20",
  },
  {
    icon: Brain,
    name: "Coach Agent",
    role: "Personal Tutor",
    description:
      "Provides real-time guidance, answers questions, and adapts teaching style to your needs.",
    color: "text-primary",
    gradient: "from-primary/20 to-neutral-500/20",
  },
  {
    icon: Clock,
    name: "Scheduler Agent",
    role: "Time Manager",
    description:
      "Optimizes your study schedule based on your availability, energy levels, and deadlines.",
    color: "text-primary",
    gradient: "from-primary/20 to-neutral-500/20",
  },
  {
    icon: BarChart,
    name: "Planner Agent",
    role: "Strategy Expert",
    description:
      "Breaks down courses into manageable tasks and creates long-term learning roadmaps.",
    color: "text-primary",
    gradient: "from-primary/20 to-neutral-500/20",
  },
];

const AgentsSection = () => {
  const containerRef = useRef<any>(null);
  const headerRef = useRef<any>(null);
  const cardsRef = useRef<any>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header Animation
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 30 },
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
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <div ref={headerRef} className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white font-valorant uppercase tracking-tighter">
            Multi-Agent <span className="text-outline">Intelligence</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto font-medium">
            A team of specialized AI agents working together to power your
            learning journey.
          </p>
        </div>

        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {agents.map((agent: any, index: any) => (
            <div key={index} className="h-full">
              <TiltCard className="h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
                {/* Glossy sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-50 pointer-events-none" />

                <div className="flex flex-col items-center text-center relative z-10 p-6 pt-10 h-full">
                  <div
                    className={`p-4 mb-6 bg-gradient-to-br ${agent.gradient} relative overflow-hidden transition-transform duration-500 hover:rotate-12`}
                    style={{
                      clipPath:
                        "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                    }}
                  >
                    <agent.icon className={`w-8 h-8 ${agent.color}`} />
                    {/* Inner detail line */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/20" />
                  </div>

                  <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-white font-valorant uppercase tracking-wider">
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${agent.color}`}
                    >
                      {agent.role}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
                  </div>

                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed border-t border-primary/10 pt-4 w-full mt-auto">
                    {agent.description}
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

export default AgentsSection;
