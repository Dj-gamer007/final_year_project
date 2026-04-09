import { useEffect, useRef } from "react";
import { User, Mic, MicOff } from "lucide-react";

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
  
  // Simple hash based on name to get consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Get first letter of the name
const getInitial = (name: string): string => {
  return name.trim().charAt(0).toUpperCase();
};

interface VideoGridProps {
  localStream: MediaStream | null;
  isVideoOn: boolean;
  isAudioOn: boolean;
  userName?: string;
}

const VideoGrid = ({ localStream, isVideoOn, isAudioOn, userName = "You" }: VideoGridProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const hasVideoTrack = localStream && localStream.getVideoTracks().length > 0;
  const showVideo = hasVideoTrack && isVideoOn;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Local Video */}
      <div
        className={`relative aspect-video bg-meeting-bg rounded-lg overflow-hidden border-2 transition-all border-accent shadow-lg`}
      >
        {/* Always render video element to maintain srcObject */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transform scale-x-[-1] ${showVideo ? "block" : "hidden"}`}
        />
        
        {/* Avatar placeholder when video is off - shows first letter of name */}
        {!showVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
            <div className={`w-20 h-20 rounded-full ${getAvatarColor(userName)} flex items-center justify-center shadow-lg`}>
              <span className="text-3xl font-medium text-white">{getInitial(userName)}</span>
            </div>
          </div>
        )}

        {/* Participant Info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium">{userName} (You)</p>
            <div className="flex items-center gap-2">
              {isAudioOn ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
          {isAudioOn && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-1 h-3 bg-accent rounded animate-pulse" />
              <div className="w-1 h-4 bg-accent rounded animate-pulse delay-75" />
              <div className="w-1 h-3 bg-accent rounded animate-pulse delay-150" />
            </div>
          )}
        </div>
      </div>

      {/* Placeholder participants - would be replaced with actual remote streams */}
      {[
        { id: 2, name: "Team Member 1", status: "active" },
        { id: 3, name: "Team Member 2", status: "active" },
      ].map((participant) => (
        <div
          key={participant.id}
          className="relative aspect-video bg-meeting-bg rounded-lg overflow-hidden border-2 transition-all border-border/30"
        >
          <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
            <div className={`w-20 h-20 rounded-full ${getAvatarColor(participant.name)} flex items-center justify-center shadow-lg`}>
              <span className="text-3xl font-medium text-white">{getInitial(participant.name)}</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-white text-sm font-medium">{participant.name}</p>
            <p className="text-white/60 text-xs">Waiting to join...</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VideoGrid;
