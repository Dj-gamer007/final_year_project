import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Transcript {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string | null;
  priority: string;
  status: string;
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  engagement_score: number;
  attention_score: number;
  sentiment: string;
}

export const useMeetingData = (meetingId: string) => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [summaries, setSummaries] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Refs for polling fallback
  const lastSyncTimestampRef = useRef<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef(2000);
  const transcriptIdsRef = useRef<Set<string>>(new Set());

  const fetchMeetingData = useCallback(async () => {
    if (!meetingId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch transcripts
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .select('*, participants(name)')
        .eq('meeting_id', meetingId)
        .order('timestamp_ms', { ascending: true });

      if (transcriptError) throw transcriptError;

      const formattedTranscripts: Transcript[] = (transcriptData || []).map(t => ({
        id: t.id,
        speaker: (t.participants as any)?.name || 'Unknown',
        timestamp: new Date(t.timestamp_ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        text: t.content
      }));
      setTranscripts(formattedTranscripts);

      // Track known IDs for deduplication
      transcriptIdsRef.current = new Set(formattedTranscripts.map(t => t.id));

      // Update last sync timestamp
      if (transcriptData && transcriptData.length > 0) {
        lastSyncTimestampRef.current = transcriptData[transcriptData.length - 1].created_at;
      }

      // Fetch action items
      const { data: actionData, error: actionError } = await supabase
        .from('action_items')
        .select('*')
        .eq('meeting_id', meetingId);

      if (actionError) throw actionError;
      setActionItems(actionData || []);

      // Fetch participants
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('*')
        .eq('meeting_id', meetingId);

      if (participantError) throw participantError;
      setParticipants(participantData || []);

      // Fetch summaries
      const { data: summaryData, error: summaryError } = await supabase
        .from('summaries')
        .select('*')
        .eq('meeting_id', meetingId);

      if (summaryError) throw summaryError;

      const summaryMap: { [key: string]: string } = {};
      (summaryData || []).forEach(s => {
        summaryMap[s.role] = s.content;
      });
      setSummaries(summaryMap);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching meeting data:', error);
      toast({
        title: "Error loading meeting data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  }, [meetingId, toast]);

  // Polling fallback for transcripts
  const pollTranscripts = useCallback(async () => {
    if (!meetingId) return;

    try {
      let query = supabase
        .from('transcripts')
        .select('*, participants(name)')
        .eq('meeting_id', meetingId)
        .order('timestamp_ms', { ascending: true });

      if (lastSyncTimestampRef.current) {
        query = query.gt('created_at', lastSyncTimestampRef.current);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const newTranscripts: Transcript[] = data
          .filter(t => !transcriptIdsRef.current.has(t.id))
          .map(t => ({
            id: t.id,
            speaker: (t.participants as any)?.name || 'Unknown',
            timestamp: new Date(t.timestamp_ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            text: t.content
          }));

        if (newTranscripts.length > 0) {
          newTranscripts.forEach(t => transcriptIdsRef.current.add(t.id));
          setTranscripts(prev => [...prev, ...newTranscripts]);
          lastSyncTimestampRef.current = data[data.length - 1].created_at;
          pollIntervalRef.current = 2000; // Reset on new data
        } else {
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.2, 5000);
        }
      } else {
        // Cap backoff at 5s instead of 30s so transcripts appear quickly for all participants
        pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.2, 5000);
      }
    } catch (err) {
      console.error('Polling error:', err);
      // Reset to fast polling on error
      pollIntervalRef.current = 2000;
    }

    // Schedule next poll
    pollTimeoutRef.current = setTimeout(pollTranscripts, pollIntervalRef.current);
  }, [meetingId]);

  // Setup realtime subscriptions + polling fallback
  useEffect(() => {
    if (!meetingId) {
      setIsLoading(false);
      return;
    }

    fetchMeetingData();

    // Realtime subscription for transcripts
    const transcriptChannel = supabase
      .channel(`transcript-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcripts',
          filter: `meeting_id=eq.${meetingId}`
        },
        async (payload) => {
          // Deduplicate by ID
          if (transcriptIdsRef.current.has(payload.new.id)) return;
          transcriptIdsRef.current.add(payload.new.id);

          let speakerName = 'Unknown';
          if (payload.new.participant_id) {
            const { data: participantData } = await supabase
              .from('participants')
              .select('name')
              .eq('id', payload.new.participant_id)
              .single();
            if (participantData?.name) {
              speakerName = participantData.name;
            }
          }

          const newTranscript: Transcript = {
            id: payload.new.id,
            speaker: speakerName,
            timestamp: new Date(payload.new.timestamp_ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            text: payload.new.content
          };

          setTranscripts(prev => [...prev, newTranscript]);
          lastSyncTimestampRef.current = payload.new.created_at;
          pollIntervalRef.current = 2000; // Reset polling interval
        }
      )
      .subscribe();

    // Realtime subscription for participants
    const participantChannel = supabase
      .channel(`participant-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipants(prev => {
              if (prev.find(p => p.id === payload.new.id)) return prev;
              return [...prev, payload.new as Participant];
            });
          } else if (payload.eventType === 'UPDATE') {
            setParticipants(prev =>
              prev.map(p => p.id === payload.new.id ? payload.new as Participant : p)
            );
          }
        }
      )
      .subscribe();

    // Realtime subscription for summaries
    const summaryChannel = supabase
      .channel(`summary-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'summaries',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          const newSummary = payload.new as any;
          setSummaries(prev => ({ ...prev, [newSummary.role]: newSummary.content }));
        }
      )
      .subscribe();

    // Realtime subscription for action items
    const actionItemChannel = supabase
      .channel(`action-item-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'action_items',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setActionItems(prev => {
              if (prev.find(a => a.id === payload.new.id)) return prev;
              return [...prev, payload.new as ActionItem];
            });
          } else if (payload.eventType === 'UPDATE') {
            setActionItems(prev =>
              prev.map(a => a.id === payload.new.id ? payload.new as ActionItem : a)
            );
          }
        }
      )
      .subscribe();

    // Start polling fallback
    pollTimeoutRef.current = setTimeout(pollTranscripts, pollIntervalRef.current);

    return () => {
      supabase.removeChannel(transcriptChannel);
      supabase.removeChannel(participantChannel);
      supabase.removeChannel(summaryChannel);
      supabase.removeChannel(actionItemChannel);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [meetingId, fetchMeetingData, pollTranscripts]);

  const generateSummary = async (role: string, retryCount = 0): Promise<void> => {
    try {
      const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: { transcript: transcriptText, role }
      });

      if (error) {
        const errorMsg = typeof data?.error === 'string' ? data.error : 
          (error instanceof Error ? error.message : "Unknown error");
        
        // Auto-retry on transient errors (up to 2 retries)
        if (retryCount < 2 && !errorMsg.includes('credits') && !errorMsg.includes('required')) {
          console.log(`Retrying summary generation (attempt ${retryCount + 2})...`);
          toast({
            title: "Retrying...",
            description: `Summary generation encountered an issue, retrying automatically...`,
          });
          await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
          return generateSummary(role, retryCount + 1);
        }
        throw new Error(errorMsg);
      }

      const { error: insertError } = await supabase
        .from('summaries')
        .insert({
          meeting_id: meetingId,
          role,
          content: data.summary
        });

      if (insertError) throw insertError;

      setSummaries(prev => ({ ...prev, [role]: data.summary }));

      toast({
        title: "Summary Generated",
        description: `Summary for ${role} role created successfully`
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: "Error generating summary",
        description: error instanceof Error ? error.message : "Please try again in a moment",
        variant: "destructive"
      });
    }
  };

  const extractActionItems = async (retryCount = 0): Promise<void> => {
    try {
      const transcriptText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const { data, error } = await supabase.functions.invoke('extract-action-items', {
        body: { transcript: transcriptText }
      });

      if (error) {
        const errorMsg = typeof data?.error === 'string' ? data.error : 
          (error instanceof Error ? error.message : "Unknown error");
        
        if (retryCount < 2 && !errorMsg.includes('credits') && !errorMsg.includes('required')) {
          console.log(`Retrying action item extraction (attempt ${retryCount + 2})...`);
          toast({
            title: "Retrying...",
            description: `Action item extraction encountered an issue, retrying automatically...`,
          });
          await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
          return extractActionItems(retryCount + 1);
        }
        throw new Error(errorMsg);
      }

      const itemsToInsert = data.actionItems.map((item: any) => ({
        meeting_id: meetingId,
        ...item
      }));

      const { error: insertError } = await supabase
        .from('action_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      setActionItems(prev => [...prev, ...itemsToInsert]);

      toast({
        title: "Action Items Extracted",
        description: `${data.actionItems.length} action items identified`
      });
    } catch (error) {
      console.error('Error extracting action items:', error);
      toast({
        title: "Error extracting action items",
        description: error instanceof Error ? error.message : "Please try again in a moment",
        variant: "destructive"
      });
    }
  };

  return {
    transcripts,
    actionItems,
    participants,
    summaries,
    isLoading,
    generateSummary,
    extractActionItems
  };
};
