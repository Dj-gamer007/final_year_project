import { Progress } from "@/components/ui/progress";
import { Activity, Eye, Smile, TrendingUp } from "lucide-react";

const participants = [
  {
    name: "Team Member 1",
    engagement: 92,
    attention: 88,
    sentiment: "positive",
  },
  {
    name: "Team Member 2",
    engagement: 85,
    attention: 90,
    sentiment: "positive",
  },
  {
    name: "Team Member 3",
    engagement: 78,
    attention: 82,
    sentiment: "neutral",
  },
];

const EngagementPanel = () => {
  const avgEngagement = Math.round(
    participants.reduce((sum, p) => sum + p.engagement, 0) / participants.length
  );

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "text-success";
      case "neutral":
        return "text-warning";
      case "negative":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Engagement Analytics
          </h3>
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="font-semibold text-success">{avgEngagement}%</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Average engagement score across all participants
        </p>
      </div>

      <div className="space-y-4">
        {participants.map((participant, index) => (
          <div key={index} className="space-y-3 p-4 rounded-lg bg-transcript-bg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {participant.name}
              </span>
              <div className="flex items-center gap-2">
                <Smile className={`w-4 h-4 ${getSentimentColor(participant.sentiment)}`} />
                <span className="text-xs text-muted-foreground capitalize">
                  {participant.sentiment}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Engagement
                  </span>
                  <span className="font-medium text-foreground">
                    {participant.engagement}%
                  </span>
                </div>
                <Progress value={participant.engagement} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Attention
                  </span>
                  <span className="font-medium text-foreground">
                    {participant.attention}%
                  </span>
                </div>
                <Progress value={participant.attention} className="h-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EngagementPanel;
