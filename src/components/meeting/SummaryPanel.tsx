import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SummaryPanelProps {
  selectedRole: string;
  onRoleChange: (role: string) => void;
}

const summaries = {
  general: {
    title: "General Summary",
    content: `The team discussed their final year project on AI-powered meeting summarization. Key points covered:

• Project scope includes real-time transcription, AI summarization, and multimodal analysis
• Technology stack: WebRTC for video, Whisper API for transcription, GPT-4 for summarization
• Timeline: 2 months to complete the project
• Work distribution: Split between video infrastructure, AI integration, and frontend development
• Special features: Role-based summaries and engagement tracking using facial analysis`,
  },
  developer: {
    title: "Developer Summary",
    content: `Technical implementation discussed for the meeting summarizer project:

• **Video Infrastructure**: Implement WebRTC for peer-to-peer video streaming
• **Transcription**: Integrate OpenAI Whisper API for speech-to-text conversion
• **AI Processing**: Use GPT-4 API for generating summaries and extracting action items
• **Frontend**: Build React-based UI with TypeScript
• **Multimodal Analysis**: Integrate MediaPipe or OpenCV for facial expression tracking
• **Database**: Set up AWS or Azure cloud storage for meeting data
• **Export**: Implement PDF generation for meeting reports`,
  },
  manager: {
    title: "Manager Summary",
    content: `Project management overview and deliverables:

• **Project Timeline**: 2-month development cycle
• **Team Structure**: 3-member team with divided responsibilities
• **Key Deliverables**: 
  - Real-time meeting transcription system
  - AI-powered summarization engine
  - Action item extraction feature
  - Engagement analytics dashboard
• **Resource Requirements**: OpenAI API access, cloud hosting setup
• **Risk Factors**: API integration complexity, timeline constraints
• **Success Metrics**: Accuracy of transcription, quality of summaries, user engagement tracking`,
  },
  client: {
    title: "Client Summary",
    content: `Client-facing project overview:

• **Project Goal**: Deliver an AI-powered meeting summarization tool
• **Key Benefits**: Automated note-taking, action item tracking, engagement analytics
• **Deliverables**: Real-time transcription, role-based summaries, PDF reports
• **Timeline**: On track for delivery within agreed schedule
• **Next Steps**: Review prototype, provide feedback on summary quality`,
  },
  designer: {
    title: "Designer Summary",
    content: `Design and UX considerations:

• **User Interface**: Clean, intuitive meeting dashboard with real-time updates
• **Key Screens**: Video grid, transcript panel, summary views, chat
• **UX Priorities**: Minimal friction for joining meetings, clear visual hierarchy
• **Accessibility**: Keyboard navigation, screen reader support, color contrast
• **Design System**: Consistent use of tokens, responsive layout across devices`,
  },
  others: {
    title: "Others Summary",
    content: `General stakeholder overview:

• **Purpose**: AI-powered meeting assistant for automated summarization
• **Features**: Real-time transcription, smart summaries, action item extraction
• **Collaboration**: Multi-participant video meetings with chat support
• **Output**: Exportable meeting reports with role-specific insights
• **Status**: Active development with core features operational`,
  },
};

const SummaryPanel = ({ selectedRole, onRoleChange }: SummaryPanelProps) => {
  const currentSummary = summaries[selectedRole as keyof typeof summaries];

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
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {currentSummary.title}
        </h4>
        <ScrollArea className="h-[300px] rounded-lg bg-transcript-bg p-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
              {currentSummary.content}
            </p>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SummaryPanel;
