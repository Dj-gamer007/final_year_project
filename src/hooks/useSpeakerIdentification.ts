import { useState, useCallback, useMemo } from 'react';

export interface Speaker {
  id: string;
  name: string;
  color: string;
  isLocal: boolean;
}

interface UseSpeakerIdentificationProps {
  meetingId: string;
  localUserName: string;
  localUserId: string;
  remoteParticipants: Map<string, { name: string; peerId: string }>;
}

// Generate consistent color for each speaker based on their ID
const SPEAKER_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
];

const getColorFromId = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
};

export const useSpeakerIdentification = ({
  meetingId,
  localUserName,
  localUserId,
  remoteParticipants,
}: UseSpeakerIdentificationProps) => {
  // Store manual speaker name overrides
  const [speakerOverrides, setSpeakerOverrides] = useState<Map<string, string>>(new Map());

  // Get all speakers including local and remote
  const speakers = useMemo(() => {
    const speakerMap = new Map<string, Speaker>();
    
    // Add local user
    speakerMap.set(localUserId, {
      id: localUserId,
      name: speakerOverrides.get(localUserId) || localUserName,
      color: getColorFromId(localUserId),
      isLocal: true,
    });

    // Add remote participants
    remoteParticipants.forEach((participant, peerId) => {
      speakerMap.set(peerId, {
        id: peerId,
        name: speakerOverrides.get(peerId) || participant.name,
        color: getColorFromId(peerId),
        isLocal: false,
      });
    });

    return speakerMap;
  }, [localUserId, localUserName, remoteParticipants, speakerOverrides]);

  // Get speaker name by ID
  const getSpeakerName = useCallback((speakerId: string | null, fallback: string = 'Unknown'): string => {
    if (!speakerId) return fallback;
    const speaker = speakers.get(speakerId);
    return speaker?.name || speakerOverrides.get(speakerId) || fallback;
  }, [speakers, speakerOverrides]);

  // Get speaker color by ID
  const getSpeakerColor = useCallback((speakerId: string | null): string => {
    if (!speakerId) return SPEAKER_COLORS[0];
    const speaker = speakers.get(speakerId);
    return speaker?.color || getColorFromId(speakerId);
  }, [speakers]);

  // Check if speaker is local user
  const isLocalSpeaker = useCallback((speakerId: string | null): boolean => {
    if (!speakerId) return false;
    return speakerId === localUserId;
  }, [localUserId]);

  // Update speaker name (manual tagging)
  const updateSpeakerName = useCallback((speakerId: string, newName: string) => {
    setSpeakerOverrides(prev => {
      const newMap = new Map(prev);
      if (newName.trim()) {
        newMap.set(speakerId, newName.trim());
      } else {
        newMap.delete(speakerId);
      }
      // Persist to session storage
      sessionStorage.setItem(
        `speaker-overrides-${meetingId}`,
        JSON.stringify(Array.from(newMap.entries()))
      );
      return newMap;
    });
  }, [meetingId]);

  // Load overrides from session storage on mount
  const loadStoredOverrides = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(`speaker-overrides-${meetingId}`);
      if (stored) {
        const entries = JSON.parse(stored) as [string, string][];
        setSpeakerOverrides(new Map(entries));
      }
    } catch (e) {
      console.error('Failed to load speaker overrides:', e);
    }
  }, [meetingId]);

  // Re-tag a transcript segment with a different speaker
  const retagTranscript = useCallback((transcriptId: string, newSpeakerId: string) => {
    // This could be extended to update the database
    console.log(`Retagging transcript ${transcriptId} to speaker ${newSpeakerId}`);
  }, []);

  return {
    speakers,
    getSpeakerName,
    getSpeakerColor,
    isLocalSpeaker,
    updateSpeakerName,
    loadStoredOverrides,
    retagTranscript,
    speakerList: Array.from(speakers.values()),
  };
};
