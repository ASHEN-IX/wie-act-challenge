"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { nardouchImage } from "@/lib/brand";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { SCROLL_CONFIG } from "@/lib/animations/scroll-config";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function FinalCTA() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(SCROLL_CONFIG.breakpoints.activeDesktop, () => {
        // Planetary background parallax & gradual glow reveal
        gsap.to(".js-journey-planet", {
          xPercent: 7,
          yPercent: -12,
          opacity: 0.95,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        });

        // Graduate Nardouch subtle parallax float
        gsap.fromTo(
          ".js-journey-graduate-art",
          { y: 35, scale: 0.96 },
          {
            y: -10,
            scale: 1.02,
            ease: "none",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 85%",
              end: "bottom 30%",
              scrub: 0.8,
            },
          },
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  return (
    <section className="journey-outer" id="journey" ref={containerRef}>
      <div className="container">
        <ScrollReveal variant="scale" duration={0.7} className="journey-banner">
          <div className="journey-stars" aria-hidden="true" />
          <div
            className="journey-planet js-journey-planet"
            aria-hidden="true"
          />

          <div className="journey-text">
            <h2>
              Ready to
              <br />
              Start <span>Your Journey?</span>
            </h2>
            <p>Join Noveris and take your learning further, together.</p>
            <div className="journey-actions">
              <Link className="btn btn-white" href="/register">
                Get Started <ArrowRight size={18} />
              </Link>
              <a className="btn btn-secondary" href="#how-it-works">
                Learn More
              </a>
            </div>
          </div>

          <div className="journey-nardouch js-journey-graduate-art">
            <Image
              src={nardouchImage("graduate")}
              alt="Graduate Nardouch celebrating a completed course with diploma and cap"
              quality={90}
              width={1254}
              height={1254}
              sizes="(max-width: 680px) 270px, 430px"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
