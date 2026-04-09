import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, AlertTriangle, User, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccountabilityTask {
  task: string;
  owner: string | null;
  deadline: string | null;
  ownership_clarity: "clear" | "ambiguous" | "missing";
  accountability_score: number;
}

export interface AccountabilityData {
  tasks: AccountabilityTask[];
  unassigned_count: number;
  average_score: number;
  risk_summary: string;
}

interface AccountabilityPanelProps {
  transcripts: { speaker: string; text: string }[];
  onDataChange?: (data: AccountabilityData | null) => void;
}

const AccountabilityPanel = ({ transcripts, onDataChange }: AccountabilityPanelProps) => {
  const [data, setData] = useState<AccountabilityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (transcripts.length === 0) {
      toast({
        title: "No Transcript",
        description: "Start speaking to generate a transcript first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');

      const { data: result, error } = await supabase.functions.invoke('track-accountability', {
        body: { transcript: transcriptText },
      });

      if (error) throw error;
      setData(result);
      onDataChange?.(result);
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze accountability",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getClarityStyles = (clarity: string) => {
    switch (clarity) {
      case "clear":
        return { variant: "default" as const, className: "bg-success text-success-foreground" };
      case "ambiguous":
        return { variant: "default" as const, className: "bg-warning text-warning-foreground" };
      case "missing":
        return { variant: "destructive" as const, className: "" };
      default:
        return { variant: "secondary" as const, className: "" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Accountability Tracker
        </h4>
        <Button size="sm" onClick={handleAnalyze} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {isLoading ? "Analyzing..." : "Track Ownership"}
        </Button>
      </div>

      {!data && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Click "Track Ownership" to analyze task accountability
        </p>
      )}

      {data && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Avg Score</p>
              <p className={`text-xl font-bold ${getScoreColor(data.average_score)}`}>
                {data.average_score}%
              </p>
              <Progress value={data.average_score} className="mt-1 h-1.5" />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Unassigned</p>
              <p className={`text-xl font-bold ${data.unassigned_count > 0 ? "text-destructive" : "text-success"}`}>
                {data.unassigned_count}
              </p>
              {data.unassigned_count > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" /> Risk
                </p>
              )}
            </div>
          </div>

          {/* Risk Summary */}
          {data.risk_summary && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">Risk Assessment</p>
              <p className="text-sm text-foreground">{data.risk_summary}</p>
            </div>
          )}

          {/* Task List */}
          <ScrollArea className="h-[250px]">
            <div className="space-y-2 pr-4">
              {data.tasks.map((task, i) => {
                const clarityStyle = getClarityStyles(task.ownership_clarity);
                return (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-transcript-bg border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground mb-2">{task.task}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Badge variant={clarityStyle.variant} className={`text-xs ${clarityStyle.className}`}>
                        {task.ownership_clarity}
                      </Badge>
                      {task.owner && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="w-3 h-3" /> {task.owner}
                        </span>
                      )}
                      {task.deadline && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-3 h-3" /> {task.deadline}
                        </span>
                      )}
                      <span className={`font-semibold ml-auto ${getScoreColor(task.accountability_score)}`}>
                        {task.accountability_score}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default AccountabilityPanel;
