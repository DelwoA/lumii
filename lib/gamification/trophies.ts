/**
 * Trophy catalog (pure data, safe to import on the client for rendering).
 * Each trophy is unlocked when its `check` passes over the user's aggregate
 * stats. `icon` names a lucide-react icon resolved by the Achievements page.
 * Streak trophies use `longestStreak` so they stay earned once achieved.
 */

export interface TrophyStats {
  sessionsCompleted: number;
  quizzesCompleted: number;
  summariesGenerated: number;
  currentStreak: number;
  longestStreak: number;
  perfectDays: number;
  totalXp: number;
}

export interface TrophyDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  /** Bonus XP granted once on unlock. */
  xp: number;
  check: (s: TrophyStats) => boolean;
}

export const TROPHIES: readonly TrophyDef[] = [
  {
    code: "first-session",
    name: "First Steps",
    description: "Complete your first study session.",
    icon: "Footprints",
    xp: 15,
    check: (s) => s.sessionsCompleted >= 1,
  },
  {
    code: "five-sessions",
    name: "Finding a Rhythm",
    description: "Complete 5 study sessions.",
    icon: "Repeat",
    xp: 25,
    check: (s) => s.sessionsCompleted >= 5,
  },
  {
    code: "twenty-sessions",
    name: "Dedicated",
    description: "Complete 20 study sessions.",
    icon: "Target",
    xp: 40,
    check: (s) => s.sessionsCompleted >= 20,
  },
  {
    code: "first-quiz",
    name: "Quiz Curious",
    description: "Finish your first quiz.",
    icon: "Brain",
    xp: 15,
    check: (s) => s.quizzesCompleted >= 1,
  },
  {
    code: "ten-quizzes",
    name: "Quiz Master",
    description: "Finish 10 quizzes.",
    icon: "Award",
    xp: 40,
    check: (s) => s.quizzesCompleted >= 10,
  },
  {
    code: "first-summary",
    name: "Note to Self",
    description: "Generate your first AI summary.",
    icon: "BookOpen",
    xp: 15,
    check: (s) => s.summariesGenerated >= 1,
  },
  {
    code: "streak-3",
    name: "On a Roll",
    description: "Reach a 3-day adherence streak.",
    icon: "Flame",
    xp: 25,
    check: (s) => s.longestStreak >= 3,
  },
  {
    code: "streak-7",
    name: "Week Warrior",
    description: "Reach a 7-day adherence streak.",
    icon: "Flame",
    xp: 50,
    check: (s) => s.longestStreak >= 7,
  },
  {
    code: "perfect-day",
    name: "Perfect Day",
    description: "Complete every session planned for a day.",
    icon: "Sparkles",
    xp: 30,
    check: (s) => s.perfectDays >= 1,
  },
  {
    code: "rank-silver",
    name: "Rising Star",
    description: "Earn 500 XP and reach Silver.",
    icon: "Crown",
    xp: 0,
    check: (s) => s.totalXp >= 500,
  },
] as const;
