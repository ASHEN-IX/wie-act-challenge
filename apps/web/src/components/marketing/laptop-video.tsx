"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pause, Play, VolumeX } from "lucide-react";

/** Locally bundled demo clip. No external service; respects reduced motion. */
export function LaptopVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (media.matches) {
        video.pause();
        setPlaying(false);
      } else {
        video
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const toggle = () => {
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
    <div className="laptop-demo js-laptop-stage">
      <div className="laptop-aura js-laptop-aura" aria-hidden="true" />
      <div className="laptop-device">
        <div className="laptop-screen-bezel">
          <span className="webcam-dot" aria-hidden="true" />
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            autoPlay
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
            onClick={toggle}
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
      <div className="laptop-neon-floor" aria-hidden="true" />
      <motion.span
        className="laptop-demo-label"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        Preview footage · Illustrative academic dashboard
      </motion.span>
    </div>
  );
}
