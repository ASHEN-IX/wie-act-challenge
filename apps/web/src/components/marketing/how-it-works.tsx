"use client";

import {
  ArrowRight,
  UsersRound,
  UserRoundPlus,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { LaptopVideo } from "@/components/marketing/laptop-video";

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
  const reduced = useReducedMotion();

  return (
    <section className="how-section" id="how-it-works">
      <div className="container">
        <motion.div
          className="how-heading"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2>
            How <span>It Works</span>
          </h2>
          <p>A simple journey to better learning.</p>
        </motion.div>
        <div className="how-grid">
          <div className="how-steps">
            {steps.map(({ id, Icon, title, copy }, i) => (
              <motion.div
                className="how-step"
                key={id}
                initial={reduced ? false : { opacity: 0, x: -22 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
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
              </motion.div>
            ))}
          </div>
          <LaptopVideo />
        </div>
      </div>
    </section>
  );
}
