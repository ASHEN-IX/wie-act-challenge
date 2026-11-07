"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, VolumeX } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/components/animations/useReducedMotion";
import { SCROLL_CONFIG } from "@/lib/animations/scroll-config";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/**
 * LaptopVideo displays the interactive product demonstration with 3D perspective entrance,
 * neon floor aura, and locally hosted video playback.
 */
export function LaptopVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  // Video autoplay & visibility management
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduced) {
      video.pause();
      setPlaying(false);
      return;
    }

    // Try muted autoplay
    video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [reduced]);

  // Laptop 3D perspective entrance & scrubbed parallax
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(SCROLL_CONFIG.breakpoints.activeDesktop, () => {
        // Perspective entrance & upward gentle translation
        gsap.fromTo(
          ".js-laptop-bezel",
          {
            rotateX: SCROLL_CONFIG.laptop.perspectiveStart.rotateX,
            rotateY: SCROLL_CONFIG.laptop.perspectiveStart.rotateY,
            y: SCROLL_CONFIG.laptop.perspectiveStart.y,
            opacity: SCROLL_CONFIG.laptop.perspectiveStart.opacity,
          },
          {
            rotateX: SCROLL_CONFIG.laptop.perspectiveRest.rotateX,
            rotateY: SCROLL_CONFIG.laptop.perspectiveRest.rotateY,
            y: SCROLL_CONFIG.laptop.perspectiveRest.y,
            opacity: SCROLL_CONFIG.laptop.perspectiveRest.opacity,
            ease: "power2.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 85%",
              end: "bottom 60%",
              scrub: SCROLL_CONFIG.laptop.scrub,
            },
          },
        );

        // Subtle pulsing cyan-violet glow beneath laptop
        gsap.fromTo(
          ".js-laptop-neon-floor",
          { scale: 0.9, opacity: 0.5 },
          {
            scale: 1.08,
            opacity: 0.9,
            ease: "power1.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 80%",
              end: "bottom 50%",
              scrub: 1,
            },
          },
        );

        // Ambient background aura expansion
        gsap.to(".js-laptop-aura", {
          scale: 1.15,
          opacity: 0.85,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
            end: "bottom top",
            scrub: 1,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  const togglePlayback = () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="laptop-demo js-laptop-stage" ref={containerRef}>
      <div className="laptop-aura js-laptop-aura" aria-hidden="true" />

      <div className="laptop-device">
        <div className="laptop-screen-bezel js-laptop-bezel">
          <span className="webcam-dot" aria-hidden="true" />
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            preload="metadata"
            poster="/videos/study-demo-poster.jpg"
            aria-label="Illustrative video of the Noveris student dashboard"
          >
            <source src="/videos/study-demo.mp4" type="video/mp4" />
            Your browser does not support this demonstration video.
          </video>

          <button
            type="button"
            className="video-play-toggle"
            aria-label={
              playing ? "Pause dashboard demo" : "Play dashboard demo"
            }
            onClick={togglePlayback}
          >
            {playing ? (
              <Pause size={17} />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
          </button>

          <div className="video-muted">
            <VolumeX size={14} /> SILENT PREVIEW
          </div>
        </div>

        <div className="laptop-lower">
          <span />
        </div>
      </div>

      <div className="laptop-neon-floor js-laptop-neon-floor" aria-hidden="true" />

      <span className="laptop-demo-label">
        Preview footage · Illustrative academic dashboard
      </span>
    </div>
  );
}
