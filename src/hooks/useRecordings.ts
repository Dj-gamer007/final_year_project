import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Recording {
  id: string;
  meeting_id: string;
  file_path: string;
  duration_ms: number;
  file_size: number;
  created_at: string;
  started_at: string;
  ended_at: string | null;
}

export const useRecordings = (meetingId: string) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    if (!meetingId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  const deleteRecording = useCallback(async (recordingId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('recordings')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recordingId);

      if (dbError) throw dbError;

      setRecordings(prev => prev.filter(r => r.id !== recordingId));
      toast.success('Recording deleted');
    } catch (error) {
      console.error('Failed to delete recording:', error);
      toast.error('Failed to delete recording');
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // Real-time subscription
  useEffect(() => {
    if (!meetingId) return;

    const channel = supabase
      .channel(`recordings-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recordings',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          setRecordings(prev => [payload.new as Recording, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'recordings',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          setRecordings(prev => prev.filter(r => r.id !== (payload.old as Recording).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    recordings,
    isLoading,
    deleteRecording,
    refetch: fetchRecordings,
    formatDuration,
    formatFileSize,
  };
};
