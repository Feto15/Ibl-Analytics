"use client";

import {
  Area,
  AreaChart,
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
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";

interface TrendSeries {
  label: string;
  value: number | null;
}

export function TrendLineChart({
  data,
  color = "var(--chart-1)",
  height = 200,
  valueLabel = "Nilai",
  formatValue,
}: {
  data: TrendSeries[];
  color?: string;
  height?: number;
  valueLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const config: ChartConfig = { value: { label: valueLabel } };
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={40}
          className="fill-muted-foreground"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [
                formatValue && typeof value === "number"
                  ? formatValue(value)
                  : value,
                valueLabel,
              ]}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

export function TrendAreaChart({
  data,
  color = "var(--chart-2)",
  height = 200,
  valueLabel = "Nilai",
}: {
  data: TrendSeries[];
  color?: string;
  height?: number;
  valueLabel?: string;
}) {
  const config: ChartConfig = { value: { label: valueLabel } };
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${valueLabel}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${valueLabel})`}
          connectNulls
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function RankedBarChart({
  data,
  color = "var(--chart-1)",
  height = 240,
  valueLabel = "Nilai",
  formatValue,
}: {
  data: TrendSeries[];
  color?: string;
  height?: number;
  valueLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const config: ChartConfig = { value: { label: valueLabel } };
  const barHeight = 28;
  const total = Math.max(data.length * barHeight + 8, height);
  return (
    <ChartContainer config={config} className="w-full" style={{ height: total }}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
        barCategoryGap={6}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          domain={[0, "auto"]}
          className="fill-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={48}
          interval={0}
          className="fill-muted-foreground"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [
                formatValue && typeof value === "number"
                  ? formatValue(value)
                  : value,
                valueLabel,
              ]}
            />
          }
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} fill={color} />
      </BarChart>
    </ChartContainer>
  );
}
