import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const SetupMeeting = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("Final Year Project Meeting");
  const { toast } = useToast();
  const navigate = useNavigate();

  const createDemoMeeting = async () => {
    setIsCreating(true);
    try {
      // Create meeting
      const meetingCode = `FYP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: meetingTitle,
          meeting_code: meetingCode,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Create participants
      const participantNames = ["Team Member 1", "Team Member 2", "Team Member 3"];
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .insert(participantNames.map(name => ({
          meeting_id: meeting.id,
          name,
          role: 'developer',
          engagement_score: Math.floor(Math.random() * 20) + 75,
          attention_score: Math.floor(Math.random() * 20) + 75,
          sentiment: 'positive'
        })))
        .select();

      if (participantsError) throw participantsError;

      // Create sample transcripts
      const sampleTranscripts = [
        {
          text: "So for our final year project, we're focusing on real-time meeting summarization with AI. I think we should start by setting up the video conferencing infrastructure.",
          timestamp_ms: Date.now() - 240000
        },
        {
          text: "That sounds good. We should use WebRTC for the video streaming. I've researched the Whisper API for transcription - it's really accurate for speech-to-text.",
          timestamp_ms: Date.now() - 180000
        },
        {
          text: "Agreed. For the summarization part, we can use GPT-4 through OpenAI's API. We also need to implement the role-based summary feature where different roles get customized summaries.",
          timestamp_ms: Date.now() - 120000
        },
        {
          text: "Right! And don't forget about the multimodal analysis - we need to track facial expressions and engagement levels using MediaPipe or OpenCV.",
          timestamp_ms: Date.now() - 60000
        },
        {
          text: "We have two months to complete this. I suggest we split the work: one person handles the video infrastructure, another focuses on AI integration, and the third works on the frontend UI.",
          timestamp_ms: Date.now()
        }
      ];

      const { error: transcriptsError } = await supabase
        .from('transcripts')
        .insert(sampleTranscripts.map((t, index) => ({
          meeting_id: meeting.id,
          participant_id: participants[index % participants.length].id,
          content: t.text,
          timestamp_ms: t.timestamp_ms
        })));

      if (transcriptsError) throw transcriptsError;

      toast({
        title: "Meeting Created!",
        description: "Demo meeting with sample data has been set up",
      });

      // Navigate to meeting
      navigate(`/meeting-demo?id=${meeting.id}`);

    } catch (error) {
      console.error('Error creating demo meeting:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create meeting",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elevated">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-2">Create Demo Meeting</h1>
            <p className="text-muted-foreground">
              Set up a demo meeting with AI-powered features
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-left">
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="font-semibold text-sm mb-1">Features</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Real-time transcripts</li>
                  <li>• AI summaries</li>
                  <li>• Action items</li>
                  <li>• Engagement metrics</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="font-semibold text-sm mb-1">Demo Data</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 3 participants</li>
                  <li>• Sample transcript</li>
                  <li>• Engagement scores</li>
                  <li>• Meeting context</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={createDemoMeeting}
              disabled={isCreating || !meetingTitle}
              className="w-full bg-gradient-primary hover:opacity-90"
              size="lg"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Meeting...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Demo Meeting
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              This will create a demo meeting with sample data to showcase AI features
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SetupMeeting;
