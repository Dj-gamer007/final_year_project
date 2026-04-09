import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, BarChart3, Crown, User, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SpeakerInfluence {
  name: string;
  talk_time_percent: number;
  decision_words: number;
  question_count: number;
  command_count: number;
  influence_score: number;
  role_alignment: "Leader" | "Contributor" | "Observer";
  key_contributions: string;
}

interface InfluenceData {
  speakers: SpeakerInfluence[];
  meeting_leader: string;
  participation_balance: "balanced" | "moderate" | "dominated";
}

interface InfluencePanelProps {
  transcripts: { speaker: string; text: string }[];
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "Leader": return <Crown className="w-4 h-4" />;
    case "Contributor": return <User className="w-4 h-4" />;
    case "Observer": return <Eye className="w-4 h-4" />;
    default: return <User className="w-4 h-4" />;
  }
};

const getRoleStyles = (role: string) => {
  switch (role) {
    case "Leader": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "Contributor": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Observer": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const getScoreColor = (score: number) => {
  if (score >= 70) return "text-amber-400";
  if (score >= 40) return "text-blue-400";
  return "text-muted-foreground";
};

const getBalanceStyles = (balance: string) => {
  switch (balance) {
    case "balanced": return { color: "text-green-400", bg: "bg-green-500/20", label: "Well Balanced" };
    case "moderate": return { color: "text-amber-400", bg: "bg-amber-500/20", label: "Moderately Balanced" };
    case "dominated": return { color: "text-red-400", bg: "bg-red-500/20", label: "One-Sided Discussion" };
    default: return { color: "text-muted-foreground", bg: "bg-muted", label: balance };
  }
};

const InfluencePanel = ({ transcripts }: InfluencePanelProps) => {
  const [data, setData] = useState<InfluenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (transcripts.length === 0) {
      toast({ title: "No transcript", description: "Need transcript data to analyze influence.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const transcript = transcripts.map(t => `${t.speaker}: ${t.text}`).join("\n");
      const { data: result, error } = await supabase.functions.invoke("analyze-influence", {
        body: { transcript },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setData(result);
      toast({ title: "Analysis Complete", description: `Meeting led by ${result.meeting_leader}` });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message || "Could not analyze influence.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Speaker Influence
        </h3>
        <Button onClick={handleAnalyze} disabled={isLoading || transcripts.length === 0} size="sm">
          {isLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</> : "Analyze"}
        </Button>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Click "Analyze" to measure speaker influence and contributions.
        </p>
      ) : (
        <ScrollArea className="h-[350px]">
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30">
                <Crown className="w-3 h-3" /> Leader: {data.meeting_leader}
              </Badge>
              {(() => {
                const b = getBalanceStyles(data.participation_balance);
                return (
                  <Badge variant="outline" className={`${b.bg} ${b.color} border-border`}>
                    {b.label}
                  </Badge>
                );
              })()}
            </div>

            {/* Speaker Cards */}
            {data.speakers
              .sort((a, b) => b.influence_score - a.influence_score)
              .map((speaker, idx) => (
                <div key={idx} className="rounded-lg border bg-card/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{speaker.name}</span>
                      <Badge variant="outline" className={`text-xs ${getRoleStyles(speaker.role_alignment)}`}>
                        {getRoleIcon(speaker.role_alignment)}
                        <span className="ml-1">{speaker.role_alignment}</span>
                      </Badge>
                    </div>
                    <span className={`text-lg font-bold ${getScoreColor(speaker.influence_score)}`}>
                      {Math.round(speaker.influence_score)}
                    </span>
                  </div>

                  <Progress value={speaker.influence_score} className="h-2" />

                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="text-center">
                      <div className="font-medium text-foreground">{Math.round(speaker.talk_time_percent)}%</div>
                      <div>Talk Time</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-foreground">{speaker.decision_words}</div>
                      <div>Decisions</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-foreground">{speaker.question_count}</div>
                      <div>Questions</div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic">{speaker.key_contributions}</p>
                </div>
              ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default InfluencePanel;
