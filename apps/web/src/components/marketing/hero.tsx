"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  GraduationCap,
  UsersRound,
  BookOpenText,
  BrainCircuit,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function Hero() {
  const reduced = useReducedMotion();
  const enter = (delay: number) => ({
    initial: reduced ? (false as const) : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.8,
      delay,
      ease: [0.2, 1, 0.33, 1] as [number, number, number, number],
    },
  });

  return (
    <section id="home" className="hero-section">
      <div className="stars" aria-hidden="true" />
      <div className="hero-back-planet" aria-hidden="true" />
      <div className="hero-orbital-haze" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy">
          <motion.div className="hero-eyebrow" {...enter(0.08)}>
            <Sparkles size={16} /> THE FUTURE OF PEER LEARNING
          </motion.div>
          <motion.h1 {...enter(0.19)}>
            Learn Together.
            <br />
            <span className="gradient-text">Grow Further.</span>
          </motion.h1>
          <motion.p {...enter(0.31)}>
            The space for curious university minds. Study with your peers, get
            AI guidance, and turn every course into a shared breakthrough.
          </motion.p>
          <motion.div className="hero-actions" {...enter(0.44)}>
            <a className="btn btn-primary" href="#features">
              Explore Noveris <ArrowRight size={17} />
            </a>
            <a className="btn btn-secondary" href="#how-it-works">
              <PlayCircle size={18} /> See How It Works
            </a>
          </motion.div>
          <motion.div className="hero-points" {...enter(0.54)}>
            <span>
              <UsersRound size={19} /> Peer-led learning
            </span>
            <span>
              <BrainCircuit size={19} /> AI-guided study
            </span>
            <span>
              <GraduationCap size={19} /> University-ready
            </span>
          </motion.div>
        </div>
        <div
          className="hero-art"
          aria-label="Nardouch, a nerdy AI learning companion, sitting with a laptop and a glowing orbital ring"
        >
          <div className="hero-luminance" aria-hidden="true" />
          <div className="hero-orbit outer js-hero-orbit" aria-hidden="true" />
          <div className="hero-orbit inner" aria-hidden="true" />
          <motion.div
            className="hero-nardouch"
            initial={reduced ? false : { opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.19, ease: [0.21, 1, 0.33, 1] }}
          >
            <Image
              src="/images/nardouch-hero.webp"
              alt="Nardouch smiling at a laptop, wearing big nerd glasses and purple headphones"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 640px"
            />
          </motion.div>
          <div className="floating-study-note note-top">
            <GraduationCap size={23} />
            <span>
              Learn more
              <br />
              <strong>with every course</strong>
            </span>
          </div>
          <div className="floating-study-note note-bottom">
            <BookOpenText size={20} />
            <span>
              Knowledge is
              <br />
              <strong>better shared</strong>
            </span>
          </div>
          <span className="sparkle spark-a" aria-hidden="true">
            ✦
          </span>
          <span className="sparkle spark-b" aria-hidden="true">
            ✧
          </span>
        </div>
      </div>
    </section>
  );
}
