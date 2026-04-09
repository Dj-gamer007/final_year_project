import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PeerConnection {
  peerId: string;
  peerName: string;
  connection: RTCPeerConnection;
  stream: MediaStream | null;
}

interface MediaState {
  isVideoOn: boolean;
  isAudioOn: boolean;
}

interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate" | "join" | "leave" | "media-state" | "mute-request" | "kick";
  from: string;
  fromName: string;
  to?: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | MediaState | null;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export const useWebRTCPeer = (meetingId: string, userId: string, userName: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { stream: MediaStream; name: string; isVideoOn: boolean; isAudioOn: boolean }>>(new Map());
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [wasKicked, setWasKicked] = useState(false);
  const [wasMutedRemotely, setWasMutedRemotely] = useState(false);

  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Queue ICE candidates that arrive before remote description is set
  const iceCandidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Track peers currently being negotiated to prevent duplicate offers
  const negotiatingPeers = useRef<Set<string>>(new Set());

  const createPeerConnection = useCallback((peerId: string, peerName: string): RTCPeerConnection => {
    console.log(`Creating peer connection for ${peerId}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`Received track from ${peerId}`, event.streams);
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          const existing = prev.get(peerId);
          newMap.set(peerId, { 
            stream: event.streams[0], 
            name: peerName,
            isVideoOn: existing?.isVideoOn ?? true,
            isAudioOn: existing?.isAudioOn ?? true,
          });
          return newMap;
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log(`Sending ICE candidate to ${peerId}`);
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice-candidate",
            from: userId,
            fromName: userName,
            to: peerId,
            payload: event.candidate.toJSON(),
          } as SignalMessage,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setConnectedPeers(prev => [...new Set([...prev, peerId])]);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setConnectedPeers(prev => prev.filter(id => id !== peerId));
        handlePeerDisconnect(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${peerId}: ${pc.iceConnectionState}`);
    };

    // Initialize ICE candidate queue for this peer
    iceCandidateQueues.current.set(peerId, []);
    peerConnectionsRef.current.set(peerId, { peerId, peerName, connection: pc, stream: null });
    return pc;
  }, [userId, userName]);

  // Flush queued ICE candidates after remote description is set
  const flushIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueues.current.get(peerId) || [];
    console.log(`Flushing ${queue.length} queued ICE candidates for ${peerId}`);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Error adding queued ICE candidate:", err);
      }
    }
    iceCandidateQueues.current.set(peerId, []);
  }, []);

  const handlePeerDisconnect = useCallback((peerId: string) => {
    const peerConn = peerConnectionsRef.current.get(peerId);
    if (peerConn) {
      peerConn.connection.close();
      peerConnectionsRef.current.delete(peerId);
    }
    iceCandidateQueues.current.delete(peerId);
    negotiatingPeers.current.delete(peerId);
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(peerId);
      return newMap;
    });
  }, []);

  const broadcastMediaState = useCallback((videoOn: boolean, audioOn: boolean) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "media-state",
          from: userId,
          fromName: userName,
          payload: { isVideoOn: videoOn, isAudioOn: audioOn },
        } as SignalMessage,
      });
    }
  }, [userId, userName]);

  const handleSignalMessage = useCallback(async (message: SignalMessage) => {
    console.log("Received signal:", message.type, "from:", message.from, "to:", message.to);
    
    if (message.from === userId) return; // Ignore own messages
    // For targeted messages, only process if it's for us
    if (message.to && message.to !== userId) return;

    switch (message.type) {
      case "join": {
        // Prevent duplicate negotiations with the same peer
        if (negotiatingPeers.current.has(message.from)) {
          console.log(`Already negotiating with ${message.from}, skipping`);
          break;
        }
        if (peerConnectionsRef.current.has(message.from)) {
          const existing = peerConnectionsRef.current.get(message.from)!;
          if (existing.connection.connectionState === 'connected' || 
              existing.connection.connectionState === 'connecting') {
            console.log(`Already connected/connecting to ${message.from}, skipping`);
            break;
          }
          // Clean up stale connection
          existing.connection.close();
          peerConnectionsRef.current.delete(message.from);
        }

        console.log(`${message.fromName} joined, creating offer`);
        negotiatingPeers.current.add(message.from);
        const pc = createPeerConnection(message.from, message.fromName);
        
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "offer",
              from: userId,
              fromName: userName,
              to: message.from,
              payload: offer,
            } as SignalMessage,
          });
        } catch (err) {
          console.error("Error creating offer:", err);
          negotiatingPeers.current.delete(message.from);
        }
        break;
      }
      
      case "offer": {
        console.log(`Received offer from ${message.fromName}`);
        let pc = peerConnectionsRef.current.get(message.from)?.connection;
        
        if (!pc) {
          pc = createPeerConnection(message.from, message.fromName);
        }

        // Handle glare: if we're both trying to offer, the one with the smaller ID wins
        if (pc.signalingState === 'have-local-offer') {
          if (userId < message.from) {
            console.log('Glare detected, we have priority, ignoring remote offer');
            break;
          }
          // We yield: rollback and accept their offer
          console.log('Glare detected, rolling back our offer');
          await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
          // Flush any queued ICE candidates
          await flushIceCandidates(message.from, pc);
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "answer",
              from: userId,
              fromName: userName,
              to: message.from,
              payload: answer,
            } as SignalMessage,
          });
          negotiatingPeers.current.delete(message.from);
        } catch (err) {
          console.error("Error handling offer:", err);
          negotiatingPeers.current.delete(message.from);
        }
        break;
      }

      case "answer": {
        console.log(`Received answer from ${message.fromName}`);
        const peerConn = peerConnectionsRef.current.get(message.from);
        if (peerConn) {
          try {
            await peerConn.connection.setRemoteDescription(
              new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
            );
            // Flush any queued ICE candidates
            await flushIceCandidates(message.from, peerConn.connection);
            negotiatingPeers.current.delete(message.from);
          } catch (err) {
            console.error("Error setting remote description:", err);
            negotiatingPeers.current.delete(message.from);
          }
        }
        break;
      }

      case "ice-candidate": {
        const peerConn = peerConnectionsRef.current.get(message.from);
        if (peerConn && message.payload) {
          // Queue ICE candidates if remote description isn't set yet
          if (!peerConn.connection.remoteDescription) {
            console.log(`Queuing ICE candidate from ${message.from} (no remote desc yet)`);
            const queue = iceCandidateQueues.current.get(message.from) || [];
            queue.push(message.payload as RTCIceCandidateInit);
            iceCandidateQueues.current.set(message.from, queue);
          } else {
            try {
              await peerConn.connection.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
            } catch (err) {
              console.warn("Error adding ICE candidate:", err);
            }
          }
        } else if (!peerConn && message.payload) {
          // Peer connection doesn't exist yet, queue the candidate
          console.log(`Queuing ICE candidate from ${message.from} (no peer connection yet)`);
          const queue = iceCandidateQueues.current.get(message.from) || [];
          queue.push(message.payload as RTCIceCandidateInit);
          iceCandidateQueues.current.set(message.from, queue);
        }
        break;
      }

      case "leave": {
        console.log(`${message.fromName} left the meeting`);
        handlePeerDisconnect(message.from);
        break;
      }

      case "media-state": {
        console.log(`Received media state from ${message.fromName}:`, message.payload);
        const mediaState = message.payload as MediaState;
        if (mediaState) {
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            const existing = prev.get(message.from);
            if (existing) {
              newMap.set(message.from, {
                ...existing,
                isVideoOn: mediaState.isVideoOn,
                isAudioOn: mediaState.isAudioOn,
              });
            }
            return newMap;
          });
        }
        break;
      }

      case "mute-request": {
        // Host requested we mute ourselves
        console.log(`Received mute request from ${message.fromName}`);
        if (localStreamRef.current) {
          const audioTracks = localStreamRef.current.getAudioTracks();
          audioTracks.forEach(track => {
            track.enabled = false;
          });
          setIsAudioOn(false);
          setWasMutedRemotely(true);
          broadcastMediaState(localStreamRef.current.getVideoTracks()[0]?.enabled ?? true, false);
        }
        break;
      }

      case "kick": {
        // Host is kicking us from the meeting
        console.log(`Kicked from meeting by ${message.fromName}`);
        setWasKicked(true);
        break;
      }
    }
  }, [userId, userName, createPeerConnection, handlePeerDisconnect, broadcastMediaState, flushIceCandidates]);

  const initializeMedia = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to access media devices";
      setError(errorMessage);
      console.error("Media initialization error:", err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const joinMeeting = useCallback(async () => {
    if (!meetingId || !userId || !userName) {
      console.log("Cannot join meeting: missing meetingId, userId, or userName");
      return;
    }

    // Prevent double joining
    if (channelRef.current) {
      console.log("Already joined or joining meeting");
      return;
    }

    console.log(`Joining meeting ${meetingId} as ${userName}`);

    // Initialize media first
    const stream = await initializeMedia();
    if (!stream) return;

    // Set up signaling channel
    const channel = supabase.channel(`meeting:${meetingId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        handleSignalMessage(payload as SignalMessage);
      })
      .on("presence", { event: "sync" }, () => {
        // On sync, check for existing participants and request connections
        const state = channel.presenceState();
        console.log("Presence sync, current state:", state);
        
        // For each existing user, if we don't have a connection, send a join signal to them
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((presence: any) => {
            const peerId = presence.user_id;
            const peerName = presence.user_name || 'Unknown';
            
            // Skip ourselves and already connected peers
            if (peerId === userId) return;
            if (peerConnectionsRef.current.has(peerId)) return;
            
            console.log(`Found existing peer ${peerName} (${peerId}), sending join signal`);
            
            // Send join signal to this existing peer so they create an offer for us
            channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                type: "join",
                from: userId,
                fromName: userName,
                to: peerId, // Target specific peer
              } as SignalMessage,
            });
          });
        });
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("Presence join:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("Presence leave:", leftPresences);
        leftPresences.forEach((presence: any) => {
          if (presence.user_id) {
            handlePeerDisconnect(presence.user_id);
          }
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to channel, announcing presence");
          
          // Track presence first - this triggers sync event which handles existing peers
          await channel.track({ user_id: userId, user_name: userName });
          
          // Also broadcast join for peers that may have missed the presence sync
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "join",
              from: userId,
              fromName: userName,
            } as SignalMessage,
          });
        }
      });

    channelRef.current = channel;
  }, [meetingId, userId, userName, initializeMedia, handleSignalMessage, handlePeerDisconnect]);

  const leaveMeeting = useCallback(() => {
    console.log("Leaving meeting");

    // Announce leave
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "leave",
          from: userId,
          fromName: userName,
        } as SignalMessage,
      });
      
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((peerConn) => {
      peerConn.connection.close();
    });
    peerConnectionsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setConnectedPeers([]);
  }, [userId, userName]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsVideoOn(newState);
        broadcastMediaState(newState, localStreamRef.current.getAudioTracks()[0]?.enabled ?? true);
      }
    }
  }, [broadcastMediaState]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsAudioOn(newState);
        broadcastMediaState(localStreamRef.current.getVideoTracks()[0]?.enabled ?? true, newState);
      }
    }
  }, [broadcastMediaState]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Replace video track in all peer connections
      const videoTrack = stream.getVideoTracks()[0];
      
      peerConnectionsRef.current.forEach((peerConn) => {
        const senders = peerConn.connection.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack);
        }
      });

      // Handle when user stops sharing via browser UI
      videoTrack.onended = () => {
        stopScreenShare();
      };

    } catch (err) {
      console.error("Error starting screen share:", err);
      setError("Failed to start screen sharing");
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    setIsScreenSharing(false);

    // Restore camera video track in all peer connections
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        peerConnectionsRef.current.forEach((peerConn) => {
          const senders = peerConn.connection.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          }
        });
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // Request a remote participant to mute (host only)
  const requestMuteParticipant = useCallback((participantId: string) => {
    if (channelRef.current) {
      console.log(`Requesting ${participantId} to mute`);
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "mute-request",
          from: userId,
          fromName: userName,
          to: participantId,
        } as SignalMessage,
      });
    }
  }, [userId, userName]);

  // Kick a participant from the meeting (host only)
  const kickParticipant = useCallback((participantId: string) => {
    if (channelRef.current) {
      console.log(`Kicking ${participantId} from meeting`);
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "kick",
          from: userId,
          fromName: userName,
          to: participantId,
        } as SignalMessage,
      });
      // Also disconnect the peer from our side
      handlePeerDisconnect(participantId);
    }
  }, [userId, userName, handlePeerDisconnect]);

  // Clear the muted remotely flag
  const clearMutedRemotely = useCallback(() => {
    setWasMutedRemotely(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveMeeting();
    };
  }, [leaveMeeting]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    isVideoOn,
    isAudioOn,
    isScreenSharing,
    error,
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
  };
};
