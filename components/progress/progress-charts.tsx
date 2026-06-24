// =============================================================================
// FILE: components/progress/progress-charts.tsx
// WHAT THIS FILE DOES:
//   Draws the charts on the Progress page (study minutes over recent days,
//   weekly adherence, and points growth) using the recharts library. It only
//   displays the data the page passes in; the numbers are worked out server-side
//   in lib/progress/service.ts.
// =============================================================================
"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { ProgressData } from "@/lib/progress/types";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

export function ProgressCharts({ data }: { data: ProgressData }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-4 font-medium">Study minutes (last 14 days)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.dailyStudy}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            />
            <Bar dataKey="minutes" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-medium">Weekly adherence (last 6 weeks)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.weeklyAdherence}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="week"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={32}
              domain={[0, 100]}
              unit="%"
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            />
            <Bar dataKey="pct" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <h2 className="mb-4 font-medium">XP growth (last 30 days)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.xpCumulative}>
            <defs>
              <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="xp"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#xpFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
