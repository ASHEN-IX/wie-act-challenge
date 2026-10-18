import React, { useMemo, useRef, useEffect } from "react";
import "./LevelUpModal.css";

const CONFETTI_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6b9d"];

// Pre-generate stable confetti data so colors/positions don't re-randomize on each render
const CONFETTI_DATA = Array.from({ length: 30 }, (_: any, i: any) => ({
  left: ((i * 37 + 13) % 100),
  delay: ((i * 67 + 7) % 200) / 100,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

const LevelUpModal = ({ visible, newLevel, totalXP, onClose }: any) => {
  const modalRef = useRef<any>(null);

  // Focus-trap + Escape
  useEffect(() => {
    if (!visible || !modalRef.current) return;
    const el = modalRef.current;
    const prev = document.activeElement;
    el.focus();
    const handleKey = (e: any) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const focusable = el.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    el.addEventListener("keydown", handleKey);
    return () => { el.removeEventListener("keydown", handleKey); if (prev) (prev as HTMLElement).focus(); };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="levelup-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="levelup-title"
        className="levelup-modal"
        tabIndex={-1}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div className="levelup-confetti">
          {CONFETTI_DATA.map((piece: any, i: any) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                backgroundColor: piece.color,
              }}
            />
          ))}
        </div>

        <div className="levelup-content">
          <div className="levelup-icon">🎉</div>
          <h2 id="levelup-title" className="levelup-title">LEVEL UP!</h2>
          <div className="levelup-level">
            <span className="level-label">Level</span>
            <span className="level-number">{newLevel}</span>
          </div>
          <p className="levelup-xp">Total XP: {totalXP}</p>
          <p className="levelup-message">
            Amazing progress! Keep up the great work! 🚀
          </p>
          <button className="levelup-close-btn" onClick={onClose}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
