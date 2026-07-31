"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";

interface MultiSeriesPoint {
  label: string;
  [series: string]: string | number | null;
}

export function MultiLineChart({
  data,
  series,
  height = 220,
}: {
  data: MultiSeriesPoint[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  );
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function MultiBarChart({
  data,
  series,
  height = 220,
  layout = "horizontal",
}: {
  data: MultiSeriesPoint[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  layout?: "horizontal" | "vertical";
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  );
  const isVertical = layout === "vertical";
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart
        data={data}
        layout={isVertical ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={isVertical}
          horizontal={!isVertical}
        />
        {isVertical ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={90}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
          </>
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            radius={isVertical ? [0, 3, 3, 0] : [3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
