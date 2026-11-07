"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useScroll } from "motion/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * ScrollExperience provides top-level reading progress and ensures
 * GSAP ScrollTrigger measurements are synchronized across responsive layouts.
 */
export function ScrollExperience({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    // Recalculate ScrollTrigger measurements after DOM is fully painted and images load
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 400);

    const handleResize = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div ref={scope} className="scroll-layer">
      <motion.div
        className="reading-progress"
        style={{ scaleX: scrollYProgress, originX: 0 }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
