"use client";

import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { features } from "@/lib/brand";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

const icons = [UsersRound, Sparkles, BookOpen, ChartNoAxesColumnIncreasing];

export function FeaturesSection() {
  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="feature-grid">
          {features.map(({ title, copy }, i) => {
            const Icon = icons[i];
            return (
              <ScrollReveal
                key={title}
                as="article"
                variant="up"
                delay={i * 0.08}
                duration={0.55}
                className="feature-tile"
              >
                <div className="feature-icon">
                  <Icon size={28} strokeWidth={1.8} />
                </div>
                <h2>{title}</h2>
                <p>{copy}</p>
                <div className="feature-border-glow" aria-hidden="true" />
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
