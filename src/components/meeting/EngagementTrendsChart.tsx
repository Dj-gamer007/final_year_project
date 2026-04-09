import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from "recharts";
import { EngagementSnapshot } from "@/hooks/useEngagementHistory";
import { TrendingUp, BarChart3 } from "lucide-react";

interface EngagementTrendsChartProps {
  history: EngagementSnapshot[];
  averageAttention: number;
  dominantEmotion: string;
  emotionDistribution: Record<string, number>;
}

const emotionColors: Record<string, string> = {
  Happy: "#22c55e",
  Sad: "#3b82f6",
  Angry: "#ef4444",
  Surprised: "#eab308",
  Fearful: "#a855f7",
  Disgusted: "#f97316",
  Neutral: "#6b7280",
  Unknown: "#9ca3af",
};

const EngagementTrendsChart = ({
  history,
  averageAttention,
  dominantEmotion,
  emotionDistribution,
}: EngagementTrendsChartProps) => {
  // Transform data for chart
  const chartData = useMemo(() => {
    return history.map((snapshot) => ({
      time: snapshot.timeLabel,
      attention: snapshot.attentionScore,
      emotionConfidence: snapshot.emotionConfidence,
      emotion: snapshot.emotion,
    }));
  }, [history]);

  // Get the last 10 data points for display if too many
  const displayData = useMemo(() => {
    if (chartData.length <= 15) return chartData;
    // Show every nth point to keep chart readable
    const step = Math.ceil(chartData.length / 15);
    return chartData.filter((_, i) => i % step === 0 || i === chartData.length - 1);
  }, [chartData]);

  if (history.length < 2) {
    return (
      <div className="p-4 rounded-lg bg-muted/50 border border-dashed border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BarChart3 className="w-5 h-5" />
          <span className="text-sm">
            Collecting engagement data... ({history.length}/2 samples)
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Trend chart will appear after more data is collected
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-xs text-muted-foreground">Avg Attention</p>
          <p className="text-xl font-bold text-primary">{averageAttention}%</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground">Dominant Mood</p>
          <p
            className="text-xl font-bold"
            style={{ color: emotionColors[dominantEmotion] || "#6b7280" }}
          >
            {dominantEmotion}
          </p>
        </div>
      </div>

      {/* Emotion Distribution */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <p className="text-xs text-muted-foreground mb-2">Emotion Distribution</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(emotionDistribution).map(([emotion, percentage]) => (
            <div
              key={emotion}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
              style={{
                backgroundColor: `${emotionColors[emotion] || "#6b7280"}20`,
                color: emotionColors[emotion] || "#6b7280",
              }}
            >
              <span className="font-medium">{emotion}</span>
              <span className="opacity-70">{percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trends Chart */}
      <div className="p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-medium text-foreground">Engagement Over Time</h4>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayData}>
              <defs>
                <linearGradient id="attentionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => {
                  const label = name === "attention" ? "Attention" : "Confidence";
                  return [`${value}%`, label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value) =>
                  value === "attention" ? "Attention" : "Emotion Confidence"
                }
              />
              <Area
                type="monotone"
                dataKey="attention"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#attentionGradient)"
              />
              <Line
                type="monotone"
                dataKey="emotionConfidence"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22c55e" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Emotion Timeline (mini) */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Emotion Timeline</p>
          <div className="flex gap-0.5 h-4 rounded overflow-hidden">
            {displayData.map((point, index) => (
              <div
                key={index}
                className="flex-1 transition-colors"
                style={{
                  backgroundColor: emotionColors[point.emotion] || "#6b7280",
                }}
                title={`${point.time}: ${point.emotion}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{displayData[0]?.time || "0:00"}</span>
            <span>{displayData[displayData.length - 1]?.time || "0:00"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngagementTrendsChart;
