"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { marketingNavigation } from "@/lib/brand";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 18);
    handle();
    addEventListener("scroll", handle, { passive: true });
    return () => removeEventListener("scroll", handle);
  }, []);

  return (
    <header className={`site-nav ${scrolled ? "scrolled" : ""}`}>
      <div className="container site-nav-inner">
        <Logo />
        <nav className="nav-links" aria-label="Primary navigation">
          {marketingNavigation.map((link, i) => (
            <a
              className={i === 0 ? "active" : undefined}
              key={link.href}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
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
              onClick={() => setOpen(false)}
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
