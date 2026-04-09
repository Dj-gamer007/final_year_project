import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

export const useChatMessages = (meetingId: string, userId: string, userName: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch existing messages
  useEffect(() => {
    if (!meetingId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat messages:', error);
      } else {
        setMessages(data || []);
      }
      setIsLoading(false);
    };

    fetchMessages();
  }, [meetingId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!meetingId) return;

    const channel = supabase
      .channel(`chat-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            // Skip if already shown (optimistic or duplicate)
            if (prev.some((m) => m.id === newMessage.id || 
              (m.user_id === newMessage.user_id && m.message === newMessage.message && 
               Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000))) {
              // Replace optimistic entry with real one
              return prev.map((m) => 
                m.user_id === newMessage.user_id && m.message === newMessage.message &&
                Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000
                  ? newMessage : m
              );
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || !meetingId) return;

    const optimisticId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      meeting_id: meetingId,
      user_id: userId,
      user_name: userName,
      message: messageText.trim(),
      created_at: new Date().toISOString()
    };

    // Show message immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        id: optimisticId,
        meeting_id: meetingId,
        user_id: userId,
        user_name: userName,
        message: messageText.trim()
      });

    if (error) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      console.error('Error sending message:', error);
      throw error;
    }
  }, [meetingId, userId, userName]);

  return {
    messages,
    isLoading,
    sendMessage
  };
};
