import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarClock,
  FileText,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Trophy,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
import { buttonVariants } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Hero } from "@/components/marketing/hero";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Upload,
    title: "Upload",
    body: "Add a PDF or type notes for any subject and topic.",
  },
  {
    icon: FileText,
    title: "Summarize",
    body: "Get a clean, structured revision summary in seconds.",
  },
  {
    icon: Brain,
    title: "Quiz",
    body: "Test yourself with instant, explained multiple-choice questions.",
  },
  {
    icon: TrendingUp,
    title: "Track",
    body: "Plan sessions, build streaks, and watch your progress grow.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  body,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card hover:border-primary/50 group flex flex-col rounded-2xl border p-6 transition",
        className,
      )}
    >
      <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-full transition group-hover:scale-105">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm text-pretty">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex flex-col">
        <Hero />

        {/* How it works */}
        <section id="how" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <Reveal>
              <p className="text-muted-foreground font-mono text-xs font-medium tracking-[0.18em] uppercase">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                From scattered notes to a steady routine.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.08}>
                  <div className="relative">
                    <span className="text-primary font-mono text-sm font-semibold">
                      0{i + 1}
                    </span>
                    <div className="mt-3 flex size-10 items-center justify-center rounded-full border">
                      <s.icon className="size-5" />
                    </div>
                    <h3 className="mt-4 font-medium">{s.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm text-pretty">
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Features bento */}
        <section id="features" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <Reveal>
              <p className="text-muted-foreground font-mono text-xs font-medium tracking-[0.18em] uppercase">
                Features
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Everything you need to study with intent.
              </h2>
            </Reveal>
            <Reveal>
              <div className="mt-12 grid gap-4 md:auto-rows-[200px] md:grid-cols-3">
                <FeatureCard
                  icon={Sparkles}
                  title="AI summaries & quizzes"
                  body="Turn any PDF or note into a focused summary, then quiz yourself with explained answers. Understand faster, remember longer."
                  className="md:col-span-2 md:row-span-2"
                />
                <FeatureCard
                  icon={MessageCircle}
                  title="AI tutor chat"
                  body="Ask questions about your own documents and get guided, Socratic answers."
                />
                <FeatureCard
                  icon={CalendarClock}
                  title="Timetable & sessions"
                  body="Plan it, start it, finish it, with a live timer and gentle auto-stop."
                />
                <FeatureCard
                  icon={Trophy}
                  title="Gamification & progress"
                  body="Stay motivated with XP, ranks, adherence streaks, trophies, and clear progress charts."
                  className="md:col-span-3"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Progress / gamification showcase */}
        <section id="progress" className="border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2">
            <Reveal>
              <p className="text-muted-foreground font-mono text-xs font-medium tracking-[0.18em] uppercase">
                Stay motivated
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Progress you can see and feel.
              </h2>
              <p className="text-muted-foreground mt-4 max-w-md text-pretty">
                Every session, quiz, and summary earns XP toward your next rank.
                Keep your plan and your streak grows. Share a public showcase of
                your achievements, or keep it private. Your call.
              </p>
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants(),
                  "mt-8 h-11 gap-2 rounded-full px-6 text-base",
                )}
              >
                Start earning XP
                <ArrowRight className="size-4" />
              </Link>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Gold</span>
                  <span className="text-muted-foreground font-mono text-sm">
                    1,840 XP
                  </span>
                </div>
                <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                  <div className="bg-primary h-full w-2/3 rounded-full" />
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  1,660 XP to Platinum
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Streak", value: "7d" },
                    { label: "Sessions", value: "23" },
                    { label: "Trophies", value: "6" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border py-3">
                      <p className="text-xl font-semibold tabular-nums">
                        {s.value}
                      </p>
                      <p className="text-muted-foreground text-xs">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final CTA band */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center">
            <LumenSpark className="text-primary-foreground size-10" />
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start studying smarter with LUMII.
            </h2>
            <Link
              href="/sign-up"
              className="bg-background text-foreground hover:bg-background/90 inline-flex h-11 items-center gap-2 rounded-full px-6 text-base font-medium transition"
            >
              Get started free
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm sm:flex-row">
          <Link
            href="/"
            className="text-foreground flex items-center gap-2 font-semibold"
          >
            <LumenSpark className="size-5" />
            LUMII
          </Link>
          <nav className="flex items-center gap-5">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <Link href="/sign-in" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Sign up
            </Link>
          </nav>
          <span>© 2026 LUMII</span>
        </div>
      </footer>
    </>
  );
}
