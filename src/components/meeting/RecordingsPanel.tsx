import { useState } from "react";
import { Play, Trash2, Clock, HardDrive, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRecordings } from "@/hooks/useRecordings";
import RecordingPlayback from "./RecordingPlayback";
import { format } from "date-fns";

interface Transcript {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
}

interface RecordingsPanelProps {
  meetingId: string;
  transcripts: Transcript[];
}

const RecordingsPanel = ({ meetingId, transcripts }: RecordingsPanelProps) => {
  const { recordings, isLoading, deleteRecording, formatDuration, formatFileSize } = useRecordings(meetingId);
  const [selectedRecording, setSelectedRecording] = useState<typeof recordings[0] | null>(null);
  const [isPlaybackOpen, setIsPlaybackOpen] = useState(false);

  const handlePlay = (recording: typeof recordings[0]) => {
    setSelectedRecording(recording);
    setIsPlaybackOpen(true);
  };

  const handleDelete = async (recording: typeof recordings[0]) => {
    if (confirm('Are you sure you want to delete this recording?')) {
      await deleteRecording(recording.id, recording.file_path);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Recordings</h3>
        <span className="text-sm text-muted-foreground">
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {recordings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">No recordings yet</p>
          <p className="text-sm">Start recording during the meeting to save audio</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-card border rounded-lg p-4 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(recording.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDuration(recording.duration_ms)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4 text-muted-foreground" />
                        <span>{formatFileSize(recording.file_size)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlay(recording)}
                      className="gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Play
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(recording)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Playback Dialog */}
      <Dialog open={isPlaybackOpen} onOpenChange={setIsPlaybackOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Recording Playback
              {selectedRecording && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {format(new Date(selectedRecording.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedRecording && (
            <RecordingPlayback
              recording={selectedRecording}
              transcripts={transcripts}
              onClose={() => setIsPlaybackOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecordingsPanel;
