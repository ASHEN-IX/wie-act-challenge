"use client";

import Image from "next/image";
import { useRef } from "react";
import { GraduationCap } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { stages, nardouchImage } from "@/lib/brand";
import { useReducedMotion } from "@/components/animations/useReducedMotion";
import { SCROLL_CONFIG } from "@/lib/animations/scroll-config";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function NardouchEvolution() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackFillRef = useRef<HTMLDivElement>(null);
  const celebrationRef = useRef<HTMLDivElement>(null);

  const charRefs = useRef<(HTMLDivElement | null)[]>([]);
  const platformRefs = useRef<(HTMLDivElement | null)[]>([]);
  const arrowRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const reduced = useReducedMotion();

  useGSAP(
    () => {
      // Reduced motion: Show all 5 characters, platforms, arrows & nodes immediately without pinning
      if (reduced) {
        if (trackFillRef.current) {
          gsap.set(trackFillRef.current, { scaleX: 1 });
        }
        charRefs.current.forEach((char) => {
          if (char) gsap.set(char, { opacity: 1, y: 0, scale: 1 });
        });
        platformRefs.current.forEach((plat) => {
          if (plat) gsap.set(plat, { opacity: 1 });
        });
        arrowRefs.current.forEach((arrow) => {
          if (arrow) gsap.set(arrow, { opacity: 1 });
        });
        nodeRefs.current.forEach((node, i) => {
          if (node) {
            if (i >= 3) {
              gsap.set(node, {
                borderColor: "#65e4ff",
                boxShadow: "0 0 16px #65e4ff, 0 0 25px rgba(101, 228, 255, 0.7)",
              });
            } else {
              gsap.set(node, {
                borderColor: "#ca62ff",
                boxShadow: "0 0 14px #ca62ff, 0 0 22px rgba(202, 98, 255, 0.6)",
              });
            }
          }
        });
        if (celebrationRef.current) {
          gsap.set(celebrationRef.current, { opacity: 1, scale: 1 });
        }
        return;
      }

      const mm = gsap.matchMedia();

      // Desktop layout: Pinned scrubbed progressive reveal
      mm.add(SCROLL_CONFIG.breakpoints.activeDesktop, () => {
        // Track fill starts at 0%
        if (trackFillRef.current) {
          gsap.set(trackFillRef.current, { scaleX: 0, transformOrigin: "left center" });
        }

        // Baby (stage 0) starts visible and active
        if (charRefs.current[0]) {
          gsap.set(charRefs.current[0], { opacity: 1, y: 0, scale: 1 });
        }
        if (platformRefs.current[0]) {
          gsap.set(platformRefs.current[0], { opacity: 1 });
        }
        if (nodeRefs.current[0]) {
          gsap.set(nodeRefs.current[0], {
            borderColor: "#ca62ff",
            boxShadow: "0 0 14px #ca62ff, 0 0 22px rgba(202, 98, 255, 0.6)",
          });
        }

        // Arrows 0..3 start hidden
        arrowRefs.current.forEach((arrow) => {
          if (arrow) gsap.set(arrow, { opacity: 0 });
        });

        // Stages 1..4 (Learner, Explorer, Expert, Graduate) start hidden
        for (let i = 1; i < stages.length; i++) {
          if (charRefs.current[i]) {
            gsap.set(charRefs.current[i], { opacity: 0, y: 20, scale: 0.92 });
          }
          if (platformRefs.current[i]) {
            gsap.set(platformRefs.current[i], { opacity: 0 });
          }
          if (nodeRefs.current[i]) {
            gsap.set(nodeRefs.current[i], {
              borderColor: "#4d2e82",
              boxShadow: "0 0 6px rgba(77, 46, 130, 0.3)",
            });
          }
        }

        if (celebrationRef.current) {
          gsap.set(celebrationRef.current, { opacity: 0, scale: 0.8 });
        }

        // Single reversible GSAP scrub timeline
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: SCROLL_CONFIG.evolution.pinDistance,
            pin: true,
            scrub: SCROLL_CONFIG.evolution.scrub,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        // -------------------------------------------------------------
        // Phase 2: 20% - 40% -> Reveal Learner (stage 1)
        // -------------------------------------------------------------
        tl.to(
          trackFillRef.current,
          { scaleX: 0.25, ease: "none", duration: 0.15 },
          0.20,
        );
        if (arrowRefs.current[0]) {
          tl.to(arrowRefs.current[0], { opacity: 1, duration: 0.1 }, 0.20);
        }
        if (charRefs.current[1]) {
          tl.to(
            charRefs.current[1],
            { opacity: 1, y: 0, scale: 1, ease: "power1.out", duration: 0.12 },
            0.20,
          );
        }
        if (platformRefs.current[1]) {
          tl.to(platformRefs.current[1], { opacity: 1, duration: 0.12 }, 0.20);
        }
        if (nodeRefs.current[1]) {
          tl.to(
            nodeRefs.current[1],
            {
              borderColor: "#ca62ff",
              boxShadow: "0 0 14px #ca62ff, 0 0 22px rgba(202, 98, 255, 0.6)",
              duration: 0.08,
            },
            0.26,
          );
        }

        // -------------------------------------------------------------
        // Phase 3: 40% - 60% -> Reveal Explorer (stage 2)
        // -------------------------------------------------------------
        tl.to(
          trackFillRef.current,
          { scaleX: 0.50, ease: "none", duration: 0.15 },
          0.40,
        );
        if (arrowRefs.current[1]) {
          tl.to(arrowRefs.current[1], { opacity: 1, duration: 0.1 }, 0.40);
        }
        if (charRefs.current[2]) {
          tl.to(
            charRefs.current[2],
            { opacity: 1, y: 0, scale: 1, ease: "power1.out", duration: 0.12 },
            0.40,
          );
        }
        if (platformRefs.current[2]) {
          tl.to(platformRefs.current[2], { opacity: 1, duration: 0.12 }, 0.40);
        }
        if (nodeRefs.current[2]) {
          tl.to(
            nodeRefs.current[2],
            {
              borderColor: "#ca62ff",
              boxShadow: "0 0 14px #ca62ff, 0 0 22px rgba(202, 98, 255, 0.6)",
              duration: 0.08,
            },
            0.46,
          );
        }

        // -------------------------------------------------------------
        // Phase 4: 60% - 80% -> Reveal Expert (stage 3)
        // -------------------------------------------------------------
        tl.to(
          trackFillRef.current,
          { scaleX: 0.75, ease: "none", duration: 0.15 },
          0.60,
        );
        if (arrowRefs.current[2]) {
          tl.to(arrowRefs.current[2], { opacity: 1, duration: 0.1 }, 0.60);
        }
        if (charRefs.current[3]) {
          tl.to(
            charRefs.current[3],
            { opacity: 1, y: 0, scale: 1, ease: "power1.out", duration: 0.12 },
            0.60,
          );
        }
        if (platformRefs.current[3]) {
          tl.to(platformRefs.current[3], { opacity: 1, duration: 0.12 }, 0.60);
        }
        if (nodeRefs.current[3]) {
          tl.to(
            nodeRefs.current[3],
            {
              borderColor: "#65e4ff",
              boxShadow: "0 0 16px #65e4ff, 0 0 25px rgba(101, 228, 255, 0.7)",
              duration: 0.08,
            },
            0.66,
          );
        }

        // -------------------------------------------------------------
        // Phase 5: 80% - 100% -> Reveal Graduate (stage 4) & Finale
        // -------------------------------------------------------------
        tl.to(
          trackFillRef.current,
          { scaleX: 1.00, ease: "none", duration: 0.12 },
          0.80,
        );
        if (arrowRefs.current[3]) {
          tl.to(arrowRefs.current[3], { opacity: 1, duration: 0.1 }, 0.80);
        }
        if (charRefs.current[4]) {
          tl.to(
            charRefs.current[4],
            { opacity: 1, y: 0, scale: 1, ease: "power1.out", duration: 0.12 },
            0.80,
          );
        }
        if (platformRefs.current[4]) {
          tl.to(
            platformRefs.current[4],
            {
              opacity: 1,
              duration: 0.12,
            },
            0.80,
          );
        }
        if (nodeRefs.current[4]) {
          tl.to(
            nodeRefs.current[4],
            {
              borderColor: "#65e4ff",
              boxShadow: "0 0 20px #65e4ff, 0 0 35px #ca62ff",
              duration: 0.08,
            },
            0.86,
          );
        }
        if (celebrationRef.current) {
          tl.to(
            celebrationRef.current,
            { opacity: 1, scale: 1.05, ease: "power2.out", duration: 0.1 },
            0.86,
          );
        }

        // Hold finale state briefly before unpinning
        tl.to({}, { duration: 0.06 }, 0.94);
      });

      // Mobile layout (< 768px): Show all content clearly without pinning
      mm.add("(max-width: 767px)", () => {
        if (trackFillRef.current) {
          gsap.set(trackFillRef.current, { scaleX: 1 });
        }
        charRefs.current.forEach((char) => {
          if (char) gsap.set(char, { opacity: 1, y: 0, scale: 1 });
        });
        platformRefs.current.forEach((plat) => {
          if (plat) gsap.set(plat, { opacity: 1 });
        });
        arrowRefs.current.forEach((arrow) => {
          if (arrow) gsap.set(arrow, { opacity: 1 });
        });
        nodeRefs.current.forEach((node, i) => {
          if (node) {
            if (i >= 3) {
              gsap.set(node, {
                borderColor: "#65e4ff",
                boxShadow: "0 0 16px #65e4ff, 0 0 25px rgba(101, 228, 255, 0.7)",
              });
            } else {
              gsap.set(node, {
                borderColor: "#ca62ff",
                boxShadow: "0 0 14px #ca62ff, 0 0 22px rgba(202, 98, 255, 0.6)",
              });
            }
          }
        });
        if (celebrationRef.current) {
          gsap.set(celebrationRef.current, { opacity: 1, scale: 1 });
        }
      });

      return () => {
        mm.revert();
      };
    },
    { scope: sectionRef, dependencies: [reduced] },
  );

  return (
    <section className="evolution-section" id="nardouch" ref={sectionRef}>
      <div className="container evolution-grid">
        {/* Left Column: Heading and Brand Description */}
        <div className="evolution-copy">
          <span className="section-pill">
            <GraduationCap size={16} /> MEET NARDOUCH
          </span>
          <h2>
            Meet <span>Nardouch.</span>
          </h2>
          <h3>Your companion from day one to graduation.</h3>
          <p>
            Every subject begins with a little nerd. As you complete courses,
            Nardouch grows alongside you — learning, evolving, and celebrating
            every milestone.
          </p>
          <small>
            Complete every lesson and pass the course checks to unlock Graduate
            Nardouch.
          </small>
        </div>

        {/* Right Column: 5 Horizontal Evolution Stages + Timeline */}
        <div className="evolution-art">
          <div className="evolution-cast">
            {stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`evolution-col stage-${i + 1} stage-${stage.id}`}
              >
                <div
                  ref={(el) => {
                    charRefs.current[i] = el;
                  }}
                  className={`evolution-character stage-${i + 1} stage-${stage.id} ${
                    i === 0 ? "active is-revealed" : ""
                  }`}
                  data-stage={stage.id}
                >
                  {/* Mascot Image + Glowing Pedestal Platform */}
                  <div className="character-stage-pod">
                    <div
                      ref={(el) => {
                        platformRefs.current[i] = el;
                      }}
                      className={`character-platform ${i === 0 ? "active" : ""}`}
                      aria-hidden="true"
                    />
                    {stage.id === "graduate" && (
                      <div
                        ref={celebrationRef}
                        className="graduate-celebration-glow"
                        aria-hidden="true"
                      />
                    )}
                    <div className="character-image">
                      <Image
                        src={nardouchImage(stage.id)}
                        alt={`${stage.name} Nardouch`}
                        width={200}
                        height={200}
                        sizes="(max-width: 768px) 110px, 150px"
                        priority={i === 0}
                      />
                    </div>
                  </div>

                  {/* Stage Label */}
                  <span className="character-name">{stage.name}</span>
                </div>

                {/* Connecting Arrow between adjacent stages */}
                {i < stages.length - 1 && (
                  <span
                    ref={(el) => {
                      arrowRefs.current[i] = el;
                    }}
                    className="evolution-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Horizontal Progress Track Connecting All 5 Stages */}
          <div className="evolution-track" aria-hidden="true">
            <div ref={trackFillRef} className="evolution-track-fill" />
            <div className="evolution-nodes">
              {stages.map((stage, i) => (
                <div
                  key={stage.id}
                  ref={(el) => {
                    nodeRefs.current[i] = el;
                  }}
                  className={`timeline-node node-${stage.id} ${
                    i === 0 ? "active-node" : ""
                  } ${i >= 3 ? "node-cyan" : "node-violet"}`}
                  style={{ left: `${(i / (stages.length - 1)) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default NardouchEvolution;
