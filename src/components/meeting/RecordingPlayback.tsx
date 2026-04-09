import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Transcript {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
}

interface Recording {
  id: string;
  file_path: string;
  duration_ms: number;
  started_at: string;
}

interface RecordingPlaybackProps {
  recording: Recording;
  transcripts: Transcript[];
  onClose?: () => void;
}

const RecordingPlayback = ({ recording, transcripts, onClose }: RecordingPlaybackProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load audio URL
  useEffect(() => {
    const loadAudio = async () => {
      setIsLoading(true);
      const { data } = supabase.storage
        .from('recordings')
        .getPublicUrl(recording.file_path);
      
      if (data?.publicUrl) {
        setAudioUrl(data.publicUrl);
      }
      setIsLoading(false);
    };
    
    loadAudio();
  }, [recording.file_path]);

  // Calculate recording start time offset
  const recordingStartTime = new Date(recording.started_at).getTime();

  // Get relative timestamp for transcript (parse from "MM:SS" format)
  const getTranscriptTimeMs = useCallback((timestamp: string) => {
    const parts = timestamp.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      return (minutes * 60 + seconds) * 1000;
    }
    return 0;
  }, []);

  // Update active transcript based on current playback time
  useEffect(() => {
    if (!isPlaying && !currentTime) return;

    const currentMs = currentTime * 1000;
    
    // Find the transcript that matches current time
    let activeId: string | null = null;
    for (let i = transcripts.length - 1; i >= 0; i--) {
      const transcriptTimeMs = getTranscriptTimeMs(transcripts[i].timestamp);
      if (transcriptTimeMs <= currentMs) {
        activeId = transcripts[i].id;
        break;
      }
    }
    
    if (activeId !== activeTranscriptId) {
      setActiveTranscriptId(activeId);
      
      // Scroll to active transcript
      if (activeId && transcriptContainerRef.current) {
        const element = document.getElementById(`transcript-${activeId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentTime, transcripts, activeTranscriptId, isPlaying, getTranscriptTimeMs]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const seek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const skipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const jumpToTranscript = (transcript: Transcript) => {
    if (audioRef.current) {
      const transcriptTimeMs = getTranscriptTimeMs(transcript.timestamp);
      audioRef.current.currentTime = Math.max(0, transcriptTimeMs / 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-purple-500',
      'bg-rose-500',
      'bg-cyan-500',
    ];
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
      hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      {/* Player controls */}
      <div className="bg-card border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-4 mb-3">
          <Button variant="ghost" size="icon" onClick={skipBack}>
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button 
            size="icon" 
            onClick={togglePlay}
            className="h-10 w-10"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button variant="ghost" size="icon" onClick={skipForward}>
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-12">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.1}
              onValueChange={seek}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleMute}>
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-20"
            />
          </div>
        </div>
      </div>

      {/* Synchronized transcript */}
      <div className="flex-1 min-h-0">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <span>Transcript</span>
          <span className="text-xs text-muted-foreground">
            (click to jump)
          </span>
        </h4>
        <ScrollArea className="h-[300px] rounded-lg bg-muted/30 p-4" ref={transcriptContainerRef}>
          <div className="space-y-3">
            {transcripts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transcript available for this recording
              </p>
            ) : (
              transcripts.map((transcript) => {
                const transcriptTimeMs = getTranscriptTimeMs(transcript.timestamp);
                const isActive = transcript.id === activeTranscriptId;
                const speakerName = transcript.speaker || 'Unknown Speaker';
                
                return (
                  <div
                    id={`transcript-${transcript.id}`}
                    key={transcript.id}
                    onClick={() => jumpToTranscript(transcript)}
                    className={cn(
                      "flex gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200",
                      isActive 
                        ? "bg-primary/10 ring-2 ring-primary/30" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                        getSpeakerColor(speakerName)
                      )}>
                        {speakerName.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm truncate">
                          {speakerName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(transcriptTimeMs / 1000)}
                        </span>
                      </div>
                      <p className={cn(
                        "text-sm leading-relaxed",
                        isActive ? "text-foreground" : "text-foreground/80"
                      )}>
                        {transcript.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default RecordingPlayback;
