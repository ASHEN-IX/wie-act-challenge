/**
 * Cinematic Scroll Animation Configuration
 * Nova Orbit Design System — deep navy, electric violet, luminous cyan
 */

export const SCROLL_CONFIG = {
  breakpoints: {
    mobile: "(max-width: 800px)",
    desktop: "(min-width: 801px)",
    reducedMotion: "(prefers-reduced-motion: reduce)",
    activeDesktop: "(min-width: 801px) and (prefers-reduced-motion: no-preference)",
  },
  easings: {
    cinematic: "power2.out",
    smoothScrub: "none",
    gentleBounce: "back.out(1.2)",
    cubicEntrance: [0.2, 1, 0.33, 1] as [number, number, number, number],
  },
  hero: {
    pinDistance: "+=1100",
    scrub: 0.8,
    // Phase 1 (0 - 0.25): Orbit activation
    orbitActivationEnd: 0.25,
    violetOrbitRot1: 18,
    cyanOrbitRot1: -16,
    nardouchFloat1: -14,
    // Phase 2 (0.25 - 0.65): Orbital motion
    orbitalMotionEnd: 0.65,
    violetOrbitRot2: 32,
    cyanOrbitRot2: -28,
    platformShiftY: -22,
    backPlanetParallaxY: -45,
    starsParallaxY: -25,
    // Phase 3 (0.65 - 1.0): Transition release
    heroExitFadeStart: 0.65,
    heroExitShiftY: -35,
  },
  evolution: {
    pinDistance: "+=2200",
    scrub: 0.5,
    stages: [
      { id: "baby", start: 0, end: 0.2, name: "Baby" },
      { id: "learner", start: 0.2, end: 0.4, name: "Learner" },
      { id: "explorer", start: 0.4, end: 0.6, name: "Explorer" },
      { id: "expert", start: 0.6, end: 0.8, name: "Expert" },
      { id: "graduate", start: 0.8, end: 1.0, name: "Graduate" },
    ],
  },
  laptop: {
    perspectiveStart: { rotateX: 10, rotateY: -7, y: 55, opacity: 0.7 },
    perspectiveRest: { rotateX: 2, rotateY: -4, y: 0, opacity: 1 },
    scrub: 1,
  },
} as const;
