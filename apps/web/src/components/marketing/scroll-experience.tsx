"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { motion, useScroll } from "motion/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Motion owns element entrances; GSAP owns scroll-parallax only (js-* targets). */
export function ScrollExperience({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        "(min-width: 801px) and (prefers-reduced-motion: no-preference)",
        () => {
          gsap.to(".js-hero-orbit", {
            rotation: 31,
            scale: 1.13,
            ease: "none",
            scrollTrigger: {
              trigger: ".hero-section",
              start: "top top",
              end: "bottom top",
              scrub: 1.3,
            },
          });
          gsap.fromTo(
            ".js-laptop-stage",
            { y: 48, opacity: 0.75 },
            {
              y: -8,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: ".how-section",
                start: "top 85%",
                end: "bottom 40%",
                scrub: 1,
              },
            },
          );
          gsap.to(".js-laptop-aura", {
            scale: 1.14,
            opacity: 0.85,
            ease: "none",
            scrollTrigger: {
              trigger: ".how-section",
              start: "top 75%",
              end: "bottom top",
              scrub: 1,
            },
          });
          gsap.fromTo(
            ".js-evolution-fill",
            { scaleX: 0 },
            {
              scaleX: 1,
              transformOrigin: "left center",
              ease: "none",
              scrollTrigger: {
                trigger: ".evolution-section",
                start: "top 70%",
                end: "bottom 78%",
                scrub: 0.4,
              },
            },
          );
          gsap.to(".js-journey-planet", {
            xPercent: 7,
            yPercent: -10,
            ease: "none",
            scrollTrigger: {
              trigger: ".journey-outer",
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          });
        },
      );

      return () => media.revert();
    },
    { scope },
  );

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
