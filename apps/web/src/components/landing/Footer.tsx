import Link from "next/link";
import { Instagram, Linkedin, Youtube, BookOpen } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-about">
            <Logo small />
            <p>Learn Together. Grow Further.</p>
            <small>
              Built for thoughtful, collaborative university learning.
            </small>
          </div>
          <div className="footer-links">
            <div>
              <strong>Product</strong>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#nardouch">Nardouch</a>
            </div>
            <div>
              <strong>Community</strong>
              <a href="#features">Study Circles</a>
              <a href="#how-it-works">For Students</a>
            </div>
            <div>
              <strong>Noveris</strong>
              <a href="#home">Home</a>
              <Link href="/register">Get Started</Link>
              <Link href="/login">Log in</Link>
            </div>
          </div>
          <div className="footer-social">
            <span aria-label="Social channels coming soon">
              <Instagram size={20} />
              <Youtube size={20} />
              <Linkedin size={20} />
            </span>
            <small>Community accounts coming soon</small>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Noveris. All rights reserved.
          </span>
          <span>
            <BookOpen size={14} /> Learn together, grow further.
          </span>
        </div>
      </div>
    </footer>
  );
}
