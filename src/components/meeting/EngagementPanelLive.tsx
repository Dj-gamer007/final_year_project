import { Progress } from "@/components/ui/progress";
import { Activity, Eye, Smile, TrendingUp, Scan, Focus, Lock } from "lucide-react";
import { Participant } from "@/hooks/useMeetingData";
import { EmotionData, AttentionData } from "@/hooks/useFaceDetection";
import { EngagementSnapshot } from "@/hooks/useEngagementHistory";
import EngagementTrendsChart from "./EngagementTrendsChart";

interface EngagementPanelLiveProps {
  participants: Participant[];
  localEmotion?: EmotionData | null;
  localAttention?: AttentionData | null;
  localUserName?: string;
  localUserRole?: string;
  engagementHistory?: EngagementSnapshot[];
  averageAttention?: number;
  emotionDistribution?: Record<string, number>;
  dominantEmotion?: string;
}

const EngagementPanelLive = ({ 
  participants, 
  localEmotion, 
  localAttention,
  localUserName = "You",
  localUserRole = "participant",
  engagementHistory = [],
  averageAttention = 0,
  emotionDistribution = {},
  dominantEmotion = "Unknown",
}: EngagementPanelLiveProps) => {
  // Check if user is a supervisor to view all participants' engagement
  const isSupervisor = localUserRole.toLowerCase() === 'supervisor' || localUserRole.toLowerCase() === 'host' || localUserRole.toLowerCase() === 'admin';
  
  const avgEngagement = participants.length > 0
    ? Math.round(participants.reduce((sum, p) => sum + p.engagement_score, 0) / participants.length)
    : 0;

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

  const getEmotionColor = (emotion: string) => {
    if (emotion.includes("Happy")) return "text-green-500";
    if (emotion.includes("Sad")) return "text-blue-400";
    if (emotion.includes("Angry")) return "text-red-500";
    if (emotion.includes("Surprised")) return "text-yellow-500";
    if (emotion.includes("Fearful")) return "text-purple-400";
    if (emotion.includes("Disgusted")) return "text-orange-500";
    return "text-muted-foreground";
  };

  // Real-time face analysis card for local user
  const renderLocalAnalysisCard = () => {
    if (!localEmotion && !localAttention) {
      return (
        <div className="p-4 rounded-lg bg-muted/50 border border-dashed border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scan className="w-5 h-5" />
            <span className="text-sm">Face detection active - look at the camera</span>
          </div>
        </div>
      );
    }

    const isAttentive = localAttention?.isLookingAtScreen ?? false;
    const attentionScore = localAttention?.attentionScore ?? 0;
    const borderColor = isAttentive ? "border-green-500/30" : "border-yellow-500/30";
    const bgColor = isAttentive ? "bg-green-500/10" : "bg-yellow-500/10";

    return (
      <div className={`p-4 rounded-lg ${bgColor} border ${borderColor} space-y-4`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Scan className={`w-4 h-4 ${isAttentive ? "text-green-500" : "text-yellow-500"}`} />
            {localUserName}
          </span>
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            isAttentive ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-600"
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isAttentive ? "bg-green-500" : "bg-yellow-500"}`} />
            Live
          </div>
        </div>

        {/* Emotion */}
        {localEmotion && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Smile className="w-3 h-3" />
                Emotion
              </span>
              <span className={`text-sm font-semibold ${getEmotionColor(localEmotion.emotion)}`}>
                {localEmotion.emotion}
              </span>
            </div>
            <Progress value={localEmotion.confidence} className="h-2" />
          </div>
        )}

        {/* Attention */}
        {localAttention && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Focus className="w-3 h-3" />
                Attention
              </span>
              <span className={`text-sm font-semibold ${isAttentive ? "text-green-500" : "text-yellow-600"}`}>
                {isAttentive ? "👁️ Focused" : "👀 Distracted"} ({attentionScore}%)
              </span>
            </div>
            <Progress 
              value={attentionScore} 
              className={`h-2 ${isAttentive ? "" : "[&>div]:bg-yellow-500"}`} 
            />
          </div>
        )}

        {/* Head Pose Details */}
        {localAttention && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Yaw (L/R)</p>
              <p className={`text-sm font-medium ${Math.abs(localAttention.headPose.yaw) > 15 ? "text-yellow-500" : "text-foreground"}`}>
                {localAttention.headPose.yaw.toFixed(1)}°
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Pitch (U/D)</p>
              <p className={`text-sm font-medium ${Math.abs(localAttention.headPose.pitch) > 15 ? "text-yellow-500" : "text-foreground"}`}>
                {localAttention.headPose.pitch.toFixed(1)}°
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Eyes</p>
              <p className={`text-sm font-medium ${localAttention.eyeContact ? "text-green-500" : "text-yellow-500"}`}>
                {localAttention.eyeContact ? "Open" : "Closed"}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasLocalAnalysis = localEmotion || localAttention;

  if (participants.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-primary" />
            Engagement Analytics
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {hasLocalAnalysis ? "Real-time facial analysis active" : "Waiting for participants to join..."}
          </p>
          {renderLocalAnalysisCard()}
        </div>

        {/* Engagement Trends Chart */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-md font-semibold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            Engagement Trends
          </h4>
          <EngagementTrendsChart
            history={engagementHistory}
            averageAttention={averageAttention}
            dominantEmotion={dominantEmotion}
            emotionDistribution={emotionDistribution}
          />
        </div>
      </div>
    );
  }

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
          Average engagement across {participants.length} participants
        </p>
      </div>

      {/* Real-time face analysis for local user */}
      {renderLocalAnalysisCard()}

      {/* Participants engagement - only visible to supervisors */}
      {isSupervisor ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="w-4 h-4" />
            <span>Viewing all participants (Supervisor view)</span>
          </div>
          {participants.map((participant) => (
            <div key={participant.id} className="space-y-3 p-4 rounded-lg bg-transcript-bg">
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
                      {participant.engagement_score}%
                    </span>
                  </div>
                  <Progress value={participant.engagement_score} className="h-2" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Attention
                    </span>
                    <span className="font-medium text-foreground">
                      {participant.attention_score}%
                    </span>
                  </div>
                  <Progress value={participant.attention_score} className="h-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-muted/50 border border-dashed border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">Participants Analytics Restricted</p>
              <p className="text-xs">Only supervisors can view all participants' engagement data</p>
            </div>
          </div>
        </div>
      )}

      {/* Engagement Trends Chart */}
      <div className="pt-4 border-t border-border">
        <h4 className="text-md font-semibold text-foreground flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          Engagement Trends
        </h4>
        <EngagementTrendsChart
          history={engagementHistory}
          averageAttention={averageAttention}
          dominantEmotion={dominantEmotion}
          emotionDistribution={emotionDistribution}
        />
      </div>
    </div>
  );
};

export default EngagementPanelLive;
