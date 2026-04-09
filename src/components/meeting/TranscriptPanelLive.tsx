import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Mic, MicOff, AlertCircle } from "lucide-react";
import { Transcript } from "@/hooks/useMeetingData";
import { useEffect, useRef, useMemo } from "react";
import SpeakerTagDialog from "./SpeakerTagDialog";
import { Speaker } from "@/hooks/useSpeakerIdentification";
import { OptimisticTranscript } from "@/hooks/useSpeechRecognition";

interface TranscriptPanelLiveProps {
  transcripts: Transcript[];
  interimTranscript?: string;
  isListening?: boolean;
  isSpeechSupported?: boolean;
  currentUserName?: string;
  speakers?: Speaker[];
  onUpdateSpeakerName?: (speakerId: string, newName: string) => void;
  optimisticTranscripts?: OptimisticTranscript[];
}

// Generate consistent color for each speaker
const getSpeakerColor = (speaker: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-amber-500',
    'bg-rose-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const TranscriptPanelLive = ({ 
  transcripts, 
  interimTranscript = '',
  isListening = false,
  isSpeechSupported = true,
  currentUserName = 'You',
  speakers = [],
  onUpdateSpeakerName,
  optimisticTranscripts = [],
}: TranscriptPanelLiveProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Combine db transcripts with optimistic ones, avoiding duplicates
  const allTranscripts = useMemo(() => {
    // Get all db transcript contents for duplicate detection
    const dbContents = new Set(transcripts.map(t => t.text.trim().toLowerCase()));
    
    // Filter optimistic to only include ones not yet in db
    const pendingOptimistic = optimisticTranscripts
      .filter(ot => ot.isPending && !dbContents.has(ot.text.trim().toLowerCase()))
      .map(ot => ({
        id: ot.id,
        text: ot.text,
        speaker: ot.speaker,
        timestamp: ot.timestamp,
        isPending: true,
      }));
    
    return [
      ...transcripts.map(t => ({ ...t, isPending: false })),
      ...pendingOptimistic,
    ];
  }, [transcripts, optimisticTranscripts]);

  // Get unique speakers for the legend
  const uniqueSpeakers = useMemo(() => {
    const speakerSet = new Set(allTranscripts.map(t => t.speaker));
    return Array.from(speakerSet).filter(s => s !== 'Unknown');
  }, [allTranscripts]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allTranscripts, interimTranscript]);

  const pendingCount = optimisticTranscripts.filter(t => t.isPending).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Live Transcript</h3>
          {speakers.length > 0 && onUpdateSpeakerName && (
            <SpeakerTagDialog 
              speakers={speakers} 
              onUpdateSpeaker={onUpdateSpeakerName} 
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isSpeechSupported ? (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Speech not supported</span>
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-1 text-green-500">
              <Mic className="w-4 h-4 animate-pulse" />
              <span className="text-xs">Listening...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MicOff className="w-4 h-4" />
              <span className="text-xs">Mic off</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {allTranscripts.length} messages
              {pendingCount > 0 && (
                <span className="ml-1 text-amber-500">
                  (+{pendingCount} saving)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Speaker Legend */}
      {uniqueSpeakers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uniqueSpeakers.map(speaker => (
            <div 
              key={speaker} 
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs"
            >
              <div className={`w-3 h-3 rounded-full ${getSpeakerColor(speaker)}`} />
              <span className="text-muted-foreground">{speaker}</span>
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="h-[350px] rounded-lg bg-transcript-bg p-4" ref={scrollRef}>
        {allTranscripts.length === 0 && !interimTranscript ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <User className="w-12 h-12 mb-3 opacity-30" />
            <p>Waiting for speech...</p>
            {isSpeechSupported && (
              <p className="text-xs mt-2">Turn on your mic and start speaking</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {allTranscripts.map((entry) => {
              const isCurrentUser = entry.speaker === currentUserName;
              const speakerColor = getSpeakerColor(entry.speaker);
              const isPending = entry.isPending;
              
              return (
                <div key={entry.id} className={`flex gap-3 group ${isPending ? 'opacity-70' : ''}`}>
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full ${speakerColor} flex items-center justify-center shadow-sm ${isPending ? 'animate-pulse' : ''}`}>
                      <span className="text-white text-xs font-medium">
                        {getInitials(entry.speaker)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold text-sm ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                        {isCurrentUser ? 'You' : entry.speaker}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.timestamp}
                      </span>
                      {isPending && (
                        <span className="text-xs text-amber-500 italic">saving...</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {entry.text}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {/* Show interim transcript */}
            {interimTranscript && (
              <div className="flex gap-3 opacity-70">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${getSpeakerColor(currentUserName)} flex items-center justify-center animate-pulse`}>
                    <span className="text-white text-xs font-medium">
                      {getInitials(currentUserName)}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-primary">
                      You
                    </span>
                    <span className="text-xs text-muted-foreground italic">
                      speaking...
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {interimTranscript}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default TranscriptPanelLive;
