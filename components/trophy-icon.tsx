// =============================================================================
// FILE: components/trophy-icon.tsx
// WHAT THIS FILE DOES:
//   Turns a trophy's icon NAME (a plain string stored with each trophy, like
//   "Footprints") into the matching lucide-react icon to display. This lets the
//   trophy list (which is plain data) refer to icons by name. To support a new
//   icon name, import it here and add it to the lookup below.
// =============================================================================
import {
  Award,
  BookOpen,
  Brain,
  Crown,
  Flame,
  Footprints,
  Repeat,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/** Maps a trophy's stored icon name to its lucide component (Trophy fallback). */
const ICONS: Record<string, LucideIcon> = {
  Award,
  BookOpen,
  Brain,
  Crown,
  Flame,
  Footprints,
  Repeat,
  Sparkles,
  Target,
};

export function TrophyIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Trophy;
  return <Icon className={className} />;
}
