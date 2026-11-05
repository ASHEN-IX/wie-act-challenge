"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function JourneyBanner() {
  const reduced = useReducedMotion();

  return (
    <section className="journey-outer" id="journey">
      <div className="container">
        <motion.div
          className="journey-banner"
          initial={reduced ? false : { opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <div className="journey-stars" aria-hidden="true" />
          <div className="journey-planet js-journey-planet" aria-hidden="true" />
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
          <div className="journey-nardouch">
            <Image
              src="/images/nardouch-graduate.webp"
              alt="Graduate Nardouch celebrating a completed subject"
              width={430}
              height={430}
              sizes="(max-width: 680px) 270px, 430px"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
