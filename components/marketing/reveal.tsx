// =============================================================================
// FILE: components/marketing/reveal.tsx
// WHAT THIS FILE DOES:
//   A small wrapper used on the landing page that gently fades and slides its
//   contents up as they scroll into view. It respects "reduced motion" settings
//   (then it just shows the content with no animation).
// =============================================================================
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Scroll-into-view fade/slide-up wrapper. Honors prefers-reduced-motion. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
