import { useState, useEffect, useRef, useCallback } from "react";

interface UseWebRTCOptions {
  initialVideo?: boolean;
  initialAudio?: boolean;
}

export const useWebRTC = (options: UseWebRTCOptions = {}) => {
  const { initialVideo = true, initialAudio = true } = options;
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(initialVideo);
  const [isAudioOn, setIsAudioOn] = useState(initialAudio);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const initializeMedia = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: initialVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } : false,
        audio: initialAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      });
      
      setLocalStream(stream);
      
      // Set initial track states
      stream.getVideoTracks().forEach(track => {
        track.enabled = initialVideo;
      });
      stream.getAudioTracks().forEach(track => {
        track.enabled = initialAudio;
      });
      
      return stream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to access media devices";
      setError(errorMessage);
      console.error("Media initialization error:", err);
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [initialVideo, initialAudio]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsVideoOn(newState);
      }
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsAudioOn(newState);
      }
    }
  }, [localStream]);

  const stopAllTracks = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  return {
    localStream,
    isVideoOn,
    isAudioOn,
    error,
    isInitializing,
    videoRef,
    initializeMedia,
    toggleVideo,
    toggleAudio,
    stopAllTracks,
    setIsVideoOn,
    setIsAudioOn
  };
};
