"use client";

import {
  ArrowRight,
  UsersRound,
  UserRoundPlus,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import { LaptopVideo } from "@/components/landing/LaptopVideo";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

const steps = [
  {
    id: "01",
    Icon: UserRoundPlus,
    title: "Set Up Your Space",
    copy: "Add your subjects, courses, and learning goals.",
  },
  {
    id: "02",
    Icon: UsersRound,
    title: "Learn & Collaborate",
    copy: "Join study circles, discuss ideas, and help one another learn.",
  },
  {
    id: "03",
    Icon: ChartNoAxesColumnIncreasing,
    title: "Track & Grow",
    copy: "Complete courses, strengthen skills, and graduate with Nardouch.",
  },
];

export function HowItWorks() {
  return (
    <section className="how-section" id="how-it-works">
      <div className="container">
        {/* Section Heading */}
        <ScrollReveal variant="up" className="how-heading">
          <h2>
            How <span>It Works</span>
          </h2>
          <p>A simple journey to better learning.</p>
        </ScrollReveal>

        <div className="how-grid">
          {/* 3 Step Indicators revealing sequentially */}
          <div className="how-steps">
            {steps.map(({ id, Icon, title, copy }, i) => (
              <ScrollReveal
                key={id}
                variant="left"
                delay={i * 0.12}
                duration={0.5}
                className="how-step"
              >
                <div className="how-step-icon">
                  <Icon size={32} strokeWidth={1.7} />
                </div>
                <span className="step-index">{id}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                {i < 2 && (
                  <ArrowRight
                    className="how-step-arrow"
                    size={22}
                    aria-hidden="true"
                  />
                )}
              </ScrollReveal>
            ))}
          </div>

          {/* Enhanced Laptop Video with perspective entrance */}
          <LaptopVideo />
        </div>
      </div>
    </section>
  );
}
