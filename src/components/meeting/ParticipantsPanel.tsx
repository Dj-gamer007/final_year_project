import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Mic, MicOff, Video, VideoOff, UserMinus, Crown, User 
} from "lucide-react";
import { cn } from "@/lib/utils";

// Generate a consistent color based on the name
const getAvatarColor = (name: string): string => {
  const colors = [
    "bg-purple-500",
    "bg-orange-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitial = (name: string): string => {
  return name.trim().charAt(0).toUpperCase();
};

export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  isVideoOn: boolean;
  isAudioOn: boolean;
  isHost?: boolean;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  isHost: boolean;
  onMuteParticipant: (participantId: string) => void;
  onKickParticipant: (participantId: string) => void;
}

const ParticipantsPanel = ({
  participants,
  isHost,
  onMuteParticipant,
  onKickParticipant,
}: ParticipantsPanelProps) => {
  const [kickConfirmId, setKickConfirmId] = useState<string | null>(null);
  const participantToKick = participants.find(p => p.id === kickConfirmId);

  const handleKickClick = (participantId: string) => {
    setKickConfirmId(participantId);
  };

  const confirmKick = () => {
    if (kickConfirmId) {
      onKickParticipant(kickConfirmId);
      setKickConfirmId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">
          Participants ({participants.length})
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                "hover:bg-muted/50"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white font-medium",
                  getAvatarColor(participant.name)
                )}
              >
                {getInitial(participant.name)}
              </div>

              {/* Name and status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {participant.name}
                  </span>
                  {participant.isLocal && (
                    <span className="text-xs text-muted-foreground">(You)</span>
                  )}
                  {participant.isHost && (
                    <Crown className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {participant.isVideoOn ? (
                    <Video className="w-3 h-3 text-green-500" />
                  ) : (
                    <VideoOff className="w-3 h-3 text-muted-foreground" />
                  )}
                  {participant.isAudioOn ? (
                    <Mic className="w-3 h-3 text-green-500" />
                  ) : (
                    <MicOff className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Host controls for other participants */}
              {isHost && !participant.isLocal && (
                <div className="flex items-center gap-1">
                  {participant.isAudioOn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => onMuteParticipant(participant.id)}
                      title="Mute participant"
                    >
                      <MicOff className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleKickClick(participant.id)}
                    title="Remove from meeting"
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}

          {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <User className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No participants yet</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Kick confirmation dialog */}
      <AlertDialog open={!!kickConfirmId} onOpenChange={() => setKickConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Participant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{participantToKick?.name}</span> from
              the meeting? They will be disconnected immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmKick}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ParticipantsPanel;
