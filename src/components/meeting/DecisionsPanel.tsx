import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, AlertTriangle, Loader2, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Decision {
  text: string;
  confidence: number;
  speaker?: string;
}

interface PendingItem {
  text: string;
  reason?: string;
}

interface Blocker {
  text: string;
  impact?: string;
}

interface DecisionData {
  decisions: Decision[];
  pending: PendingItem[];
  blockers: Blocker[];
}

interface DecisionsPanelProps {
  transcripts?: Array<{ speaker: string; text: string }>;
}

const DecisionsPanel = ({ transcripts = [] }: DecisionsPanelProps) => {
  const [data, setData] = useState<DecisionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleExtract = async () => {
    if (transcripts.length === 0) {
      toast({
        title: "No transcript available",
        description: "Start the meeting and generate a transcript first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const transcriptText = transcripts.map((t) => `${t.speaker}: ${t.text}`).join("\n");

      const { data: result, error } = await supabase.functions.invoke("extract-decisions", {
        body: { transcript: transcriptText },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setData(result);
      toast({
        title: "Decisions Extracted",
        description: `Found ${result.decisions?.length || 0} decisions, ${result.pending?.length || 0} pending, ${result.blockers?.length || 0} blockers`,
      });
    } catch (error) {
      console.error("Decision extraction error:", error);
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <Gavel className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          Analyze the transcript to detect decisions, pending items, and blockers.
        </p>
        <Button onClick={handleExtract} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Gavel className="w-4 h-4 mr-2" />
              Detect Decisions
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Decision Intelligence</h4>
        <Button variant="ghost" size="sm" onClick={handleExtract} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Re-analyze"}
        </Button>
      </div>

      <ScrollArea className="h-[350px]">
        <div className="space-y-4 pr-4">
          {/* Decisions */}
          {data.decisions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-green-500">
                  Decisions ({data.decisions.length})
                </span>
              </div>
              {data.decisions.map((d, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                >
                  <p className="text-sm text-foreground">{d.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {d.speaker && (
                      <Badge variant="outline" className="text-xs">
                        {d.speaker}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {Math.round(d.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending */}
          {data.pending.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-yellow-500">
                  Pending ({data.pending.length})
                </span>
              </div>
              {data.pending.map((p, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                >
                  <p className="text-sm text-foreground">{p.text}</p>
                  {p.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{p.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Blockers */}
          {data.blockers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
                  Blockers ({data.blockers.length})
                </span>
              </div>
              {data.blockers.map((b, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <p className="text-sm text-foreground">{b.text}</p>
                  {b.impact && (
                    <p className="text-xs text-muted-foreground mt-1">Impact: {b.impact}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.decisions.length === 0 && data.pending.length === 0 && data.blockers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No decisions, pending items, or blockers detected in the transcript.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default DecisionsPanel;
