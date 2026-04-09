import { Circle, Square, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  formattedDuration: string;
  isUploading: boolean;
  onStart: () => void;
  onStop: () => Promise<string | null>;
  onPause: () => void;
  onResume: () => void;
}

const RecordingControls = ({
  isRecording,
  isPaused,
  formattedDuration,
  isUploading,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordingControlsProps) => {
  if (!isRecording) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStart}
        disabled={isUploading}
        className="gap-2"
      >
        <Circle className="w-4 h-4 text-destructive fill-destructive" />
        {isUploading ? "Saving..." : "Record"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-1.5">
      <div className={cn(
        "w-2 h-2 rounded-full bg-destructive",
        !isPaused && "animate-pulse"
      )} />
      <span className="text-sm font-mono text-destructive font-medium">
        {formattedDuration}
      </span>
      
      <div className="flex items-center gap-1 ml-2">
        {isPaused ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onResume}
            className="h-7 w-7"
          >
            <Play className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPause}
            className="h-7 w-7"
          >
            <Pause className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          className="h-7 w-7"
        >
          <Square className="w-4 h-4 fill-current" />
        </Button>
      </div>
    </div>
  );
};

export default RecordingControls;
