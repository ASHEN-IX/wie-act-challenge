import React, { useEffect, useState } from "react";
import "./XPNotification.css";

const XPNotification = ({ xpAwarded, visible, onComplete }: any) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsAnimating(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false);
        if (onComplete) {
          setTimeout(onComplete, 500); // Wait for fade out
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, onComplete]);

  if (!visible && !isAnimating) return null;

  return (
    <div className={`xp-notification ${isAnimating ? "show" : "hide"}`}>
      <div className="xp-icon">✨</div>
      <div className="xp-content">
        <div className="xp-amount">+{xpAwarded} XP</div>
        <div className="xp-message">Great job!</div>
      </div>
    </div>
  );
};

export default XPNotification;
