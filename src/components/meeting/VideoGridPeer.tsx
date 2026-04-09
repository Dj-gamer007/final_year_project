import { useEffect, useRef, useMemo } from "react";
import { User, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useFaceDetection, EmotionData, AttentionData } from "@/hooks/useFaceDetection";

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

export interface FaceAnalysisData {
  emotion: EmotionData | null;
  attention: AttentionData | null;
}

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isVideoOn?: boolean;
  isAudioOn?: boolean;
  isSpeaking?: boolean;
  enableFaceDetection?: boolean;
  onFaceAnalysisChange?: (data: FaceAnalysisData) => void;
}

const VideoTile = ({ 
  stream, 
  name, 
  isLocal = false, 
  isVideoOn = true, 
  isAudioOn = true, 
  isSpeaking = false,
  enableFaceDetection = false,
  onFaceAnalysisChange,
}: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { isModelLoaded, isDetecting, currentEmotion, currentAttention } = useFaceDetection({
    videoRef,
    canvasRef,
    isVideoOn: isVideoOn && !!stream,
    isEnabled: enableFaceDetection && isLocal,
  });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Notify parent of face analysis changes
  useEffect(() => {
    if (onFaceAnalysisChange) {
      onFaceAnalysisChange({
        emotion: currentEmotion,
        attention: currentAttention,
      });
    }
  }, [currentEmotion, currentAttention, onFaceAnalysisChange]);

  // Check actual track state for display
  const hasVideoTrack = stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideoTrack && isVideoOn;

  return (
    <div
      className={`relative aspect-video bg-muted rounded-lg overflow-hidden border-2 transition-all ${
        currentEmotion ? "border-green-500 shadow-lg shadow-green-500/30" : 
        isSpeaking ? "border-accent shadow-lg shadow-accent/20" : "border-border/30"
      }`}
    >
      {/* Video container with canvas overlay */}
      <div className="absolute inset-0">
        {/* Always render video element to maintain srcObject */}
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={`w-full h-full object-cover ${isLocal ? "transform scale-x-[-1]" : ""} ${
            showVideo ? "block" : "hidden"
          }`}
        />
        
        {/* Face detection canvas overlay */}
        {enableFaceDetection && isLocal && showVideo && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full transform scale-x-[-1] pointer-events-none"
            style={{ objectFit: 'cover' }}
          />
        )}
      </div>
      
      {/* Avatar placeholder when video is off - shows first letter of name */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
          <div className={`w-20 h-20 rounded-full ${getAvatarColor(name)} flex items-center justify-center shadow-lg`}>
            <span className="text-3xl font-medium text-white">{getInitial(name)}</span>
          </div>
        </div>
      )}

      {/* Model loading indicator */}
      {enableFaceDetection && isLocal && showVideo && !isModelLoaded && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          Loading face detection...
        </div>
      )}

      {/* Face detection active indicator */}
      {enableFaceDetection && isLocal && showVideo && isModelLoaded && isDetecting && (
        <div className="absolute top-2 left-2 bg-green-600/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Face Detection Active
        </div>
      )}

      {/* Participant Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-medium">
            {name} {isLocal && "(You)"}
          </p>
          <div className="flex items-center gap-2">
            {isVideoOn ? (
              <Video className="w-4 h-4 text-green-400" />
            ) : (
              <VideoOff className="w-4 h-4 text-red-400" />
            )}
            {isAudioOn ? (
              <Mic className="w-4 h-4 text-green-400" />
            ) : (
              <MicOff className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
        {isSpeaking && isAudioOn && (
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1 h-3 bg-accent rounded animate-pulse" />
            <div className="w-1 h-4 bg-accent rounded animate-pulse delay-75" />
            <div className="w-1 h-3 bg-accent rounded animate-pulse delay-150" />
            <div className="w-1 h-4 bg-accent rounded animate-pulse delay-200" />
          </div>
        )}
      </div>
    </div>
  );
};

interface VideoGridPeerProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, { stream: MediaStream; name: string; isVideoOn?: boolean; isAudioOn?: boolean }>;
  isVideoOn: boolean;
  isAudioOn: boolean;
  userName: string;
  enableFaceDetection?: boolean;
  onLocalFaceAnalysisChange?: (data: FaceAnalysisData) => void;
}

const VideoGridPeer = ({ 
  localStream, 
  remoteStreams, 
  isVideoOn, 
  isAudioOn, 
  userName,
  enableFaceDetection = true,
  onLocalFaceAnalysisChange,
}: VideoGridPeerProps) => {
  const totalParticipants = 1 + remoteStreams.size;
  
  // Determine grid layout based on participant count
  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1 max-w-2xl mx-auto";
    if (totalParticipants === 2) return "grid-cols-1 md:grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 6) return "grid-cols-2 md:grid-cols-3";
    return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  };

  return (
    <div className={`grid ${getGridClass()} gap-4`}>
      {/* Local Video */}
      <VideoTile
        stream={localStream}
        name={userName}
        isLocal={true}
        isVideoOn={isVideoOn}
        isAudioOn={isAudioOn}
        isSpeaking={isAudioOn}
        enableFaceDetection={enableFaceDetection}
        onFaceAnalysisChange={onLocalFaceAnalysisChange}
      />

      {/* Remote Videos */}
      {Array.from(remoteStreams.entries()).map(([peerId, { stream, name, isVideoOn: remoteVideoOn, isAudioOn: remoteAudioOn }]) => {
        return (
          <VideoTile
            key={peerId}
            stream={stream}
            name={name}
            isLocal={false}
            isVideoOn={remoteVideoOn ?? true}
            isAudioOn={remoteAudioOn ?? true}
            isSpeaking={false}
          />
        );
      })}

      {/* Empty slots for visual balance when alone */}
      {totalParticipants === 1 && (
        <div className="hidden md:block relative aspect-video bg-muted/50 rounded-lg overflow-hidden border-2 border-dashed border-border/30">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <User className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">Waiting for others to join...</p>
            <p className="text-xs mt-1 opacity-70">Share the meeting link</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGridPeer;
