import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Settings, 
  Users, FileText, Brain, Download, Loader2, Gavel, ShieldCheck 
} from "lucide-react";
import MeetingParticipants from "@/components/meeting/MeetingParticipants";
import TranscriptPanel from "@/components/meeting/TranscriptPanel";
import SummaryPanel from "@/components/meeting/SummaryPanel";
import ActionItemsPanel from "@/components/meeting/ActionItemsPanel";
import EngagementPanel from "@/components/meeting/EngagementPanel";
import DecisionsPanel from "@/components/meeting/DecisionsPanel";
import AccountabilityPanel from "@/components/meeting/AccountabilityPanel";
import { useToast } from "@/hooks/use-toast";

const Meeting = () => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("general");
  const { toast } = useToast();

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    toast({
      title: "Generating Summary",
      description: "AI is analyzing the meeting transcript...",
    });
    
    // Simulate AI processing
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "Summary Generated",
        description: "Meeting summary and action items are ready!",
      });
    }, 2000);
  };

  const handleExportPDF = () => {
    toast({
      title: "Exporting to PDF",
      description: "Your meeting report is being prepared...",
    });
    // PDF export logic would go here
  };

  return (
    <div className="min-h-screen bg-meeting-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Final Year Project Meeting</h1>
            <p className="text-sm text-muted-foreground">Meeting ID: FYP-2024-001</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              3 Participants
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 p-6">
        {/* Main Meeting Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Grid */}
          <Card className="p-4 bg-card">
            <MeetingParticipants />
          </Card>

          {/* Meeting Controls */}
          <Card className="p-4 bg-card">
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                variant={isMicOn ? "default" : "destructive"}
                className="rounded-full w-14 h-14"
                onClick={() => setIsMicOn(!isMicOn)}
              >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              
              <Button
                size="lg"
                variant={isVideoOn ? "default" : "destructive"}
                className="rounded-full w-14 h-14"
                onClick={() => setIsVideoOn(!isVideoOn)}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-14 h-14"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="rounded-full w-14 h-14"
              >
                <Settings className="w-5 h-5" />
              </Button>

              <Button
                size="lg"
                className="bg-gradient-primary hover:opacity-90"
                onClick={handleGenerateSummary}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Transcript */}
          <Card className="p-6 bg-card">
            <TranscriptPanel />
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Engagement Metrics */}
          <Card className="p-6 bg-card">
            <EngagementPanel />
          </Card>

          {/* AI Analysis Tabs */}
          <Card className="p-6 bg-card">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">
                  <FileText className="w-4 h-4 mr-1" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="actions">
                  <Brain className="w-4 h-4 mr-1" />
                  Actions
                </TabsTrigger>
                <TabsTrigger value="decisions">
                  <Gavel className="w-4 h-4 mr-1" />
                  Decisions
                </TabsTrigger>
                <TabsTrigger value="ownership">
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Owner
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="mt-4">
                <SummaryPanel 
                  selectedRole={selectedRole}
                  onRoleChange={setSelectedRole}
                />
              </TabsContent>
              
              <TabsContent value="actions" className="mt-4">
                <ActionItemsPanel />
              </TabsContent>

              <TabsContent value="decisions" className="mt-4">
                <DecisionsPanel />
              </TabsContent>

              <TabsContent value="ownership" className="mt-4">
                <AccountabilityPanel transcripts={[]} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Meeting;
