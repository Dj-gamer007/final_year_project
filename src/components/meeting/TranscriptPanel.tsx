import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "lucide-react";

const mockTranscript = [
  {
    speaker: "Team Member 1",
    timestamp: "10:23",
    text: "So for our final year project, we're focusing on real-time meeting summarization with AI. I think we should start by setting up the video conferencing infrastructure.",
  },
  {
    speaker: "Team Member 2",
    timestamp: "10:24",
    text: "That sounds good. We should use WebRTC for the video streaming. I've researched the Whisper API for transcription - it's really accurate for speech-to-text.",
  },
  {
    speaker: "Team Member 3",
    timestamp: "10:25",
    text: "Agreed. For the summarization part, we can use GPT-4 through OpenAI's API. We also need to implement the role-based summary feature where different roles get customized summaries.",
  },
  {
    speaker: "Team Member 1",
    timestamp: "10:26",
    text: "Right! And don't forget about the multimodal analysis - we need to track facial expressions and engagement levels using MediaPipe or OpenCV.",
  },
  {
    speaker: "Team Member 2",
    timestamp: "10:27",
    text: "We have two months to complete this. I suggest we split the work: one person handles the video infrastructure, another focuses on AI integration, and the third works on the frontend UI.",
  },
];

const TranscriptPanel = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Live Transcript</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm text-muted-foreground">Recording</span>
        </div>
      </div>

      <ScrollArea className="h-[400px] rounded-lg bg-transcript-bg p-4">
        <div className="space-y-4">
          {mockTranscript.map((entry, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground">
                    {entry.speaker}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.timestamp}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {entry.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TranscriptPanel;
