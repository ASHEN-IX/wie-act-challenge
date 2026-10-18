import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed top-4 right-4 z-50"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        className="rounded-full bg-background/50 backdrop-blur-md border-primary/20 hover:border-primary shadow-lg overflow-hidden relative"
      >
        <motion.div
          initial={false}
          animate={{
            y: theme === "dark" ? -50 : 0,
            opacity: theme === "dark" ? 0 : 1,
            rotate: theme === "dark" ? 90 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="absolute"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] text-[var(--accent-color-dynamic)]" />
        </motion.div>
        <motion.div
          initial={false}
          animate={{
            y: theme === "dark" ? 0 : 50,
            opacity: theme === "dark" ? 1 : 0,
            rotate: theme === "dark" ? 0 : -90,
          }}
          transition={{ duration: 0.2 }}
          className="absolute"
        >
          <Moon className="h-[1.2rem] w-[1.2rem] text-primary" />
        </motion.div>
        <span className="sr-only">Toggle theme</span>
      </Button>
    </motion.div>
  );
};

export default ThemeToggle;
