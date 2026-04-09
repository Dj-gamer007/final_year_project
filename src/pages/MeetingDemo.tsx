import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Settings, 
  Users, FileText, Brain, Loader2, Copy, Check,
  Monitor, MonitorOff, MessageCircle, Disc, Mail, Gavel, BarChart3, ShieldCheck
} from "lucide-react";
import ConnectionStatus from "@/components/meeting/ConnectionStatus";
import VideoGridPeer from "@/components/meeting/VideoGridPeer";
import TranscriptPanelLive from "@/components/meeting/TranscriptPanelLive";
import SummaryPanelLive from "@/components/meeting/SummaryPanelLive";
import ActionItemsPanelLive from "@/components/meeting/ActionItemsPanelLive";
import EngagementPanelLive from "@/components/meeting/EngagementPanelLive";
import ChatPanel from "@/components/meeting/ChatPanel";
import RecordingControls from "@/components/meeting/RecordingControls";
import RecordingsPanel from "@/components/meeting/RecordingsPanel";
import PDFExportDialog, { PDFExportOptions } from "@/components/meeting/PDFExportDialog";
import DecisionsPanel from "@/components/meeting/DecisionsPanel";
import InfluencePanel from "@/components/meeting/InfluencePanel";
import AccountabilityPanel, { AccountabilityData } from "@/components/meeting/AccountabilityPanel";
import TranslationSelector from "@/components/meeting/TranslationSelector";
import ParticipantsPanel, { Participant } from "@/components/meeting/ParticipantsPanel";
import { useMeetingData } from "@/hooks/useMeetingData";
import { useWebRTCPeer } from "@/hooks/useWebRTCPeer";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useEngagementHistory } from "@/hooks/useEngagementHistory";
import { useDistractionAlert } from "@/hooks/useDistractionAlert";
import { useSpeakerIdentification } from "@/hooks/useSpeakerIdentification";
import { useTranscriptTranslation } from "@/hooks/useTranscriptTranslation";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { setupUnicodeFontForPDF } from "@/lib/pdfFonts";
import { needsHtml2CanvasExport, exportPDFViaHtml2Canvas } from "@/lib/pdfHtmlExport";
import { ThemeToggle } from "@/components/ThemeToggle";
import MeetingSettingsDialog from "@/components/meeting/MeetingSettingsDialog";

const MeetingDemo = () => {
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get('id') || '';
  const userName = searchParams.get('name') || '';
  const userRole = searchParams.get('role') || 'participant';
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("general");
  const [copied, setCopied] = useState(false);
  const [localFaceAnalysis, setLocalFaceAnalysis] = useState<import("@/components/meeting/VideoGridPeer").FaceAnalysisData | null>(null);
  const hasJoinedRef = useRef(false);
  const [translationLanguage, setTranslationLanguage] = useState("none");
  const [meetingCode, setMeetingCode] = useState<string | null>(null);
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
  const [recognitionLanguage, setRecognitionLanguage] = useState("en-US");
  const [decisionsData, setDecisionsData] = useState<{
    decisions: { text: string; confidence?: number; speaker?: string }[];
    pending: { text: string; reason?: string }[];
    blockers: { text: string; impact?: string }[];
  } | null>(null);
  const [influenceData, setInfluenceData] = useState<{
    speakers: { name: string; talk_time_percent: number; decision_words: number; question_count: number; command_count: number; influence_score: number; role_alignment: string; key_contributions: string }[];
    meeting_leader: string;
    participation_balance: string;
  } | null>(null);
  const [accountabilityData, setAccountabilityData] = useState<AccountabilityData | null>(null);

  // Engagement history tracking
  const {
    history: engagementHistory,
    recordSnapshot,
    getAverageAttention,
    getEmotionDistribution,
    getDominantEmotion,
  } = useEngagementHistory({ maxDataPoints: 60, sampleIntervalMs: 5000 });

  // Generate a stable user ID for this session
  const userId = useMemo(() => {
    if (!meetingId || !userName) return '';
    const key = `meeting-user-${meetingId}-${userName}`;
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const newId = crypto.randomUUID();
    sessionStorage.setItem(key, newId);
    return newId;
  }, [meetingId, userName]);

  // Check if we have valid params to proceed
  const isValidSession = Boolean(meetingId && userName && userId);

  // WebRTC hook - only meaningful when we have valid session
  const {
    localStream,
    screenStream,
    remoteStreams,
    isVideoOn,
    isAudioOn,
    isScreenSharing,
    error: mediaError,
    isConnecting,
    connectedPeers,
    wasKicked,
    wasMutedRemotely,
    joinMeeting,
    leaveMeeting,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    requestMuteParticipant,
    kickParticipant,
    clearMutedRemotely,
  } = useWebRTCPeer(
    isValidSession ? meetingId : '', 
    isValidSession ? userId : '', 
    isValidSession ? userName : ''
  );

  // Meeting data hook
  const {
    transcripts,
    actionItems,
    participants,
    summaries,
    isLoading,
    generateSummary,
    extractActionItems
  } = useMeetingData(isValidSession ? meetingId : '');

  // Chat hooks
  const {
    messages: chatMessages,
    isLoading: chatLoading,
    sendMessage
  } = useChatMessages(
    isValidSession ? meetingId : '', 
    isValidSession ? userId : '', 
    isValidSession ? userName : ''
  );

  const {
    typingUsers,
    startTyping,
    stopTyping
  } = useTypingIndicator(
    isValidSession ? meetingId : '', 
    isValidSession ? userId : '', 
    isValidSession ? userName : ''
  );

  const {
    reactions,
    toggleReaction
  } = useMessageReactions(
    isValidSession ? meetingId : '', 
    isValidSession ? userId : '', 
    isValidSession ? userName : ''
  );

  // Find participant ID for speech recognition
  const participantId = useMemo(() => {
    if (!isValidSession) return '';
    const stored = sessionStorage.getItem(`participant-${meetingId}-${userId}`);
    if (stored) return stored;
    const currentParticipant = participants.find(p => p.name === userName);
    if (currentParticipant?.id) {
      sessionStorage.setItem(`participant-${meetingId}-${userId}`, currentParticipant.id);
      return currentParticipant.id;
    }
    return '';
  }, [isValidSession, meetingId, userId, userName, participants]);

  // Speech recognition - only enable when we have a valid session AND audio is on
  const {
    isListening,
    isSupported: isSpeechSupported,
    interimTranscript,
    optimisticTranscripts,
    clearConfirmedOptimistic,
  } = useSpeechRecognition({
    meetingId: isValidSession ? meetingId : '',
    participantId,
    participantName: userName,
    isEnabled: isValidSession && isAudioOn,
    enableNoiseReduction: noiseReductionEnabled,
    recognitionLanguage,
  });

  // Clear confirmed optimistic transcripts when db transcripts update
  useEffect(() => {
    if (transcripts.length > 0) {
      clearConfirmedOptimistic();
    }
  }, [transcripts, clearConfirmedOptimistic]);

  // Speaker identification for transcript tagging
  const remoteParticipantsMap = useMemo(() => {
    const map = new Map<string, { name: string; peerId: string }>();
    remoteStreams.forEach((data, peerId) => {
      map.set(peerId, { name: data.name || 'Unknown', peerId });
    });
    return map;
  }, [remoteStreams]);

  const {
    speakerList,
    updateSpeakerName,
    loadStoredOverrides,
  } = useSpeakerIdentification({
    meetingId: isValidSession ? meetingId : '',
    localUserName: userName,
    localUserId: userId,
    remoteParticipants: remoteParticipantsMap,
  });

  // Load stored speaker overrides on mount
  useEffect(() => {
    if (isValidSession) {
      loadStoredOverrides();
    }
  }, [isValidSession, loadStoredOverrides]);

  // Audio recording hook
  const {
    isRecording,
    isPaused,
    formattedDuration,
    isUploading,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecording({ meetingId: isValidSession ? meetingId : '' });

  // Transcript translation hook
  const {
    translatedTranscripts,
    isTranslating,
  } = useTranscriptTranslation({
    transcripts,
    targetLanguage: translationLanguage,
  });

  // Handle redirects
  useEffect(() => {
    if (!meetingId) {
      navigate('/', { replace: true });
      return;
    }
    if (!userName) {
      navigate(`/join?id=${meetingId}`, { replace: true });
      return;
    }
  }, [meetingId, userName, navigate]);

  // Fetch meeting code from database
  useEffect(() => {
    const fetchMeetingCode = async () => {
      if (!meetingId) return;
      const { data, error } = await supabase
        .from('meetings')
        .select('meeting_code')
        .eq('id', meetingId)
        .single();
      
      if (!error && data?.meeting_code) {
        setMeetingCode(data.meeting_code);
      }
    };
    fetchMeetingCode();
  }, [meetingId]);

  // Join meeting only once when session becomes valid
  useEffect(() => {
    if (!isValidSession || hasJoinedRef.current) return;
    
    console.log('Joining meeting:', { meetingId, userId, userName });
    hasJoinedRef.current = true;
    joinMeeting();
  }, [isValidSession, meetingId, userId, userName, joinMeeting]);

  // Show media errors
  useEffect(() => {
    if (mediaError) {
      toast({
        title: "Camera/Microphone Error",
        description: mediaError,
        variant: "destructive"
      });
    }
  }, [mediaError, toast]);

  // Handle being kicked from meeting
  useEffect(() => {
    if (wasKicked) {
      toast({
        title: "Removed from Meeting",
        description: "You have been removed from this meeting by the host.",
        variant: "destructive"
      });
      leaveMeeting();
      hasJoinedRef.current = false;
      navigate('/');
    }
  }, [wasKicked, leaveMeeting, navigate, toast]);

  // Handle being muted remotely
  useEffect(() => {
    if (wasMutedRemotely) {
      toast({
        title: "Muted by Host",
        description: "The host has muted your microphone.",
      });
      clearMutedRemotely();
    }
  }, [wasMutedRemotely, clearMutedRemotely, toast]);

  // Record engagement snapshots when face analysis updates
  useEffect(() => {
    if (localFaceAnalysis?.emotion || localFaceAnalysis?.attention) {
      recordSnapshot(localFaceAnalysis.emotion, localFaceAnalysis.attention);
    }
  }, [localFaceAnalysis, recordSnapshot]);

  // Distraction alert - warns when attention is low for 30+ seconds
  useDistractionAlert({
    attention: localFaceAnalysis?.attention ?? null,
    threshold: 60,
    durationMs: 30000,
    isEnabled: isVideoOn && !isScreenSharing,
  });

  const handleEndCall = async () => {
    // Send summary emails to all participants before leaving
    if (Object.keys(summaries).length > 0 || actionItems.length > 0) {
      try {
        toast({
          title: "Sending summaries...",
          description: "Emailing meeting summary to all participants",
        });

        const { data, error } = await supabase.functions.invoke('send-meeting-summary', {
          body: {
            meetingId,
            meetingTitle: `AI Meeting ${meetingId.slice(0, 8)}`,
            summaries,
            actionItems,
            participants,
            decisions: decisionsData,
            influence: influenceData,
            accountability: accountabilityData,
          },
        });

        if (error) {
          console.error('Error sending summary emails:', error);
          toast({
            title: "Email Error",
            description: "Could not send summary emails. Meeting ended.",
            variant: "destructive",
          });
        } else if (data?.emailsSent > 0) {
          toast({
            title: "Summaries Sent",
            description: `Sent meeting summary to ${data.emailsSent} participant(s)`,
          });
        } else {
          toast({
            title: "No Emails Sent",
            description: "No participants had email addresses configured",
          });
        }
      } catch (err) {
        console.error('Failed to send summary emails:', err);
      }
    }

    leaveMeeting();
    hasJoinedRef.current = false;
    navigate('/');
  };

  const handleCopyLink = async () => {
    const meetingUrl = `${window.location.origin}/join?id=${meetingId}`;
    await navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    toast({
      title: "Link Copied",
      description: "Meeting link copied to clipboard. Share it with others to join!",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendSummaryEmail = async () => {
    if (Object.keys(summaries).length === 0 && actionItems.length === 0) {
      toast({
        title: "Nothing to Send",
        description: "Generate a summary or extract action items first.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          meetingId,
          meetingTitle: `AI Meeting ${meetingId.slice(0, 8)}`,
          summaries,
          actionItems,
          participants,
          decisions: decisionsData,
          influence: influenceData,
          accountability: accountabilityData,
        },
      });

      if (error) throw error;

      if (data?.emailsSent > 0) {
        toast({
          title: "Summaries Sent",
          description: `Emailed meeting summary to ${data.emailsSent} participant(s)`,
        });
      } else {
        toast({
          title: "No Emails Sent",
          description: "No participants have email addresses configured.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Email Error",
        description: err.message || "Failed to send summary emails.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    await generateSummary(selectedRole);
    setIsGenerating(false);
  };

  const handleExtractActionItems = async () => {
    setIsGenerating(true);
    await extractActionItems();
    setIsGenerating(false);
  };

  const handleExportPDF = async (options: PDFExportOptions) => {
    // Check if the current user is a manager (case-insensitive)
    const isManager = userRole?.toLowerCase() === 'manager';
    
    // Get the role-specific summary type based on user role
    const summaryRole = userRole?.toLowerCase() || 'general';

    // Check if we have transcripts to generate from
    if (transcripts.length === 0) {
      toast({
        title: "No Transcript Available",
        description: "There's no meeting content to export. Start speaking to generate transcripts.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Auto-generate summary for the user's role if not already generated
      let currentSummaries = { ...summaries };
      if (options.includeGeneralSummary && !summaries['general']) {
        toast({
          title: "Generating Summary",
          description: "Creating general summary from transcript...",
        });
        
        const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
        
        const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
          body: { transcript: transcriptText, role: 'general' }
        });

        if (summaryError) throw summaryError;

        await supabase.from('summaries').insert({
          meeting_id: meetingId,
          role: 'general',
          content: summaryData.summary
        });

        currentSummaries['general'] = summaryData.summary;
      }

      if (options.includeRoleSummaries && summaryRole !== 'general' && !summaries[summaryRole]) {
        toast({
          title: "Generating Summary",
          description: `Creating ${summaryRole} summary from transcript...`,
        });
        
        const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
        
        const { data: summaryData, error: summaryError } = await supabase.functions.invoke('generate-summary', {
          body: { transcript: transcriptText, role: summaryRole }
        });

        if (summaryError) throw summaryError;

        await supabase.from('summaries').insert({
          meeting_id: meetingId,
          role: summaryRole,
          content: summaryData.summary
        });

        currentSummaries[summaryRole] = summaryData.summary;
      }

      // Auto-extract action items if none exist
      let currentActionItems = [...actionItems];
      if (options.includeActionItems && actionItems.length === 0) {
        toast({
          title: "Extracting Action Items",
          description: "Identifying action items from transcript...",
        });
        
        const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
        
        const { data: actionData, error: actionError } = await supabase.functions.invoke('extract-action-items', {
          body: { transcript: transcriptText }
        });

        if (actionError) throw actionError;

        const itemsToInsert = actionData.actionItems.map((item: any) => ({
          meeting_id: meetingId,
          ...item
        }));

        if (itemsToInsert.length > 0) {
          await supabase.from('action_items').insert(itemsToInsert);
          currentActionItems = itemsToInsert;
        }
      }

      // Auto-extract decisions if not already extracted
      let currentDecisions = decisionsData;
      if (options.includeDecisions && !decisionsData) {
        toast({
          title: "Detecting Decisions",
          description: "Extracting decisions, approvals, and blockers...",
        });
        
        const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
        
        const { data: decData, error: decError } = await supabase.functions.invoke('extract-decisions', {
          body: { transcript: transcriptText }
        });

        if (decError) {
          console.warn('Failed to extract decisions for PDF:', decError);
        } else {
          currentDecisions = decData;
          setDecisionsData(decData);
        }
      }

      // Auto-extract influence if not already extracted
      let currentInfluence = influenceData;
      if (options.includeInfluence && !influenceData) {
        toast({
          title: "Analyzing Influence",
          description: "Measuring speaker contributions and influence...",
        });
        
        const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
        
        const { data: infData, error: infError } = await supabase.functions.invoke('analyze-influence', {
          body: { transcript: transcriptText }
        });

        if (infError) {
          console.warn('Failed to analyze influence for PDF:', infError);
        } else {
          currentInfluence = infData;
          setInfluenceData(infData);
        }
      }

      // Auto-extract accountability if not already extracted
      let currentAccountability = accountabilityData;
      if (options.includeAccountability && !accountabilityData) {
        toast({
          title: "Tracking Accountability",
          description: "Analyzing task ownership and accountability...",
        });
        
        const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
        
        const { data: accData, error: accError } = await supabase.functions.invoke('track-accountability', {
          body: { transcript: transcriptText }
        });

        if (accError) {
          console.warn('Failed to track accountability for PDF:', accError);
        } else {
          currentAccountability = accData;
          setAccountabilityData(accData);
        }
      }

      // Check if content contains non-Latin scripts (Tamil, Hindi, etc.)
      const contentSamples = [
        ...transcripts.map(t => `${t.speaker}: ${t.text}`),
        ...Object.values(currentSummaries),
        ...currentActionItems.map((item: any) => item.task || ''),
        ...participants.map(p => p.name),
      ];

      if (needsHtml2CanvasExport(contentSamples)) {
        // Use html2canvas approach for perfect non-Latin rendering
        await exportPDFViaHtml2Canvas({
          meetingId,
          transcripts,
          summaries: currentSummaries,
          actionItems: currentActionItems,
          participants,
          decisions: currentDecisions,
          influence: currentInfluence,
          accountability: currentAccountability,
          options,
          isManager,
          summaryRole,
        });

        toast({
          title: "PDF Exported",
          description: "Your meeting report has been downloaded.",
        });
        setIsGenerating(false);
        return;
      }

      // Latin-only content: use jsPDF text rendering for best quality
      const doc = new jsPDF();
      await setupUnicodeFontForPDF(doc, contentSamples);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;
      let pageNumber = 1;

      // Color palette
      const primaryColor = { r: 37, g: 99, b: 235 }; // Blue
      const accentColor = { r: 16, g: 185, b: 129 }; // Green
      const darkGray = { r: 55, g: 65, b: 81 };
      const lightGray = { r: 243, g: 244, b: 246 };
      const mediumGray = { r: 107, g: 114, b: 128 };

      // Helper function to add header
      const addHeader = () => {
        // Header background
        doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        // Header text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("MEETING REPORT", margin, 28);
        
        // Meeting info in header
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Meeting ID: ${meetingId.slice(0, 8).toUpperCase()}`, pageWidth - margin, 20, { align: "right" });
        doc.text(`Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin, 28, { align: "right" });
        doc.text(`Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 36, { align: "right" });
        
        return 55;
      };

      // Helper function to add footer
      const addFooter = (pageNum: number) => {
        const footerY = pageHeight - 15;
        
        // Footer line
        doc.setDrawColor(mediumGray.r, mediumGray.g, mediumGray.b);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        
        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
        doc.setFont("helvetica", "normal");
        doc.text("Generated by AI Meeting Assistant", margin, footerY);
        doc.text(`Page ${pageNum}`, pageWidth - margin, footerY, { align: "right" });
        doc.text("Confidential", pageWidth / 2, footerY, { align: "center" });
      };

      // Helper function to add section header
      const addSectionHeader = (title: string, icon?: string) => {
        if (yPos > pageHeight - 60) {
          addFooter(pageNumber);
          doc.addPage();
          pageNumber++;
          yPos = addHeader();
        }
        
        // Section background
        doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        doc.roundedRect(margin, yPos - 5, contentWidth, 12, 2, 2, 'F');
        
        // Section title
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
        doc.text(title.toUpperCase(), margin + 5, yPos + 3);
        
        yPos += 15;
      };

      // Helper function to check page break
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos > pageHeight - requiredSpace - 20) {
          addFooter(pageNumber);
          doc.addPage();
          pageNumber++;
          yPos = addHeader();
        }
      };

      // Helper function to render text with markdown bold (**text**) as actual bold
      const renderTextWithBold = (text: string, x: number, y: number, maxWidth: number) => {
        // Remove ** and split into segments with bold info
        const segments: { text: string; bold: boolean }[] = [];
        const regex = /\*\*([^*]+)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
          // Add text before the match (normal)
          if (match.index > lastIndex) {
            segments.push({ text: text.slice(lastIndex, match.index), bold: false });
          }
          // Add the matched text (bold)
          segments.push({ text: match[1], bold: true });
          lastIndex = match.index + match[0].length;
        }
        // Add remaining text after last match
        if (lastIndex < text.length) {
          segments.push({ text: text.slice(lastIndex), bold: false });
        }

        // If no bold markers found, just return cleaned text
        if (segments.length === 0) {
          return text;
        }

        // Combine segments back into clean text for line splitting
        const cleanText = segments.map(s => s.text).join('');
        return cleanText;
      };

      // Helper function to render a line with inline bold formatting
      const renderLineWithBold = (line: string, x: number, y: number) => {
        const regex = /\*\*([^*]+)\*\*/g;
        let lastIndex = 0;
        let currentX = x;
        let match;

        while ((match = regex.exec(line)) !== null) {
          // Render text before the match (normal)
          if (match.index > lastIndex) {
            const normalText = line.slice(lastIndex, match.index);
            doc.setFont("helvetica", "normal");
            doc.text(normalText, currentX, y);
            currentX += doc.getTextWidth(normalText);
          }
          // Render the matched text (bold)
          const boldText = match[1];
          doc.setFont("helvetica", "bold");
          doc.text(boldText, currentX, y);
          currentX += doc.getTextWidth(boldText);
          lastIndex = match.index + match[0].length;
        }
        // Render remaining text after last match
        if (lastIndex < line.length) {
          const remainingText = line.slice(lastIndex);
          doc.setFont("helvetica", "normal");
          doc.text(remainingText, currentX, y);
        }
        // If no bold markers found, render normally
        if (lastIndex === 0) {
          doc.setFont("helvetica", "normal");
          doc.text(line, x, y);
        }
      };

      // Helper function to render bullet points properly
      const renderBulletContent = (content: string, indentLevel: number = 0) => {
        const paragraphs = content.split('\n');
        
        paragraphs.forEach((paragraph: string) => {
          const trimmedPara = paragraph.trim();
          if (!trimmedPara) return;
          
          // Check if it's a bullet point (starts with *, -, or •)
          const bulletMatch = trimmedPara.match(/^([\*\-•])\s+(.*)$/);
          const isBullet = bulletMatch !== null;
          
          if (isBullet) {
            checkPageBreak(8);
            const bulletText = bulletMatch![2];
            const baseIndent = margin + 10 + (indentLevel * 10);
            
            // Draw bullet point circle
            doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
            doc.circle(baseIndent - 4, yPos - 1.5, 1.5, 'F');
            
            // Split text to fit available width
            const availableWidth = contentWidth - 15 - (indentLevel * 10);
            const lines = doc.splitTextToSize(bulletText, availableWidth);
            
            lines.forEach((line: string, lineIndex: number) => {
              if (lineIndex > 0) checkPageBreak(6);
              doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
              renderLineWithBold(line, baseIndent, yPos);
              yPos += 5;
            });
            yPos += 2; // Extra space after bullet
          } else {
            // Regular paragraph text
            const availableWidth = contentWidth - 10;
            const lines = doc.splitTextToSize(trimmedPara, availableWidth);
            
            lines.forEach((line: string) => {
              checkPageBreak(6);
              doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
              renderLineWithBold(line, margin + 5, yPos);
              yPos += 5;
            });
            yPos += 3;
          }
        });
      };

      // First page header
      yPos = addHeader();

      // Executive Summary Box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.setLineWidth(1);
      doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'FD');
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text("EXECUTIVE SUMMARY", margin + 5, yPos + 8);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
      const summaryText = `This report contains ${transcripts.length} transcript entries, meeting summaries, ${currentActionItems.length} action items, and ${participants.length} participants.`;
      doc.text(summaryText, margin + 5, yPos + 18);
      yPos += 35;

      // 1. GENERAL SUMMARY SECTION
      if (options.includeGeneralSummary) {
        const generalSummary = currentSummaries['general'];
        if (generalSummary) {
          addSectionHeader("General Summary");
          
          doc.setFontSize(10);
          renderBulletContent(generalSummary);
          yPos += 5;
        }
      }

      // 2. ROLE-BASED SUMMARIES SECTION
      if (options.includeRoleSummaries) {
        const roleSummaries = Object.entries(currentSummaries).filter(([role]) => role !== 'general');
        if (roleSummaries.length > 0) {
          addSectionHeader("Role-Based Summaries");
          
          roleSummaries.forEach(([role, content]) => {
            checkPageBreak(40);
            
            // Role badge
            const roleWidth = doc.getTextWidth(role.toUpperCase()) + 6;
            doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
            doc.roundedRect(margin, yPos - 3, roleWidth > 25 ? roleWidth : 25, 7, 1, 1, 'F');
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(role.toUpperCase(), margin + 3, yPos + 1.5);
            yPos += 10;
            
            // Summary content with proper bullet formatting
            doc.setFontSize(10);
            renderBulletContent(content);
            yPos += 5;
          });
        }
      }

      // 3. PARTICIPANTS SECTION
      if (options.includeParticipants) {
        addSectionHeader("Participants");
        
        // Participants table header
        doc.setFillColor(darkGray.r, darkGray.g, darkGray.b);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("NAME", margin + 5, yPos + 5.5);
        doc.text("ROLE", margin + 70, yPos + 5.5);
        if (isManager) {
          doc.text("ENGAGEMENT", margin + 120, yPos + 5.5);
        }
        yPos += 10;
        
        // Participants rows
        doc.setFont("helvetica", "normal");
        participants.forEach((p, index) => {
          checkPageBreak(10);
          
          // Alternating row colors
          if (index % 2 === 0) {
            doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
            doc.rect(margin, yPos - 2, contentWidth, 8, 'F');
          }
          
          doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          doc.setFontSize(9);
          doc.text(p.name, margin + 5, yPos + 4);
          doc.text(p.role.charAt(0).toUpperCase() + p.role.slice(1), margin + 70, yPos + 4);
          
          if (isManager) {
            // Engagement score with color indicator
            const score = p.engagement_score || 0;
            const scoreColor = score >= 70 ? accentColor : score >= 40 ? { r: 251, g: 191, b: 36 } : { r: 239, g: 68, b: 68 };
            doc.setTextColor(scoreColor.r, scoreColor.g, scoreColor.b);
            doc.setFont("helvetica", "bold");
            doc.text(`${score}%`, margin + 120, yPos + 4);
            
            // Mini progress bar
            doc.setFillColor(220, 220, 220);
            doc.rect(margin + 135, yPos + 1, 30, 3, 'F');
            doc.setFillColor(scoreColor.r, scoreColor.g, scoreColor.b);
            doc.rect(margin + 135, yPos + 1, (score / 100) * 30, 3, 'F');
          }
          yPos += 8;
        });
        yPos += 10;
      }

      // Action Items Section
      if (options.includeActionItems && currentActionItems.length > 0) {
        addSectionHeader("Action Items");
        
        currentActionItems.forEach((item: any, index: number) => {
          checkPageBreak(25);
          
          // Action item card
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.5);
          doc.roundedRect(margin, yPos - 3, contentWidth, 20, 2, 2, 'FD');
          
          // Number badge
          doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
          doc.circle(margin + 8, yPos + 5, 5, 'F');
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          doc.text(`${index + 1}`, margin + 6, yPos + 7);
          
          // Task text
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          const taskLines = doc.splitTextToSize(item.task, contentWidth - 30);
          doc.text(taskLines[0], margin + 18, yPos + 4);
          
          // Priority badge
          const priorityColors: Record<string, { r: number, g: number, b: number }> = {
            high: { r: 239, g: 68, b: 68 },
            medium: { r: 251, g: 191, b: 36 },
            low: { r: 16, g: 185, b: 129 }
          };
          const pColor = priorityColors[item.priority?.toLowerCase()] || priorityColors.medium;
          doc.setFillColor(pColor.r, pColor.g, pColor.b);
          doc.roundedRect(margin + 18, yPos + 8, 18, 5, 1, 1, 'F');
          doc.setFontSize(6);
          doc.setTextColor(255, 255, 255);
          doc.text(item.priority?.toUpperCase() || 'MEDIUM', margin + 20, yPos + 11.5);
          
          // Status badge
          const statusColor = item.status === 'completed' ? accentColor : { r: 107, g: 114, b: 128 };
          doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
          doc.roundedRect(margin + 40, yPos + 8, 20, 5, 1, 1, 'F');
          doc.text(item.status?.toUpperCase() || 'PENDING', margin + 42, yPos + 11.5);
          
          // Assignee
          if (item.assignee) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
            doc.text(`Assigned to: ${item.assignee}`, margin + 65, yPos + 11.5);
          }
          
          yPos += 23;
        });
      }

      // 5. DECISIONS & BLOCKERS SECTION
      if (options.includeDecisions && currentDecisions) {
        const hasContent = (currentDecisions.decisions?.length > 0) || (currentDecisions.pending?.length > 0) || (currentDecisions.blockers?.length > 0);
        if (hasContent) {
          addSectionHeader("Decisions & Commitments");

          const renderDecisionItems = (
            items: { text: string; [key: string]: any }[],
            label: string,
            color: { r: number; g: number; b: number },
            bgColor: { r: number; g: number; b: number },
            icon: string,
            subtitleKey?: string
          ) => {
            if (items.length === 0) return;
            
            checkPageBreak(20);
            
            // Category dot + label
            doc.setFillColor(color.r, color.g, color.b);
            doc.circle(margin + 5, yPos, 3, 'F');
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(color.r, color.g, color.b);
            doc.text(`${label} (${items.length})`, margin + 12, yPos + 2);
            yPos += 8;

            items.forEach(item => {
              checkPageBreak(15);
              
              // Left border + background
              doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
              doc.rect(margin + 5, yPos - 3, contentWidth - 10, 12, 'F');
              doc.setFillColor(color.r, color.g, color.b);
              doc.rect(margin + 5, yPos - 3, 2, 12, 'F');
              
              // Text
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
              const lines = doc.splitTextToSize(`${icon} ${item.text}`, contentWidth - 25);
              doc.text(lines[0], margin + 12, yPos + 3);
              
              // Subtitle
              const subtitle = subtitleKey && item[subtitleKey];
              if (subtitle) {
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
                doc.text(subtitle, margin + 12, yPos + 7);
              }
              
              yPos += 14;
            });
            yPos += 4;
          };

          const green = { r: 16, g: 185, b: 129 };
          const greenBg = { r: 236, g: 253, b: 245 };
          const amber = { r: 245, g: 158, b: 11 };
          const amberBg = { r: 255, g: 251, b: 235 };
          const red = { r: 239, g: 68, b: 68 };
          const redBg = { r: 254, g: 242, b: 242 };

          renderDecisionItems(currentDecisions.decisions || [], 'DECISIONS', green, greenBg, '✅', 'speaker');
          renderDecisionItems(currentDecisions.pending || [], 'PENDING', amber, amberBg, '⏳', 'reason');
          renderDecisionItems(currentDecisions.blockers || [], 'BLOCKERS', red, redBg, '🚫', 'impact');
        }
      }

      // 6. SPEAKER INFLUENCE SECTION
      if (options.includeInfluence && currentInfluence && currentInfluence.speakers?.length > 0) {
        addSectionHeader("Speaker Influence Analysis");

        // Leader badge
        checkPageBreak(15);
        const amberInfluence = { r: 217, g: 119, b: 6 };
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(amberInfluence.r, amberInfluence.g, amberInfluence.b);
        doc.text(`Meeting Leader: ${currentInfluence.meeting_leader}`, margin + 5, yPos);
        
        const balanceLabel = currentInfluence.participation_balance === 'balanced' ? 'Well Balanced' : currentInfluence.participation_balance === 'moderate' ? 'Moderately Balanced' : 'One-Sided';
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
        doc.text(`Participation: ${balanceLabel}`, margin + 5, yPos + 6);
        yPos += 14;

        const sortedSpeakers = [...currentInfluence.speakers].sort((a, b) => b.influence_score - a.influence_score);
        sortedSpeakers.forEach(speaker => {
          checkPageBreak(30);
          
          const roleColor = speaker.role_alignment === 'Leader' ? amberInfluence : speaker.role_alignment === 'Contributor' ? primaryColor : mediumGray;
          
          // Speaker card border
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.5);
          doc.roundedRect(margin, yPos - 3, contentWidth, 25, 2, 2, 'D');
          
          // Name + role
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          doc.text(speaker.name, margin + 5, yPos + 3);
          
          // Role badge
          doc.setFillColor(roleColor.r, roleColor.g, roleColor.b);
          const roleWidth = doc.getTextWidth(speaker.role_alignment) + 6;
          doc.roundedRect(margin + 5 + doc.getTextWidth(speaker.name) + 5, yPos - 1, roleWidth > 20 ? roleWidth : 20, 6, 1, 1, 'F');
          doc.setFontSize(6);
          doc.setTextColor(255, 255, 255);
          doc.text(speaker.role_alignment, margin + 5 + doc.getTextWidth(speaker.name) + 8, yPos + 3);
          
          // Score
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(roleColor.r, roleColor.g, roleColor.b);
          doc.text(`${Math.round(speaker.influence_score)}`, pageWidth - margin - 15, yPos + 5);
          
          // Progress bar
          doc.setFillColor(220, 220, 220);
          doc.rect(margin + 5, yPos + 8, contentWidth - 30, 3, 'F');
          doc.setFillColor(roleColor.r, roleColor.g, roleColor.b);
          doc.rect(margin + 5, yPos + 8, ((contentWidth - 30) * speaker.influence_score) / 100, 3, 'F');
          
          // Stats
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
          doc.text(`Talk: ${Math.round(speaker.talk_time_percent)}%  |  Decisions: ${speaker.decision_words}  |  Questions: ${speaker.question_count}`, margin + 5, yPos + 18);
          
          yPos += 28;
        });
      }

      // 7. ACCOUNTABILITY SECTION
      if (options.includeAccountability && currentAccountability && currentAccountability.tasks?.length > 0) {
        addSectionHeader("Task Ownership & Accountability");

        // Summary stats
        checkPageBreak(30);
        const scoreColor = currentAccountability.average_score >= 70 ? accentColor : currentAccountability.average_score >= 50 ? { r: 251, g: 191, b: 36 } : { r: 239, g: 68, b: 68 };
        
        // Avg score box
        doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        doc.roundedRect(margin, yPos, contentWidth / 2 - 5, 18, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
        doc.text("Average Accountability Score", margin + 5, yPos + 6);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(scoreColor.r, scoreColor.g, scoreColor.b);
        doc.text(`${currentAccountability.average_score}%`, margin + 5, yPos + 14);

        // Unassigned box
        const unColor = currentAccountability.unassigned_count > 0 ? { r: 239, g: 68, b: 68 } : accentColor;
        doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        doc.roundedRect(margin + contentWidth / 2 + 5, yPos, contentWidth / 2 - 5, 18, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
        doc.text("Unassigned Tasks", margin + contentWidth / 2 + 10, yPos + 6);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(unColor.r, unColor.g, unColor.b);
        doc.text(`${currentAccountability.unassigned_count}`, margin + contentWidth / 2 + 10, yPos + 14);
        yPos += 22;

        // Risk summary
        if (currentAccountability.risk_summary) {
          checkPageBreak(15);
          doc.setFillColor(255, 251, 235);
          doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
          doc.setFillColor(245, 158, 11);
          doc.rect(margin, yPos, 2, 10, 'F');
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(146, 64, 14);
          doc.text("Risk: ", margin + 6, yPos + 6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          const riskLines = doc.splitTextToSize(currentAccountability.risk_summary, contentWidth - 30);
          doc.text(riskLines[0], margin + 18, yPos + 6);
          yPos += 14;
        }

        // Task cards
        currentAccountability.tasks.forEach(task => {
          checkPageBreak(20);
          
          const clarityColor = task.ownership_clarity === 'clear' ? accentColor : task.ownership_clarity === 'ambiguous' ? { r: 251, g: 191, b: 36 } : { r: 239, g: 68, b: 68 };
          const taskScoreColor = task.accountability_score >= 80 ? accentColor : task.accountability_score >= 50 ? { r: 251, g: 191, b: 36 } : { r: 239, g: 68, b: 68 };

          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.5);
          doc.roundedRect(margin, yPos - 2, contentWidth, 16, 2, 2, 'D');

          // Task text
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          const taskLines = doc.splitTextToSize(task.task, contentWidth - 40);
          doc.text(taskLines[0], margin + 5, yPos + 3);

          // Score
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(taskScoreColor.r, taskScoreColor.g, taskScoreColor.b);
          doc.text(`${task.accountability_score}%`, pageWidth - margin - 15, yPos + 4);

          // Clarity badge
          doc.setFillColor(clarityColor.r, clarityColor.g, clarityColor.b);
          doc.roundedRect(margin + 5, yPos + 6, 20, 5, 1, 1, 'F');
          doc.setFontSize(6);
          doc.setTextColor(255, 255, 255);
          doc.text(task.ownership_clarity, margin + 7, yPos + 9.5);

          // Owner & deadline
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(mediumGray.r, mediumGray.g, mediumGray.b);
          let infoX = margin + 30;
          if (task.owner) {
            doc.text(`Owner: ${task.owner}`, infoX, yPos + 9.5);
            infoX += doc.getTextWidth(`Owner: ${task.owner}`) + 10;
          }
          if (task.deadline) {
            doc.text(`Deadline: ${task.deadline}`, infoX, yPos + 9.5);
          }

          yPos += 18;
        });
      }

      // Add footer to last page
      addFooter(pageNumber);

      doc.save(`meeting-report-${meetingId.slice(0, 8)}.pdf`);

      toast({
        title: "PDF Exported",
        description: "Your meeting report has been downloaded.",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const totalParticipants = 1 + remoteStreams.size;
  
  // Determine if current user is the host (first to join or has manager role)
  const isHost = userRole?.toLowerCase() === 'manager' || userRole?.toLowerCase() === 'host';

  // Build participants list for the panel
  const participantsList: Participant[] = useMemo(() => {
    const list: Participant[] = [
      {
        id: userId,
        name: userName,
        isLocal: true,
        isVideoOn,
        isAudioOn,
        isHost,
      },
    ];

    remoteStreams.forEach((data, peerId) => {
      list.push({
        id: peerId,
        name: data.name,
        isLocal: false,
        isVideoOn: data.isVideoOn,
        isAudioOn: data.isAudioOn,
        isHost: false,
      });
    });

    return list;
  }, [userId, userName, isVideoOn, isAudioOn, isHost, remoteStreams]);

  // Show loading while redirecting or loading data
  if (!isValidSession || isLoading) {
    return (
      <div className="min-h-screen bg-meeting-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-meeting-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">AI Meeting</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {meetingCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(meetingCode);
                    toast({
                      title: "Meeting code copied!",
                      description: meetingCode,
                    });
                  }}
                  className="font-medium hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                  title="Click to copy meeting code"
                >
                  Code: {meetingCode}
                  <Copy className="w-3 h-3" />
                </button>
              )}
              {meetingCode && <span className="mx-1">•</span>}
              <span>ID: {meetingId.slice(0, 8)}</span>
              <span className="mx-1">•</span>
              <ConnectionStatus />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RecordingControls
              isRecording={isRecording}
              isPaused={isPaused}
              formattedDuration={formattedDuration}
              isUploading={isUploading}
              onStart={startRecording}
              onStop={stopRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
            />
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <PDFExportDialog
              onExport={handleExportPDF}
              isExporting={isGenerating}
              hasGeneralSummary={!!summaries['general']}
              hasRoleSummaries={Object.keys(summaries).filter(k => k !== 'general').length > 0}
              hasActionItems={actionItems.length > 0}
              hasParticipants={participants.length > 0}
              hasDecisions={!!decisionsData}
              hasInfluence={!!influenceData}
              hasAccountability={!!accountabilityData}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendSummaryEmail}
              disabled={isSendingEmail}
            >
              {isSendingEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Email Summary
            </Button>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              {totalParticipants} {totalParticipants === 1 ? 'Participant' : 'Participants'}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 p-6">
        {/* Main Meeting Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Grid */}
          <Card className="p-4 bg-card">
            {isConnecting ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Connecting to meeting...</span>
              </div>
            ) : (
              <VideoGridPeer 
                localStream={isScreenSharing ? screenStream : localStream} 
                remoteStreams={remoteStreams}
                isVideoOn={isScreenSharing ? true : isVideoOn} 
                isAudioOn={isAudioOn}
                userName={isScreenSharing ? `${userName} (Screen)` : userName}
                enableFaceDetection={!isScreenSharing && isVideoOn}
                onLocalFaceAnalysisChange={setLocalFaceAnalysis}
              />
            )}
          </Card>

          {/* Meeting Controls */}
          <Card className="p-4 bg-card">
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                variant={isAudioOn ? "default" : "destructive"}
                className="rounded-full w-14 h-14"
                onClick={toggleAudio}
                disabled={!localStream}
              >
                {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              
              <Button
                size="lg"
                variant={isVideoOn ? "default" : "destructive"}
                className="rounded-full w-14 h-14"
                onClick={toggleVideo}
                disabled={!localStream || isScreenSharing}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button
                size="lg"
                variant={isScreenSharing ? "default" : "outline"}
                className={`rounded-full w-14 h-14 ${isScreenSharing ? "bg-green-600 hover:bg-green-700" : ""}`}
                onClick={toggleScreenShare}
                disabled={!localStream}
              >
                {isScreenSharing ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-14 h-14"
                onClick={handleEndCall}
              >
                <PhoneOff className="w-5 h-5" />
              </Button>

              <MeetingSettingsDialog
                noiseReductionEnabled={noiseReductionEnabled}
                onNoiseReductionChange={setNoiseReductionEnabled}
                recognitionLanguage={recognitionLanguage}
                onRecognitionLanguageChange={setRecognitionLanguage}
              />

              <Button
                size="lg"
                className="bg-gradient-primary hover:opacity-90"
                onClick={handleExtractActionItems}
                disabled={isGenerating || transcripts.length === 0}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Extract Action Items
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Transcript */}
          <Card className="p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <TranslationSelector
                selectedLanguage={translationLanguage}
                onLanguageChange={setTranslationLanguage}
                isTranslating={isTranslating}
                compact
              />
            </div>
            <TranscriptPanelLive 
              transcripts={translatedTranscripts} 
              interimTranscript={interimTranscript}
              isListening={isListening}
              isSpeechSupported={isSpeechSupported}
              currentUserName={userName}
              speakers={speakerList}
              onUpdateSpeakerName={updateSpeakerName}
              optimisticTranscripts={optimisticTranscripts}
            />
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Engagement Metrics */}
          <Card className="p-6 bg-card max-h-[600px] overflow-y-auto">
            <EngagementPanelLive 
              participants={participants} 
              localEmotion={localFaceAnalysis?.emotion ?? null}
              localAttention={localFaceAnalysis?.attention ?? null}
              localUserName={userName}
              localUserRole={userRole}
              engagementHistory={engagementHistory}
              averageAttention={getAverageAttention()}
              emotionDistribution={getEmotionDistribution()}
              dominantEmotion={getDominantEmotion()}
            />
          </Card>

          {/* AI Analysis Tabs */}
          <Card className="p-6 bg-card">
            <Tabs defaultValue="participants" className="w-full">
              <TabsList className="flex w-full flex-wrap gap-1 h-auto p-1">
                <TabsTrigger value="participants">
                  <Users className="w-4 h-4 mr-1" />
                  People
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Chat
                </TabsTrigger>
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
                <TabsTrigger value="influence">
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Influence
                </TabsTrigger>
                <TabsTrigger value="ownership">
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Ownership
                </TabsTrigger>
                <TabsTrigger value="recordings">
                  <Disc className="w-4 h-4 mr-1" />
                  Recordings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="participants" className="mt-4 h-[400px]">
                <ParticipantsPanel
                  participants={participantsList}
                  isHost={isHost}
                  onMuteParticipant={requestMuteParticipant}
                  onKickParticipant={kickParticipant}
                />
              </TabsContent>

              <TabsContent value="chat" className="mt-4 h-[400px]">
                <ChatPanel
                  messages={chatMessages}
                  onSendMessage={sendMessage}
                  currentUserId={userId}
                  isLoading={chatLoading}
                  typingUsers={typingUsers}
                  onTypingStart={startTyping}
                  onTypingStop={stopTyping}
                  reactions={reactions}
                  onToggleReaction={toggleReaction}
                />
              </TabsContent>
              
              <TabsContent value="summary" className="mt-4">
                <SummaryPanelLive 
                  selectedRole={selectedRole}
                  onRoleChange={setSelectedRole}
                  summaries={summaries}
                  onGenerateSummary={handleGenerateSummary}
                />
              </TabsContent>
              
              <TabsContent value="actions" className="mt-4">
                <ActionItemsPanelLive actionItems={actionItems} />
              </TabsContent>

              <TabsContent value="decisions" className="mt-4">
                <DecisionsPanel transcripts={transcripts.map(t => ({ speaker: t.speaker, text: t.text }))} />
              </TabsContent>

              <TabsContent value="influence" className="mt-4">
                <InfluencePanel transcripts={transcripts.map(t => ({ speaker: t.speaker, text: t.text }))} />
              </TabsContent>

              <TabsContent value="ownership" className="mt-4">
                <AccountabilityPanel 
                  transcripts={transcripts.map(t => ({ speaker: t.speaker, text: t.text }))}
                  onDataChange={setAccountabilityData}
                />
              </TabsContent>

              <TabsContent value="recordings" className="mt-4">
                <RecordingsPanel 
                  meetingId={meetingId} 
                  transcripts={transcripts}
                />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeetingDemo;
