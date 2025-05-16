// @ts-nocheck
"use client";

import { Card } from "./DemoComponents";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

interface ChartSectionProps {
  chartData: any[];
  hasTarget: boolean;
  calorieTarget: number;
}

export default function ChartSection({ chartData, hasTarget, calorieTarget }: ChartSectionProps) {
  // Calculate average daily intake
  const averageCalories = chartData.some(d => d.calories > 0) 
    ? Math.round(chartData.reduce((a, b) => a + b.calories, 0) / chartData.length) 
    : 0;

  return (
    <Card title="Weekly Trends">
      <div className="space-y-4">
        <p className="text-sm text-[var(--app-foreground-muted)]">
          Average daily intake (last 7 days): <span className="font-semibold text-[var(--app-foreground)]">{averageCalories} kcal</span>
        </p>
        {chartData.some(d => d.calories > 0) ? (
          <div className="h-60 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-card-border)" />
                <XAxis dataKey="name" fontSize={10} stroke="var(--app-foreground-muted)" />
                <YAxis fontSize={10} stroke="var(--app-foreground-muted)" />
                <Tooltip cursor={{ fill: 'var(--app-gray)' }} contentStyle={{ backgroundColor: 'var(--app-background)', borderColor: 'var(--app-card-border)', borderRadius: '0.5rem', color: 'var(--app-foreground)' }} />
                <Bar dataKey="calories" fill="var(--app-accent)" radius={[4, 4, 0, 0]} />
                {hasTarget && calorieTarget > 0 && (
                  <ReferenceLine 
                    y={calorieTarget} 
                    label={{ 
                      value: "Target", 
                      position: "insideTopRight", 
                      fill: "var(--app-accent-error)", 
                      fontSize: 10, 
                      dy: -5 
                    }} 
                    stroke="var(--app-accent-error)" 
                    strokeDasharray="3 3" 
                    strokeWidth={1.5} 
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-sm text-[var(--app-foreground-muted)]">Log more days to see your weekly trend chart.</p>
        )}
      </div>
    </Card>
  );
} 