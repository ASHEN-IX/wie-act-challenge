"use client";

import { useRef } from "react";
import Image from "next/image";
import { nardouchImage } from "@/lib/brand";
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  GraduationCap,
  UsersRound,
  BookOpenText,
  BrainCircuit,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HeroOrbit } from "@/components/landing/HeroOrbit";
import { HeroParticles } from "@/components/landing/HeroParticles";
import { useReducedMotion } from "@/components/animations/useReducedMotion";
import { SCROLL_CONFIG } from "@/lib/animations/scroll-config";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(SCROLL_CONFIG.breakpoints.activeDesktop, () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: SCROLL_CONFIG.hero.pinDistance,
            pin: true,
            scrub: SCROLL_CONFIG.hero.scrub,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        // Phase 1 (0 -> 0.25): Orbit activation
        tl.to(
          ".js-hero-orbit",
          {
            rotation: SCROLL_CONFIG.hero.violetOrbitRot1,
            scale: 1.04,
            ease: "power1.out",
            duration: 0.25,
          },
          0,
        )
          .to(
            ".js-hero-orbit-inner",
            {
              rotation: SCROLL_CONFIG.hero.cyanOrbitRot1,
              scale: 1.03,
              ease: "power1.out",
              duration: 0.25,
            },
            0,
          )
          .to(
            ".js-orbit-glow",
            {
              opacity: 1,
              scale: 1.15,
              ease: "power1.out",
              duration: 0.25,
            },
            0,
          )
          .to(
            ".js-hero-nardouch",
            {
              y: SCROLL_CONFIG.hero.nardouchFloat1,
              ease: "power1.out",
              duration: 0.25,
            },
            0,
          )
          .to(
            ".js-hero-particle-violet",
            {
              x: 50,
              y: -22,
              scale: 1.25,
              ease: "none",
              duration: 0.25,
            },
            0,
          )
          .to(
            ".js-hero-particle-cyan",
            {
              x: -45,
              y: 18,
              scale: 1.2,
              ease: "none",
              duration: 0.25,
            },
            0,
          );

        // Phase 2 (0.25 -> 0.65): Orbital motion
        tl.to(
          ".js-hero-orbit",
          {
            rotation: SCROLL_CONFIG.hero.violetOrbitRot2,
            scale: 1.08,
            ease: "none",
            duration: 0.4,
          },
          0.25,
        )
          .to(
            ".js-hero-orbit-inner",
            {
              rotation: SCROLL_CONFIG.hero.cyanOrbitRot2,
              scale: 1.06,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-hero-nardouch",
            {
              y: SCROLL_CONFIG.hero.platformShiftY,
              scale: 1.02,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-hero-planet",
            {
              yPercent: -18,
              xPercent: 5,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-hero-stars",
            {
              y: SCROLL_CONFIG.hero.starsParallaxY,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-hero-particle-violet",
            {
              x: 105,
              y: -38,
              scale: 1.35,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-hero-particle-cyan",
            {
              x: -95,
              y: 35,
              scale: 1.3,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-note-top",
            {
              y: -16,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          )
          .to(
            ".js-note-bottom",
            {
              y: 14,
              ease: "none",
              duration: 0.4,
            },
            0.25,
          );

        // Phase 3 (0.65 -> 1.0): Transition release
        tl.to(
          ".js-hero-copy",
          {
            opacity: 0,
            y: SCROLL_CONFIG.hero.heroExitShiftY,
            ease: "power2.in",
            duration: 0.35,
          },
          0.65,
        ).to(
          [".js-hero-art", ".js-hero-planet", ".js-hero-haze"],
          {
            opacity: 0,
            y: -50,
            scale: 0.94,
            ease: "power2.in",
            duration: 0.35,
          },
          0.65,
        );
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section id="home" className="hero-section" ref={sectionRef}>
      {/* Background Environment Layers */}
      <div className="stars js-hero-stars" aria-hidden="true" />
      <div className="hero-back-planet js-hero-planet" aria-hidden="true" />
      <div className="hero-orbital-haze js-hero-haze" aria-hidden="true" />

      <div className="container hero-grid">
        {/* Left Side: Editorial & CTAs */}
        <div className="hero-copy js-hero-copy">
          <div className="hero-eyebrow">
            <Sparkles size={16} /> THE FUTURE OF PEER LEARNING
          </div>
          <h1>
            Learn Together.
            <br />
            <span className="gradient-text">Grow Further.</span>
          </h1>
          <p>
            The space for curious university minds. Study with your peers, get
            AI guidance, and turn every course into a shared breakthrough.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#features">
              Explore Noveris <ArrowRight size={17} />
            </a>
            <a className="btn btn-secondary" href="#how-it-works">
              <PlayCircle size={18} /> See How It Works
            </a>
          </div>
          <div className="hero-points">
            <span>
              <UsersRound size={19} /> Peer-led learning
            </span>
            <span>
              <BrainCircuit size={19} /> AI-guided study
            </span>
            <span>
              <GraduationCap size={19} /> University-ready
            </span>
          </div>
        </div>

        {/* Right Side: Orbital Art & Mascot */}
        <div
          className="hero-art js-hero-art"
          aria-label="Nardouch, a nerdy AI learning companion, sitting on a floating platform with a laptop and glowing orbital rings"
        >
          <div className="hero-luminance" aria-hidden="true" />

          {/* Independent Orbital Arcs Layer */}
          <HeroOrbit />

          {/* Independent Particles & Sparkles Layer */}
          <HeroParticles />

          {/* Mascot Layer: sitting on floating platform */}
          <div
            className={`hero-nardouch js-hero-nardouch ${
              reduced ? "reduced-motion" : ""
            }`}
          >
            <Image
              src={nardouchImage("hero")}
              alt="Nardouch smiling at a laptop, wearing big nerd glasses and purple headphones"
              fill
              priority
              quality={90}
              sizes="(max-width: 800px) 100vw, 650px"
            />
          </div>

          {/* Ambient Study Notes */}
          <div className="floating-study-note note-top js-note-top">
            <GraduationCap size={23} />
            <span>
              Learn more
              <br />
              <strong>with every course</strong>
            </span>
          </div>
          <div className="floating-study-note note-bottom js-note-bottom">
            <BookOpenText size={20} />
            <span>
              Knowledge is
              <br />
              <strong>better shared</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
