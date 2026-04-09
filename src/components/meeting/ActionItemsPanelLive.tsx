import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActionItem } from "@/hooks/useMeetingData";

interface ActionItemsPanelLiveProps {
  actionItems: ActionItem[];
}

const ActionItemsPanelLive = ({ actionItems }: ActionItemsPanelLiveProps) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Action Items</h4>
        <Badge variant="outline">{actionItems.length} items</Badge>
      </div>

      <ScrollArea className="h-[350px]">
        {actionItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <p>No action items extracted yet</p>
          </div>
        ) : (
          <div className="space-y-3 pr-4">
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-transcript-bg border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {item.task}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                        {item.priority}
                      </Badge>
                      {item.assignee && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {item.assignee}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ActionItemsPanelLive;
