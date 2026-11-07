"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/components/animations/useReducedMotion";

type Variant = "up" | "left" | "right" | "scale" | "fade";

const offsets: Record<Variant, { x?: number; y?: number; scale?: number }> = {
  up: { y: 24 },
  left: { x: -24 },
  right: { x: 24 },
  scale: { y: 28, scale: 0.96 },
  fade: {},
};

export function ScrollReveal({
  children,
  variant = "up",
  delay = 0,
  duration = 0.6,
  className,
  as = "div",
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
  as?: "div" | "article" | "section" | "span";
}) {
  const reduced = useReducedMotion();
  const from = offsets[variant];
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={reduced ? false : { opacity: 0, ...from }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{
        duration,
        delay,
        ease: [0.2, 1, 0.33, 1],
      }}
    >
      {children}
    </Component>
  );
}
