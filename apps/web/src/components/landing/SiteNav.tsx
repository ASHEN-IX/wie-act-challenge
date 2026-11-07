"use client";

import { useEffect, useState } from "react";
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

  // Track scroll position for header glassmorphism & active section
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 18);

      // Determine active section based on scroll position
      const sections = marketingNavigation.map((link) =>
        document.querySelector(link.href),
      );

      const scrollPos = window.scrollY + 120;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i] as HTMLElement | null;
        if (sec && sec.offsetTop <= scrollPos) {
          setActiveHash(marketingNavigation[i].href);
          break;
        }
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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

    // If ScrollTrigger exists, find the trigger start
    const allTriggers = ScrollTrigger.getAll();
    const matchedTrigger = allTriggers.find((st) => st.trigger === targetEl);

    if (matchedTrigger) {
      window.scrollTo({
        top: matchedTrigger.start + 2,
        behavior: "smooth",
      });
    } else {
      const topOffset = targetEl.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({
        top: topOffset,
        behavior: "smooth",
      });
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
          {marketingNavigation.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
          <Link href="/register" onClick={() => setOpen(false)}>
            Get Started <ArrowRight size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}
