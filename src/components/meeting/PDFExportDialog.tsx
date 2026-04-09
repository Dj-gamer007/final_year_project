import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Users, CheckSquare, Brain, Gavel, BarChart3, ShieldCheck } from "lucide-react";

export interface PDFExportOptions {
  includeGeneralSummary: boolean;
  includeRoleSummaries: boolean;
  includeParticipants: boolean;
  includeActionItems: boolean;
  includeDecisions: boolean;
  includeInfluence: boolean;
  includeAccountability: boolean;
}

interface PDFExportDialogProps {
  onExport: (options: PDFExportOptions) => void;
  isExporting?: boolean;
  hasGeneralSummary?: boolean;
  hasRoleSummaries?: boolean;
  hasActionItems?: boolean;
  hasParticipants?: boolean;
  hasDecisions?: boolean;
  hasInfluence?: boolean;
  hasAccountability?: boolean;
}

const PDFExportDialog = ({
  onExport,
  isExporting = false,
  hasGeneralSummary = false,
  hasRoleSummaries = false,
  hasActionItems = false,
  hasParticipants = false,
  hasDecisions = false,
  hasInfluence = false,
  hasAccountability = false,
}: PDFExportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PDFExportOptions>({
    includeGeneralSummary: true,
    includeRoleSummaries: true,
    includeParticipants: true,
    includeActionItems: true,
    includeDecisions: true,
    includeInfluence: true,
    includeAccountability: true,
  });

  const handleExport = () => {
    onExport(options);
    setOpen(false);
  };

  const sections = [
    {
      key: "includeGeneralSummary" as const,
      label: "General Summary",
      description: "Overview of the meeting discussion",
      icon: FileText,
      available: hasGeneralSummary,
    },
    {
      key: "includeRoleSummaries" as const,
      label: "Role-Based Summaries",
      description: "Summaries tailored to specific roles",
      icon: Brain,
      available: hasRoleSummaries,
    },
    {
      key: "includeParticipants" as const,
      label: "Participants",
      description: "List of meeting attendees and their roles",
      icon: Users,
      available: hasParticipants,
    },
    {
      key: "includeActionItems" as const,
      label: "Action Items",
      description: "Tasks and assignments from the meeting",
      icon: CheckSquare,
      available: hasActionItems,
    },
    {
      key: "includeDecisions" as const,
      label: "Decisions & Blockers",
      description: "Decisions, approvals, pending items, and blockers",
      icon: Gavel,
      available: hasDecisions,
    },
    {
      key: "includeInfluence" as const,
      label: "Speaker Influence",
      description: "Speaker influence scores and role classifications",
      icon: BarChart3,
      available: hasInfluence,
    },
    {
      key: "includeAccountability" as const,
      label: "Task Ownership & Accountability",
      description: "Task ownership clarity, scores, and risk flags",
      icon: ShieldCheck,
      available: hasAccountability,
    },
  ];

  const selectedCount = Object.values(options).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? "Exporting..." : "Export PDF"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Meeting Report</DialogTitle>
          <DialogDescription>
            Select which sections to include in your PDF export.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.key}
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                  options[section.key]
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <Checkbox
                  id={section.key}
                  checked={options[section.key]}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({
                      ...prev,
                      [section.key]: checked === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <Label
                      htmlFor={section.key}
                      className="font-medium cursor-pointer"
                    >
                      {section.label}
                    </Label>
                    {!section.available && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Will auto-generate
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground">
            {selectedCount} section{selectedCount !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedCount === 0 || isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PDFExportDialog;
