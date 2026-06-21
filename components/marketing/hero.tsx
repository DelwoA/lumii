"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  }

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
  };
  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      className="group relative overflow-hidden border-b"
    >
      {/* Cursor-as-light: a soft lime spotlight that follows the pointer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(420px_circle_at_var(--x,_50%)_var(--y,_30%),color-mix(in_oklch,var(--primary)_16%,transparent),transparent_70%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative"
        >
          <motion.p
            variants={item}
            className="text-muted-foreground font-mono text-xs font-medium tracking-[0.18em] uppercase"
          >
            AI study companion
          </motion.p>
          <motion.h1
            variants={item}
            className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Turn your notes into a study plan that sticks.
          </motion.h1>
          <motion.p
            variants={item}
            className="text-muted-foreground mt-5 max-w-md text-lg text-pretty"
          >
            LUMII summarizes your material, quizzes you on it, and keeps you on
            track with sessions, streaks, and a tutor that actually knows your
            documents.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants(),
                "h-11 gap-2 rounded-full px-6 text-base",
              )}
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 rounded-full px-6 text-base",
              )}
            >
              See how it works
            </a>
          </motion.div>
          <motion.ul
            variants={item}
            className="text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm"
          >
            {["Free to start", "No credit card", "Your files stay private"].map(
              (t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="text-primary size-4" />
                  {t}
                </li>
              ),
            )}
          </motion.ul>
        </motion.div>

        {/* Right: a built-from-components study card with a lime glow. */}
        <div className="relative hidden md:block">
          <div
            aria-hidden="true"
            className="bg-primary/20 absolute -inset-8 rounded-full blur-3xl"
          />
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="bg-card relative rounded-2xl border p-5 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <LumenSpark className="size-5" />
              <span className="text-sm font-medium">Photosynthesis · Summary</span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="bg-muted h-2.5 w-5/6 rounded-full" />
              <div className="bg-muted h-2.5 w-full rounded-full" />
              <div className="bg-muted h-2.5 w-2/3 rounded-full" />
            </div>
            <div className="mt-5 rounded-xl border p-3">
              <p className="text-xs font-medium">Quick quiz</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="border-primary bg-primary/15 flex size-4 items-center justify-center rounded-full border">
                    <Check className="text-primary size-2.5" />
                  </span>
                  Converts light into chemical energy
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span className="size-4 rounded-full border" />
                  Stores energy as starch only
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="bg-primary size-2 rounded-full" />
                7-day streak
              </div>
              <div className="bg-primary/15 text-primary rounded-full px-2.5 py-1 font-mono text-xs">
                +40 XP
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
