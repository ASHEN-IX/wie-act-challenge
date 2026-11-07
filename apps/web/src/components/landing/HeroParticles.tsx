"use client";

import { forwardRef } from "react";

/**
 * HeroParticles renders the glowing particles travelling along the orbital paths
 * as well as celestial sparkles and star points.
 */
export const HeroParticles = forwardRef<HTMLDivElement>(function HeroParticles(
  _props,
  ref,
) {
  return (
    <div ref={ref} className="hero-particles-layer" aria-hidden="true">
      {/* Primary glowing bead on the outer violet/cyan orbit */}
      <div className="orbit-bead bead-violet js-hero-particle-violet">
        <span className="bead-core" />
        <span className="bead-halo" />
      </div>

      {/* Secondary glowing bead on the inner cyan orbit moving opposite */}
      <div className="orbit-bead bead-cyan js-hero-particle-cyan">
        <span className="bead-core" />
        <span className="bead-halo" />
      </div>

      {/* Tertiary micro-bead trailing the main arc */}
      <div className="orbit-bead bead-accent js-hero-particle-accent">
        <span className="bead-core" />
      </div>

      {/* Iconic Sparkles from brand design */}
      <span className="sparkle spark-a js-sparkle" aria-hidden="true">
        ✦
      </span>
      <span className="sparkle spark-b js-sparkle" aria-hidden="true">
        ✧
      </span>
      <span className="sparkle spark-c js-sparkle" aria-hidden="true">
        ✦
      </span>
    </div>
  );
});
