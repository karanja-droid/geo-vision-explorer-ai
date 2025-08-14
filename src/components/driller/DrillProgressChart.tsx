import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface DrillProgressChartProps {
  data: Record<string, number>;
}

export function DrillProgressChart({ data }: DrillProgressChartProps) {
  // Transform data for chart
  const chartData = Object.entries(data).map(([date, metres]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    metres: metres,
    cumulative: 0 // Will be calculated below
  }));

  // Calculate cumulative metres
  let cumulative = 0;
  chartData.forEach(item => {
    cumulative += item.metres;
    item.cumulative = cumulative;
  });

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No drilling progress data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Daily Progress Bar Chart */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              fontSize={12}
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              fontSize={12}
              tick={{ fontSize: 10 }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value}m`, 'Daily Progress']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Bar 
              dataKey="metres" 
              fill="#3B82F6" 
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Progress Line Chart */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              fontSize={12}
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              fontSize={12}
              tick={{ fontSize: 10 }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value}m`, 'Cumulative Progress']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="cumulative" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">Total Metres</p>
          <p className="font-semibold text-lg">{cumulative.toFixed(1)}m</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Daily Average</p>
          <p className="font-semibold text-lg">
            {chartData.length > 0 ? (cumulative / chartData.length).toFixed(1) : 0}m
          </p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Best Day</p>
          <p className="font-semibold text-lg">
            {Math.max(...chartData.map(d => d.metres)).toFixed(1)}m
          </p>
        </div>
      </div>
    </div>
  );
}