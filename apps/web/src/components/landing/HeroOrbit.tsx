"use client";

import { forwardRef } from "react";

interface HeroOrbitProps {
  glowOpacity?: number;
}

/**
 * HeroOrbit renders the dual-orbital arcs (foreground violet and background cyan)
 * as independent visual layers separated from the mascot.
 */
export const HeroOrbit = forwardRef<HTMLDivElement, HeroOrbitProps>(
  function HeroOrbit({ glowOpacity = 1 }, ref) {
    return (
      <div ref={ref} className="hero-orbits-container" aria-hidden="true">
        {/* Background orbit: tilted cyan/violet elliptical arc passing behind mascot */}
        <div className="hero-orbit inner js-hero-orbit-inner">
          <svg
            className="orbit-svg orbit-svg-inner"
            viewBox="0 0 590 430"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="295"
              cy="215"
              rx="285"
              ry="205"
              stroke="url(#inner-orbit-grad)"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              opacity="0.65"
            />
            <defs>
              <linearGradient
                id="inner-orbit-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#65e4ff" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#9b59fc" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#55ddff" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Foreground orbit: tilted violet/cyan orbital arc passing in front of mascot */}
        <div className="hero-orbit outer js-hero-orbit">
          <div
            className="orbit-glow-aura js-orbit-glow"
            style={{ opacity: glowOpacity }}
          />
          <svg
            className="orbit-svg orbit-svg-outer"
            viewBox="0 0 640 250"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="320"
              cy="125"
              rx="315"
              ry="120"
              stroke="url(#outer-orbit-grad)"
              strokeWidth="3.5"
            />
            <defs>
              <linearGradient
                id="outer-orbit-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#ca62ff" />
                <stop offset="35%" stopColor="#ba7df7" />
                <stop offset="70%" stopColor="#65e4ff" />
                <stop offset="100%" stopColor="#40e4fa" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  },
);
