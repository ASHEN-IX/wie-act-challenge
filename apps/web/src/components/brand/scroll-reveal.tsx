"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Variant = "up" | "left" | "scale";

const offsets: Record<Variant, { x?: number; y?: number; scale?: number }> = {
  up: { y: 24 },
  left: { x: -22 },
  scale: { y: 32, scale: 0.97 },
};

/** Shared whileInView reveal so every marketing section enters the same way. */
export function ScrollReveal({
  children,
  variant = "up",
  delay = 0,
  duration = 0.55,
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const from = offsets[variant];

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, ...from }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration, delay, ease: [0.2, 1, 0.33, 1] }}
    >
      {children}
    </motion.div>
  );
}
