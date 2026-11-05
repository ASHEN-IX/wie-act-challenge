"use client";

import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const icons = [UsersRound, Sparkles, BookOpen, ChartNoAxesColumnIncreasing];

const items = [
  {
    title: "Study Circles",
    copy: "Study together, exchange ideas, and solve problems as a team.",
  },
  {
    title: "AI Learning Guide",
    copy: "Get personalized explanations, practice, and guidance when you need it.",
  },
  {
    title: "Course Resources",
    copy: "Organize notes, slides, exercises, and shared learning materials.",
  },
  {
    title: "Track Your Progress",
    copy: "Review your goals and understand where your knowledge is growing.",
  },
];

export function FeatureGrid() {
  const reduced = useReducedMotion();

  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="feature-grid">
          {items.map(({ title, copy }, i) => {
            const Icon = icons[i];
            return (
              <motion.article
                key={title}
                className="feature-tile"
                initial={reduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                whileHover={reduced ? undefined : { y: -5 }}
              >
                <div className="feature-icon">
                  <Icon size={30} strokeWidth={1.8} />
                </div>
                <h2>{title}</h2>
                <p>{copy}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
