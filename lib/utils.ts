// =============================================================================
// FILE: lib/utils.ts
// WHAT THIS FILE DOES:
//   Holds tiny shared helper functions used all over the interface.
//
// cn(...) = "class names". It joins several CSS class strings into one and
//   sensibly merges Tailwind classes that clash (for example, if two parts both
//   set a padding, the last one wins instead of both being left in). You will
//   see cn(...) used in almost every component to combine fixed classes with
//   conditional ones.
// =============================================================================
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Merge any number of class-name values into one clean Tailwind-aware string.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
