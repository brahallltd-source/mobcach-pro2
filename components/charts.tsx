"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

type ChartPoint = { name: string; value: number };

type RevenueAreaChartProps = {
  data: ChartPoint[];
  title?: string;
};

export function RevenueAreaChart({ data, title }: RevenueAreaChartProps) {
  return (
    <div className="w-full">
      {title ? <h3 className="mb-4 text-lg font-semibold text-white/90">{title}</h3> : null}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#6ee7ff" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ stroke: "rgba(255,255,255,0.1)" }} contentStyle={{ background: "#08101f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
            <Area type="monotone" dataKey="value" stroke="#6ee7ff" fill="url(#chartFill)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
