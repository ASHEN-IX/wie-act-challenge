import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

const TiltCard = ({ children, className }: any) => {
  const ref = useRef<any>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 }); // Smoother spring
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["2deg", "-2deg"]); // Even more subtle
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-2deg", "2deg"]);

  const handleMouseMove = (e: any) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={cn(
        "relative transition-all duration-200 ease-out valo-card font-valorant",
        className,
      )}
    >
      {/* Decorative Corner Lines & Tech Labels */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/50" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/50" />

      {/* Tech Text Decorations (Valorant Gameday style) */}
      <div className="absolute top-2 right-4 text-[10px] font-bold tracking-widest text-primary/30 pointer-events-none select-none">
        {"// SYS.RDY"}
      </div>
      <div suppressHydrationWarning className="absolute bottom-2 left-4 text-[10px] font-bold tracking-widest text-primary/30 pointer-events-none select-none">
        _COORDS: {Math.floor(Math.random() * 99)}.84
      </div>

      {/* Decorative vertical bar */}
      <div className="absolute top-1/2 left-0 w-1 h-8 -translate-y-1/2 bg-primary/20" />

      {/* Inner Content */}
      <div className="relative z-10 w-full h-full">{children}</div>

      {/* Hover Reveal Effect */}
      <div
        style={{ transform: "translateZ(75px)", transformStyle: "preserve-3d" }}
        className="absolute inset-0 bg-primary/5 -z-10 group-hover:opacity-100 opacity-0 transition-opacity"
      />
    </motion.div>
  );
};

export default TiltCard;
