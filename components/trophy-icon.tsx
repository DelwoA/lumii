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
