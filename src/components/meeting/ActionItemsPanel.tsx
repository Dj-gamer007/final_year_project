import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const actionItems = [
  {
    id: 1,
    task: "Set up WebRTC infrastructure for video streaming",
    assignee: "Team Member 1",
    priority: "high",
    status: "pending",
  },
  {
    id: 2,
    task: "Integrate Whisper API for real-time transcription",
    assignee: "Team Member 2",
    priority: "high",
    status: "pending",
  },
  {
    id: 3,
    task: "Implement GPT-4 integration for summarization",
    assignee: "Team Member 2",
    priority: "high",
    status: "pending",
  },
  {
    id: 4,
    task: "Build React frontend with TypeScript",
    assignee: "Team Member 3",
    priority: "medium",
    status: "pending",
  },
  {
    id: 5,
    task: "Integrate MediaPipe for facial analysis",
    assignee: "Team Member 1",
    priority: "medium",
    status: "pending",
  },
  {
    id: 6,
    task: "Set up cloud database (AWS/Azure)",
    assignee: "Team Member 3",
    priority: "medium",
    status: "pending",
  },
  {
    id: 7,
    task: "Implement PDF export functionality",
    assignee: "Team Member 3",
    priority: "low",
    status: "pending",
  },
];

const ActionItemsPanel = () => {
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
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {item.assignee}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ActionItemsPanel;
