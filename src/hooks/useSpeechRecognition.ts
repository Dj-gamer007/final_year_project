import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSpeechRecognitionProps {
  meetingId: string;
  participantId: string;
  participantName: string;
  isEnabled: boolean;
  enableNoiseReduction?: boolean;
  recognitionLanguage?: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Optimistic transcript for immediate display
export interface OptimisticTranscript {
  id: string;
  text: string;
  speaker: string;
  timestamp: string;
  isPending: boolean;
}

// Batch save configuration
const BATCH_INTERVAL_MS = 2000; // Save every 2 seconds
const MAX_BATCH_SIZE = 5; // Or after 5 phrases

// Supported recognition languages
export const RECOGNITION_LANGUAGES = [
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh-CN', name: 'Chinese', nativeName: '中文' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية' },
];

// Optimized recognition settings for noisy environments
const RECOGNITION_CONFIG = {
  continuous: true,
  interimResults: true,
  maxAlternatives: 3,
};

interface PendingTranscript {
  content: string;
  timestamp_ms: number;
  participantId: string;
  speakerName: string;
}

export const useSpeechRecognition = ({
  meetingId,
  participantId,
  participantName,
  isEnabled,
  enableNoiseReduction = true,
  recognitionLanguage = 'en-US',
}: UseSpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [optimisticTranscripts, setOptimisticTranscripts] = useState<OptimisticTranscript[]>([]);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRunningRef = useRef(false);
  const shouldBeEnabledRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  
  // Batch save refs
  const pendingBatchRef = useRef<PendingTranscript[]>([]);
  const batchTimeoutRef = useRef<number | null>(null);
  const participantCacheRef = useRef<Map<string, string>>(new Map());

  // Get or create participant ID with caching
  const getOrCreateParticipantId = useCallback(async (speakerName: string): Promise<string | null> => {
    if (!meetingId || !speakerName) return null;
    
    // Check cache first
    const cached = participantCacheRef.current.get(speakerName);
    if (cached) return cached;
    
    // Use provided participantId if available
    if (participantId) {
      participantCacheRef.current.set(speakerName, participantId);
      return participantId;
    }

    try {
      // Check if participant already exists
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('name', speakerName)
        .single();
      
      if (existingParticipant) {
        participantCacheRef.current.set(speakerName, existingParticipant.id);
        return existingParticipant.id;
      }
      
      // Create a new participant
      const { data: newParticipant, error: createError } = await supabase
        .from('participants')
        .insert({
          meeting_id: meetingId,
          name: speakerName,
          role: 'participant',
          engagement_score: 80,
          attention_score: 80,
          sentiment: 'neutral'
        })
        .select('id')
        .single();
      
      if (!createError && newParticipant) {
        participantCacheRef.current.set(speakerName, newParticipant.id);
        return newParticipant.id;
      }
    } catch (err) {
      console.error('Failed to get/create participant:', err);
    }
    
    return null;
  }, [meetingId, participantId]);

  // Flush batch to database
  const flushBatch = useCallback(async () => {
    if (pendingBatchRef.current.length === 0 || !meetingId) return;
    
    const batch = [...pendingBatchRef.current];
    pendingBatchRef.current = [];
    
    try {
      // Get participant IDs for all unique speakers
      const uniqueSpeakers = [...new Set(batch.map(t => t.speakerName))];
      const speakerIdMap = new Map<string, string | null>();
      
      await Promise.all(
        uniqueSpeakers.map(async (speaker) => {
          const id = await getOrCreateParticipantId(speaker);
          speakerIdMap.set(speaker, id);
        })
      );
      
      // Prepare batch insert
      const transcriptsToInsert = batch.map(t => ({
        meeting_id: meetingId,
        participant_id: speakerIdMap.get(t.speakerName) || null,
        content: t.content.trim(),
        timestamp_ms: t.timestamp_ms,
      }));
      
      await supabase.from('transcripts').insert(transcriptsToInsert);
      
      // Mark optimistic transcripts as confirmed
      if (mountedRef.current) {
        setOptimisticTranscripts(prev => 
          prev.map(t => ({ ...t, isPending: false }))
        );
      }
    } catch (err) {
      console.error('Failed to save transcript batch:', err);
    }
  }, [meetingId, getOrCreateParticipantId]);

  // Schedule batch flush
  const scheduleBatchFlush = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    // Flush immediately if batch is full
    if (pendingBatchRef.current.length >= MAX_BATCH_SIZE) {
      flushBatch();
      return;
    }
    
    // Otherwise schedule flush
    batchTimeoutRef.current = window.setTimeout(() => {
      flushBatch();
    }, BATCH_INTERVAL_MS);
  }, [flushBatch]);

  // Add transcript to batch with optimistic update
  const addTranscript = useCallback((text: string, speakerName: string) => {
    if (!text.trim() || !meetingId) return;
    
    const timestamp_ms = Date.now();
    const optimisticId = `optimistic-${timestamp_ms}-${Math.random()}`;
    
    // Add optimistic transcript for immediate display
    const optimisticEntry: OptimisticTranscript = {
      id: optimisticId,
      text: text.trim(),
      speaker: speakerName,
      timestamp: new Date().toLocaleTimeString(),
      isPending: true,
    };
    
    if (mountedRef.current) {
      setOptimisticTranscripts(prev => [...prev, optimisticEntry]);
    }
    
    // Add to pending batch
    pendingBatchRef.current.push({
      content: text.trim(),
      timestamp_ms,
      participantId: participantId || '',
      speakerName,
    });
    
    // Schedule batch flush
    scheduleBatchFlush();
  }, [meetingId, participantId, scheduleBatchFlush]);

  // Clear any pending timeout
  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  // Safely start recognition
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current || isRunningRef.current || !mountedRef.current) return;
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Already running or failed to start
    }
  }, []);

  // Safely stop recognition
  const stopRecognition = useCallback(() => {
    clearRestartTimeout();
    
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.abort();
    } catch (e) {
      // Not running
    }
    
    isRunningRef.current = false;
    if (mountedRef.current) {
      setIsListening(false);
      setInterimTranscript('');
    }
  }, [clearRestartTimeout]);

  // Initialize recognition once on mount
  useEffect(() => {
    mountedRef.current = true;
    
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = RECOGNITION_CONFIG.continuous;
    recognition.interimResults = RECOGNITION_CONFIG.interimResults;
    recognition.lang = recognitionLanguage;
    // Use multiple alternatives for better accuracy in noisy environments
    (recognition as any).maxAlternatives = RECOGNITION_CONFIG.maxAlternatives;

    recognition.onstart = () => {
      isRunningRef.current = true;
      if (mountedRef.current) {
        setIsListening(true);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!mountedRef.current) return;
      
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        // Get the best transcript (highest confidence)
        const result = event.results[i];
        let bestTranscript = result[0].transcript;
        let bestConfidence = result[0].confidence || 0;
        
        // Check alternatives for better match (if available)
        for (let j = 1; j < result.length; j++) {
          if (result[j].confidence > bestConfidence) {
            bestTranscript = result[j].transcript;
            bestConfidence = result[j].confidence;
          }
        }
        
        if (result.isFinal) {
          // Only accept transcripts with reasonable confidence
          if (bestConfidence >= 0.5 || bestConfidence === 0) {
            final += bestTranscript;
          }
        } else {
          interim += bestTranscript;
        }
      }

      if (final) {
        addTranscript(final, participantName);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore expected errors
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }
      
      // Log non-critical errors for debugging
      if (event.error !== 'network') {
        console.warn('Speech recognition issue:', event.error);
      }
      
      if (event.error === 'not-allowed') {
        isRunningRef.current = false;
        if (mountedRef.current) {
          setIsListening(false);
        }
        return;
      }
      
      // For recoverable errors, attempt restart
      if (event.error === 'network' || event.error === 'audio-capture') {
        if (shouldBeEnabledRef.current && mountedRef.current) {
          clearRestartTimeout();
          restartTimeoutRef.current = window.setTimeout(() => {
            if (shouldBeEnabledRef.current && mountedRef.current && !isRunningRef.current) {
              startRecognition();
            }
          }, 500);
        }
      }
    };

    recognition.onend = () => {
      isRunningRef.current = false;
      
      if (!mountedRef.current) return;
      
      setIsListening(false);
      
      // Only restart if should still be enabled - restart immediately for faster transcription
      if (shouldBeEnabledRef.current && meetingId) {
        clearRestartTimeout();
        restartTimeoutRef.current = window.setTimeout(() => {
          if (shouldBeEnabledRef.current && mountedRef.current && !isRunningRef.current) {
            startRecognition();
          }
        }, 50); // Minimal delay for fastest restart
      }
    };

    recognitionRef.current = recognition;

    return () => {
      mountedRef.current = false;
      clearRestartTimeout();
      
      // Flush any remaining batch
      if (pendingBatchRef.current.length > 0) {
        flushBatch();
      }
      
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      try {
        recognition.abort();
      } catch (e) {
        // Not running
      }
    };
  }, [addTranscript, meetingId, clearRestartTimeout, startRecognition, flushBatch, participantName, recognitionLanguage]);

  // Handle enable/disable changes - simplified without mic setup
  useEffect(() => {
    shouldBeEnabledRef.current = isEnabled && !!meetingId;
    
    clearRestartTimeout();
    
    if (isEnabled && meetingId) {
      // Start recognition directly - Web Speech API uses system mic
      restartTimeoutRef.current = window.setTimeout(() => {
        if (shouldBeEnabledRef.current && mountedRef.current) {
          startRecognition();
        }
      }, 100);
    } else {
      stopRecognition();
      
      // Flush remaining batch when disabled
      if (pendingBatchRef.current.length > 0) {
        flushBatch();
      }
    }
    
    return () => {
      clearRestartTimeout();
    };
  }, [isEnabled, meetingId, startRecognition, stopRecognition, clearRestartTimeout, flushBatch]);

  // Clear optimistic transcripts when they're confirmed via realtime subscription
  const clearConfirmedOptimistic = useCallback(() => {
    setOptimisticTranscripts(prev => prev.filter(t => t.isPending));
  }, []);

  return {
    isListening,
    isSupported,
    interimTranscript,
    optimisticTranscripts,
    clearConfirmedOptimistic,
    // Keep these for API compatibility but they're no longer actively updated
    audioLevel: 0,
    isSpeechDetected: false,
  };
};
