"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { marketingNavigation } from "@/lib/brand";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState("#home");
  const isClickScrollingRef = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track scroll position for header glassmorphism & active section
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 18);

      // If user recently clicked a nav item, preserve the target active state
      // until smooth scrolling finishes
      if (isClickScrollingRef.current) return;

      const scrollY = window.scrollY;
      const readingLine = 140;

      // Top of page
      if (scrollY < 80) {
        setActiveHash("#home");
        return;
      }

      // Bottom of page (near or at footer / CTA)
      const isBottom =
        window.innerHeight + scrollY >=
        document.documentElement.scrollHeight - 60;
      if (isBottom) {
        setActiveHash(marketingNavigation[marketingNavigation.length - 1].href);
        return;
      }

      // Check sections: account for GSAP pin-spacer containers
      for (const link of marketingNavigation) {
        const el = document.querySelector(link.href) as HTMLElement | null;
        if (!el) continue;
        const container =
          (el.closest(".pin-spacer") as HTMLElement | null) || el;
        const rect = container.getBoundingClientRect();
        if (rect.top <= readingLine && rect.bottom > readingLine) {
          setActiveHash(link.href);
          return;
        }
      }

      // Fallback: find the section closest above reading line
      let closest: string = marketingNavigation[0].href;
      for (const link of marketingNavigation) {
        const el = document.querySelector(link.href) as HTMLElement | null;
        if (!el) continue;
        const container =
          (el.closest(".pin-spacer") as HTMLElement | null) || el;
        const rect = container.getBoundingClientRect();
        if (rect.top <= readingLine) {
          closest = link.href;
        }
      }
      setActiveHash(closest);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  // Smooth anchor navigation that accounts for GSAP pinned sections
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!href.startsWith("#")) return;

    const targetEl = document.querySelector(href) as HTMLElement | null;
    if (!targetEl) return;

    e.preventDefault();
    setOpen(false);
    setActiveHash(href);

    // Suppress scroll listener updates while smooth scroll runs
    isClickScrollingRef.current = true;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 950);

    if (href === "#home") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      // Check if section is pinned or inside a pin spacer
      const allTriggers = ScrollTrigger.getAll();
      const matchedTrigger = allTriggers.find((st) => st.trigger === targetEl);

      if (matchedTrigger) {
        // Pin trigger: scroll to its start position
        window.scrollTo({
          top: matchedTrigger.start + 2,
          behavior: "smooth",
        });
      } else {
        // Unpinned section: compute target position accounting for pin spacers
        const container =
          (targetEl.closest(".pin-spacer") as HTMLElement | null) || targetEl;
        const topOffset =
          container.getBoundingClientRect().top + window.scrollY - 76;
        window.scrollTo({
          top: Math.max(0, topOffset),
          behavior: "smooth",
        });
      }
    }

    if (window.history.pushState) {
      window.history.pushState(null, "", href);
    }
  };

  return (
    <header className={`site-nav ${scrolled ? "scrolled" : ""}`}>
      <div className="container site-nav-inner">
        <Logo />

        <nav className="nav-links" aria-label="Primary navigation">
          {marketingNavigation.map((link) => {
            const isActive = activeHash === link.href;
            return (
              <a
                className={isActive ? "active" : undefined}
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="nav-actions">
          <Link className="nav-login" href="/login">
            Log in
          </Link>
          <Link className="nav-signup" href="/register">
            Get Started <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {marketingNavigation.map((link) => {
            const isActive = activeHash === link.href;
            return (
              <a
                className={isActive ? "active" : undefined}
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </a>
            );
          })}
          <Link href="/register" onClick={() => setOpen(false)}>
            Get Started <ArrowRight size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}
