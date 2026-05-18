"use client";

import { motion } from "motion/react";

export function Reveal({
  children,
  delay = 0,
  immediate = false,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  immediate?: boolean;
  className?: string;
}) {
  const initial = { opacity: 0, y: 24 };
  const shown = { opacity: 1, y: 0 };
  const transition = {
    duration: 0.6,
    delay,
    ease: [0.16, 1, 0.3, 1] as const,
  };

  if (immediate) {
    return (
      <motion.div
        className={className}
        initial={initial}
        animate={shown}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={shown}
      viewport={{ once: true, margin: "-80px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
