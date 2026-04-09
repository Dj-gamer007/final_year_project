import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface SummaryPanelLiveProps {
  selectedRole: string;
  onRoleChange: (role: string) => void;
  summaries: { [key: string]: string };
  onGenerateSummary: (role: string) => void;
}

const SummaryPanelLive = ({ selectedRole, onRoleChange, summaries, onGenerateSummary }: SummaryPanelLiveProps) => {
  const currentSummary = summaries[selectedRole];

  const roleDescriptions = {
    general: "General overview of the meeting",
    developer: "Technical implementation details",
    manager: "Project management perspective",
    client: "Client-facing project summary",
    designer: "Design and UX perspective",
    others: "General stakeholder summary"
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Role-Based View
        </label>
        <Select value={selectedRole} onValueChange={onRoleChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General Summary</SelectItem>
            <SelectItem value="developer">Developer</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="designer">Designer</SelectItem>
            <SelectItem value="others">Others</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {roleDescriptions[selectedRole as keyof typeof roleDescriptions]}
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Summary
        </h4>
        
        {!currentSummary ? (
          <div className="flex flex-col items-center justify-center h-[300px] rounded-lg bg-transcript-bg">
            <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              No summary generated for this role yet
            </p>
            <Button
              onClick={() => onGenerateSummary(selectedRole)}
              className="bg-gradient-primary"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate {selectedRole} Summary
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px] rounded-lg bg-transcript-bg p-4">
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {currentSummary}
              </p>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default SummaryPanelLive;
