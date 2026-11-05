"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { GraduationCap } from "lucide-react";
import { stages } from "@/lib/brand";

export function EvolutionTimeline() {
  const [selected, setSelected] = useState(0);
  const reduced = useReducedMotion();

  return (
    <section className="evolution-section" id="nardouch">
      <div className="container evolution-grid">
        <motion.div
          className="evolution-copy"
          initial={reduced ? false : { opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="section-pill">
            <GraduationCap size={16} /> MEET NARDOUCH
          </span>
          <h2>
            Meet <span>Nardouch.</span>
          </h2>
          <h3>Your companion from day one to graduation.</h3>
          <p>
            Every subject begins with a little nerd. As you complete courses,
            Nardouch grows alongside you—learning, evolving, and celebrating
            every milestone.
          </p>
          <div className="stage-description" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={selected}
                initial={reduced ? false : { opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -7 }}
                transition={{ duration: 0.2 }}
              >
                <strong>{stages[selected].name}:</strong>{" "}
                {stages[selected].description}
              </motion.p>
            </AnimatePresence>
          </div>
          <small>
            Appearance evolves with course completion; competency mastery is
            tracked separately.
          </small>
        </motion.div>
        <div className="evolution-art">
          <div className="evolution-haze" aria-hidden="true" />
          <div className="evolution-cast">
            {stages.map((stage, i) => (
              <motion.button
                type="button"
                key={stage.id}
                className={`evolution-character stage-${i + 1} ${
                  selected === i ? "active" : ""
                }`}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                aria-label={`See ${stage.name} Nardouch`}
                initial={reduced ? false : { opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.095 }}
                whileHover={reduced ? undefined : { y: -9 }}
              >
                <span className="character-image">
                  <Image
                    src={`/images/nardouch-${stage.id}.webp`}
                    alt=""
                    width={230}
                    height={220}
                    sizes="(max-width: 680px) 140px, 190px"
                  />
                </span>
                <span className="character-name">{stage.name}</span>
                <span className="character-unlock">{stage.unlock}</span>
              </motion.button>
            ))}
          </div>
          <div className="evolution-track" aria-hidden="true">
            <div className="evolution-track-fill js-evolution-fill" />
            <div className="evolution-ticks">
              {stages.map((s, i) => (
                <span className={i === selected ? "selected" : ""} key={s.id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
