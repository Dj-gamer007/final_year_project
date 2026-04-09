import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseAudioRecordingOptions {
  meetingId: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  startTime: number | null;
}

export const useAudioRecording = ({ meetingId }: UseAudioRecordingOptions) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    startTime: null,
  });
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

      const startTime = Date.now();
      setRecordingState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        startTime,
      });

      // Update duration every second
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: Date.now() - startTime,
        }));
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !recordingState.isRecording) {
        resolve(null);
        return;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const mediaRecorder = mediaRecorderRef.current;
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration = recordingState.duration;
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        setRecordingState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          startTime: null,
        });

        // Upload to Supabase Storage
        setIsUploading(true);
        try {
          const fileName = `${meetingId}/${Date.now()}.webm`;
          
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(fileName, audioBlob, {
              contentType: 'audio/webm',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Save recording metadata
          const { error: dbError } = await supabase
            .from('recordings')
            .insert({
              meeting_id: meetingId,
              file_path: fileName,
              duration_ms: duration,
              file_size: audioBlob.size,
              started_at: new Date(recordingState.startTime || Date.now()).toISOString(),
              ended_at: new Date().toISOString(),
            });

          if (dbError) throw dbError;

          toast.success('Recording saved successfully');
          resolve(fileName);
        } catch (error) {
          console.error('Failed to save recording:', error);
          toast.error('Failed to save recording');
          resolve(null);
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.stop();
      mediaRecorderRef.current = null;
    });
  }, [meetingId, recordingState]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording && !recordingState.isPaused) {
      mediaRecorderRef.current.pause();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      setRecordingState(prev => ({ ...prev, isPaused: true }));
      toast.info('Recording paused');
    }
  }, [recordingState]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isPaused) {
      mediaRecorderRef.current.resume();
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: Date.now() - (prev.startTime || Date.now()),
        }));
      }, 1000);
      setRecordingState(prev => ({ ...prev, isPaused: false }));
      toast.info('Recording resumed');
    }
  }, [recordingState.isPaused]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    isRecording: recordingState.isRecording,
    isPaused: recordingState.isPaused,
    duration: recordingState.duration,
    formattedDuration: formatDuration(recordingState.duration),
    isUploading,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
};
